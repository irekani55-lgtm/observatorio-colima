import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  titulo: string;
  /** null = sin datos suficientes: se muestra el mensaje de pendiente. */
  valor: ReactNode | null;
  detalle?: ReactNode;
  explica?: ReactNode;
  enlace?: { a: string; texto: string };
  pendiente?: string;
}

/** Tarjeta de indicador principal. Nunca muestra un valor sin su contexto. */
export function Tarjeta({ titulo, valor, detalle, explica, enlace, pendiente = 'Información pendiente de integración' }: Props) {
  return (
    <article className="tarjeta">
      <h3 className="tarjeta__titulo">{titulo}</h3>
      {valor == null ? <span className="tarjeta__valor--pendiente">{pendiente}</span> : <div className="tarjeta__valor">{valor}</div>}
      {detalle && <div className="tarjeta__detalle">{detalle}</div>}
      {explica && <p className="tarjeta__explica">{explica}</p>}
      {enlace && (
        <Link className="tarjeta__enlace" to={enlace.a}>
          {enlace.texto} →
        </Link>
      )}
    </article>
  );
}

export const fmt = (n: number) => n.toLocaleString('es-MX');
export const fmtPct = (n: number | null, dec = 1) => (n == null ? '—' : `${n.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })} %`);

/** "1 iniciativa individual" / "3 iniciativas individuales" */
export const plural = (n: number, singular: string, plural_: string) => `${fmt(n)} ${n === 1 ? singular : plural_}`;
