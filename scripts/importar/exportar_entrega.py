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
from collections import Counter, defaultdict  # noqa: F401
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


_NOMBRES: dict[str, str] = {}


def nombre_de(id_d: str) -> str:
    if not _NOMBRES:
        _NOMBRES.update({d["id_diputado"]: d["nombre_completo"] for d in leer("diputados")})
    return _NOMBRES.get(id_d, "")


def escribir(nombre: str, filas: list[dict], columnas: list[str]) -> None:
    # Junto a cada columna de ID de persona se agrega el nombre correspondiente (id_diputado → nombre_diputado,
    # id_titular → nombre_titular), para leer los archivos sin cruzar tablas.
    columnas = list(columnas)
    for col_id, col_nombre in (("id_diputado", "nombre_diputado"), ("id_titular", "nombre_titular")):
        if col_id in columnas and col_nombre not in columnas and not (col_id == "id_diputado" and "nombre_completo" in columnas):
            i = columnas.index(col_id)
            if i + 1 < len(columnas) and columnas[i + 1] == "nombre":  # ya había una columna «nombre»: se renombra
                columnas[i + 1] = col_nombre
                filas = [{**{k: v for k, v in f.items() if k != "nombre"}, col_nombre: f.get("nombre", "")} for f in filas]
            else:
                columnas.insert(i + 1, col_nombre)
                filas = [{**f, col_nombre: nombre_de(f.get(col_id, ""))} for f in filas]
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
            "url_fuente": evid.get(a["id_fuente"] or s["id_fuente"], {}).get("url", ""), "notas": a["notas"], "observaciones": a.get("observaciones", ""),
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


SEGUIMIENTO = {"en_tramite": "En trámite legislativo", "no_aprobado": "No aprobado", "pendiente_seguimiento": "Pendiente de seguimiento",
               "sin_respuesta_localizada": "Sin respuesta localizada", "con_respuesta": "Respuesta oficial localizada", "con_acciones": "Acciones posteriores documentadas", "no_verificado": "No verificado"}


def seguimiento_de(a: dict, e: dict | None) -> str:
    """Misma regla que el observatorio (src/indicadores/exhortos.ts)."""
    if a["estado_procesal"] == "rechazado":
        return "no_aprobado"
    if a["estado_procesal"] not in ("aprobado", "publicado"):
        return "en_tramite"
    if not e:
        return "pendiente_seguimiento"
    if e["verificacion_seguimiento"] == "no_verificado":
        return "no_verificado"
    if e.get("acciones_posteriores"):
        return "con_acciones"
    return {"si": "con_respuesta", "no": "sin_respuesta_localizada"}.get(e["respuesta_localizada"], "pendiente_seguimiento")


