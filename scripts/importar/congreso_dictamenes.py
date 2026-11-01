"""
Importa los dictámenes de la LXI Legislatura (lista oficial de la Gaceta) y los relaciona con:
- las comisiones dictaminadoras (columna «Comisión dictaminadora» de la lista),
- la iniciativa que resuelven y el decreto que generaron (comparación de textos oficiales),
- su votación en el Pleno (actas de sesión: resultado y totales oficiales).

Requiere: congreso_asistencias.py, congreso_asuntos.py y congreso_actas.py.
Actualiza public/datos/oficial/asuntos.csv (dictámenes DIC-*, y en las iniciativas: fecha y
resultado del dictamen) y asunto_comisiones.csv (fecha de dictamen por comisión).

Uso: python scripts/importar/congreso_dictamenes.py [--refrescar]

Una relación solo se registra si la coincidencia es clara; lo dudoso queda sin relacionar y se
explica en notas. Nunca se infiere un resultado de votación que no esté en el acta.
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
import actas_parser  # noqa: E402
from coincidencias import Indice, cuerpo_dictamen, municipios_en  # noqa: E402
from congreso_asistencias import GACETA, texto  # noqa: E402
from congreso_asuntos import EVID, ev, escribir, leer_csv, lista_gaceta, url_abs  # noqa: E402
from fechas_presentacion import norm  # noqa: E402


def dias(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def comisiones_en(txt: str, comisiones: list[dict]) -> list[str]:
    """Comisiones nombradas en el texto, tolerando erratas (70 % de sus palabras presentes)."""
    b = set(norm(txt))
    hallados = []
    for c in comisiones:
        k = set(norm(c["nombre"]))
        if k and len(k & b) / len(k) >= 0.7:
            hallados.append(c["id_comision"])
    return hallados


def lista_dictamenes(refrescar: bool) -> list[dict]:
    sopa = BeautifulSoup(lista_gaceta("tdictamenes", refrescar), "html.parser")
    salida, vistos = [], set()
    for n in sopa.find_all("div", attrs={"title": "No. Dictamen"}):
        f = n.parent
        desc = " ".join(f.find("div", attrs={"title": "Descripción"}).get_text(" ").split())
        fecha = texto(f.find("div", attrs={"title": "Fecha"}))
        comision = texto(f.find("div", attrs={"title": "Iniciador"}))
        m = re.search(r"No\.\s*Dictamen\s+(\d+)", desc)
        num = int(m.group(1)) if m else None
        clave = (num, fecha, " ".join(norm(desc))[:200])
        if clave in vistos:  # la Gaceta repite algunos renglones
            continue
        vistos.add(clave)
        pdf = [a["href"] for a in f.find_all("a", href=True) if a["href"].lower().endswith(".pdf")]
        salida.append({"numero": num, "fecha": fecha, "comision_texto": comision, "descripcion": re.sub(r"^No\.\s*Dictamen\s+\d+\s*", "", desc), "url": url_abs(pdf[0]) if pdf else ""})
    return salida


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refrescar", action="store_true")
    args = ap.parse_args()

    asuntos = [a for a in leer_csv("asuntos") if not a["id_asunto"].startswith("DIC-")]
    if not asuntos:
        sys.exit("Primero corra congreso_asuntos.py.")
    # Las filas de dictámenes (DIC-) las escribe este mismo script: se descartan para poder volver a correrlo.
    turnos = [t for t in leer_csv("asunto_comisiones") if not t["id_asunto"].startswith("DIC-")]
    coms = leer_csv("comisiones")
    nombre_com = {c["id_comision"]: c["nombre"] for c in coms}
    turnos_de: dict[str, set[str]] = {}
    for t in turnos:
        turnos_de.setdefault(t["id_asunto"], set()).add(t["id_comision"])
    ini = {a["id_asunto"]: a for a in asuntos if a["id_asunto"].startswith("INI-")}
    dec = {a["id_asunto"]: a for a in asuntos if a["tipo"] == "decreto"}
    idx_ini = Indice((k, v["descripcion"]) for k, v in ini.items())
    idx_dec = Indice((k, v["descripcion"]) for k, v in dec.items())
    mun_ini = {k: municipios_en(v["descripcion"]) for k, v in ini.items()}
    mun_dec = {k: municipios_en(v["descripcion"]) for k, v in dec.items()}

    print("1/3 Lista de dictámenes…")
    lista = lista_dictamenes(args.refrescar)
    print(f"   {len(lista)} dictámenes únicos")
    print("2/3 Votaciones en actas…")
    segs = [s for s in actas_parser.todas() if s["tipo"] == "dictamen"]
    usados_seg: set[int] = set()

    ev_lista = ev("EV-GACETA-DICTAMENES", "gaceta", "Gaceta Parlamentaria: lista de dictámenes de la LXI Legislatura", f"{GACETA}?v=tdictamenes&l=61")
    nuevos, ids = [], set()
    stats = {"iniciativa": 0, "decreto": 0, "votacion": 0}
    for d in sorted(lista, key=lambda x: (x["fecha"], x["numero"] or 0)):
        base_id = f"DIC-61-{d['fecha'].replace('-', '')}-{(d['numero'] or 0):03d}"
        id_ = base_id
        k = 2
        while id_ in ids:
            id_ = f"{base_id}-{k}"
            k += 1
        ids.add(id_)
        cuerpo = cuerpo_dictamen(d["descripcion"])
        cs = comisiones_en(d["comision_texto"], coms) or comisiones_en(d["descripcion"][:500], coms)
        mu = municipios_en(cuerpo)
        notas = [f"Comisión(es) dictaminadora(s) según la Gaceta: {d['comision_texto']}."]

        # Decreto que generó (aprobado en o después de la fecha del dictamen, mismo municipio si aplica)
        perm_d = {i for i, v in dec.items() if v["fecha_aprobacion"] and v["fecha_aprobacion"] >= d["fecha"] and dias(d["fecha"], v["fecha_aprobacion"]) <= 200 and (not mu or mun_dec[i] == mu)}
        id_dec, _ = idx_dec.mejor(cuerpo, perm_d, 0.4, 0.08)
        # Iniciativa que resuelve
        perm_i = {i for i, v in ini.items() if (not cs or turnos_de.get(i, set()) & set(cs)) and (not v["fecha_presentacion"] or v["fecha_presentacion"] <= d["fecha"]) and (not mu or mun_ini[i] == mu)}
        id_ini, _ = idx_ini.mejor(cuerpo, perm_i, 0.4, 0.08)
        if not id_ini and id_dec and dec[id_dec]["id_asunto_origen"]:
            o = ini.get(dec[id_dec]["id_asunto_origen"])
            if o and (not o["fecha_presentacion"] or dias(d["fecha"], o["fecha_presentacion"]) <= 10):
                id_ini = o["id_asunto"]
                notas.append("Iniciativa de origen tomada del decreto relacionado.")
        stats["iniciativa"] += bool(id_ini)
        stats["decreto"] += bool(id_dec)

        # Votación: segmento de acta con el mismo número de dictamen, en los 150 días siguientes,
        # que mencione al menos una de las comisiones dictaminadoras.
        candidatos = []
        for j, s in enumerate(segs):
            if j in usados_seg or s["numero_dictamen"] != d["numero"] or not s["fecha"] or s["fecha"] < d["fecha"] or dias(d["fecha"], s["fecha"]) > 150:
                continue
            if cs and not (set(comisiones_en(s["cabeza"], coms)) & set(cs)):
                continue
            candidatos.append((s["fecha"], j))
        voto = None
        if candidatos:
            _, j = min(candidatos)
            usados_seg.add(j)
            voto = segs[j]
            stats["votacion"] += 1

        if voto and voto["resultado"] == "aprobado" and id_dec and dec[id_dec]["fecha_aprobacion"] != voto["fecha"]:
            notas.append(f"Se descartó la relación con el {dec[id_dec]['numero_decreto_acuerdo']}: su fecha de aprobación no coincide con la votación del dictamen.")
            id_dec = None
        estado, f_vot, res_vot, f_aprob = "pendiente", "", "", ""
        if voto and voto["resultado"] == "aprobado":
            estado, f_vot, res_vot, f_aprob = "aprobado", voto["fecha"], "aprobado", voto["fecha"]
            tot = "por unanimidad" if voto["unanimidad"] else f"{voto['favor']} a favor, {voto['contra']} en contra y {voto['abstencion']} abstenciones"
            notas.append(f"Aprobado por el Pleno el {voto['fecha']} ({tot}), según el acta: {voto['url_acta']}")
        elif voto and voto["resultado"] == "rechazado":
            estado, f_vot, res_vot = "rechazado", voto["fecha"], "rechazado"
            notas.append(f"Rechazado por el Pleno el {voto['fecha']}, según el acta: {voto['url_acta']}")
        elif voto and voto["resultado"] == "regresa_comision":
            notas.append(f"El {voto['fecha']} el Pleno lo regresó a comisión, según el acta: {voto['url_acta']}")
        if id_dec and estado == "pendiente":
            estado, f_aprob = "aprobado", dec[id_dec]["fecha_aprobacion"]
            notas.append(f"Votación no localizada en las actas; se considera aprobado porque generó el {dec[id_dec]['numero_decreto_acuerdo']}.")
        if id_dec and dec[id_dec]["fecha_publicacion"] and estado == "aprobado":
            estado = "publicado"
        if estado == "pendiente":
            notas.append("No se localizó su votación en las actas ni un decreto relacionado.")

        nuevos.append({
            "id_asunto": id_, "tipo": "dictamen", "titulo": f"Dictamen {d['numero'] or 's/n'}: {cuerpo[:260]}", "descripcion": d["descripcion"],
            "tema": nombre_com.get(cs[0], "") if cs else "", "fecha_presentacion": d["fecha"], "expediente": f"Dictamen {d['numero'] or 's/n'} ({d['comision_texto']})",
            "estado_procesal": estado, "fecha_dictamen": d["fecha"], "resultado_dictamen": "", "fecha_votacion": f_vot, "resultado_votacion": res_vot, "fecha_aprobacion": f_aprob,
            "numero_decreto_acuerdo": dec[id_dec]["numero_decreto_acuerdo"] if id_dec else "", "fecha_publicacion": dec[id_dec]["fecha_publicacion"] if id_dec else "",
            "id_asunto_origen": id_ini or "", "url_ficha": f"{GACETA}?v=tdictamenes&l=61", "url_documento": d["url"], "id_fuente": ev_lista, "estado_verificacion": "verificado",
            "notas": "", "_comisiones": cs, "_notas": notas,
        })

        # Datos del dictamen en la iniciativa que resuelve
        if id_ini and ini[id_ini]["fecha_presentacion"] and d["fecha"] < ini[id_ini]["fecha_presentacion"]:
            a = ini[id_ini]
            brecha = dias(d["fecha"], a["fecha_presentacion"])
            if brecha <= 10:
                # Trámite abreviado: el Pleno conoció la iniciativa en la misma sesión que votó su dictamen.
                a["notas"] += (f" Se dio cuenta al Pleno el {a['fecha_presentacion']}, después de su dictamen del {d['fecha']} (trámite abreviado);"
                               " la fecha de recepción no se publica, por lo que se deja solo el año legislativo.")
                a["fecha_presentacion"] = ""
                a["anio_legislativo"] = next((str(n) for n, x, y in [(1, "2024-10-01", "2025-09-30"), (2, "2025-10-01", "2026-09-30"), (3, "2026-10-01", "2027-09-30")] if x <= d["fecha"] <= y), "")
            else:
                notas.append(f"Se descartó la relación con {id_ini}: el dictamen es anterior a la presentación de esa iniciativa.")
                nuevos[-1]["id_asunto_origen"] = ""
                id_ini = None
        if id_ini:
            a = ini[id_ini]
            if not a["fecha_dictamen"] or d["fecha"] < a["fecha_dictamen"]:
                a["fecha_dictamen"] = d["fecha"]
                a["resultado_dictamen"] = f"Dictamen {d['numero'] or 's/n'} de {d['comision_texto'].title()}"
                if a["estado_procesal"] in ("presentado", "turnado"):
                    a["estado_procesal"] = "dictaminado"
                if f_vot and not a["fecha_votacion"]:
                    a["fecha_votacion"], a["resultado_votacion"] = f_vot, res_vot
            for t in turnos:
                if t["id_asunto"] == id_ini and t["id_comision"] in cs and (not t["fecha_dictamen"] or d["fecha"] < t["fecha_dictamen"]):
                    t["fecha_dictamen"] = d["fecha"]

    for n in nuevos:
        n["notas"] = " ".join(n.pop("_notas"))
    print(f"   relacionados: {stats['iniciativa']} con iniciativa, {stats['decreto']} con decreto, {stats['votacion']} con votación en acta")
    print("3/3 Escribiendo…")
    cols = list(leer_csv("asuntos")[0].keys())
    escribir("asuntos", cols, asuntos + nuevos)
    # Comisión o comisiones que elaboraron cada dictamen (rol «dictaminadora»; fecha_dictamen = fecha del dictamen).
    elaboro = [{"id_asunto": n["id_asunto"], "id_comision": c, "rol": "dictaminadora", "fecha_turno": "", "fecha_dictamen": n["fecha_dictamen"], "id_fuente": n["id_fuente"]}
               for n in nuevos for c in dict.fromkeys(n["_comisiones"])]
    escribir("asunto_comisiones", list(turnos[0].keys()), turnos + elaboro)
    existentes = {e["id_fuente"]: e for e in leer_csv("evidencias")}
    existentes.update({k: v for k, v in EVID.items() if k not in existentes})
    escribir("evidencias", ["id_fuente", "tipo", "titulo", "institucion", "url", "fecha_documento", "fecha_consulta", "oficial", "pagina", "notas"], list(existentes.values()))
    # Comisiones dictaminadoras de cada dictamen (para la entrega; no se suman a los turnos)
    # Comisiones dictaminadoras de cada dictamen: archivo auxiliar para la entrega (no forma parte del esquema).
    import csv as _csv
    from congreso_asistencias import CRUDOS
    with open(CRUDOS / "dictamen_comisiones.csv", "w", newline="", encoding="utf-8") as f:
        w = _csv.writer(f)
        w.writerow(["id_asunto", "id_comision"])
        w.writerows((n["id_asunto"], c) for n in nuevos for c in n["_comisiones"])


if __name__ == "__main__":
    main()
