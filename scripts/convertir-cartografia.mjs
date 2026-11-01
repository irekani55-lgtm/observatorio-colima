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
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
// Secciones electorales → distrito local (para el buscador «¿En qué distrito vivo?»). Se usa si junto a la capa de
// distritos están SECCION.shp y MUNICIPIO.shp de la misma Base Geográfica Digital del INE.
const carpeta = dirname(entrada);
const shpSeccion = join(carpeta, 'SECCION.shp');
const shpMunicipio = join(carpeta, 'MUNICIPIO.shp');
if (existsSync(shpSeccion) && existsSync(shpMunicipio)) {
  const tmp = mkdtempSync(join(tmpdir(), 'secciones-'));
  execFileSync(npx, ['--yes', 'mapshaper@0.6', '-i', shpSeccion, '-o', join(tmp, 'seccion.csv'), 'format=csv'], { stdio: 'inherit' });
  execFileSync(npx, ['--yes', 'mapshaper@0.6', '-i', shpMunicipio, '-o', join(tmp, 'municipio.csv'), 'format=csv'], { stdio: 'inherit' });
  const leer = (f) => {
    const [cab, ...filas] = readFileSync(f, 'utf8').trim().split(/\r?\n/);
    const cols = cab.split(',');
    return filas.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v.replace(/^"|"$/g, '')])));
  };
  const nombreMun = Object.fromEntries(leer(join(tmp, 'municipio.csv')).map((m) => [m.municipio, m.nombre]));
  const secciones = leer(join(tmp, 'seccion.csv'))
    .map((x) => ({ seccion: Number(x.seccion), distrito: Number(x.distrito_l), municipio: nombreMun[x.municipio] ?? '' }))
    .sort((a, b) => a.seccion - b.seccion);
  const unicas = new Set(secciones.map((x) => x.seccion));
  if (unicas.size !== secciones.length) throw new Error('Hay números de sección repetidos en SECCION.shp');
  writeFileSync(join(geo, 'secciones_distrito.csv'), 'seccion,distrito,municipio\n' + secciones.map((x) => `${x.seccion},${x.distrito},${x.municipio}`).join('\n') + '\n');
  console.log(`secciones_distrito.csv: ${secciones.length} secciones electorales.`);
}

console.log(`\nListo. Verifique que haya 16 elementos y que el número de distrito esté en ${campo ? `"${campo}"` : 'uno de los campos de CONFIG_MAPA.propiedadesDistrito'} (src/config/mapa.ts).`);
console.log('Actualice también CONFIG_MAPA.fuente con la institución, URL, distritación y verificado: true.');
