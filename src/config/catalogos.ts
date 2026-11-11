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
  asistencia: { etiqueta: 'Asistió', descripcion: 'La lista oficial dice que estuvo en la sesión.', tono: 'positivo' },
  ausencia: { etiqueta: 'Faltó sin permiso', descripcion: 'La lista oficial dice que no estuvo y no hay un permiso o motivo publicado.', tono: 'negativo' },
  justificada: { etiqueta: 'Faltó con permiso', descripcion: 'La lista oficial dice que no estuvo, pero hay un permiso o motivo (por ejemplo, salud o un encargo oficial).', tono: 'neutro' },
  pendiente: { etiqueta: 'Sin dato todavía', descripcion: 'Todavía no tenemos la lista de esta sesión. No cuenta como falta.', tono: 'pendiente' },
  no_verificado: { etiqueta: 'Sin revisar', descripcion: 'Hay un dato, pero todavía no lo comparamos con la lista oficial. No entra en el cálculo.', tono: 'alerta' },
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
  iniciativa: { etiqueta: 'Propuesta de ley (iniciativa)', descripcion: 'Propuesta para crear una ley, cambiarla o quitarla.' },
  dictamen: { etiqueta: 'Opinión de comisión (dictamen)', descripcion: 'Lo que opina una comisión sobre una propuesta: si se aprueba, se cambia o se rechaza. Después la vota todo el Congreso.' },
  decreto: { etiqueta: 'Ley aprobada (decreto)', descripcion: 'Decisión del Congreso que hay que cumplir; muchas se publican en el periódico oficial del estado.' },
  acuerdo: { etiqueta: 'Acuerdo', descripcion: 'Decisión del Congreso sobre su propio funcionamiento o un trámite.' },
  punto_acuerdo: { etiqueta: 'Postura del Congreso (punto de acuerdo)', descripcion: 'Propuesta para que el Congreso opine o pida algo sobre un tema; no cambia leyes.' },
  exhorto: { etiqueta: 'Petición a una autoridad (exhorto)', descripcion: 'El Congreso le pide a otra autoridad que atienda un problema o que informe algo. No la obliga.' },
  otro: { etiqueta: 'Otro', descripcion: 'Otro tipo de asunto (avisos, nombramientos, etc.).' },
} as const satisfies Catalogo<string>;
export type TipoAsunto = keyof typeof TIPOS_ASUNTO;

export const ESTADOS_PROCESALES = {
  presentado: { etiqueta: 'Presentado', descripcion: 'Se presentó ante el Congreso.', tono: 'info' },
  turnado: { etiqueta: 'En comisión', descripcion: 'Se mandó a una o varias comisiones para que lo estudien.', tono: 'info' },
  dictaminado: { etiqueta: 'Con opinión de comisión', descripcion: 'La comisión ya dio su opinión (dictamen); falta que lo vote todo el Congreso.', tono: 'info' },
  aprobado: { etiqueta: 'Aprobado', descripcion: 'Todo el Congreso lo aprobó (tal cual o con cambios).', tono: 'positivo' },
  rechazado: { etiqueta: 'Rechazado', descripcion: 'El Congreso o la comisión lo rechazó.', tono: 'negativo' },
  retirado: { etiqueta: 'Retirado', descripcion: 'Quien lo presentó lo retiró antes de que se decidiera.', tono: 'neutro' },
  publicado: { etiqueta: 'Publicado', descripcion: 'Se aprobó y se publicó en el periódico oficial del estado («El Estado de Colima»): ya está vigente.', tono: 'positivo' },
  pendiente: { etiqueta: 'Sin resolver', descripcion: 'Todavía no se decide y no sabemos en qué paso va.', tono: 'pendiente' },
  no_localizado: { etiqueta: 'No sabemos en qué va', descripcion: 'No encontramos información pública sobre en qué va.', tono: 'alerta' },
  no_verificado: { etiqueta: 'Sin revisar', descripcion: 'Todavía no lo comparamos con un documento oficial.', tono: 'alerta' },
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
  iniciativa: ['presentado', 'turnado', 'dictaminado', 'aprobado', 'rechazado', 'retirado', 'publicado', 'pendiente', 'no_localizado', 'no_verificado'],
  dictamen: ['presentado', 'aprobado', 'rechazado', 'publicado', 'pendiente', 'no_localizado', 'no_verificado'],
  decreto: ['aprobado', 'publicado', 'pendiente', 'no_localizado', 'no_verificado'],
  acuerdo: ['presentado', 'aprobado', 'rechazado', 'pendiente', 'no_localizado', 'no_verificado'],
  punto_acuerdo: ['presentado', 'turnado', 'dictaminado', 'aprobado', 'rechazado', 'retirado', 'pendiente', 'no_localizado', 'no_verificado'],
  exhorto: ['presentado', 'turnado', 'dictaminado', 'aprobado', 'rechazado', 'retirado', 'pendiente', 'no_localizado', 'no_verificado'],
  otro: ['presentado', 'turnado', 'dictaminado', 'aprobado', 'rechazado', 'retirado', 'publicado', 'pendiente', 'no_localizado', 'no_verificado'],
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
  verificado: { etiqueta: 'Revisado', descripcion: 'Lo comparamos con el documento oficial y coincide.', tono: 'positivo' },
  pendiente: { etiqueta: 'Por revisar', descripcion: 'Ya está anotado, pero falta compararlo con el documento oficial.', tono: 'pendiente' },
  no_verificado: { etiqueta: 'Sin revisar', descripcion: 'No pudimos compararlo con un documento oficial.', tono: 'alerta' },
} as const satisfies Catalogo<string>;
export type EstadoVerificacion = keyof typeof ESTADOS_VERIFICACION;

