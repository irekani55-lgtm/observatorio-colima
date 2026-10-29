/**
 * Colores de series. El color sigue a la entidad (partido, tipo de asunto),
 * nunca a su posición en un ranking, para que no cambie al filtrar.
 */
import type { Base } from '../datos/modelo';

export const SERIES = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)', 'var(--serie-5)', 'var(--serie-6)', 'var(--serie-7)', 'var(--serie-8)'];
export const COLOR_OTRO = 'var(--eje)';

/** Nombre seguro de variable CSS para un partido. */
export const varPartido = (id: string) => `--partido-${id.replace(/[^a-z0-9_-]/gi, '_')}`;

/**
 * Color del partido: el institucional si el catálogo lo define (vía variable CSS con versión
 * para modo claro y oscuro, ver EstilosPartidos), o un color de la paleta validada.
 */
export function colorPartido(b: Base, idPartido: string): string {
  const p = b.idx.partido.get(idPartido);
  if (p?.color_claro) return `var(${varPartido(p.id_partido)})`;
  if (!p || p.orden >= SERIES.length) return COLOR_OTRO;
  return SERIES[p.orden];
}

/** Hoja de estilo con los colores institucionales para ambos temas. */
export function cssPartidos(b: Base): string {
  const con = b.partidos.filter((p) => p.color_claro);
  if (!con.length) return '';
  const claro = con.map((p) => `${varPartido(p.id_partido)}: ${p.color_claro};`).join(' ');
  const oscuro = con.map((p) => `${varPartido(p.id_partido)}: ${p.color_oscuro || p.color_claro};`).join(' ');
  return `:root { ${claro} } @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${oscuro} } } :root[data-theme='dark'] { ${oscuro} }`;
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
