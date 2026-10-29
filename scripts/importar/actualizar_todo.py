"""
Actualiza toda la base de datos oficial en el orden correcto y genera las entregas en CSV.

Uso (desde la carpeta del proyecto):
  python scripts/importar/actualizar_todo.py              # usa la caché y descarga solo lo nuevo
  python scripts/importar/actualizar_todo.py --refrescar  # vuelve a descargar las listas de la Gaceta

Pasos: asistencias y catálogo → actas y síntesis → iniciativas, decretos y comisiones →
dictámenes → validación → entregas CSV (carpeta entrega/).
"""
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).parent
RAIZ = AQUI.parents[1]
extra = ["--refrescar"] if "--refrescar" in sys.argv else []

pasos = [
    ("Asistencias, diputaciones y distritos", [sys.executable, str(AQUI / "congreso_asistencias.py"), *extra]),
    ("Actas y síntesis de comunicaciones", [sys.executable, str(AQUI / "congreso_actas.py"), *extra]),
    ("Iniciativas, decretos y comisiones", [sys.executable, str(AQUI / "congreso_asuntos.py"), *extra]),
    ("Dictámenes", [sys.executable, str(AQUI / "congreso_dictamenes.py"), *extra]),
    ("Programas e informes de comisiones", [sys.executable, str(AQUI / "congreso_comisiones.py"), *extra]),
    ("Acuerdos, puntos de acuerdo y exhortos", [sys.executable, str(AQUI / "congreso_acuerdos.py"), *extra]),
    ("Votaciones", [sys.executable, str(AQUI / "congreso_votaciones.py")]),
    ("Intervenciones en tribuna", [sys.executable, str(AQUI / "congreso_intervenciones.py"), *extra]),
    ("Validación", ["npx", "tsx", "scripts/validar-datos.ts", "oficial"]),
    ("Entregas CSV", [sys.executable, str(AQUI / "exportar_entrega.py"), "todo"]),
]
for titulo, cmd in pasos:
    print(f"\n=== {titulo} ===", flush=True)
    r = subprocess.run(cmd, cwd=RAIZ)
    if r.returncode != 0 and titulo != "Validación":
        sys.exit(f"Falló el paso «{titulo}».")
print("\nListo. Revise el reporte de validación antes de publicar.")
