/**
 * Indicadores de asuntos legislativos (iniciativas, dictámenes, exhortos...).
 *
 * Reglas de conteo:
 * - Los totales de la Legislatura cuentan ASUNTOS ÚNICOS (por id_asunto),
 *   sin importar cuántos promoventes o comisiones tengan.
 * - Un asunto es atribuible a una persona si figura como autora o coautora
 *   (las adhesiones se muestran pero no se cuentan).
 * - Individual: un solo promovente atribuible (persona o externo).
 *   Compartida: dos o más promoventes.
 * - Por eso la suma de los conteos por persona puede ser MAYOR que el total de
 *   asuntos únicos: una iniciativa compartida cuenta para cada coautor.
 */
import { ESTADOS_APROBADOS, ESTADOS_PENDIENTES, ROLES_ATRIBUIBLES, type EstadoProcesal, type TipoAsunto } from '../config/catalogos';
import type { Asunto, Base, Diputado } from '../datos/modelo';
import { diputadoCumpleFiltro, fechaEnPeriodo, type Filtro } from './filtro';

export function promoventesAtribuibles(a: Asunto) {
  return a.promoventes.filter((p) => (ROLES_ATRIBUIBLES as readonly string[]).includes(p.rol));
}

export function idsDiputadosPromoventes(a: Asunto): string[] {
  return [...new Set(promoventesAtribuibles(a).map((p) => p.id_diputado).filter(Boolean))];
}

export function esCompartido(a: Asunto): boolean {
  return promoventesAtribuibles(a).length > 1;
}

export const esAprobado = (a: Asunto) => ESTADOS_APROBADOS.includes(a.estado_procesal);
export const esPendiente = (a: Asunto) => ESTADOS_PENDIENTES.includes(a.estado_procesal);
export const esPublicado = (a: Asunto) => a.estado_procesal === 'publicado' || Boolean(a.fecha_publicacion);
/** Dictaminado = la comisión ya resolvió (aunque el Pleno no haya votado). */
export const esDictaminado = (a: Asunto) =>
  Boolean(a.fecha_dictamen) || (['dictaminado', 'aprobado', 'rechazado', 'publicado'] as EstadoProcesal[]).includes(a.estado_procesal);

/**
 * Asuntos del periodo, filtrados por partido o tipo de representación de sus
 * promoventes cuando se indica. No duplica asuntos.
 */
export function asuntosFiltrados(b: Base, f: Filtro, tipos?: TipoAsunto[]): Asunto[] {
  const filtraPersonas = Boolean(f.partido || f.tipoRepresentacion || f.distrito != null);
  return b.asuntos.filter((a) => {
    if (tipos && !tipos.includes(a.tipo)) return false;
    if (!fechaEnPeriodo(a.fecha_presentacion, f)) return false;
    if (filtraPersonas) {
      return idsDiputadosPromoventes(a).some((id) => {
        const d = b.idx.diputado.get(id);
        return d ? diputadoCumpleFiltro(d, f) : false;
      });
    }
    return true;
  });
}

export function asuntosDeDiputado(b: Base, idDiputado: string, f: Filtro, tipos?: TipoAsunto[]): Asunto[] {
  return b.asuntos.filter(
    (a) => (!tipos || tipos.includes(a.tipo)) && fechaEnPeriodo(a.fecha_presentacion, f) && idsDiputadosPromoventes(a).includes(idDiputado),
  );
}

export interface ConteoAtribuido {
  total: number;
  individuales: number;
  compartidos: number;
  /** Asuntos cuyo registro no está verificado: se informan aparte. */
  noVerificados: number;
  asuntos: Asunto[];
}

export function contarAtribuidos(lista: Asunto[]): ConteoAtribuido {
  const unicos = [...new Map(lista.map((a) => [a.id_asunto, a])).values()];
  const compartidos = unicos.filter(esCompartido).length;
  return {
    total: unicos.length,
    individuales: unicos.length - compartidos,
    compartidos,
    noVerificados: unicos.filter((a) => a.estado_verificacion !== 'verificado').length,
    asuntos: unicos,
  };
}

export interface IndicadoresAsuntosDiputado {
  iniciativasPresentadas: ConteoAtribuido;
  iniciativasDictaminadas: ConteoAtribuido;
  iniciativasAprobadas: ConteoAtribuido;
  iniciativasPendientes: ConteoAtribuido;
  dictamenesRelacionados: Asunto[];
  exhortosPresentados: ConteoAtribuido;
  exhortosAprobados: ConteoAtribuido;
  /** Exhortos aprobados cuya autoría no está verificada. */
  exhortosAprobadosSinVerificar: number;
  puntosAcuerdo: ConteoAtribuido;
}

