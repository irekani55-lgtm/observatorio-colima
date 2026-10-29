"""
Prepara la entrega de datos en CSV, numerados en orden, a partir de public/datos/oficial/.

Uso:  python scripts/importar/exportar_entrega.py
Salida: entrega/asistencias/ (y un .zip con lo mismo)

Los CSV se escriben en UTF-8 con BOM para que Excel muestre bien los acentos.
El resumen usa la misma fórmula que el observatorio:
  asistencia (%) = asistencias ÷ (asistencias + ausencias + justificadas) × 100
  en sesiones del Pleno (cuenta_para_asistencia = si); pendientes, no verificados y
  sesiones sin registro quedan fuera del denominador y nunca cuentan como ausencia.
"""
from __future__ import annotations

import csv
import shutil
from collections import Counter, defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / "public" / "datos" / "oficial"
DESTINO = RAIZ / "entrega" / "asistencias"

ANIO = {"1": "Primer año (2024-2025)", "2": "Segundo año (2025-2026)", "3": "Tercer año (2026-2027)"}
PERIODO = {"primer_ordinario": "Primer periodo ordinario", "segundo_ordinario": "Segundo periodo ordinario", "primer_receso": "Primer periodo de receso",
           "segundo_receso": "Segundo periodo de receso", "extraordinario": "Periodo extraordinario", "otro": "Otro"}
TIPO = {"ordinaria": "Ordinaria", "extraordinaria": "Extraordinaria", "solemne": "Solemne", "permanente": "Comisión Permanente", "otro": "Otro"}
ESTADO = {"asistencia": "Asistencia registrada", "ausencia": "Ausencia registrada", "justificada": "Ausencia justificada", "pendiente": "Información pendiente", "no_verificado": "Registro no verificado"}
REP = {"MR": "Mayoría relativa", "RP": "Representación proporcional"}


def leer(nombre: str) -> list[dict]:
    with open(ORIGEN / f"{nombre}.csv", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def escribir(nombre: str, filas: list[dict], columnas: list[str]) -> None:
    with open(DESTINO / nombre, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=columnas, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)
    print(f"  {nombre}: {len(filas)} filas")


def en_funciones(d: dict, fecha: str) -> bool:
    """Misma regla que el observatorio: dentro de su periodo y fuera de licencias."""
    if d.get("fecha_inicio") and fecha < d["fecha_inicio"]:
        return False
    if d.get("fecha_fin") and fecha > d["fecha_fin"]:
        return False
    for tramo in filter(None, (x.strip() for x in d.get("licencias", "").split(";"))):
        desde, _, hasta = tramo.partition("/")
        if fecha >= desde and (not hasta or fecha <= hasta):
            return False
    return True


def main() -> None:
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True)
    dips = {d["id_diputado"]: d for d in leer("diputados")}
    partidos = {p["id_partido"]: p for p in leer("partidos")}
    sesiones = {s["id_sesion"]: s for s in leer("sesiones")}
    evid = {e["id_fuente"]: e for e in leer("evidencias")}
    asis = leer("asistencias")

    # 01 — detalle listo para dashboards (una fila por persona y sesión)
    detalle = []
    for a in asis:
        s, d = sesiones[a["id_sesion"]], dips.get(a["id_diputado"], {})
        detalle.append({
            "fecha": s["fecha"], "id_sesion": s["id_sesion"], "anio_legislativo": s["anio_legislativo"], "anio_legislativo_texto": ANIO.get(s["anio_legislativo"], ""),
            "periodo": PERIODO.get(s["periodo"], s["periodo"]), "tipo_sesion": TIPO.get(s["tipo_sesion"], s["tipo_sesion"]), "numero_sesion": s["numero_sesion"],
            "cuenta_para_asistencia_pleno": "Sí" if s["cuenta_para_asistencia"] == "si" else "No",
            "id_diputado": a["id_diputado"], "nombre": d.get("nombre_completo", ""), "partido": partidos.get(d.get("id_partido", ""), {}).get("siglas", d.get("id_partido", "")),
            "representacion": REP.get(d.get("tipo_representacion", ""), ""), "distrito": d.get("distrito", ""),
            "estado": a["estado"], "estado_texto": ESTADO.get(a["estado"], a["estado"]), "justificacion": a["justificacion"],
            "url_fuente": evid.get(a["id_fuente"] or s["id_fuente"], {}).get("url", ""), "notas": a["notas"],
        })
    detalle.sort(key=lambda x: (x["fecha"], x["id_sesion"], x["nombre"]))
    escribir("01_asistencias_detalle.csv", detalle, list(detalle[0].keys()))

    # 02 — resumen por persona y año legislativo (+ total)
    elegibles = [s for s in sesiones.values() if s["cuenta_para_asistencia"] == "si"]
    por = defaultdict(Counter)
    con_registro = defaultdict(set)
    for a in asis:
        s = sesiones[a["id_sesion"]]
        if s["cuenta_para_asistencia"] != "si" or not en_funciones(dips.get(a["id_diputado"], {}), s["fecha"]):
            continue
        for clave in (s["anio_legislativo"], "Total"):
            por[(a["id_diputado"], clave)][a["estado"]] += 1
            con_registro[(a["id_diputado"], clave)].add(a["id_sesion"])
    resumen = []
    for id_d, d in sorted(dips.items(), key=lambda x: (x[1]["tipo_representacion"], int(x[1]["distrito"] or 99), x[1]["nombre_completo"])):
        for clave in ("1", "2", "3", "Total"):
            ses = [s for s in elegibles if (clave == "Total" or s["anio_legislativo"] == clave) and en_funciones(d, s["fecha"])]
            c = por[(id_d, clave)]
            den = c["asistencia"] + c["ausencia"] + c["justificada"]
            sin_reg = len(ses) - len(con_registro[(id_d, clave)])
            fuera = c["pendiente"] + c["no_verificado"] + sin_reg
            resumen.append({
                "id_diputado": id_d, "nombre": d["nombre_completo"], "partido": partidos.get(d["id_partido"], {}).get("siglas", ""), "representacion": REP.get(d["tipo_representacion"], ""),
                "distrito": d["distrito"], "calidad": d["calidad"], "periodo_ejercicio": f"{d['fecha_inicio']} a {d['fecha_fin'] or 'la fecha'}" + (f" (licencia {d['licencias']})" if d.get("licencias") else ""), "periodo": ANIO.get(clave, "Toda la Legislatura (a la fecha de corte)"), "sesiones_elegibles": len(ses),
                "asistencias": c["asistencia"], "ausencias": c["ausencia"], "justificadas": c["justificada"], "pendientes": c["pendiente"], "no_verificados": c["no_verificado"], "sin_registro": sin_reg,
                "denominador": den, "porcentaje_asistencia": f"{c['asistencia'] / den * 100:.1f}" if den else "",
                "estado_calculo": "No calculable" if not den else ("Definitivo" if fuera == 0 else f"Provisional ({fuera} sesiones fuera del denominador)"),
            })
    escribir("02_asistencias_resumen_por_diputado.csv", resumen, list(resumen[0].keys()))

    # 03–08 — tablas normalizadas (las mismas que lee el observatorio)
    for i, nombre in enumerate(["asistencias", "sesiones", "diputados", "partidos", "distritos", "evidencias"], start=3):
        filas = leer(nombre)
        escribir(f"{i:02d}_{nombre}.csv", filas, list(filas[0].keys()) if filas else [])

    (DESTINO / "00_LEEME.txt").write_text(LEEME, encoding="utf-8")
    zip_ = shutil.make_archive(str(DESTINO.parent / "asistencias_LXI_legislatura"), "zip", DESTINO)
    print("Listo:", Path(zip_).relative_to(RAIZ))


