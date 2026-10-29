/**
 * Catálogos controlados: valores admitidos en los archivos de datos y las
 * etiquetas/explicaciones que se muestran en la interfaz.
 *
 * Los datos originales guardan siempre la clave (p. ej. "no_verificado");
 * la interfaz muestra la etiqueta. Así se pueden cambiar textos sin tocar datos.
 */

export interface EntradaCatalogo {
  etiqueta: string;
  descripcion: string;
  /** Tono visual del distintivo. Nunca es el único portador del significado. */
  tono?: 'positivo' | 'negativo' | 'neutro' | 'pendiente' | 'alerta' | 'info';
}

type Catalogo<K extends string> = Record<K, EntradaCatalogo>;

// ---------------------------------------------------------------- Asistencia

export const ESTADOS_ASISTENCIA = {
  asistencia: {
    etiqueta: 'Asistencia registrada',
    descripcion: 'La fuente oficial registra la presencia de la persona legisladora en la sesión.',
    tono: 'positivo',
  },
  ausencia: {
    etiqueta: 'Ausencia registrada',
    descripcion: 'La fuente oficial registra que la persona no estuvo presente y no consta justificación.',
    tono: 'negativo',
  },
  justificada: {
    etiqueta: 'Ausencia con justificación documentada',
    descripcion: 'La fuente registra la inasistencia y una justificación pública (licencia, comisión oficial, salud, etc.).',
    tono: 'neutro',
  },
  pendiente: {
    etiqueta: 'Información pendiente',
    descripcion: 'Aún no se ha localizado o capturado el registro de esta sesión. No se cuenta como ausencia.',
    tono: 'pendiente',
  },
  no_verificado: {
    etiqueta: 'Registro no verificado',
    descripcion: 'Existe un dato, pero no se ha contrastado con una fuente oficial. No entra al cálculo.',
    tono: 'alerta',
  },
} as const satisfies Catalogo<string>;
export type EstadoAsistencia = keyof typeof ESTADOS_ASISTENCIA;

/** Estados que permiten evaluar la asistencia (forman el denominador). */
export const ASISTENCIA_EVALUABLE: readonly EstadoAsistencia[] = ['asistencia', 'ausencia', 'justificada'];

// ---------------------------------------------------------------- Sesiones

export const PERIODOS_SESION = {
  primer_ordinario: { etiqueta: 'Primer periodo ordinario', descripcion: 'Primer periodo ordinario de sesiones del año legislativo.' },
  segundo_ordinario: { etiqueta: 'Segundo periodo ordinario', descripcion: 'Segundo periodo ordinario de sesiones del año legislativo.' },
  primer_receso: { etiqueta: 'Primer periodo de receso', descripcion: 'Receso entre el primer y el segundo periodo ordinario; sesiona la Comisión Permanente y puede haber sesiones extraordinarias.' },
  segundo_receso: { etiqueta: 'Segundo periodo de receso', descripcion: 'Receso al final del año legislativo; sesiona la Comisión Permanente y puede haber sesiones extraordinarias.' },
  extraordinario: { etiqueta: 'Periodo extraordinario', descripcion: 'Sesiones convocadas fuera de los periodos ordinarios.' },
  diputacion_permanente: { etiqueta: 'Comisión / Diputación Permanente', descripcion: 'Sesiones del órgano que funciona durante los recesos.' },
  otro: { etiqueta: 'Otro', descripcion: 'Periodo no clasificado.' },
} as const satisfies Catalogo<string>;
export type PeriodoSesion = keyof typeof PERIODOS_SESION;

export const TIPOS_SESION = {
  ordinaria: { etiqueta: 'Ordinaria', descripcion: 'Sesión ordinaria del Pleno.' },
  extraordinaria: { etiqueta: 'Extraordinaria', descripcion: 'Sesión extraordinaria del Pleno.' },
  solemne: { etiqueta: 'Solemne', descripcion: 'Sesión solemne o protocolaria.' },
  permanente: { etiqueta: 'Permanente', descripcion: 'Sesión de la Comisión o Diputación Permanente.' },
  otro: { etiqueta: 'Otro', descripcion: 'Tipo de sesión no clasificado.' },
} as const satisfies Catalogo<string>;
export type TipoSesion = keyof typeof TIPOS_SESION;