def bloque_exhortos() -> None:
    global DESTINO
    DESTINO = RAIZ / "entrega" / "exhortos"
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True)
    dips = {d["id_diputado"]: d for d in leer("diputados")}
    partidos = {p["id_partido"]: p for p in leer("partidos")}
    asuntos = {a["id_asunto"]: a for a in leer("asuntos")}
    exh = {e["id_asunto"]: e for e in leer("exhortos")}
    prom = defaultdict(list)
    for p in leer("asunto_promoventes"):
        prom[p["id_asunto"]].append(p)
    nombre = lambda p: (f"{dips[p['id_diputado']]['nombre_completo']} ({partidos.get(dips[p['id_diputado']]['id_partido'], {}).get('siglas', '')})" if p["id_diputado"] in dips else p["promovente_externo"])
    anio = lambda f: next((str(n) for n, i, j in [(1, "2024-10-01", "2025-09-30"), (2, "2025-10-01", "2026-09-30"), (3, "2026-10-01", "2027-09-30")] if f and i <= f <= j), "")
    pas = [a for a in asuntos.values() if a["id_asunto"].startswith("PA-")]
    filas = []
    for a in sorted(pas, key=lambda x: x["fecha_presentacion"]):
        e = exh.get(a["id_asunto"])
        sg = seguimiento_de(a, e) if a["tipo"] == "exhorto" else ""
        filas.append({"id_asunto": a["id_asunto"], "tipo": "Exhorto" if a["tipo"] == "exhorto" else "Punto de acuerdo", "fecha_presentacion": a["fecha_presentacion"], "anio_legislativo": anio(a["fecha_presentacion"]),
                      "descripcion": a["descripcion"], "promoventes": "; ".join(nombre(p) for p in prom[a["id_asunto"]]), "autoridad_destinataria": e["autoridad_destinataria"] if e else "",
                      "orden_gobierno": e["orden_gobierno"] if e else "", "estado": a["estado_procesal"], "estado_texto": ESTADO_ASUNTO.get(a["estado_procesal"], a["estado_procesal"]),
                      "fecha_aprobacion": a["fecha_aprobacion"], "respuesta_localizada": {"si": "Sí", "no": "No"}.get(e["respuesta_localizada"], "") if e else "", "fecha_respuesta": e["fecha_respuesta"] if e else "",
                      "seguimiento": SEGUIMIENTO.get(sg, ""), "fuente": a["url_documento"] or a["url_ficha"], "notas": a["notas"] + (" " + e["notas"] if e and e.get("notas") else "")})
    escribir("01_exhortos_y_puntos_de_acuerdo.csv", filas, list(filas[0].keys()))
    import json as _json
    resp = _json.loads((RAIZ / "datos_crudos" / "congreso" / "respuestas_exhortos.json").read_text(encoding="utf-8")) if (RAIZ / "datos_crudos" / "congreso" / "respuestas_exhortos.json").exists() else []
    filas_r = [{"fecha_sintesis": r["fecha_sintesis"], "fecha_oficio": r["fecha_oficio"], "exhorto_relacionado": r.get("_asignada") or "", "texto": r["texto"], "fuente": r["url"]} for r in resp]
    escribir("02_respuestas_de_autoridades.csv", filas_r, ["fecha_sintesis", "fecha_oficio", "exhorto_relacionado", "texto", "fuente"])
    acuerdos = [{"numero": int(a["id_asunto"][-3:]), "id_asunto": a["id_asunto"], "fecha_aprobacion": a["fecha_aprobacion"], "descripcion": a["descripcion"], "iniciativa_origen": a["id_asunto_origen"], "url_documento": a["url_documento"]}
                for a in asuntos.values() if a["id_asunto"].startswith("ACU-")]
    escribir("03_acuerdos_parlamentarios.csv", sorted(acuerdos, key=lambda x: x["numero"]), ["numero", "id_asunto", "fecha_aprobacion", "descripcion", "iniciativa_origen", "url_documento"])
    resumen = []
    for id_d, d in sorted(dips.items(), key=lambda x: x[1]["nombre_completo"]):
        suyos = [f for f in filas if any(p["id_diputado"] == id_d for p in prom[f["id_asunto"]])]
        ex = [f for f in suyos if f["tipo"] == "Exhorto"]
        resumen.append({"id_diputado": id_d, "nombre": d["nombre_completo"], "partido": partidos.get(d["id_partido"], {}).get("siglas", ""), "puntos_de_acuerdo_y_exhortos": len(suyos),
                        "exhortos_presentados": len(ex), "exhortos_aprobados": len([f for f in ex if f["estado"] in ("aprobado", "publicado")]), "exhortos_no_aprobados": len([f for f in ex if f["estado"] == "rechazado"]),
                        "exhortos_con_respuesta_localizada": len([f for f in ex if f["respuesta_localizada"] == "Sí"])})
    escribir("04_resumen_por_diputado.csv", resumen, list(resumen[0].keys()))
    ex = [f for f in filas if f["tipo"] == "Exhorto"]
    apro = [f for f in ex if f["estado"] in ("aprobado", "publicado")]
    ind = [("Exhortos presentados", len(ex), ""), ("Exhortos aprobados", len(apro), f"de {len(ex)}"), ("Exhortos no aprobados", len([f for f in ex if f["estado"] == "rechazado"]), ""),
           ("Exhortos con resultado no localizado", len([f for f in ex if f["estado"] in ("pendiente", "turnado")]), ""),
           ("Exhortos enviados a la autoridad", "", "Las fuentes revisadas no publican los oficios de envío"),
           ("Exhortos con respuesta oficial localizada", len([f for f in apro if f["respuesta_localizada"] == "Sí"]), f"de {len(apro)} aprobados"),
           ("Exhortos sin respuesta localizada", len([f for f in apro if f["respuesta_localizada"] == "No"]), "No equivale a incumplimiento"),
           ("Exhortos con acciones posteriores documentadas", 0, "No se localizaron documentos de seguimiento")]
    escribir("05_indicadores_exhortos.csv", [{"indicador": a, "valor": b, "nota": c} for a, b, c in ind], ["indicador", "valor", "nota"])
    (DESTINO / "00_LEEME.txt").write_text(LEEME_EXH, encoding="utf-8")
    zip_ = shutil.make_archive(str(DESTINO.parent / "exhortos_LXI_legislatura"), "zip", DESTINO)
    print("Listo:", Path(zip_).relative_to(RAIZ))


