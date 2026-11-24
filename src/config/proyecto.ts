/**
 * Datos del propio proyecto. Se llenan cuando existan: mientras un campo esté vacío, la página no lo muestra
 * (no se inventan correos ni direcciones).
 */
export const PROYECTO = {
  nombre: 'Observatorio Legislativo Colima',
  /** Correo para correcciones y derecho de réplica. Conviene uno exclusivo del Observatorio, no uno personal. */
  correoContacto: '',
  /** Repositorio público con el código y los datos (solo si es público; si no, déjelo vacío). */
  urlRepositorio: '',
  licenciaDatos: { nombre: 'Creative Commons Atribución 4.0 Internacional (CC BY 4.0)', url: 'https://creativecommons.org/licenses/by/4.0/deed.es' },
  /** Cómo citar los datos al reutilizarlos. */
  cita: 'Fuente: Observatorio Legislativo Colima, con documentos oficiales del H. Congreso del Estado de Colima.',
} as const;