// ---------------------------------------------------------------- Asuntos

export const TIPOS_ASUNTO = {
  iniciativa: { etiqueta: 'Iniciativa', descripcion: 'Propuesta para crear, reformar o derogar leyes o decretos.' },
  dictamen: { etiqueta: 'Dictamen', descripcion: 'Documento de una o varias comisiones que propone al Pleno aprobar, modificar o desechar un asunto.' },
  decreto: { etiqueta: 'Decreto', descripcion: 'Resolución del Congreso con fuerza obligatoria; algunos se publican en el Periódico Oficial.' },
  acuerdo: { etiqueta: 'Acuerdo', descripcion: 'Resolución del Congreso sobre asuntos internos o de trámite.' },
  punto_acuerdo: { etiqueta: 'Punto de acuerdo', descripcion: 'Propuesta para que el Congreso se pronuncie sobre un tema; no modifica leyes.' },
  exhorto: { etiqueta: 'Exhorto', descripcion: 'Punto de acuerdo que solicita a una autoridad realizar o informar sobre una acción. No es obligatorio para la autoridad.' },
  otro: { etiqueta: 'Otro asunto', descripcion: 'Asunto que no encaja en las categorías anteriores (comunicaciones, nombramientos, etc.).' },
} as const satisfies Catalogo<string>;
export type TipoAsunto = keyof typeof TIPOS_ASUNTO;

export const ESTADOS_PROCESALES = {
  presentado: { etiqueta: 'Presentado', descripcion: 'Se dio cuenta del asunto ante el Pleno o la Mesa Directiva.', tono: 'info' },
  turnado: { etiqueta: 'Turnado', descripcion: 'Se envió a una o varias comisiones para su estudio.', tono: 'info' },
  dictaminado: { etiqueta: 'Dictaminado', descripcion: 'La comisión emitió dictamen; falta su discusión o votación en el Pleno.', tono: 'info' },
  aprobado: { etiqueta: 'Aprobado', descripcion: 'El Pleno lo aprobó (en sus términos o con modificaciones).', tono: 'positivo' },
  rechazado: { etiqueta: 'Rechazado o desechado', descripcion: 'El Pleno o la comisión lo rechazó o desechó.', tono: 'negativo' },
  publicado: { etiqueta: 'Publicado', descripcion: 'Aprobado y publicado en el Periódico Oficial "El Estado de Colima".', tono: 'positivo' },
  pendiente: { etiqueta: 'Pendiente', descripcion: 'Sigue en trámite sin una etapa más precisa documentada.', tono: 'pendiente' },
  no_localizado: { etiqueta: 'Información no localizada', descripcion: 'No se encontró información pública sobre su estado actual.', tono: 'alerta' },
  no_verificado: { etiqueta: 'Estado no verificado', descripcion: 'El estado registrado aún no se contrasta con una fuente oficial.', tono: 'alerta' },
} as const satisfies Catalogo<string>;
export type EstadoProcesal = keyof typeof ESTADOS_PROCESALES;

/** Estados que se consideran "en trámite / pendientes". */
export const ESTADOS_PENDIENTES: readonly EstadoProcesal[] = ['presentado', 'turnado', 'dictaminado', 'pendiente'];
/** Estados que implican aprobación por el Pleno. */
export const ESTADOS_APROBADOS: readonly EstadoProcesal[] = ['aprobado', 'publicado'];

/**
 * Etapas admitidas por tipo de asunto. No todos los asuntos recorren el mismo
 * procedimiento: un exhorto no se publica como decreto y un decreto no se
 * "turna". Un estado fuera de esta lista se marca como incompatible.
 */