LEEME_EXH = """EXHORTOS, PUNTOS DE ACUERDO Y ACUERDOS — LXI LEGISLATURA DEL H. CONGRESO DEL ESTADO DE COLIMA
Fuentes: Gaceta Parlamentaria (listas de acuerdos y de puntos de acuerdo), actas de sesión (presentación y resultado
en el Pleno) y síntesis de comunicaciones (oficios de autoridades que responden a puntos de acuerdo).

ARCHIVOS (en orden)
01_exhortos_y_puntos_de_acuerdo.csv  Cada punto de acuerdo o exhorto: promoventes, autoridad destinataria, orden de gobierno,
                                     resultado en el Pleno, respuesta de la autoridad y estado de seguimiento.
02_respuestas_de_autoridades.csv     Oficios de respuesta encontrados en las síntesis y el exhorto con que se relacionaron.
03_acuerdos_parlamentarios.csv       Los acuerdos de la LXI (premios, designaciones, recintos, prórrogas, etc.).
04_resumen_por_diputado.csv          Por persona: exhortos presentados, aprobados, no aprobados y con respuesta localizada.
05_indicadores_exhortos.csv          Indicadores generales con su nota.

IMPORTANTE
- Que el Congreso apruebe un exhorto no significa que la autoridad lo haya atendido.
- «Sin respuesta localizada»: no se encontró respuesta en las síntesis de comunicaciones revisadas (107 de 113
  publicadas). No significa que la autoridad no haya respondido ni que haya incumplido.
- La fecha de envío del oficio a la autoridad no se publica en estas fuentes; el indicador de envío queda sin dato.
- Exhorto = punto de acuerdo que solicita a una autoridad realizar o informar sobre una acción.
- El resultado se toma de la frase con que el acta lo declara («se aprueba», «fue desechado», «se turnó a comisión»).
- Los puntos de acuerdo que se presentan sin pasar por tribuna (directamente a comisión) pueden no aparecer en las actas.
"""


