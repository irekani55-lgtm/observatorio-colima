"""
Prepara la entrega de datos en CSV, numerados en orden, a partir de public/datos/oficial/.

Uso:  python scripts/importar/exportar_entrega.py [asistencias|iniciativas|todo]
Salida: entrega/<bloque>/ (y un .zip por bloque)

Los CSV se escriben en UTF-8 con BOM para que Excel muestre bien los acentos.
El resumen usa la misma fórmula que el observatorio:
  asistencia (%) = asistencias ÷ (asistencias + ausencias + justificadas) × 100
  en sesiones del Pleno (cuenta_para_asistencia = si); pendientes, no verificados y
  sesiones sin registro quedan fuera del denominador y nunca cuentan como ausencia.
"""
from __future__ import annotations

import csv
import shutil
import sys
from collections import Counter, defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / "public" / "datos" / "oficial"
DESTINO = RAIZ / "entrega" / "asistencias"  # se reasigna por bloque

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


def bloque_asistencias() -> None:
    global DESTINO
    DESTINO = RAIZ / "entrega" / "asistencias"
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

ESTADO_ASUNTO = {"presentado": "Presentada", "turnado": "Turnada a comisión", "dictaminado": "Dictaminada", "aprobado": "Aprobada", "rechazado": "Rechazada o desechada",
                 "retirado": "Retirada", "publicado": "Aprobada y publicada", "pendiente": "Pendiente", "no_localizado": "Información no localizada", "no_verificado": "Estado no verificado"}


