"""Copias de las actas con las dudas subrayadas y un comentario al margen.

Genera entrega/actas_subrayadas/ (Word) para revisar con la taquígrafa parlamentaria:
- votaciones cuya lista nominal no coincide con el total declarado;
- voto rectificado;
- nombres mal escritos;
- exhortos sin resultado localizado.
"""
import copy
import html
import csv
import re
import shutil
import sys
import unicodedata
import zipfile
from pathlib import Path

import docx
from docx.enum.text import WD_COLOR_INDEX
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from lxml import etree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from congreso_votaciones import LISTA_INICIO, RESULTADO as RESULTADO_V  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
ACTAS = RAIZ / "datos_crudos" / "congreso" / "actas"
REVISION = Path(sys.argv[1]) if len(sys.argv) > 1 else None
SALIDA = RAIZ / "entrega" / "actas_subrayadas"
AUTOR = "Observatorio Legislativo"

def sin_acentos(t):
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn").lower()


def subrayar(parrafo, inicio, fin):
    """Resalta en amarillo y subraya los caracteres [inicio, fin) del párrafo; devuelve los runs resaltados."""
    resaltados, pos = [], 0
    for run in list(parrafo.runs):
        texto = run.text
        a, b = pos, pos + len(texto)
        pos = b
        if b <= inicio or a >= fin or not texto:
            continue
        cortes = [(0, max(inicio - a, 0)), (max(inicio - a, 0), min(fin - a, len(texto))), (min(fin - a, len(texto)), len(texto))]
        anterior = run._r
        for i, (x, y) in enumerate(cortes):
            if x >= y:
                continue
            nuevo = copy.deepcopy(run._r)
            anterior.addnext(nuevo)
            anterior = nuevo
            r = docx.text.run.Run(nuevo, parrafo)
            r.text = texto[x:y]
            if i == 1:
                r.font.highlight_color = WD_COLOR_INDEX.YELLOW
                r.font.underline = True
                resaltados.append(r)
        run._r.getparent().remove(run._r)
    return resaltados


def texto_runs(p):
    return "".join(r.text for r in p.runs)


def marcar(doc, p, inicio, fin, comentario):
    runs = subrayar(p, inicio, fin)
    if runs and comentario:
        doc.add_comment(runs if len(runs) > 1 else runs[0], text=comentario, author=AUTOR, initials="OL")
    return bool(runs)


def marcar_frase(doc, frase, comentario, todas=False):
    n = 0
    clave = sin_acentos(frase)
    for p in parrafos_docx(doc):
        while True:
            t = sin_acentos(texto_runs(p))
            i = t.find(clave)
            if i < 0 or (n and not todas):
                break
            # evita volver a marcar lo ya resaltado
            if any(r.font.highlight_color == WD_COLOR_INDEX.YELLOW for r in p.runs if r.text and clave in sin_acentos(r.text)):
                break
            marcar(doc, p, i, i + len(frase), comentario)
            n += 1
            if not todas:
                break
    return n


def parrafos_docx(doc):
    """Párrafos del Word con texto, en el mismo orden y criterio con que se generó el .txt del acta."""
    salida = []
    for el in doc.element.body.iter(qn("w:p")):
        crudo = html.unescape(re.sub(r"<[^>]+>", "", etree.tostring(el, encoding="unicode"))).strip()
        if crudo:
            salida.append(Paragraph(el, doc))
    return salida


def buscar_flexible(p, frase, desde=0):
    """Posición de la frase en el párrafo, tolerando espacios distintos."""
    rx = re.compile(r"\s*".join(re.escape(c) for c in frase.replace(" ", "")), re.I)
    m = rx.search(texto_runs(p), desde)
    return (m.start(), m.end()) if m else None