def bloque_votaciones() -> None:
    global DESTINO
    DESTINO = RAIZ / "entrega" / "votaciones"
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True)
    dips = {d["id_diputado"]: d for d in leer("diputados")}
    partidos = {p["id_partido"]: p for p in leer("partidos")}
    sesiones = {x["id_sesion"]: x for x in leer("sesiones")}
    asuntos = {a["id_asunto"]: a for a in leer("asuntos")}
    evid = {e["id_fuente"]: e for e in leer("evidencias")}
    vots = leer("votaciones")
    votos = leer("votos")
    por_v = defaultdict(Counter)
    for v in votos:
        por_v[v["id_votacion"]][v["sentido"]] += 1
    fecha_de = {}
    filas = []
    for v in vots:
        s_ = sesiones.get(v["id_sesion"], {})
        a = asuntos.get(v["id_asunto"], {})
        fecha = s_.get("fecha") or a.get("fecha_votacion", "")
        fecha_de[v["id_votacion"]] = fecha
        c = por_v[v["id_votacion"]]
        cuadra = "" if v["tipo_votacion"] != "nominal" or v["total_favor"] == "" else ("Sí" if (c["favor"], c["contra"], c["abstencion"]) == (int(v["total_favor"]), int(v["total_contra"]), int(v["total_abstencion"])) else "No")
        filas.append({"id_votacion": v["id_votacion"], "fecha": fecha, "id_sesion": v["id_sesion"], "sesion": s_.get("notas", "")[:160], "descripcion": v["descripcion"],
                      "id_asunto": v["id_asunto"], "asunto": a.get("titulo", "")[:250], "tipo_votacion": "Nominal" if v["tipo_votacion"] == "nominal" else "Económica",
                      "resultado": v["resultado"], "total_favor": v["total_favor"], "total_contra": v["total_contra"], "total_abstencion": v["total_abstencion"],
                      "votos_leidos_favor": c["favor"], "votos_leidos_contra": c["contra"], "votos_leidos_abstencion": c["abstencion"], "lista_cuadra_con_total": cuadra,
                      "votos_sin_nombre_en_acta": v.get("votos_sin_nombre", ""), "cuadre": v.get("cuadre", ""), "observaciones": v.get("observaciones", ""),
                      "id_observacion": v.get("id_observacion", ""), "url_acta": evid.get(v["id_fuente"], {}).get("url", "")})
    filas.sort(key=lambda x: (x["fecha"], x["id_votacion"]))
    escribir("01_votaciones.csv", filas, list(filas[0].keys()))
    detalle = []
    for v in votos:
        d = dips.get(v["id_diputado"], {})
        vv = next((f for f in filas if f["id_votacion"] == v["id_votacion"]), {})
        detalle.append({"fecha": fecha_de.get(v["id_votacion"], ""), "id_votacion": v["id_votacion"], "id_diputado": v["id_diputado"], "nombre": d.get("nombre_completo", ""),
                        "partido": partidos.get(d.get("id_partido", ""), {}).get("siglas", ""), "sentido": {"favor": "A favor", "contra": "En contra", "abstencion": "Abstención"}.get(v["sentido"], v["sentido"]),
                        "asunto": vv.get("asunto") or vv.get("descripcion", ""), "resultado_general": vv.get("resultado", "")})
    detalle.sort(key=lambda x: (x["fecha"], x["id_votacion"], x["nombre"]))
    escribir("02_votos_por_diputado_detalle.csv", detalle, list(detalle[0].keys()))
    resumen = []
    for id_d, d in sorted(dips.items(), key=lambda x: x[1]["nombre_completo"]):
        for clave in ("1", "2", "3", "Total"):
            mios = [x for x in detalle if x["id_diputado"] == id_d and (clave == "Total" or next((str(n) for n, i, f in [(1, "2024-10-01", "2025-09-30"), (2, "2025-10-01", "2026-09-30"), (3, "2026-10-01", "2027-09-30")] if i <= x["fecha"] <= f), "") == clave)]
            c = Counter(x["sentido"] for x in mios)
            resumen.append({"id_diputado": id_d, "nombre": d["nombre_completo"], "partido": partidos.get(d["id_partido"], {}).get("siglas", ""), "periodo": ANIO.get(clave, "Toda la Legislatura (a la fecha de corte)"),
                            "votos_registrados": len(mios), "a_favor": c["A favor"], "en_contra": c["En contra"], "abstenciones": c["Abstención"],
                            "votos_distintos_al_resultado": len([x for x in mios if (x["resultado_general"] == "aprobado" and x["sentido"] != "A favor") or (x["resultado_general"] == "rechazado" and x["sentido"] == "A favor")])})
    escribir("03_resumen_por_diputado.csv", resumen, list(resumen[0].keys()))
    for i, nombre in enumerate(["votaciones", "votos"], start=4):
        f_ = leer(nombre)
        escribir(f"{i:02d}_{nombre}.csv", f_, list(f_[0].keys()))
    inferidos = []
    for x in leer("votos_inferidos"):
        d = dips.get(x["id_diputado"], {})
        inferidos.append({"fecha": fecha_de.get(x["id_votacion"], ""), **x, "nombre": d.get("nombre_completo", ""), "partido": partidos.get(d.get("id_partido", ""), {}).get("siglas", "")})
    escribir("06_votos_probables_inferidos.csv", inferidos, ["fecha", "id_votacion", "id_diputado", "nombre", "partido", "sentido", "confianza", "fundamento", "id_observacion", "id_fuente"])
    nominales = [v for v in vots if v["tipo_votacion"] == "nominal" and v["total_favor"] != ""]
    cuadre = Counter(v.get("cuadre", "") for v in nominales)
    conf = Counter(o["confianza"] for o in leer("observaciones") if o["tabla"] == "votaciones" and o["confianza"])
    (DESTINO / "00_LEEME.txt").write_text(LEEME_VOT.format(nominales=len(nominales), coincide=cuadre["coincide"], distintas=len(nominales) - cuadre["coincide"],
                                                         alta=conf["alta"], media=conf["media"], baja=conf["baja"], inferidos=len(inferidos)), encoding="utf-8")
    zip_ = shutil.make_archive(str(DESTINO.parent / "votaciones_LXI_legislatura"), "zip", DESTINO)
    print("Listo:", Path(zip_).relative_to(RAIZ))


