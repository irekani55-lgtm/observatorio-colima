/**
 * Intervenciones en tribuna. El conteo describe participación DOCUMENTADA,
 * no su calidad ni su impacto.
 */
import type { Base, Intervencion } from '../datos/modelo';
import { diputadoCumpleFiltro, sesionEnPeriodo, type Filtro } from './filtro';

export function intervencionesFiltradas(b: Base, f: Filtro): Intervencion[] {
  return b.intervenciones.filter((i) => {
    const s = b.idx.sesion.get(i.id_sesion);
    if (s && !sesionEnPeriodo(s, f)) return false;
    if (!s && (f.anio || f.desde || f.hasta)) return false;
    const d = b.idx.diputado.get(i.id_diputado);
    return d ? diputadoCumpleFiltro(d, f) : !f.partido && !f.tipoRepresentacion;
  });
}

export function conteoPor<T>(lista: T[], clave: (t: T) => string): { clave: string; total: number }[] {
  const m = new Map<string, number>();
  for (const x of lista) {
    const k = clave(x) || 'Sin dato';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([k, total]) => ({ clave: k, total })).sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave));
}
