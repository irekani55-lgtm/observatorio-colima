/**
 * Configuración de la cartografía electoral.
 *
 * ARCHIVO REQUERIDO: public/geo/distritos_locales.geojson
 *   - 16 polígonos (Polygon o MultiPolygon), uno por distrito electoral local.
 *   - Origen: cartografía oficial del IEE Colima / INE (ver public/geo/LEEME.md).
 *   - Coordenadas geográficas WGS84 (EPSG:4326) o proyectadas en metros;
 *     el mapa detecta ambas.
 *
 * Mientras ese archivo no exista, el mapa muestra un ESQUEMA NO GEOGRÁFICO
 * (16 hexágonos) claramente rotulado, que no representa límites territoriales.
 */
export const CONFIG_MAPA = {
  archivoDistritos: 'geo/distritos_locales.geojson',
  /** Contorno estatal opcional (si no existe, se usa la unión visual de los distritos). */
  archivoEstado: 'geo/estado_colima.geojson',
  /** Propiedades donde puede venir el número de distrito (se usa la primera que exista). */
  propiedadesDistrito: ['DISTRITO_L', 'DISTRITO_LOCAL', 'DISTRITO', 'distrito', 'DIST_LOC', 'NUM_DIST', 'ID_DISTRITO', 'distrito_local'],
  /**
   * Encuadre del continente [oeste, sur, este, norte] en grados. Las islas
   * Revillagigedo (municipio de Manzanillo) quedarían a cientos de km; se
   * recortan del encuadre para que el continente sea legible.
   */
  encuadre: [-104.75, 18.62, -103.45, 19.56] as [number, number, number, number],
  /** Mapa oficial de cada distrito publicado por el IEE (PDF), redistritación 2022. */
  urlMapaOficial: (n: number) => `https://ieecolima.org.mx/distritos%202024/Distrito%20${n}.pdf`,
  /** Metadatos que se muestran como fuente del mapa. Completar al integrar el archivo. */
  fuente: {
    nombre: 'Cartografía de distritos electorales locales',
    institucion: 'Instituto Electoral del Estado de Colima / Instituto Nacional Electoral',
    url: 'https://ieecolima.org.mx/distritos.html',
    distritacion: 'Redistritación local 2022, aplicada en el Proceso Electoral 2023–2024',
    verificado: false,
  },
};
