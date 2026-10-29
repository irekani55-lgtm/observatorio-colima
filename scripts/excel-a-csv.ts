/**
 * Convierte un libro de Excel (una hoja por tabla) en los CSV del conjunto.
 * Uso: npm run datos:excel -- ruta/al/archivo.xlsx [conjunto=oficial]
 *
 * - El nombre de cada hoja debe coincidir con el de la tabla (p. ej. "diputados", "asuntos").
 * - La primera fila de cada hoja contiene los encabezados del diccionario de datos.
 * - Las fechas de Excel se convierten a AAAA-MM-DD.
 * - Las hojas con otro nombre se ignoran (se informa en consola). No se borra ningún CSV existente
 *   cuya hoja no venga en el libro.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { aCsv } from '../src/datos/csv';
import { ESQUEMA, NOMBRES_TABLAS, type Fila, type NombreTabla } from '../src/datos/esquema';

const [archivo, conjunto = 'oficial'] = process.argv.slice(2);
if (!archivo) {
  console.error('Uso: npm run datos:excel -- archivo.xlsx [conjunto]');
  process.exit(1);
}

function texto(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('text' in v && typeof v.text === 'string') return v.text; // hipervínculo
    if ('result' in v) return texto(v.result as ExcelJS.CellValue); // fórmula
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('hyperlink' in v) return String((v as { hyperlink: string }).hyperlink);
  }
  return String(v).trim();
}

const libro = new ExcelJS.Workbook();
await libro.xlsx.readFile(archivo);
const destino = join(import.meta.dirname, '..', 'public', 'datos', conjunto);
await mkdir(destino, { recursive: true });

for (const hoja of libro.worksheets) {
  const nombre = hoja.name.trim().toLowerCase().replace(/\s+/g, '_') as NombreTabla;
  if (!NOMBRES_TABLAS.includes(nombre)) {
    console.warn(`Hoja "${hoja.name}" ignorada: no corresponde a ninguna tabla.`);
    continue;
  }
  const encabezados: string[] = [];
  hoja.getRow(1).eachCell({ includeEmpty: false }, (c, i) => (encabezados[i - 1] = texto(c.value).toLowerCase().replace(/\s+/g, '_')));
  const filas: Fila[] = [];
  hoja.eachRow((row, n) => {
    if (n === 1) return;
    const f: Fila = {};
    encabezados.forEach((h, i) => h && (f[h] = texto(row.getCell(i + 1).value)));
    if (Object.values(f).some(Boolean)) filas.push(f);
  });
  const esperadas = ESQUEMA[nombre].columnas.map((c) => c.nombre);
  const extra = encabezados.filter((h) => h && !esperadas.includes(h));
  const columnas = [...esperadas, ...extra]; // conserva columnas adicionales para revisión
  await writeFile(join(destino, `${nombre}.csv`), aCsv(columnas, filas));
  console.log(`${nombre}.csv: ${filas.length} ${filas.length === 1 ? "fila" : "filas"}${extra.length ? ` (columnas no reconocidas: ${extra.join(', ')})` : ''}`);
}
console.log(`\nSiguiente paso: npm run datos:validar -- ${conjunto}`);
