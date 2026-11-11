import type { ReactNode } from 'react';

export interface FilaBarra {
  etiqueta: string;
  valor: number;
  /** 0 = renglón principal; 1 = parte de un desglose (va con sangría bajo su encabezado). */
  nivel?: 0 | 1;
  /** Renglón de encabezado sin barra (p. ej. «De las 273 aprobadas:»). */
  encabezado?: boolean;
  /** Si se da, la etiqueta es un botón (por ejemplo, para abrir una explicación). */
  onClick?: () => void;
  /** Barra que explica la frase de arriba: va en color; las demás, en gris. */
  destacada?: boolean;
}

/**
 * Barras horizontales sencillas hechas con HTML: etiqueta a la izquierda, barra y número a la derecha.
 * Permite encabezados y desgloses con sangría, y etiquetas que se pueden tocar.
 */
export function BarrasLista({ filas, max, formato = (v) => v.toLocaleString('es-MX'), titulo, color = 'var(--serie-1)' }: { filas: FilaBarra[]; max?: number; formato?: (v: number) => string; titulo: string; color?: string }) {
  const tope = max ?? Math.max(1, ...filas.filter((f) => !f.encabezado).map((f) => f.valor));
  // Si alguna barra está destacada, las demás van en gris para que el ojo vaya directo a la importante.
  const hayDestacadas = filas.some((f) => f.destacada);
  const colorDe = (f: FilaBarra) => (!hayDestacadas || f.destacada ? color : 'var(--barra-contexto)');
  return (
    <>
    <ul className="barras-lista" aria-label={titulo}>
      {filas.map((f, i) =>
        f.encabezado ? (
          <li key={i} className="barras-lista__encabezado">
            {f.etiqueta}
          </li>
        ) : (
          <li key={i} className={`barras-lista__fila${f.nivel ? ' barras-lista__fila--desglose' : ''}${f.destacada ? ' barras-lista__fila--destacada' : ''}`}>
            <span className="barras-lista__etiqueta">
              {f.onClick ? (
                <button type="button" className="barras-lista__enlace" onClick={f.onClick}>
                  {f.etiqueta}
                </button>
              ) : (
                f.etiqueta
              )}
            </span>
            <span className="barras-lista__pista" aria-hidden="true">
              <span className="barras-lista__barra" style={{ width: `${Math.max(f.valor > 0 ? 1.5 : 0, (f.valor / tope) * 100)}%`, background: colorDe(f) }} />
            </span>
            <span className="barras-lista__valor">{formato(f.valor)}</span>
          </li>
        ),
      )}
    </ul>
    {hayDestacadas && <p className="barras-lista__nota">La barra en color es la que explica la frase de arriba.</p>}
    </>
  );
}

/** Ventana sencilla para una explicación (se cierra con «Cerrar», tocando afuera o con Escape). */
export function Explicacion({ titulo, abierta, onCerrar, children }: { titulo: string; abierta: boolean; onCerrar: () => void; children: ReactNode }) {
  if (!abierta) return null;
  return (
    <div className="explicacion__fondo" role="presentation" onClick={onCerrar} onKeyDown={(e) => e.key === 'Escape' && onCerrar()}>
      <div className="explicacion" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="explicacion__cabecera">
          <h3>{titulo}</h3>
          <button type="button" className="boton boton--chico" onClick={onCerrar} autoFocus>
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
