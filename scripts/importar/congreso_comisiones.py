"""
Descarga los programas de trabajo e informes de actividades de cada comisión (página oficial de comisiones)
y extrae el total de reuniones que declara cada informe («celebró un total de N reuniones…»).

El Congreso no publica el registro de cada reunión (fecha, asistencia, acta), por lo que solo se conservan
los totales que declaran las propias comisiones, con el documento de origen.

Requiere congreso_asuntos.py (comisiones.csv). Escribe datos_crudos/congreso/comision_documentos.json.
Uso: python scripts/importar/congreso_comisiones.py [--refrescar]
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote, urljoin

sys.path.insert(0, str(Path(__file__).parent))
from congreso_asistencias import BASE, CRUDOS, sesion_http  # noqa: E402
from congreso_asuntos import COMISIONES_URL, descargar, leer_csv, palabras  # noqa: E402

DIR = CRUDOS / "comisiones_docs"
NUMEROS = {"un": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "once": 11, "doce": 12, "trece": 13,
           "catorce": 14, "quince": 15, "dieciséis": 16, "dieciseis": 16, "diecisiete": 17, "dieciocho": 18, "diecinueve": 19, "veinte": 20}


def texto_de_pdf(archivo: Path) -> tuple[str, bool]:
    """Texto del PDF; si es un escaneo sin texto, se reconoce con OCR (Tesseract, español) y se guarda en caché."""
    t = subprocess.run(["pdftotext", "-layout", str(archivo), "-"], capture_output=True, text=True, timeout=120).stdout
    if len(t.split()) > 50:
        return t, False
    cache = archivo.with_suffix(".ocr.txt")
    if cache.exists():
        return cache.read_text(encoding="utf-8"), True
    import shutil
    import tempfile
    if not shutil.which("tesseract"):
        return "", False
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-r", "150", "-gray", "-png", str(archivo), f"{tmp}/p"], check=False, timeout=600)
        textos = []
        for img in sorted(Path(tmp).glob("p-*.png")):
            r = subprocess.run(["tesseract", str(img), "-", "-l", "spa", "--psm", "4"], capture_output=True, text=True, timeout=180)
            textos.append(r.stdout)
    t = "\n".join(textos)
    cache.write_text(t, encoding="utf-8")
    return t, True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refrescar", action="store_true")
    args = ap.parse_args()
    import time
    s = descargar(COMISIONES_URL, CRUDOS / "comisiones.html", refrescar=args.refrescar)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    coms = leer_csv("comisiones")
    # bloques por comisión: el título está en <strong> dentro del botón
    partes = re.split(r'<button id="boton\d+"', s)[1:]
    salida = []
    for bloque in partes:
        nombre = html.unescape(re.sub(r"\s+", " ", re.search(r"<strong>(.*?)</strong>", bloque, re.S).group(1))).strip()
        clave = " ".join(palabras(nombre))
        c = next((x for x in coms if " ".join(palabras(x["nombre"])) == clave), None)
        for etiqueta, href in re.findall(r"(Programa de la Comisi[óo]n \d{4}|Primer Informe|Segundo Informe|Tercer Informe):&nbsp;<a href=\"([^\"]+)\"", bloque):
            url = quote(urljoin(BASE + "/web/www/comisiones/", href), safe=":/%")
            archivo = DIR / (re.sub(r"[^A-Za-z0-9]+", "_", (c["id_comision"] if c else clave)[:40]) + "_" + re.sub(r"\W+", "_", etiqueta) + ".pdf")
            if args.refrescar or not archivo.exists():
                try:
                    r = sesion_http.get(url, timeout=120)
                    if r.status_code == 200 and r.content[:4] == b"%PDF":
                        DIR.mkdir(parents=True, exist_ok=True)
                        archivo.write_bytes(r.content)
                    time.sleep(0.6)
                except Exception:
                    pass
            total, frase, paginas, ocr = None, "", "", False
            if archivo.exists():
                t, ocr = texto_de_pdf(archivo) if "Informe" in etiqueta else ("", False)
                paginas = subprocess.run(["pdfinfo", str(archivo)], capture_output=True, text=True).stdout
                paginas = (re.search(r"Pages:\s+(\d+)", paginas) or [None, ""])[1]
                if "Informe" in etiqueta:
                    plano = re.sub(r"\s+", " ", t)
                    m = re.search(r"(?i)(?:celebr|llev[óo] a cabo|realiz|sesion|efectu|desarroll|tuvo)[^.]{0,100}?(?:un total de\s+)?(\d{1,3}|" + "|".join(NUMEROS) + r")\s*(?:\(\w+\)\s*)?(?:reuniones|sesiones)", plano)
                    if m and not re.search(r"(?i)proyect|program[óoa]|planea|prev[ée]|estim", plano[max(0, m.start() - 60):m.end()]):
                        total = int(m.group(1)) if m.group(1).isdigit() else NUMEROS[m.group(1).lower()]
                        frase = plano[max(0, m.start() - 40):m.end() + 60]
            salida.append({"id_comision": c["id_comision"] if c else "", "comision": nombre, "documento": etiqueta, "url": url, "descargado": archivo.exists(), "paginas": paginas,
                           "reuniones_declaradas": total, "frase": frase, "texto_por_ocr": bool(archivo.exists() and "Informe" in etiqueta and ocr)})
    (CRUDOS / "comision_documentos.json").write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    inf = [x for x in salida if "Informe" in x["documento"]]
    print(f"   {len(salida)} documentos ({len(inf)} informes); descargados {sum(x['descargado'] for x in salida)}; informes con total de reuniones: {sum(x['reuniones_declaradas'] is not None for x in inf)}")


if __name__ == "__main__":
    main()
