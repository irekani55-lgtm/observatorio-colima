/**
 * Valida un conjunto de datos y escribe el reporte en
 * public/datos/<conjunto>/reporte-validacion.json (y lo resume en consola).
 * Uso: npm run datos:validar -- [conjunto]   (por defecto: el de config.json)
 * Sale con código 1 si hay errores, para usarse en integración continua.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cargarConjunto, resolverConjunto, type LectorTexto } from '../src/datos/cargar';
import { construirBase } from '../src/datos/modelo';
import { CATEGORIAS_PROBLEMA, resumenProblemas, validarTodo } from '../src/datos/validar';
import { autoverificar } from '../src/indicadores/autoverificacion';

const RAIZ = join(import.meta.dirname, '..', 'public', 'datos');
const leer: LectorTexto = async (ruta) => {
  try {
    return await readFile(join(RAIZ, ruta), 'utf8');
  } catch {
    return null;
  }
};

const id = process.argv[2] ?? (await resolverConjunto(leer));
const conjunto = await cargarConjunto(leer, id);
const base = construirBase(conjunto);
const problemas = [...validarTodo(base), ...autoverificar(base)];
const r = resumenProblemas(problemas);

console.log(`\nConjunto: ${conjunto.manifiesto.nombre} (${id})${conjunto.manifiesto.es_demo ? '  [DEMOSTRACIÓN]' : ''}`);
console.log(`Errores: ${r.porSeveridad.error} · Advertencias: ${r.porSeveridad.advertencia} · Avisos: ${r.porSeveridad.aviso}\n`);
for (const [cat, n] of Object.entries(r.porCategoria)) console.log(`  ${CATEGORIAS_PROBLEMA[cat as keyof typeof CATEGORIAS_PROBLEMA].padEnd(32)} ${n}`);
console.log('\nPrimeros errores:');
for (const p of problemas.filter((x) => x.severidad === 'error').slice(0, 15)) console.log(`  [${p.tabla}] ${p.registro}${p.columna ? ` (${p.columna})` : ''}: ${p.mensaje}`);

await writeFile(join(RAIZ, id, 'reporte-validacion.json'), JSON.stringify({ generado: new Date().toISOString(), resumen: r, problemas }, null, 2));
console.log(`\nReporte completo: public/datos/${id}/reporte-validacion.json`);
process.exitCode = r.porSeveridad.error > 0 ? 1 : 0;
