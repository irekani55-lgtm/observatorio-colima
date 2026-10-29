/**
 * Convierte la cartografía oficial de distritos locales (Shapefile .shp, KML,
 * KMZ descomprimido o GeoJSON) al formato que usa el mapa:
 *   public/geo/distritos_locales.geojson  (WGS84, simplificado)
 *   public/geo/estado_colima.geojson      (contorno estatal por disolución)
 *
 * Uso: npm run geo:convertir -- ruta/al/archivo.shp [CAMPO_DISTRITO]
 *
 * Requiere mapshaper (herramienta libre, se descarga con npx la primera vez).
 * No altera los límites: solo reproyecta a WGS84 y simplifica vértices
 * conservando la topología compartida entre distritos.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [entrada, campo] = process.argv.slice(2);
if (!entrada || !existsSync(entrada)) {
  console.error('Uso: npm run geo:convertir -- ruta/al/archivo.shp [CAMPO_DISTRITO]');
  process.exit(1);
}
const geo = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'geo');
const comun = ['--yes', 'mapshaper@0.6', '-i', entrada, 'snap', '-proj', 'wgs84', '-simplify', '15%', 'keep-shapes'];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

execFileSync(npx, [...comun, '-o', join(geo, 'distritos_locales.geojson'), 'format=geojson', 'precision=0.00001'], { stdio: 'inherit' });
execFileSync(npx, [...comun, '-dissolve', '-o', join(geo, 'estado_colima.geojson'), 'format=geojson', 'precision=0.00001'], { stdio: 'inherit' });
execFileSync(npx, ['--yes', 'mapshaper@0.6', '-i', join(geo, 'distritos_locales.geojson'), '-info'], { stdio: 'inherit' });
console.log(`\nListo. Verifique que haya 16 elementos y que el número de distrito esté en ${campo ? `"${campo}"` : 'uno de los campos de CONFIG_MAPA.propiedadesDistrito'} (src/config/mapa.ts).`);
console.log('Actualice también CONFIG_MAPA.fuente con la institución, URL, distritación y verificado: true.');
