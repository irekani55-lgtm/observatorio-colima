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

/** Lista de cambios de esta vista previa, con el lugar donde se ven. */
export const CAMBIOS_VISTA_PREVIA = [
  { texto: 'Inicio: «¿Qué hace una diputación?» y «El Congreso en resumen» ahora van al principio, antes del mapa.', a: '/' },
  { texto: 'Perfil: cada indicador con «Ver →» lleva a sus registros filtrados, con botones para el desglose y «Quitar filtro».', a: '/diputaciones/DIP-148' },
  { texto: 'Perfil: «Descargar CSV» baja solo las filas filtradas, con un nombre que dice el indicador, la persona y el periodo.', a: '/diputaciones/DIP-148' },
  { texto: 'Perfil: «Ya publicadas como ley o decreto» cuenta propuestas, no números de decreto.', a: '/diputaciones/DIP-135' },
  { texto: 'Perfil: «Comisiones de las que forma parte» respeta el año legislativo elegido.', a: '/diputaciones/DIP-148' },
  { texto: 'Perfil: los indicadores que no salen de registros propios explican cómo se calculan (ⓘ).', a: '/diputaciones/DIP-148' },
  { texto: 'Mapa: los datos técnicos de la fuente quedan en «Más datos de la fuente».', a: '/' },
  { texto: 'Mapa: la nota de la sección 0020 ahora está en palabras sencillas.', a: '/' },
  { texto: 'Inicio: «El Congreso en resumen» con la misma letra que «¿Qué hace una diputación?» y en palabras más sencillas.', a: '/' },
  { texto: 'Mapa: «Seleccionar distrito por número» y «¿Cómo se reparten los 25 lugares?» pasan a la columna derecha, debajo de la ficha.', a: '/' },
  { texto: 'Mapa: la columna derecha es más compacta (botones delgados, un renglón por partido) y termina a la misma altura que el mapa.', a: '/' },
  { texto: 'Menú: se quitó «Mapa», porque todo lo del mapa ya está en el inicio. Los enlaces viejos llevan al inicio.', a: '/' },
];