export const ETAPAS_POR_TIPO: Record<TipoAsunto, readonly EstadoProcesal[]> = {
  iniciativa: ['presentado', 'turnado', 'dictaminado', 'aprobado', 'rechazado', 'publicado', 'pendiente', 'no_localizado', 'no_verificado'],
  dictamen: ['presentado', 'aprobado', 'rechazado', 'publicado', 'pendiente', 'no_localizado', 'no_verificado'],
  decreto: ['aprobado', 'publicado', 'pendiente', 'no_localizado', 'no_verificado'],
  acuerdo: ['presentado', 'aprobado', 'rechazado', 'pendiente', 'no_localizado', 'no_verificado'],
  punto_acuerdo: ['presentado', 'turnado', 'dictaminado', 'aprobado', 'rechazado', 'pendiente', 'no_localizado', 'no_verificado'],
  exhorto: ['presentado', 'turnado', 'dictaminado', 'aprobado', 'rechazado', 'pendiente', 'no_localizado', 'no_verificado'],
  otro: ['presentado', 'turnado', 'dictaminado', 'aprobado', 'rechazado', 'publicado', 'pendiente', 'no_localizado', 'no_verificado'],
};

export const ROLES_PROMOVENTE = {
  autor: { etiqueta: 'Autor/a', descripcion: 'Persona que suscribe y presenta el asunto.' },
  coautor: { etiqueta: 'Coautor/a', descripcion: 'Persona que suscribe el asunto junto con otras.' },
  adherente: { etiqueta: 'Adherente', descripcion: 'Persona que se sumó al asunto después de su presentación. No se cuenta como promovente en los indicadores.' },
} as const satisfies Catalogo<string>;
export type RolPromovente = keyof typeof ROLES_PROMOVENTE;
/** Roles que hacen atribuible un asunto a una persona legisladora. */
export const ROLES_ATRIBUIBLES: readonly RolPromovente[] = ['autor', 'coautor'];

export const ROLES_COMISION_TURNO = {
  dictaminadora: { etiqueta: 'Dictaminadora', descripcion: 'Comisión responsable de elaborar el dictamen.' },
  coadyuvante: { etiqueta: 'Coadyuvante', descripcion: 'Comisión que participa en el estudio junto con la dictaminadora.' },
  opinion: { etiqueta: 'Para opinión', descripcion: 'Comisión a la que se solicita opinión.' },
} as const satisfies Catalogo<string>;
export type RolComisionTurno = keyof typeof ROLES_COMISION_TURNO;

// ---------------------------------------------------------------- Verificación

export const ESTADOS_VERIFICACION = {
  verificado: { etiqueta: 'Verificado', descripcion: 'Contrastado con una fuente oficial enlazada.', tono: 'positivo' },
  pendiente: { etiqueta: 'Verificación pendiente', descripcion: 'Capturado, a la espera de contraste con la fuente.', tono: 'pendiente' },
  no_verificado: { etiqueta: 'No verificado', descripcion: 'No se ha podido contrastar con una fuente oficial.', tono: 'alerta' },
} as const satisfies Catalogo<string>;
export type EstadoVerificacion = keyof typeof ESTADOS_VERIFICACION;

// ---------------------------------------------------------------- Exhortos

/** Estado de seguimiento DERIVADO de los campos del exhorto (ver indicadores/exhortos.ts). */
export const SEGUIMIENTO_EXHORTO = {
  en_tramite: { etiqueta: 'En trámite legislativo', descripcion: 'El exhorto aún no ha sido aprobado; no hay seguimiento que evaluar.', tono: 'info' },
  no_aprobado: { etiqueta: 'No aprobado', descripcion: 'El exhorto fue rechazado o desechado.', tono: 'neutro' },
  pendiente_seguimiento: { etiqueta: 'Pendiente de seguimiento', descripcion: 'Aprobado; aún no se ha buscado o capturado si hubo respuesta.', tono: 'pendiente' },
  sin_respuesta_localizada: { etiqueta: 'Sin respuesta localizada', descripcion: 'Se buscó y no se localizó respuesta oficial. No demuestra que la autoridad haya incumplido.', tono: 'neutro' },
  con_respuesta: { etiqueta: 'Respuesta oficial localizada', descripcion: 'Se localizó una respuesta oficial de la autoridad destinataria.', tono: 'positivo' },
  con_acciones: { etiqueta: 'Acciones posteriores documentadas', descripcion: 'Hay evidencia de acciones de la autoridad relacionadas con el exhorto.', tono: 'positivo' },
  no_verificado: { etiqueta: 'No verificado', descripcion: 'La información de seguimiento no se ha contrastado con una fuente.', tono: 'alerta' },
} as const satisfies Catalogo<string>;
export type SeguimientoExhorto = keyof typeof SEGUIMIENTO_EXHORTO;