def bloque_iniciativas() -> None:
    global DESTINO
    DESTINO = RAIZ / "entrega" / "iniciativas"
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True)
    dips = {d["id_diputado"]: d for d in leer("diputados")}
    partidos = {p["id_partido"]: p for p in leer("partidos")}
    coms = {c["id_comision"]: c for c in leer("comisiones")}
    asuntos = leer("asuntos")
    prom = defaultdict(list)
    for p in leer("asunto_promoventes"):
        prom[p["id_asunto"]].append(p)
    turnos = defaultdict(list)
    for t in leer("asunto_comisiones"):
        turnos[t["id_asunto"]].append(t)
    anio = lambda a: a.get("anio_legislativo") or next((str(n) for n, i, f in [(1, "2024-10-01", "2025-09-30"), (2, "2025-10-01", "2026-09-30"), (3, "2026-10-01", "2027-09-30")] if a["fecha_presentacion"] and i <= a["fecha_presentacion"] <= f), "")
    inis = [a for a in asuntos if a["id_asunto"].startswith("INI-")]

    def nombre_prom(p):
        if p["id_diputado"]:
            d = dips.get(p["id_diputado"], {})
            return f"{d.get('nombre_completo', p['id_diputado'])} ({partidos.get(d.get('id_partido', ''), {}).get('siglas', '')})"
        return p["promovente_externo"]

    detalle = []
    for a in inis:
        ps = [p for p in prom[a["id_asunto"]] if p["rol"] in ("autor", "coautor")]
        detalle.append({
            "numero_iniciativa": int(a["id_asunto"][-3:]), "id_asunto": a["id_asunto"], "tipo": "Minuta" if a["tipo"] == "otro" else "Iniciativa",
            "fecha_presentacion": a["fecha_presentacion"], "anio_legislativo": anio(a), "anio_legislativo_texto": ANIO.get(anio(a), ""),
            "descripcion": a["descripcion"], "promoventes": "; ".join(nombre_prom(p) for p in ps),
            "tipo_promovente": "Diputación" if any(p["id_diputado"] for p in ps) else ("Externo" if ps else "Sin identificar"),
            "autoria": "Compartida" if len(ps) > 1 else ("Individual" if ps else ""),
            "comisiones": "; ".join(coms.get(t["id_comision"], {}).get("nombre", t["id_comision"]) for t in turnos[a["id_asunto"]]),
            "estado": a["estado_procesal"], "estado_texto": ESTADO_ASUNTO.get(a["estado_procesal"], a["estado_procesal"]), "resolucion": a["numero_decreto_acuerdo"],
            "fecha_aprobacion": a["fecha_aprobacion"], "fecha_publicacion": a["fecha_publicacion"], "url_documento": a["url_documento"],
            "verificacion": a["estado_verificacion"], "notas": a["notas"],
        })
    detalle.sort(key=lambda x: x["numero_iniciativa"])
    escribir("01_iniciativas_detalle.csv", detalle, list(detalle[0].keys()))

    # resumen por persona (solo iniciativas, no minutas), por año y total
    resumen = []
    for id_d, d in sorted(dips.items(), key=lambda x: (x[1]["tipo_representacion"], int(x[1]["distrito"] or 99), x[1]["nombre_completo"])):
        for clave in ("1", "2", "3", "Total"):
            suyas = [a for a in inis if a["tipo"] == "iniciativa" and any(p["id_diputado"] == id_d and p["rol"] in ("autor", "coautor") for p in prom[a["id_asunto"]])
                     and (clave == "Total" or anio(a) == clave)]
            comp = [a for a in suyas if len([p for p in prom[a["id_asunto"]] if p["rol"] in ("autor", "coautor")]) > 1]
            aprob = [a for a in suyas if a["estado_procesal"] in ("aprobado", "publicado")]
            resumen.append({"id_diputado": id_d, "nombre": d["nombre_completo"], "partido": partidos.get(d["id_partido"], {}).get("siglas", ""), "representacion": REP.get(d["tipo_representacion"], ""),
                            "distrito": d["distrito"], "periodo": ANIO.get(clave, "Toda la Legislatura (a la fecha de corte)"),
                            "presentadas": len(suyas), "individuales": len(suyas) - len(comp), "compartidas": len(comp), "aprobadas": len(aprob),
                            "aprobadas_individuales": len([a for a in aprob if a not in comp]), "aprobadas_compartidas": len([a for a in aprob if a in comp]),
                            "en_tramite": len([a for a in suyas if a["estado_procesal"] in ("presentado", "turnado", "dictaminado", "pendiente")]),
                            "rechazadas_o_retiradas": len([a for a in suyas if a["estado_procesal"] in ("rechazado", "retirado")]),
                            "con_autoria_por_verificar": len([a for a in suyas if a["estado_verificacion"] != "verificado"])})
    escribir("02_iniciativas_resumen_por_diputado.csv", resumen, list(resumen[0].keys()))

    filas_prom = [{"id_asunto": p["id_asunto"], "numero_iniciativa": int(p["id_asunto"][-3:]), "id_diputado": p["id_diputado"], "promovente": nombre_prom(p), "rol": p["rol"],
                   "partido": partidos.get(dips.get(p["id_diputado"], {}).get("id_partido", ""), {}).get("siglas", "") if p["id_diputado"] else ""}
                  for a in inis for p in prom[a["id_asunto"]]]
    escribir("03_iniciativas_promoventes.csv", filas_prom, list(filas_prom[0].keys()))
    filas_t = [{"id_asunto": t["id_asunto"], "numero_iniciativa": int(t["id_asunto"][-3:]), "id_comision": t["id_comision"], "comision": coms.get(t["id_comision"], {}).get("nombre", "")}
               for a in inis for t in turnos[a["id_asunto"]]]
    escribir("04_iniciativas_comisiones.csv", filas_t, list(filas_t[0].keys()))
    decretos = [{"numero_decreto": int(a["id_asunto"][-3:]), "id_asunto": a["id_asunto"], "descripcion": a["descripcion"], "fecha_aprobacion": a["fecha_aprobacion"],
                 "fecha_publicacion": a["fecha_publicacion"], "estado": ESTADO_ASUNTO.get(a["estado_procesal"], ""), "iniciativa_origen": a["id_asunto_origen"], "url_documento": a["url_documento"], "notas": a["notas"]}
                for a in asuntos if a["tipo"] == "decreto"]
    escribir("05_decretos.csv", decretos, list(decretos[0].keys()))
    for i, nombre in enumerate(["asuntos", "asunto_promoventes", "asunto_comisiones", "comisiones", "comision_integrantes", "diputados", "partidos"], start=6):
        filas = leer(nombre)
        escribir(f"{i:02d}_{nombre}.csv", filas, list(filas[0].keys()) if filas else [])
    (DESTINO / "00_LEEME.txt").write_text(LEEME_INI, encoding="utf-8")
    zip_ = shutil.make_archive(str(DESTINO.parent / "iniciativas_LXI_legislatura"), "zip", DESTINO)
    print("Listo:", Path(zip_).relative_to(RAIZ))


