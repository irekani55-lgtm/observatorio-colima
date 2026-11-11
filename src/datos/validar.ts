/**
 * Validación de los datos. Nunca borra ni corrige registros: produce una
 * lista de problemas para revisión humana, visible en la página
 * "Calidad de datos" y en `npm run datos:validar`.
 */
import { ETAPAS_POR_TIPO, ESTADOS_APROBADOS } from '../config/catalogos';
import { ESQUEMA, NOMBRES_TABLAS, idLegible, claveDeFila, type NombreTabla, type TablasCrudas } from './esquema';
import type { Base } from './modelo';
import { LEGISLATURA, anioLegislativoDeFecha } from '../config/legislatura';
import { enFunciones } from '../indicadores/filtro';

const LEGISLATURA_DISTRITOS = LEGISLATURA.distritos;

export type Severidad = 'error' | 'advertencia' | 'aviso';

export type CategoriaProblema =
  | 'archivo'
  | 'estructura'
  | 'id_duplicado'
  | 'fecha_invalida'
  | 'sin_fuente'
  | 'relacion_inexistente'
  | 'estado_incompatible'
  | 'asunto_duplicado'
  | 'dato_incompleto'
  | 'valor_invalido'
  | 'inconsistencia'
  | 'error_calculo';

export const CATEGORIAS_PROBLEMA: Record<CategoriaProblema, string> = {
  archivo: 'Falta un archivo o no se puede leer',
  estructura: 'Columnas que no corresponden',
  id_duplicado: 'Clave repetida',
  fecha_invalida: 'Fecha imposible',
  sin_fuente: 'Dato sin documento',
  relacion_inexistente: 'Se refiere a algo que no existe',
  estado_incompatible: 'Paso que no corresponde',
  asunto_duplicado: 'Posible propuesta repetida',
  dato_incompleto: 'Dato incompleto',
  valor_invalido: 'Valor que no se reconoce',
  inconsistencia: 'Datos que no cuadran entre sí',
  error_calculo: 'Cuenta que no cuadra',
};

export interface Problema {
  severidad: Severidad;
  categoria: CategoriaProblema;
  tabla: NombreTabla | 'indicadores';
  registro: string;
  columna?: string;
  mensaje: string;
}

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esFechaValida(v: string): boolean {
  const m = RE_FECHA.exec(v);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, mes - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d && a >= 1990 && a <= 2100;
}

function esUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Normaliza un título para detectar duplicados (sin acentos, minúsculas, sin signos). */
export function normalizarTitulo(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Validaciones genéricas derivadas del esquema. */
export function validarEstructura(t: TablasCrudas, archivosFaltantes: string[] = []): Problema[] {
  const p: Problema[] = [];
  for (const nombre of archivosFaltantes) {
    p.push({ severidad: 'aviso', categoria: 'archivo', tabla: nombre as NombreTabla, registro: `${nombre}.csv`, mensaje: 'No se encontró el archivo; la tabla se trata como vacía y sus indicadores se muestran como pendientes.' });
  }

  // Índices de valores existentes para validar referencias.
  const existentes = new Map<string, Set<string>>();
  const valoresDe = (tabla: NombreTabla, columna: string) => {
    const k = `${tabla}.${columna}`;
    if (!existentes.has(k)) existentes.set(k, new Set(t[tabla].map((f) => f[columna] ?? '').filter(Boolean)));
    return existentes.get(k)!;
  };

  for (const nombre of NOMBRES_TABLAS) {
    const def = ESQUEMA[nombre];
    const filas = t[nombre];
    if (filas.length === 0) continue;

    const columnasPresentes = new Set(Object.keys(filas[0]));
    for (const col of def.columnas) {
      if (col.requerido && !columnasPresentes.has(col.nombre)) {
        p.push({ severidad: 'error', categoria: 'estructura', tabla: nombre, registro: `${nombre}.csv`, columna: col.nombre, mensaje: `Falta la columna obligatoria "${col.nombre}".` });
      }
    }
    const conocidas = new Set(def.columnas.map((c) => c.nombre));
    for (const c of columnasPresentes) {
      if (!conocidas.has(c)) p.push({ severidad: 'aviso', categoria: 'estructura', tabla: nombre, registro: `${nombre}.csv`, columna: c, mensaje: `Columna "${c}" no reconocida; se conserva pero no se usa.` });
    }

    const vistos = new Map<string, number>();
    filas.forEach((fila, i) => {
      const registro = idLegible(nombre, fila);
      const clave = claveDeFila(nombre, fila);
      if (vistos.has(clave)) {
        p.push({ severidad: 'error', categoria: 'id_duplicado', tabla: nombre, registro, mensaje: `Identificador repetido (filas ${vistos.get(clave)! + 2} y ${i + 2}).` });
      } else vistos.set(clave, i);

      for (const col of def.columnas) {
        const v = fila[col.nombre] ?? '';
        if (!v) {
          // Un registro de asistencia "pendiente" aún no tiene fuente por definición.
          const pendienteSinFuente = col.nombre === 'id_fuente' && nombre === 'asistencias' && (fila.estado ?? '').toLowerCase() === 'pendiente';
          if (col.requerido && !pendienteSinFuente) {
            const cat = col.nombre.startsWith('id_fuente') ? 'sin_fuente' : 'dato_incompleto';
            p.push({ severidad: 'advertencia', categoria: cat, tabla: nombre, registro, columna: col.nombre, mensaje: cat === 'sin_fuente' ? 'El registro no indica su fuente.' : `Falta el dato obligatorio "${col.nombre}".` });
          }
          continue;
        }
        if (col.tipo === 'fecha' && !esFechaValida(v)) {
          p.push({ severidad: 'error', categoria: 'fecha_invalida', tabla: nombre, registro, columna: col.nombre, mensaje: `"${v}" no es una fecha válida con formato AAAA-MM-DD.` });
        }
        if (col.tipo === 'entero' && !/^-?\d+$/.test(v)) {
          p.push({ severidad: 'error', categoria: 'valor_invalido', tabla: nombre, registro, columna: col.nombre, mensaje: `"${v}" no es un número entero.` });
        }
        if (col.tipo === 'url' && !esUrl(v)) {
          p.push({ severidad: 'advertencia', categoria: 'valor_invalido', tabla: nombre, registro, columna: col.nombre, mensaje: `"${v}" no es una URL válida (debe iniciar con https://).` });
        }
        if (col.tipo === 'catalogo' && col.valores) {
          const norm = nombre === 'diputados' && col.nombre === 'tipo_representacion' ? v.toUpperCase() : v.toLowerCase();
          if (!col.valores.includes(norm)) {
            p.push({ severidad: 'error', categoria: 'valor_invalido', tabla: nombre, registro, columna: col.nombre, mensaje: `"${v}" no es un valor admitido. Valores: ${col.valores.join(', ')}.` });
          }
        }
        if (col.ref && !valoresDe(col.ref.tabla, col.ref.columna).has(v)) {
          p.push({ severidad: 'error', categoria: 'relacion_inexistente', tabla: nombre, registro, columna: col.nombre, mensaje: `"${v}" no existe en ${col.ref.tabla}.${col.ref.columna}.` });
        }
      }
    });
  }
  return p;
}

const antes = (a: string, b: string) => Boolean(a && b && a > b);

/** Reglas de negocio que requieren el modelo relacional. */
export function validarReglas(b: Base): Problema[] {
  const p: Problema[] = [];

  // --- Diputaciones
  for (const d of b.diputados) {
    const r = d.id_diputado || '(sin ID)';
    if (d.tipo_representacion === 'MR' && d.distrito == null) p.push({ severidad: 'error', categoria: 'inconsistencia', tabla: 'diputados', registro: r, columna: 'distrito', mensaje: 'Diputación de mayoría relativa sin distrito.' });
    if (d.tipo_representacion === 'RP' && d.distrito != null) p.push({ severidad: 'error', categoria: 'inconsistencia', tabla: 'diputados', registro: r, columna: 'distrito', mensaje: 'Una diputación de representación proporcional no debe asociarse a un distrito.' });
    if (d.distrito != null && (d.distrito < 1 || d.distrito > LEGISLATURA_DISTRITOS)) p.push({ severidad: 'error', categoria: 'valor_invalido', tabla: 'diputados', registro: r, columna: 'distrito', mensaje: `Distrito ${d.distrito} fuera del rango 1–${LEGISLATURA_DISTRITOS}.` });
    if (antes(d.fecha_inicio, d.fecha_fin)) p.push({ severidad: 'error', categoria: 'fecha_invalida', tabla: 'diputados', registro: r, mensaje: 'La fecha de fin es anterior a la de inicio.' });
    for (const [desde, hasta] of d.licencias) {
      if (!esFechaValida(desde) || (hasta && !esFechaValida(hasta))) p.push({ severidad: 'error', categoria: 'fecha_invalida', tabla: 'diputados', registro: r, columna: 'licencias', mensaje: `Periodo de licencia inválido: "${desde}/${hasta}". Formato: AAAA-MM-DD/AAAA-MM-DD.` });
      else if (hasta && hasta < desde) p.push({ severidad: 'error', categoria: 'fecha_invalida', tabla: 'diputados', registro: r, columna: 'licencias', mensaje: `La licencia termina (${hasta}) antes de empezar (${desde}).` });
    }
    if (d.calidad === 'suplente' && !d.id_titular) p.push({ severidad: 'advertencia', categoria: 'dato_incompleto', tabla: 'diputados', registro: r, columna: 'id_titular', mensaje: 'Suplente sin titular indicado.' });
  }
  // Dos personas en el mismo distrito con periodos que se traslapan.
  const porDistrito = new Map<number, typeof b.diputados>();
  for (const d of b.diputados) if (d.distrito != null && d.tipo_representacion === 'MR') porDistrito.set(d.distrito, [...(porDistrito.get(d.distrito) ?? []), d]);
  for (const [dist, lista] of porDistrito) {
    for (let i = 0; i < lista.length; i++)
      for (let j = i + 1; j < lista.length; j++) {
        const [x, y] = [lista[i], lista[j]];
        const finX = x.fecha_fin || '9999-12-31';
        const finY = y.fecha_fin || '9999-12-31';
        if (x.fecha_inicio <= finY && y.fecha_inicio <= finX && traslapeReal(x, y)) {
          p.push({ severidad: 'error', categoria: 'inconsistencia', tabla: 'diputados', registro: `${x.id_diputado} / ${y.id_diputado}`, columna: 'distrito', mensaje: `Dos personas ocupan el distrito ${dist} en periodos que se traslapan.` });
        }
      }
  }

  // --- Sesiones
  const numeracion = new Map<string, string>();
  for (const s of b.sesiones) {
    if (s.numero_sesion != null) {
      const k = `${s.anio_legislativo}|${s.periodo}|${s.tipo_sesion}|${s.numero_sesion}`;
      if (numeracion.has(k)) p.push({ severidad: 'advertencia', categoria: 'id_duplicado', tabla: 'sesiones', registro: `${numeracion.get(k)} / ${s.id_sesion}`, columna: 'numero_sesion', mensaje: 'Mismo año legislativo, periodo, tipo y número de sesión.' });
      else numeracion.set(k, s.id_sesion);
    }
    const anioFecha = anioLegislativoDeFecha(s.fecha);
    if (s.anio_legislativo && anioFecha && anioFecha !== s.anio_legislativo) p.push({ severidad: 'advertencia', categoria: 'inconsistencia', tabla: 'sesiones', registro: s.id_sesion, columna: 'anio_legislativo', mensaje: `La fecha ${s.fecha} corresponde al año legislativo ${anioFecha}, no al ${s.anio_legislativo}.` });
  }

  // --- Asistencias fuera del periodo de la persona
  for (const a of b.asistencias) {
    const d = b.idx.diputado.get(a.id_diputado);
    const s = b.idx.sesion.get(a.id_sesion);
    if (!d || !s || !s.fecha || !d.fecha_inicio) continue;
    if (!enFunciones(d, s.fecha)) p.push({ severidad: 'advertencia', categoria: 'inconsistencia', tabla: 'asistencias', registro: `${a.id_sesion} / ${a.id_diputado}`, mensaje: 'Registro de asistencia en una fecha en que la persona no ejercía el cargo (fuera de su periodo o con licencia); se excluye del cálculo.' });
    if (a.estado === 'justificada' && !a.justificacion) p.push({ severidad: 'aviso', categoria: 'dato_incompleto', tabla: 'asistencias', registro: `${a.id_sesion} / ${a.id_diputado}`, columna: 'justificacion', mensaje: 'Ausencia justificada sin texto de justificación.' });
  }

  // --- Asuntos
  const titulos = new Map<string, string>();
  for (const a of b.asuntos) {
    const r = a.id_asunto || '(sin ID)';
    const etapas = ETAPAS_POR_TIPO[a.tipo];
    if (etapas && !etapas.includes(a.estado_procesal)) p.push({ severidad: 'error', categoria: 'estado_incompatible', tabla: 'asuntos', registro: r, columna: 'estado_procesal', mensaje: `El estado "${a.estado_procesal}" no corresponde al procedimiento de un asunto de tipo "${a.tipo}".` });
    if (a.estado_procesal === 'rechazado' && a.fecha_aprobacion) p.push({ severidad: 'error', categoria: 'estado_incompatible', tabla: 'asuntos', registro: r, mensaje: 'Asunto rechazado con fecha de aprobación.' });
    if (ESTADOS_APROBADOS.includes(a.estado_procesal) && a.resultado_votacion === 'rechazado') p.push({ severidad: 'error', categoria: 'estado_incompatible', tabla: 'asuntos', registro: r, mensaje: 'Estado aprobado, pero el resultado de la votación es "rechazado".' });
    if (ESTADOS_APROBADOS.includes(a.estado_procesal) && !a.fecha_aprobacion) p.push({ severidad: 'advertencia', categoria: 'dato_incompleto', tabla: 'asuntos', registro: r, columna: 'fecha_aprobacion', mensaje: 'Asunto aprobado sin fecha de aprobación.' });
    if (a.estado_procesal === 'publicado' && !a.fecha_publicacion) p.push({ severidad: 'advertencia', categoria: 'dato_incompleto', tabla: 'asuntos', registro: r, columna: 'fecha_publicacion', mensaje: 'Asunto publicado sin fecha de publicación.' });
    if (a.fecha_publicacion && !ESTADOS_APROBADOS.includes(a.estado_procesal)) p.push({ severidad: 'error', categoria: 'estado_incompatible', tabla: 'asuntos', registro: r, mensaje: 'Tiene fecha de publicación, pero su estado no es aprobado ni publicado.' });
    const orden: [string, string, string][] = [
      ['fecha_presentacion', 'fecha_dictamen', a.fecha_presentacion],
      ['fecha_dictamen', 'fecha_votacion', a.fecha_dictamen],
      ['fecha_presentacion', 'fecha_aprobacion', a.fecha_presentacion],
      ['fecha_aprobacion', 'fecha_publicacion', a.fecha_aprobacion],
    ];
    for (const [c1, c2] of orden) {
      const v1 = (a as unknown as Record<string, string>)[c1];
      const v2 = (a as unknown as Record<string, string>)[c2];
      if (antes(v1, v2)) p.push({ severidad: 'error', categoria: 'fecha_invalida', tabla: 'asuntos', registro: r, columna: c2, mensaje: `${c2} (${v2}) es anterior a ${c1} (${v1}).` });
    }
    for (const t of a.turnos) {
      if (antes(a.fecha_presentacion, t.fecha_turno)) p.push({ severidad: 'error', categoria: 'fecha_invalida', tabla: 'asunto_comisiones', registro: `${a.id_asunto} / ${t.id_comision}`, columna: 'fecha_turno', mensaje: 'Fecha de turno anterior a la presentación.' });
      if (antes(t.fecha_turno, t.fecha_dictamen)) p.push({ severidad: 'error', categoria: 'fecha_invalida', tabla: 'asunto_comisiones', registro: `${a.id_asunto} / ${t.id_comision}`, columna: 'fecha_dictamen', mensaje: 'Fecha de dictamen anterior al turno.' });
    }
    if (['iniciativa', 'punto_acuerdo', 'exhorto'].includes(a.tipo) && a.promoventes.length === 0) p.push({ severidad: 'advertencia', categoria: 'dato_incompleto', tabla: 'asunto_promoventes', registro: r, mensaje: 'Asunto sin promoventes registrados; no se atribuye a ninguna persona.' });
    if (a.tipo === 'exhorto' && !b.idx.exhortoPorAsunto.has(a.id_asunto)) p.push({ severidad: 'aviso', categoria: 'dato_incompleto', tabla: 'exhortos', registro: r, mensaje: 'Exhorto sin ficha de seguimiento (autoridad destinataria, envío, respuesta).' });
    if (a.titulo && a.fecha_presentacion) {
      const k = `${a.tipo}|${a.fecha_presentacion}|${normalizarTitulo(a.titulo)}`;
      if (titulos.has(k)) p.push({ severidad: 'advertencia', categoria: 'asunto_duplicado', tabla: 'asuntos', registro: `${titulos.get(k)} / ${r}`, mensaje: 'Mismo tipo, fecha y título: posible asunto capturado dos veces.' });
      else titulos.set(k, r);
    }
  }
  for (const f of b.crudas.asunto_promoventes) {
    if (!f.id_diputado && !f.promovente_externo) p.push({ severidad: 'error', categoria: 'dato_incompleto', tabla: 'asunto_promoventes', registro: f.id_asunto || '(sin ID)', mensaje: 'Fila sin id_diputado ni promovente_externo.' });
  }

  // --- Exhortos
  for (const e of b.exhortos) {
    const a = b.idx.asunto.get(e.id_asunto);
    const r = e.id_exhorto || '(sin ID)';
    if (a && a.tipo !== 'exhorto') p.push({ severidad: 'error', categoria: 'inconsistencia', tabla: 'exhortos', registro: r, columna: 'id_asunto', mensaje: `El asunto ${a.id_asunto} es de tipo "${a.tipo}", no "exhorto".` });
    if (a && e.fecha_envio && !ESTADOS_APROBADOS.includes(a.estado_procesal)) p.push({ severidad: 'error', categoria: 'estado_incompatible', tabla: 'exhortos', registro: r, columna: 'fecha_envio', mensaje: 'Registra envío a la autoridad, pero el exhorto no consta como aprobado.' });
    if (a && antes(a.fecha_aprobacion, e.fecha_envio)) p.push({ severidad: 'error', categoria: 'fecha_invalida', tabla: 'exhortos', registro: r, columna: 'fecha_envio', mensaje: 'Fecha de envío anterior a la aprobación.' });
    if (antes(e.fecha_envio, e.fecha_respuesta)) p.push({ severidad: 'error', categoria: 'fecha_invalida', tabla: 'exhortos', registro: r, columna: 'fecha_respuesta', mensaje: 'Fecha de respuesta anterior al envío.' });
    if (e.respuesta_localizada === 'si' && !e.id_fuente_respuesta) p.push({ severidad: 'advertencia', categoria: 'sin_fuente', tabla: 'exhortos', registro: r, columna: 'id_fuente_respuesta', mensaje: 'Respuesta marcada como localizada sin evidencia enlazada.' });
    if (e.respuesta_localizada === 'no' && e.fecha_respuesta) p.push({ severidad: 'error', categoria: 'inconsistencia', tabla: 'exhortos', registro: r, mensaje: 'Indica que no hay respuesta, pero registra fecha de respuesta.' });
    if (e.acciones_posteriores && !e.id_fuente_acciones) p.push({ severidad: 'advertencia', categoria: 'sin_fuente', tabla: 'exhortos', registro: r, columna: 'id_fuente_acciones', mensaje: 'Acciones posteriores sin evidencia enlazada.' });
  }

  // --- Votaciones: cotejo de totales oficiales contra votos individuales
  const votosPor = new Map<string, Record<string, number>>();
  for (const v of b.votos) {
    const c = votosPor.get(v.id_votacion) ?? {};
    c[v.sentido] = (c[v.sentido] ?? 0) + 1;
    votosPor.set(v.id_votacion, c);
  }
  for (const v of b.votaciones) {
    const c = votosPor.get(v.id_votacion);
    if (!c) {
      if (v.tipo_votacion === 'nominal') p.push({ severidad: 'aviso', categoria: 'dato_incompleto', tabla: 'votos', registro: v.id_votacion, mensaje: 'Votación nominal sin votos individuales capturados.' });
      continue;
    }
    const pares: [number | null, number, string][] = [
      [v.total_favor, c.favor ?? 0, 'a favor'],
      [v.total_contra, c.contra ?? 0, 'en contra'],
      [v.total_abstencion, c.abstencion ?? 0, 'abstenciones'],
    ];
    for (const [oficial, capturado, etq] of pares) {
      // Advertencia y no error: en datos oficiales la diferencia suele estar en la propia acta (renglones omitidos o repetidos).
      if (oficial != null && oficial !== capturado) p.push({ severidad: 'advertencia', categoria: 'inconsistencia', tabla: 'votos', registro: v.id_votacion, mensaje: `Total oficial ${etq} (${oficial}) distinto de los votos individuales capturados (${capturado}). Revise la lista nominal en el acta.` });
    }
    if (v.total_favor != null && v.total_contra != null && v.resultado !== 'no_localizado') {
      const esperado = v.total_favor > v.total_contra ? 'aprobado' : 'rechazado';
      if (esperado !== v.resultado) p.push({ severidad: 'advertencia', categoria: 'inconsistencia', tabla: 'votaciones', registro: v.id_votacion, columna: 'resultado', mensaje: `El resultado "${v.resultado}" no coincide con los totales (${v.total_favor} a favor, ${v.total_contra} en contra). Revise si se requería mayoría calificada.` });
    }
  }

  // --- Compromisos
  for (const c of b.compromisos) {
    if (c.estado_seguimiento === 'no_cumplido_documentado' && !c.id_fuente_resultado) p.push({ severidad: 'error', categoria: 'sin_fuente', tabla: 'compromisos', registro: c.id_compromiso, mensaje: 'Se clasifica como incumplido sin evidencia del resultado. Debe usarse "sin_avance_localizado" o "pendiente_seguimiento".' });
    if ((c.estado_seguimiento === 'cumplido_documentado' || c.estado_seguimiento === 'avance_documentado') && !c.id_fuente_resultado) p.push({ severidad: 'advertencia', categoria: 'sin_fuente', tabla: 'compromisos', registro: c.id_compromiso, mensaje: 'Resultado documentado sin evidencia enlazada.' });
    if (antes(c.fecha_origen, c.fecha_limite)) p.push({ severidad: 'error', categoria: 'fecha_invalida', tabla: 'compromisos', registro: c.id_compromiso, columna: 'fecha_limite', mensaje: 'Fecha límite anterior a la fecha de origen.' });
    if (c.participantes.length === 0) p.push({ severidad: 'advertencia', categoria: 'dato_incompleto', tabla: 'compromiso_participantes', registro: c.id_compromiso, mensaje: 'Compromiso sin participantes registrados.' });
  }

  // --- Evidencias: fuentes no oficiales usadas como única prueba
  for (const e of b.evidencias) {
    if (e.oficial === 'no') p.push({ severidad: 'aviso', categoria: 'sin_fuente', tabla: 'evidencias', registro: e.id_fuente, mensaje: 'Fuente no oficial: los registros que dependan solo de ella deben marcarse como no verificados.' });
  }
  return p;
}

/** ¿Hay algún día en que ambas personas ejercían (fuera de licencias)? Se revisan los extremos de cada periodo. */
function traslapeReal(x: Base['diputados'][number], y: Base['diputados'][number]): boolean {
  const puntos = new Set<string>([x.fecha_inicio, y.fecha_inicio, x.fecha_fin, y.fecha_fin].filter(Boolean));
  for (const d of [x, y]) for (const [a, b] of d.licencias) { puntos.add(a); if (b) puntos.add(b); const sig = siguienteDia(b || a); if (sig) puntos.add(sig); const ant = diaAnterior(a); if (ant) puntos.add(ant); }
  for (const f of puntos) if (f && enFunciones(x, f) && enFunciones(y, f)) return true;
  return false;
}
const desplazar = (f: string, n: number) => {
  if (!esFechaValida(f)) return '';
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const siguienteDia = (f: string) => desplazar(f, 1);
const diaAnterior = (f: string) => desplazar(f, -1);

export function validarTodo(b: Base): Problema[] {
  return [...validarEstructura(b.crudas, b.archivosFaltantes), ...validarReglas(b)];
}

export function resumenProblemas(p: Problema[]) {
  const porSeveridad = { error: 0, advertencia: 0, aviso: 0 } as Record<Severidad, number>;
  const porCategoria = {} as Record<CategoriaProblema, number>;
  for (const x of p) {
    porSeveridad[x.severidad]++;
    porCategoria[x.categoria] = (porCategoria[x.categoria] ?? 0) + 1;
  }
  return { total: p.length, porSeveridad, porCategoria };
}
