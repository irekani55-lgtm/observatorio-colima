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
     * Cotejo con la elección de 2024 (PREP 2024 del IEE: cada casilla con su sección y distrito): de las 381
     * secciones que existen en ambas, 380 están en el mismo distrito; solo la 0020 pasó del distrito 2 al 1.
     * Las 7 secciones de 2024 que ya no existen se dividieron en 46 nuevas de los mismos distritos.
     * Ver OBS-GEO-01 en la bitácora.
     */
    /** Explicación en lenguaje ciudadano del único cambio respecto de 2024. */
    nota: {
      titulo: '¿Cambió su distrito desde la elección de 2024?',
      texto: 'Casi seguro que no: los distritos son los mismos con los que se votó en 2024. Solo cambió una sección de la ciudad de Colima, la 0020. Si su credencial dice sección 0020, en 2024 votó en el distrito 2 y en la próxima elección votará en el distrito 1.',
    },
    verificado: true,
  },
};
