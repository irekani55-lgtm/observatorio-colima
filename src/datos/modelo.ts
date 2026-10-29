/**
 * Modelo relacional en memoria. Toma las tablas crudas (texto) y construye
 * registros tipados e índices por ID. NO modifica ni descarta registros: los
 * incompletos se conservan y la validación los señala.
 */
import type {
  EstadoAsistencia,
  EstadoProcesal,
  EstadoVerificacion,
  PeriodoSesion,
  ResultadoVotacion,
  RolComisionTurno,
  RolPromovente,
  SeguimientoCompromiso,
  SentidoVoto,
  TipoAsunto,
  TipoRepresentacion,
  TipoSesion,
  TipoVotacion,
} from '../config/catalogos';
import { anioLegislativoDeFecha } from '../config/legislatura';
import type { ConjuntoCargado, Manifiesto } from './cargar';
import type { Fila, TablasCrudas } from './esquema';

export interface Evidencia {
  id_fuente: string;
  tipo: string;
  titulo: string;
  institucion: string;
  url: string;
  fecha_documento: string;
  fecha_consulta: string;
  oficial: string;
  pagina: string;
}

export interface Partido {
  id_partido: string;
  nombre: string;
  siglas: string;
  /** Posición de color (0–7): color_serie − 1 si se indica; si no, el orden en el catálogo. */
  orden: number;
}

export interface Diputado {
  id_diputado: string;
  nombre_completo: string;
  id_partido: string;
  criterio_adscripcion: string;
  tipo_representacion: TipoRepresentacion;
  distrito: number | null;
  calidad: string;
  id_titular: string;
  fecha_inicio: string;
  fecha_fin: string;
  /** Periodos [desde, hasta] en que la persona estuvo con licencia (hasta vacío = vigente). */
  licencias: [string, string][];
  url_ficha_oficial: string;
  url_foto: string;
  archivo_foto: string;
  id_fuente: string;
  estado_verificacion: EstadoVerificacion;
  notas: string;
}

export interface Distrito {
  distrito: number;
  cabecera: string;
  municipios: string[];
  id_fuente: string;
}

export interface Sesion {
  id_sesion: string;
  fecha: string;
  anio_legislativo: 1 | 2 | 3 | null;
  periodo: PeriodoSesion;
  tipo_sesion: TipoSesion;
  numero_sesion: number | null;
  cuenta_para_asistencia: boolean;
  id_fuente: string;
}

export interface Asistencia {
  id_sesion: string;
  id_diputado: string;
  estado: EstadoAsistencia;
  justificacion: string;
  id_fuente: string;
}

export interface Promovente {
  id_asunto: string;
  id_diputado: string;
  promovente_externo: string;
  rol: RolPromovente;
}

export interface Turno {
  id_asunto: string;
  id_comision: string;
  rol: RolComisionTurno;
  fecha_turno: string;
  fecha_dictamen: string;
}

export interface Asunto {
  id_asunto: string;
  tipo: TipoAsunto;
  titulo: string;
  descripcion: string;
  tema: string;
  fecha_presentacion: string;
  expediente: string;
  estado_procesal: EstadoProcesal;
  fecha_dictamen: string;
  resultado_dictamen: string;
  fecha_votacion: string;
  resultado_votacion: ResultadoVotacion | '';
  fecha_aprobacion: string;
  numero_decreto_acuerdo: string;
  fecha_publicacion: string;
  id_asunto_origen: string;
  url_ficha: string;
  url_documento: string;
  id_fuente: string;
  estado_verificacion: EstadoVerificacion;
  /** Calculado: año legislativo según la fecha de presentación. */
  anio_legislativo: 1 | 2 | 3 | undefined;
  promoventes: Promovente[];
  turnos: Turno[];
}

export interface Exhorto {
  id_exhorto: string;
  id_asunto: string;
  autoridad_destinataria: string;
  orden_gobierno: string;
  fecha_envio: string;
  id_fuente_envio: string;
  respuesta_localizada: 'si' | 'no' | '';
  fecha_respuesta: string;
  id_fuente_respuesta: string;
  acciones_posteriores: string;
  id_fuente_acciones: string;
  verificacion_seguimiento: EstadoVerificacion;
  notas: string;
}

