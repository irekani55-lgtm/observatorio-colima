"""
Distrito local de cada sección electoral en la elección de 2024 (con la que se eligió la LXI Legislatura).

Fuente: base de datos del PREP 2024 del IEE Colima, elección de diputaciones locales: cada casilla trae su
sección y su distrito local. Se compara con la cartografía vigente del INE (public/geo/secciones_distrito.csv,
generada por scripts/convertir-cartografia.mjs) y se agrega a ese archivo:
  distrito_2024  distrito en que votó la sección en 2024 (vacío si no tuvo casilla propia o no existía)
  situacion      igual | cambio_distrito | nueva | sin_casilla_2024 | solo_2024
Las secciones que existían en 2024 y ya no están en la cartografía vigente se agregan (situacion = solo_2024)
para quien conserve una credencial anterior.

Uso: python scripts/importar/iee_secciones_2024.py [--refrescar]
"""
from __future__ import annotations

import csv
import io
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from congreso_asistencias import CRUDOS  # noqa: E402
from congreso_actas import bajar_binario  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
URL = "https://ieecolima.org.mx/PREP_24/20240602_0819_PREP_COL.zip"
SECCIONES = RAIZ / "public" / "geo" / "secciones_distrito.csv"


def distritos_2024(refrescar: bool) -> dict[int, int]:
    destino = CRUDOS.parent / "iee" / "prep2024" / "PREP_COL_2024.zip"
    destino.parent.mkdir(parents=True, exist_ok=True)
    datos = bajar_binario(URL, destino, refrescar)
    if not datos:
        sys.exit(f"No se pudo descargar {URL}")
    externo = zipfile.ZipFile(io.BytesIO(datos))
    interno = next(n for n in externo.namelist() if "DIP_LOC" in n)
    dl = zipfile.ZipFile(io.BytesIO(externo.read(interno)))
    nombre = next(n for n in dl.namelist() if n.endswith(".csv") and "PREP_DIP_LOC" in n)
    lineas = dl.read(nombre).decode("utf-8", "replace").splitlines()
    inicio = next(i for i, l in enumerate(lineas) if l.startswith("CLAVE_CASILLA"))
    salida: dict[int, set[int]] = {}
    for r in csv.DictReader(io.StringIO("\n".join(lineas[inicio:]))):
        s, d = r["SECCION"].strip("'"), r["ID_DISTRITO_LOCAL"].strip("'")
        if s.isdigit() and d.isdigit():
            salida.setdefault(int(s), set()).add(int(d))
    varios = [s for s, ds in salida.items() if len(ds) > 1]
    if varios:
        sys.exit(f"Secciones con casillas en más de un distrito en el PREP: {varios}")
    return {s: next(iter(ds)) for s, ds in salida.items()}


def main() -> None:
    refrescar = "--refrescar" in sys.argv
    d24 = distritos_2024(refrescar)
    with open(SECCIONES, encoding="utf-8") as f:
        # Solo las secciones de la cartografía vigente (las «solo_2024» las agrega este mismo script).
        vigentes = {int(r["seccion"]): r for r in csv.DictReader(f) if r["distrito"]}
    # Las secciones nuevas (401 en adelante) salen de dividir secciones de 2024 que ya no existen.
    nuevas_desde = min((s for s in vigentes if s not in d24 and s > max(d24)), default=10**6)
    filas = []
    for s in sorted(set(vigentes) | set(d24)):
        v = vigentes.get(s)
        if v is None:
            filas.append({"seccion": s, "distrito": "", "municipio": "", "distrito_2024": d24[s], "situacion": "solo_2024"})
            continue
        d = int(v["distrito"])
        if s in d24:
            sit = "igual" if d24[s] == d else "cambio_distrito"
        else:
            sit = "nueva" if s >= nuevas_desde else "sin_casilla_2024"
        filas.append({"seccion": s, "distrito": d, "municipio": v["municipio"], "distrito_2024": d24.get(s, ""), "situacion": sit})
    with open(SECCIONES, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["seccion", "distrito", "municipio", "distrito_2024", "situacion"])
        w.writeheader()
        w.writerows(filas)
    from collections import Counter
    print(f"  secciones_distrito.csv: {len(filas)} secciones", dict(Counter(x["situacion"] for x in filas)))
    for x in filas:
        if x["situacion"] == "cambio_distrito":
            print(f"   sección {x['seccion']:04d}: distrito {x['distrito_2024']} en 2024 → {x['distrito']} en la cartografía vigente")


if __name__ == "__main__":
    main()
