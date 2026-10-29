"""
Importa las asistencias del Pleno de la LXI Legislatura desde la Gaceta
Parlamentaria del H. Congreso del Estado de Colima.

Genera, en public/datos/oficial/:
  diputados.csv, partidos.csv, distritos.csv, sesiones.csv, asistencias.csv, evidencias.csv

Uso (desde la carpeta del proyecto):
  pip install -r scripts/importar/requirements.txt
  python scripts/importar/congreso_asistencias.py            # descarga lo que falte y procesa
  python scripts/importar/congreso_asistencias.py --refrescar # vuelve a descargar todo

Las páginas descargadas se guardan en datos_crudos/ (caché) para no volver a
pedirlas al Congreso. Entre descargas hay una pausa para no saturar el sitio.

Reglas:
- Una persona sin renglón en la lista de una sesión NO se registra como ausente:
  simplemente no tiene registro (el observatorio lo muestra como "sin registro").
- Presente → asistencia; Ausente + Justificada → justificada; Ausente → ausencia;
  sin marcas → pendiente; marcas contradictorias → no_verificado.
- Las sesiones de la Comisión Permanente no cuentan para la asistencia al Pleno,
  porque solo la integran algunas diputaciones.
"""
from __future__ import annotations

import argparse
import csv
import html
import re
import sys
import time
import unicodedata
from datetime import date
from pathlib import Path

import requests
from bs4 import BeautifulSoup

RAIZ = Path(__file__).resolve().parents[2]
CRUDOS = RAIZ / "datos_crudos" / "congreso"
SALIDA = RAIZ / "public" / "datos" / "oficial"

BASE = "https://congresocol.gob.mx"
GACETA = f"{BASE}/web/www/gaceta/plantilla_datos.php"
DIRECTORIO = f"{BASE}/web/www/diputados/index.php"
IEE_DIPUTACIONES = "https://ieecolima.org.mx/diputaciones2024.html"
HOY = date.today().isoformat()
PAUSA = 0.6

sesion_http = requests.Session()
sesion_http.headers["User-Agent"] = "ObservatorioLegislativoColima/0.1 (consulta ciudadana de informacion publica)"


# ----------------------------------------------------------------- utilidades
def descargar(url: str, archivo: Path, *, metodo: str = "get", params: dict | None = None, refrescar: bool = False) -> str:
    """Descarga con caché. Devuelve el texto decodificado (el sitio usa latin-1 o utf-8)."""
    if archivo.exists() and not refrescar:
        crudo = archivo.read_bytes()
    else:
        r = sesion_http.request(metodo, url, params=params, timeout=90)
        r.raise_for_status()
        crudo = r.content
        archivo.parent.mkdir(parents=True, exist_ok=True)
        archivo.write_bytes(crudo)
        time.sleep(PAUSA)
    try:
        return crudo.decode("utf-8")
    except UnicodeDecodeError:
        return crudo.decode("latin-1")


def tokens(t: str) -> set[str]:
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return {w for w in re.findall(r"[a-z]+", t) if len(w) > 2 and w not in {"dip", "diputado", "diputada"}}


def texto(nodo) -> str:
    return re.sub(r"\s+", " ", html.unescape(nodo.get_text(" ", strip=True) if nodo else "")).strip()