LEEME = """ASISTENCIAS A SESIONES — LXI LEGISLATURA DEL H. CONGRESO DEL ESTADO DE COLIMA
Fuente: Gaceta Parlamentaria (listas de asistencia por sesión), directorio oficial del Congreso e IEE Colima.

ARCHIVOS (en orden)
01_asistencias_detalle.csv            Una fila por persona y sesión, con fecha, sesión, nombre, partido y estado. Listo para dashboards.
02_asistencias_resumen_por_diputado.csv  Porcentaje de asistencia al Pleno por persona, por año legislativo y total.
03_asistencias.csv                    Tabla normalizada (id_sesion + id_diputado + estado). La usa el observatorio.
04_sesiones.csv                       Catálogo de sesiones con ID único, año legislativo, periodo, tipo y número.
05_diputados.csv                      Catálogo de personas que han ejercido una curul: las 25 actuales, una persona titular con licencia
                                      y dos suplencias (ID, nombre, partido, MR/RP, distrito, foto, ficha oficial, licencias).
06_partidos.csv                       Catálogo de partidos.
07_distritos.csv                      16 distritos locales (redistritación 2022) con su demarcación y municipios.
08_evidencias.csv                     URL oficial de cada lista de asistencia y documento usado.

CÓMO SE RELACIONAN
id_sesion une asistencias con sesiones; id_diputado une asistencias con diputados.

FÓRMULA DE ASISTENCIA
asistencias ÷ (asistencias + ausencias + justificadas) × 100, solo en sesiones del Pleno (cuenta_para_asistencia = si).
Los registros pendientes o no verificados y las sesiones sin registro NO cuentan como ausencia: quedan fuera del cálculo
y el porcentaje se marca como provisional.

ESTADOS
asistencia     Presente según la lista oficial.
ausencia       Ausente sin justificación marcada.
justificada    Ausente con justificación marcada (la lista no publica el motivo).
pendiente      La lista no tiene ninguna marca para la persona.
no_verificado  Marcas contradictorias, o la página oficial mezcla dos sesiones de la misma fecha y no coinciden.

NOTAS
- Las sesiones de la Comisión Permanente (receso) se incluyen en 04_sesiones.csv pero no cuentan para la asistencia
  al Pleno, porque solo las integran algunas diputaciones; sus no integrantes no tienen registro.
- Cuando dos sesiones de la misma fecha y tipo comparten la página oficial, se indica en las notas de la sesión.
- La numeración de sesiones se reinicia cada año legislativo y cada receso; por eso cada sesión tiene un ID único.
- LICENCIAS Y SUPLENCIAS: la Gaceta muestra cada curul con el nombre de su titular actual, incluso en fechas en que
  esa persona estaba con licencia. Con base en los acuerdos 4, 6, 17, 29 y 67 de la LXI Legislatura, esos registros
  se asignan a la suplencia que ejercía el cargo (ver la columna notas). Los días de cambio quedan como no verificados.
  Las fechas de toma de protesta de las suplencias están pendientes de confirmar.
"""

if __name__ == "__main__":
    main()
