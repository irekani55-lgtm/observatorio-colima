/**
 * Indicadores del perfil de una diputación, agrupados por las tres tareas. Cada indicador que sale de
 * registros propios lleva las filas exactas que lo forman (y su desglose), para que la página pueda
 * mostrarlas filtradas y descargarlas. `conteo` es el número que muestra el indicador; `filas.length`
 * debe ser igual (lo comprueban las pruebas y la propia página).
 */
import type { Asunto, Base, Diputado, Integrante, Voto } from '../datos/modelo';
import type { RegistroAsistencia } from './asistencia';
import { asistenciaDeDiputado } from './asistencia';
import { asuntosDeDiputado, contarDecretosPublicados, esAprobado, esCompartido, indicadoresAsuntosDiputado, tiemposProcesales } from './asuntos';
import { alcancePropuesta } from './clasificacion';
import { participacionComisionesDiputado } from './comisiones';
import { compromisosFiltrados } from './compromisos';
import { referenciaCongreso } from './distritos';
import { fichasExhortos } from './exhortos';
import { fechaEnPeriodo, hayFiltroDePeriodo, intervalo, type Filtro } from './filtro';
import { intervencionesFiltradas } from './intervenciones';
import { esDividida, votosDeDiputado } from './votaciones';

export const PESTANAS = ['Asistencias', 'Asuntos', 'Exhortos', 'Intervenciones', 'Comisiones', 'Votaciones', 'Compromisos', 'Agenda', 'Fuentes'] as const;
export type Pestana = (typeof PESTANAS)[number];

export interface Parte {
  id: string;
  etiqueta: string;
  filas: unknown[];
}

export interface IndicadorPerfil {
  id: string;
  etiqueta: string;
  /** Texto principal del valor (número, porcentaje o «Pendiente»). */
  valor: string | number | null;
  detalle?: string;
  /** Número que deben sumar las filas (si el indicador sale de registros propios). */
  conteo?: number;
  pestana?: Pestana;
  filas?: unknown[];
  partes?: Parte[];
  /** Cómo se calcula, para los indicadores que no salen de registros propios. */
  nota?: string;
  /** Señala un cálculo cambiado en esta versión (solo se marca en la vista previa). */
  cambio?: string;
  /** Las partes no son subconjuntos del indicador sino grupos hermanos (p. ej. fondo / trámite / reconocimiento). */
  partesHermanas?: boolean;
}

export interface TareaPerfil {
  numero: 1 | 2 | 3;
  titulo: string;
  indicadores: IndicadorPerfil[];
  pie?: string;
}

const de = <T,>(filas: T[], pred: (x: T) => boolean) => filas.filter(pred);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** ¿El cargo en la comisión estuvo vigente en algún momento del periodo? */
function cargoEnPeriodo(c: Integrante, f: Filtro): boolean {
  if (!hayFiltroDePeriodo(f)) return true;
  const { desde, hasta } = intervalo(f);
  return (!c.fecha_inicio || c.fecha_inicio <= hasta) && (!c.fecha_fin || c.fecha_fin >= desde);
}

