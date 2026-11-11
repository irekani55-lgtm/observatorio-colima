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
  { texto: 'Mapa: la columna derecha es más compacta (un renglón por partido) y termina a la misma altura que el mapa.', a: '/' },
  { texto: 'Mapa: debajo del título dice «Toque un distrito en el mapa para ver quién le representa».', a: '/' },
  { texto: 'Mapa: «¿Cómo se reparten los 25 lugares?» muestra un cuadrito de color por partido con su número.', a: '/' },
  { texto: 'Mapa: los botones del 1 al 16 se cambiaron por una lista desplegable («¿Prefiere elegir de una lista?»).', a: '/' },
  { texto: 'Descargas: «Descargar CSV» ahora funciona dentro del dashboard publicado (pide confirmar antes de guardar).', a: '/diputaciones/DIP-148' },
  { texto: 'Julio César León Trujillo ya no aparece «en funciones»: dice que tiene licencia desde el 2 oct 2024, que no ha regresado y quién está en su lugar.', a: '/diputaciones/DIP-RP-JCLT' },
  { texto: 'Menú: se quitó «Mapa», porque todo lo del mapa ya está en el inicio. Los enlaces viejos llevan al inicio.', a: '/' },
  { texto: 'Mapa: al abrir una ficha, el mapa se queda fijo a la izquierda mientras usted baja por la ficha (sin espacio vacío).', a: '/?mapa_distrito=3' },
  { texto: 'Todas las páginas (menos el inicio) tienen arriba un botón «← Regresar» a la página anterior.', a: '/congreso' },
  { texto: 'El Congreso en números: ahora son seis preguntas en palabras sencillas, cada una con su respuesta y una gráfica; lo técnico quedó guardado en «Para revisar a fondo».', a: '/congreso' },
  { texto: 'Menú: ahora tiene 3 opciones: Inicio, ¿Qué se hace en el Congreso? y El Congreso en números.', a: '/' },
  { texto: 'Inicio: nuevo buscador «¿Sabe su nombre?» y enlace a la lista de las 28 personas.', a: '/' },
  { texto: 'El Congreso en números: «Comparar a las diputaciones, dato por dato» (la tabla que estaba en Diputaciones).', a: '/congreso#comparar' },
  { texto: 'Diputaciones: botones «Ganaron en su distrito» y «Llegaron por la lista de su partido» (antes era la página «Representación proporcional»).', a: '/diputaciones' },
  { texto: 'El Congreso en números: al final, «Indicadores detallados» (antes era la página «Indicadores»).', a: '/congreso#indicadores' },
  { texto: '¿Qué se hace en el Congreso?: se quitó «Compromisos», que no tiene datos todavía.', a: '/asuntos' },
  { texto: 'Pie de página: «¿De dónde salen los datos?» junta Metodología, Fuentes y la bitácora.', a: '/fuentes' },
];
