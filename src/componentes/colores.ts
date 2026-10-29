/**
 * Colores de series. El color sigue a la entidad (partido, tipo de asunto),
 * nunca a su posición en un ranking, para que no cambie al filtrar.
 */
import type { Base } from '../datos/modelo';

export const SERIES = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)', 'var(--serie-5)', 'var(--serie-6)', 'var(--serie-7)', 'var(--serie-8)'];
export const COLOR_OTRO = 'var(--eje)';

export function colorPartido(b: Base, idPartido: string): string {
  const p = b.idx.partido.get(idPartido);
  if (!p || p.orden >= SERIES.length) return COLOR_OTRO;
  return SERIES[p.orden];
}

export const COLOR_TIPO_ASUNTO: Record<string, string> = {
  iniciativa: SERIES[0],
  exhorto: SERIES[1],
  punto_acuerdo: SERIES[2],
  dictamen: SERIES[3],
  decreto: SERIES[4],
  acuerdo: SERIES[5],
  otro: COLOR_OTRO,
};
