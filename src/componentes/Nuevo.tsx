/**
 * Marcas de «Nuevo» para revisar una vista previa. Solo aparecen si la compilación se hizo con
 * VITE_MARCAR_CAMBIOS=1; en el dashboard oficial no se ven.
 */
export const MARCAR_CAMBIOS = import.meta.env.VITE_MARCAR_CAMBIOS === '1';

export function Nuevo({ texto }: { texto?: string }) {
  if (!MARCAR_CAMBIOS) return null;
  return <span className="marca-nuevo__etiqueta">Nuevo{texto ? `: ${texto}` : ''}</span>;
}

/** Clase para resaltar un bloque nuevo o cambiado (vacía en el oficial). */
export const claseNuevo = (activo = true) => (MARCAR_CAMBIOS && activo ? ' marca-nuevo' : '');
