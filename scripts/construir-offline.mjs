/**
 * Versión sin conexión del Observatorio: un solo archivo HTML que se abre con doble clic, sin internet.
 * Lleva dentro el JavaScript, los estilos, los datos oficiales (CSV/JSON), la cartografía y las fotos.
 * Uso: node scripts/construir-offline.mjs  →  observatorio-sin-internet.html
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;
execSync('npx vite build --config vite.offline.config.ts', { cwd: raiz, stdio: 'inherit' });
const dist = join(raiz, 'dist-offline');

const archivos = {};
const recorrer = (dir) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) recorrer(p);
    else {
      const rel = relative(dist, p).replaceAll('\\', '/');
      if (rel.startsWith('assets/') || rel === 'index.html' || rel.startsWith('datos/demo/') || rel.endsWith('LEEME.md')) continue;
      if (/\.(jpe?g|png|webp)$/i.test(rel)) {
        const tipo = rel.endsWith('.png') ? 'image/png' : rel.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        archivos[rel] = `data:${tipo};base64,${readFileSync(p).toString('base64')}`;
      } else archivos[rel] = readFileSync(p, 'utf8');
    }
  }
};
recorrer(dist);

// fetch() de los datos se responde desde el propio archivo: así funciona abierto desde el disco (file://).
const shim = `window.__ARCHIVOS__=${JSON.stringify(archivos).replace(/<\/script/gi, '<\\/script')};
(function(){var f=window.fetch;window.fetch=function(u,o){var k=String(u&&u.url||u).replace(/^\\.\\//,'').split('?')[0].split('#')[0];
var t=window.__ARCHIVOS__[k];if(t!==undefined&&t.indexOf('data:')!==0){return Promise.resolve(new Response(t,{status:200}));}
if(f)return f.apply(this,arguments);return Promise.reject(new Error('sin conexión'));};})();`;

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = join(dist, 'assets');
for (const n of readdirSync(assets)) {
  const cont = readFileSync(join(assets, n), 'utf8');
  if (n.endsWith('.css')) html = html.replace(new RegExp(`<link[^>]*href="\\./assets/${n.replace('.', '\\.')}"[^>]*>`), `<style>${cont}</style>`);
  if (n.endsWith('.js')) html = html.replace(new RegExp(`<script[^>]*src="\\./assets/${n.replace('.', '\\.')}"[^>]*></script>`), () => `<script type="module">${cont.replace(/<\/script/gi, '<\\/script')}</script>`);
}
// Sin internet no hay Google Fonts: se usa la letra del sistema.
html = html.replace(/<link rel="(preconnect|stylesheet)" href="https:\/\/fonts[^>]*>\s*/g, '');
html = html.replace('<head>', `<head>\n<script>${shim}</script>`);
const salida = join(raiz, 'observatorio-sin-internet.html');
writeFileSync(salida, html);
console.log(`Listo: ${salida} (${(html.length / 1e6).toFixed(1)} MB, ${Object.keys(archivos).length} archivos dentro)`);