export const RESPUESTA_LOCALIZADA = {
  si: { etiqueta: 'Sí', descripcion: 'Se localizó respuesta oficial.' },
  no: { etiqueta: 'No', descripcion: 'Se buscó y no se localizó respuesta.' },
} as const satisfies Catalogo<string>;

// ---------------------------------------------------------------- Votaciones

export const SENTIDOS_VOTO = {
  favor: { etiqueta: 'A favor', descripcion: 'Voto a favor registrado en la fuente.', tono: 'positivo' },
  contra: { etiqueta: 'En contra', descripcion: 'Voto en contra registrado en la fuente.', tono: 'negativo' },
  abstencion: { etiqueta: 'Abstención', descripcion: 'Abstención registrada en la fuente.', tono: 'neutro' },
  ausente: { etiqueta: 'Ausente en la votación', descripcion: 'La fuente registra que no estuvo presente al votar.', tono: 'pendiente' },
  no_localizado: { etiqueta: 'Voto no localizado', descripcion: 'La fuente no permite acreditar el sentido del voto. Nunca se infiere del partido o del resultado.', tono: 'alerta' },
} as const satisfies Catalogo<string>;
export type SentidoVoto = keyof typeof SENTIDOS_VOTO;

export const TIPOS_VOTACION = {
  nominal: { etiqueta: 'Nominal', descripcion: 'Cada persona expresa su voto y queda registrado individualmente.' },
  economica: { etiqueta: 'Económica', descripcion: 'Votación a mano alzada; normalmente no deja registro individual.' },
  cedula: { etiqueta: 'Por cédula', descripcion: 'Votación secreta por cédula.' },
  otro: { etiqueta: 'Otro', descripcion: 'Otro mecanismo de votación.' },
} as const satisfies Catalogo<string>;
export type TipoVotacion = keyof typeof TIPOS_VOTACION;

export const RESULTADOS_VOTACION = {
  aprobado: { etiqueta: 'Aprobado', descripcion: 'La propuesta obtuvo la mayoría requerida.', tono: 'positivo' },
  rechazado: { etiqueta: 'Rechazado', descripcion: 'La propuesta no obtuvo la mayoría requerida.', tono: 'negativo' },
  no_localizado: { etiqueta: 'Resultado no localizado', descripcion: 'No se localizó el resultado.', tono: 'alerta' },
} as const satisfies Catalogo<string>;
export type ResultadoVotacion = keyof typeof RESULTADOS_VOTACION;

// ---------------------------------------------------------------- Compromisos

export const SEGUIMIENTO_COMPROMISO = {
  cumplido_documentado: { etiqueta: 'Cumplimiento documentado', descripcion: 'Existe evidencia pública de que el compromiso se cumplió.', tono: 'positivo' },
  avance_documentado: { etiqueta: 'Avance documentado', descripcion: 'Existe evidencia de avances parciales.', tono: 'info' },
  no_cumplido_documentado: { etiqueta: 'Incumplimiento documentado', descripcion: 'Solo se usa cuando una fuente acredita expresamente que no se cumplió (p. ej. venció un plazo oficial sin la acción comprometida).', tono: 'negativo' },
  sin_avance_localizado: { etiqueta: 'Sin avance localizado', descripcion: 'No se localizaron evidencias de avance. No equivale a incumplimiento.', tono: 'neutro' },
  pendiente_seguimiento: { etiqueta: 'Pendiente de seguimiento', descripcion: 'Aún no se ha revisado su avance.', tono: 'pendiente' },
  no_verificado: { etiqueta: 'No verificado', descripcion: 'El compromiso o su seguimiento no se han contrastado con una fuente.', tono: 'alerta' },
} as const satisfies Catalogo<string>;
export type SeguimientoCompromiso = keyof typeof SEGUIMIENTO_COMPROMISO;

