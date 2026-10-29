/**
 * Indicadores de comisiones. Un asunto turnado a varias comisiones aparece en
 * cada una, pero el total general cuenta asuntos ÚNICOS.
 * La falta de un acta localizada no se interpreta como que no hubo reunión.
 */
import type { Base, Comision } from '../datos/modelo';
import { diasEntre, esAprobado, mediana } from './asuntos';
import { fechaEnPeriodo, type Filtro } from './filtro';

export interface IndicadoresComision {
  comision: Comision;
  integrantes: { id_diputado: string; cargo: string }[];
  turnados: number;
  dictaminados: number;
  pendientes: number;
  llegaronAlPleno: number;
  reuniones: number;
  reunionesConActa: number;
  asistencia: { asistencias: number; evaluables: number; porcentaje: number | null };
  diasTurnoDictamen: { mediana: number | null; casos: number };
  idsAsuntos: string[];
}

export function indicadoresComisiones(b: Base, f: Filtro): IndicadoresComision[] {
  return b.comisiones.map((c) => {
    const turnos = b.asuntos.flatMap((a) =>
      a.turnos.filter((t) => t.id_comision === c.id_comision && fechaEnPeriodo(t.fecha_turno || a.fecha_presentacion, f)).map((t) => ({ a, t })),
    );
    const dictaminados = turnos.filter(({ a, t }) => Boolean(t.fecha_dictamen || a.fecha_dictamen));
    const dias = dictaminados.map(({ a, t }) => diasEntre(t.fecha_turno, t.fecha_dictamen || a.fecha_dictamen)).filter((x): x is number => x != null);
    const reuniones = b.reuniones.filter((r) => r.id_comision === c.id_comision && fechaEnPeriodo(r.fecha, f));
    const idsReu = new Set(reuniones.map((r) => r.id_reunion));
    const asis = b.asistenciaComision.filter((x) => idsReu.has(x.id_reunion));
    const evaluables = asis.filter((x) => ['asistencia', 'ausencia', 'justificada'].includes(x.estado));
    const asistencias = evaluables.filter((x) => x.estado === 'asistencia').length;
    return {
      comision: c,
      integrantes: b.integrantes.filter((i) => i.id_comision === c.id_comision).map((i) => ({ id_diputado: i.id_diputado, cargo: i.cargo })),
      turnados: turnos.length,
      dictaminados: dictaminados.length,
      pendientes: turnos.length - dictaminados.length,
      llegaronAlPleno: turnos.filter(({ a }) => Boolean(a.fecha_votacion) || esAprobado(a) || a.estado_procesal === 'rechazado').length,
      reuniones: reuniones.length,
      reunionesConActa: reuniones.filter((r) => Boolean(r.url_acta)).length,
      asistencia: { asistencias, evaluables: evaluables.length, porcentaje: evaluables.length ? (asistencias / evaluables.length) * 100 : null },
      diasTurnoDictamen: { mediana: mediana(dias), casos: dias.length },
      idsAsuntos: [...new Set(turnos.map(({ a }) => a.id_asunto))],
    };
  });
}

/** Total de asuntos únicos turnados a alguna comisión. */
export function asuntosUnicosTurnados(ind: IndicadoresComision[]): number {
  return new Set(ind.flatMap((i) => i.idsAsuntos)).size;
}

export function participacionComisionesDiputado(b: Base, idDiputado: string, f: Filtro) {
  const cargos = b.integrantes.filter((i) => i.id_diputado === idDiputado);
  const reunionesPeriodo = new Map(b.reuniones.filter((r) => fechaEnPeriodo(r.fecha, f)).map((r) => [r.id_reunion, r]));
  const asis = b.asistenciaComision.filter((x) => x.id_diputado === idDiputado && reunionesPeriodo.has(x.id_reunion));
  const evaluables = asis.filter((x) => ['asistencia', 'ausencia', 'justificada'].includes(x.estado));
  const asistencias = evaluables.filter((x) => x.estado === 'asistencia').length;
  return {
    cargos,
    reunionesConRegistro: asis.length,
    asistencias,
    evaluables: evaluables.length,
    porcentaje: evaluables.length ? (asistencias / evaluables.length) * 100 : null,
  };
}
