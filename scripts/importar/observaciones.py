"""
Bitácora de observaciones y cuadre de las votaciones nominales.

Principio: el registro oficial no se modifica. Lo que el Observatorio encuentra al revisarlo se anota aparte,
con su evidencia y un nivel de confianza, y nunca se mezcla con los datos oficiales.

1. Cuadre de votaciones nominales. El resultado oficial es el que declara la Presidencia (acto con validez
   jurídica); la lista nominal del acta es la evidencia de quién votó. Si no suman lo mismo, la diferencia se
   registra como «votos sin nombre en el acta» y se busca quién pudo emitirlos:
     - alta:  el voto faltante corresponde, en un solo sentido, a personas escritas en la lista sin sentido de
              voto, o a la única persona presente que no aparece. Se registra como voto probable (votos_inferidos.csv).
     - media: solo cuadra si votaron personas con falta justificada en la lista de asistencia (posible llegada
              después del pase de lista). No se asigna voto; se anota en la asistencia, que no se modifica.
     - baja:  hay más candidatos que votos faltantes, o la diferencia no se explica con la asistencia.
   Asistir no equivale a votar: quien sale del salón no vota (lo confirmó el área de taquigrafía parlamentaria).
   Por eso, cuando la lista y el total coinciden, los presentes sin voto no generan observación.
2. Observaciones de revisión documental (abiertas y resueltas), con la fuente de la resolución.

Requiere: todos los importadores anteriores (se ejecuta al final, antes de la validación).
Escribe observaciones.csv y votos_inferidos.csv; agrega columnas de cuadre a votaciones.csv y la columna
observaciones a asistencias.csv.

Uso: python scripts/importar/observaciones.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from congreso_asistencias import CRUDOS  # noqa: E402
from congreso_asuntos import Reconocedor, escribir, leer_csv  # noqa: E402
import congreso_votaciones as cv  # noqa: E402

SENTIDOS = ("favor", "contra", "abstencion")
ETIQ = {"favor": "a favor", "contra": "en contra", "abstencion": "en abstención"}


def votos_txt(n: int, sentido: str) -> str:
    """«El voto a favor» / «Los 3 votos a favor»."""
    return f"El voto {ETIQ[sentido]}" if n == 1 else f"Los {n} votos {ETIQ[sentido]}"


def personas_txt(ids: list[str], nombre: dict) -> str:
    return ", ".join(nombre[i] for i in ids)
COL_OBS = ["id_observacion", "tabla", "id_registro", "tipo", "descripcion", "confianza", "estado", "resolucion", "id_fuente", "id_fuente_resolucion", "fecha_registro", "fecha_resolucion"]
HOY = "2026-10-31"


def lista_de_votacion(id_votacion: str, actas: dict, cache: dict) -> str:
    """Texto de la lista nominal, ubicado igual que en congreso_votaciones.py (n-ésimo resultado del acta)."""
    partes = id_votacion.split("-")
    acta = actas.get(partes[3])
    if not acta:
        return ""
    if acta["archivo"] not in cache:
        t = (CRUDOS / "actas" / acta["archivo"]).read_text(encoding="utf-8").replace("\n", " \n")
        cache[acta["archivo"]] = (t, list(cv.RESULTADO.finditer(t)))
    t, ms = cache[acta["archivo"]]
    n = int(partes[-1])
    if n > len(ms):
        return ""
    m = ms[n - 1]
    previo = ms[n - 2].end() if n > 1 else 0
    antes = t[previo:m.start()]
    li = list(cv.LISTA_INICIO.finditer(antes))
    return antes[li[-1].end():] if li else ""


def nombres_sin_sentido(lista: str, rec: Reconocedor) -> list[str]:
    """Diputaciones escritas en la lista sin «a favor / en contra / abstención»."""
    ids = []
    for trozo in re.findall(r"(?i)dip(?:utad[oa])?[.,]?\s+[^;]{4,70}?(?=;|\.\s*con el resultado|$)", lista):
        if re.search(r"(?i)a favor|en contra|por la negativa|por la afirmativa|abstenci|se abstiene|abstuvo", trozo):
            continue
        q = rec.buscar(trozo)
        if q:
            ids.append(q[0]["id_diputado"])
    return ids


def nombres_repetidos(lista: str, rec: Reconocedor) -> list[str]:
    vistos = Counter()
    for crudo in re.findall(r"(?i)dip(?:utad[oa])?[.,]?\s+([^;:]{4,70}?)(?=[,;.]?\s*(?:a favor|en contra|abstenci|se abstiene|;|\.\s*con el resultado))", lista):
        q = rec.buscar(crudo)
        if q:
            vistos[q[0]["id_diputado"]] += 1
    return [i for i, n in vistos.items() if n > 1]


PASE = re.compile(r"(?is)pase de lista.{0,400}?(?:presentes|presencia de)\s+(\d+)[^,.]*?(?:,|\.)\s*(.{0,700})")


def faltas_del_pase(resto: str, rec: Reconocedor):
    """Personas con falta en un pase de lista; None si el acta da solo un número sin nombres."""
    if re.match(r"(?i)\s*(?:con la falta de|faltando)\s+(?:dos|tres|cuatro|cinco|seis|\d)\b", resto):
        return None
    f = re.match(r"(?is)\s*(?:faltando con justificaci[óo]n|con (?:la )?falta justificada de)\s*:?\s*(.*?)(?:\.\s|\.$|Una vez|En el )", resto)
    if not f:
        return [] if re.match(r"(?i)\s*(una vez|en el|siendo|y una vez|$)", resto) else None
    return [d["id_diputado"] for d in rec.buscar(f.group(1))]


def pases_de_lista(rec: Reconocedor, en_funciones: dict) -> dict:
    """Pases de lista de cada acta cuya cuenta (presentes + nombrados) cuadra con las personas en funciones.
    La lista de la Gaceta coincide con el ÚLTIMO pase (el de confirmación) en el 99.5 % de los registros."""
    sesiones = leer_csv("sesiones")
    por_fecha = defaultdict(list)
    for x in sesiones:
        por_fecha[x["fecha"]].append(x)
    salida = {}
    for a in json.load(open(CRUDOS / "actas" / "indice.json", encoding="utf-8")):
        if not a.get("archivo"):
            continue
        sid = cv.sesion_de(a, por_fecha.get(a["fecha"], []))
        if not sid or sid not in en_funciones:
            continue
        t = (CRUDOS / "actas" / a["archivo"]).read_text(encoding="utf-8")
        pases = []
        for m in PASE.finditer(t):
            nom = faltas_del_pase(m.group(2), rec)
            if nom is not None and int(m.group(1)) + len(nom) == len(en_funciones[sid]):
                pases.append(set(nom))
        if pases:
            salida[sid] = {"pases": pases, "fuente": f"EV-ACTA-{a['fecha']}-{a['archivo'][-7:-4]}"}
    return salida


def resolver_asistencia_con_actas(asistencias: list[dict], pases: dict, evid: set) -> int:
    """Registros no verificados (página de la Gaceta con dos listas mezcladas) se resuelven con el último
    pase de lista del acta de esa sesión, el mismo criterio que usa la Gaceta."""
    n = 0
    for a in asistencias:
        p = pases.get(a["id_sesion"])
        if a["estado"] not in ("no_verificado", "pendiente") or not p or p["fuente"] not in evid:
            continue
        ultimo = p["pases"][-1]
        nuevo = "justificada" if a["id_diputado"] in ultimo else "asistencia"
        a["notas"] = (f"Resuelto con el acta de la sesión (último pase de lista: {'falta con justificación' if nuevo == 'justificada' else 'presente'}); "
                      f"la página de la Gaceta no permitía asegurarlo (estado anterior: {a['estado']}).")
        a["estado"], a["id_fuente"] = nuevo, p["fuente"]
        a["justificacion"] = "Falta con justificación según el pase de lista del acta" if nuevo == "justificada" else ""
        n += 1
    return n


def cuadre_votaciones(observaciones: list[dict]):
    diputados = leer_csv("diputados")
    rec = Reconocedor(diputados)
    nombre = {d["id_diputado"]: d["nombre_completo"] for d in diputados}
    votaciones = leer_csv("votaciones")
    votos = defaultdict(dict)
    for x in leer_csv("votos"):
        votos[x["id_votacion"]][x["id_diputado"]] = x["sentido"]
    asistencias = leer_csv("asistencias")
    en_funciones = defaultdict(set)
    for a in asistencias:
        en_funciones[a["id_sesion"]].add(a["id_diputado"])
    pases = pases_de_lista(rec, en_funciones)
    nuevos = resolver_asistencia_con_actas(asistencias, pases, {e["id_fuente"] for e in leer_csv("evidencias")})
    # Se cuenta el total de registros resueltos con el acta, no solo los de esta corrida: si el paso se vuelve a
    # correr solo, los que ya estaban resueltos no deben desaparecer del conteo de la bitácora.
    resueltos = sum(1 for a in asistencias if "Resuelto con el acta de la sesión" in (a.get("notas") or ""))
    print(f"  asistencias resueltas con el pase de lista del acta: {resueltos} ({nuevos} en esta corrida)")
    estado_asis = defaultdict(dict)
    for a in asistencias:
        estado_asis[a["id_sesion"]][a["id_diputado"]] = a["estado"]
    actas = {d["archivo"][-7:-4]: d for d in json.load(open(CRUDOS / "actas" / "indice.json", encoding="utf-8")) if d.get("archivo")}
    cache: dict = {}
    inferidos, notas_asis = [], defaultdict(list)
    conteo = Counter()

    for v in votaciones:
        for c in ("votos_en_lista", "votos_sin_nombre", "cuadre", "observaciones", "id_observacion"):
            v[c] = ""
        if v["tipo_votacion"] != "nominal" or v["total_favor"] == "":
            continue
        en_lista = votos[v["id_votacion"]]
        lista_c = Counter(en_lista.values())
        oficial = {s: int(v[f"total_{s}"] or 0) for s in SENTIDOS}
        falta = {s: oficial[s] - lista_c[s] for s in SENTIDOS}
        v["votos_en_lista"] = str(sum(lista_c[s] for s in SENTIDOS))
        sin_nombre = sum(oficial.values()) - sum(lista_c[s] for s in SENTIDOS)
        v["votos_sin_nombre"] = str(max(sin_nombre, 0))
        if not any(falta.values()):
            v["cuadre"] = "coincide"
            conteo["coincide"] += 1
            continue

        lista = lista_de_votacion(v["id_votacion"], actas, cache)
        sin_sentido = [i for i in nombres_sin_sentido(lista, rec) if i not in en_lista]
        repetidos = nombres_repetidos(lista, rec)
        asis = estado_asis.get(v["id_sesion"], {})
        # Presente = asistencia en la lista oficial o presente en algún pase de lista del acta (el acta puede
        # registrar a quien estuvo al inicio y no en el pase de confirmación).
        pases_s = pases.get(v["id_sesion"], {}).get("pases", [])
        en_algun_pase = {i for i in asis if any(i not in p for p in pases_s)}
        presentes = sorted(i for i, e in asis.items() if (e == "asistencia" or i in en_algun_pase) and i not in en_lista)
        no_presentes = sorted(i for i, e in asis.items() if not (e == "asistencia" or i in en_algun_pase) and i not in en_lista)
        votaron_todos = sum(oficial.values()) == len(asis) and len(asis) > 0 and not no_presentes
        contradice_pase = sum(oficial.values()) == len(asis) and len(asis) > 0 and bool(no_presentes)
        solo_pase_previo = [i for i in presentes if asis.get(i) != "asistencia"]
        faltantes = {s: n for s, n in falta.items() if n > 0}
        sobrantes = {s: -n for s, n in falta.items() if n < 0}
        M = sum(faltantes.values())
        resumen = (f"La Presidencia declara {oficial['favor']} a favor, {oficial['contra']} en contra y {oficial['abstencion']} abstenciones; "
                   f"la lista nominal del acta suma {lista_c['favor']}, {lista_c['contra']} y {lista_c['abstencion']}.")
        detalles = []
        if sin_sentido:
            detalles.append("Escrito sin sentido de voto: " + ", ".join(nombre[i] for i in sin_sentido) + ".")
        if repetidos:
            detalles.append("Nombre repetido en la lista: " + ", ".join(nombre[i] for i in repetidos) + ".")
        asignar, confianza = [], "baja"

        if sobrantes:
            v["cuadre"] = "sobran_nombres" if not faltantes else "distinto_reparto"
            explicacion = "La lista trae más votos de los declarados en algún sentido; no se puede explicar con la asistencia. Requiere cotejo con la grabación o el tablero."
        else:
            v["cuadre"] = "faltan_nombres"
            un_sentido = len(faltantes) == 1
            sentido = next(iter(faltantes)) if un_sentido else ""
            if votaron_todos and un_sentido:
                confianza, asignar = "alta", sorted(i for i in asis if i not in en_lista)
                explicacion = (f"El total declarado ({sum(oficial.values())}) es igual al número de diputaciones en funciones: votaron todas. "
                               f"{votos_txt(M, sentido)} sin nombre {'es' if M == 1 else 'son'} de: " + personas_txt(asignar, nombre) + ".")
            elif un_sentido and sin_sentido and len(sin_sentido) == M:
                confianza, asignar = "alta", sin_sentido
                explicacion = (f"{votos_txt(M, sentido)} sin nombre {'corresponde' if M == 1 else 'corresponden'} a quien está escrito en la lista sin sentido de voto: "
                               + personas_txt(sin_sentido, nombre) + ".")
            elif contradice_pase:
                explicacion = (f"El total declarado ({sum(oficial.values())}) es igual al número de diputaciones en funciones, pero el pase de lista registra "
                               f"con falta a: {', '.join(nombre[i] for i in no_presentes)}. Los documentos se contradicen: puede ser un error en el total "
                               "declarado o llegadas después del pase de lista. No se asigna voto.")
            elif un_sentido and not sin_sentido and len(presentes) == M and solo_pase_previo:
                confianza = "media"
                explicacion = (f"{votos_txt(M, sentido)} sin nombre {'coincide' if M == 1 else 'coinciden'} con quien aparece presente en un pase de lista anterior del acta pero no en el "
                               f"de confirmación: {personas_txt(presentes, nombre)}. Pudo salir antes de la votación. No se asigna voto.")
            elif un_sentido and not sin_sentido and len(presentes) == M:
                confianza, asignar = "alta", presentes
                explicacion = ((f"{votos_txt(M, sentido)} sin nombre coincide con la única persona presente que no aparece en la lista: " if M == 1 else
                                f"{votos_txt(M, sentido)} sin nombre coinciden con las únicas personas presentes que no aparecen en la lista: ")
                               + personas_txt(presentes, nombre) + ".")
            elif len(presentes) < M <= len(presentes) + len(no_presentes) and len(presentes) + len(no_presentes) == M:
                confianza = "media"
                explicacion = (f"{'Falta 1 nombre' if M == 1 else f'Faltan {M} nombres'}. Solo cuadra si votaron, además de quien estaba presente ({', '.join(nombre[i] for i in presentes) or 'nadie'}), "
                               f"personas que no aparecen presentes en ningún pase de lista: {', '.join(nombre[i] + ' (' + asis[i] + ')' for i in no_presentes)}. "
                               "Posible llegada después del pase de lista o error en el total declarado. No se asigna voto.")
                for i in no_presentes:
                    notas_asis[(v["id_sesion"], i)].append(v["id_votacion"])
            elif len(presentes) >= M:
                explicacion = (f"{'Falta 1 nombre' if M == 1 else f'Faltan {M} nombres'} y hay {len(presentes)} personas presentes que no aparecen en la lista: "
                               + personas_txt(presentes, nombre) + ". Alguna pudo salir del salón; no se puede saber quién votó.")
            else:
                explicacion = (f"{'Falta 1 nombre' if M == 1 else f'Faltan {M} nombres'}; de las {len(presentes) + len(no_presentes)} personas en funciones que no aparecen en la lista, "
                               f"{'ninguna estaba presente' if not presentes else 'no alcanzan las presentes'} en ningún pase de lista; la diferencia no se explica con la asistencia.")
            if confianza == "alta":
                for i in asignar:
                    inferidos.append({"id_votacion": v["id_votacion"], "id_diputado": i, "sentido": sentido, "confianza": "alta",
                                      "fundamento": explicacion, "id_observacion": f"OBS-VOT-{v['id_votacion'][7:]}", "id_fuente": v["id_fuente"]})
        oid = f"OBS-VOT-{v['id_votacion'][7:]}"
        texto = " ".join([resumen, *detalles, explicacion])
        v["observaciones"] = f"{explicacion} Confianza: {confianza}."
        v["id_observacion"] = oid
        conteo[f"{v['cuadre']}/{confianza}"] += 1
        observaciones.append({"id_observacion": oid, "tabla": "votaciones", "id_registro": v["id_votacion"], "tipo": "votos_sin_nombre" if v["cuadre"] == "faltan_nombres" else "lista_no_cuadra",
                              "descripcion": texto, "confianza": confianza, "estado": "abierta",
                              "resolucion": "", "id_fuente": v["id_fuente"], "id_fuente_resolucion": "", "fecha_registro": HOY, "fecha_resolucion": ""})

    voto_en = defaultdict(list)
    ses_de_vot = {v["id_votacion"]: v["id_sesion"] for v in votaciones}
    for idv, d in votos.items():
        for i in d:
            voto_en[(ses_de_vot.get(idv), i)].append(idv)
    for a in asistencias:
        textos = []
        clave = (a["id_sesion"], a["id_diputado"])
        if a["estado"] != "asistencia" and voto_en.get(clave):
            pases_s = pases.get(a["id_sesion"], {}).get("pases", [])
            al_inicio = any(a["id_diputado"] not in p for p in pases_s[:-1])
            textos.append(f"Vota en {len(voto_en[clave])} votación(es) nominal(es) de esta sesión según el acta. "
                          + ("Aparece presente en un pase de lista anterior del acta: estuvo en la sesión y no en el pase de confirmación, que es el que registra la lista oficial."
                             if al_inicio else "Posible llegada después del pase de lista."))
        if notas_asis.get(clave):
            textos.append(f"El total de la(s) votación(es) {', '.join(notas_asis[clave])} solo cuadra si esta persona votó.")
        a["observaciones"] = (" ".join(textos) + " El registro oficial de asistencia no se modifica.") if textos else ""

    cols_v = ["id_votacion", "id_sesion", "id_asunto", "descripcion", "tipo_votacion", "resultado", "total_favor", "total_contra", "total_abstencion",
              "votos_en_lista", "votos_sin_nombre", "cuadre", "observaciones", "id_observacion", "id_fuente", "estado_verificacion"]
    escribir("votaciones", cols_v, votaciones)
    escribir("votos_inferidos", ["id_votacion", "id_diputado", "sentido", "confianza", "fundamento", "id_observacion", "id_fuente"], inferidos)
    escribir("asistencias", ["id_sesion", "id_diputado", "estado", "justificacion", "id_fuente", "notas", "observaciones"], asistencias)
    print("  cuadre:", dict(sorted(conteo.items())))
    restantes = sorted({a["id_sesion"] for a in asistencias if a["estado"] in ("no_verificado", "pendiente")})
    votaron_sin_asistencia = sum(1 for a in asistencias if a["estado"] != "asistencia" and a["observaciones"].startswith("Vota en"))
    return resueltos, restantes, votaron_sin_asistencia


# ----------------------------------------------------------------- revisión documental
# Cada entrada: (id, tabla, registro, tipo, descripción, estado, resolución, fuente, fuente de la resolución, fecha de resolución)
# Las resueltas documentan correcciones ya aplicadas a la base: nada se borra en silencio.
TAQUIGRAFA = "Aclaración del área de taquigrafía parlamentaria del H. Congreso del Estado (reunión del 30 oct 2026)."
REVISION = [
    ("OBS-LIC-01", "diputados", "DIP-137", "licencia",
     "Licencia de Isamar Ramírez Rodríguez: faltaban el motivo y la fecha de protesta de su suplente.", "resuelta",
     "Licencia para desempeñar una comisión o empleo público (art. 24, fr. II, Ley Orgánica). Sharon Monserrat Díaz García rindió protesta el 17 oct 2024; no hubo sesión el 16 oct. Reincorporación el 16 abr 2025. " + TAQUIGRAFA,
     "EV-ACUERDO-6", "EV-ACUERDO-29", "2026-10-30"),
    ("OBS-LIC-02", "diputados", "DIP-137", "inconsistencia_documental",
     "El título y el resolutivo primero del Acuerdo 6 dicen «licencia por tiempo definido», pero la solicitud transcrita en el mismo acuerdo pide licencia «por tiempo indefinido» y no fija fecha de término.",
     "abierta", "", "EV-ACUERDO-6", "", ""),
    ("OBS-LIC-03", "asistencias", "S-A3-PO1-ORD-002 / DIP-S09", "licencia",
     "La base daba como incierto quién ocupó la curul del distrito 9 el 14 oct 2026.", "resuelta",
     "El Acuerdo 67 autoriza la reincorporación de Diana Xally Yael Zepeda Figueroa a partir del 16 oct 2026; el 14 oct estaba en funciones la suplente Alma Yesenia Ventura Ochoa. Licencia por cargo de carácter estatal (art. 24, fr. II).",
     "EV-ACUERDO-67", "EV-ACUERDO-67", "2026-10-30"),
    ("OBS-LIC-04", "asistencias", "S-A1-PO1-ORD-001 y S-A1-PO1-ORD-002", "licencia",
     "La base daba como incierto quién ocupó la curul de Julio César León Trujillo el 2 oct 2024 (dos sesiones ese día).", "resuelta",
     "Acta de la Ordinaria 01: falta con justificación Julio César León Trujillo y se aprueba su licencia. Acta de la Ordinaria 02: rinde protesta Alfredo Álvarez Ramírez y el pase de lista posterior verifica 25 presentes.",
     "EV-ACUERDO-4", "EV-ACTA-2024-10-02-159", "2026-10-30"),
    ("OBS-LIC-05", "diputados", "DIP-137, DIP-133, DIP-RP-JCLT", "dato_faltante",
     "Pregunta para el área de taquigrafía parlamentaria (fase 2): ¿qué cargo fueron a ocupar las tres personas con licencia? "
     "Los acuerdos solo dicen el motivo general: Isamar Ramírez Rodríguez, «comisión o empleo público» (Acuerdo 6, 16 oct 2024 – 15 abr 2025); "
     "Diana Xally Yael Zepeda Figueroa, «empleo de carácter estatal» (Acuerdo 17, 16 ene 2025 – 15 oct 2026); "
     "Julio César León Trujillo, «comisión o empleo público» (Acuerdo 4, desde el 2 oct 2024, sin reincorporación). "
     "Para León Trujillo la prensa (SDP Noticias) dice que fue nombrado coordinador nacional de Becas para el Bienestar Benito Juárez; falta una fuente oficial. "
     "También conviene preguntar si su licencia sigue vigente o si hay algún acuerdo posterior.",
     "abierta", "", "EV-ACUERDO-4", "", ""),
    ("OBS-EVI-01", "evidencias", "EV-ACUERDO-4, EV-ACUERDO-6, EV-ACUERDO-29", "enlace_roto",
     "Los enlaces a los acuerdos 4, 6 y 29 daban error 404: la Gaceta usa nombres de archivo distintos (Acuerdo_04_61, Acuerdo_06_61, ACUERDO_29_61).", "resuelta",
     "Se tomaron los nombres de archivo de la lista de acuerdos de la Gaceta.", "EV-ACUERDO-6", "", "2026-10-30"),
    ("OBS-EXH-01", "asuntos", "PA-61-A20241204-1", "clasificacion_erronea",
     "Se había registrado un exhorto del Dip. Jaime Enrique Sotelo García el 4 dic 2024. Era un comentario durante la comparecencia del Subsecretario de Turismo («Exhortó a que se pueda dar un mayor impulso…»), no un punto de acuerdo.",
     "resuelta", "Registro retirado. El importador exige ahora que el verbo de presentación y «punto de acuerdo/exhorto» estén en la misma oración. " + TAQUIGRAFA,
     "EV-ACTA-2024-12-04-141", "EV-ACTA-2024-12-04-141", "2026-10-30"),
    ("OBS-EXH-02", "asuntos", "PA-61-A20260715-2", "resultado_no_leido",
     "El exhorto de la Dip. Sofía Peralta Ferro (15 jul 2026) figuraba como pendiente.", "resuelta",
     "El acta dice «se desecha el exhorto por no haber alcanzado la votación reglamentaria»: rechazado. El importador no reconocía la forma «se desecha». " + TAQUIGRAFA,
     "EV-ACTA-2026-07-15-016", "EV-ACTA-2026-07-15-016", "2026-10-30"),
    ("OBS-EXH-03", "asuntos", "PA-61-A20260128-1", "resultado_no_leido",
     "El punto de acuerdo para citar a comparecer al titular de la Secretaría de Seguridad Pública (28 ene 2026) figuraba como pendiente.", "resuelta",
     "El acta dice «El Punto de acuerdo se desecha por no alcanzar la votación reglamentaria»: rechazado. Es una solicitud de comparecencia, no un exhorto.",
     "EV-ACTA-2026-01-28-053", "EV-ACTA-2026-01-28-053", "2026-10-30"),
    ("OBS-EXH-04", "asuntos", "PA-61-A20250529-1", "resultado_no_registrado",
     "El punto de acuerdo de la Dip. Sofía Peralta Ferro leído en Asuntos Generales el 29 may 2025 (exhorto a autoridades electorales y a la Fiscalía de Delitos Electorales) no tiene resultado en el acta. Según el área de taquigrafía, el exhorto se resuelve en la misma sesión.",
     "abierta", "", "EV-ACTA-2025-05-29-101", "", ""),
    ("OBS-INI-01", "asunto_promoventes", "INI-61-224", "autoria",
     "La Gaceta deja vacío el autor de la iniciativa 224 (estímulos fiscales de agua potable en Manzanillo).", "resuelta",
     "El documento lo firman Andrea Naranjo Alcaraz, Isamar Ramírez Rodríguez, Alma Yesenia Ventura Ochoa, Andrea Carolina Heredia Torres y Héctor Gustavo Larios Uribe, a partir de la propuesta del Ayuntamiento de Manzanillo; sello de recibido del 04 dic 2025.",
     "EV-GACETA-INICIATIVAS", "EV-GACETA-INICIATIVAS", "2026-10-30"),
    ("OBS-DEC-01", "asuntos", "DEC-61-266", "dato_faltante",
     "El Decreto 266 (reforma al Decreto 259, estímulos fiscales de agua de Colima y Villa de Álvarez; aprobado el 1 abr 2026) tiene fecha de publicación 0001-01-01 en la Gaceta y no tiene PDF publicado.",
     "abierta", "", "EV-GACETA-INICIATIVAS", "", ""),
    ("OBS-VOT-00", "votaciones", "(todas las nominales)", "criterio",
     "Personas con asistencia que no aparecen en una votación nominal.", "resuelta",
     "Quien sale del salón para atender otros asuntos no vota y el acta no le asigna voto; no es error ni abstención. " + TAQUIGRAFA,
     "", "", "2026-10-30"),

    ("OBS-ASI-02", "sesiones", "S-A1-PO1-SPE-001 y S-A2-PO1-SPE-001", "inconsistencia_documental",
     "La «Sesión Permanente No. 01» (4 dic 2024 y 10 dic 2025) se publica en la Gaceta como sesión ordinaria con el número 1, igual que la Ordinaria 01. "
     "Puede ser correcto (sesión del periodo ordinario declarada permanente), pero comparte número; en la base se trata como sesión aparte (código SPE).", "abierta", "", "", "", ""),
    ("OBS-ASI-03", "asistencias", "S-A1-PO1-SOL-005 / DIP-145 y S-A2-PO2-ORD-008 / DIP-149", "dato_faltante",
     "En la lista de la Gaceta de la Solemne 5 (26 nov 2024) y de la Ordinaria 8 (20 may 2026) una persona no tiene ninguna marca (Jaime Enrique Sotelo García y Martha Elia Farías Ríos).",
     "resuelta", "Resuelto con el pase de lista de cada acta: ambas personas estaban presentes.", "", "EV-ACTA-2024-11-26-145", "2026-10-31"),
    ("OBS-ASI-04", "asistencias", "(todas)", "criterio",
     "Qué registra la lista de asistencia de la Gaceta cuando el acta tiene más de un pase de lista.", "resuelta",
     "La lista de la Gaceta coincide con el ÚLTIMO pase de lista del acta (el de confirmación) en 1,853 de 1,863 registros de actas con dos o más pases (99.5 %); en las actas con un solo pase coincide en 784 de 785. "
     "«Falta justificada» significa que la persona no estaba en ese pase: pudo estar al inicio de la sesión, votar y salir, o llegar después.",
     "", "", "2026-10-31"),
    ("OBS-INT-01", "intervenciones", "(actas con nombres mal escritos)", "errata_fuente",
     "Las actas escriben mal algunos nombres («Batatamente», «Lonzao», «Carrilo», «Ramriez», «Carrreto», «Albeto», «Ernique», «Judeith»). En la base se atribuyen a la persona correcta; el original no cambia.",
     "abierta", "", "", "", ""),
    ("OBS-ACT-01", "evidencias", "Acta del 14 oct 2026", "dato_faltante",
     "El acta de la Ordinaria 02 del tercer año (14 oct 2026) aparece en la lista de la Gaceta sin archivo.", "abierta", "", "", "", ""),
    ("OBS-EXH-05", "exhortos", "(respuesta sin vincular)", "dato_faltante",
     "La respuesta de la CFE (oficio SZC-039-2026, dirigido a los diputados de Movimiento Ciudadano; síntesis del 25 jun 2026) no se pudo ligar a ningún punto de acuerdo.",
     "abierta", "", "", "", ""),
    ("OBS-EXH-06", "exhortos", "(todos)", "dato_faltante",
     "No se publican los oficios con que el Congreso envía los exhortos a las autoridades; la fecha de envío no puede documentarse.", "abierta", "", "", "", ""),
    ("OBS-GEO-01", "distritos", "(cartografía del mapa y buscador por sección)", "version_cartografia",
     "El mapa usa la capa DISTRITO_LOCAL de la Base Geográfica Digital de Colima del INE con corte de enero de 2026, posterior a la elección de 2024. "
     "Las páginas de distritos del IEE dan otros números de secciones (411 en total), pero corresponden a datos de 2020.",
     "resuelta",
     "Cotejo sección por sección con la base del PREP 2024 del IEE (cada casilla con su sección y su distrito local): de las 381 secciones que existen en ambas, "
     "380 están en el mismo distrito y solo la 0020 (Colima) pasó del distrito 2 al 1. Las 7 secciones de 2024 que ya no existen (0060, 0139, 0146, 0236, 0248, 0250 y 0280) "
     "se dividieron en 46 secciones nuevas (0401 a 0446) de los mismos distritos. El buscador por sección usa el distrito de 2024 y avisa del cambio de la 0020.",
     "", "EV-IEE-PREP-2024", "2026-11-01"),
    ("OBS-COM-01", "comisiones", "(varias)", "inconsistencia_documental",
     "El número de reuniones de la página de comisiones no coincide con el de los informes anuales (p. ej., Hacienda: 47 en la página; 56 y 67 en los informes).",
     "abierta", "", "EV-CONG-COMISIONES", "", ""),
]


def main() -> None:
    observaciones: list[dict] = []
    resueltos, restantes, votaron_sin_asistencia = cuadre_votaciones(observaciones)
    evidencias = leer_csv("evidencias")
    if not any(e["id_fuente"] == "EV-IEE-PREP-2024" for e in evidencias):
        evidencias.append({"id_fuente": "EV-IEE-PREP-2024", "tipo": "otro", "titulo": "Base de datos del PREP 2024, diputaciones locales (casillas con sección y distrito local)",
                           "institucion": "Instituto Electoral del Estado de Colima", "url": "https://ieecolima.org.mx/PREP_24/20240602_0819_PREP_COL.zip",
                           "fecha_documento": "2024-06-03", "fecha_consulta": HOY, "oficial": "si", "pagina": "", "notas": "Se usa solo la relación sección–distrito local, no los resultados preliminares."})
        escribir("evidencias", list(evidencias[0].keys()), evidencias)
    evid = {e["id_fuente"] for e in evidencias}
    for (oid, tabla, reg, tipo, desc, estado, resol, fte, fte_res, f_res) in REVISION:
        observaciones.append({"id_observacion": oid, "tabla": tabla, "id_registro": reg, "tipo": tipo, "descripcion": desc, "confianza": "",
                              "estado": estado, "resolucion": resol, "id_fuente": fte if fte in evid else "",
                              "id_fuente_resolucion": fte_res if fte_res in evid else "", "fecha_registro": HOY if estado == "abierta" else f_res, "fecha_resolucion": f_res})
    observaciones.append({"id_observacion": "OBS-ASI-01", "tabla": "asistencias", "id_registro": "(páginas de la Gaceta con dos listas)", "tipo": "fuente_ambigua",
                          "descripcion": "Cuando hay dos sesiones del mismo tipo el mismo día, o la Comisión Permanente se publica como «extraordinaria», la Gaceta junta las listas en "
                                         "una sola página y las marcas no coinciden.",
                          "confianza": "", "estado": "abierta" if restantes else "resuelta",
                          "resolucion": f"{resueltos} registros resueltos con el último pase de lista del acta de cada sesión. "
                                        + (f"Quedan sin verificar los de: {', '.join(restantes)} (sin acta, o el acta da solo el número de faltas sin nombres)." if restantes else ""),
                          "id_fuente": "", "id_fuente_resolucion": "", "fecha_registro": HOY, "fecha_resolucion": HOY})
    observaciones.append({"id_observacion": "OBS-ASI-05", "tabla": "asistencias", "id_registro": "(ver columna observaciones)", "tipo": "voto_sin_asistencia",
                          "descripcion": f"En {votaron_sin_asistencia} registros persona–sesión el acta registra votos nominales de alguien que la lista oficial no tiene como presente.",
                          "confianza": "", "estado": "resuelta", "resolucion": "Se explica por el criterio de OBS-ASI-04 (la lista registra el pase de confirmación). Cada registro lleva la "
                          "observación; la asistencia oficial no se modifica.", "id_fuente": "", "id_fuente_resolucion": "", "fecha_registro": HOY, "fecha_resolucion": HOY})
    escribir("observaciones", COL_OBS, observaciones)
    print("  observaciones:", dict(Counter(o["estado"] for o in observaciones)))


if __name__ == "__main__":
    main()