def votaciones(doc, filas, txt):
    """Ubica cada votación con diferencia por su número dentro del acta (igual que el importador) y la marca."""
    texto = txt.replace("\n", " \n")
    pars = parrafos_docx(doc)
    resultados = list(RESULTADO_V.finditer(texto))
    marcadas = 0
    for f in filas:
        k = int(f["id_votacion"].rsplit("-", 1)[1])
        if k > len(resultados):
            continue
        m = resultados[k - 1]
        previo = resultados[k - 2].end() if k > 1 else 0
        i_res = texto.count("\n", 0, m.start())
        li = list(LISTA_INICIO.finditer(texto, previo, m.start()))
        i_lista = texto.count("\n", 0, li[-1].start()) if li else i_res
        p = pars[i_res]
        # misma frase puede repetirse en el párrafo: se cuenta cuántas veces aparece antes, dentro del .txt
        inicio_par = texto.rfind("\n", 0, m.start()) + 1
        antes_en_par = texto[inicio_par:m.start()].lower().count(m.group(0).lower()[:40])
        pos, desde = None, 0
        for _ in range(antes_en_par + 1):
            pos = buscar_flexible(p, m.group(0)[:120], desde)
            if not pos:
                break
            desde = pos[1]
        nota = (f"El acta declara {f['total_oficial_favor']} a favor, {f['total_oficial_contra']} en contra y {f['total_oficial_abstencion']} abstenciones, "
                f"pero la lista nominal suma {f['votos_en_lista_favor']} a favor, {f['votos_en_lista_contra']} en contra y {f['votos_en_lista_abstencion']} abstenciones. "
                "¿Cuál es el dato oficial?")
        if f["presentes_en_asistencia_sin_voto_en_la_lista"]:
            nota += f" Con asistencia pero sin voto en la lista: {f['presentes_en_asistencia_sin_voto_en_la_lista']}. ¿Votaron?"
        # nombres dentro de la lista (del final al inicio para no mover posiciones)
        marcas = []
        sin_sentido = [x.strip() for x in f["renglones_sin_sentido"].split(";") if x.strip()]
        repetidos = [x.strip() for x in f["nombres_repetidos"].split(";") if x.strip()]
        for j in range(i_lista, i_res + 1):
            q = pars[j]
            for nombre in sin_sentido:
                r = buscar_flexible(q, nombre)
                if r:
                    marcas.append((j, r, f"Renglón sin sentido de voto: no dice a favor, en contra ni abstención. ¿Cómo votó {nombre.replace('Dip. ', '')}?"))
            for nombre in repetidos:
                r, desde, vistos = True, 0, 0
                while True:
                    r = buscar_flexible(q, nombre, desde)
                    if not r:
                        break
                    vistos += 1
                    if vistos > 1:
                        marcas.append((j, r, f"{nombre} aparece dos veces en esta votación. ¿Este renglón era el voto de otra persona?"))
                    desde = r[1]
        hechas = False
        for j, (a, b), c in sorted(marcas, key=lambda x: (x[0], x[1][0]), reverse=True):
            if j == i_res and pos and a >= pos[0]:
                continue
            hechas |= marcar(doc, pars[j], a, b, c)
        if pos:
            hechas |= marcar(doc, p, pos[0], pos[1], nota)
        marcadas += hechas
    return marcadas


NOMBRES = {
    "Batatamente": "Bustamante (Evangelina Bustamante Morales)",
    "Lonzao": "Lozano (Álvaro Lozano González)",
    "Carrilo": "Carrillo (Yommira Jockimber Carrillo Barreto)",
    "Ramriez": "Ramírez (Isamar Ramírez Rodríguez)",
    "Carrreto": "Carreto (Betzaida Luz Alondra Pinzón Carreto)",
    "Albeto": "Alberto (Jesús Alberto Partida Valencia)",
    "Ernique": "Enrique (Jaime Enrique Sotelo García)",
    "Judeith": "Judith (Karen Judith Jurado Escamilla)",
}

