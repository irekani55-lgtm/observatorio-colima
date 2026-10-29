import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cargarConjunto } from '../src/datos/cargar';
import { construirBase } from '../src/datos/modelo';
import { validarTodo } from '../src/datos/validar';
import { autoverificar } from '../src/indicadores/autoverificacion';

const leer = async (r: string) => readFile(join(__dirname, '..', 'public', 'datos', r), 'utf8').catch(() => null);

describe('conjuntos de datos incluidos', () => {
  it('la demostración carga, detecta exactamente sus errores intencionales y los cálculos son consistentes', async () => {
    const b = construirBase(await cargarConjunto(leer, 'demo'));
    expect(b.manifiesto.es_demo).toBe(true);
    expect(b.diputados.length).toBeGreaterThan(20);
    const errores = validarTodo(b).filter((p) => p.severidad === 'error');
    expect(errores.map((e) => e.registro).sort()).toEqual(['EXH-ESTADO-0001', 'INI-FECHA-0001', 'INI-FECHA-0001 / DIP-99', 'VOT-0001'].sort());
    expect(autoverificar(b)).toEqual([]);
    for (const anio of [1, 2, 3] as const) expect(autoverificar(b, { anio })).toEqual([]);
  });

  it('el conjunto oficial no tiene errores de validación ni de cálculo', async () => {
    const b = construirBase(await cargarConjunto(leer, 'oficial'));
    expect(b.manifiesto.es_demo).toBe(false);
    expect(validarTodo(b).filter((p) => p.severidad === 'error')).toEqual([]);
    expect(autoverificar(b)).toEqual([]);
  });
});