LEEME_VOT = """VOTACIONES DEL PLENO — LXI LEGISLATURA DEL H. CONGRESO DEL ESTADO DE COLIMA
Fuente: actas de sesión publicadas en la Gaceta Parlamentaria.

ARCHIVOS (en orden)
01_votaciones.csv                 Una fila por votación: fecha, sesión, asunto votado, tipo (nominal o económica), resultado,
                                  totales oficiales declarados en el acta, votos leídos de la lista, si ambos cuadran,
                                  votos sin nombre en el acta y la observación del Observatorio.
02_votos_por_diputado_detalle.csv Una fila por persona y votación nominal: sentido del voto TAL COMO LO ESCRIBE EL ACTA.
03_resumen_por_diputado.csv       Por persona y año legislativo: votos registrados, a favor, en contra, abstenciones y
                                  votos distintos al resultado general (solo votos escritos en el acta).
04_votaciones.csv / 05_votos.csv  Tablas normalizadas que usa el observatorio.
06_votos_probables_inferidos.csv  Votos que el acta no escribe pero que se deducen con confianza alta (ver abajo).
                                  NO se suman a los archivos 02 y 03.

CÓMO SE OBTUVO
- Cada «se declaró aprobado/rechazado por N votos a favor, N en contra y N abstenciones» del acta es una votación.
  La lista nominal es la que la precede («Dip. Nombre, a favor; …»), por lo que se separan las votaciones en lo general
  y en lo particular.
- El sentido del voto solo se registra cuando el acta lo transcribe. Nunca se deduce del partido ni del resultado.
- Las votaciones económicas de puntos de acuerdo no tienen registro individual.

CUADRE ENTRE LA LISTA Y EL TOTAL (votaciones nominales: {nominales})
- El resultado oficial es el que declara la Presidencia. La lista nominal es la evidencia de quién votó.
- En {coincide} votaciones la lista suma exactamente el total declarado. Que alguien con asistencia no aparezca en la lista
  es normal: salió del salón y no votó (aclaración del área de taquigrafía parlamentaria).
- En {distintas} votaciones no suman lo mismo. La diferencia se registra como «votos sin nombre en el acta» y se clasifica:
    alta  ({alta}): el voto sin nombre corresponde, en un solo sentido, a quien está escrito sin sentido de voto, a la única
                persona presente que no aparece, o el total es igual a todas las diputaciones en funciones y todas estuvieron
                presentes en algún pase de lista. Se registra como voto probable en el archivo 06 ({inferidos} votos).
    media ({media}): la única candidata solo aparece en un pase de lista anterior (pudo salir). No se asigna voto.
    baja  ({baja}): hay más candidatos que votos faltantes, los documentos se contradicen o la lista trae votos de más.
                No se asigna voto.
- Nada de esto modifica el acta ni el resultado oficial. Cada caso está en la bitácora (bloque «observaciones»).
- «Votos distintos al resultado» describe cuántas veces la persona votó distinto del resultado general; no es una
  calificación ni mide la calidad de su trabajo.
"""


TIPO_INT = {"presentacion": "Presentación de asunto", "a_favor": "A favor", "en_contra": "En contra", "posicionamiento": "Posicionamiento",
            "asuntos_generales": "Asuntos generales", "mocion": "Moción, alusión o rectificación", "otro": "Otro"}


def bloque_intervenciones() -> None:
    global DESTINO
    DESTINO = RAIZ / "entrega" / "intervenciones"
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True)
    import json as _json
    dips = {d["id_diputado"]: d for d in leer("diputados")}
    partidos = {p["id_partido"]: p for p in leer("partidos")}
    sesiones = {x["id_sesion"]: x for x in leer("sesiones")}
    asuntos = {a["id_asunto"]: a for a in leer("asuntos")}
    evid = {e["id_fuente"]: e for e in leer("evidencias")}
    resumen_txt = _json.loads((RAIZ / "datos_crudos" / "congreso" / "intervenciones_resumen.json").read_text(encoding="utf-8"))
    ints = leer("intervenciones")
    anio = lambda f: next((str(n) for n, i, j in [(1, "2024-10-01", "2025-09-30"), (2, "2025-10-01", "2026-09-30"), (3, "2026-10-01", "2027-09-30")] if f and i <= f <= j), "")
    detalle = []
    for x in ints:
        s_ = sesiones.get(x["id_sesion"], {})
        d = dips.get(x["id_diputado"], {})
        fecha = s_.get("fecha") or x["id_intervencion"][7:15][:4] + "-" + x["id_intervencion"][11:13] + "-" + x["id_intervencion"][13:15]
        detalle.append({"id_intervencion": x["id_intervencion"], "fecha": fecha, "anio_legislativo": anio(fecha), "id_sesion": x["id_sesion"], "id_diputado": x["id_diputado"],
                        "nombre": d.get("nombre_completo", ""), "partido": partidos.get(d.get("id_partido", ""), {}).get("siglas", ""), "tipo": TIPO_INT.get(x["tipo_intervencion"], x["tipo_intervencion"]),
                        "tema": x["tema"], "asunto": asuntos.get(x["id_asunto"], {}).get("titulo", "") or x["asunto_texto"], "resumen_del_acta": resumen_txt.get(x["id_intervencion"], ""),
                        "diario_de_los_debates": x["url_documento"], "acta": evid.get(x["id_fuente"], {}).get("url", "")})
    detalle.sort(key=lambda r: (r["fecha"], r["id_intervencion"]))
    escribir("01_intervenciones_detalle.csv", detalle, list(detalle[0].keys()))
    res = []
    for id_d, d in sorted(dips.items(), key=lambda x: x[1]["nombre_completo"]):
        for clave in ("1", "2", "3", "Total"):
            mias = [r for r in detalle if r["id_diputado"] == id_d and (clave == "Total" or r["anio_legislativo"] == clave)]
            c = Counter(r["tipo"] for r in mias)
            fila = {"id_diputado": id_d, "nombre": d["nombre_completo"], "partido": partidos.get(d["id_partido"], {}).get("siglas", ""), "periodo": ANIO.get(clave, "Toda la Legislatura (a la fecha de corte)"),
                    "intervenciones": len(mias), "sesiones_con_intervencion": len({r["id_sesion"] for r in mias if r["id_sesion"]})}
            fila.update({t: c[t] for t in TIPO_INT.values() if t != "Otro"})
            res.append(fila)
    escribir("02_resumen_por_diputado.csv", res, list(res[0].keys()))
    temas = Counter((r["tema"], r["anio_legislativo"]) for r in detalle)
    filas_t = [{"tema": t, "anio_legislativo": a, "anio_legislativo_texto": ANIO.get(a, ""), "intervenciones": n} for (t, a), n in sorted(temas.items())]
    escribir("03_resumen_por_tema.csv", filas_t, ["tema", "anio_legislativo", "anio_legislativo_texto", "intervenciones"])
    f_ = leer("intervenciones")
    escribir("04_intervenciones.csv", f_, list(f_[0].keys()))
    (DESTINO / "00_LEEME.txt").write_text(LEEME_INT, encoding="utf-8")
    zip_ = shutil.make_archive(str(DESTINO.parent / "intervenciones_LXI_legislatura"), "zip", DESTINO)
    print("Listo:", Path(zip_).relative_to(RAIZ))


