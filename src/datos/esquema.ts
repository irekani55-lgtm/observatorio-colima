/**
 * Esquema de las tablas de datos. Una sola declaración alimenta:
 *  - la validación (requeridos, fechas, catálogos, relaciones),
 *  - las plantillas CSV vacías (scripts/generar-demo.ts),
 *  - la documentación del diccionario de datos (página Metodología).
 *
 * Cada fila de datos es texto plano tal como viene del CSV/Excel.
 * Los tipos más estrictos se aplican en `modelo.ts`.
 */
import {
  CALIDAD_CARGO,
  CARGOS_COMISION,
  ESTADOS_ASISTENCIA,
  ESTADOS_PROCESALES,
  ESTADOS_VERIFICACION,
  PERIODOS_SESION,
  RESPUESTA_LOCALIZADA,
  RESULTADOS_VOTACION,
  ROLES_COMISION_TURNO,
  ROLES_PROMOVENTE,
  SEGUIMIENTO_COMPROMISO,
  SENTIDOS_VOTO,
  TIPOS_ASUNTO,
  TIPOS_FUENTE,
  TIPOS_INTERVENCION,
  TIPOS_REPRESENTACION,
  TIPOS_SESION,
  TIPOS_VOTACION,
} from '../config/catalogos';

export type TipoColumna = 'texto' | 'fecha' | 'entero' | 'url' | 'catalogo';

export interface ColumnaDef {
  nombre: string;
  descripcion: string;
  tipo?: TipoColumna;
  requerido?: boolean;
  valores?: readonly string[];
  /** Relación con otra tabla: el valor debe existir en tabla.columna. */
  ref?: { tabla: NombreTabla; columna: string };
}

export interface TablaDef {
  nombre: NombreTabla;
  titulo: string;
  descripcion: string;
  /** Columnas que forman el identificador único de la fila. */
  clave: string[];
  columnas: ColumnaDef[];
}

export const NOMBRES_TABLAS = [
  'evidencias',
  'partidos',
  'diputados',
  'distritos',
  'sesiones',
  'asistencias',
  'agenda',
  'asuntos',
  'asunto_promoventes',
  'asunto_comisiones',
  'exhortos',
  'intervenciones',
  'comisiones',
  'comision_integrantes',
  'reuniones_comision',
  'asistencia_comision',
  'votaciones',
  'votos',
  'compromisos',
  'compromiso_participantes',
] as const;
export type NombreTabla = (typeof NOMBRES_TABLAS)[number];

const k = (o: object) => Object.keys(o);
const fuente = (requerido = true): ColumnaDef => ({
  nombre: 'id_fuente',
  descripcion: 'Identificador de la evidencia (tabla evidencias) que respalda el registro.',
  requerido,
  ref: { tabla: 'evidencias', columna: 'id_fuente' },
});
const verificacion: ColumnaDef = {
  nombre: 'estado_verificacion',
  descripcion: 'verificado | pendiente | no_verificado',
  tipo: 'catalogo',
  valores: k(ESTADOS_VERIFICACION),
  requerido: true,
};
const diputado = (requerido = true): ColumnaDef => ({
  nombre: 'id_diputado',
  descripcion: 'Identificador de la persona legisladora (tabla diputados).',
  requerido,
  ref: { tabla: 'diputados', columna: 'id_diputado' },
});
const notas: ColumnaDef = { nombre: 'notas', descripcion: 'Observaciones de captura o revisión.' };

