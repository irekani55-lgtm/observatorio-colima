/**
 * Indicadores por distrito electoral local. Un distrito puede haber tenido más de una persona en la curul
 * (titular y suplente durante una licencia): sus registros se suman, y cada asunto cuenta una sola vez.
 * Los dictámenes son trabajo colectivo de las comisiones; se presentan como «de las comisiones que preside»
 * o «que integra», nunca como obra individual.
 */
import type { Asunto, Base, Diputado } from '../datos/modelo';
import { asistenciaAgregada } from './asistencia';
import { asuntosDeDiputado, esAprobado } from './asuntos';
import { dictamenesDeComision } from './comisiones';
import type { Filtro } from './filtro';
import { intervencionesFiltradas } from './intervenciones';
import { contarPorAlcance } from './clasificacion';
import { diputadosFiltrados } from './filtro';
import { votosDeDiputado } from './votaciones';

export interface IndicadoresPersonas {
  asistencia: ReturnType<typeof asistenciaAgregada>;
  iniciativasPresentadas: number;
  iniciativasAprobadas: number;
  /** Propuestas presentadas según su alcance (cambio de fondo, trámite o conmemorativa). */
  alcancePresentadas: ReturnType<typeof contarPorAlcance>;
  dictamenesDeSusIniciativas: number;
  exhortosPresentados: number;
  exhortosAprobados: number;
  puntosAcuerdo: number;
  intervenciones: number;
  votosRegistrados: number;
  comisionesQueIntegra: number;
  comisionesQuePreside: number;
  dictamenesComisionesQuePreside: number;
  dictamenesComisionesQueIntegra: number;
}

/** Indicadores de una o varias personas (las que ocuparon una curul en el periodo). */
export function indicadoresDePersonas(b: Base, personas: Diputado[], f: Filtro): IndicadoresPersonas {
  const ids = new Set(personas.map((p) => p.id_diputado));
  // Mismo criterio que el perfil (asuntosDeDiputado); un asunto de varias personas del distrito cuenta una vez.
  const unicos = new Map<string, Asunto>();
  for (const p of personas) for (const a of asuntosDeDiputado(b, p.id_diputado, f)) unicos.set(a.id_asunto, a);
  const propios = [...unicos.values()];
  const ini = propios.filter((a) => a.tipo === 'iniciativa');
  const exh = propios.filter((a) => a.tipo === 'exhorto');
  const idsIni = new Set(ini.map((a) => a.id_asunto));
  const cargos = b.integrantes.filter((i) => ids.has(i.id_diputado));
  const comIntegra = new Set(cargos.map((c) => c.id_comision));
  const comPreside = new Set(cargos.filter((c) => c.cargo === 'presidencia').map((c) => c.id_comision));
  const dictDe = (coms: Set<string>) => new Set([...coms].flatMap((c) => dictamenesDeComision(b, c, f).map((a) => a.id_asunto))).size;
  return {
    asistencia: asistenciaAgregada(b, personas, f),
    iniciativasPresentadas: ini.length,
    iniciativasAprobadas: ini.filter(esAprobado).length,
    alcancePresentadas: contarPorAlcance(ini),
    dictamenesDeSusIniciativas: b.asuntos.filter((a) => a.tipo === 'dictamen' && idsIni.has(a.id_asunto_origen)).length,
    exhortosPresentados: exh.length,
    exhortosAprobados: exh.filter((a) => esAprobado(a) && a.estado_verificacion === 'verificado').length,
    puntosAcuerdo: propios.filter((a) => a.tipo === 'punto_acuerdo').length,
    intervenciones: intervencionesFiltradas(b, f).filter((i) => ids.has(i.id_diputado)).length,
    votosRegistrados: personas.reduce((n, p) => n + votosDeDiputado(b, p.id_diputado, f).total, 0),
    comisionesQueIntegra: comIntegra.size,
    comisionesQuePreside: comPreside.size,
    dictamenesComisionesQuePreside: dictDe(comPreside),
    dictamenesComisionesQueIntegra: dictDe(comIntegra),
  };
}

/** Personas que ocuparon la curul de mayoría relativa de un distrito. */
export function personasDeDistrito(b: Base, distrito: number): Diputado[] {
  return b.diputados.filter((d) => d.tipo_representacion === 'MR' && d.distrito === distrito);
}

/**
 * Puntos de referencia del Congreso para leer la ficha de una persona: la asistencia de todas las diputaciones
 * juntas y la mediana de propuestas presentadas por las diputaciones titulares (la mitad presentó más y la mitad
 * menos). Se usa la mediana porque unas pocas personas con muchas propuestas inflarían el promedio.
 */
export function referenciaCongreso(b: Base, f: Filtro) {
  const dips = diputadosFiltrados(b, { anio: f.anio, desde: f.desde, hasta: f.hasta });
  const asistencia = asistenciaAgregada(b, dips, f).porcentaje;
  const titulares = dips.filter((d) => d.calidad !== 'suplente');
  const ns = titulares.map((d) => asuntosDeDiputado(b, d.id_diputado, f, ['iniciativa']).length).sort((x, y) => x - y);
  const m = ns.length;
  const medianaIniciativas = m === 0 ? null : m % 2 ? ns[(m - 1) / 2] : (ns[m / 2 - 1] + ns[m / 2]) / 2;
  return { asistencia, medianaIniciativas, titulares: m };
}
