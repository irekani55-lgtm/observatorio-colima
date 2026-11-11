/**
 * Cálculos de «El Congreso en números» en lenguaje ciudadano: cada función contesta una pregunta sencilla.
 * Solo describen la actividad documentada; ninguna califica a personas ni a partidos.
 */
import type { Asunto, Base, Diputado, Votacion } from '../datos/modelo';
import { asistenciaAgregada } from './asistencia';
import { esAprobado, esPendiente } from './asuntos';
import { alcancePropuesta } from './clasificacion';
import { enFunciones, type Filtro } from './filtro';
import { esDividida } from './votaciones';

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** ¿Cuántas propuestas se aprueban? Presentadas, aprobadas y, de las aprobadas, cuántas cambian leyes. */
export function avancePropuestas(asuntos: Asunto[]) {
  const ini = asuntos.filter((a) => a.tipo === 'iniciativa');
  const aprobadas = ini.filter(esAprobado);
  const porAlcance = { fondo: 0, tramite: 0, conmemorativa: 0 };
  for (const a of aprobadas) porAlcance[alcancePropuesta(a)]++;
  return { presentadas: ini.length, aprobadas: aprobadas.length, pendientes: ini.filter(esPendiente).length, ...porAlcance };
}

export const ORIGENES = ['Diputaciones', 'Ayuntamientos', 'Gobernadora', 'Poder Judicial y órganos autónomos', 'Ciudadanía y otros'] as const;
export type Origen = (typeof ORIGENES)[number];

/** Quién mandó una propuesta: si firma al menos una diputación, cuenta como de las diputaciones. */
export function origenPropuesta(a: Asunto): Origen {
  if (a.promoventes.some((p) => p.id_diputado)) return 'Diputaciones';
  const t = normal(a.promoventes.map((p) => p.promovente_externo).join(' '));
  if (/ejecutiv|gobernador/.test(t)) return 'Gobernadora';
  if (/ayuntamiento|municip|presidenta? municipal|cabildo/.test(t)) return 'Ayuntamientos';
  if (/tribunal|judicial|instituto|comision|fiscal|organo|universidad/.test(t)) return 'Poder Judicial y órganos autónomos';
  return 'Ciudadanía y otros';
}

/** ¿Quién manda las propuestas al Congreso? */
export function origenesPropuestas(asuntos: Asunto[]) {
  const c = Object.fromEntries(ORIGENES.map((o) => [o, 0])) as Record<Origen, number>;
  const ini = asuntos.filter((a) => a.tipo === 'iniciativa');
  for (const a of ini) c[origenPropuesta(a)]++;
  return { total: ini.length, filas: ORIGENES.map((o) => ({ origen: o, total: c[o] })) };
}

/** ¿Qué pasó con los exhortos? */
export function resultadoExhortos(asuntos: Asunto[]) {
  const exh = asuntos.filter((a) => a.tipo === 'exhorto');
  const aprobados = exh.filter(esAprobado).length;
  const rechazados = exh.filter((a) => a.estado_procesal === 'rechazado').length;
  const sinResultadoLista = exh.filter((a) => !esAprobado(a) && a.estado_procesal !== 'rechazado');
  return { total: exh.length, aprobados, rechazados, sinResultado: sinResultadoLista.length, sinResultadoLista };
}

/** ¿Cómo va la asistencia mes a mes? Asistencias ÷ registros evaluables de todas las diputaciones, por mes. */
export function asistenciaPorMes(b: Base, dips: Diputado[], f: Filtro) {
  const m = new Map<string, { asistencias: number; evaluables: number }>();
  for (const r of asistenciaAgregada(b, dips, f).registros) {
    if (!['asistencia', 'ausencia', 'justificada'].includes(r.estado)) continue;
    const mes = r.sesion.fecha.slice(0, 7);
    if (!m.has(mes)) m.set(mes, { asistencias: 0, evaluables: 0 });
    const x = m.get(mes)!;
    x.evaluables++;
    if (r.estado === 'asistencia') x.asistencias++;
  }
  return [...m.entries()]
    .sort(([a], [c]) => a.localeCompare(c))
    .map(([mes, x]) => ({ mes, asistencia: Math.round((x.asistencias / x.evaluables) * 1000) / 10, sesiones: x.evaluables }));
}

/** ¿Qué tan dividido vota el Congreso? Solo votaciones nominales con totales en el acta. */
export function divisionVotaciones(votaciones: Votacion[]) {
  const nominales = votaciones.filter((v) => v.tipo_votacion === 'nominal' && v.total_favor != null);
  let unanimidad = 0;
  let casi = 0;
  let divididas = 0;
  for (const v of nominales) {
    const otros = (v.total_contra ?? 0) + (v.total_abstencion ?? 0);
    if (esDividida(v)) divididas++;
    else if (otros === 0) unanimidad++;
    else casi++;
  }
  return { total: nominales.length, unanimidad, casi, divididas };
}

/**
 * ¿Cuántas propuestas presenta cada partido por cada lugar que tiene? Propuestas con al menos una diputación del
 * partido ÷ lugares del partido a la fecha de corte. Se divide entre lugares para no favorecer a los partidos grandes.
 */
export function propuestasPorLugar(b: Base, asuntos: Asunto[]) {
  const corte = b.manifiesto.fecha_corte;
  const lugares = new Map<string, number>();
  for (const d of b.diputados) if (enFunciones(d, corte)) lugares.set(d.id_partido, (lugares.get(d.id_partido) ?? 0) + 1);
  const porPartido = new Map<string, Set<string>>();
  for (const a of asuntos) {
    if (a.tipo !== 'iniciativa') continue;
    for (const p of a.promoventes) {
      if (!p.id_diputado || (p.rol !== 'autor' && p.rol !== 'coautor')) continue;
      const id = b.idx.diputado.get(p.id_diputado)?.id_partido;
      if (!id) continue;
      if (!porPartido.has(id)) porPartido.set(id, new Set());
      porPartido.get(id)!.add(a.id_asunto);
    }
  }
  return [...lugares.entries()]
    .map(([id, n]) => {
      const total = porPartido.get(id)?.size ?? 0;
      return { id_partido: id, partido: b.idx.partido.get(id)?.siglas ?? id, lugares: n, propuestas: total, porLugar: Math.round((total / n) * 10) / 10 };
    })
    .sort((x, y) => y.porLugar - x.porLugar);
}