export const ESQUEMA: Record<NombreTabla, TablaDef> = {
  evidencias: {
    nombre: 'evidencias',
    titulo: 'Evidencias y fuentes',
    descripcion: 'Catálogo de documentos que respaldan los registros. Cada registro de las demás tablas apunta a una evidencia.',
    clave: ['id_fuente'],
    columnas: [
      { nombre: 'id_fuente', descripcion: 'Identificador único de la evidencia (p. ej. EV-GAC-2025-0012).', requerido: true },
      { nombre: 'tipo', descripcion: 'Tipo de documento.', tipo: 'catalogo', valores: k(TIPOS_FUENTE), requerido: true },
      { nombre: 'titulo', descripcion: 'Título o descripción del documento.', requerido: true },
      { nombre: 'institucion', descripcion: 'Institución que emite el documento.', requerido: true },
      { nombre: 'url', descripcion: 'Dirección pública del documento.', tipo: 'url', requerido: true },
      { nombre: 'fecha_documento', descripcion: 'Fecha del documento (AAAA-MM-DD).', tipo: 'fecha' },
      { nombre: 'fecha_consulta', descripcion: 'Fecha en que se consultó la URL (AAAA-MM-DD).', tipo: 'fecha', requerido: true },
      { nombre: 'oficial', descripcion: 'si | no — si la emite una institución pública responsable.', tipo: 'catalogo', valores: ['si', 'no'], requerido: true },
      { nombre: 'pagina', descripcion: 'Página, sección o minuto dentro del documento.' },
      notas,
    ],
  },
  partidos: {
    nombre: 'partidos',
    titulo: 'Partidos y grupos parlamentarios',
    descripcion: 'Catálogo de partidos o adscripciones. El orden de las filas fija el color de cada partido en las gráficas.',
    clave: ['id_partido'],
    columnas: [
      { nombre: 'id_partido', descripcion: 'Clave corta (p. ej. PAN, MORENA).', requerido: true },
      { nombre: 'nombre', descripcion: 'Nombre completo.', requerido: true },
      { nombre: 'siglas', descripcion: 'Siglas a mostrar.', requerido: true },
      { nombre: 'color_serie', descripcion: 'Opcional: posición 1–8 de la paleta categórica validada que usará el partido en las gráficas.', tipo: 'entero' },
      notas,
    ],
  },
  diputados: {
    nombre: 'diputados',
    titulo: 'Catálogo de diputados',
    descripcion: 'Una fila por persona que ocupó una curul en la Legislatura (propietarias y suplentes en funciones).',
    clave: ['id_diputado'],
    columnas: [
      { nombre: 'id_diputado', descripcion: 'Identificador único y estable (p. ej. DIP-01).', requerido: true },
      { nombre: 'nombre_completo', descripcion: 'Nombre como aparece en la fuente oficial.', requerido: true },
      { nombre: 'id_partido', descripcion: 'Partido o adscripción según el criterio indicado.', requerido: true, ref: { tabla: 'partidos', columna: 'id_partido' } },
      { nombre: 'criterio_adscripcion', descripcion: 'Qué refleja id_partido: postulación, grupo parlamentario actual, etc.' },
      { nombre: 'tipo_representacion', descripcion: 'MR (mayoría relativa) | RP (representación proporcional).', tipo: 'catalogo', valores: k(TIPOS_REPRESENTACION), requerido: true },
      { nombre: 'distrito', descripcion: 'Número de distrito local (1–16). Vacío para RP.', tipo: 'entero', ref: { tabla: 'distritos', columna: 'distrito' } },
      { nombre: 'calidad', descripcion: 'propietario | suplente', tipo: 'catalogo', valores: k(CALIDAD_CARGO), requerido: true },
      { nombre: 'id_titular', descripcion: 'Si es suplente: id_diputado del titular.', ref: { tabla: 'diputados', columna: 'id_diputado' } },
      { nombre: 'fecha_inicio', descripcion: 'Inicio del ejercicio del cargo (AAAA-MM-DD).', tipo: 'fecha', requerido: true },
      { nombre: 'fecha_fin', descripcion: 'Fin del ejercicio (vacío si sigue en funciones).', tipo: 'fecha' },
      { nombre: 'licencias', descripcion: 'Periodos de licencia dentro del ejercicio, "AAAA-MM-DD/AAAA-MM-DD" separados por ";". Fin vacío = licencia vigente.' },
      { nombre: 'url_ficha_oficial', descripcion: 'Ficha de la persona en el sitio del Congreso.', tipo: 'url' },
      { nombre: 'url_foto', descripcion: 'URL de origen de la fotografía oficial.', tipo: 'url' },
      { nombre: 'archivo_foto', descripcion: 'Copia local opcional de la fotografía (ruta dentro de public/).' },
      fuente(),
      verificacion,
      notas,
    ],
  },
  distritos: {
    nombre: 'distritos',
    titulo: 'Distritos electorales locales',
    descripcion: 'Los 16 distritos locales vigentes para la elección de 2024.',
    clave: ['distrito'],
    columnas: [
      { nombre: 'distrito', descripcion: 'Número de distrito (1–16).', tipo: 'entero', requerido: true },
      { nombre: 'cabecera', descripcion: 'Cabecera distrital según el IEE.' },
      { nombre: 'municipios', descripcion: 'Municipios que abarca, total o parcialmente, separados por ";".' },
      fuente(false),
      notas,
    ],
  },
  sesiones: {
    nombre: 'sesiones',
    titulo: 'Sesiones del Pleno',
    descripcion: 'Catálogo de sesiones. La numeración se reinicia cada año legislativo, por lo que el ID es independiente del número.',
    clave: ['id_sesion'],
    columnas: [
      { nombre: 'id_sesion', descripcion: 'ID único (p. ej. S-A1-PO1-ORD-005).', requerido: true },
      { nombre: 'fecha', descripcion: 'Fecha de la sesión (AAAA-MM-DD).', tipo: 'fecha', requerido: true },
      { nombre: 'anio_legislativo', descripcion: '1, 2 o 3.', tipo: 'catalogo', valores: ['1', '2', '3'], requerido: true },
      { nombre: 'periodo', descripcion: 'Periodo de sesiones.', tipo: 'catalogo', valores: k(PERIODOS_SESION), requerido: true },
      { nombre: 'tipo_sesion', descripcion: 'ordinaria | extraordinaria | solemne | permanente | otro', tipo: 'catalogo', valores: k(TIPOS_SESION), requerido: true },
      { nombre: 'numero_sesion', descripcion: 'Número de sesión según el acta (puede repetirse entre años).', tipo: 'entero' },
      { nombre: 'cuenta_para_asistencia', descripcion: 'si | no — si la sesión se considera elegible para el indicador de asistencia del Pleno.', tipo: 'catalogo', valores: ['si', 'no'], requerido: true },
      fuente(),
      notas,
    ],
  },
  asistencias: {
    nombre: 'asistencias',
    titulo: 'Asistencias a sesiones del Pleno',
    descripcion: 'Una fila por persona y sesión. Un registro faltante NO se interpreta como ausencia.',
    clave: ['id_sesion', 'id_diputado'],
    columnas: [
      { nombre: 'id_sesion', descripcion: 'Sesión (tabla sesiones).', requerido: true, ref: { tabla: 'sesiones', columna: 'id_sesion' } },
      diputado(),
      { nombre: 'estado', descripcion: 'asistencia | ausencia | justificada | pendiente | no_verificado', tipo: 'catalogo', valores: k(ESTADOS_ASISTENCIA), requerido: true },
      { nombre: 'justificacion', descripcion: 'Texto de la justificación pública, si existe.' },
      fuente(),
      notas,
    ],
  },
  agenda: {
    nombre: 'agenda',
    titulo: 'Agenda y actividades públicas',
    descripcion: 'Actividades públicas documentadas (foros, audiencias, gestiones, informes).',
    clave: ['id_actividad'],
    columnas: [
      { nombre: 'id_actividad', descripcion: 'ID único.', requerido: true },
      { nombre: 'fecha', descripcion: 'AAAA-MM-DD', tipo: 'fecha', requerido: true },
      diputado(),
      { nombre: 'tipo', descripcion: 'foro, informe, audiencia, gestión, recorrido, otro.' },
      { nombre: 'descripcion', descripcion: 'Descripción neutral.', requerido: true },
      { nombre: 'lugar', descripcion: 'Municipio o sede.' },
      fuente(),
      notas,
    ],
  },
  asuntos: {
    nombre: 'asuntos',
    titulo: 'Asuntos legislativos',
    descripcion: 'Una fila por asunto único (iniciativa, dictamen, decreto, acuerdo, punto de acuerdo, exhorto). Los promoventes y comisiones van en tablas aparte para no duplicar asuntos.',
    clave: ['id_asunto'],
    columnas: [
      { nombre: 'id_asunto', descripcion: 'ID único (p. ej. INI-2025-0042).', requerido: true },
      { nombre: 'tipo', descripcion: 'Tipo de asunto.', tipo: 'catalogo', valores: k(TIPOS_ASUNTO), requerido: true },
      { nombre: 'titulo', descripcion: 'Título oficial o resumido.', requerido: true },
      { nombre: 'descripcion', descripcion: 'Descripción neutral del contenido.' },
      { nombre: 'tema', descripcion: 'Tema principal (catálogo libre, p. ej. Salud, Seguridad).' },
      { nombre: 'fecha_presentacion', descripcion: 'AAAA-MM-DD', tipo: 'fecha' },
      { nombre: 'expediente', descripcion: 'Número de expediente o folio.' },
      { nombre: 'estado_procesal', descripcion: 'Estado actual documentado.', tipo: 'catalogo', valores: k(ESTADOS_PROCESALES), requerido: true },
      { nombre: 'fecha_dictamen', descripcion: 'AAAA-MM-DD', tipo: 'fecha' },
      { nombre: 'resultado_dictamen', descripcion: 'Sentido del dictamen (aprobatorio, en sentido negativo, con modificaciones...).' },
      { nombre: 'fecha_votacion', descripcion: 'Fecha de discusión o votación en Pleno.', tipo: 'fecha' },
      { nombre: 'resultado_votacion', descripcion: 'aprobado | rechazado | no_localizado', tipo: 'catalogo', valores: k(RESULTADOS_VOTACION) },
      { nombre: 'fecha_aprobacion', descripcion: 'AAAA-MM-DD', tipo: 'fecha' },
      { nombre: 'numero_decreto_acuerdo', descripcion: 'Número de decreto o acuerdo.' },
      { nombre: 'fecha_publicacion', descripcion: 'Publicación en el Periódico Oficial.', tipo: 'fecha' },
      { nombre: 'id_asunto_origen', descripcion: 'Para dictámenes o decretos: asunto que resuelven.', ref: { tabla: 'asuntos', columna: 'id_asunto' } },
      { nombre: 'url_ficha', descripcion: 'Ficha del asunto en el sitio oficial.', tipo: 'url' },
      { nombre: 'url_documento', descripcion: 'Documento oficial (PDF).', tipo: 'url' },
      fuente(),
      verificacion,
      notas,
    ],
  },
  asunto_promoventes: {
    nombre: 'asunto_promoventes',
    titulo: 'Promoventes de asuntos',
    descripcion: 'Relación asunto–promovente. Un asunto con varios promoventes aparece una sola vez en "asuntos".',
    clave: ['id_asunto', 'id_diputado', 'promovente_externo'],
    columnas: [
      { nombre: 'id_asunto', descripcion: 'Asunto.', requerido: true, ref: { tabla: 'asuntos', columna: 'id_asunto' } },
      diputado(false),
      { nombre: 'promovente_externo', descripcion: 'Si no es diputación: Ejecutivo, ayuntamiento, ciudadanía, etc.' },
      { nombre: 'rol', descripcion: 'autor | coautor | adherente', tipo: 'catalogo', valores: k(ROLES_PROMOVENTE), requerido: true },
      fuente(false),
    ],
  },
  asunto_comisiones: {
    nombre: 'asunto_comisiones',
    titulo: 'Turnos a comisiones',
    descripcion: 'Relación asunto–comisión. Un asunto turnado a varias comisiones cuenta una vez en los totales generales.',
    clave: ['id_asunto', 'id_comision'],
    columnas: [
      { nombre: 'id_asunto', descripcion: 'Asunto.', requerido: true, ref: { tabla: 'asuntos', columna: 'id_asunto' } },
      { nombre: 'id_comision', descripcion: 'Comisión.', requerido: true, ref: { tabla: 'comisiones', columna: 'id_comision' } },
      { nombre: 'rol', descripcion: 'dictaminadora | coadyuvante | opinion', tipo: 'catalogo', valores: k(ROLES_COMISION_TURNO), requerido: true },
      { nombre: 'fecha_turno', descripcion: 'AAAA-MM-DD', tipo: 'fecha' },
      { nombre: 'fecha_dictamen', descripcion: 'Fecha en que esta comisión dictaminó.', tipo: 'fecha' },
      fuente(false),
    ],
  },
  exhortos: {
    nombre: 'exhortos',
    titulo: 'Seguimiento de exhortos',
    descripcion: 'Datos de seguimiento de los asuntos de tipo "exhorto". Título, fechas y promoventes viven en "asuntos".',
    clave: ['id_exhorto'],
    columnas: [
      { nombre: 'id_exhorto', descripcion: 'ID único del exhorto.', requerido: true },
      { nombre: 'id_asunto', descripcion: 'Asunto de tipo exhorto.', requerido: true, ref: { tabla: 'asuntos', columna: 'id_asunto' } },
      { nombre: 'autoridad_destinataria', descripcion: 'Autoridad a la que se dirige.', requerido: true },
      { nombre: 'orden_gobierno', descripcion: 'federal | estatal | municipal | autonomo' },
      { nombre: 'fecha_envio', descripcion: 'Fecha del oficio de envío a la autoridad.', tipo: 'fecha' },
      { nombre: 'id_fuente_envio', descripcion: 'Evidencia del envío.', ref: { tabla: 'evidencias', columna: 'id_fuente' } },
      { nombre: 'respuesta_localizada', descripcion: 'si | no | (vacío = aún no se busca).', tipo: 'catalogo', valores: k(RESPUESTA_LOCALIZADA) },
      { nombre: 'fecha_respuesta', descripcion: 'AAAA-MM-DD', tipo: 'fecha' },
      { nombre: 'id_fuente_respuesta', descripcion: 'Evidencia de la respuesta.', ref: { tabla: 'evidencias', columna: 'id_fuente' } },
      { nombre: 'acciones_posteriores', descripcion: 'Acciones documentadas de la autoridad.' },
      { nombre: 'id_fuente_acciones', descripcion: 'Evidencia de las acciones.', ref: { tabla: 'evidencias', columna: 'id_fuente' } },
      { nombre: 'verificacion_seguimiento', descripcion: 'verificado | pendiente | no_verificado', tipo: 'catalogo', valores: k(ESTADOS_VERIFICACION), requerido: true },
      notas,
    ],
  },
  intervenciones: {
    nombre: 'intervenciones',
    titulo: 'Intervenciones en tribuna',
    descripcion: 'Intervenciones documentadas en el Diario de los Debates o versiones estenográficas.',
    clave: ['id_intervencion'],
    columnas: [
      { nombre: 'id_intervencion', descripcion: 'ID único.', requerido: true },
      { nombre: 'id_sesion', descripcion: 'Sesión.', requerido: true, ref: { tabla: 'sesiones', columna: 'id_sesion' } },
      diputado(),
      { nombre: 'id_asunto', descripcion: 'Asunto discutido, si está registrado.', ref: { tabla: 'asuntos', columna: 'id_asunto' } },
      { nombre: 'asunto_texto', descripcion: 'Asunto discutido (texto, si no hay id_asunto).' },
      { nombre: 'tema', descripcion: 'Tema abordado.' },
      { nombre: 'tipo_intervencion', descripcion: 'Tipo.', tipo: 'catalogo', valores: k(TIPOS_INTERVENCION), requerido: true },
      { nombre: 'url_documento', descripcion: 'Diario de los Debates o versión estenográfica.', tipo: 'url' },
      { nombre: 'pagina', descripcion: 'Página o sección.' },
      fuente(),
      verificacion,
    ],
  },
  comisiones: {
    nombre: 'comisiones',
    titulo: 'Comisiones legislativas',
    descripcion: 'Catálogo de comisiones.',
    clave: ['id_comision'],
    columnas: [
      { nombre: 'id_comision', descripcion: 'ID único.', requerido: true },
      { nombre: 'nombre', descripcion: 'Nombre oficial.', requerido: true },
      { nombre: 'tipo', descripcion: 'permanente | especial | otra' },
      { nombre: 'url', descripcion: 'Micrositio oficial.', tipo: 'url' },
      fuente(false),
    ],
  },
  comision_integrantes: {
    nombre: 'comision_integrantes',
    titulo: 'Integrantes de comisiones',
    descripcion: 'Relación comisión–persona con su cargo.',
    clave: ['id_comision', 'id_diputado', 'fecha_inicio'],
    columnas: [
      { nombre: 'id_comision', descripcion: 'Comisión.', requerido: true, ref: { tabla: 'comisiones', columna: 'id_comision' } },
      diputado(),
      { nombre: 'cargo', descripcion: 'presidencia | secretaria | vocal', tipo: 'catalogo', valores: k(CARGOS_COMISION), requerido: true },
      { nombre: 'fecha_inicio', descripcion: 'AAAA-MM-DD', tipo: 'fecha' },
      { nombre: 'fecha_fin', descripcion: 'AAAA-MM-DD', tipo: 'fecha' },
      fuente(),
    ],
  },
  reuniones_comision: {
    nombre: 'reuniones_comision',
    titulo: 'Reuniones de comisión',
    descripcion: 'Reuniones documentadas. La falta de un acta localizada no prueba que no hubo reunión.',
    clave: ['id_reunion'],
    columnas: [
      { nombre: 'id_reunion', descripcion: 'ID único.', requerido: true },
      { nombre: 'id_comision', descripcion: 'Comisión convocante.', requerido: true, ref: { tabla: 'comisiones', columna: 'id_comision' } },
      { nombre: 'fecha', descripcion: 'AAAA-MM-DD', tipo: 'fecha', requerido: true },
      { nombre: 'tipo', descripcion: 'ordinaria | extraordinaria | conjunta | trabajo' },
      { nombre: 'url_acta', descripcion: 'Acta o minuta.', tipo: 'url' },
      fuente(),
    ],
  },
  asistencia_comision: {
    nombre: 'asistencia_comision',
    titulo: 'Asistencia a reuniones de comisión',
    descripcion: 'Asistencia de integrantes a reuniones de comisión, cuando hay lista verificable.',
    clave: ['id_reunion', 'id_diputado'],
    columnas: [
      { nombre: 'id_reunion', descripcion: 'Reunión.', requerido: true, ref: { tabla: 'reuniones_comision', columna: 'id_reunion' } },
      diputado(),
      { nombre: 'estado', descripcion: 'Mismo catálogo que las asistencias del Pleno.', tipo: 'catalogo', valores: k(ESTADOS_ASISTENCIA), requerido: true },
      fuente(false),
    ],
  },
  votaciones: {
    nombre: 'votaciones',
    titulo: 'Votaciones',
    descripcion: 'Una fila por votación en el Pleno.',
    clave: ['id_votacion'],
    columnas: [
      { nombre: 'id_votacion', descripcion: 'ID único.', requerido: true },
      { nombre: 'id_sesion', descripcion: 'Sesión.', requerido: true, ref: { tabla: 'sesiones', columna: 'id_sesion' } },
      { nombre: 'id_asunto', descripcion: 'Asunto votado.', ref: { tabla: 'asuntos', columna: 'id_asunto' } },
      { nombre: 'descripcion', descripcion: 'Qué se votó (en lo general, en lo particular, dispensa de trámite...).', requerido: true },
      { nombre: 'tipo_votacion', descripcion: 'nominal | economica | cedula | otro', tipo: 'catalogo', valores: k(TIPOS_VOTACION), requerido: true },
      { nombre: 'resultado', descripcion: 'aprobado | rechazado | no_localizado', tipo: 'catalogo', valores: k(RESULTADOS_VOTACION), requerido: true },
      { nombre: 'total_favor', descripcion: 'Total oficial a favor (para cotejo).', tipo: 'entero' },
      { nombre: 'total_contra', descripcion: 'Total oficial en contra.', tipo: 'entero' },
      { nombre: 'total_abstencion', descripcion: 'Total oficial de abstenciones.', tipo: 'entero' },
      fuente(),
      verificacion,
    ],
  },
  votos: {
    nombre: 'votos',
    titulo: 'Votos individuales',
    descripcion: 'Sentido del voto de cada persona, solo cuando la fuente lo acredita.',
    clave: ['id_votacion', 'id_diputado'],
    columnas: [
      { nombre: 'id_votacion', descripcion: 'Votación.', requerido: true, ref: { tabla: 'votaciones', columna: 'id_votacion' } },
      diputado(),
      { nombre: 'sentido', descripcion: 'favor | contra | abstencion | ausente | no_localizado', tipo: 'catalogo', valores: k(SENTIDOS_VOTO), requerido: true },
      fuente(false),
    ],
  },
  compromisos: {
    nombre: 'compromisos',
    titulo: 'Acuerdos y compromisos públicos',
    descripcion: 'Compromisos públicos documentables y su seguimiento.',
    clave: ['id_compromiso'],
    columnas: [
      { nombre: 'id_compromiso', descripcion: 'ID único.', requerido: true },
      { nombre: 'descripcion', descripcion: 'Compromiso en términos literales o neutrales.', requerido: true },
      { nombre: 'fecha_origen', descripcion: 'Fecha en que se expresó.', tipo: 'fecha', requerido: true },
      { nombre: 'fecha_limite', descripcion: 'Solo si la fuente la establece expresamente.', tipo: 'fecha' },
      { nombre: 'resultado_documentado', descripcion: 'Qué se ha documentado del compromiso.' },
      { nombre: 'estado_seguimiento', descripcion: 'Estado del seguimiento.', tipo: 'catalogo', valores: k(SEGUIMIENTO_COMPROMISO), requerido: true },
      { nombre: 'id_fuente', descripcion: 'Evidencia del compromiso.', requerido: true, ref: { tabla: 'evidencias', columna: 'id_fuente' } },
      { nombre: 'id_fuente_resultado', descripcion: 'Evidencia del resultado.', ref: { tabla: 'evidencias', columna: 'id_fuente' } },
      notas,
    ],
  },
  compromiso_participantes: {
    nombre: 'compromiso_participantes',
    titulo: 'Participantes en compromisos',
    descripcion: 'Personas legisladoras responsables o participantes.',
    clave: ['id_compromiso', 'id_diputado'],
    columnas: [
      { nombre: 'id_compromiso', descripcion: 'Compromiso.', requerido: true, ref: { tabla: 'compromisos', columna: 'id_compromiso' } },
      diputado(),
      { nombre: 'rol', descripcion: 'responsable | participante' },
    ],
  },
};

export type Fila = Record<string, string>;
export type TablasCrudas = Record<NombreTabla, Fila[]>;

export function tablasVacias(): TablasCrudas {
  return Object.fromEntries(NOMBRES_TABLAS.map((n) => [n, []])) as unknown as TablasCrudas;
}

export function claveDeFila(tabla: NombreTabla, fila: Fila): string {
  return ESQUEMA[tabla].clave.map((c) => fila[c] ?? '').join('|');
}

/** Columna que identifica la fila para mostrarla en reportes. */
export function idLegible(tabla: NombreTabla, fila: Fila): string {
  return ESQUEMA[tabla].clave.map((c) => fila[c]).filter(Boolean).join(' / ') || '(sin ID)';
}
