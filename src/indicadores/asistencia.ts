/**
 * Indicador de asistencia a sesiones del Pleno.
 *
 *   Asistencia (%) = asistencias registradas / sesiones elegibles con información verificable × 100
 *
 * - Sesión elegible: marcada "cuenta_para_asistencia = si", dentro del periodo
 *   filtrado y en fechas en que la persona ejercía el cargo.
 * - Denominador: asistencia + ausencia + ausencia justificada.
 * - Fuera del denominador: "pendiente", "no_verificado" y sesiones elegibles
 *   sin ningún registro (que NUNCA se cuentan como ausencia).
 * - El porcentaje es "provisional" si existe al menos un caso fuera del denominador.
 */
import { ASISTENCIA_EVALUABLE, type EstadoAsistencia } from '../config/catalogos';
import type { Asistencia, Base, Diputado, Sesion } from '../datos/modelo';
import { enFunciones, sesionEnPeriodo, type Filtro } from './filtro';

export interface RegistroAsistencia {
  sesion: Sesion;
  id_diputado: string;
  /** "sin_registro" = sesión elegible sin dato capturado. */
  estado: EstadoAsistencia | 'sin_registro';
  justificacion: string;
  id_fuente: string;
}

export interface ResultadoAsistencia {
  sesionesElegibles: number;
  asistencias: number;
  ausencias: number;
  justificadas: number;
  pendientes: number;
  noVerificadas: number;
  sinRegistro: number;
  /** asistencia + ausencia + justificada */
  denominador: number;
  /** null cuando el denominador es 0 */
  porcentaje: number | null;
  /** false si hay sesiones elegibles fuera del denominador */
  definitivo: boolean;
  registros: RegistroAsistencia[];
}

export function vacioAsistencia(): ResultadoAsistencia {
  return { sesionesElegibles: 0, asistencias: 0, ausencias: 0, justificadas: 0, pendientes: 0, noVerificadas: 0, sinRegistro: 0, denominador: 0, porcentaje: null, definitivo: true, registros: [] };
}

export function sesionesElegibles(b: Base, f: Filtro): Sesion[] {
  return b.sesiones.filter((s) => s.cuenta_para_asistencia && sesionEnPeriodo(s, f));
}

function indexarAsistencias(b: Base): Map<string, Asistencia> {
  const m = new Map<string, Asistencia>();
  for (const a of b.asistencias) {
    const k = `${a.id_sesion}|${a.id_diputado}`;
    if (!m.has(k)) m.set(k, a); // duplicados: se usa el primero y la validación los reporta
  }
  return m;
}

const cacheIdx = new WeakMap<Base, Map<string, Asistencia>>();
function idx(b: Base) {
  let m = cacheIdx.get(b);
  if (!m) {
    m = indexarAsistencias(b);
    cacheIdx.set(b, m);
  }
  return m;
}

export function cerrar(r: ResultadoAsistencia): ResultadoAsistencia {
  r.denominador = r.asistencias + r.ausencias + r.justificadas;
  r.porcentaje = r.denominador > 0 ? (r.asistencias / r.denominador) * 100 : null;
  r.definitivo = r.pendientes + r.noVerificadas + r.sinRegistro === 0;
  return r;
}

export function asistenciaDeDiputado(b: Base, d: Diputado, f: Filtro): ResultadoAsistencia {
  const r = vacioAsistencia();
  const m = idx(b);
  for (const s of sesionesElegibles(b, f)) {
    if (!enFunciones(d, s.fecha)) continue;
    r.sesionesElegibles++;
    const a = m.get(`${s.id_sesion}|${d.id_diputado}`);
    const estado: RegistroAsistencia['estado'] = a ? a.estado : 'sin_registro';
    switch (estado) {
      case 'asistencia': r.asistencias++; break;
      case 'ausencia': r.ausencias++; break;
      case 'justificada': r.justificadas++; break;
      case 'pendiente': r.pendientes++; break;
      case 'no_verificado': r.noVerificadas++; break;
      default: r.sinRegistro++;
    }
    r.registros.push({ sesion: s, id_diputado: d.id_diputado, estado, justificacion: a?.justificacion ?? '', id_fuente: a?.id_fuente ?? '' });
  }
  return cerrar(r);
}

/** Agregado de un conjunto de personas: suma numeradores y denominadores (no promedia porcentajes). */
export function asistenciaAgregada(b: Base, diputados: Diputado[], f: Filtro): ResultadoAsistencia {
  const total = vacioAsistencia();
  for (const d of diputados) {
    const r = asistenciaDeDiputado(b, d, f);
    total.sesionesElegibles += r.sesionesElegibles;
    total.asistencias += r.asistencias;
    total.ausencias += r.ausencias;
    total.justificadas += r.justificadas;
    total.pendientes += r.pendientes;
    total.noVerificadas += r.noVerificadas;
    total.sinRegistro += r.sinRegistro;
    total.registros.push(...r.registros);
  }
  return cerrar(total);
}

export function esEvaluable(e: RegistroAsistencia['estado']): boolean {
  return (ASISTENCIA_EVALUABLE as readonly string[]).includes(e);
}