LEEME_INI = """INICIATIVAS Y DECRETOS — LXI LEGISLATURA DEL H. CONGRESO DEL ESTADO DE COLIMA
Fuentes: Gaceta Parlamentaria (listas de iniciativas, decretos y acuerdos; síntesis de comunicaciones y actas de sesión)
y página oficial de comisiones.

ARCHIVOS (en orden)
01_iniciativas_detalle.csv              Una fila por iniciativa (378), con promoventes, partido, comisiones, estado, decreto y fechas.
02_iniciativas_resumen_por_diputado.csv  Por persona y año legislativo: presentadas, individuales, compartidas, aprobadas, en trámite.
03_iniciativas_promoventes.csv          Una fila por iniciativa y promovente (formato largo, ideal para tablas dinámicas).
04_iniciativas_comisiones.csv           Una fila por iniciativa y comisión a la que se turnó.
05_decretos.csv                         Decretos de la LXI con fechas de aprobación y de publicación en el Periódico Oficial.
06–12                                   Tablas normalizadas que usa el observatorio (asuntos, promoventes, turnos, comisiones,
                                        integrantes de comisiones, diputados, partidos).

REGLAS
- Cada iniciativa aparece una sola vez, aunque tenga varios promoventes o comisiones.
- Individual = un solo promovente; compartida = dos o más. En el resumen por persona una iniciativa compartida cuenta
  para cada promovente; por eso la suma por persona es mayor que el total de iniciativas.
- Las minutas (reformas a la Constitución federal enviadas por el Congreso de la Unión) se marcan como "Minuta" y no
  cuentan como iniciativas de las diputaciones.
- Promoventes: solo se atribuye a las personas nombradas en la Gaceta. Si dice "y demás integrantes del grupo
  parlamentario", se registra al grupo como promovente colectivo (integrantes no nombrados) y la verificación queda pendiente.
- El autor que la Gaceta registra solo como «Estatal» se asume como Poder Ejecutivo del Estado (verificación pendiente).

FECHA DE PRESENTACIÓN
La lista oficial no trae fecha. Se tomó de la sesión en que se dio cuenta de la iniciativa (síntesis de comunicaciones o
acta), comparando textos. Solo se aceptan coincidencias claras y coherentes con la numeración consecutiva.
- Confirmada: la columna notas cita el documento de origen.
- Inferida: las iniciativas anterior y posterior se presentaron el mismo día (verificación pendiente).
- Solo año legislativo: la numeración la ubica entre dos fechas del mismo año; fecha_presentacion queda vacía.

ESTADOS
Turnada a comisión, Aprobada (por decreto o acuerdo), Aprobada y publicada (con fecha en el Periódico Oficial),
Rechazada o desechada, Retirada, Pendiente, Estado no verificado (p. ej. "archivada").
"""


