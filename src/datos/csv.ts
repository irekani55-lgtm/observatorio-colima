import Papa from 'papaparse';
import type { Fila } from './esquema';

/**
 * Convierte texto CSV en filas de texto. Normaliza encabezados (minúsculas,
 * sin espacios) y recorta espacios en los valores. No descarta filas
 * incompletas: la validación se encarga de señalarlas.
 */
export function parsearCsv(texto: string): { filas: Fila[]; errores: string[] } {
  const limpio = texto.replace(/^﻿/, ''); // BOM de Excel
  const res = Papa.parse<Fila>(limpio, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
    transform: (v) => (typeof v === 'string' ? v.trim() : v),
  });
  const errores = res.errors.map((e) => `Fila ${(e.row ?? 0) + 2}: ${e.message}`);
  const filas = res.data.map((f) => {
    const salida: Fila = {};
    for (const [c, v] of Object.entries(f)) if (c) salida[c] = v ?? '';
    return salida;
  });
  return { filas, errores };
}

export function aCsv(columnas: string[], filas: Fila[]): string {
  return Papa.unparse({ fields: columnas, data: filas.map((f) => columnas.map((c) => f[c] ?? '')) }, { newline: '\n' }) + '\n';
}