export interface Intervencion {
  id_intervencion: string;
  id_sesion: string;
  id_diputado: string;
  id_asunto: string;
  asunto_texto: string;
  tema: string;
  tipo_intervencion: string;
  url_documento: string;
  pagina: string;
  id_fuente: string;
  estado_verificacion: EstadoVerificacion;
}

export interface Comision {
  id_comision: string;
  nombre: string;
  tipo: string;
  url: string;
}

export interface Integrante {
  id_comision: string;
  id_diputado: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin: string;
  id_fuente: string;
}

export interface Reunion {
  id_reunion: string;
  id_comision: string;
  fecha: string;
  tipo: string;
  url_acta: string;
  id_fuente: string;
}

export interface AsistenciaComision {
  id_reunion: string;
  id_diputado: string;
  estado: EstadoAsistencia;
}

export interface Votacion {
  id_votacion: string;
  id_sesion: string;
  id_asunto: string;
  descripcion: string;
  tipo_votacion: TipoVotacion;
  resultado: ResultadoVotacion;
  total_favor: number | null;
  total_contra: number | null;
  total_abstencion: number | null;
  id_fuente: string;
  estado_verificacion: EstadoVerificacion;
}

export interface Voto {
  id_votacion: string;
  id_diputado: string;
  sentido: SentidoVoto;
}

export interface Compromiso {
  id_compromiso: string;
  descripcion: string;
  fecha_origen: string;
  fecha_limite: string;
  resultado_documentado: string;
  estado_seguimiento: SeguimientoCompromiso;
  id_fuente: string;
  id_fuente_resultado: string;
  participantes: { id_diputado: string; rol: string }[];
}

export interface Actividad {
  id_actividad: string;
  fecha: string;
  id_diputado: string;
  tipo: string;
  descripcion: string;
  lugar: string;
  id_fuente: string;
}

export interface Base {
  manifiesto: Manifiesto;
  crudas: TablasCrudas;
  archivosFaltantes: string[];
  evidencias: Evidencia[];
  partidos: Partido[];
  diputados: Diputado[];
  distritos: Distrito[];
  sesiones: Sesion[];
  asistencias: Asistencia[];
  agenda: Actividad[];
  asuntos: Asunto[];
  exhortos: Exhorto[];
  intervenciones: Intervencion[];
  comisiones: Comision[];
  integrantes: Integrante[];
  reuniones: Reunion[];
  asistenciaComision: AsistenciaComision[];
  votaciones: Votacion[];
  votos: Voto[];
  compromisos: Compromiso[];
  idx: {
    evidencia: Map<string, Evidencia>;
    partido: Map<string, Partido>;
    diputado: Map<string, Diputado>;
    sesion: Map<string, Sesion>;
    asunto: Map<string, Asunto>;
    comision: Map<string, Comision>;
    votacion: Map<string, Votacion>;
    exhortoPorAsunto: Map<string, Exhorto>;
  };
}

const s = (f: Fila, c: string) => f[c] ?? '';
const entero = (v: string): number | null => (/^-?\d+$/.test(v) ? Number(v) : null);
const minus = (v: string) => v.toLowerCase();

