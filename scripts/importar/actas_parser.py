"""
Divide el texto de cada acta en segmentos, uno por documento leído y votado en el Pleno
(dictámenes, iniciativas con dispensa de trámite, puntos de acuerdo), y extrae:
- número de dictamen y texto (para relacionarlo con la lista oficial),
- quién dio lectura,
- resultado y totales ("se declaró aprobado por N votos a favor, N en contra y N abstenciones"),
- votos nominales ("Dip. Nombre, a favor; ..."), cuando el acta los transcribe.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ACTAS = RAIZ / "datos_crudos" / "congreso" / "actas"

INICIO = re.compile(r"(?i)(dio lectura|procedi[óo] a dar lectura|ley[óo]|present[óo])\s+(al?|el|la|del)\s+(del\s+)?(dictamen|iniciativa|punto de acuerdo|acuerdo)")
NUM_DICT = re.compile(r"(?i)dictamen\s+(?:n[úu]mero|no\.?|n°)?\s*(\d{1,3})")
RESULTADO = re.compile(r"(?i)se declar[óo]\s+(aprobad[oa]|rechazad[oa]|desechad[oa]|no aprobad[oa])\s+(?:en lo general[^,]*,\s*)?(?:por\s+)?(?:(?:la\s+)?unanimidad|(\d+)\s+\w+\s+votos?\s+a\s+favor,\s*(\d+)\s+\w+\s+votos?\s+en\s+contra\s+y\s+(\d+)\s+\w*\s*abstenci)")
VOTO = re.compile(r"(?i)Dip(?:utad[oa])?\.?\s+([A-ZÁÉÍÓÚÑ][^,;:]{5,60}?),\s*(a favor|en contra|abstenci[óo]n|se abstiene)")
REGRESA = re.compile(r"(?i)regres[ao] a (la |las )?comisi[óo]n")


def segmentos(texto: str) -> list[dict]:
    """Un segmento empieza donde se da lectura a un documento y termina donde empieza el siguiente."""
    parrafos = [p.strip() for p in texto.split("\n") if p.strip()]
    inicios = [i for i, p in enumerate(parrafos) if INICIO.search(p) and not p.lower().startswith(("lectura, discusión", "lectura discusión"))]
    salida = []
    for k, i in enumerate(inicios):
        fin = inicios[k + 1] if k + 1 < len(inicios) else len(parrafos)
        bloque = parrafos[i:fin]
        cuerpo = " ".join(bloque)
        cabeza = bloque[0]
        m = NUM_DICT.search(cabeza)
        r = RESULTADO.search(cuerpo)
        votos = [(v[0].strip(), "favor" if v[1].lower() == "a favor" else ("contra" if "contra" in v[1].lower() else "abstencion")) for v in VOTO.findall(cuerpo)]
        resultado = ""
        if r:
            resultado = "aprobado" if r.group(1).lower().startswith("aprobad") else "rechazado"
        elif REGRESA.search(cuerpo):
            resultado = "regresa_comision"
        salida.append({
            "tipo": "dictamen" if m or re.search(r"(?i)lectura\s+al?\s+(del\s+)?dictamen", cabeza) else ("punto_acuerdo" if re.search(r"(?i)punto de acuerdo", cabeza) else "iniciativa"),
            "numero_dictamen": int(m.group(1)) if m else None,
            "cabeza": cabeza[:1500],
            "resultado": resultado,
            "favor": int(r.group(2)) if r and r.group(2) else None,
            "contra": int(r.group(3)) if r and r.group(3) else None,
            "abstencion": int(r.group(4)) if r and r.group(4) else None,
            "unanimidad": bool(r and not r.group(2)),
            "votos": votos,
        })
    return salida


def todas() -> list[dict]:
    idx = json.loads((ACTAS / "indice.json").read_text(encoding="utf-8"))
    salida = []
    for doc in idx:
        if not doc.get("archivo"):
            continue
        for j, s in enumerate(segmentos((ACTAS / doc["archivo"]).read_text(encoding="utf-8"))):
            s.update({"fecha": doc["fecha"], "acta": doc["descripcion"], "url_acta": doc.get("url", ""), "orden": j})
            salida.append(s)
    return salida