// ---------------------------------------------------------------- Exhortos

/** Estado de seguimiento DERIVADO de los campos del exhorto (ver indicadores/exhortos.ts). */
export const SEGUIMIENTO_EXHORTO = {
  en_tramite: { etiqueta: 'Todavía no se decide', descripcion: 'El Congreso aún no aprueba el exhorto; no hay nada que seguir.', tono: 'info' },
  no_aprobado: { etiqueta: 'No se aprobó', descripcion: 'El Congreso lo rechazó.', tono: 'neutro' },
  pendiente_seguimiento: { etiqueta: 'Falta buscar respuesta', descripcion: 'Se aprobó, pero todavía no buscamos si la autoridad respondió.', tono: 'pendiente' },
  sin_respuesta_localizada: { etiqueta: 'No encontramos respuesta', descripcion: 'Buscamos y no encontramos una respuesta publicada. No quiere decir que la autoridad no hizo nada.', tono: 'neutro' },
  con_respuesta: { etiqueta: 'La autoridad respondió', descripcion: 'Encontramos una respuesta oficial de la autoridad.', tono: 'positivo' },
  con_acciones: { etiqueta: 'La autoridad hizo algo', descripcion: 'Hay pruebas de que la autoridad hizo algo relacionado con el exhorto.', tono: 'positivo' },
  no_verificado: { etiqueta: 'Sin revisar', descripcion: 'Todavía no comparamos el seguimiento con un documento oficial.', tono: 'alerta' },
} as const satisfies Catalogo<string>;
export type SeguimientoExhorto = keyof typeof SEGUIMIENTO_EXHORTO;

export const RESPUESTA_LOCALIZADA = {
  si: { etiqueta: 'Sí', descripcion: 'Se localizó respuesta oficial.' },
  no: { etiqueta: 'No', descripcion: 'Se buscó y no se localizó respuesta.' },
} as const satisfies Catalogo<string>;

// ---------------------------------------------------------------- Votaciones

export const SENTIDOS_VOTO = {
  favor: { etiqueta: 'A favor', descripcion: 'El acta dice que votó a favor.', tono: 'positivo' },
  contra: { etiqueta: 'En contra', descripcion: 'El acta dice que votó en contra.', tono: 'negativo' },
  abstencion: { etiqueta: 'Abstención', descripcion: 'El acta dice que no votó ni a favor ni en contra (se abstuvo).', tono: 'neutro' },
  ausente: { etiqueta: 'No estaba al votar', descripcion: 'El acta dice que no estaba en el salón cuando se votó.', tono: 'pendiente' },
  no_localizado: { etiqueta: 'El acta no dice cómo votó', descripcion: 'El acta no permite saber cómo votó. Nunca lo deducimos por su partido ni por el resultado.', tono: 'alerta' },
} as const satisfies Catalogo<string>;
export type SentidoVoto = keyof typeof SENTIDOS_VOTO;