def bloque_dictamenes() -> None:
    global DESTINO
    DESTINO = RAIZ / "entrega" / "dictamenes"
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True)
    coms = {c["id_comision"]: c for c in leer("comisiones")}
    asuntos = leer("asuntos")
    por_id = {a["id_asunto"]: a for a in asuntos}
    aux = RAIZ / "datos_crudos" / "congreso" / "dictamen_comisiones.csv"
    dc = defaultdict(list)
    if aux.exists():
        with open(aux, encoding="utf-8") as f:
            for r in csv.DictReader(f):
                dc[r["id_asunto"]].append(r["id_comision"])
    dic = [a for a in asuntos if a["tipo"] == "dictamen"]
    detalle = []
    for a in sorted(dic, key=lambda x: x["fecha_dictamen"]):
        o = por_id.get(a["id_asunto_origen"], {})
        anio = next((str(n) for n, i, f in [(1, "2024-10-01", "2025-09-30"), (2, "2025-10-01", "2026-09-30"), (3, "2026-10-01", "2027-09-30")] if i <= a["fecha_dictamen"] <= f), "")
        detalle.append({
            "id_asunto": a["id_asunto"], "numero_dictamen": a["expediente"].split(" (")[0].replace("Dictamen ", ""), "fecha_dictamen": a["fecha_dictamen"],
            "anio_legislativo": anio, "anio_legislativo_texto": ANIO.get(anio, ""), "comisiones_dictaminadoras": "; ".join(coms.get(c, {}).get("nombre", c) for c in dc[a["id_asunto"]]),
            "numero_comisiones": len(dc[a["id_asunto"]]), "descripcion": a["descripcion"], "estado": a["estado_procesal"], "estado_texto": ESTADO_ASUNTO.get(a["estado_procesal"], a["estado_procesal"]),
            "fecha_votacion_pleno": a["fecha_votacion"], "resultado_votacion": a["resultado_votacion"], "decreto": a["numero_decreto_acuerdo"], "fecha_publicacion": a["fecha_publicacion"],
            "iniciativa_origen": a["id_asunto_origen"], "iniciativa_origen_descripcion": o.get("descripcion", "")[:300],
            "dias_presentacion_a_dictamen": (lambda x, y: (__import__("datetime").date.fromisoformat(y) - __import__("datetime").date.fromisoformat(x)).days if x and y else "")(o.get("fecha_presentacion", ""), a["fecha_dictamen"]),
            "url_documento": a["url_documento"], "notas": a["notas"],
        })
    escribir("01_dictamenes_detalle.csv", detalle, list(detalle[0].keys()))
    resumen = []
    for c in sorted(coms.values(), key=lambda x: x["nombre"]):
        suyos = [d for d in detalle if c["nombre"] in d["comisiones_dictaminadoras"].split("; ")]
        for clave in ("1", "2", "3", "Total"):
            sel = [d for d in suyos if clave == "Total" or d["anio_legislativo"] == clave]
            dias_ = sorted(d["dias_presentacion_a_dictamen"] for d in sel if d["dias_presentacion_a_dictamen"] != "")
            med = (dias_[len(dias_) // 2] if len(dias_) % 2 else (dias_[len(dias_) // 2 - 1] + dias_[len(dias_) // 2]) / 2) if dias_ else ""
            resumen.append({"id_comision": c["id_comision"], "comision": c["nombre"], "periodo": ANIO.get(clave, "Toda la Legislatura (a la fecha de corte)"), "dictamenes": len(sel),
                            "individuales": len([d for d in sel if d["numero_comisiones"] == 1]), "conjuntos": len([d for d in sel if d["numero_comisiones"] > 1]),
                            "aprobados_pleno": len([d for d in sel if d["estado"] in ("aprobado", "publicado")]), "sin_votacion_localizada": len([d for d in sel if d["estado"] == "pendiente"]),
                            "mediana_dias_presentacion_a_dictamen": med, "casos_con_fechas": len(dias_)})
    escribir("02_dictamenes_resumen_por_comision.csv", resumen, list(resumen[0].keys()))
    filas = [{"id_asunto": k, "id_comision": c, "comision": coms.get(c, {}).get("nombre", "")} for k, v in dc.items() for c in v]
    escribir("03_dictamen_comisiones.csv", filas, ["id_asunto", "id_comision", "comision"])
    (DESTINO / "00_LEEME.txt").write_text(LEEME_DIC, encoding="utf-8")
    zip_ = shutil.make_archive(str(DESTINO.parent / "dictamenes_LXI_legislatura"), "zip", DESTINO)
    print("Listo:", Path(zip_).relative_to(RAIZ))


LEEME_DIC = """DICTÁMENES — LXI LEGISLATURA DEL H. CONGRESO DEL ESTADO DE COLIMA
Fuentes: Gaceta Parlamentaria (lista de dictámenes, decretos e iniciativas) y actas de sesión (votaciones).

ARCHIVOS (en orden)
01_dictamenes_detalle.csv             Un dictamen por fila (250): comisiones, fecha, estado, votación en el Pleno, decreto
                                      e iniciativa que resuelve; días entre la presentación de la iniciativa y el dictamen.
02_dictamenes_resumen_por_comision.csv  Por comisión y año: dictámenes, individuales y conjuntos, aprobados por el Pleno
                                      y mediana de días de la presentación al dictamen (con el número de casos medibles).
03_dictamen_comisiones.csv            Una fila por dictamen y comisión dictaminadora.

CÓMO SE RELACIONÓ
- Comisiones: columna «Comisión dictaminadora» de la Gaceta (se toleran erratas del original).
- Votación: segmento del acta donde se dio lectura al dictamen con el mismo número, de alguna de sus comisiones, en
  los 150 días siguientes. Se toman el resultado y los totales oficiales que declara el acta.
- Decreto e iniciativa: comparación de los textos oficiales, solo cuando la coincidencia es clara y las fechas son
  coherentes (el decreto se aprueba el mismo día que se vota el dictamen; la iniciativa se presenta antes).
- La numeración de dictámenes es propia de cada comisión: un «Dictamen 1» puede existir en varias comisiones.

ESTADOS
Aprobada y publicada / Aprobada: votación aprobatoria en el acta o decreto relacionado.
Pendiente: no se localizó su votación en las actas ni un decreto relacionado (no significa que no se haya votado).

LIMITACIONES
- Un dictamen sin iniciativa relacionada puede resolver otro tipo de asunto (licencias, preseas, cuentas públicas).
- Cuando el Pleno conoció una iniciativa en la misma sesión en que votó su dictamen (trámite abreviado), la fecha
  exacta de recepción no se publica y la iniciativa conserva solo su año legislativo.
"""


if __name__ == "__main__":
    bloque = sys.argv[1] if len(sys.argv) > 1 else "todo"
    if bloque in ("dictamenes", "todo"):
        bloque_dictamenes()
    if bloque in ("asistencias", "todo"):
        bloque_asistencias()
    if bloque in ("iniciativas", "todo"):
        bloque_iniciativas()
