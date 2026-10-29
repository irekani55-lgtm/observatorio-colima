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