EXHORTOS = {
    "2026-07-15": "propuso exhortar a la Titular del Poder Ejecutivo del Estado",
    "2025-05-29": "dio lectura a un Punto de Acuerdo para exhortar a que las autoridades",
    "2024-12-04": "el Diputado Jaime Enrique Sotelo García, señaló que los",
}
NOTA_EXHORTO = "No se encontró en el acta si este punto de acuerdo se votó, se turnó a comisión o quedó pendiente. ¿Cuál fue su resultado?"
NOTA_RECTIFICO = "Voto rectificado: ¿cuál cuenta como oficial? ¿El total del acta ya incluye el voto corregido?"


def main():
    if SALIDA.exists():
        shutil.rmtree(SALIDA)
    SALIDA.mkdir(parents=True)
    filas = list(csv.DictReader(open(REVISION / "01_votaciones_con_diferencia.csv", encoding="utf-8-sig")))
    por_acta = {}
    for f in filas:
        por_acta.setdefault(f["archivo_acta"], []).append(f)

    trabajos = {}  # archivo -> lista de etiquetas
    for archivo in por_acta:
        trabajos.setdefault(archivo, []).append("votaciones")
    for w in NOMBRES:
        for txt in sorted(ACTAS.glob("*.txt")):
            if w in txt.read_text(errors="ignore"):
                trabajos.setdefault(txt.stem + ".docx", []).append("nombres")
    for fecha, frase in EXHORTOS.items():
        for txt in sorted(ACTAS.glob(f"{fecha}_*.txt")):
            if sin_acentos(frase) in sin_acentos(txt.read_text(errors="ignore")):
                trabajos.setdefault(txt.stem + ".docx", []).append("exhorto")
    for txt in sorted(ACTAS.glob("2024-10-31_*.txt")):
        if "rectificó su voto" in txt.read_text(errors="ignore"):
            trabajos.setdefault(txt.stem + ".docx", []).append("rectificado")

    resumen = []
    for archivo, tipos in sorted(trabajos.items()):
        doc = docx.Document(ACTAS / archivo)
        hechas = []
        if "votaciones" in tipos:
            n = votaciones(doc, por_acta[archivo], (ACTAS / archivo).with_suffix(".txt").read_text(encoding="utf-8"))
            hechas.append(f"{n} de {len(por_acta[archivo])} votaciones")
        if "rectificado" in tipos and marcar_frase(doc, "(momentos después se rectificó su voto siendo este en contra)", NOTA_RECTIFICO):
            hechas.append("voto rectificado")
        if "exhorto" in tipos:
            fecha = archivo[:10]
            if marcar_frase(doc, EXHORTOS[fecha], NOTA_EXHORTO):
                hechas.append("exhorto sin resultado")
        if "nombres" in tipos:
            for w, bien in NOMBRES.items():
                if marcar_frase(doc, w, f"Nombre mal escrito; debería decir «{bien}».", todas=True):
                    hechas.append(f"«{w}»")
        nombre = f"Acta_{archivo[:10]}_" + "_".join(sorted(set(tipos))) + ".docx"
        doc.save(SALIDA / nombre)
        resumen.append((nombre, ", ".join(hechas)))
        print(nombre, "|", ", ".join(hechas))

    with open(SALIDA / "00_LEEME.txt", "w", encoding="utf-8") as f:
        f.write("ACTAS CON LAS DUDAS SUBRAYADAS\n\n")
        f.write("Copias de las actas oficiales (Gaceta Parlamentaria del H. Congreso del Estado de Colima).\n")
        f.write("Cada duda está resaltada en amarillo y subrayada, con un comentario al margen que explica la pregunta.\n")
        f.write("Abra el archivo en Word y use Revisar > Comentarios para recorrerlas una por una.\n")
        f.write("El texto de las actas no se modificó; solo se agregaron resaltado y comentarios.\n\n")
        for n, h in resumen:
            f.write(f"{n}: {h}\n")
    zip_path = SALIDA.parent / "actas_subrayadas.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(SALIDA.iterdir()):
            z.write(p, p.name)
    print(zip_path)


if __name__ == "__main__":
    main()
