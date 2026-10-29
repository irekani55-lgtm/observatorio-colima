"""
Descarga las actas de sesión y las síntesis de comunicaciones de la LXI Legislatura
(Gaceta Parlamentaria) y extrae su texto.
Las actas narran lo ocurrido en cada sesión: iniciativas presentadas, dictámenes, votaciones
nominales e intervenciones. Este módulo solo descarga y guarda el texto; los demás importadores
lo usan.

Uso: python scripts/importar/congreso_actas.py [--refrescar]
Salida: datos_crudos/congreso/actas/ y datos_crudos/congreso/sintesis/
        (<fecha>_<n>.txt por documento e indice.json)
"""
from __future__ import annotations

import argparse
import html
import io
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from congreso_asistencias import BASE, CRUDOS, GACETA, descargar, sesion_http, texto  # noqa: E402

MESES = {m: i for i, m in enumerate(["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"], start=1)}


def fecha_de_texto(t: str) -> str:
    m = re.search(r"(\d{1,2}) de (" + "|".join(MESES) + r") (?:de|del) (\d{4})", t.lower())
    return f"{m.group(3)}-{MESES[m.group(2)]:02d}-{int(m.group(1)):02d}" if m else ""


def texto_docx(datos: bytes) -> str:
    x = zipfile.ZipFile(io.BytesIO(datos)).read("word/document.xml").decode("utf-8", "replace")
    ps = [html.unescape(re.sub(r"<[^>]+>", "", p)).strip() for p in re.findall(r"<w:p[ >].*?</w:p>", x, re.S)]
    return "\n".join(p for p in ps if p)


def texto_pdf(ruta: Path) -> str:
    try:
        return subprocess.run(["pdftotext", "-layout", str(ruta), "-"], capture_output=True, text=True, timeout=120).stdout
    except Exception:
        return ""


def bajar_binario(url: str, ruta: Path, refrescar: bool) -> bytes | None:
    if ruta.exists() and not refrescar:
        return ruta.read_bytes()
    try:
        r = sesion_http.get(url, timeout=120)
        if r.status_code != 200 or len(r.content) < 500:
            return None
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_bytes(r.content)
        import time
        time.sleep(0.6)
        return r.content
    except Exception:
        return None


def procesar(v: str, carpeta: str, refrescar: bool) -> None:
    from urllib.parse import quote
    DIR = CRUDOS / carpeta
    lista = descargar(GACETA, CRUDOS / "gaceta" / f"{v}.html", metodo="post", params={"v": v, "l": "61", "ld": "LXI Legislatura", "lc": "%"}, refrescar=refrescar)
    sopa = BeautifulSoup(lista, "html.parser")
    indice = []
    for d in sopa.find_all("div", attrs={"title": "Descripción"}):
        fila = d.parent
        desc = texto(d)
        fa = fila.find("div", attrs={"title": "Fecha Aprobación"}) or fila.find("div", attrs={"title": "Fecha"})
        enlaces = [a["href"] for a in fila.find_all("a", href=True) if re.search(r"\.(docx?|pdf)$", a["href"], re.I)]
        fecha = fecha_de_texto(desc) or (texto(fa) if fa else "")
        indice.append({"descripcion": desc, "fecha": fecha, "fecha_aprobacion_acta": texto(fa) if fa else "", "docx": next((e for e in enlaces if e.lower().endswith("docx")), ""), "pdf": next((e for e in enlaces if e.lower().endswith(".pdf")), "")})
    print(f"{v}: {len(indice)} documentos en la lista")
    ok = 0
    for i, a in enumerate(indice):
        base = f"{a['fecha']}_{i:03d}"
        txt = DIR / f"{base}.txt"
        if txt.exists() and not refrescar:
            a["archivo"] = txt.name
            ok += 1
            continue
        contenido = ""
        if a["docx"]:
            datos = bajar_binario(BASE + quote(a["docx"]), DIR / f"{base}.docx", refrescar)
            if datos:
                try:
                    contenido = texto_docx(datos)
                except Exception:
                    contenido = ""
        if not contenido and a["pdf"]:
            datos = bajar_binario(BASE + quote(a["pdf"]), DIR / f"{base}.pdf", refrescar)
            if datos:
                contenido = texto_pdf(DIR / f"{base}.pdf")
        a["url"] = BASE + quote(a["docx"] or a["pdf"]) if (a["docx"] or a["pdf"]) else ""
        if contenido:
            DIR.mkdir(parents=True, exist_ok=True)
            txt.write_text(contenido, encoding="utf-8")
            a["archivo"] = txt.name
            ok += 1
        else:
            a["archivo"] = ""
    for a in indice:
        a.setdefault("url", BASE + quote(a["docx"] or a["pdf"]) if (a["docx"] or a["pdf"]) else "")
    DIR.mkdir(parents=True, exist_ok=True)
    (DIR / "indice.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"   {ok} con texto; {len(indice) - ok} sin documento descargable")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refrescar", action="store_true")
    args = ap.parse_args()
    procesar("tactas", "actas", args.refrescar)
    procesar("tsintesis", "sintesis", args.refrescar)


if __name__ == "__main__":
    main()
