"""
Asigna la fecha de presentación de cada iniciativa buscándola en las síntesis de
comunicaciones (sección "Iniciativas de ley o decreto") y en las actas de sesión
("presentó una iniciativa…"). La fecha es la de la sesión en que se dio cuenta de ella.

Criterio: similitud entre la descripción oficial de la iniciativa y el texto de la
síntesis/acta, ponderando las palabras poco frecuentes (IDF). Solo se acepta una
coincidencia clara (puntaje mínimo y ventaja sobre la segunda opción). Lo que no
coincide con claridad queda sin fecha: no se estima.
"""
from __future__ import annotations

import json
import math
import re
import unicodedata
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CRUDOS = RAIZ / "datos_crudos" / "congreso"
VACIAS = set("""a al ante bajo con contra de del desde durante en entre hacia hasta mediante para por segun sin sobre tras
el la los las un una unos unas lo y o u e ni que se su sus es son ser como mas este esta estos estas ese esa cual cuales
cuyo donde cuando mismo misma asi tambien ya no si le les ha han hay fue sea sean dicho dicha cada otro otra otros otras
iniciativa iniciativas proyecto decreto ley leyes propone relativa reforma reformar reforman adiciona adicionar
adicionan deroga derogar diversas disposiciones articulo articulos fraccion fracciones parrafo estado colima libre
soberano diputada diputado diputadas diputados integrante integrantes grupo parlamentario legislatura suscrita
presentada presento propuso traves cual mediante objeto objetivo materia""".split())


def norm(t: str) -> list[str]:
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return [w for w in re.findall(r"[a-zñ0-9]+", t) if len(w) > 2 and w not in VACIAS]


def items_sintesis() -> list[dict]:
    salida = []
    idx = json.loads((CRUDOS / "sintesis" / "indice.json").read_text(encoding="utf-8"))
    for doc in idx:
        if not doc.get("archivo"):
            continue
        lineas = (CRUDOS / "sintesis" / doc["archivo"]).read_text(encoding="utf-8").split("\n")
        dentro = False
        for l in lineas:
            ll = l.strip().lower()
            if re.match(r"^(iniciativas?( de ley| de ley o decreto| con proyecto)?\.?|iniciativas de ley o decreto)\s*$", ll) or ll.startswith("iniciativas de ley"):
                dentro = True
                continue
            if dentro and re.match(r"^(respuestas?|solicitudes|comunicaciones|atentamente|colima, col|oficios?|puntos de acuerdo)", ll) and len(ll) < 90:
                dentro = False
            if dentro and len(ll) > 40 and not ll.startswith("no se presentaron"):
                salida.append({"fecha": doc["fecha"], "texto": l.strip(), "origen": "sintesis", "url": doc.get("url", "")})
    return salida


def items_actas() -> list[dict]:
    salida = []
    idx = json.loads((CRUDOS / "actas" / "indice.json").read_text(encoding="utf-8"))
    for doc in idx:
        if not doc.get("archivo"):
            continue
        for p in (CRUDOS / "actas" / doc["archivo"]).read_text(encoding="utf-8").split("\n"):
            if re.search(r"(present[óo]|dio lectura a|expuso)\s+(una|la|su|el)\s+(iniciativa|propuesta)", p, re.I):
                salida.append({"fecha": doc["fecha"], "texto": p.strip(), "origen": "acta", "url": doc.get("url", "")})
    return salida


def asignar(iniciativas: list[dict], minimo: float = 0.45, ventaja: float = 0.12) -> dict[str, dict]:
    """iniciativas: [{id, descripcion}] → {id: {fecha, puntaje, origen, url, texto}}"""
    cand = items_sintesis() + items_actas()
    toks = [set(norm(c["texto"])) for c in cand]
    df = Counter(t for s in toks for t in s)
    n = len(cand) or 1
    idf = lambda t: math.log((n + 1) / (df.get(t, 0) + 1)) + 1
    res = {}
    for ini in iniciativas:
        a = set(norm(ini["descripcion"]))
        if len(a) < 3:
            continue
        total = sum(idf(t) for t in a)
        puntajes = []
        for c, b in zip(cand, toks):
            comun = a & b
            if not comun:
                continue
            cobertura = sum(idf(t) for t in comun) / total
            precision = sum(idf(t) for t in comun) / (sum(idf(t) for t in b) or 1)
            puntajes.append((0.75 * cobertura + 0.25 * precision, c))
        if not puntajes:
            continue
        puntajes.sort(key=lambda x: -x[0])
        mejor, c = puntajes[0]
        # misma iniciativa citada en varias sesiones: se toma la primera fecha entre las casi iguales
        casi = [x for x in puntajes if x[0] >= mejor - 0.03]
        fechas_distintas = sorted({x[1]["fecha"] for x in casi})
        segundo = next((x[0] for x in puntajes if x[1]["fecha"] not in fechas_distintas), 0)
        if mejor >= minimo and (mejor - segundo) >= ventaja:
            primero = min(casi, key=lambda x: x[1]["fecha"])[1]
            res[ini["id"]] = {"fecha": primero["fecha"], "puntaje": round(mejor, 3), "origen": primero["origen"], "url": primero["url"], "texto": primero["texto"][:300]}
    return res


def filtrar_por_orden(asignadas: dict[str, dict], numero: dict[str, int]) -> tuple[dict[str, dict], list[str]]:
    """Las iniciativas se numeran en orden de registro: conserva la mayor secuencia de fechas
    no decreciente según el número (subsecuencia más larga) y descarta las demás coincidencias."""
    ids = sorted(asignadas, key=lambda i: numero[i])
    fechas = [asignadas[i]["fecha"] for i in ids]
    # subsecuencia no decreciente más larga, O(n^2) basta para unos cientos
    largo = [1] * len(ids)
    previo = [-1] * len(ids)
    for j in range(len(ids)):
        for i in range(j):
            if fechas[i] <= fechas[j] and largo[i] + 1 > largo[j]:
                largo[j], previo[j] = largo[i] + 1, i
    k = max(range(len(ids)), key=lambda x: largo[x]) if ids else -1
    conservar = set()
    while k != -1:
        conservar.add(ids[k])
        k = previo[k]
    return {i: v for i, v in asignadas.items() if i in conservar}, [i for i in ids if i not in conservar]


def intervalo(numero_obj: int, anclas: list[tuple[int, str]]) -> tuple[str, str]:
    """Fechas de las iniciativas anclada anterior y siguiente."""
    antes = [f for n, f in anclas if n < numero_obj]
    despues = [f for n, f in anclas if n > numero_obj]
    return (max(antes) if antes else ""), (min(despues) if despues else "")
