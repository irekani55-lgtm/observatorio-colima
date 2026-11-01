import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cargarConjunto } from '../src/datos/cargar';
import { construirBase } from '../src/datos/modelo';
import { validarTodo } from '../src/datos/validar';
import { autoverificar } from '../src/indicadores/autoverificacion';
import { indicadoresAsuntosDiputado } from '../src/indicadores/asuntos';
import { indicadoresDePersonas } from '../src/indicadores/distritos';
import { indicadoresComisiones } from '../src/indicadores/comisiones';
import { enFunciones } from '../src/indicadores/filtro';
import { COALICIONES_2024, LEGISLATURA } from '../src/config/legislatura';

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

  it('los indicadores por distrito coinciden con los del perfil y los dictámenes no se cuentan como turnos', async () => {
    const b = construirBase(await cargarConjunto(leer, 'oficial'));
    for (const d of b.diputados.filter((x) => x.tipo_representacion === 'MR')) {
      const perfil = indicadoresAsuntosDiputado(b, d, {});
      const dist = indicadoresDePersonas(b, [d], {});
      expect(dist.iniciativasPresentadas).toBe(perfil.iniciativasPresentadas.total);
      expect(dist.iniciativasAprobadas).toBe(perfil.iniciativasAprobadas.total);
      expect(dist.exhortosAprobados).toBe(perfil.exhortosAprobados.total);
      expect(dist.dictamenesDeSusIniciativas).toBe(perfil.dictamenesRelacionados.length);
      expect(dist.dictamenesComisionesQuePreside).toBeLessThanOrEqual(dist.dictamenesComisionesQueIntegra);
    }
    const turnados = indicadoresComisiones(b, {}).flatMap((c) => c.idsAsuntos);
    expect(turnados.some((id) => id.startsWith('DIC-'))).toBe(false);
  });

  it('a la fecha de corte hay exactamente una persona en cada una de las 25 curules', async () => {
    const b = construirBase(await cargarConjunto(leer, 'oficial'));
    const enCurul = b.diputados.filter((d) => enFunciones(d, b.manifiesto.fecha_corte));
    expect(enCurul.length).toBe(LEGISLATURA.integracion.total);
    expect(enCurul.filter((d) => d.tipo_representacion === 'MR').length).toBe(LEGISLATURA.integracion.MR);
    expect(new Set(enCurul.filter((d) => d.tipo_representacion === 'MR').map((d) => d.distrito)).size).toBe(LEGISLATURA.distritos);
    for (const c of COALICIONES_2024) for (const p of c.partidos) expect(b.idx.partido.has(p)).toBe(true);
  });
});
