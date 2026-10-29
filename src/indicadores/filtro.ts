import { ANIOS_LEGISLATIVOS } from '../config/legislatura';
import type { TipoRepresentacion } from '../config/catalogos';
import type { Base, Diputado, Sesion } from '../datos/modelo';

/** Filtro común a todas las secciones. Campos vacíos = sin restricción. */
export interface Filtro {
  anio?: 1 | 2 | 3;
  desde?: string;
  hasta?: string;
  partido?: string;
  tipoRepresentacion?: TipoRepresentacion;
  distrito?: number;
}

/** Intervalo efectivo [desde, hasta] combinando año legislativo y fechas. */
export function intervalo(f: Filtro): { desde: string; hasta: string } {
  let desde = f.desde || '0000-01-01';
  let hasta = f.hasta || '9999-12-31';
  if (f.anio) {
    const a = ANIOS_LEGISLATIVOS.anios.find((x) => x.numero === f.anio)!;
    if (a.inicio > desde) desde = a.inicio;
    if (a.fin < hasta) hasta = a.fin;
  }
  return { desde, hasta };
}

export function hayFiltroDePeriodo(f: Filtro): boolean {
  return Boolean(f.anio || f.desde || f.hasta);
}

/**
 * ¿La fecha cae en el periodo? Un registro sin fecha solo se incluye cuando
 * no hay filtro de periodo (no se puede ubicar en el tiempo).
 */
export function fechaEnPeriodo(fecha: string, f: Filtro): boolean {
  if (!hayFiltroDePeriodo(f)) return true;
  if (!fecha) return false;
  const { desde, hasta } = intervalo(f);
  return fecha >= desde && fecha <= hasta;
}

export function sesionEnPeriodo(s: Sesion, f: Filtro): boolean {
  if (f.anio && s.anio_legislativo !== f.anio) return false;
  if (f.desde && (!s.fecha || s.fecha < f.desde)) return false;
  if (f.hasta && (!s.fecha || s.fecha > f.hasta)) return false;
  return true;
}

export function diputadoCumpleFiltro(d: Diputado, f: Filtro): boolean {
  if (f.partido && d.id_partido !== f.partido) return false;
  if (f.tipoRepresentacion && d.tipo_representacion !== f.tipoRepresentacion) return false;
  if (f.distrito != null && d.distrito !== f.distrito) return false;
  return true;
}

export function diputadosFiltrados(b: Base, f: Filtro): Diputado[] {
  return b.diputados.filter((d) => diputadoCumpleFiltro(d, f));
}

/** ¿La persona ejercía el cargo en esa fecha? (fuera de su periodo o durante una licencia, no) */
export function enFunciones(d: Diputado, fecha: string): boolean {
  if (!fecha) return true;
  if (d.fecha_inicio && fecha < d.fecha_inicio) return false;
  if (d.fecha_fin && fecha > d.fecha_fin) return false;
  for (const [desde, hasta] of d.licencias ?? []) if (desde && fecha >= desde && (!hasta || fecha <= hasta)) return false;
  return true;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fechaCorta(iso: string | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '—';
  const [a, m, d] = iso.split('-');
  return `${Number(d)} ${MESES[Number(m) - 1]} ${a}`;
}

export function describirPeriodo(f: Filtro, fechaCorte?: string): string {
  const partes: string[] = [];
  if (f.anio) partes.push(ANIOS_LEGISLATIVOS.anios.find((a) => a.numero === f.anio)!.etiqueta);
  if (f.desde || f.hasta) partes.push(`${f.desde ? fechaCorta(f.desde) : 'inicio'} – ${f.hasta ? fechaCorta(f.hasta) : 'fecha de corte'}`);
  if (partes.length === 0) {
    partes.push(`Toda la Legislatura (${fechaCorta(ANIOS_LEGISLATIVOS.anios[0].inicio)} – ${fechaCorte ? `corte al ${fechaCorta(fechaCorte)}` : 'fecha de corte'})`);
  }
  return partes.join(' · ');
}