function porId<T>(lista: T[], clave: (t: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  // Si hay IDs duplicados se conserva el primero; la validación lo reporta.
  for (const t of lista) {
    const k = clave(t);
    if (k && !m.has(k)) m.set(k, t);
  }
  return m;
}

export function construirBase(c: ConjuntoCargado): Base {
  const t = c.tablas;

  const evidencias: Evidencia[] = t.evidencias.map((f) => ({
    id_fuente: s(f, 'id_fuente'),
    tipo: minus(s(f, 'tipo')),
    titulo: s(f, 'titulo'),
    institucion: s(f, 'institucion'),
    url: s(f, 'url'),
    fecha_documento: s(f, 'fecha_documento'),
    fecha_consulta: s(f, 'fecha_consulta'),
    oficial: minus(s(f, 'oficial')),
    pagina: s(f, 'pagina'),
  }));

  const partidos: Partido[] = t.partidos.map((f, i) => ({
    id_partido: s(f, 'id_partido'),
    nombre: s(f, 'nombre'),
    siglas: s(f, 'siglas') || s(f, 'id_partido'),
    orden: /^[1-8]$/.test(s(f, 'color_serie')) ? Number(s(f, 'color_serie')) - 1 : i,
  }));

  const diputados: Diputado[] = t.diputados.map((f) => ({
    id_diputado: s(f, 'id_diputado'),
    nombre_completo: s(f, 'nombre_completo'),
    id_partido: s(f, 'id_partido'),
    criterio_adscripcion: s(f, 'criterio_adscripcion'),
    tipo_representacion: s(f, 'tipo_representacion').toUpperCase() as TipoRepresentacion,
    distrito: entero(s(f, 'distrito')),
    calidad: minus(s(f, 'calidad')),
    id_titular: s(f, 'id_titular'),
    fecha_inicio: s(f, 'fecha_inicio'),
    fecha_fin: s(f, 'fecha_fin'),
    licencias: s(f, 'licencias')
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const [desde = '', hasta = ''] = x.split('/').map((y) => y.trim());
        return [desde, hasta] as [string, string];
      }),
    url_ficha_oficial: s(f, 'url_ficha_oficial'),
    url_foto: s(f, 'url_foto'),
    archivo_foto: s(f, 'archivo_foto'),
    id_fuente: s(f, 'id_fuente'),
    estado_verificacion: (minus(s(f, 'estado_verificacion')) || 'no_verificado') as EstadoVerificacion,
    notas: s(f, 'notas'),
  }));

  const distritos: Distrito[] = t.distritos
    .map((f) => ({
      distrito: entero(s(f, 'distrito')) ?? NaN,
      cabecera: s(f, 'cabecera'),
      municipios: s(f, 'municipios').split(';').map((m) => m.trim()).filter(Boolean),
      id_fuente: s(f, 'id_fuente'),
    }))
    .filter((d) => !Number.isNaN(d.distrito));

  const sesiones: Sesion[] = t.sesiones.map((f) => {
    const a = entero(s(f, 'anio_legislativo'));
    return {
      id_sesion: s(f, 'id_sesion'),
      fecha: s(f, 'fecha'),
      anio_legislativo: a === 1 || a === 2 || a === 3 ? a : null,
      periodo: minus(s(f, 'periodo')) as PeriodoSesion,
      tipo_sesion: minus(s(f, 'tipo_sesion')) as TipoSesion,
      numero_sesion: entero(s(f, 'numero_sesion')),
      cuenta_para_asistencia: minus(s(f, 'cuenta_para_asistencia')) !== 'no',
      id_fuente: s(f, 'id_fuente'),
    };
  });

  const asistencias: Asistencia[] = t.asistencias.map((f) => ({
    id_sesion: s(f, 'id_sesion'),
    id_diputado: s(f, 'id_diputado'),
    estado: (minus(s(f, 'estado')) || 'pendiente') as EstadoAsistencia,
    justificacion: s(f, 'justificacion'),
    id_fuente: s(f, 'id_fuente'),
  }));

  const promoventesPorAsunto = new Map<string, Promovente[]>();
  for (const f of t.asunto_promoventes) {
    const p: Promovente = {
      id_asunto: s(f, 'id_asunto'),
      id_diputado: s(f, 'id_diputado'),
      promovente_externo: s(f, 'promovente_externo'),
      rol: minus(s(f, 'rol')) as RolPromovente,
    };
    const lista = promoventesPorAsunto.get(p.id_asunto) ?? [];
    // Evita duplicar a la misma persona en el mismo asunto.
    if (!lista.some((x) => x.id_diputado === p.id_diputado && x.promovente_externo === p.promovente_externo)) lista.push(p);
    promoventesPorAsunto.set(p.id_asunto, lista);
  }

  const turnosPorAsunto = new Map<string, Turno[]>();
  for (const f of t.asunto_comisiones) {
    const tu: Turno = {
      id_asunto: s(f, 'id_asunto'),
      id_comision: s(f, 'id_comision'),
      rol: minus(s(f, 'rol')) as RolComisionTurno,
      fecha_turno: s(f, 'fecha_turno'),
      fecha_dictamen: s(f, 'fecha_dictamen'),
    };
    const lista = turnosPorAsunto.get(tu.id_asunto) ?? [];
    if (!lista.some((x) => x.id_comision === tu.id_comision)) lista.push(tu);
    turnosPorAsunto.set(tu.id_asunto, lista);
  }

  const asuntos: Asunto[] = t.asuntos.map((f) => {
    const id = s(f, 'id_asunto');
    return {
      id_asunto: id,
      tipo: minus(s(f, 'tipo')) as TipoAsunto,
      titulo: s(f, 'titulo'),
      descripcion: s(f, 'descripcion'),
      tema: s(f, 'tema'),
      fecha_presentacion: s(f, 'fecha_presentacion'),
      expediente: s(f, 'expediente'),
      estado_procesal: (minus(s(f, 'estado_procesal')) || 'no_verificado') as EstadoProcesal,
      fecha_dictamen: s(f, 'fecha_dictamen'),
      resultado_dictamen: s(f, 'resultado_dictamen'),
      fecha_votacion: s(f, 'fecha_votacion'),
      resultado_votacion: minus(s(f, 'resultado_votacion')) as ResultadoVotacion | '',
      fecha_aprobacion: s(f, 'fecha_aprobacion'),
      numero_decreto_acuerdo: s(f, 'numero_decreto_acuerdo'),
      fecha_publicacion: s(f, 'fecha_publicacion'),
      id_asunto_origen: s(f, 'id_asunto_origen'),
      url_ficha: s(f, 'url_ficha'),
      url_documento: s(f, 'url_documento'),
      id_fuente: s(f, 'id_fuente'),
      estado_verificacion: (minus(s(f, 'estado_verificacion')) || 'no_verificado') as EstadoVerificacion,
      anio_legislativo: anioLegislativoDeFecha(s(f, 'fecha_presentacion')),
      promoventes: promoventesPorAsunto.get(id) ?? [],
      turnos: turnosPorAsunto.get(id) ?? [],
    };
  });

  const exhortos: Exhorto[] = t.exhortos.map((f) => ({
    id_exhorto: s(f, 'id_exhorto'),
    id_asunto: s(f, 'id_asunto'),
    autoridad_destinataria: s(f, 'autoridad_destinataria'),
    orden_gobierno: minus(s(f, 'orden_gobierno')),
    fecha_envio: s(f, 'fecha_envio'),
    id_fuente_envio: s(f, 'id_fuente_envio'),
    respuesta_localizada: minus(s(f, 'respuesta_localizada')) as Exhorto['respuesta_localizada'],
    fecha_respuesta: s(f, 'fecha_respuesta'),
    id_fuente_respuesta: s(f, 'id_fuente_respuesta'),
    acciones_posteriores: s(f, 'acciones_posteriores'),
    id_fuente_acciones: s(f, 'id_fuente_acciones'),
    verificacion_seguimiento: (minus(s(f, 'verificacion_seguimiento')) || 'no_verificado') as EstadoVerificacion,
    notas: s(f, 'notas'),
  }));

  const intervenciones: Intervencion[] = t.intervenciones.map((f) => ({
    id_intervencion: s(f, 'id_intervencion'),
    id_sesion: s(f, 'id_sesion'),
    id_diputado: s(f, 'id_diputado'),
    id_asunto: s(f, 'id_asunto'),
    asunto_texto: s(f, 'asunto_texto'),
    tema: s(f, 'tema'),
    tipo_intervencion: minus(s(f, 'tipo_intervencion')),
    url_documento: s(f, 'url_documento'),
    pagina: s(f, 'pagina'),
    id_fuente: s(f, 'id_fuente'),
    estado_verificacion: (minus(s(f, 'estado_verificacion')) || 'no_verificado') as EstadoVerificacion,
  }));

  const comisiones: Comision[] = t.comisiones.map((f) => ({
    id_comision: s(f, 'id_comision'),
    nombre: s(f, 'nombre'),
    tipo: minus(s(f, 'tipo')),
    url: s(f, 'url'),
  }));

  const integrantes: Integrante[] = t.comision_integrantes.map((f) => ({
    id_comision: s(f, 'id_comision'),
    id_diputado: s(f, 'id_diputado'),
    cargo: minus(s(f, 'cargo')),
    fecha_inicio: s(f, 'fecha_inicio'),
    fecha_fin: s(f, 'fecha_fin'),
    id_fuente: s(f, 'id_fuente'),
  }));

  const reuniones: Reunion[] = t.reuniones_comision.map((f) => ({
    id_reunion: s(f, 'id_reunion'),
    id_comision: s(f, 'id_comision'),
    fecha: s(f, 'fecha'),
    tipo: minus(s(f, 'tipo')),
    url_acta: s(f, 'url_acta'),
    id_fuente: s(f, 'id_fuente'),
  }));

  const asistenciaComision: AsistenciaComision[] = t.asistencia_comision.map((f) => ({
    id_reunion: s(f, 'id_reunion'),
    id_diputado: s(f, 'id_diputado'),
    estado: (minus(s(f, 'estado')) || 'pendiente') as EstadoAsistencia,
  }));

  const votaciones: Votacion[] = t.votaciones.map((f) => ({
    id_votacion: s(f, 'id_votacion'),
    id_sesion: s(f, 'id_sesion'),
    id_asunto: s(f, 'id_asunto'),
    descripcion: s(f, 'descripcion'),
    tipo_votacion: minus(s(f, 'tipo_votacion')) as TipoVotacion,
    resultado: (minus(s(f, 'resultado')) || 'no_localizado') as ResultadoVotacion,
    total_favor: entero(s(f, 'total_favor')),
    total_contra: entero(s(f, 'total_contra')),
    total_abstencion: entero(s(f, 'total_abstencion')),
    id_fuente: s(f, 'id_fuente'),
    estado_verificacion: (minus(s(f, 'estado_verificacion')) || 'no_verificado') as EstadoVerificacion,
  }));

  const votos: Voto[] = t.votos.map((f) => ({
    id_votacion: s(f, 'id_votacion'),
    id_diputado: s(f, 'id_diputado'),
    sentido: (minus(s(f, 'sentido')) || 'no_localizado') as SentidoVoto,
  }));

  const participantes = new Map<string, Compromiso['participantes']>();
  for (const f of t.compromiso_participantes) {
    const id = s(f, 'id_compromiso');
    participantes.set(id, [...(participantes.get(id) ?? []), { id_diputado: s(f, 'id_diputado'), rol: s(f, 'rol') }]);
  }
  const compromisos: Compromiso[] = t.compromisos.map((f) => ({
    id_compromiso: s(f, 'id_compromiso'),
    descripcion: s(f, 'descripcion'),
    fecha_origen: s(f, 'fecha_origen'),
    fecha_limite: s(f, 'fecha_limite'),
    resultado_documentado: s(f, 'resultado_documentado'),
    estado_seguimiento: (minus(s(f, 'estado_seguimiento')) || 'pendiente_seguimiento') as SeguimientoCompromiso,
    id_fuente: s(f, 'id_fuente'),
    id_fuente_resultado: s(f, 'id_fuente_resultado'),
    participantes: participantes.get(s(f, 'id_compromiso')) ?? [],
  }));

  const agenda: Actividad[] = t.agenda.map((f) => ({
    id_actividad: s(f, 'id_actividad'),
    fecha: s(f, 'fecha'),
    id_diputado: s(f, 'id_diputado'),
    tipo: s(f, 'tipo'),
    descripcion: s(f, 'descripcion'),
    lugar: s(f, 'lugar'),
    id_fuente: s(f, 'id_fuente'),
  }));

  return {
    manifiesto: c.manifiesto,
    crudas: t,
    archivosFaltantes: c.archivosFaltantes,
    evidencias,
    partidos,
    diputados,
    distritos,
    sesiones,
    asistencias,
    agenda,
    asuntos,
    exhortos,
    intervenciones,
    comisiones,
    integrantes,
    reuniones,
    asistenciaComision,
    votaciones,
    votos,
    compromisos,
    idx: {
      evidencia: porId(evidencias, (e) => e.id_fuente),
      partido: porId(partidos, (p) => p.id_partido),
      diputado: porId(diputados, (d) => d.id_diputado),
      sesion: porId(sesiones, (x) => x.id_sesion),
      asunto: porId(asuntos, (a) => a.id_asunto),
      comision: porId(comisiones, (x) => x.id_comision),
      votacion: porId(votaciones, (v) => v.id_votacion),
      exhortoPorAsunto: porId(exhortos, (e) => e.id_asunto),
    },
  };
}
