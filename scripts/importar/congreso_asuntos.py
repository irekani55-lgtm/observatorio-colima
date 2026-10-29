"""
Importa iniciativas, decretos y comisiones de la LXI Legislatura desde la Gaceta
Parlamentaria y el sitio del H. Congreso del Estado de Colima.

Requiere haber corrido antes congreso_asistencias.py (usa diputados.csv y evidencias.csv).

Genera o actualiza, en public/datos/oficial/:
  asuntos.csv (iniciativas, minutas y decretos), asunto_promoventes.csv, asunto_comisiones.csv,
  comisiones.csv, comision_integrantes.csv, evidencias.csv (se agregan, no se borran las existentes)

Uso:  python scripts/importar/congreso_asuntos.py [--refrescar]

Reglas:
- Cada iniciativa es un asunto único (INI-61-NNN, según su número en la Gaceta).
- Promoventes: se reconocen las diputaciones nombradas en el campo "Autor" y en la descripción.
  Si el texto menciona a "demás integrantes" de un grupo parlamentario sin nombrarlos, solo se
  atribuye a las personas nombradas y el asunto queda "pendiente" de verificación.
- Nunca se infiere un promovente que no esté escrito en la fuente.
"""
from __future__ import annotations

import argparse
import csv
import html
import re
import sys
import unicodedata
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from congreso_asistencias import BASE, CRUDOS, GACETA, HOY, SALIDA, descargar, texto  # noqa: E402

COMISIONES_URL = f"{BASE}/web/www/comisiones/index.php"
EVID: dict[str, dict] = {}


def ev(id_: str, tipo: str, titulo: str, url: str, fecha: str = "") -> str:
    EVID.setdefault(id_, {"id_fuente": id_, "tipo": tipo, "titulo": titulo, "institucion": "H. Congreso del Estado de Colima", "url": url, "fecha_documento": fecha, "fecha_consulta": HOY, "oficial": "si", "pagina": "", "notas": ""})
    return id_


def sin_acentos(t: str) -> str:
    t = unicodedata.normalize("NFD", t or "")
    return "".join(c for c in t if unicodedata.category(c) != "Mn").lower()


def palabras(t: str) -> list[str]:
    return re.findall(r"[a-zñ]+", sin_acentos(t))


def url_abs(href: str) -> str:
    from urllib.parse import quote, urljoin
    return quote(urljoin(BASE + "/web/www/gaceta/", href), safe=":/?&=%")


