/**
 * Seguimiento de exhortos. La APROBACIÓN de un exhorto por el Congreso no
 * equivale a su CUMPLIMIENTO por la autoridad destinataria. El estado de
 * seguimiento se deriva de los campos capturados, en este orden:
 *
 *   1. no aprobado aún → "en trámite" (o "no aprobado" si fue rechazado)
 *   2. seguimiento no verificado → "no verificado"
 *   3. acciones posteriores documentadas → "acciones documentadas"
 *   4. respuesta localizada = sí → "respuesta localizada"
 *   5. respuesta localizada = no → "sin respuesta localizada"
 *   6. sin búsqueda capturada → "pendiente de seguimiento"
 *
 * Nunca se deriva "incumplido".
 */
import type { SeguimientoExhorto } from '../config/catalogos';
import type { Asunto, Base, Exhorto } from '../datos/modelo';
import { asuntosFiltrados, esAprobado, esPendiente } from './asuntos';
import type { Filtro } from './filtro';

export interface FichaExhorto {
  asunto: Asunto;
  exhorto: Exhorto | undefined;
  seguimiento: SeguimientoExhorto;
}

export function seguimientoDe(a: Asunto, e: Exhorto | undefined): SeguimientoExhorto {
  if (a.estado_procesal === 'rechazado') return 'no_aprobado';
  if (!esAprobado(a)) return 'en_tramite';
  if (!e || e.verificacion_seguimiento === 'no_verificado') return e ? 'no_verificado' : 'pendiente_seguimiento';
  if (e.acciones_posteriores) return 'con_acciones';
  if (e.respuesta_localizada === 'si') return 'con_respuesta';
  if (e.respuesta_localizada === 'no') return 'sin_respuesta_localizada';
  return 'pendiente_seguimiento';
}

export function fichasExhortos(b: Base, f: Filtro): FichaExhorto[] {
  return asuntosFiltrados(b, f, ['exhorto']).map((a) => {
    const e = b.idx.exhortoPorAsunto.get(a.id_asunto);
    return { asunto: a, exhorto: e, seguimiento: seguimientoDe(a, e) };
  });
}

export function resumenExhortos(fichas: FichaExhorto[]) {
  const aprobados = fichas.filter((x) => esAprobado(x.asunto));
  return {
    presentados: fichas.length,
    aprobados: aprobados.length,
    pendientes: fichas.filter((x) => esPendiente(x.asunto)).length,
    enviados: aprobados.filter((x) => Boolean(x.exhorto?.fecha_envio)).length,
    conRespuesta: aprobados.filter((x) => x.seguimiento === 'con_respuesta' || x.seguimiento === 'con_acciones').length,
    conAcciones: aprobados.filter((x) => x.seguimiento === 'con_acciones').length,
    sinRespuestaLocalizada: aprobados.filter((x) => x.seguimiento === 'sin_respuesta_localizada').length,
    pendientesSeguimiento: aprobados.filter((x) => x.seguimiento === 'pendiente_seguimiento').length,
    noVerificados: aprobados.filter((x) => x.seguimiento === 'no_verificado').length,
  };
}
