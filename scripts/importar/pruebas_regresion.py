"""
Pruebas de regresión de la base oficial: cada error que ya se encontró y corrigió se convierte en una comprobación,
para que una nueva importación no lo vuelva a introducir. Si alguna falla, el proceso de actualización se detiene.

Uso: python scripts/importar/pruebas_regresion.py
"""
from __future__ import annotations

import sys
import json
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from congreso_asuntos import leer_csv  # noqa: E402

fallas: list[str] = []


def comprobar(condicion: bool, mensaje: str) -> None:
    print(("  ok    " if condicion else "  FALLA ") + mensaje)
    if not condicion:
        fallas.append(mensaje)


def main() -> None:
    asuntos = {a["id_asunto"]: a for a in leer_csv("asuntos")}
    diputados = {d["id_diputado"]: d for d in leer_csv("diputados")}
    asis = {(a["id_sesion"], a["id_diputado"]): a for a in leer_csv("asistencias")}
    evid = {e["id_fuente"]: e for e in leer_csv("evidencias")}
    votaciones = {v["id_votacion"]: v for v in leer_csv("votaciones")}
    votos = {(x["id_votacion"], x["id_diputado"]): x for x in leer_csv("votos")}
    inferidos = leer_csv("votos_inferidos")
    obs = {o["id_observacion"]: o for o in leer_csv("observaciones")}
    promov = Counter(p["id_asunto"] for p in leer_csv("asunto_promoventes"))

    print("Exhortos y puntos de acuerdo")
    comprobar("PA-61-A20241204-1" not in asuntos, "La comparecencia del 4 dic 2024 no se registra como exhorto (OBS-EXH-01)")
    comprobar(asuntos.get("PA-61-A20260715-2", {}).get("estado_procesal") == "rechazado", "«se desecha el exhorto» del 15 jul 2026 se lee como rechazado (OBS-EXH-02)")
    comprobar(asuntos.get("PA-61-A20260128-1", {}).get("estado_procesal") == "rechazado", "«se desecha por no alcanzar la votación» del 28 ene 2026 se lee como rechazado (OBS-EXH-03)")

    print("Licencias y suplencias")
    comprobar(diputados.get("DIP-133", {}).get("licencias") == "2025-01-16/2026-10-15", "Diana Zepeda: licencia hasta el 15 oct 2026; reincorporación el 16 oct (Acuerdo 67)")
    comprobar(("S-A3-PO1-ORD-002", "DIP-S09") in asis and ("S-A3-PO1-ORD-002", "DIP-133") not in asis, "14 oct 2026: la curul del distrito 9 la ocupa la suplente Alma Yesenia Ventura")
    comprobar(asis.get(("S-A1-PO1-ORD-001", "DIP-RP-JCLT"), {}).get("estado") == "justificada", "2 oct 2024, Ordinaria 01: Julio César León Trujillo con falta justificada (acta)")
    comprobar(asis.get(("S-A1-PO1-ORD-002", "DIP-148"), {}).get("estado") == "asistencia", "2 oct 2024, Ordinaria 02: Alfredo Álvarez Ramírez presente tras rendir protesta (acta)")
    for n, archivo in ((4, "Acuerdo_04_61.pdf"), (6, "Acuerdo_06_61.pdf"), (29, "ACUERDO_29_61.pdf")):
        comprobar(evid.get(f"EV-ACUERDO-{n}", {}).get("url", "").endswith(archivo), f"Enlace correcto al Acuerdo {n} ({archivo})")
    comprobar("art. 24, fr. II" in diputados.get("DIP-137", {}).get("notas", ""), "Licencia de Isamar Ramírez con su motivo (art. 24, fr. II)")
    jigm, aepp = diputados.get("DIP-142", {}), diputados.get("DIP-RP-AEPP", {})
    comprobar(jigm.get("nombre_completo") == "José Israel González Mendoza" and jigm.get("licencias") == "2026-11-01/2027-01-01",
              "DIP-142 sigue siendo José Israel González Mendoza, con licencia del 1 nov 2026 al 1 ene 2027 (Acuerdo 69)")
    comprobar(aepp.get("nombre_completo") == "Alfredo Eduardo Pimienta Pelayo" and aepp.get("fecha_inicio") == "2026-11-04" and aepp.get("id_titular") == "DIP-142",
              "Alfredo Eduardo Pimienta Pelayo entra el 4 nov 2026 (protesta en la Ordinaria 04) en lugar de José Israel González Mendoza")
    comprobar(evid.get("EV-ACUERDO-69", {}).get("url", "").endswith("Acuerdo_69_61.pdf"), "Enlace correcto al Acuerdo 69 (Acuerdo_69_61.pdf)")
    comprobar(sum(1 for (_, d) in votos if d == "DIP-142") >= 382, "José Israel González Mendoza conserva sus votos anteriores a la licencia")

    print("Iniciativas")
    comprobar(asuntos.get("DEC-61-377", {}).get("fecha_aprobacion") == "2026-10-28" and asuntos.get("INI-61-363", {}).get("fecha_aprobacion") == "2026-10-28",
              "Decreto 377 aprobado el 28 oct 2026, según el propio decreto (la lista de la Gaceta dice 28 nov; OBS-DEC-02)")
    comprobar(promov.get("INI-61-224", 0) == 5, "INI-61-224 tiene sus cinco autores, tomados del documento (OBS-INI-01)")

    print("Votaciones")
    # Las claves no cambian cuando el Congreso publica actas nuevas (numeración fija de documentos).
    numeracion = json.load(open(Path(__file__).parent / "numeracion_documentos.json", encoding="utf-8"))
    comprobar(all(len(set(v.values())) == len(v) for v in numeracion.values()), "La numeración fija de actas y síntesis no repite números")
    comprobar(numeracion.get("actas", {}).get("Acta de la Sesión Pública Solemne 01 de Instalación del Primer Periodo Ordinario de Sesiones del Primer año de Ejercicio Constitucional de fecha 01 de octubre de 2024.") == 161,
              "El acta de instalación (1 oct 2024) conserva su número 161")
    comprobar(votaciones.get("VOT-61-20241213-139-02", {}).get("cuadre") == "coincide" and ("VOT-61-20241213-139-02", "DIP-S13") in votos,
              "«Sharon Monserrat Díaz García, favor» (sin la «a») se lee como voto a favor")
    comprobar(votaciones.get("VOT-61-20241204-141-01", {}).get("cuadre") == "faltan_nombres" and not any(x["id_votacion"] == "VOT-61-20241204-141-01" for x in inferidos),
              "4 dic 2024: el total contradice el pase de lista; no se asignan votos")
    comprobar(all(x["confianza"] == "alta" for x in inferidos), "Solo se registran votos probables con confianza alta")
    comprobar(all((x["id_votacion"], x["id_diputado"]) not in votos for x in inferidos), "Ningún voto probable duplica un voto escrito en el acta")
    nominales = [v for v in votaciones.values() if v["tipo_votacion"] == "nominal" and v["total_favor"] != ""]
    comprobar(all(v["cuadre"] for v in nominales), "Toda votación nominal tiene cuadre calculado")
    comprobar(all(v["id_observacion"] in obs for v in nominales if v["cuadre"] != "coincide"), "Toda votación que no cuadra tiene su observación en la bitácora")

    print("Asistencias")
    estados = Counter(a["estado"] for a in asis.values())
    comprobar(estados["no_verificado"] + estados["pendiente"] <= 10, f"Registros sin verificar acotados (hay {estados['no_verificado'] + estados['pendiente']})")
    comprobar(asis.get(("S-A1-PO1-SOL-005", "DIP-145"), {}).get("estado") == "asistencia", "26 nov 2024: Jaime Sotelo presente según el acta (sin marca en la Gaceta)")

    print("Mapa")
    geo = json.load(open(Path(__file__).resolve().parents[2] / "public" / "geo" / "distritos_locales.geojson", encoding="utf-8"))
    nums = sorted(int(f["properties"]["distrito_l"]) for f in geo["features"])
    comprobar(nums == list(range(1, 17)), "La cartografía tiene exactamente los distritos 1 a 16, uno por polígono")
    import csv as _csv
    with open(Path(__file__).resolve().parents[2] / "public" / "geo" / "secciones_distrito.csv", encoding="utf-8") as fh:
        secs = list(_csv.DictReader(fh))
    vig = [x for x in secs if x["distrito"]]
    comprobar(len(secs) == len({x["seccion"] for x in secs}) and {int(x["distrito"]) for x in vig} == set(range(1, 17)),
              f"Buscador por sección: {len(secs)} secciones únicas que cubren los 16 distritos")
    s20 = next((x for x in secs if x["seccion"] == "20"), {})
    comprobar(s20.get("distrito_2024") == "2" and s20.get("distrito") == "1", "Sección 0020: distrito 2 en 2024 y 1 en la cartografía vigente (PREP 2024)")
    comprobar(sum(1 for x in secs if x["situacion"] == "cambio_distrito") == 1 and sum(1 for x in secs if x["situacion"] == "solo_2024") == 7,
              "Solo una sección cambió de distrito y las 7 de 2024 que ya no existen siguen localizables")
    comprobar(sum(1 for a in leer_csv("asunto_comisiones") if a["id_asunto"].startswith("DIC-")) > 200, "Cada dictamen registra la comisión que lo elaboró")
    comprobar("OBS-GEO-01" in obs, "La versión de la cartografía está documentada en la bitácora (OBS-GEO-01)")

    print("Bitácora")
    for oid in ("OBS-GEO-01", "OBS-LIC-01", "OBS-LIC-03", "OBS-LIC-04", "OBS-EXH-01", "OBS-EXH-02", "OBS-EXH-03", "OBS-INI-01", "OBS-ASI-04"):
        comprobar(obs.get(oid, {}).get("estado") == "resuelta", f"{oid} registrada como resuelta")
    comprobar(all(o["estado"] in ("abierta", "resuelta") for o in obs.values()), "Estados válidos en la bitácora")

    if fallas:
        sys.exit(f"\n{len(fallas)} prueba(s) de regresión fallaron.")
    print("\nTodas las pruebas de regresión pasaron.")


if __name__ == "__main__":
    main()
