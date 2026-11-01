/**
 * Votaciones. El sentido del voto solo se registra cuando la fuente lo
 * acredita; nunca se infiere del partido ni del resultado general.
 */
import type { SentidoVoto } from '../config/catalogos';
import type { Base, Votacion } from '../datos/modelo';
import { sesionEnPeriodo, type Filtro } from './filtro';

export function votacionesFiltradas(b: Base, f: Filtro): Votacion[] {
  return b.votaciones.filter((v) => {
    const s = b.idx.sesion.get(v.id_sesion);
    return s ? sesionEnPeriodo(s, f) : !f.anio && !f.desde && !f.hasta;
  });
}

export function votosDeDiputado(b: Base, idDiputado: string, f: Filtro) {
  const ids = new Set(votacionesFiltradas(b, f).map((v) => v.id_votacion));
  const votos = b.votos.filter((v) => v.id_diputado === idDiputado && ids.has(v.id_votacion));
  const porSentido: Record<SentidoVoto, number> = { favor: 0, contra: 0, abstencion: 0, ausente: 0, no_localizado: 0 };
  for (const v of votos) porSentido[v.sentido] = (porSentido[v.sentido] ?? 0) + 1;
  return { total: votos.length, porSentido, votos };
}

/**
 * Votación dividida: nominal y con al menos `UMBRAL_DIVIDIDA` votos de cada lado (a favor, y en contra más
 * abstenciones), según los totales del acta. Son las votaciones en que el voto de cada persona dice más,
 * porque el Congreso no votó en bloque. El criterio es automático y se publica en Metodología.
 */
export const UMBRAL_DIVIDIDA = 3;
export function esDividida(v: Votacion): boolean {
  if (v.tipo_votacion !== 'nominal' || v.total_favor == null) return false;
  return Math.min(v.total_favor, (v.total_contra ?? 0) + (v.total_abstencion ?? 0)) >= UMBRAL_DIVIDIDA;
}

/** Cómo votó una persona en las votaciones divididas del periodo (solo votos escritos en el acta). */
export function votosDivididosDeDiputado(b: Base, idDiputado: string, f: Filtro) {
  const divididas = votacionesFiltradas(b, f).filter(esDividida);
  const ids = new Set(divididas.map((v) => v.id_votacion));
  const votos = b.votos.filter((v) => v.id_diputado === idDiputado && ids.has(v.id_votacion));
  const porSentido: Record<SentidoVoto, number> = { favor: 0, contra: 0, abstencion: 0, ausente: 0, no_localizado: 0 };
  for (const v of votos) porSentido[v.sentido] = (porSentido[v.sentido] ?? 0) + 1;
  return { divididas: divididas.length, conVoto: porSentido.favor + porSentido.contra + porSentido.abstencion, porSentido };
}