// ---------------------------------------------------------------- Diputaciones

export const TIPOS_REPRESENTACION = {
  MR: { etiqueta: 'Mayoría relativa', descripcion: 'Electa por voto directo en uno de los 16 distritos electorales locales.' },
  RP: { etiqueta: 'Representación proporcional', descripcion: 'Asignada según la votación de cada partido en todo el estado. No representa a un distrito geográfico.' },
} as const satisfies Catalogo<string>;
export type TipoRepresentacion = keyof typeof TIPOS_REPRESENTACION;

export const CALIDAD_CARGO = {
  propietario: { etiqueta: 'Propietaria/o', descripcion: 'Titular electo de la curul.' },
  suplente: { etiqueta: 'Suplente en funciones', descripcion: 'Suplente que ocupa la curul por licencia o ausencia del titular.' },
} as const satisfies Catalogo<string>;

export const CARGOS_COMISION = {
  presidencia: { etiqueta: 'Presidencia', descripcion: 'Preside la comisión.' },
  secretaria: { etiqueta: 'Secretaría', descripcion: 'Ocupa una secretaría de la comisión.' },
  vocal: { etiqueta: 'Vocal', descripcion: 'Integrante con voz y voto.' },
} as const satisfies Catalogo<string>;

export const TIPOS_INTERVENCION = {
  presentacion: { etiqueta: 'Presentación de asunto', descripcion: 'Lectura o exposición de una iniciativa, dictamen o punto de acuerdo.' },
  a_favor: { etiqueta: 'A favor', descripcion: 'Intervención para argumentar a favor de un asunto.' },
  en_contra: { etiqueta: 'En contra', descripcion: 'Intervención para argumentar en contra de un asunto.' },
  posicionamiento: { etiqueta: 'Posicionamiento', descripcion: 'Posicionamiento personal o de grupo parlamentario.' },
  asuntos_generales: { etiqueta: 'Asuntos generales', descripcion: 'Intervención en el punto de asuntos generales.' },
  mocion: { etiqueta: 'Moción o rectificación', descripcion: 'Moción, alusión personal o rectificación de hechos.' },
  otro: { etiqueta: 'Otro', descripcion: 'Otro tipo de intervención.' },
} as const satisfies Catalogo<string>;

export const TIPOS_FUENTE = {
  gaceta: { etiqueta: 'Gaceta Parlamentaria', descripcion: '' },
  diario_debates: { etiqueta: 'Diario de los Debates', descripcion: '' },
  acta: { etiqueta: 'Acta de sesión', descripcion: '' },
  lista_asistencia: { etiqueta: 'Lista de asistencia', descripcion: '' },
  periodico_oficial: { etiqueta: 'Periódico Oficial', descripcion: '' },
  ficha_oficial: { etiqueta: 'Ficha oficial', descripcion: '' },
  transparencia: { etiqueta: 'Portal de transparencia', descripcion: '' },
  comunicado: { etiqueta: 'Comunicado oficial', descripcion: '' },
  cartografia: { etiqueta: 'Cartografía oficial', descripcion: '' },
  video: { etiqueta: 'Video oficial de sesión', descripcion: '' },
  medio: { etiqueta: 'Medio de comunicación', descripcion: 'Fuente secundaria; útil como pista, no como prueba única.' },
  otro: { etiqueta: 'Otro documento', descripcion: '' },
} as const satisfies Catalogo<string>;

export function etiquetaDe(catalogo: Record<string, EntradaCatalogo>, clave: string | undefined | null): string {
  if (!clave) return 'Sin dato';
  return catalogo[clave]?.etiqueta ?? clave;
}
