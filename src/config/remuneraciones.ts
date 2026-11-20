/**
 * Cuánto gana una diputación según el tabulador oficial del Poder Legislativo. Las 25 tienen el mismo renglón
 * («DIPUTADO, DIPUTADA»), así que no se compara a nadie. Montos quincenales tal como vienen en el tabulador;
 * los mensuales son el doble.
 */
export const REMUNERACION_DIPUTACION = {
  anio: 2026,
  quincena: {
    dieta: 38738.3,
    previsionSocial: 7500,
    bruto: 46238.3,
    isr: 10780.71,
    pensiones: 1900.75,
    neto: 33556.84,
  },
  fuente: {
    titulo: 'Tabulador de Remuneraciones del Poder Legislativo del Estado de Colima para el ejercicio fiscal 2026',
    publicacion: 'Periódico Oficial «El Estado de Colima», 21 de febrero de 2026, suplemento 2 (renglón «DIPUTADO, DIPUTADA»)',
    url: 'https://periodicooficial.col.gob.mx/p/21022026/sup02/226022101.pdf',
  },
  /** Salario mínimo general diario 2026 (CONASAMI, publicado en el DOF el 9 de diciembre de 2025). */
  salarioMinimoDiario: 315.04,
} as const;
