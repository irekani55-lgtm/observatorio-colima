"""
Importa las votaciones del Pleno de la LXI Legislatura desde las actas de sesión.

- Votaciones nominales: el acta transcribe «Dip. Nombre, a favor; …» y luego «se declaró aprobado por N votos
  a favor, N en contra y N abstenciones». Cada declaración de resultado es una votación; su lista es la que
  la precede (así se separan votaciones en lo general y en lo particular).
- Votaciones económicas de puntos de acuerdo (sin registro individual): se toman del resultado ya importado.

El sentido del voto solo se registra cuando el acta lo transcribe. No se infiere del partido ni del resultado.
Las personas sin voto en la lista no se registran (no se presume ausencia).

Requiere: congreso_asistencias.py, congreso_actas.py, congreso_asuntos.py, congreso_dictamenes.py y congreso_acuerdos.py.
Escribe votaciones.csv y votos.csv.

Uso: python scripts/importar/congreso_votaciones.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from congreso_asistencias import CRUDOS  # noqa: E402
from congreso_asuntos import EVID, Reconocedor, ev, escribir, leer_csv  # noqa: E402
from fechas_presentacion import norm  # noqa: E402
from coincidencias import Indice  # noqa: E402
from datetime import date

RESULTADO = re.compile(r"(?i)se declar[óo]\s+(aprobad[oa]|rechazad[oa]|desechad[oa]|no aprobad[oa])\s+(?:en lo (?:general|particular)[^,]*,\s*)?(?:por\s+)?"
                       r"(?:(\d+)\s+[a-záéíóúñ ]*?\s*votos?\s+a\s+favor,?\s*(\d+)\s+[a-záéíóúñ ]*?\s*votos?\s+en\s+contra\s+y\s+(\d+)\s+[a-záéíóúñ ]*?\s*abstenci|(?:la\s+)?unanimidad)")
LISTA_INICIO = re.compile(r"(?i)(siguientes t[ée]rminos|de la siguiente manera|votaci[óo]n nominal[^:]*):")
CABEZA = re.compile(r"(?i)(dio lectura|procedi[óo] a dar lectura|present[óo]|ley[óo])\s+(al?|el|la|del|un|una)\s+(del\s+)?(dictamen|iniciativa|punto de acuerdo|acuerdo)")
NUM_DICT = re.compile(r"(?i)dictamen\s+(?:n[úu]mero|no\.?|n°)?\s*(\d{1,3})")
# «Dip. Nombre, a favor» sin cruzar al siguiente «Dip.»; tolera comas, puntos y punto y coma mal colocados.
ITEM = re.compile(r"(?i)\bdip(?:utad[oa])?\.?\s+((?:(?!\bdip(?:utad[oa])?\.?\s)[^:])+?)[\s,.;:]*\b(a favor|en contra|abstenci[óo]n|se abstiene|abstuvo)\b")


def votos_de_lista(lista: str, rec: Reconocedor) -> tuple[list[tuple[str, str]], list[str]]:
    votos, no_reconocidos = [], []
    # Algunas actas omiten la «a»: «Dip. Nombre, favor;» equivale a «a favor».
    lista = re.sub(r"(?i),\s*favor\b", ", a favor", lista)
    # Se corta la lista en cada sentido del voto; el nombre es lo que hay entre ese sentido y el anterior.
    # «por la negativa» = en contra; «por la afirmativa» = a favor (fórmulas usadas en algunas actas)
    partes = re.split(r"(?i)\b(a favor|en contra|por la negativa|por la afirmativa|abstenci[óo]n|se abstiene|abstuvo)\b", lista)
    for antes, sentido in zip(partes[0::2], partes[1::2]):
        # último fragmento con texto («Nombre; a favor» deja vacío el fragmento final)
        nombre = next((x for x in reversed(re.split(r"[;:]", antes)) if len(re.sub(r"[^A-Za-zÁÉÍÓÚÑáéíóúñ]", "", x)) >= 5), "")
        nombre = re.sub(r"(?i)^[\s,.]*(?:y\s+)?(?:la\s+|el\s+)?dip(?:utad[oa])?[.,]?\s*", "", nombre.strip(" ,.\n")).strip(" ,;.")
        if len(nombre) < 5 or len(nombre) > 70:
            continue
        sentido = sentido.lower()
        sentido = "favor" if sentido in ("a favor", "por la afirmativa") else ("contra" if ("contra" in sentido or "negativa" in sentido) else "abstencion")
        quien = rec.buscar(nombre)
        if quien:
            votos.append((quien[0]["id_diputado"], sentido))
        else:
            no_reconocidos.append(nombre)
    return votos, no_reconocidos


def sesion_de(acta: dict, sesiones_fecha: list[dict]) -> str:
    """Sesión del catálogo que corresponde al acta (misma fecha; si hay varias, por tipo y número)."""
    if len(sesiones_fecha) == 1:
        return sesiones_fecha[0]["id_sesion"]
    d = acta["descripcion"].lower()
    tipo = "permanente" if "permanente" in d and "comisi" in d else ("solemne" if "solemne" in d else ("extraordinaria" if "extraordinaria" in d else "ordinaria"))
    num = re.search(r"(?:ordinaria|extraordinaria|solemne|permanente|sesi[óo]n)\s*(?:no\.?\s*|n[úu]mero\s*)?(\d{1,3})", d)
    for s in sesiones_fecha:
        if s["tipo_sesion"] == tipo and (not num or s["numero_sesion"] == str(int(num.group(1)))):
            return s["id_sesion"]
    candidatos = [s for s in sesiones_fecha if s["tipo_sesion"] == tipo]
    return candidatos[0]["id_sesion"] if len(candidatos) == 1 else ""


def main() -> None:
    rec = Reconocedor(leer_csv("diputados"))
    sesiones = leer_csv("sesiones")
    asuntos = leer_csv("asuntos")
    dic = [a for a in asuntos if a["tipo"] == "dictamen"]
    pas = [a for a in asuntos if a["id_asunto"].startswith("PA-")]
    idx = json.loads((CRUDOS / "actas" / "indice.json").read_text(encoding="utf-8"))
    otros = [a for a in asuntos if a["tipo"] in ("iniciativa", "otro", "acuerdo", "exhorto", "punto_acuerdo") or a["tipo"] == "dictamen"]
    indice_otros = Indice((a["id_asunto"], a["descripcion"]) for a in otros)
    por_id = {a["id_asunto"]: a for a in asuntos}
    votaciones, votos, avisos = [], [], []
    n_sin_sesion = 0
    for acta in idx:
        if not acta.get("archivo"):
            continue
        texto = (CRUDOS / "actas" / acta["archivo"]).read_text(encoding="utf-8").replace("\n", " \n")
        mismas = [s for s in sesiones if s["fecha"] == acta["fecha"]]
        id_ses = sesion_de(acta, mismas)
        n_sin_sesion += not id_ses
        fuente = ev(f"EV-ACTA-{acta['fecha']}-{acta['archivo'][-7:-4]}", "acta", acta["descripcion"][:200], acta.get("url", ""), acta["fecha"])
        previo = 0
        k = 0
        for m in RESULTADO.finditer(texto):
            k += 1
            antes = texto[previo:m.start()]
            previo = m.end()
            li = list(LISTA_INICIO.finditer(antes))
            lista = antes[li[-1].end():] if li else ""
            vts, no_rec = votos_de_lista(lista, rec) if lista else ([], [])
            # documento votado: último encabezado de lectura antes del resultado
            cabezas = list(CABEZA.finditer(texto[:m.start()]))
            cab = texto[cabezas[-1].start():cabezas[-1].start() + 700] if cabezas else ""
            nd = NUM_DICT.search(cab[:300])
            general = re.search(r"(?i)en lo particular", antes[-600:]) and not re.search(r"(?i)en lo general y en lo particular", antes[-600:])
            alcance = "en lo particular" if general else ("en lo general" if re.search(r"(?i)en lo general(?! y en lo particular)", antes[-600:]) else "en lo general y en lo particular")
            id_asunto = ""
            if nd:
                cands = [a for a in dic if a["expediente"].startswith(f"Dictamen {int(nd.group(1))} ") and a["fecha_votacion"] == acta["fecha"]]
                if len(cands) > 1:  # mismo número en dos comisiones: se elige por las palabras de la comisión
                    t = set(norm(cab[:400]))
                    cands = sorted(cands, key=lambda a: -len(set(norm(a["expediente"])) & t))[:1]
                if not cands:  # dictamen con el mismo número votado en otra fecha cercana (posterior a su elaboración)
                    cands = [a for a in dic if a["expediente"].startswith(f"Dictamen {int(nd.group(1))} ") and a["fecha_dictamen"] <= acta["fecha"]
                             and (date.fromisoformat(acta["fecha"]) - date.fromisoformat(a["fecha_dictamen"])).days <= 150]
                    t = set(norm(cab[:400]))
                    cands = sorted(cands, key=lambda a: (-len(set(norm(a["expediente"])) & t), a["fecha_dictamen"]))[:1] if cands else []
                if cands:
                    id_asunto = cands[0]["id_asunto"]
            if not id_asunto and cab:
                permit = {a["id_asunto"] for a in otros if (a["fecha_presentacion"] or a["fecha_dictamen"] or "0000") <= acta["fecha"]}
                k_, _ = indice_otros.mejor(re.sub(r"(?i)^.*?(dictamen|iniciativa|punto de acuerdo|acuerdo)", "", cab[:700]), permit, 0.45, 0.1)
                if k_:
                    id_asunto = k_
            resultado = "aprobado" if m.group(1).lower().startswith("aprobad") else "rechazado"
            favor, contra, abst = (int(m.group(2)), int(m.group(3)), int(m.group(4))) if m.group(2) else (None, None, None)
            nominal = len(vts) >= 5
            id_v = f"VOT-61-{acta['fecha'].replace('-', '')}-{acta['archivo'][-7:-4]}-{k:02d}"
            que = (f"Dictamen {nd.group(1)}" if nd else re.sub(r"\s+", " ", cab[:160]).strip()) or "Asunto no identificado"
            votaciones.append({"id_votacion": id_v, "id_sesion": id_ses, "id_asunto": id_asunto, "descripcion": f"Votación {alcance}: {que}"[:300],
                               "tipo_votacion": "nominal" if nominal else "economica", "resultado": resultado,
                               "total_favor": favor if favor is not None else "", "total_contra": contra if contra is not None else "", "total_abstencion": abst if abst is not None else "",
                               "id_fuente": fuente, "estado_verificacion": "verificado" if id_ses else "pendiente"})
            vistos = set()
            for id_d, sentido in vts:
                if id_d in vistos:
                    avisos.append(f"{id_v}: {id_d} aparece dos veces en la lista")
                    continue
                vistos.add(id_d)
                votos.append({"id_votacion": id_v, "id_diputado": id_d, "sentido": sentido, "id_fuente": fuente})
            if no_rec:
                avisos.append(f"{id_v}: nombres no reconocidos: {', '.join(no_rec[:4])}")
            if nominal and favor is not None and favor != sum(1 for _, s in vts if s == "favor"):
                avisos.append(f"{id_v}: total oficial a favor {favor} ≠ {sum(1 for _, s in vts if s == 'favor')} votos leídos")

    # Votaciones económicas de puntos de acuerdo (resultado ya importado, sin registro individual)
    for a in pas:
        if not a["fecha_votacion"]:
            continue
        mismas = [s for s in sesiones if s["fecha"] == a["fecha_votacion"] and s["cuenta_para_asistencia"] == "si"]
        votaciones.append({"id_votacion": f"VOT-{a['id_asunto']}", "id_sesion": mismas[0]["id_sesion"] if len(mismas) == 1 else "", "id_asunto": a["id_asunto"],
                           "descripcion": f"Votación del {'exhorto' if a['tipo'] == 'exhorto' else 'punto de acuerdo'} (sin registro nominal en el acta)", "tipo_votacion": "economica",
                           "resultado": a["resultado_votacion"] or "no_localizado", "total_favor": "", "total_contra": "", "total_abstencion": "", "id_fuente": a["id_fuente"],
                           "estado_verificacion": "verificado" if len(mismas) == 1 else "pendiente"})

    escribir("votaciones", ["id_votacion", "id_sesion", "id_asunto", "descripcion", "tipo_votacion", "resultado", "total_favor", "total_contra", "total_abstencion", "id_fuente", "estado_verificacion"], votaciones)
    escribir("votos", ["id_votacion", "id_diputado", "sentido", "id_fuente"], votos)
    existentes = {e["id_fuente"]: e for e in leer_csv("evidencias")}
    existentes.update({k: v for k, v in EVID.items() if k not in existentes})
    escribir("evidencias", ["id_fuente", "tipo", "titulo", "institucion", "url", "fecha_documento", "fecha_consulta", "oficial", "pagina", "notas"], list(existentes.values()))
    nominales = [v for v in votaciones if v["tipo_votacion"] == "nominal"]
    print(f"   {len(votaciones)} votaciones ({len(nominales)} nominales), {len(votos)} votos individuales; {sum(1 for v in votaciones if v['id_asunto'])} ligadas a un asunto; {n_sin_sesion} actas sin sesión identificada")
    for a in [x for x in avisos if "≠" not in x] + [x for x in avisos if "≠" in x][:10]:
        print("   AVISO", a)


if __name__ == "__main__":
    main()
