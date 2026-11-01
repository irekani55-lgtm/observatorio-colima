/**
 * Clasificación de las propuestas de ley (iniciativas) por su alcance, a partir de su título y descripción.
 * Es una regla automática y conservadora: solo se marca como «de trámite» o «conmemorativa» lo que coincide
 * con estos patrones; todo lo demás se considera «de fondo». Las reglas se publican en la página de Metodología.
 */
import type { Asunto } from '../datos/modelo';

export type AlcancePropuesta = 'fondo' | 'tramite' | 'conmemorativa';

export interface ReglaAlcance {
  alcance: Exclude<AlcancePropuesta, 'fondo'>;
  nombre: string;
  patron: RegExp;
}

/** Texto en minúsculas y sin acentos, para comparar. */
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const REGLAS_ALCANCE: ReglaAlcance[] = [
  { alcance: 'tramite', nombre: 'Descuentos, incentivos o condonaciones fiscales (por ejemplo, en el predial o el agua)', patron: /incentivos? fiscal|estimulos? fiscal|condonaci|descuentos? (en|del|de)|beneficios? fiscal/ },
  { alcance: 'tramite', nombre: 'Tablas de valores catastrales de un municipio', patron: /tablas? de valores/ },
  { alcance: 'tramite', nombre: 'Ley de ingresos anual de un municipio', patron: /ley de ingresos (del|para el) municipio/ },
  { alcance: 'tramite', nombre: 'Venta, donación o préstamo de terrenos y edificios públicos', patron: /(desincorpor|enajen|comodato|donacion|donar).{0,80}(inmueble|predio|terreno|bien)/ },
  { alcance: 'conmemorativa', nombre: 'Declarar un año o día conmemorativo, entregar condecoraciones o reconocimientos', patron: /se declara.{0,40}(ano|dia)|condecoracion|preseas?\b|medalla|reconocimiento (a|al|con motivo)/ },
];

export function alcancePropuesta(a: Pick<Asunto, 'titulo' | 'descripcion'>): AlcancePropuesta {
  const t = normal(`${a.titulo} ${a.descripcion}`);
  return REGLAS_ALCANCE.find((r) => r.patron.test(t))?.alcance ?? 'fondo';
}

export function contarPorAlcance(lista: Pick<Asunto, 'titulo' | 'descripcion'>[]) {
  const c = { fondo: 0, tramite: 0, conmemorativa: 0 };
  for (const a of lista) c[alcancePropuesta(a)]++;
  return c;
}