def escribir_csv(nombre: str, columnas: list[str], filas: list[dict]) -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    with open(SALIDA / f"{nombre}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columnas, extrasaction="ignore")
        w.writeheader()
        for fila in filas:
            w.writerow({c: fila.get(c, "") for c in columnas})
    print(f"  {nombre}.csv: {len(filas)} filas")


# ----------------------------------------------------------------- evidencias
EVIDENCIAS: dict[str, dict] = {}


def evidencia(id_: str, tipo: str, titulo: str, url: str, institucion: str = "H. Congreso del Estado de Colima", fecha: str = "") -> str:
    EVIDENCIAS.setdefault(id_, {"id_fuente": id_, "tipo": tipo, "titulo": titulo, "institucion": institucion, "url": url, "fecha_documento": fecha, "fecha_consulta": HOY, "oficial": "si"})
    return id_


# ----------------------------------------------------------------- catálogo
ROMANOS = {r: i for i, r in enumerate("I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI".split(), start=1)}
PARTIDOS = {
    # clave del logo del directorio → (id, nombre, siglas, color_serie, color institucional claro, oscuro)
    "PAN": ("PAN", "Partido Acción Nacional", "PAN", 1, "#0659a8", "#4f95e0"),
    "movimiento": ("MC", "Movimiento Ciudadano", "MC", 2, "#f07c00", "#ff9a2e"),
    "NuevaAlianza": ("PANAL", "Nueva Alianza Colima", "NA", 3, "#00a19a", "#2cc5bd"),
    "PT": ("PT", "Partido del Trabajo", "PT", 4, "#d9a400", "#e8bb2e"),
    "Verde": ("PVEM", "Partido Verde Ecologista de México", "PVEM", 6, "#3a9c3a", "#5cc25c"),
    "PRI": ("PRI", "Partido Revolucionario Institucional", "PRI", 7, "#d0202a", "#ef5350"),
    "morena": ("MORENA", "Morena", "Morena", 8, "#9b1d45", "#c9496f"),  # vino / tinto
}
PARTIDO_POR_TEXTO = {"pan": "PAN", "movimiento ciudadano": "MC", "nueva alianza": "PANAL", "pt": "PT", "partido verde": "PVEM", "pri": "PRI", "morena": "MORENA"}


def catalogo(refrescar: bool) -> list[dict]:
    s = descargar(DIRECTORIO, CRUDOS / "directorio.html", refrescar=refrescar)
    ev = evidencia("EV-CONG-DIRECTORIO", "ficha_oficial", "Directorio de diputadas y diputados, LXI Legislatura", DIRECTORIO)
    ev_iee = evidencia("EV-IEE-DIPUTACIONES-2024", "ficha_oficial", "Integración de las diputaciones 2024-2027 (propietarios y suplentes)", IEE_DIPUTACIONES, "Instituto Electoral del Estado de Colima")
    iee = descargar(IEE_DIPUTACIONES, CRUDOS.parent / "iee" / "diputaciones2024.html", refrescar=refrescar)
    suplentes = {}
    for fila in re.findall(r"<tr[^>]*>(.*?)</tr>", iee, re.S):
        c = [texto(BeautifulSoup(x, "html.parser")) for x in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", fila, re.S)]
        if len(c) == 4 and c[0].isdigit():
            suplentes[int(c[0])] = {"propietario": c[1], "suplente": c[2], "origen": c[3]}

    diputados = []
    for bloque in re.split(r'<div class="row" style="margin-bottom:30px;margin-top:10px;">', s)[1:]:
        m = re.search(r'href="index2\.php\?id=(\d+)&vlegis=61&vlogo=([^".]+)\.png">\s*(.*?)</a>', bloque, re.S)
        if not m:
            continue
        id_web, logo, nombre = m.group(1), m.group(2), html.unescape(re.sub(r"\s+", " ", m.group(3))).strip()
        nombre = re.sub(r"^Dip\.\s*", "", nombre)
        foto = re.search(r'src="(/web/Sistema/uploads/Diputados/[^"]+)"', bloque)
        p = re.search(r"<p>(.*?)<br>\s*(.*?)</p>", bloque, re.S)
        tipo = "RP" if p and "Proporcional" in p.group(1) else "MR"
        dist = re.search(r'font-size:30px;padding:30px;">\s*([IVX]+)\s*</div>', bloque)
        distrito = ROMANOS.get(dist.group(1)) if dist else None
        partido_txt = html.unescape(p.group(2)).strip().lower() if p else ""
        id_partido = PARTIDOS.get(logo, (PARTIDO_POR_TEXTO.get(partido_txt, partido_txt.upper()),))[0]
        notas = []
        if distrito and distrito in suplentes:
            notas.append(f"Origen de la postulación según el IEE: {suplentes[distrito]['origen']}. Suplente electa/o: {suplentes[distrito]['suplente']}")
        diputados.append({
            "id_diputado": f"DIP-{id_web}",
            "id_web": id_web,
            "nombre_completo": nombre,
            "id_partido": id_partido,
            "criterio_adscripcion": "Partido que muestra el directorio oficial del Congreso",
            "tipo_representacion": tipo,
            "distrito": distrito or "",
            "calidad": "propietario",
            "fecha_inicio": "2024-10-01",
            "url_ficha_oficial": f"{BASE}/web/www/diputados/index2.php?id={id_web}&vlegis=61",
            "url_foto": BASE + foto.group(1) if foto else "",
            "id_fuente": ev,
            "estado_verificacion": "verificado",
            "notas": "; ".join(notas + ["Fecha de inicio: instalación de la Legislatura (1 oct 2024). Licencias y suplencias se revisan aparte."]),
            "_fotos": {foto.group(1).rsplit("/", 1)[-1].lower()} if foto else set(),
            "_ev_iee": ev_iee,
        })
    if len(diputados) != 25:
        print(f"AVISO: el directorio devolvió {len(diputados)} diputaciones (se esperaban 25).", file=sys.stderr)
    return diputados


# ----------------------------------------------------------------- licencias y suplencias
ACUERDO_PDF = BASE + "/web/Sistema/uploads/Acuerdos/Acuerdo_{n}_61.pdf"
# Tomado de los acuerdos de la LXI Legislatura (lista "Acuerdos" de la Gaceta). Cada periodo indica el
# acuerdo que lo respalda. "hasta" vacío = licencia vigente. Las suplencias se toman de la integración
# publicada por el IEE; la fecha exacta de toma de protesta de cada suplente está pendiente de verificar.
LICENCIAS = [
    {"titular": "DIP-133", "desde": "2025-01-16", "hasta": "2026-10-13", "acuerdos": [17, 67],
     "suplente": {"id": "DIP-S09", "nombre": "Alma Yesenia Ventura Ochoa"},
     "ambiguo": ["2026-10-14"],  # el Pleno aprobó la reincorporación en la propia sesión
     "nota": "Licencia por tiempo indefinido a partir del 16 ene 2025 (Acuerdo 17); reincorporación aprobada el 14 oct 2026 (Acuerdo 67)."},
    {"titular": "DIP-137", "desde": "2024-10-16", "hasta": "2025-04-15", "acuerdos": [6, 29],
     "suplente": {"id": "DIP-S13", "nombre": "Sharon Monserrat Díaz García"}, "ambiguo": [],
     "nota": "Licencia por tiempo indefinido a partir del 16 oct 2024 (Acuerdo 6); reincorporación a partir del 16 abr 2025 (Acuerdo 29)."},
    {"titular": "DIP-RP-JCLT", "desde": "2024-10-02", "hasta": "", "acuerdos": [4],
     "suplente": {"id": "DIP-148", "nombre": None}, "ambiguo": ["2024-10-02"],
     "nota": "Licencia por tiempo indefinido aprobada el 2 oct 2024 (Acuerdo 4)."},
]


def aplicar_licencias(diputados: list[dict]) -> None:
    por_id = {d["id_diputado"]: d for d in diputados}
    # Titular de representación proporcional que ya no aparece en el directorio actual.
    if "DIP-RP-JCLT" not in por_id:
        ev = evidencia("EV-ACUERDO-4", "acta", "Acuerdo 4: licencia del Dip. Julio César León Trujillo", ACUERDO_PDF.format(n=4), fecha="2024-10-02")
        d = {"id_diputado": "DIP-RP-JCLT", "nombre_completo": "Julio César León Trujillo", "id_partido": "MORENA", "criterio_adscripcion": "Lista de representación proporcional de Morena (IEE)",
             "tipo_representacion": "RP", "distrito": "", "calidad": "propietario", "fecha_inicio": "2024-10-01", "fecha_fin": "", "url_ficha_oficial": "", "url_foto": "",
             "id_fuente": "EV-IEE-DIPUTACIONES-2024", "estado_verificacion": "verificado", "notas": "", "_fotos": set()}
        diputados.append(d)
        por_id[d["id_diputado"]] = d
    for lic in LICENCIAS:
        t = por_id[lic["titular"]]
        evs = [evidencia(f"EV-ACUERDO-{n}", "acta", f"Acuerdo {n} de la LXI Legislatura (licencia / reincorporación)", ACUERDO_PDF.format(n=n)) for n in lic["acuerdos"]]
        t["licencias"] = f"{lic['desde']}/{lic['hasta']}"
        t["notas"] = (t.get("notas", "") + " " + lic["nota"]).strip()
        sup = lic["suplente"]
        if sup["nombre"] is None:  # la suplente/el suplente ya está en el directorio (sigue en funciones)
            s_ = por_id[sup["id"]]
            s_.update({"calidad": "suplente", "id_titular": t["id_diputado"], "fecha_inicio": lic["desde"], "estado_verificacion": "pendiente",
                       "notas": f"Suplente en funciones de {t['nombre_completo']}. {lic['nota']} Fecha de toma de protesta por verificar."})
        else:
            diputados.append({"id_diputado": sup["id"], "nombre_completo": sup["nombre"], "id_partido": t["id_partido"], "criterio_adscripcion": "Partido de la persona titular (verificar)",
                              "tipo_representacion": t["tipo_representacion"], "distrito": t["distrito"], "calidad": "suplente", "id_titular": t["id_diputado"],
                              "fecha_inicio": lic["desde"], "fecha_fin": lic["hasta"], "url_ficha_oficial": "", "url_foto": "", "id_fuente": "EV-IEE-DIPUTACIONES-2024",
                              "estado_verificacion": "pendiente", "notas": f"Suplente electa según el IEE. {lic['nota']} Fecha de toma de protesta por verificar.", "_fotos": set()})
        lic["_evs"] = evs


def reatribuir_por_licencia(registros: list[dict], sesiones_por_id: dict[str, dict]) -> int:
    """La Gaceta muestra cada curul con el nombre de su titular actual. Durante una licencia,
    el registro corresponde a quien ejercía el cargo: se reasigna a la suplencia."""
    cambios = 0
    for lic in LICENCIAS:
        for r in registros:
            if r["id_diputado"] not in (lic["titular"], lic["suplente"]["id"]):
                continue
            fecha = sesiones_por_id[r["id_sesion"]]["fecha"]
            if fecha in lic["ambiguo"]:
                r["estado"] = "no_verificado"
                r["notas"] = "Día de cambio entre titular y suplencia: no puede asegurarse quién ocupaba la curul en esta sesión."
                continue
            en_licencia = fecha >= lic["desde"] and (not lic["hasta"] or fecha <= lic["hasta"])
            destino = lic["suplente"]["id"] if en_licencia else lic["titular"]
            if r["id_diputado"] != destino:
                r["id_diputado"] = destino
                r["notas"] = ("La lista oficial muestra la curul con el nombre de la persona titular actual; en esta fecha ejercía el cargo "
                              + ("la suplencia" if en_licencia else "la persona titular") + " según los acuerdos " + ", ".join(str(n) for n in lic["acuerdos"]) + ".")
                cambios += 1
    return cambios


# ----------------------------------------------------------------- distritos
def distritos(diputados: list[dict], refrescar: bool) -> list[dict]:
    """Municipios según el IEE (título de cada página de distrito) y cabecera según la ficha del Congreso."""
    filas = []
    for n in range(1, 17):
        url = f"https://ieecolima.org.mx/distrito{n}.html"
        h = descargar(url, CRUDOS.parent / "iee" / f"distrito{n}.html", refrescar=refrescar)
        m = re.search(r"Distrito\s+%d\s*\(([^)]+)\)" % n, html.unescape(re.sub(r"<[^>]+>", " ", h)))
        municipios = [x.strip() for x in m.group(1).split("-")] if m else []
        d = next((x for x in diputados if x["distrito"] == n), None)
        cabecera = ""
        if d:
            ficha = descargar(d["url_ficha_oficial"], CRUDOS / "perfiles" / f"{d['id_web']}.html", refrescar=refrescar)
            c = re.search(r"Distrito:\s*[IVX]+\s*,\s*([^<\n]+)", html.unescape(ficha))
            cabecera = c.group(1).strip() if c else ""
        filas.append({"distrito": n, "cabecera": cabecera, "municipios": "; ".join(municipios),
                      "id_fuente": evidencia(f"EV-IEE-DISTRITO-{n:02d}", "cartografia", f"Distrito electoral local {n} (redistritación 2022)", url, "Instituto Electoral del Estado de Colima"),
                      "notas": "Municipios: IEE Colima. Nombre de la demarcación: ficha del Congreso. Redistritación local 2022, vigente en la elección de 2024."})
    return filas


# ----------------------------------------------------------------- sesiones
ANIOS = {"primer": 1, "segundo": 2, "tercer": 3}


def clasificar_sesion(desc: str, tipo_param: str) -> dict:
    d = desc.lower()
    anio = next((v for k, v in ANIOS.items() if re.search(rf"{k}\s+a[ñn]o", d)), None)
    if "comisión permanente" in d or "comision permanente" in d:
        tipo = "permanente"
    elif "solemne" in d:
        tipo = "solemne"
    elif "extraordinaria" in d or tipo_param == "extraordinaria":
        tipo = "extraordinaria"
    else:
        tipo = "ordinaria"
    if "receso" in d:
        n_receso = 1 if "primer periodo de receso" in d else 2
        periodo = "primer_receso" if n_receso == 1 else "segundo_receso"
        clave_periodo = f"REC{n_receso}"
    elif "segundo periodo ordinario" in d:
        periodo, clave_periodo = "segundo_ordinario", "PO2"
    elif "primer periodo ordinario" in d:
        periodo, clave_periodo = "primer_ordinario", "PO1"
    else:
        periodo, clave_periodo = "otro", "OTR"
    num = re.search(r"No\.\s*(\d+)", desc) or re.search(r"Sesi[óo]n\s+(?:Permanente\s+)?(\d+)", desc)
    return {"anio": anio, "tipo": tipo, "periodo": periodo, "clave_periodo": clave_periodo, "numero": int(num.group(1)) if num else None}


def sesiones(refrescar: bool) -> list[dict]:
    lista = descargar(GACETA, CRUDOS / "gaceta" / "tasistencias.html", metodo="post", params={"v": "tasistencias", "l": "61", "ld": "LXI Legislatura", "lc": "%"}, refrescar=refrescar)
    sopa = BeautifulSoup(lista, "html.parser")
    filas, usados = [], set()
    for a in sopa.find_all("a", href=True):
        if "asistencias/view.php" not in a["href"]:
            continue
        href = a["href"]
        fecha = re.search(r"fecha=([\d-]+)", href).group(1)
        tipo_param = (re.search(r"tipo_sesion=([^&]+)", href) or [None, ""])[1]
        desc = texto(a)
        c = clasificar_sesion(desc, tipo_param)
        cod = {"ordinaria": "ORD", "solemne": "SOL", "extraordinaria": "EXT", "permanente": "PER"}[c["tipo"]]
        if c["tipo"] == "ordinaria" and re.search(r"sesi[óo]n permanente", desc, re.I):
            cod = "SPE"  # sesión del Pleno declarada permanente: numeración propia
        base_id = f"S-A{c['anio'] or 0}-{c['clave_periodo']}-{cod}-{c['numero'] or 0:03d}"
        id_ = base_id if base_id not in usados else f"{base_id}-{fecha}"
        usados.add(id_)
        url = f"{BASE}/web/www/gaceta/{href.lstrip('/')}" if not href.startswith("http") else href
        filas.append({
            "id_sesion": id_, "fecha": fecha, "anio_legislativo": c["anio"] or "", "periodo": c["periodo"], "tipo_sesion": c["tipo"],
            "numero_sesion": c["numero"] or "", "cuenta_para_asistencia": "no" if c["tipo"] == "permanente" else "si",
            "id_fuente": evidencia(f"EV-ASIS-{id_}", "lista_asistencia", f"Lista de asistencia: {desc}", url, fecha=fecha),
            "notas": desc, "_url": url, "_tipo_param": tipo_param,
        })
    filas.sort(key=lambda x: (x["fecha"], x["id_sesion"]))
    return filas


# ----------------------------------------------------------------- asistencias
def estado_desde_marcas(p: bool, a: bool, j: bool) -> str:
    if p and not a and not j:
        return "asistencia"
    if j and not p:
        return "justificada"
    if a and not p:
        return "ausencia"
    if not (p or a or j):
        return "pendiente"
    return "no_verificado"


def asistencias(lista_sesiones: list[dict], diputados: list[dict], refrescar: bool) -> tuple[list[dict], list[dict]]:
    por_foto = {f: d for d in diputados for f in d["_fotos"]}
    por_tokens = [(tokens(d["nombre_completo"]), d) for d in diputados]
    nuevos: dict[str, dict] = {}
    registros = []
    urls = {}
    for s in lista_sesiones:
        urls.setdefault(s["_url"], []).append(s["id_sesion"])
    for s in lista_sesiones:
        compartida = len(urls[s["_url"]]) > 1
        if compartida:
            otras = [x for x in urls[s["_url"]] if x != s["id_sesion"]]
            s["notas"] += f" | La página oficial de asistencia es la misma que la de {', '.join(otras)} (misma fecha y tipo); los renglones de ambas sesiones vienen mezclados."
        if compartida and s["tipo_sesion"] == "permanente":
            s["notas"] += " No se atribuyen asistencias a esta sesión para no confundirlas con las del Pleno."
            continue
        nombre_archivo = f"{s['fecha']}_{s['_tipo_param']}_{s['id_sesion']}.html"
        h = descargar(s["_url"], CRUDOS / "asistencias" / nombre_archivo, refrescar=refrescar)
        tabla = BeautifulSoup(h, "html.parser").find("table")
        if not tabla:
            print(f"  AVISO: sin tabla de asistencia en {s['id_sesion']} ({s['fecha']})", file=sys.stderr)
            continue
        marcas_por_persona: dict[str, list[tuple[bool, bool, bool]]] = {}
        orden: list[str] = []
        for tr in tabla.find_all("tr"):
            celdas = tr.find_all("td")
            if len(celdas) < 4:
                continue
            nombre = texto(celdas[0])
            img = celdas[0].find("img")
            foto = img["src"].rsplit("/", 1)[-1].lower() if img and img.get("src") else ""
            marcas = ["✔" in c.get_text() or "&#10004;" in str(c) for c in celdas[1:4]]
            d = por_foto.get(foto)
            if not d:
                t = tokens(nombre)
                candidatos = [dd for tk, dd in por_tokens if len(t & tk) >= min(3, len(tk))]
                d = candidatos[0] if len(candidatos) == 1 else None
            if not d:
                clave = " ".join(sorted(tokens(nombre)))
                if clave not in nuevos:
                    nuevos[clave] = {"id_diputado": f"DIP-X{len(nuevos) + 1:02d}", "nombre_completo": nombre, "id_partido": "", "tipo_representacion": "", "distrito": "", "calidad": "suplente",
                                     "fecha_inicio": s["fecha"], "url_foto": f"{BASE}/web/Sistema/uploads/Diputados/{foto}" if foto else "", "id_fuente": s["id_fuente"], "estado_verificacion": "pendiente",
                                     "notas": "Aparece en listas de asistencia pero no en el directorio actual (posible suplente). Completar partido, distrito y periodo.", "_fotos": {foto}}
                d = nuevos[clave]
                d["fecha_fin"] = s["fecha"]
            if d["id_diputado"] not in marcas_por_persona:
                marcas_por_persona[d["id_diputado"]] = []
                orden.append(d["id_diputado"])
            marcas_por_persona[d["id_diputado"]].append(tuple(marcas))
        for id_d in orden:
            con_marca = sorted(set(m for m in marcas_por_persona[id_d] if any(m)))
            if not con_marca:
                if s["tipo_sesion"] == "permanente":
                    continue  # no integra la Comisión Permanente
                estado, nota = "pendiente", "La lista oficial no tiene ninguna marca para esta persona."
            elif len(con_marca) > 1:
                estado, nota = "no_verificado", "La página mezcla varias sesiones y las marcas no coinciden: " + "; ".join(f"presente={a}, ausente={b}, justificada={c}" for a, b, c in con_marca)
            else:
                estado = estado_desde_marcas(*con_marca[0])
                nota = "" if estado != "no_verificado" else "Marcas contradictorias: presente={}, ausente={}, justificada={}".format(*con_marca[0])
            registros.append({"id_sesion": s["id_sesion"], "id_diputado": id_d, "estado": estado,
                              "justificacion": "Justificada según la lista oficial (sin motivo publicado)" if estado == "justificada" else "",
                              "id_fuente": s["id_fuente"] if estado != "pendiente" else "", "notas": nota})
    return registros, list(nuevos.values())


# ----------------------------------------------------------------- fotografías
def fotos(diputados: list[dict], refrescar: bool) -> None:
    """Copia local de la fotografía oficial de cada persona (public/fotos/<id>.jpg), reducida
    para la web. Se conserva url_foto como fuente. Si la descarga falla, archivo_foto queda vacío
    y la interfaz muestra «Fotografía no disponible»."""
    from io import BytesIO
    from urllib.parse import quote
    try:
        from PIL import Image
    except ImportError:
        print("  (instale Pillow para copiar las fotografías: pip install Pillow)")
        return
    destino = RAIZ / "public" / "fotos"
    destino.mkdir(parents=True, exist_ok=True)
    for d in diputados:
        if not d.get("url_foto"):
            continue
        nombre = d["url_foto"].rsplit("/", 1)[-1]
        crudo = CRUDOS / "fotos" / nombre
        salida = destino / f"{d['id_diputado']}.jpg"
        try:
            if refrescar or not crudo.exists():
                r = sesion_http.get(quote(d["url_foto"], safe=":/"), timeout=60)
                r.raise_for_status()
                crudo.parent.mkdir(parents=True, exist_ok=True)
                crudo.write_bytes(r.content)
                time.sleep(PAUSA)
            img = Image.open(BytesIO(crudo.read_bytes()))
            img = img.convert("RGB")
            img.thumbnail((480, 640))
            img.save(salida, "JPEG", quality=84, optimize=True, progressive=True)
            d["archivo_foto"] = f"fotos/{salida.name}"
        except Exception as e:  # imagen rota o inaccesible: se informa y se sigue
            print(f"  AVISO: no se pudo copiar la foto de {d['nombre_completo']}: {e}", file=sys.stderr)
            d["archivo_foto"] = ""


# ----------------------------------------------------------------- principal
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refrescar", action="store_true", help="volver a descargar todo aunque exista en caché")
    args = ap.parse_args()

    print("1/3 Catálogo de diputaciones…")
    dips = catalogo(args.refrescar)
    print("   distritos…")
    dist = distritos(dips, args.refrescar)
    print("2/3 Sesiones…")
    ses = sesiones(args.refrescar)
    print(f"   {len(ses)} sesiones, de {ses[0]['fecha']} a {ses[-1]['fecha']}")
    print("3/3 Listas de asistencia (una descarga por sesión, con caché)…")
    asis, extra = asistencias(ses, dips, args.refrescar)
    print("   licencias y suplencias…")
    aplicar_licencias(dips)
    n = reatribuir_por_licencia(asis, {x["id_sesion"]: x for x in ses})
    print(f"   {n} registros reasignados a la persona que ejercía la curul")

    print("   fotografías oficiales…")
    fotos(dips, args.refrescar)
    todos = dips + extra
    usados = {d["id_partido"] for d in todos if d["id_partido"]}
    partidos = sorted((v for v in PARTIDOS.values() if v[0] in usados), key=lambda v: v[3])
    print("Escribiendo CSV en", SALIDA.relative_to(RAIZ))
    escribir_csv("partidos", ["id_partido", "nombre", "siglas", "color_serie", "color_claro", "color_oscuro", "notas"],
                 [{"id_partido": a, "nombre": b, "siglas": c, "color_serie": e, "color_claro": cl, "color_oscuro": co, "notas": "Color institucional aproximado para gráficas"} for a, b, c, e, cl, co in partidos])
    escribir_csv("diputados", ["id_diputado", "nombre_completo", "id_partido", "criterio_adscripcion", "tipo_representacion", "distrito", "calidad", "id_titular", "fecha_inicio", "fecha_fin", "licencias", "url_ficha_oficial", "url_foto", "archivo_foto", "id_fuente", "estado_verificacion", "notas"], todos)
    escribir_csv("distritos", ["distrito", "cabecera", "municipios", "id_fuente", "notas"], dist)
    escribir_csv("sesiones", ["id_sesion", "fecha", "anio_legislativo", "periodo", "tipo_sesion", "numero_sesion", "cuenta_para_asistencia", "id_fuente", "notas"], ses)
    escribir_csv("asistencias", ["id_sesion", "id_diputado", "estado", "justificacion", "id_fuente", "notas"], asis)
    # Se conservan las evidencias que agregaron otros importadores (iniciativas, etc.).
    previas = {}
    if (SALIDA / "evidencias.csv").exists():
        with open(SALIDA / "evidencias.csv", encoding="utf-8-sig") as f:
            previas = {e["id_fuente"]: e for e in csv.DictReader(f)}
    previas.update(EVIDENCIAS)
    escribir_csv("evidencias", ["id_fuente", "tipo", "titulo", "institucion", "url", "fecha_documento", "fecha_consulta", "oficial", "pagina", "notas"], list(previas.values()))
    if extra:
        print(f"\nAVISO: {len(extra)} personas aparecen en listas pero no en el directorio (revisar suplencias):")
        for e in extra:
            print("  ", e["id_diputado"], e["nombre_completo"], e["fecha_inicio"], "→", e.get("fecha_fin", ""))


if __name__ == "__main__":
    main()