LEEME_INT = """INTERVENCIONES EN TRIBUNA — LXI LEGISLATURA DEL H. CONGRESO DEL ESTADO DE COLIMA
Fuentes: actas de sesión (resumen de cada participación) y Diario de los Debates (versión íntegra, enlazada).

ARCHIVOS (en orden)
01_intervenciones_detalle.csv  Una fila por intervención: fecha, sesión, persona, partido, tipo, tema, asunto,
                               resumen tomado del acta y enlaces al Diario de los Debates y al acta.
02_resumen_por_diputado.csv    Por persona y año legislativo: intervenciones, sesiones en que intervino y por tipo.
03_resumen_por_tema.csv        Intervenciones por tema y año legislativo.
04_intervenciones.csv          Tabla normalizada que usa el observatorio.

CÓMO SE OBTUVO
- Intervención = párrafo del acta cuyo sujeto es una diputada o un diputado. No se cuentan los trámites de la Presidencia
  y la Secretaría (conducir la sesión, pedir que se obvie una lectura, leer la síntesis).
- Tipo (clasificación automática por el texto del acta): presentación de un asunto (iniciativa, punto de acuerdo,
  lectura de dictamen); a favor o en contra cuando expresa su intención de voto; moción, alusión o rectificación;
  asuntos generales; posicionamiento (el resto).
- Tema: clasificación automática por palabras clave del resumen; «Otros temas» cuando no hay coincidencias.

IMPORTANTE
- El número de intervenciones describe participación documentada. No mide la calidad de los argumentos ni su impacto,
  y una cifra mayor no significa mejor desempeño.
- El acta resume; para el contenido exacto consulte el Diario de los Debates enlazado.
- Algunas erratas de nombres en las actas se corrigieron por similitud (p. ej. «Batatamente» → Bustamante).
"""


