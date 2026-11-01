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
  propiedadesDistrito: ['distrito_l', 'DISTRITO_L', 'DISTRITO_LOCAL', 'DISTRITO', 'distrito', 'DIST_LOC', 'NUM_DIST', 'ID_DISTRITO', 'distrito_local'],
  /**
   * Encuadre del continente [oeste, sur, este, norte] en grados. Las islas
   * Revillagigedo (municipio de Manzanillo) quedarían a cientos de km; se
   * recortan del encuadre para que el continente sea legible.
   */
  encuadre: [-104.75, 18.62, -103.45, 19.56] as [number, number, number, number],
  /** Mapa oficial de cada distrito publicado por el IEE (PDF), redistritación 2022. */
  urlMapaOficial: (n: number) => `https://ieecolima.org.mx/distritos%202024/Distrito%20${n}.pdf`,
  /** Metadatos que se muestran como fuente del mapa. */
  fuente: {
    nombre: 'Base Geográfica Digital de Colima, capa DISTRITO_LOCAL',
    institucion: 'Instituto Nacional Electoral, Marco Geográfico Electoral (corte enero 2026)',
    url: 'https://cartografia.ine.mx/sige8/',
    distritacion: 'Distritación local de 2022, con la que se eligió la LXI Legislatura en 2024',
    /**
     * Cotejo con el IEE (proceso 2024): los municipios de los 16 distritos coinciden. El número de secciones
     * difiere en 7 distritos (1, 4, 5, 7, 8, 10 y 13) (411 en el IEE; 430 en la BGD 2026) por cambios posteriores del Marco Geográfico,
     * entre ellos el ajuste de 2025 en Colima, Coquimatlán y Villa de Álvarez. Ver OBS-GEO-01 en la bitácora.
     */
    nota: 'Cartografía vigente del INE: en Colima, Coquimatlán y Villa de Álvarez los límites pueden diferir ligeramente de los usados en la elección de 2024. Para el límite exacto de cada distrito consulte el mapa oficial del IEE.',
    verificado: true,
  },
};
