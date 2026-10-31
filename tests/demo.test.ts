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
    const problemas = validarTodo(b);
    const errores = problemas.filter((p) => p.severidad === 'error');
    expect(errores.map((e) => e.registro).sort()).toEqual(['EXH-ESTADO-0001', 'INI-FECHA-0001', 'INI-FECHA-0001 / DIP-99'].sort());
    // La diferencia entre total oficial y votos capturados es advertencia (suele estar en la propia acta).
    expect(problemas.some((p) => p.registro === 'VOT-0001' && p.severidad === 'advertencia' && p.categoria === 'inconsistencia')).toBe(true);
    expect(autoverificar(b)).toEqual([]);
    for (const anio of [1, 2, 3] as const) expect(autoverificar(b, { anio })).toEqual([]);
  });

  it('el conjunto oficial no tiene errores de validación ni de cálculo', async () => {
    const b = construirBase(await cargarConjunto(leer, 'oficial'));
    expect(b.manifiesto.es_demo).toBe(false);
    expect(validarTodo(b).filter((p) => p.severidad === 'error')).toEqual([]);
    expect(autoverificar(b)).toEqual([]);
  });

  it('los votos deducidos por el Observatorio nunca se mezclan con los votos del acta', async () => {
    const b = construirBase(await cargarConjunto(leer, 'oficial'));
    const delActa = new Set(b.votos.map((v) => `${v.id_votacion}|${v.id_diputado}`));
    expect(b.votosInferidos.length).toBeGreaterThan(0);
    expect(b.votosInferidos.every((v) => !delActa.has(`${v.id_votacion}|${v.id_diputado}`))).toBe(true);
    // Toda votación que no cuadra está explicada en la bitácora.
    const noCuadran = b.votaciones.filter((v) => v.cuadre && v.cuadre !== 'coincide');
    expect(noCuadran.every((v) => b.idx.observacion.has(v.id_observacion))).toBe(true);
    expect(b.observaciones.some((o) => o.estado === 'resuelta')).toBe(true);
  });
});
