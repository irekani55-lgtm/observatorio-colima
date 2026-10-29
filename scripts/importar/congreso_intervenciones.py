"""
Importa las intervenciones en tribuna de la LXI Legislatura desde las actas de sesión.

Una intervención es un párrafo del acta cuyo sujeto es una diputada o un diputado («La Diputada X, señaló…»,
«En un posicionamiento, el Diputado Y…»). No se cuentan las intervenciones de trámite de la Presidencia o la
Secretaría. Cada intervención enlaza al Diario de los Debates de la sesión (versión íntegra), cuando existe.

Clasificación (automática, a partir del texto del acta):
- presentacion: presenta una iniciativa o un punto de acuerdo, o da lectura a un dictamen.
- a_favor / en_contra: en el debate de un asunto, cuando expresa su sentido («votará a favor», «en contra»).
- mocion: rectificación de hechos, alusiones o respuesta a otra intervención.
- asuntos_generales: en el punto de asuntos generales.
- posicionamiento: el resto de las participaciones en el debate o cuando el acta lo llama así.
El tema se asigna por palabras clave y se marca como clasificación automática.

El número de intervenciones describe participación documentada, no su calidad ni su impacto.

Requiere: congreso_actas.py y los importadores previos. Escribe intervenciones.csv.
Uso: python scripts/importar/congreso_intervenciones.py [--refrescar]
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from congreso_asistencias import CRUDOS, GACETA, texto  # noqa: E402
from congreso_asuntos import EVID, Reconocedor, ev, escribir, leer_csv, lista_gaceta, sin_acentos, url_abs  # noqa: E402
from congreso_votaciones import CABEZA, NUM_DICT, sesion_de  # noqa: E402
from fechas_presentacion import norm  # noqa: E402

PREFIJO = r"(?:(?:En|Por su parte|Al respecto|Asimismo|Posteriormente|Finalmente|En primer t[ée]rmino|En respuesta|En su turno|Acto seguido|Enseguida|Luego|Despu[ée]s|Para concluir|De igual forma|Igualmente)[^,]{0,70},\s*)*"
VERBOS = (r"señal|expres|manifest|indic|mencion|reconoci|hizo|present|propus|dio|coment|destac|subray|lament|celebr|consider|insisti|pidi|solicit|felicit|record|"
          r"exhort|agradeci|se pronunci|se sum|cuestion|critic|calific|afirm|explic|precis|aclar|reiter|sostuv|refiri|advirti|denunci|hablo|habló|propone|plante|abord|"
          r"conmin|invit|acus|defendi|respald|apoy|enfatiz|resalt|sugiri|propuso|leyó|ley[óo]|expuso|refut|replic|argument|anunci")
SUJETO = re.compile(r"^" + PREFIJO + r"(?:la|el)\s+Diputad[oa]\s+([^,]{4,70}?)(?:,|\s+(?:" + VERBOS + r"))", re.I)
TRAMITE = re.compile(r"(?i)^(president|secretari|vicepresident|única del partido|unica del partido)")
INICIO_AG = re.compile(r"(?i)relativo a (los )?asuntos generales|punto de asuntos generales")
FIN_AG = re.compile(r"(?i)^(en el siguiente punto del orden del d[ií]a,? (?!relativo a asuntos)|no habiendo m[aá]s|se cit[óo] a|clausura|lista de presentes)")
TEMAS = [
    ("Salud", r"salud|hospital|medic|imss|issste|enfermedad|vacun|cancer|clinic"),
    ("Educación y cultura", r"educaci|escuela|docent|maestr|universidad|estudiant|cultur|lectura"),
    ("Seguridad y justicia", r"seguridad|violencia|delito|policia|fiscal|homicid|desaparec|penal|justicia"),
    ("Agua", r"\bagua\b|hidric|drenaje|alcantarill|ciapacov|capdam|comapat"),
    ("Medio ambiente y animales", r"ambient|ecolog|forestal|residuos|animal|clima|contamina"),
    ("Movilidad e infraestructura", r"movilidad|transporte|carretera|vial|autopista|infraestructura|obra"),
    ("Energía y tarifas", r"\bcfe\b|electric|energia|tarifa|apagon|gasolina|combustible"),
    ("Hacienda y economía", r"presupuesto|hacienda|fiscal|impuesto|deuda|economi|empleo|salario|precio|tortilla|comercio|turismo|puerto"),
    ("Derechos humanos e igualdad", r"derechos humanos|mujer|genero|igualdad|ninas|ninos|adolescent|discapacidad|indigena|migrant|adultos mayores"),
    ("Transparencia y gobierno", r"transparen|corrupci|rendicion|gobierno|ayuntamiento|municipal|congreso|reforma electoral|eleccion|poder judicial"),
]


def tema_de(t: str) -> str:
    s = sin_acentos(t)
    puntos = [(len(re.findall(pat, s)), nombre) for nombre, pat in TEMAS]
    mejor = max(puntos)
    return mejor[1] if mejor[0] else "Otros temas"


def tipo_de(p: str, en_ag: bool, en_debate: bool) -> str:
    s = sin_acentos(p[:600])
    if re.search(r"(present|propus|propone|dio lectura|leyo|expuso|someti)\w*\s+(en tribuna\s+)?(una|la|el|al|un|su)\s+(iniciativa|punto de acuerdo|dictamen|propuesta|exhorto)", s):
        return "presentacion"
    if re.search(r"rectificaci[oó]n de hechos|alusi[oó]n|por alusiones|en respuesta|replic", s):
        return "mocion"
    # Intención de voto expresa (también en asuntos generales, donde se debaten puntos de acuerdo)
    if re.search(r"votar(a|an|ia|ian|emos)\s+en contra|en contra del (punto|dictamen|exhorto|acuerdo|documento|proyecto)|no (lo |la )?acompanar", s):
        return "en_contra"
    if re.search(r"votar(a|an|ia|ian|emos)\s+(a|en) favor|a favor del (punto|dictamen|exhorto|acuerdo|documento|proyecto)|se suma(n)? al (punto|exhorto|dictamen)", s):
        return "a_favor"
    if en_ag:
        return "posicionamiento" if "posicionamiento" in s[:200] else "asuntos_generales"
    if en_debate:
        if re.search(r"en contra|no acompan|votar(a|an) en contra|rechaz", s):
            return "en_contra"
        if re.search(r"a favor|en favor|respald|apoy|se suma|acompan", s):
            return "a_favor"
    return "posicionamiento"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refrescar", action="store_true")
    args = ap.parse_args()
    dips = leer_csv("diputados")
    rec = Reconocedor(dips)
    nombres = {sin_acentos(d["nombre_completo"]): d["id_diputado"] for d in dips}
    unica_panal = next((d["id_diputado"] for d in dips if d["id_partido"] == "PANAL"), "")
    sesiones = leer_csv("sesiones")
    asuntos = leer_csv("asuntos")
    dic = [a for a in asuntos if a["tipo"] == "dictamen"]
    pa_por_texto = {" ".join(norm(a["descripcion"]))[:200]: a["id_asunto"] for a in asuntos if a["id_asunto"].startswith("PA-")}

    # Diario de los Debates por fecha (versión íntegra)
    diario = {}
    sopa = BeautifulSoup(lista_gaceta("tdiario", args.refrescar), "html.parser")
    for f in sopa.find_all("div", attrs={"title": "Fecha"}):
        fila = f.parent
        docs = [a["href"] for a in fila.find_all("a", href=True) if re.search(r"\.(pdf|docx?)$", a["href"], re.I)]
        pdf = next((d for d in docs if d.lower().endswith(".pdf")), docs[0] if docs else "")
        if pdf:
            diario.setdefault(texto(f), []).append((texto(fila.find("div", attrs={"title": "Descripción"})), url_abs(pdf)))

    def quien(nombre: str) -> str:
        if re.search(r"(?i)nueva alianza", nombre):
            return unica_panal
        r = rec.buscar(nombre)
        if r:
            return r[0]["id_diputado"]
        cerca = difflib.get_close_matches(sin_acentos(nombre).strip(), list(nombres), n=1, cutoff=0.85)  # erratas del acta
        return nombres[cerca[0]] if cerca else ""

    idx = json.loads((CRUDOS / "actas" / "indice.json").read_text(encoding="utf-8"))
    filas, no_rec = [], []
    for acta in idx:
        if not acta.get("archivo"):
            continue
        id_ses = sesion_de(acta, [s for s in sesiones if s["fecha"] == acta["fecha"]])
        fuente = ev(f"EV-ACTA-{acta['fecha']}-{acta['archivo'][-7:-4]}", "acta", acta["descripcion"][:200], acta.get("url", ""), acta["fecha"])
        dd = diario.get(acta["fecha"], [])
        url_diario = dd[0][1] if len(dd) == 1 else next((u for d_, u in dd if any(w in sin_acentos(d_) for w in sin_acentos(acta["descripcion"]).split()[3:6])), dd[0][1] if dd else "")
        en_ag, asunto_actual, texto_actual = False, "", ""
        k = 0
        for p in [x.strip() for x in (CRUDOS / "actas" / acta["archivo"]).read_text(encoding="utf-8").split("\n") if x.strip()]:
            if INICIO_AG.search(p[:200]):
                en_ag, asunto_actual, texto_actual = True, "", "Asuntos generales"
            elif FIN_AG.search(p):
                en_ag = False
            if CABEZA.search(p[:400]):
                nd = NUM_DICT.search(p[:300])
                asunto_actual, texto_actual = "", re.sub(r"\s+", " ", p[:220])
                if nd:
                    c = [a for a in dic if a["expediente"].startswith(f"Dictamen {int(nd.group(1))} ") and a["fecha_votacion"] == acta["fecha"]]
                    if c:
                        asunto_actual, texto_actual = c[0]["id_asunto"], c[0]["titulo"][:220]
                else:
                    asunto_actual = pa_por_texto.get(" ".join(norm(p))[:200], "")
            m = SUJETO.match(p)
            if not m or TRAMITE.match(m.group(1)) or re.match(r"(?i)^[,\s]*[^,]{0,80}(instruy[óo]|puso a consideraci[óo]n|declar[óo] (abierta|clausurada)|solicit[óo] a la secretar|diera lectura a la s[íi]ntesis|solicit[óo] obviar la lectura)", p[m.end() - 1:m.end() + 120]):
                continue
            id_d = quien(m.group(1))
            if not id_d:
                no_rec.append(m.group(1))
                continue
            k += 1
            tipo = tipo_de(p, en_ag, bool(asunto_actual or texto_actual))
            filas.append({"id_intervencion": f"INT-61-{acta['fecha'].replace('-', '')}-{acta['archivo'][-7:-4]}-{k:03d}", "id_sesion": id_ses, "id_diputado": id_d,
                          "id_asunto": asunto_actual if tipo != "asuntos_generales" else "", "asunto_texto": "" if asunto_actual and tipo != "asuntos_generales" else (texto_actual or "Asuntos generales")[:250],
                          "tema": tema_de(p), "tipo_intervencion": tipo, "url_documento": url_diario or acta.get("url", ""), "pagina": "",
                          "id_fuente": fuente, "estado_verificacion": "verificado" if id_ses else "pendiente", "_resumen": p[:400]})
    escribir("intervenciones", ["id_intervencion", "id_sesion", "id_diputado", "id_asunto", "asunto_texto", "tema", "tipo_intervencion", "url_documento", "pagina", "id_fuente", "estado_verificacion"], filas)
    (CRUDOS / "intervenciones_resumen.json").write_text(json.dumps({f["id_intervencion"]: f["_resumen"] for f in filas}, ensure_ascii=False), encoding="utf-8")
    existentes = {e["id_fuente"]: e for e in leer_csv("evidencias")}
    existentes.update({k_: v for k_, v in EVID.items() if k_ not in existentes})
    escribir("evidencias", ["id_fuente", "tipo", "titulo", "institucion", "url", "fecha_documento", "fecha_consulta", "oficial", "pagina", "notas"], list(existentes.values()))
    from collections import Counter
    print("   tipos:", dict(Counter(f["tipo_intervencion"] for f in filas)))
    print("   con asunto ligado:", sum(1 for f in filas if f["id_asunto"]), "| sin sesión:", sum(1 for f in filas if not f["id_sesion"]))
    if no_rec:
        print("   no reconocidos:", Counter(no_rec).most_common(8))


if __name__ == "__main__":
    main()