export function indicadoresAsuntosDiputado(b: Base, d: Diputado, f: Filtro): IndicadoresAsuntosDiputado {
  const ini = asuntosDeDiputado(b, d.id_diputado, f, ['iniciativa']);
  const exh = asuntosDeDiputado(b, d.id_diputado, f, ['exhorto']);
  const pda = asuntosDeDiputado(b, d.id_diputado, f, ['punto_acuerdo']);
  const idsIni = new Set(ini.map((a) => a.id_asunto));
  // Dictámenes que resuelven asuntos de la persona (relación id_asunto_origen).
  const dictamenes = b.asuntos.filter((a) => a.tipo === 'dictamen' && idsIni.has(a.id_asunto_origen));
  const exhAprob = exh.filter(esAprobado);
  return {
    iniciativasPresentadas: contarAtribuidos(ini),
    iniciativasDictaminadas: contarAtribuidos(ini.filter(esDictaminado)),
    iniciativasAprobadas: contarAtribuidos(ini.filter(esAprobado)),
    iniciativasPendientes: contarAtribuidos(ini.filter(esPendiente)),
    dictamenesRelacionados: dictamenes,
    exhortosPresentados: contarAtribuidos(exh),
    exhortosAprobados: contarAtribuidos(exhAprob.filter((a) => a.estado_verificacion === 'verificado')),
    exhortosAprobadosSinVerificar: exhAprob.filter((a) => a.estado_verificacion !== 'verificado').length,
    puntosAcuerdo: contarAtribuidos(pda),
  };
}

export interface ResumenAsuntos {
  total: number;
  porTipo: Record<string, number>;
  porEstado: Record<string, number>;
  iniciativasPresentadas: number;
  iniciativasAprobadas: number;
  dictamenesAprobados: number;
  exhortosAprobados: number;
  decretosPublicados: number;
  pendientes: number;
  sinPromoventes: number;
}

export function resumenAsuntos(lista: Asunto[]): ResumenAsuntos {
  const porTipo: Record<string, number> = {};
  const porEstado: Record<string, number> = {};
  for (const a of lista) {
    porTipo[a.tipo] = (porTipo[a.tipo] ?? 0) + 1;
    porEstado[a.estado_procesal] = (porEstado[a.estado_procesal] ?? 0) + 1;
  }
  const de = (t: TipoAsunto) => lista.filter((a) => a.tipo === t);
  return {
    total: lista.length,
    porTipo,
    porEstado,
    iniciativasPresentadas: de('iniciativa').length,
    iniciativasAprobadas: de('iniciativa').filter(esAprobado).length,
    dictamenesAprobados: de('dictamen').filter(esAprobado).length,
    exhortosAprobados: de('exhorto').filter(esAprobado).length,
    decretosPublicados: contarDecretosPublicados(lista),
    pendientes: lista.filter(esPendiente).length,
    sinPromoventes: lista.filter((a) => ['iniciativa', 'exhorto', 'punto_acuerdo'].includes(a.tipo) && a.promoventes.length === 0).length,
  };
}

/**
 * Decretos publicados: una iniciativa, su dictamen y el decreto resultante
 * pueden estar capturados como asuntos distintos con el mismo número de
 * decreto. Se cuenta cada número de decreto una sola vez; los registros
 * publicados sin número se cuentan por su id_asunto.
 */
export function contarDecretosPublicados(lista: Asunto[]): number {
  const claves = new Set<string>();
  for (const a of lista) {
    if (!esPublicado(a) || !['iniciativa', 'dictamen', 'decreto'].includes(a.tipo)) continue;
    claves.add(a.numero_decreto_acuerdo ? `num:${a.numero_decreto_acuerdo.trim().toLowerCase()}` : `id:${a.id_asunto}`);
  }
  return claves.size;
}

/** Días entre dos fechas ISO; null si falta alguna o el orden es inválido. */
export function diasEntre(desde: string, hasta: string): number | null {
  if (!desde || !hasta) return null;
  const d = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000;
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : null;
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Tiempos procesales con su número de casos medibles. */
export function tiemposProcesales(lista: Asunto[]) {
  const presentacionTurno: number[] = [];
  const turnoDictamen: number[] = [];
  const presentacionAprobacion: number[] = [];
  for (const a of lista) {
    const turno = a.turnos.map((t) => t.fecha_turno).filter(Boolean).sort()[0] ?? '';
    const pt = diasEntre(a.fecha_presentacion, turno);
    if (pt != null) presentacionTurno.push(pt);
    const td = diasEntre(turno, a.fecha_dictamen);
    if (td != null) turnoDictamen.push(td);
    const pa = diasEntre(a.fecha_presentacion, a.fecha_aprobacion);
    if (pa != null) presentacionAprobacion.push(pa);
  }
  return {
    presentacionTurno: { mediana: mediana(presentacionTurno), casos: presentacionTurno.length },
    turnoDictamen: { mediana: mediana(turnoDictamen), casos: turnoDictamen.length },
    presentacionAprobacion: { mediana: mediana(presentacionAprobacion), casos: presentacionAprobacion.length },
    universo: lista.length,
  };
}
