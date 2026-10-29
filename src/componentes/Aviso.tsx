import type { ReactNode } from 'react';
import { IcoAlerta, IcoInfo } from './Iconos';

export function Aviso({ tipo = 'info', titulo, children }: { tipo?: 'info' | 'alerta' | 'error'; titulo?: string; children: ReactNode }) {
  const Icono = tipo === 'info' ? IcoInfo : IcoAlerta;
  return (
    <div className={`aviso aviso--${tipo}`} role={tipo === 'error' ? 'alert' : 'note'}>
      <Icono />
      <div>
        {titulo && <strong>{titulo}. </strong>}
        {children}
      </div>
    </div>
  );
}

/** Mensaje uniforme para indicadores sin datos suficientes. */
export function Pendiente({ children = 'Información pendiente de integración' }: { children?: ReactNode }) {
  return <span className="tarjeta__valor--pendiente">{children}</span>;
}