def bloque_comisiones() -> None:
    global DESTINO
    DESTINO = RAIZ / "entrega" / "comisiones"
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True)
    import json as _json
    dips = {d["id_diputado"]: d for d in leer("diputados")}
    partidos = {p["id_partido"]: p for p in leer("partidos")}
    coms = leer("comisiones")
    integ = leer("comision_integrantes")
    asuntos = {a["id_asunto"]: a for a in leer("asuntos")}
    turnos = leer("asunto_comisiones")
    docs_p = RAIZ / "datos_crudos" / "congreso" / "comision_documentos.json"
    docs = _json.loads(docs_p.read_text(encoding="utf-8")) if docs_p.exists() else []
    aux = RAIZ / "datos_crudos" / "congreso" / "dictamen_comisiones.csv"
    dic_de = defaultdict(set)
    if aux.exists():
        with open(aux, encoding="utf-8") as f:
            for r in csv.DictReader(f):
                dic_de[r["id_comision"]].add(r["id_asunto"])
    CARGO = {"presidencia": "Presidencia", "secretaria": "Secretaría", "vocal": "Vocal"}
    resumen = []
    for c in sorted(coms, key=lambda x: x["nombre"]):
        mios = [t for t in turnos if t["id_comision"] == c["id_comision"] and not t["id_asunto"].startswith("DIC-")]
        ids = {t["id_asunto"] for t in mios}
        ini = [asuntos[i] for i in ids if i in asuntos]
        dics = [asuntos[i] for i in dic_de[c["id_comision"]] if i in asuntos]
        pres = [dips.get(i["id_diputado"], {}).get("nombre_completo", "") for i in integ if i["id_comision"] == c["id_comision"] and i["cargo"] == "presidencia"]
        inf = [d for d in docs if d["id_comision"] == c["id_comision"] and "Informe" in d["documento"]]
        resumen.append({"id_comision": c["id_comision"], "comision": c["nombre"], "presidencia": "; ".join(pres),
                        "integrantes": len([i for i in integ if i["id_comision"] == c["id_comision"]]),
                        "iniciativas_turnadas": len(ini), "iniciativas_dictaminadas": len([a for a in ini if a["fecha_dictamen"] or a["estado_procesal"] in ("dictaminado", "aprobado", "publicado", "rechazado")]),
                        "iniciativas_pendientes": len([a for a in ini if a["estado_procesal"] in ("presentado", "turnado", "pendiente")]),
                        "dictamenes_elaborados": len(dics), "dictamenes_aprobados_pleno": len([a for a in dics if a["estado_procesal"] in ("aprobado", "publicado")]),
                        "reuniones_reportadas_pagina_comisiones": c.get("reuniones_reportadas", ""),
                        "reuniones_declaradas_en_informes": "; ".join(f"{d['documento']}: {d['reuniones_declaradas']}" for d in inf if d["reuniones_declaradas"] is not None),
                        "informes_publicados": len(inf), "programas_publicados": len([d for d in docs if d["id_comision"] == c["id_comision"] and "Programa" in d["documento"]])})
    escribir("01_comisiones_resumen.csv", resumen, list(resumen[0].keys()))
    filas_i = [{"id_comision": i["id_comision"], "comision": next((c["nombre"] for c in coms if c["id_comision"] == i["id_comision"]), ""), "id_diputado": i["id_diputado"],
                "partido": partidos.get(dips.get(i["id_diputado"], {}).get("id_partido", ""), {}).get("siglas", ""), "cargo": CARGO.get(i["cargo"], i["cargo"])} for i in integ]
    escribir("02_integrantes.csv", filas_i, ["id_comision", "comision", "id_diputado", "partido", "cargo"])
    filas_d = [{"comision": d["comision"], "documento": d["documento"], "paginas": d["paginas"], "texto_obtenido_por_ocr": "Sí" if d.get("texto_por_ocr") else "No",
                "reuniones_declaradas": "" if d["reuniones_declaradas"] is None else d["reuniones_declaradas"], "cita_del_informe": d["frase"], "url": d["url"]} for d in docs]
    escribir("03_programas_e_informes.csv", filas_d, ["comision", "documento", "paginas", "texto_obtenido_por_ocr", "reuniones_declaradas", "cita_del_informe", "url"])
    filas_t = [{"id_comision": t["id_comision"], "comision": next((c["nombre"] for c in coms if c["id_comision"] == t["id_comision"]), ""), "id_asunto": t["id_asunto"],
                "asunto": asuntos.get(t["id_asunto"], {}).get("titulo", "")[:250], "estado": ESTADO_ASUNTO.get(asuntos.get(t["id_asunto"], {}).get("estado_procesal", ""), ""),
                "fecha_presentacion": asuntos.get(t["id_asunto"], {}).get("fecha_presentacion", ""), "fecha_dictamen": t["fecha_dictamen"]} for t in turnos]
    escribir("04_asuntos_turnados.csv", filas_t, list(filas_t[0].keys()))
    (DESTINO / "00_LEEME.txt").write_text(LEEME_COM, encoding="utf-8")
    zip_ = shutil.make_archive(str(DESTINO.parent / "comisiones_LXI_legislatura"), "zip", DESTINO)
    print("Listo:", Path(zip_).relative_to(RAIZ))


