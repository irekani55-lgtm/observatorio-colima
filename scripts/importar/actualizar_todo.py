"""
Actualiza toda la base de datos oficial en el orden correcto y genera las entregas en CSV.

Uso (desde la carpeta del proyecto):
  python scripts/importar/actualizar_todo.py              # usa la caché y descarga solo lo nuevo
  python scripts/importar/actualizar_todo.py --refrescar  # vuelve a descargar las listas de la Gaceta

Pasos: asistencias y catálogo → actas y síntesis → iniciativas, decretos y comisiones →
dictámenes → votaciones → bitácora de observaciones → pruebas de regresión → validación → entregas CSV.
"""
import csv
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).parent
RAIZ = AQUI.parents[1]
extra = ["--refrescar"] if "--refrescar" in sys.argv else []
DATOS = RAIZ / "public" / "datos" / "oficial"
# Claves que nunca deben desaparecer de una actualización a otra: si una se pierde, algo se movió (por ejemplo, la
# numeración de las actas) y los enlaces y la bitácora quedarían apuntando a otro registro.
CLAVES = {"votaciones": "id_votacion", "intervenciones": "id_intervencion", "asuntos": "id_asunto", "diputados": "id_diputado", "sesiones": "id_sesion"}


def claves() -> dict[str, set[str]]:
    salida = {}
    for tabla, col in CLAVES.items():
        f = DATOS / f"{tabla}.csv"
        if f.exists():
            with open(f, encoding="utf-8-sig") as fh:
                salida[tabla] = {r[col] for r in csv.DictReader(fh)}
    return salida


antes = claves()

pasos = [
    ("Asistencias, diputaciones y distritos", [sys.executable, str(AQUI / "congreso_asistencias.py"), *extra]),
    ("Actas y síntesis de comunicaciones", [sys.executable, str(AQUI / "congreso_actas.py"), *extra]),
    ("Iniciativas, decretos y comisiones", [sys.executable, str(AQUI / "congreso_asuntos.py"), *extra]),
    ("Dictámenes", [sys.executable, str(AQUI / "congreso_dictamenes.py"), *extra]),
    ("Programas e informes de comisiones", [sys.executable, str(AQUI / "congreso_comisiones.py"), *extra]),
    ("Acuerdos, puntos de acuerdo y exhortos", [sys.executable, str(AQUI / "congreso_acuerdos.py"), *extra]),
    ("Votaciones", [sys.executable, str(AQUI / "congreso_votaciones.py")]),
    ("Intervenciones en tribuna", [sys.executable, str(AQUI / "congreso_intervenciones.py"), *extra]),
    ("Distrito de cada sección en 2024 (PREP del IEE)", [sys.executable, str(AQUI / "iee_secciones_2024.py"), *extra]),
    ("Bitácora de observaciones y cuadre de votaciones", [sys.executable, str(AQUI / "observaciones.py")]),
    ("Claves que ya existían", None),
    ("Pruebas de regresión", [sys.executable, str(AQUI / "pruebas_regresion.py")]),
    ("Validación", ["npx", "tsx", "scripts/validar-datos.ts", "oficial"]),
    ("Entregas CSV", [sys.executable, str(AQUI / "exportar_entrega.py"), "todo"]),
]
for titulo, cmd in pasos:
    print(f"\n=== {titulo} ===", flush=True)
    if cmd is None:
        ahora = claves()
        perdidas = {t: sorted(antes[t] - ahora.get(t, set())) for t in antes if antes[t] - ahora.get(t, set())}
        for t, ids in perdidas.items():
            print(f"  FALLA {t}: desaparecieron {len(ids)} claves, por ejemplo {', '.join(ids[:5])}")
        if perdidas:
            sys.exit("Se perdieron registros que ya estaban publicados. No publique; pida ayuda con este mensaje.")
        print("  ok    ninguna clave publicada desapareció")
        continue
    r = subprocess.run(cmd, cwd=RAIZ)
    if r.returncode != 0 and titulo != "Validación":
        sys.exit(f"Falló el paso «{titulo}».")
print("\nListo. Revise el reporte de validación antes de publicar.")
