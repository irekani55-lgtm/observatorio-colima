"""
Importa acuerdos, puntos de acuerdo y exhortos de la LXI Legislatura, con el seguimiento de los exhortos.

Fuentes:
- Gaceta: lista de acuerdos («tacuerdos») y de puntos de acuerdo («tpa»).
- Actas de sesión: puntos de acuerdo presentados en el Pleno (generalmente en asuntos generales) y su resultado.
- Síntesis de comunicaciones: oficios de autoridades que «dan respuesta al Punto de Acuerdo…».

Requiere: congreso_asistencias.py, congreso_actas.py, congreso_asuntos.py y congreso_dictamenes.py.
Actualiza asuntos.csv (ACU-*, PA-*), asunto_promoventes.csv y exhortos.csv.

Uso: python scripts/importar/congreso_acuerdos.py [--refrescar]

Reglas: la aprobación de un exhorto no equivale a su cumplimiento. «Sin respuesta localizada» significa
que no se encontró respuesta en las síntesis revisadas; nunca se clasifica un exhorto como incumplido.
La fecha de envío del oficio a la autoridad no se publica en estas fuentes y queda vacía.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from coincidencias import Indice  # noqa: E402
from congreso_asistencias import CRUDOS, GACETA, texto  # noqa: E402
from congreso_asuntos import EVID, GRUPOS, Reconocedor, colectivos, ev, escribir, leer_csv, lista_gaceta, sin_acentos, url_abs  # noqa: E402

PARTIDO_DE_GRUPO = {"Morena": "MORENA", "PRI": "PRI", "PAN": "PAN", "PT": "PT", "PVEM": "PVEM", "Movimiento Ciudadano": "MC", "Nueva Alianza": "PANAL"}

PRESENTA = re.compile(r"(?i)(present[óo]|propus[oi]|propone|dio lectura|expuso|someti[óo]).{0,120}(punto de acuerdo|exhort)")
# Solo fórmulas con que el acta declara el resultado; se evitan verbos en futuro del debate («aprobarán»).
RESULTADO = re.compile(r"(?i)(se aprueba|se aprob[óo]|fue aprobad[oa]|es aprobad[oa]|result[óo] aprobad[oa]|se declar[óo] aprobad[oa]|aprobad[oa] por (?:unanimidad|mayor[ií]a)"
                       r"|desechad[oa]|se desech[óo]|no alcanz[óo] la votaci[óo]n|se turn[óo] a (?:la |las )?comisi|se turna a (?:la |las )?comisi|turnad[oa] a (?:la |las )?comisi|regres[ao] a comisi)")
SIGUIENTE = re.compile(r"(?i)^(en el siguiente punto|en el subsecuente punto|de conformidad con el siguiente punto|no habiendo m[aá]s|en desahogo del siguiente)"
                       r"|(present[óo]|dio lectura a)\s+(en tribuna\s+)?(una|la|el|al)\s+(iniciativa|dictamen)")
DESTINO = re.compile(r"(?i)(?:exhort\w*|invitaci[óo]n|solicit\w*)\s+(?:respetuosa\w*\s+|atenta\w*\s+|de manera respetuosa\s+)*(?:y atentamente\s+)?(?:a|al|a la|a las|a los)\s+(.+?)(?=,\s*(?:para|a fin|en el [áa]mbito|con el|a efecto)|\s+(?:para que|a fin de|a efecto de|con el objeto|con la finalidad|en el [áa]mbito de)|[.;]|$)")


def orden_de_gobierno(autoridad: str) -> str:
    a = sin_acentos(autoridad)
    if re.search(r"gobierno de mexico|federal|congreso de la union|camara de (diputados|senadores)|senado de la republica|imss|issste|cfe|comision federal|conagua|sict|secretaria de infraestructura, comunicaciones|presidencia de la republica|guardia nacional|sedena|pemex", a):
        return "federal"
    if re.search(r"ayuntamiento|municipi|presidenta? municipal|cabildo|dif municipal", a):
        return "municipal"
    if re.search(r"derechos humanos|fiscalia|instituto electoral|infocol|tribunal|osafig|universidad", a):
        return "autonomo"
    if re.search(r"mesa directiva|congreso del estado|junta de gobierno|comision de |comisiones de ", a):
        return "legislativo"
    return "estatal"


def propuestas_en_actas(rec: Reconocedor) -> list[dict]:
    idx = json.loads((CRUDOS / "actas" / "indice.json").read_text(encoding="utf-8"))
    salida = []
    for doc in idx:
        if not doc.get("archivo"):
            continue
        P = [p.strip() for p in (CRUDOS / "actas" / doc["archivo"]).read_text(encoding="utf-8").split("\n") if p.strip()]
        for i, p in enumerate(P):
            if not PRESENTA.search(p) or p.lower().startswith(("lectura", "presentación")):
                continue
            resultado, frase = "", ""
            for q in P[i:i + 25]:
                if q is not p and (PRESENTA.search(q) or SIGUIENTE.search(q)):
                    break
                if True:  # las fórmulas de RESULTADO son estrictas; se aceptan en cualquier párrafo del bloque
                    m = RESULTADO.search(q)
                    if m:
                        t = m.group(1).lower()
                        resultado = "aprobado" if ("aprob" in t or "aprueb" in t) else ("rechazado" if ("desech" in t or "no alcanz" in t) else "turnado")
                        frase = q[:300]
                        break
            presentador = rec.buscar(p[:200])
            m_sus = re.search(r"(?i)suscrit[oa]s?\s+(?:tambi[eé]n\s+)?por\s+(.{0,250})", p)
            coautores = [d["id_diputado"] for d in rec.buscar(m_sus.group(1))] if m_sus else []
            salida.append({"fecha": doc["fecha"], "texto": p, "resultado": resultado, "frase": frase, "url": doc.get("url", ""),
                           "presentador": presentador[0]["id_diputado"] if presentador else "", "coautores": coautores, "colectivos": colectivos(p[:300])})
    return salida


def respuestas_en_sintesis() -> list[dict]:
    idx = json.loads((CRUDOS / "sintesis" / "indice.json").read_text(encoding="utf-8"))
    salida = []
    for doc in idx:
        if not doc.get("archivo"):
            continue
        for l in (CRUDOS / "sintesis" / doc["archivo"]).read_text(encoding="utf-8").split("\n"):
            if re.search(r"(?i)(da|dan|dio|emite)\s+respuesta\s+(al|a los|a la|a)\s+(punto|exhorto|acuerdo)", l):
                m = re.search(r"(?i)de fecha (\d{1,2}) de (\w+) de (\d{4})", l)
                meses = {m_: i for i, m_ in enumerate(["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"], 1)}
                f_oficio = f"{m.group(3)}-{meses.get(m.group(2).lower(), 0):02d}-{int(m.group(1)):02d}" if m and m.group(2).lower() in meses else ""
                salida.append({"fecha_sintesis": doc["fecha"], "fecha_oficio": f_oficio, "texto": l.strip(), "url": doc.get("url", ""), "descripcion": doc.get("descripcion", "")})
    return salida


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refrescar", action="store_true")
    args = ap.parse_args()
    asuntos = [a for a in leer_csv("asuntos") if not a["id_asunto"].startswith(("ACU-", "PA-"))]
    promoventes = [p for p in leer_csv("asunto_promoventes") if not p["id_asunto"].startswith(("ACU-", "PA-"))]
    rec = Reconocedor(leer_csv("diputados"))
    cols = list(leer_csv("asuntos")[0].keys())
    nuevos, prom_nuevos, exhortos = [], [], []

    # --- 1. Acuerdos parlamentarios
    print("1/4 Acuerdos…")
    sopa = BeautifulSoup(lista_gaceta("tacuerdos", args.refrescar), "html.parser")
    ini_por_acuerdo = {}
    for a in asuntos:
        m = re.match(r"Acuerdo (\d+)", a.get("numero_decreto_acuerdo", ""))
        if m and a["id_asunto"].startswith("INI-"):
            ini_por_acuerdo.setdefault(int(m.group(1)), a["id_asunto"])
    for n in sopa.find_all("div", attrs={"title": "No. Acuerdo"}):
        f = n.parent
        num = int(re.sub(r"\D", "", n.get_text()) or 0)
        desc = texto(f.find("div", attrs={"title": "Descripción"}))
        fa = texto(f.find("div", attrs={"title": "Fecha Aprobación"}))
        fa = "" if fa.startswith(("0000", "0001")) else fa
        pdf = [x["href"] for x in f.find_all("a", href=True) if x["href"].lower().endswith(".pdf")]
        url = url_abs(pdf[0]) if pdf else ""
        nuevos.append({"id_asunto": f"ACU-61-{num:03d}", "tipo": "acuerdo", "titulo": f"Acuerdo {num}: {desc[:260]}", "descripcion": desc, "tema": "", "fecha_presentacion": fa,
                       "estado_procesal": "aprobado" if fa else "no_verificado", "fecha_aprobacion": fa, "fecha_votacion": fa, "resultado_votacion": "aprobado" if fa else "",
                       "numero_decreto_acuerdo": f"Acuerdo {num}", "id_asunto_origen": ini_por_acuerdo.get(num, ""), "url_ficha": f"{GACETA}?v=tacuerdos&l=61", "url_documento": url,
                       "id_fuente": ev(f"EV-ACUERDO-{num}", "gaceta", f"Acuerdo {num} de la LXI Legislatura", url or f"{GACETA}?v=tacuerdos&l=61", fa), "estado_verificacion": "verificado",
                       "notas": "" if fa else "La Gaceta no registra fecha de aprobación."})

    # --- 2. Puntos de acuerdo: lista oficial + actas
    print("2/4 Puntos de acuerdo y exhortos…")
    sopa = BeautifulSoup(lista_gaceta("tpa", args.refrescar), "html.parser")
    lista_pa = []
    for n in sopa.find_all("div", attrs={"title": "No."}):
        f = n.parent
        desc_div = f.find("div", attrs={"title": "Descripción"})
        desc = re.sub(r"\s+", " ", desc_div.find(string=True, recursive=False) or "").strip() if desc_div else ""
        autor = re.sub(r"^Autor:\s*", "", texto(f.find(string=re.compile("Autor")).parent)) if f.find(string=re.compile("Autor")) else ""
        st = texto(f.find("div", attrs={"title": "Status"}))
        fp = texto(f.find("div", attrs={"title": "Fecha Presentación"}))
        ft = texto(f.find("div", attrs={"title": "Fecha Tramitada"}))
        pdf = [x["href"] for x in f.find_all("a", href=True) if x["href"].lower().endswith(".pdf")]
        lista_pa.append({"numero": int(re.sub(r"\D", "", n.get_text()) or 0), "descripcion": desc, "autor": autor, "status": st, "fecha": fp, "fecha_tramite": ft, "url": url_abs(pdf[0]) if pdf else ""})
    actas = propuestas_en_actas(rec)
    # Une cada punto de la lista con su presentación en el acta (misma fecha y texto similar)
    idx_actas = Indice((str(i), x["texto"]) for i, x in enumerate(actas))
    usados = set()
    registros = []
    for pa in lista_pa:
        mismas = {str(i) for i, x in enumerate(actas) if x["fecha"] == pa["fecha"]}
        k, _ = idx_actas.mejor(pa["descripcion"], mismas, 0.3, 0.05)
        acta = actas[int(k)] if k is not None else None
        if k is not None:
            usados.add(int(k))
        registros.append({"id": f"PA-61-{pa['numero']:03d}", "texto": pa["descripcion"], "fecha": pa["fecha"], "lista": pa, "acta": acta})
    contador = {}
    for i, x in enumerate(actas):
        if i in usados:
            continue
        contador[x["fecha"]] = contador.get(x["fecha"], 0) + 1
        registros.append({"id": f"PA-61-A{x['fecha'].replace('-', '')}-{contador[x['fecha']]}", "texto": x["texto"], "fecha": x["fecha"], "lista": None, "acta": x})

    for r in registros:
        pa, acta = r["lista"], r["acta"]
        notas = []
        txt = r["texto"]
        es_exhorto = bool(re.search(r"(?i)exhort", txt + " " + (acta["texto"] if acta else "")))
        estado = ""
        if pa:
            s = pa["status"].lower()
            estado = "aprobado" if s.startswith("aprobad") else ("rechazado" if s.startswith(("desechad", "rechazad")) else ("turnado" if "turn" in s else ""))
            notas.append(f"Lista oficial de puntos de acuerdo: núm. {pa['numero']}, estado «{pa['status']}».")
        if acta:
            if not estado and acta["resultado"]:
                estado = acta["resultado"]
            notas.append(f"Presentado en la sesión del {acta['fecha']} según el acta ({acta['url']})." + (f" Resultado en el acta: «{acta['frase'][:160]}»" if acta["frase"] else " El acta no registra el resultado."))
        if not estado:
            estado = "pendiente"
            notas.append("Resultado no localizado.")
        f_aprob = (pa["fecha_tramite"] if pa and estado == "aprobado" and pa["fecha_tramite"] else (r["fecha"] if estado == "aprobado" else ""))
        sin_abrev = lambda t: re.sub(r"\b(H|C|Lic|Dr|Dra|Mtro|Mtra|Ing|Profr?a?|Arq)\.\s*", r"\1 ", t)  # «H. Ayuntamiento» no corta la frase
        destino = DESTINO.search(sin_abrev(txt)) or (DESTINO.search(sin_abrev(acta["texto"])) if acta else None)
        autoridad = re.sub(r"\s+", " ", destino.group(1)).strip(" ,.")[:250] if destino else ""
        id_fuente = ev(f"EV-{r['id']}", "gaceta" if pa else "acta", f"{'Punto de acuerdo' if not es_exhorto else 'Exhorto'} {r['id']}", (pa["url"] if pa and pa["url"] else (acta["url"] if acta else "")) or f"{GACETA}?v=tpa&l=61", r["fecha"])
        nuevos.append({"id_asunto": r["id"], "tipo": "exhorto" if es_exhorto else "punto_acuerdo", "titulo": (txt[:280] if pa else re.sub(r"^(La|El)\s+Diputad[oa]\s+[^,]+,\s*", "", txt)[:280]),
                       "descripcion": txt, "tema": "", "fecha_presentacion": r["fecha"], "estado_procesal": estado, "fecha_aprobacion": f_aprob,
                       "fecha_votacion": r["fecha"] if estado in ("aprobado", "rechazado") else "", "resultado_votacion": estado if estado in ("aprobado", "rechazado") else "",
                       "url_ficha": f"{GACETA}?v=tpa&l=61" if pa else (acta["url"] if acta else ""), "url_documento": pa["url"] if pa else "", "id_fuente": id_fuente,
                       "estado_verificacion": "verificado" if (pa or acta["presentador"]) else "pendiente", "notas": " ".join(notas)})
        quien = rec.buscar(pa["autor"]) if pa and pa["autor"] else []
        if acta and acta["presentador"] and not any(q["id_diputado"] == acta["presentador"] for q in quien):
            quien = [{"id_diputado": acta["presentador"]}] + quien
        for c in (acta["coautores"] if acta else []):
            if not any(q["id_diputado"] == c for q in quien):
                quien.append({"id_diputado": c})
        for j, q in enumerate(quien):
            prom_nuevos.append({"id_asunto": r["id"], "id_diputado": q["id_diputado"], "promovente_externo": "", "rol": "autor" if j == 0 else "coautor", "id_fuente": id_fuente})
        for c in (acta["colectivos"] if acta else []):
            prom_nuevos.append({"id_asunto": r["id"], "id_diputado": "", "promovente_externo": c, "rol": "coautor", "id_fuente": id_fuente})
        if es_exhorto:
            exhortos.append({"id_exhorto": "EXH-" + r["id"][3:], "id_asunto": r["id"], "autoridad_destinataria": autoridad or "No identificada en el texto",
                             "orden_gobierno": orden_de_gobierno(autoridad) if autoridad else "", "verificacion_seguimiento": "verificado", "notas": "", "_texto": txt, "_estado": estado, "_f_aprob": f_aprob})

    # --- 3. Respuestas de autoridades (síntesis)
    print("3/4 Respuestas en síntesis…")
    resp = respuestas_en_sintesis()
    # La respuesta nombra a quien presentó el punto de acuerdo y a la autoridad que responde:
    # 1) candidatos = puntos aprobados antes de la respuesta cuyos promoventes aparecen en el oficio;
    # 2) entre ellos, el texto más parecido (autoridad y tema).
    destinos = [x for x in nuevos if x["id_asunto"].startswith("PA-") and x["estado_procesal"] == "aprobado"]
    prom_de = {}
    for pr in prom_nuevos:
        if pr["id_diputado"]:
            prom_de.setdefault(pr["id_asunto"], set()).add(pr["id_diputado"])
    idx_ex = Indice((x["id_asunto"], x["descripcion"]) for x in destinos)
    partido_de = {d["id_diputado"]: d["id_partido"] for d in leer_csv("diputados")}
    asignadas = {}
    for rr in resp:
        nombrados = {d["id_diputado"] for d in rec.buscar(rr["texto"])}
        t = sin_acentos(rr["texto"])
        partidos = {PARTIDO_DE_GRUPO[n] for pat, n in GRUPOS if "grupo parlamentario" in t and re.search(pat, re.sub(r"^.*?grupo parlamentario", "", t))}
        def coincide(x):
            ps = prom_de.get(x["id_asunto"], set())
            if nombrados:
                return bool(ps & nombrados)
            if partidos:
                return any(partido_de.get(p) in partidos for p in ps)
            return True
        permit = {x["id_asunto"] for x in destinos if x["fecha_aprobacion"] and x["fecha_aprobacion"] <= rr["fecha_sintesis"] and coincide(x)}
        k, puntaje = (next(iter(permit)), 0.5) if len(permit) == 1 else idx_ex.mejor(rr["texto"], permit, 0.08, 0.02)
        if k:
            asignadas.setdefault(k, []).append((puntaje, rr))
        rr["_asignada"] = k
    # Puntos de acuerdo (sin la palabra «exhorto») que recibieron respuesta también se siguen.
    con_ficha = {e["id_asunto"] for e in exhortos}
    for k in asignadas:
        if k not in con_ficha:
            x = next(y for y in nuevos if y["id_asunto"] == k)
            destino = DESTINO.search(x["descripcion"])
            exhortos.append({"id_exhorto": "EXH-" + k[3:], "id_asunto": k, "autoridad_destinataria": re.sub(r"\s+", " ", destino.group(1)).strip(" ,.")[:250] if destino else "No identificada en el texto",
                             "orden_gobierno": "", "verificacion_seguimiento": "verificado", "notas": "", "_texto": x["descripcion"], "_estado": "aprobado", "_f_aprob": x["fecha_aprobacion"]})
            x["tipo"] = "exhorto"
            x["notas"] += " Se clasifica como exhorto porque solicita la intervención de autoridades que dieron respuesta oficial."
    for e in exhortos:
        if e["_estado"] != "aprobado":
            e["notas"] = "Exhorto no aprobado o aún en trámite: no aplica seguimiento."
            continue
        if e["id_asunto"] in asignadas:
            puntaje, rr = sorted(asignadas[e["id_asunto"]], key=lambda x: x[1]["fecha_sintesis"])[0]
            e["respuesta_localizada"] = "si"
            e["fecha_respuesta"] = rr["fecha_oficio"] or rr["fecha_sintesis"]
            e["id_fuente_respuesta"] = ev(f"EV-RESP-{e['id_asunto']}", "comunicado", f"Respuesta de autoridad dada a conocer en la {rr['descripcion']}", rr["url"], rr["fecha_sintesis"])
            e["notas"] = f"Respuesta: «{rr['texto'][:260]}»"
            if puntaje < 0.4:
                e["verificacion_seguimiento"] = "pendiente"
                e["notas"] += " (relación por similitud de texto; verificar)."
        else:
            e["respuesta_localizada"] = "no"
            e["notas"] = "No se localizó respuesta en las síntesis de comunicaciones revisadas. No significa que la autoridad no haya respondido ni que haya incumplido."

    print("4/4 Escribiendo…")
    escribir("asuntos", cols, asuntos + nuevos)
    escribir("asunto_promoventes", ["id_asunto", "id_diputado", "promovente_externo", "rol", "id_fuente"], promoventes + prom_nuevos)
    escribir("exhortos", ["id_exhorto", "id_asunto", "autoridad_destinataria", "orden_gobierno", "fecha_envio", "id_fuente_envio", "respuesta_localizada", "fecha_respuesta",
                          "id_fuente_respuesta", "acciones_posteriores", "id_fuente_acciones", "verificacion_seguimiento", "notas"], exhortos)
    existentes = {e["id_fuente"]: e for e in leer_csv("evidencias")}
    existentes.update({k: v for k, v in EVID.items() if k not in existentes})
    escribir("evidencias", ["id_fuente", "tipo", "titulo", "institucion", "url", "fecha_documento", "fecha_consulta", "oficial", "pagina", "notas"], list(existentes.values()))
    (CRUDOS / "respuestas_exhortos.json").write_text(json.dumps([{k: v for k, v in rr.items()} for rr in resp], ensure_ascii=False, indent=1), encoding="utf-8")
    sin = [rr for rr in resp if not rr["_asignada"]]
    print(f"   {len(nuevos)} acuerdos/puntos, {len(exhortos)} exhortos; respuestas: {len(resp)} en síntesis, {len(resp) - len(sin)} relacionadas")
    for rr in sin:
        print("   respuesta sin exhorto relacionado:", rr["fecha_sintesis"], rr["texto"][:150])


if __name__ == "__main__":
    main()