def leer_csv(nombre: str) -> list[dict]:
    p = SALIDA / f"{nombre}.csv"
    if not p.exists():
        return []
    with open(p, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def escribir(nombre: str, columnas: list[str], filas: list[dict]) -> None:
    with open(SALIDA / f"{nombre}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columnas, extrasaction="ignore")
        w.writeheader()
        for fila in filas:
            w.writerow({c: fila.get(c, "") for c in columnas})
    print(f"  {nombre}.csv: {len(filas)} filas")


def lista_gaceta(v: str, refrescar: bool) -> str:
    return descargar(GACETA, CRUDOS / "gaceta" / f"{v}.html", metodo="post", params={"v": v, "l": "61", "ld": "LXI Legislatura", "lc": "%"}, refrescar=refrescar)


# ----------------------------------------------------------------- personas
class Reconocedor:
    """Encuentra diputaciones nombradas en un texto (sin acentos, tolerante a variantes)."""

    def __init__(self, diputados: list[dict]):
        self.patrones = []
        for d in diputados:
            w = [x for x in palabras(d["nombre_completo"]) if x not in {"de", "la", "del", "los", "las", "y"}]
            if len(w) < 2:
                continue
            # nombre de pila + primer apellido, o los dos apellidos
            variantes = {f"{w[0]} {w[-2]}" if len(w) >= 3 else f"{w[0]} {w[-1]}", f"{w[-2]} {w[-1]}" if len(w) >= 3 else f"{w[0]} {w[1]}"}
            if len(w) >= 4:
                variantes.add(f"{w[1]} {w[-2]}")
            self.patrones.append((d, [re.compile(r"\b" + r"\s+".join(map(re.escape, v.split())) + r"\b") for v in variantes]))

    def buscar(self, t: str) -> list[dict]:
        base = " ".join(palabras(t))
        hallados = []
        for d, pats in self.patrones:
            pos = [m.start() for p in pats for m in [p.search(base)] if m]
            if pos:
                hallados.append((min(pos), d))
        return [d for _, d in sorted(hallados, key=lambda x: x[0])]


EXTERNOS = [
    (r"ejecutivo|gobernador", "Poder Ejecutivo del Estado de Colima"),
    (r"senadores|camara de senadores", "Cámara de Senadores del H. Congreso de la Unión"),
    (r"camara de diputados|^\s*de diputados", "Cámara de Diputados del H. Congreso de la Unión"),
    (r"fiscalia", "Fiscalía General del Estado de Colima"),
    (r"supremo tribunal|poder judicial", "Poder Judicial del Estado de Colima"),
    (r"comision de derechos humanos", "Comisión de Derechos Humanos del Estado de Colima"),
    (r"organo superior de auditoria|osafig", "Órgano Superior de Auditoría y Fiscalización Gubernamental"),
    (r"instituto electoral|^\s*electoral del estado", "Instituto Electoral del Estado de Colima"),
    (r"comapat", "Comisión de Agua Potable y Alcantarillado del Municipio de Tecomán (COMAPAT)"),
    (r"ciapacov", "Comisión Intermunicipal de Agua Potable y Alcantarillado de Colima y Villa de Álvarez (CIAPACOV)"),
    (r"capdam", "Comisión de Agua Potable, Drenaje y Alcantarillado de Manzanillo (CAPDAM)"),
    (r"ciudadan[oa]s?\b|iniciativa popular", "Ciudadanía"),
    (r"tribunal de justicia administrativa", "Tribunal de Justicia Administrativa del Estado de Colima"),
    (r"tribunal electoral", "Tribunal Electoral del Estado de Colima"),
]
GRUPOS = [(r"morena", "MORENA"), (r"revolucionario institucional|\bpri\b", "PRI"), (r"accion nacional|\bpan\b", "PAN"), (r"del trabajo|\bpt\b", "PT"),
          (r"verde|pvem", "PVEM"), (r"movimiento ciudadano|\bmc\b", "Movimiento Ciudadano"), (r"nueva alianza|panal", "Nueva Alianza")]


def colectivos(t: str) -> list[str]:
    """Grupos o comisiones mencionados como autores sin nombrar a sus integrantes."""
    s_ = sin_acentos(t)
    salida = []
    if ("grupo" in s_ and "parlamentari" in s_) or ("integrantes" in s_ and any(re.search(p, s_) for p, _ in GRUPOS)):
        for pat, nombre in GRUPOS:
            if re.search(pat, s_):
                salida.append(f"Grupo Parlamentario de {nombre} (integrantes no nombrados)")
    m = re.search(r"integrantes de (?:la|las) comisi(?:on|ones) de ([a-z ,]+?)(?: y de ([a-z ,]+))?(?:[.;|]|$)", s_)
    if m:
        for g in m.groups():
            if g:
                salida.append(f"Comisión de {g.strip(' ,').title()} (integrantes no nombrados)")
    if not salida and re.search(r"integrantes de la lxi legislatura|diputad[oa]s? de la lxi", s_):
        salida.append("Diputadas y diputados de la LXI Legislatura (integrantes no nombrados)")
    return salida
MUNICIPIOS = ["Armería", "Colima", "Comala", "Coquimatlán", "Cuauhtémoc", "Ixtlahuacán", "Manzanillo", "Minatitlán", "Tecomán", "Villa de Álvarez"]
ALIAS_MUNICIPIO = {"cuauthemoc": "Cuauhtémoc", "cuahutemoc": "Cuauhtémoc"}
GRUPAL = re.compile(r"dem[aá]s (diputad|integrantes|legislador)|integrantes de (los|las|el|la) grupos? parlamentari|y (las|los) (diputadas|diputados) integrantes", re.I)


def externos(t: str) -> list[str]:
    # "Movimiento Ciudadano" y "Participación Ciudadana" no son iniciativas ciudadanas.
    s = re.sub(r"movimiento ciudadano|participacion ciudadana", " ", sin_acentos(t))
    salida = []
    for m in MUNICIPIOS:
        if re.search(r"ayuntamiento\s+(constitucional\s+)?de\s+" + sin_acentos(m), s) or re.fullmatch(r"\s*(h\.?\s*)?(ayuntamiento\s+)?(de\s+)?\s*" + sin_acentos(m) + r"[\s.,]*", s):
            salida.append(f"H. Ayuntamiento de {m}")
    for alias, m in ALIAS_MUNICIPIO.items():
        if re.fullmatch(r"\s*(h\.?\s*)?(ayuntamiento\s+)?(de\s+)?\s*" + alias + r"[\s.,]*", s) or re.search(r"ayuntamiento\s+de\s+" + alias, s):
            salida.append(f"H. Ayuntamiento de {m}")
    for pat, nombre in EXTERNOS:
        if re.search(pat, s):
            salida.append(nombre)
    return list(dict.fromkeys(salida))


# ----------------------------------------------------------------- comisiones
def comisiones(dips: list[dict], refrescar: bool) -> tuple[list[dict], list[dict]]:
    s = descargar(COMISIONES_URL, CRUDOS / "comisiones.html", refrescar=refrescar)
    s = re.sub(r"<!--.*?-->|<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
    s = re.sub(r"<a[^>]*href=\"([^\"]*)\"[^>]*>", lambda m: "\n@@URL " + m.group(1) + "\n", s)
    lineas = [re.sub(r"\s+", " ", x).strip() for x in html.unescape(re.sub(r"<[^>]+>", "\n", s)).split("\n")]
    lineas = [x for x in lineas if x]
    lineas = lineas[lineas.index("Legislatura LXI") + 1:]
    cargo_re = re.compile(r"^(Presidente|Presidenta|Secretari[oa]|Vocal)$")
    rec = Reconocedor(dips)
    coms, integrantes, partes, actual, etiqueta = [], [], [], None, None
    ev_com = ev("EV-CONG-COMISIONES", "ficha_oficial", "Comisiones de la LXI Legislatura (integración, programas e informes)", COMISIONES_URL)
    pendiente_nombre = False
    for x in lineas:
        if x.startswith("@@URL "):
            if actual is not None and etiqueta:
                actual.setdefault("_docs", []).append((etiqueta, x[6:]))
                etiqueta = None
            continue
        if cargo_re.match(x):
            if partes:
                nombre = " ".join(partes)
                actual = {"id_comision": "COM-" + "-".join(palabras(nombre))[:40].strip("-").upper(), "nombre": nombre, "tipo": "permanente", "url": COMISIONES_URL, "id_fuente": ev_com}
                coms.append(actual)
                partes = []
            actual["_cargo"] = {"presidente": "presidencia", "presidenta": "presidencia"}.get(x.lower(), "secretaria" if x.lower().startswith("secret") else "vocal")
            pendiente_nombre = True
            continue
        if pendiente_nombre:
            pendiente_nombre = False
            encontrados = rec.buscar(x)
            integrantes.append({"id_comision": actual["id_comision"], "id_diputado": encontrados[0]["id_diputado"] if encontrados else "", "cargo": actual["_cargo"], "fecha_inicio": "", "fecha_fin": "", "id_fuente": ev_com, "_nombre": x})
            continue
        if x in ("Mayoría Relativa", "Representación Proporcional", "descargar"):
            continue
        m = re.match(r"^Reuniones de trabajo: (\d+)", x)
        if m:
            actual["_reuniones"] = int(m.group(1))
            continue
        if x.endswith(":"):
            etiqueta = x[:-1]
            continue
        etiqueta = None
        partes = (partes + [x])[-3:]
    for i in integrantes:
        if not i["id_diputado"]:
            print(f"  AVISO: integrante de comisión no reconocido: {i['_nombre']}", file=sys.stderr)
    for c in coms:
        c["notas"] = f"Reuniones de trabajo reportadas por el Congreso: {c.get('_reuniones', 'sin dato')}." + (" Documentos: " + "; ".join(f"{t}: {url_abs(u)}" for t, u in c.get("_docs", [])) if c.get("_docs") else "")
    return coms, [i for i in integrantes if i["id_diputado"]]


def id_comision_por_nombre(coms: list[dict]):
    indice = {" ".join(palabras(c["nombre"])): c["id_comision"] for c in coms}

    def buscar(nombre: str) -> str | None:
        clave = " ".join(palabras(nombre))
        if clave in indice:
            return indice[clave]
        a = set(clave.split())
        mejor = max(indice.items(), key=lambda kv: len(a & set(kv[0].split())) / len(a | set(kv[0].split())))
        return mejor[1] if len(a & set(mejor[0].split())) / len(a | set(mejor[0].split())) >= 0.6 else None

    return buscar


# ----------------------------------------------------------------- decretos y acuerdos
def lista_con_fechas(v: str, titulo_num: str, refrescar: bool) -> dict[int, dict]:
    sopa = BeautifulSoup(lista_gaceta(v, refrescar), "html.parser")
    salida = {}
    for n in sopa.find_all("div", attrs={"title": titulo_num}):
        fila = n.parent
        num = re.sub(r"\D", "", n.get_text())
        if not num:
            continue
        fa = fila.find("div", attrs={"title": "Fecha Aprobación"})
        fp = fila.find("div", attrs={"title": "Fecha Publicación"})
        pdf = [a["href"] for a in fila.find_all("a", href=True) if a["href"].lower().endswith(".pdf")]
        limpiar = lambda f: "" if not f or f.startswith("0001") or f.startswith("0000") else f  # la Gaceta usa 0001-01-01 como fecha vacía
        salida[int(num)] = {"descripcion": texto(fila.find("div", attrs={"title": "Descripción"})), "fecha_aprobacion": limpiar(texto(fa) if fa else ""), "fecha_publicacion": limpiar(texto(fp) if fp else ""),
                            "url": url_abs(pdf[0]) if pdf else ""}
    return salida


# ----------------------------------------------------------------- iniciativas
def iniciativas(refrescar: bool) -> list[dict]:
    sopa = BeautifulSoup(lista_gaceta("tiniciativas", refrescar), "html.parser")
    out = []
    for num in sopa.find_all("div", attrs={"title": "No. Iniciativa"}):
        fila = num.parent
        desc = fila.find("div", attrs={"title": "Descripción"})
        autor = fila.find("div", attrs={"title": "Autor"})
        com = fila.find("div", attrs={"title": "Comisión"})
        st = fila.find("div", attrs={"title": "Status"})
        pdf = [a["href"] for a in fila.find_all("a", href=True) if "Iniciativas" in a["href"] and a["href"].lower().endswith(".pdf")]
        out.append({
            "numero": int(re.sub(r"\D", "", num.get_text()) or 0),
            "descripcion": re.sub(r"\s+", " ", html.unescape(desc.find(string=True, recursive=False) or "")).strip() if desc else "",
            "autor": re.sub(r"^Autor:\s*", "", texto(autor)).strip() if autor else "",
            "comisiones": [re.sub(r"\s+", " ", li.get_text(" ", strip=True)) for li in com.find_all("li")] if com else [],
            "status": texto(st),
            "url_pdf": url_abs(pdf[0]) if pdf else "",
        })
    return out


def estado_iniciativa(status: str, turnada: bool) -> tuple[str, str, str]:
    """Devuelve (estado_procesal, tipo_resolucion, número)."""
    s = status.strip()
    m = re.match(r"(?i)decretos?\s+(\d+)", s)
    if m:
        return "aprobado", "decreto", m.group(1)
    m = re.match(r"(?i)acuerdo\s+(\d+)", s)
    if m:
        return "aprobado", "acuerdo", m.group(1)
    sl = s.lower()
    if sl.startswith("pendiente"):
        return ("turnado" if turnada else "presentado"), "", ""
    if sl.startswith("desechad"):
        return "rechazado", "", ""
    if sl.startswith("retirad"):
        return "retirado", "", ""
    if sl.startswith("minuta enviada"):
        return "pendiente", "", ""
    return "no_verificado", "", ""


ANIOS = [(1, "2024-10-01", "2025-09-30"), (2, "2025-10-01", "2026-09-30"), (3, "2026-10-01", "2027-09-30")]


def anio_de(f: str) -> int | None:
    return next((n for n, a, b in ANIOS if a <= f <= b), None) if f else None


def aplicar_fechas(asuntos: list[dict], promoventes: list[dict], rec: "Reconocedor") -> None:
    """Fecha de presentación desde síntesis y actas (ver fechas_presentacion.py)."""
    import fechas_presentacion as fp
    if not (CRUDOS / "sintesis" / "indice.json").exists():
        print("  (sin síntesis/actas descargadas: corra congreso_actas.py para obtener fechas de presentación)")
        return
    inis = [a for a in asuntos if a["id_asunto"].startswith("INI-")]
    num = {a["id_asunto"]: int(a["id_asunto"][-3:]) for a in inis}
    prom = {}
    for p in promoventes:
        if p["id_diputado"]:
            prom.setdefault(p["id_asunto"], set()).add(p["id_diputado"])
    r = fp.asignar([{"id": a["id_asunto"], "descripcion": a["descripcion"]} for a in inis])
    por_id = {a["id_asunto"]: a for a in inis}
    for i in list(r):
        v, a = r[i], por_id[i]
        if a["fecha_aprobacion"] and v["fecha"] > a["fecha_aprobacion"]:
            del r[i]
        elif v["origen"] == "acta" and prom.get(i) and not ({d["id_diputado"] for d in rec.buscar(v["texto"])[:1]} & prom[i]):
            del r[i]
    ok, descartadas = fp.filtrar_por_orden(r, num)
    anclas = sorted((num[i], v["fecha"]) for i, v in ok.items())
    conteo = {"confirmada": 0, "acotada": 0, "anio": 0, "sin": 0}
    for a in inis:
        i = a["id_asunto"]
        if i in ok:
            v = ok[i]
            a["fecha_presentacion"] = v["fecha"]
            doc = "la síntesis de comunicaciones" if v["origen"] == "sintesis" else "el acta"
            a["notas"] += f" Fecha de presentación: sesión del {v['fecha']}, según {doc} ({v['url']})."
            conteo["confirmada"] += 1
            continue
        antes, despues = fp.intervalo(num[i], anclas)
        if a["fecha_aprobacion"] and (not despues or a["fecha_aprobacion"] < despues):
            despues = a["fecha_aprobacion"]
        if antes and antes == despues:
            a["fecha_presentacion"] = antes
            a["estado_verificacion"] = "pendiente"
            a["notas"] += f" Fecha de presentación inferida: las iniciativas con número anterior y posterior se presentaron el {antes} (numeración consecutiva); verificar."
            conteo["acotada"] += 1
        elif antes and despues and anio_de(antes) and anio_de(antes) == anio_de(despues):
            a["anio_legislativo"] = anio_de(antes)
            a["notas"] += f" Fecha de presentación no localizada; por su numeración se presentó entre el {antes} y el {despues} (año legislativo {anio_de(antes)})."
            conteo["anio"] += 1
        else:
            a["notas"] += f" Fecha de presentación no localizada" + (f" (entre {antes or 'el inicio'} y {despues or 'la fecha de corte'})." if antes or despues else ".")
            conteo["sin"] += 1
    print(f"   fechas de presentación: {conteo['confirmada']} confirmadas, {conteo['acotada']} inferidas (misma sesión), {conteo['anio']} solo año legislativo, {conteo['sin']} sin fecha; {len(descartadas)} coincidencias descartadas por orden")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refrescar", action="store_true")
    args = ap.parse_args()

    dips = leer_csv("diputados")
    if not dips:
        sys.exit("Primero corra congreso_asistencias.py (falta diputados.csv).")
    rec = Reconocedor(dips)

    print("1/4 Comisiones…")
    coms, integrantes = comisiones(dips, args.refrescar)
    buscar_com = id_comision_por_nombre(coms)
    print("2/4 Decretos y acuerdos…")
    decretos = lista_con_fechas("tdecretos", "No. Decreto", args.refrescar)
    acuerdos = lista_con_fechas("tacuerdos", "No. Acuerdo", args.refrescar)
    print(f"   {len(decretos)} decretos, {len(acuerdos)} acuerdos")
    print("3/4 Iniciativas…")
    lista = iniciativas(args.refrescar)
    ev_lista = ev("EV-GACETA-INICIATIVAS", "gaceta", "Gaceta Parlamentaria: lista de iniciativas de la LXI Legislatura", f"{GACETA}?v=tiniciativas&l=61")

    asuntos, promoventes, turnos = [], [], []
    comisiones_extra: dict[str, dict] = {}
    for x in sorted(lista, key=lambda y: y["numero"]):
        id_ = f"INI-61-{x['numero']:03d}"
        texto_autoria = f"{x['autor']} || {x['descripcion']}"
        es_minuta = bool(re.match(r"(?i)\s*(la\s+)?minuta|por el que se aprueba la minuta", x["descripcion"])) or bool(re.search(r"(?i)senadores|c[aá]mara de diputados", x["autor"]))
        estado, resol, num = estado_iniciativa(x["status"], bool(x["comisiones"]))
        notas = []
        if x["status"].lower().startswith("archivad"):
            notas.append("La Gaceta la reporta como «archivada».")
        if x["status"].lower().startswith("minuta enviada"):
            notas.append("Aprobada como minuta de reforma constitucional local y enviada a los ayuntamientos para su aprobación.")
        f_aprob = f_pub = num_doc = ""
        if resol == "decreto":
            num_doc = f"Decreto {num}"
            d = decretos.get(int(num))
            if d:
                f_aprob, f_pub = d["fecha_aprobacion"], d["fecha_publicacion"]
                if f_pub:
                    estado = "publicado"
            else:
                notas.append(f"El decreto {num} no aparece en la lista de decretos.")
        elif resol == "acuerdo":
            num_doc = f"Acuerdo {num}"
            a = acuerdos.get(int(num))
            if a:
                f_aprob = a["fecha_aprobacion"]
        personas = rec.buscar(texto_autoria)
        ext = externos(x["autor"]) or ([] if personas else externos(x["descripcion"]))
        supuesto = False
        if not personas and not ext and sin_acentos(x["autor"]).strip(" .") == "estatal":
            ext, supuesto = ["Poder Ejecutivo del Estado de Colima"], True
            notas.append("La Gaceta registra el autor solo como «Estatal»; se asume el Poder Ejecutivo Estatal (verificar en el documento).")
        if not personas and not ext:
            ext = colectivos(x["autor"]) or colectivos(texto_autoria)
        grupal = bool(GRUPAL.search(texto_autoria))
        if grupal:
            notas.append("La fuente menciona a integrantes de grupos parlamentarios sin nombrarlos; solo se atribuye a las personas nombradas.")
        if not personas and not ext:
            notas.append(f"Autor sin identificar automáticamente: «{x['autor']}».")
        verificado = "pendiente" if (grupal or supuesto or (not personas and not ext) or any("no nombrados" in e for e in ext)) else "verificado"
        asuntos.append({
            "id_asunto": id_, "tipo": "otro" if es_minuta else "iniciativa",
            "titulo": x["descripcion"][:300] or f"Iniciativa {x['numero']}", "descripcion": x["descripcion"],
            "tema": x["comisiones"][0] if x["comisiones"] else "", "fecha_presentacion": "", "expediente": f"Iniciativa {x['numero']}",
            "estado_procesal": estado, "fecha_aprobacion": f_aprob, "numero_decreto_acuerdo": num_doc, "fecha_publicacion": f_pub,
            "url_ficha": f"{GACETA}?v=tiniciativas&l=61", "url_documento": x["url_pdf"], "id_fuente": ev_lista, "estado_verificacion": verificado,
            "notas": " ".join([("Minuta de reforma constitucional. " if es_minuta else "") + f"Estado en la Gaceta: «{x['status']}»."] + notas),
        })
        for i, d in enumerate(personas):
            promoventes.append({"id_asunto": id_, "id_diputado": d["id_diputado"], "promovente_externo": "", "rol": "autor" if i == 0 else "coautor", "id_fuente": ev_lista})
        for e in ext:
            promoventes.append({"id_asunto": id_, "id_diputado": "", "promovente_externo": e, "rol": "autor" if not personas and e == ext[0] else "coautor", "id_fuente": ev_lista})
        vistas = set()
        for nombre in x["comisiones"]:
            idc = buscar_com(nombre)
            if not idc:
                idc = "COM-" + "-".join(palabras(nombre))[:40].upper()
                comisiones_extra.setdefault(idc, {"id_comision": idc, "nombre": nombre, "tipo": "otra", "url": "", "id_fuente": ev_lista, "notas": "Aparece en turnos de iniciativas; no está en la página actual de comisiones."})
            if idc in vistas:  # la Gaceta repite a veces la misma comisión
                continue
            vistas.add(idc)
            turnos.append({"id_asunto": id_, "id_comision": idc, "rol": "dictaminadora", "fecha_turno": "", "fecha_dictamen": "", "id_fuente": ev_lista})

    aplicar_fechas(asuntos, promoventes, rec)

    # Decretos como asuntos propios (para el indicador de decretos publicados)
    origen_por_decreto: dict[int, list[str]] = {}
    for a in asuntos:
        m = re.match(r"Decreto (\d+)", a["numero_decreto_acuerdo"])
        if m:
            origen_por_decreto.setdefault(int(m.group(1)), []).append(a["id_asunto"])
    for n, d in sorted(decretos.items()):
        origenes = origen_por_decreto.get(n, [])
        asuntos.append({
            "id_asunto": f"DEC-61-{n:03d}", "tipo": "decreto", "titulo": f"Decreto {n}: {d['descripcion'][:260]}", "descripcion": d["descripcion"],
            "estado_procesal": "publicado" if d["fecha_publicacion"] else "aprobado", "fecha_presentacion": "", "fecha_aprobacion": d["fecha_aprobacion"],
            "fecha_publicacion": d["fecha_publicacion"], "numero_decreto_acuerdo": f"Decreto {n}", "id_asunto_origen": origenes[0] if origenes else "",
            "url_documento": d["url"], "url_ficha": f"{GACETA}?v=tdecretos&l=61",
            "id_fuente": ev(f"EV-DECRETO-{n}", "gaceta", f"Decreto {n} de la LXI Legislatura", d["url"] or f"{GACETA}?v=tdecretos&l=61", d["fecha_aprobacion"]),
            "estado_verificacion": "verificado",
            "notas": ("Resuelve las iniciativas " + ", ".join(origenes) + "." if len(origenes) > 1 else "") + ("" if origenes else " No se identificó la iniciativa de origen en la lista de iniciativas."),
        })

    print("4/4 Escribiendo…")
    cols_asunto = ["id_asunto", "tipo", "titulo", "descripcion", "tema", "fecha_presentacion", "anio_legislativo", "expediente", "estado_procesal", "fecha_dictamen", "resultado_dictamen", "fecha_votacion",
                   "resultado_votacion", "fecha_aprobacion", "numero_decreto_acuerdo", "fecha_publicacion", "id_asunto_origen", "url_ficha", "url_documento", "id_fuente", "estado_verificacion", "notas"]
    escribir("asuntos", cols_asunto, asuntos)
    escribir("asunto_promoventes", ["id_asunto", "id_diputado", "promovente_externo", "rol", "id_fuente"], promoventes)
    escribir("asunto_comisiones", ["id_asunto", "id_comision", "rol", "fecha_turno", "fecha_dictamen", "id_fuente"], turnos)
    escribir("comisiones", ["id_comision", "nombre", "tipo", "url", "id_fuente", "notas"], coms + list(comisiones_extra.values()))
    escribir("comision_integrantes", ["id_comision", "id_diputado", "cargo", "fecha_inicio", "fecha_fin", "id_fuente"], integrantes)
    existentes = {e["id_fuente"]: e for e in leer_csv("evidencias")}
    existentes.update({k: v for k, v in EVID.items() if k not in existentes})
    escribir("evidencias", ["id_fuente", "tipo", "titulo", "institucion", "url", "fecha_documento", "fecha_consulta", "oficial", "pagina", "notas"], list(existentes.values()))

    sin_autor = [a for a in asuntos if "sin identificar" in a.get("notas", "")]
    if sin_autor:
        print(f"\nAVISO: {len(sin_autor)} iniciativas con autor sin identificar:")
        for a in sin_autor[:30]:
            print("  ", a["id_asunto"], a["notas"][-120:])


if __name__ == "__main__":
    main()
