/**
 * Conversión de GeoJSON a trazos SVG con d3-geo, y esquema hexagonal de
 * respaldo. Todo devuelve "formas" con la misma estructura, de modo que el
 * componente del mapa no distingue el origen.
 */
import { geoArea, geoIdentity, geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson';

export interface Forma {
  distrito: number;
  d: string;
  centro: [number, number];
}

export interface Mapa {
  ancho: number;
  alto: number;
  formas: Forma[];
  contorno?: string;
  geografico: boolean;
  advertencias: string[];
}

export function numeroDistrito(props: Record<string, unknown> | null, claves: string[]): number | null {
  if (!props) return null;
  for (const k of claves) {
    const v = props[k];
    if (v == null || v === '') continue;
    const n = Number(String(v).replace(/[^\d]/g, ''));
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

function esGeografico(fc: FeatureCollection): boolean {
  let ok = true;
  const revisar = (p: Position) => {
    if (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) ok = false;
  };
  for (const f of fc.features) {
    const g = f.geometry;
    if (g?.type === 'Polygon') g.coordinates.forEach((r) => r.forEach(revisar));
    if (g?.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => r.forEach(revisar)));
    if (!ok) break;
  }
  return ok;
}

/**
 * d3-geo usa la convención esférica (anillo exterior en sentido horario).
 * Los GeoJSON RFC 7946 vienen al revés; si un polígono "cubre el planeta"
 * se invierten sus anillos.
 */
function rebobinar(g: Geometry): Geometry {
  const invertir = (anillos: Position[][]) => anillos.map((r) => [...r].reverse());
  if (g.type === 'Polygon') {
    return geoArea(g as GeoPermissibleObjects) > 2 * Math.PI ? { ...g, coordinates: invertir(g.coordinates) } : g;
  }
  if (g.type === 'MultiPolygon') {
    return { ...g, coordinates: g.coordinates.map((p) => (geoArea({ type: 'Polygon', coordinates: p } as GeoPermissibleObjects) > 2 * Math.PI ? invertir(p) : p)) } as MultiPolygon;
  }
  return g;
}

export function mapaDesdeGeojson(fc: FeatureCollection, claves: string[], encuadre: [number, number, number, number], contornoFc?: FeatureCollection, ancho = 800): Mapa {
  const advertencias: string[] = [];
  const geografico = esGeografico(fc);
  const poligonos = fc.features.filter((f): f is Feature<Polygon | MultiPolygon> => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon');
  if (poligonos.length !== fc.features.length) advertencias.push(`${fc.features.length - poligonos.length} elementos no son polígonos y se omitieron.`);
  const feats = geografico ? poligonos.map((f) => ({ ...f, geometry: rebobinar(f.geometry) as Polygon | MultiPolygon })) : poligonos;

  const [o, s, e, n] = encuadre;
  const marco: GeoPermissibleObjects = geografico
    ? { type: 'Polygon', coordinates: [[[o, s], [o, n], [e, n], [e, s], [o, s]]] }
    : ({ type: 'FeatureCollection', features: feats } as GeoPermissibleObjects);

  let alto = Math.round(ancho * 0.72);
  // geoIdentity también implementa fitWidth/fitSize; se tipa como proyección común.
  const proy = (geografico ? geoMercator() : geoIdentity().reflectY(true)) as ReturnType<typeof geoMercator>;
  proy.fitWidth(ancho, marco);
  const ruta0 = geoPath(proy);
  const [[, y0], [, y1]] = ruta0.bounds(marco);
  alto = Math.max(200, Math.ceil(y1 - y0));
  proy.fitSize([ancho, alto], marco);
  if (geografico) proy.clipExtent([[0, 0], [ancho, alto]]);
  const ruta = geoPath(proy);

  const vistos = new Set<number>();
  const formas: Forma[] = [];
  for (const f of feats) {
    const num = numeroDistrito(f.properties as Record<string, unknown>, claves);
    if (num == null) {
      advertencias.push('Hay un polígono sin número de distrito reconocible; revise la configuración de propiedades.');
      continue;
    }
    if (vistos.has(num)) advertencias.push(`El distrito ${num} aparece en más de un elemento; se dibujan todos.`);
    vistos.add(num);
    // Centro de la etiqueta: centroide de la parte más grande dentro del encuadre.
    let centro = ruta.centroid(f as GeoPermissibleObjects);
    if (f.geometry.type === 'MultiPolygon') {
      let mayor = -1;
      for (const p of f.geometry.coordinates) {
        const parte: Polygon = { type: 'Polygon', coordinates: p };
        const a = ruta.area(parte as GeoPermissibleObjects);
        if (a > mayor) {
          mayor = a;
          centro = ruta.centroid(parte as GeoPermissibleObjects);
        }
      }
    }
    formas.push({ distrito: num, d: ruta(f as GeoPermissibleObjects) ?? '', centro: centro as [number, number] });
  }
  const faltantes = Array.from({ length: 16 }, (_, i) => i + 1).filter((d) => !vistos.has(d));
  if (faltantes.length) advertencias.push(`No se encontraron polígonos para los distritos: ${faltantes.join(', ')}.`);

  const contorno = contornoFc ? ruta(contornoFc as GeoPermissibleObjects) ?? undefined : undefined;
  return { ancho, alto, formas: formas.sort((a, b) => a.distrito - b.distrito), contorno, geografico, advertencias };
}

/**
 * Esquema de respaldo: 16 hexágonos ordenados por número (4 × 4). NO es un
 * mapa: no conserva forma, tamaño ni posición de los distritos.
 */
export function esquemaHexagonal(total = 16, columnas = 4): Mapa {
  const r = 52;
  const w = Math.sqrt(3) * r;
  const formas: Forma[] = [];
  for (let i = 0; i < total; i++) {
    const fila = Math.floor(i / columnas);
    const col = i % columnas;
    const cx = w / 2 + 12 + col * w + (fila % 2 ? w / 2 : 0);
    const cy = r + 12 + fila * r * 1.5;
    const pts = Array.from({ length: 6 }, (_, k) => {
      const ang = (Math.PI / 180) * (60 * k - 30);
      return `${(cx + (r - 3) * Math.cos(ang)).toFixed(1)},${(cy + (r - 3) * Math.sin(ang)).toFixed(1)}`;
    });
    formas.push({ distrito: i + 1, d: `M${pts.join('L')}Z`, centro: [cx, cy] });
  }
  const filas = Math.ceil(total / columnas);
  return { ancho: Math.ceil(columnas * w + w / 2 + 24), alto: Math.ceil(r * 1.5 * (filas - 1) + 2 * r + 24), formas, geografico: false, advertencias: [] };
}
