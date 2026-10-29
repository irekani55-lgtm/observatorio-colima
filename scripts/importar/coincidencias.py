"""Comparación de textos oficiales (descripciones de iniciativas, dictámenes, decretos) por palabras
poco frecuentes. Solo se usan coincidencias claras; lo dudoso se deja sin relacionar."""
from __future__ import annotations

import math
from collections import Counter
from typing import Iterable

from fechas_presentacion import norm


class Indice:
    def __init__(self, candidatos: Iterable[tuple[str, str]]):
        self.ids, self.toks = [], []
        for id_, txt in candidatos:
            self.ids.append(id_)
            self.toks.append(set(norm(txt)))
        df = Counter(t for s in self.toks for t in s)
        n = len(self.ids) or 1
        self.idf = {t: math.log((n + 1) / (c + 1)) + 1 for t, c in df.items()}

    def puntajes(self, texto: str, permitidos: set[str] | None = None) -> list[tuple[float, str]]:
        a = set(norm(texto))
        if len(a) < 3:
            return []
        peso = lambda ts: sum(self.idf.get(t, math.log(len(self.ids) + 1) + 1) for t in ts)
        total = peso(a)
        salida = []
        for id_, b in zip(self.ids, self.toks):
            if permitidos is not None and id_ not in permitidos:
                continue
            comun = a & b
            if comun:
                pc = peso(comun)
                salida.append((0.6 * pc / total + 0.4 * pc / (peso(b) or 1), id_))
        return sorted(salida, reverse=True)

    def mejor(self, texto: str, permitidos: set[str] | None = None, minimo: float = 0.45, ventaja: float = 0.1) -> tuple[str | None, float]:
        p = self.puntajes(texto, permitidos)
        if not p:
            return None, 0.0
        segundo = p[1][0] if len(p) > 1 else 0.0
        return (p[0][1], p[0][0]) if p[0][0] >= minimo and p[0][0] - segundo >= ventaja else (None, p[0][0])


MUNICIPIOS_NORM = ["armeria", "colima", "comala", "coquimatlan", "cuauhtemoc", "ixtlahuacan", "manzanillo", "minatitlan", "tecoman", "villa de alvarez"]


def municipios_en(texto: str) -> set[str]:
    """Municipios mencionados (sin contar «Colima» cuando es el nombre del estado)."""
    import re
    import unicodedata
    t = unicodedata.normalize("NFD", texto or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    t = re.sub(r"estado (libre y soberano )?de colima|congreso del estado de colima|colima, colima\b|, colima\b", " ", t)
    hallados = {m for m in MUNICIPIOS_NORM if m != "colima" and re.search(r"\b" + m + r"\b", t)}
    if re.search(r"municipio de colima|ayuntamiento de colima", t):
        hallados.add("colima")
    return hallados


def cuerpo_dictamen(texto: str) -> str:
    """Quita el encabezado repetitivo («DICTAMEN NÚMERO X ELABORADO POR LA COMISIÓN… CORRESPONDIENTE A»)."""
    import re
    t = re.sub(r"^\s*No\.\s*Dictamen\s+\d+\s*", "", texto)
    m = re.search(r"(?i)\b(correspondiente a|relativ[oa] a|por (el|la) que|mediante (el|la) cual|a trav[eé]s de (la|el) cual|que propone|respecto)\b", t)
    return t[m.start():] if m and m.start() < 400 else t