export function datosPerfil(b: Base, d: Diputado, f: Filtro) {
  const asis = asistenciaDeDiputado(b, d, f);
  const ind = indicadoresAsuntosDiputado(b, d, f);
  const asuntos = asuntosDeDiputado(b, d.id_diputado, f);
  const inter = intervencionesFiltradas(b, f).filter((i) => i.id_diputado === d.id_diputado);
  const votos = votosDeDiputado(b, d.id_diputado, f);
  const com = participacionComisionesDiputado(b, d.id_diputado, f);
  const cargos = com.cargos.filter((c) => cargoEnPeriodo(c, f));
  const exh = fichasExhortos(b, f).filter((x) => x.asunto.promoventes.some((p) => p.id_diputado === d.id_diputado && (p.rol === 'autor' || p.rol === 'coautor')));
  const comp = compromisosFiltrados(b, f, d.id_diputado);
  const tiempos = tiemposProcesales(ind.iniciativasPresentadas.asuntos);
  const agenda = b.agenda.filter((a) => a.id_diputado === d.id_diputado && fechaEnPeriodo(a.fecha, f));
  const ref = referenciaCongreso(b, f);

  const ini = ind.iniciativasPresentadas.asuntos;
  const porAlcance = (x: string) => de(ini, (a) => alcancePropuesta(a) === x);
  const publicadas = de(ini, (a) => a.estado_procesal === 'publicado');
  const decretos = contarDecretosPublicados(publicadas);
  const votacion = (v: Voto) => b.idx.votacion.get(v.id_votacion);
  const sentidos = (lista: Voto[]): Parte[] =>
    (
      [
        ['favor', 'A favor'],
        ['contra', 'En contra'],
        ['abstencion', 'Abstención'],
        ['ausente', 'Ausente en la votación'],
        ['no_localizado', 'Voto no localizado'],
      ] as const
    )
      .map(([k, e]) => ({ id: k, etiqueta: e, filas: de(lista, (v) => v.sentido === k) }))
      .filter((p) => p.filas.length > 0);
  const divididos = de(votos.votos, (v) => {
    const vt = votacion(v);
    return Boolean(vt && esDividida(vt)) && ['favor', 'contra', 'abstencion'].includes(v.sentido);
  });
  const nDivididas = b.votaciones.filter((v) => esDividida(v) && (() => {
    const s = b.idx.sesion.get(v.id_sesion);
    return s ? fechaEnPeriodo(s.fecha, f) : !hayFiltroDePeriodo(f);
  })()).length;

  const reg = asis.registros as RegistroAsistencia[];
  const asistio = de(reg, (r) => r.estado === 'asistencia');
  const conPermiso = de(reg, (r) => r.estado === 'justificada');
  const sinPermiso = de(reg, (r) => r.estado === 'ausencia');
  const evaluables = [...asistio, ...conPermiso, ...sinPermiso];
  const exhAprob = de(exh, (x) => esAprobado(x.asunto) && x.asunto.estado_verificacion === 'verificado');
  const exhSinVerif = de(exh, (x) => esAprobado(x.asunto) && x.asunto.estado_verificacion !== 'verificado');
  const exhResp = de(exh, (x) => x.seguimiento === 'con_respuesta' || x.seguimiento === 'con_acciones');
  const compAvance = de(comp, (c) => c.estado_seguimiento === 'cumplido_documentado' || c.estado_seguimiento === 'avance_documentado');
  const fmtPct = (n: number) => `${n.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

  const tareas: TareaPerfil[] = [
    {
      numero: 1,
      titulo: 'Hacer leyes',
      indicadores: [
        {
          id: 'propuestas', etiqueta: 'Propuestas de ley presentadas', valor: ind.iniciativasPresentadas.total, conteo: ind.iniciativasPresentadas.total, pestana: 'Asuntos', filas: ini,
          detalle: `${ind.iniciativasPresentadas.individuales} solo de esta persona, ${ind.iniciativasPresentadas.compartidos} con otras`,
          partes: [
            { id: 'solo', etiqueta: 'Solo de esta persona', filas: de(ini, (a) => !esCompartido(a)) },
            { id: 'con-otras', etiqueta: 'Con otras personas', filas: de(ini, esCompartido) },
          ],
        },
        {
          id: 'cambian-leyes', etiqueta: '…que cambian o crean leyes', valor: porAlcance('fondo').length, conteo: porAlcance('fondo').length, pestana: 'Asuntos', filas: porAlcance('fondo'), partesHermanas: true,
          detalle: `${porAlcance('tramite').length} trámites, ${porAlcance('conmemorativa').length} reconocimientos`,
          partes: [
            { id: 'fondo', etiqueta: 'Cambian o crean leyes', filas: porAlcance('fondo') },
            { id: 'tramite', etiqueta: 'Trámites', filas: porAlcance('tramite') },
            { id: 'conmemorativa', etiqueta: 'Reconocimientos', filas: porAlcance('conmemorativa') },
          ],
        },
        { id: 'mas-comun', etiqueta: 'Lo más común en el Congreso', valor: ref.medianaIniciativas == null ? null : plural(ref.medianaIniciativas, 'propuesta', 'propuestas'), nota: `Mediana de propuestas presentadas por las ${ref.titulares} diputaciones titulares en el periodo: la mitad presentó más y la mitad menos.` },
        { id: 'aprobadas', etiqueta: 'Aprobadas por el Congreso', valor: ind.iniciativasAprobadas.total, conteo: ind.iniciativasAprobadas.total, pestana: 'Asuntos', filas: ind.iniciativasAprobadas.asuntos },
        {
          id: 'publicadas', etiqueta: 'Ya publicadas como ley o decreto', valor: publicadas.length, conteo: publicadas.length, pestana: 'Asuntos', filas: publicadas,
          detalle: publicadas.length && decretos !== publicadas.length ? `en ${plural(decretos, 'decreto', 'decretos')} (algunas se aprobaron juntas)` : undefined,
          cambio: 'Ahora cuenta propuestas publicadas, no números de decreto',
        },
        { id: 'sin-resolver', etiqueta: 'Todavía sin resolver', valor: ind.iniciativasPendientes.total, conteo: ind.iniciativasPendientes.total, pestana: 'Asuntos', filas: ind.iniciativasPendientes.asuntos },
        {
          id: 'tiempo', etiqueta: 'Tiempo típico hasta aprobarse',
          valor: tiempos.presentacionAprobacion.mediana == null ? 'Sin casos todavía' : `${tiempos.presentacionAprobacion.mediana.toLocaleString('es-MX')} días`,
          nota: `Mediana de días entre la presentación y la aprobación de sus propuestas que tienen ambas fechas (${plural(tiempos.presentacionAprobacion.casos, 'caso', 'casos')}).`,
        },
        {
          id: 'votos', etiqueta: 'Votos escritos con su nombre en el acta', valor: votos.total, conteo: votos.total, pestana: 'Votaciones', filas: votos.votos,
          detalle: `${votos.porSentido.favor} a favor, ${votos.porSentido.contra} en contra, ${votos.porSentido.abstencion} abstenciones`, partes: sentidos(votos.votos),
        },
        {
          id: 'votos-divididas', etiqueta: 'En votaciones divididas', valor: nDivididas ? `${divididos.length} de ${nDivididas}` : null, conteo: divididos.length, pestana: 'Votaciones', filas: divididos,
          detalle: divididos.length ? `${de(divididos, (v) => v.sentido === 'favor').length} a favor, ${de(divididos, (v) => v.sentido === 'contra').length} en contra, ${de(divididos, (v) => v.sentido === 'abstencion').length} abstenciones` : undefined,
          partes: sentidos(divididos),
          nota: nDivididas ? `El primer número son sus votos escritos en el acta; «de ${nDivididas}» son todas las votaciones divididas del Congreso en el periodo.` : undefined,
        },
      ],
    },
    {
      numero: 2,
      titulo: 'Representar',
      indicadores: [
        {
          id: 'asistencia', etiqueta: 'Asistencia a las sesiones', valor: asis.porcentaje == null ? null : fmtPct(asis.porcentaje), conteo: asis.denominador, pestana: 'Asistencias', filas: evaluables,
          detalle: `${asis.asistencias} de ${asis.denominador} sesiones${asis.definitivo ? '' : ' · provisional'}`,
          partes: [
            { id: 'asistio', etiqueta: 'Asistió', filas: asistio },
            { id: 'con-permiso', etiqueta: 'Faltó con permiso', filas: conPermiso },
            { id: 'sin-permiso', etiqueta: 'Faltó sin permiso', filas: sinPermiso },
          ],
          nota: ref.asistencia == null ? undefined : `La rayita es todo el Congreso (${fmtPct(ref.asistencia)}): asistencias de todas las diputaciones entre sus sesiones evaluables.`,
        },
        {
          id: 'faltas', etiqueta: 'Faltas', valor: asis.ausencias + asis.justificadas, conteo: asis.ausencias + asis.justificadas, pestana: 'Asistencias', filas: [...conPermiso, ...sinPermiso],
          detalle: `${asis.justificadas} con permiso, ${asis.ausencias} sin permiso`,
          partes: [
            { id: 'con-permiso', etiqueta: 'Con permiso', filas: conPermiso },
            { id: 'sin-permiso', etiqueta: 'Sin permiso', filas: sinPermiso },
          ],
        },
        { id: 'tribuna', etiqueta: 'Veces que habló ante el Congreso', valor: inter.length, conteo: inter.length, pestana: 'Intervenciones', filas: inter },
        { id: 'comisiones', etiqueta: 'Comisiones de las que forma parte', valor: cargos.length, conteo: cargos.length, pestana: 'Comisiones', filas: cargos, cambio: 'Ahora respeta el año legislativo elegido' },
        {
          id: 'asistencia-comisiones', etiqueta: 'Asistencia a reuniones de comisión', valor: com.porcentaje == null ? 'Sin datos' : fmtPct(com.porcentaje),
          nota: com.evaluables ? undefined : 'El Congreso no publica las listas de asistencia de las reuniones de comisión; por eso no hay registros que mostrar.',
        },
      ],
    },
    {
      numero: 3,
      titulo: 'Vigilar al gobierno',
      indicadores: [
        { id: 'exhortos', etiqueta: 'Exhortos presentados', valor: exh.length, conteo: exh.length, pestana: 'Exhortos', filas: exh.map((x) => x.asunto) },
        {
          id: 'exhortos-aprobados', etiqueta: 'Exhortos aprobados', valor: ind.exhortosAprobados.total, conteo: ind.exhortosAprobados.total, pestana: 'Exhortos', filas: exhAprob.map((x) => x.asunto),
          detalle: exhSinVerif.length ? `+${exhSinVerif.length} sin verificar` : undefined,
          partes: exhSinVerif.length ? [{ id: 'verificados', etiqueta: 'Verificados', filas: exhAprob.map((x) => x.asunto) }, { id: 'sin-verificar', etiqueta: 'Sin verificar', filas: exhSinVerif.map((x) => x.asunto) }] : undefined,
        },
        { id: 'exhortos-respuesta', etiqueta: 'Exhortos con respuesta de la autoridad', valor: exhResp.length, conteo: exhResp.length, pestana: 'Exhortos', filas: exhResp.map((x) => x.asunto) },
        { id: 'puntos-acuerdo', etiqueta: 'Puntos de acuerdo', valor: ind.puntosAcuerdo.total, conteo: ind.puntosAcuerdo.total, pestana: 'Asuntos', filas: ind.puntosAcuerdo.asuntos },
        {
          id: 'compromisos', etiqueta: 'Compromisos con avance documentado', valor: compAvance.length, conteo: compAvance.length, pestana: 'Compromisos', filas: compAvance, detalle: `de ${comp.length} registrados`,
          nota: comp.length ? undefined : 'Todavía no hay compromisos públicos registrados en la base.',
        },
      ],
      pie: 'Un exhorto es una petición a otra autoridad para que atienda un problema. Aprobarlo no obliga a la autoridad a atenderlo.',
    },
  ];

  return { asis, ind, asuntos, inter, votos, com, cargos, exh, comp, agenda, tareas, ref };
}

/** Indicadores cuyo número no coincide con sus filas (debe estar vacío). */
export function indicadoresQueNoCuadran(tareas: TareaPerfil[]): string[] {
  const fallas: string[] = [];
  for (const t of tareas)
    for (const i of t.indicadores) {
      if (i.conteo == null || !i.filas) continue;
      if (i.filas.length !== i.conteo) fallas.push(`${i.etiqueta}: indicador ${i.conteo}, filas ${i.filas.length}`);
      for (const p of i.partes ?? []) if (!p.filas.every((x) => i.filas!.includes(x)) && !i.partesHermanas) fallas.push(`${i.etiqueta} › ${p.etiqueta}: filas fuera del indicador`);
    }
  return fallas;
}

/** Texto seguro para nombres de archivo: minúsculas, sin acentos ni espacios. */
export function aSlug(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** «LXI_2024-2026» (toda la Legislatura al corte) o «LXI-anio1_2024-2025». */
export function periodoArchivo(f: Filtro, fechaCorte: string): string {
  if (f.anio) {
    const { desde, hasta } = intervalo(f);
    return `LXI-anio${f.anio}_${desde.slice(0, 4)}-${hasta.slice(0, 4)}`;
  }
  if (f.desde || f.hasta) return `LXI_${f.desde || 'inicio'}_${f.hasta || 'corte'}`;
  return `LXI_2024-${(fechaCorte || '2027').slice(0, 4)}`;
}

export type { Asunto };