LEEME_COM = """COMISIONES — LXI LEGISLATURA DEL H. CONGRESO DEL ESTADO DE COLIMA
Fuentes: página oficial de comisiones (integración, reuniones reportadas, programas e informes), Gaceta
Parlamentaria (turnos de iniciativas y dictámenes).

ARCHIVOS (en orden)
01_comisiones_resumen.csv     Por comisión: presidencia, integrantes, iniciativas turnadas, dictaminadas y pendientes,
                              dictámenes elaborados y aprobados por el Pleno, reuniones reportadas y documentos publicados.
02_integrantes.csv            Integrantes de cada comisión con su cargo y partido.
03_programas_e_informes.csv   Programas de trabajo e informes publicados, con el total de reuniones que declara cada
                              informe y la cita textual de donde se tomó.
04_asuntos_turnados.csv       Iniciativas turnadas a cada comisión, con su estado y fecha de dictamen.

IMPORTANTE
- El Congreso no publica el registro de cada reunión de comisión (fecha, asistencia, acta). Solo hay totales: el que
  muestra la página de comisiones y el que declara cada comisión en sus informes. Pueden no coincidir (por ejemplo,
  Hacienda: 47 en la página; 56 y 67 en sus informes del primer y segundo año). Ninguno se corrige: se muestran ambos.
- 19 de 23 informes son escaneos; su texto se obtuvo con reconocimiento óptico de caracteres (OCR). El total de reuniones
  se extrajo automáticamente: verifique la cita en el documento. Se descartaron frases sobre reuniones programadas.
- No haber localizado un dato de reuniones no significa que la comisión no se haya reunido.
- Las cargas de trabajo y competencias de las comisiones son distintas: compare con cautela.
- Un asunto turnado a varias comisiones aparece en cada una (en el total general cuenta una sola vez).
"""


def bloque_observaciones() -> None:
    global DESTINO
    DESTINO = RAIZ / "entrega" / "observaciones"
    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True)
    evid = {e["id_fuente"]: e for e in leer("evidencias")}
    obs = leer("observaciones")
    filas = [{**o, "url_fuente": evid.get(o["id_fuente"], {}).get("url", ""), "url_fuente_resolucion": evid.get(o["id_fuente_resolucion"], {}).get("url", "")} for o in obs]
    filas.sort(key=lambda o: (o["estado"] != "abierta", o["tabla"], o["id_observacion"]))
    escribir("01_bitacora_observaciones.csv", filas, list(filas[0].keys()))
    c = Counter(o["estado"] for o in obs)
    (DESTINO / "00_LEEME.txt").write_text(LEEME_OBS.format(total=len(obs), abiertas=c["abierta"], resueltas=c["resuelta"]), encoding="utf-8")
    zip_ = shutil.make_archive(str(DESTINO.parent / "observaciones_LXI_legislatura"), "zip", DESTINO)
    print("Listo:", Path(zip_).relative_to(RAIZ))


LEEME_OBS = """BITÁCORA DE OBSERVACIONES — OBSERVATORIO LEGISLATIVO COLIMA, LXI LEGISLATURA
{total} observaciones: {abiertas} abiertas y {resueltas} resueltas.

Registra lo que el Observatorio encontró al revisar los documentos oficiales: diferencias entre documentos, datos
faltantes, errores de captura en la fuente y correcciones que se hicieron a la propia base. El registro oficial nunca se
modifica en silencio: cada corrección queda aquí con su evidencia.

COLUMNAS
id_observacion        Identificador (OBS-…). Las tablas de datos lo citan en su columna id_observacion u observaciones.
tabla / id_registro   Registro al que se refiere.
tipo                  votos_sin_nombre, lista_no_cuadra, licencia, clasificacion_erronea, resultado_no_leido, autoria,
                      dato_faltante, inconsistencia_documental, errata_fuente, fuente_ambigua, criterio, …
descripcion           Qué se encontró.
confianza             Solo en el cuadre de votaciones: alta, media o baja (ver LEEME del bloque de votaciones).
estado                abierta (sin resolver) o resuelta.
resolucion            Cómo se resolvió y con qué fuente.
url_fuente            Documento donde se observa.
url_fuente_resolucion Documento con que se resolvió.
"""


if __name__ == "__main__":
    bloque = sys.argv[1] if len(sys.argv) > 1 else "todo"
    if bloque in ("observaciones", "todo"):
        bloque_observaciones()
    if bloque in ("comisiones", "todo"):
        bloque_comisiones()
    if bloque in ("intervenciones", "todo"):
        bloque_intervenciones()
    if bloque in ("votaciones", "todo"):
        bloque_votaciones()
    if bloque in ("exhortos", "todo"):
        bloque_exhortos()
    if bloque in ("dictamenes", "todo"):
        bloque_dictamenes()
    if bloque in ("asistencias", "todo"):
        bloque_asistencias()
    if bloque in ("iniciativas", "todo"):
        bloque_iniciativas()