export const TIPOS_VOTACION = {
  nominal: { etiqueta: 'Con nombres (nominal)', descripcion: 'Cada diputación dice su voto y el acta lo anota con su nombre.' },
  economica: { etiqueta: 'A mano alzada (económica)', descripcion: 'Se vota levantando la mano; el acta normalmente solo anota el resultado, no quién votó cómo.' },
  cedula: { etiqueta: 'Secreta (por papeleta)', descripcion: 'Cada quien vota en una papeleta, sin decir su nombre.' },
  otro: { etiqueta: 'Otra forma', descripcion: 'Otra forma de votar.' },
} as const satisfies Catalogo<string>;
export type TipoVotacion = keyof typeof TIPOS_VOTACION;

export const RESULTADOS_VOTACION = {
  aprobado: { etiqueta: 'Aprobado', descripcion: 'La propuesta obtuvo la mayoría requerida.', tono: 'positivo' },
  rechazado: { etiqueta: 'Rechazado', descripcion: 'La propuesta no obtuvo la mayoría requerida.', tono: 'negativo' },
  no_localizado: { etiqueta: 'El acta no dice el resultado', descripcion: 'El acta no anota si se aprobó o no.', tono: 'alerta' },
} as const satisfies Catalogo<string>;
export type ResultadoVotacion = keyof typeof RESULTADOS_VOTACION;

/** Cuadre entre la lista nominal del acta y el total que declara la Presidencia. */
export const CUADRE_VOTACION = {
  coincide: { etiqueta: 'Coinciden', descripcion: 'Los nombres del acta suman lo mismo que el total anunciado.', tono: 'positivo' },
  faltan_nombres: { etiqueta: 'Faltan nombres', descripcion: 'Quien dirige la sesión anunció más votos de los nombres que anota el acta.', tono: 'alerta' },
  sobran_nombres: { etiqueta: 'Sobran nombres', descripcion: 'El acta anota más nombres de los votos anunciados.', tono: 'alerta' },
  distinto_reparto: { etiqueta: 'Reparto distinto', descripcion: 'Son los mismos votos en total, pero repartidos distinto entre a favor, en contra y abstención.', tono: 'alerta' },
} as const satisfies Catalogo<string>;

export const CONFIANZA_OBSERVACION = {
  alta: { etiqueta: 'Confianza alta', descripcion: 'Una sola explicación posible; se registra como voto probable.', tono: 'positivo' },
  media: { etiqueta: 'Confianza media', descripcion: 'Explicación probable pero no única; no se asigna voto.', tono: 'pendiente' },
  baja: { etiqueta: 'Confianza baja', descripcion: 'Varias explicaciones posibles o documentos que se contradicen; no se asigna voto.', tono: 'alerta' },
} as const satisfies Catalogo<string>;

export const ESTADOS_OBSERVACION = {
  abierta: { etiqueta: 'Abierta', descripcion: 'Sin resolver.', tono: 'pendiente' },
  resuelta: { etiqueta: 'Resuelta', descripcion: 'Resuelta con la fuente indicada.', tono: 'positivo' },
} as const satisfies Catalogo<string>;

// ---------------------------------------------------------------- Compromisos

export const SEGUIMIENTO_COMPROMISO = {
  cumplido_documentado: { etiqueta: 'Se cumplió', descripcion: 'Hay pruebas públicas de que cumplió lo que prometió.', tono: 'positivo' },
  avance_documentado: { etiqueta: 'Va avanzando', descripcion: 'Hay pruebas de que avanzó, pero no del todo.', tono: 'info' },
  no_cumplido_documentado: { etiqueta: 'No se cumplió', descripcion: 'Solo cuando un documento oficial dice claramente que no se cumplió (por ejemplo, venció el plazo sin hacerlo).', tono: 'negativo' },
  sin_avance_localizado: { etiqueta: 'No encontramos avances', descripcion: 'No encontramos pruebas de avance. No quiere decir que no se cumplió.', tono: 'neutro' },
  pendiente_seguimiento: { etiqueta: 'Falta revisar', descripcion: 'Todavía no revisamos cómo va.', tono: 'pendiente' },
  no_verificado: { etiqueta: 'Sin revisar', descripcion: 'Todavía no lo comparamos con un documento oficial.', tono: 'alerta' },
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
