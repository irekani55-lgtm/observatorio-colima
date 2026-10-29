/**
 * Genera:
 *  1. public/datos/demo/   → conjunto FICTICIO para demostrar el funcionamiento.
 *  2. public/datos/oficial/ → plantillas vacías (solo encabezados) para capturar datos reales.
 *
 * Los datos de demostración NO describen a personas reales: nombres, partidos,
 * comisiones y fuentes son inventados y lo dicen explícitamente.
 * Uso: npm run datos:demo
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ESQUEMA, NOMBRES_TABLAS, type Fila, type NombreTabla } from '../src/datos/esquema';
import { aCsv } from '../src/datos/csv';

const RAIZ = join(import.meta.dirname, '..', 'public', 'datos');

// ------------------------------------------------------------ utilidades
let semilla = 20241001;
function azar() {
  // mulberry32: determinista para que la demo sea reproducible
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ent = (min: number, max: number) => Math.floor(azar() * (max - min + 1)) + min;
const elegir = <T,>(l: readonly T[]): T => l[Math.floor(azar() * l.length)];
const prob = (p: number) => azar() < p;
const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const sumarDias = (f: string, n: number) => {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const minFecha = (a: string, b: string) => (a < b ? a : b);

const CORTE = '2026-10-15';
const tablas = Object.fromEntries(NOMBRES_TABLAS.map((n) => [n, [] as Fila[]])) as Record<NombreTabla, Fila[]>;
const agregar = (t: NombreTabla, f: Fila) => tablas[t].push(f);

// ------------------------------------------------------------ evidencias
let nEv = 0;
function evidencia(tipo: string, titulo: string, fecha: string): string {
  const id = `EV-DEMO-${pad(++nEv, 5)}`;
  agregar('evidencias', {
    id_fuente: id,
    tipo,
    titulo: `[DEMO] ${titulo}`,
    institucion: 'Fuente ficticia de demostración',
    url: `https://example.org/demo/${tipo}/${id.toLowerCase()}`,
    fecha_documento: fecha,
    fecha_consulta: CORTE,
    oficial: 'si',
    pagina: '',
    notas: 'Documento inexistente: solo ilustra la estructura de una evidencia.',
  });
  return id;
}

// ------------------------------------------------------------ partidos
const PARTIDOS = ['A', 'B', 'C', 'D', 'E', 'F'];
for (const p of PARTIDOS) agregar('partidos', { id_partido: `PD${p}`, nombre: `Partido Demo ${p}`, siglas: `PD-${p}`, notas: 'Partido ficticio' });

// ------------------------------------------------------------ distritos
for (let d = 1; d <= 16; d++) agregar('distritos', { distrito: String(d), cabecera: '', municipios: '', id_fuente: '', notas: 'Cabecera y municipios pendientes de integrar desde la fuente oficial del IEE.' });

// ------------------------------------------------------------ diputados
const evDir = evidencia('ficha_oficial', 'Directorio de la Legislatura (demostración)', '2024-10-01');
const repartoMR = ['PDA', 'PDA', 'PDA', 'PDA', 'PDA', 'PDA', 'PDB', 'PDB', 'PDB', 'PDC', 'PDC', 'PDD', 'PDD', 'PDE', 'PDA', 'PDB'];
const repartoRP = ['PDB', 'PDC', 'PDC', 'PDD', 'PDE', 'PDE', 'PDF', 'PDF', 'PDA'];
interface Dip { id: string; partido: string; inicio: string; fin: string; actividad: number }
const dips: Dip[] = [];
let nDip = 0;
function diputado(tipo: 'MR' | 'RP', partido: string, distrito: number | null, extra: Partial<Fila> = {}) {
  const id = `DIP-${pad(++nDip)}`;
  const fotoRota = nDip % 9 === 0; // algunas con URL rota para probar el tratamiento de errores
  const fila: Fila = {
    id_diputado: id,
    nombre_completo: `Persona Legisladora Demo ${pad(nDip)}`,
    id_partido: partido,
    criterio_adscripcion: 'Grupo parlamentario al corte (demostración)',
    tipo_representacion: tipo,
    distrito: distrito ? String(distrito) : '',
    calidad: 'propietario',
    id_titular: '',
    fecha_inicio: '2024-10-01',
    fecha_fin: '',
    url_ficha_oficial: '',
    url_foto: fotoRota ? 'https://example.invalid/foto-inexistente.jpg' : '',
    archivo_foto: '',
    id_fuente: evDir,
    estado_verificacion: 'verificado',
    notas: 'Persona ficticia de demostración.',
    ...extra,
  };
  agregar('diputados', fila);
  dips.push({ id, partido, inicio: fila.fecha_inicio, fin: fila.fecha_fin, actividad: 0.5 + azar() });
  return id;
}
repartoMR.forEach((p, i) => diputado('MR', p, i + 1));
repartoRP.forEach((p) => diputado('RP', p, null));
// Licencia en el distrito 7: la titular se separa y entra su suplente.
const titular7 = 'DIP-07';
tablas.diputados.find((f) => f.id_diputado === titular7)!.fecha_fin = '2025-05-31';
dips.find((d) => d.id === titular7)!.fin = '2025-05-31';
diputado('MR', 'PDB', 7, { calidad: 'suplente', id_titular: titular7, fecha_inicio: '2025-06-01', nombre_completo: `Persona Legisladora Demo ${pad(nDip + 1)} (suplente)` });

const enFunciones = (d: Dip, f: string) => f >= d.inicio && (!d.fin || f <= d.fin);

// ------------------------------------------------------------ sesiones y asistencias
interface Ses { id: string; fecha: string; anio: number }
const sesiones: Ses[] = [];
const periodos: [number, string, string, string][] = [
  [1, 'primer_ordinario', '2024-10-01', '2025-01-31'],
  [1, 'segundo_ordinario', '2025-03-01', '2025-07-31'],
  [2, 'primer_ordinario', '2025-10-01', '2026-01-31'],
  [2, 'segundo_ordinario', '2026-03-01', '2026-07-31'],
  [3, 'primer_ordinario', '2026-10-01', CORTE],
];
const contador: Record<string, number> = {};
function sesion(anio: number, periodo: string, tipo: string, fecha: string, cuenta = 'si') {
  const k = `${anio}`;
  contador[k] = (contador[k] ?? 0) + 1; // la numeración se reinicia cada año legislativo
  const num = contador[k];
  const cod = { ordinaria: 'ORD', extraordinaria: 'EXT', solemne: 'SOL', permanente: 'PER' }[tipo] ?? 'OTR';
  const id = `S-A${anio}-${cod}-${pad(num, 3)}`;
  agregar('sesiones', { id_sesion: id, fecha, anio_legislativo: String(anio), periodo, tipo_sesion: tipo, numero_sesion: String(num), cuenta_para_asistencia: cuenta, id_fuente: evidencia('acta', `Acta de la sesión ${tipo} ${num}, año ${anio}`, fecha), notas: '' });
  if (cuenta === 'si') sesiones.push({ id, fecha, anio });
  return id;
}
for (const [anio, periodo, ini, fin] of periodos) {
  if (periodo === 'primer_ordinario') sesion(anio, periodo, 'solemne', ini);
  for (let f = sumarDias(ini, 1); f <= fin; f = sumarDias(f, 1)) {
    const dow = new Date(`${f}T12:00:00Z`).getUTCDay();
    if ((dow === 2 || dow === 4) && !(f.slice(5, 10) >= '12-20' || f.slice(5, 10) <= '01-06')) sesion(anio, periodo, 'ordinaria', f);
  }
}
sesion(1, 'extraordinario', 'extraordinaria', '2025-02-14');
sesion(1, 'diputacion_permanente', 'permanente', '2025-08-20', 'no');
sesion(1, 'extraordinario', 'extraordinaria', '2025-08-27');
sesion(2, 'extraordinario', 'extraordinaria', '2026-02-18');
sesion(2, 'diputacion_permanente', 'permanente', '2026-08-19', 'no');
sesiones.sort((a, b) => a.fecha.localeCompare(b.fecha));

const ultimas = new Set(sesiones.slice(-3).map((s) => s.id)); // aún sin captura
const listaAsis = new Map<string, string>(); // fuente de la lista por sesión
for (const s of sesiones) {
  if (ultimas.has(s.id)) continue;
  const ev = evidencia('lista_asistencia', `Lista de asistencia ${s.id}`, s.fecha);
  listaAsis.set(s.id, ev);
  const capturaPendiente = prob(0.03); // sesiones cuya lista no se ha localizado
  for (const d of dips) {
    if (!enFunciones(d, s.fecha)) continue;
    let estado = 'asistencia';
    let justificacion = '';
    const r = azar();
    if (capturaPendiente) estado = 'pendiente';
    else if (r < 0.035 * (1.6 - d.actividad)) estado = 'ausencia';
    else if (r < 0.07) {
      estado = 'justificada';
      justificacion = elegir(['Comisión oficial (demo)', 'Motivos de salud (demo)', 'Licencia temporal (demo)']);
    } else if (r < 0.078) estado = 'no_verificado';
    agregar('asistencias', { id_sesion: s.id, id_diputado: d.id, estado, justificacion, id_fuente: estado === 'pendiente' ? '' : ev, notas: '' });
  }
}

// ------------------------------------------------------------ comisiones
const TEMAS = ['Salud', 'Educación', 'Seguridad pública', 'Medio ambiente', 'Desarrollo económico', 'Derechos humanos', 'Igualdad de género', 'Transparencia', 'Movilidad', 'Agua', 'Hacienda pública', 'Desarrollo rural', 'Cultura', 'Turismo'];
const COMISIONES = ['Salud', 'Educación', 'Seguridad', 'Medio Ambiente', 'Economía', 'Derechos Humanos', 'Igualdad', 'Transparencia', 'Movilidad', 'Hacienda', 'Desarrollo Rural', 'Estudios Legislativos'];
const temaComision: Record<string, string> = {
  Salud: 'COM-01', Educación: 'COM-02', 'Seguridad pública': 'COM-03', 'Medio ambiente': 'COM-04', 'Desarrollo económico': 'COM-05', 'Derechos humanos': 'COM-06', 'Igualdad de género': 'COM-07', Transparencia: 'COM-08', Movilidad: 'COM-09', Agua: 'COM-04', 'Hacienda pública': 'COM-10', 'Desarrollo rural': 'COM-11', Cultura: 'COM-02', Turismo: 'COM-05',
};
const evCom = evidencia('ficha_oficial', 'Integración de comisiones (demostración)', '2024-10-15');
COMISIONES.forEach((c, i) => {
  const id = `COM-${pad(i + 1)}`;
  agregar('comisiones', { id_comision: id, nombre: `Comisión Demo de ${c}`, tipo: 'permanente', url: '', id_fuente: evCom });
  const miembros = new Set<string>();
  while (miembros.size < 3) miembros.add(elegir(dips.filter((d) => !d.fin)).id);
  [...miembros].forEach((m, j) => agregar('comision_integrantes', { id_comision: id, id_diputado: m, cargo: ['presidencia', 'secretaria', 'vocal'][j], fecha_inicio: '2024-10-15', fecha_fin: '', id_fuente: evCom }));
  const nReu = ent(6, 22);
  for (let r = 0; r < nReu; r++) {
    const fecha = sumarDias('2024-10-20', ent(0, 720));
    if (fecha > CORTE) continue;
    const idR = `REU-${id}-${pad(r + 1, 3)}`;
    const conActa = prob(0.7);
    agregar('reuniones_comision', { id_reunion: idR, id_comision: id, fecha, tipo: elegir(['ordinaria', 'ordinaria', 'extraordinaria', 'conjunta']), url_acta: conActa ? `https://example.org/demo/acta/${idR.toLowerCase()}` : '', id_fuente: evidencia(conActa ? 'acta' : 'comunicado', `Reunión ${idR}`, fecha) });
    if (conActa) for (const m of miembros) agregar('asistencia_comision', { id_reunion: idR, id_diputado: m, estado: prob(0.88) ? 'asistencia' : prob(0.5) ? 'justificada' : 'ausencia', id_fuente: '' });
  }
});

// ------------------------------------------------------------ asuntos
const TITULOS: Record<string, string[]> = {
  Salud: ['reformar la Ley de Salud del Estado en materia de salud mental', 'garantizar el abasto de medicamentos en centros de salud', 'fortalecer la atención de enfermedades crónicas'],
  Educación: ['reformar la Ley de Educación en materia de convivencia escolar', 'promover la educación financiera en escuelas', 'mejorar la infraestructura de planteles rurales'],
  'Seguridad pública': ['reformar la Ley del Sistema de Seguridad Pública', 'fortalecer la prevención social de la violencia', 'profesionalizar a las policías municipales'],
  'Medio ambiente': ['proteger los manglares de la zona costera', 'regular el manejo de residuos sólidos', 'fomentar la reforestación urbana'],
  'Desarrollo económico': ['impulsar a las micro y pequeñas empresas', 'simplificar trámites de apertura de negocios', 'promover el empleo juvenil'],
  'Derechos humanos': ['garantizar los derechos de las personas con discapacidad', 'atender a personas en situación de calle', 'proteger a personas defensoras de derechos humanos'],
  'Igualdad de género': ['prevenir la violencia política contra las mujeres', 'promover la paridad en la administración pública', 'fortalecer los refugios para mujeres'],
  Transparencia: ['ampliar las obligaciones de transparencia municipal', 'regular el parlamento abierto', 'fortalecer la protección de datos personales'],
  Movilidad: ['reformar la Ley de Movilidad en materia de ciclovías', 'mejorar el transporte público', 'regular plataformas de transporte'],
  Agua: ['garantizar el derecho humano al agua', 'tecnificar el riego agrícola', 'sanear cuerpos de agua'],
  'Hacienda pública': ['reformar la Ley de Hacienda del Estado', 'establecer estímulos fiscales para el campo', 'regular la deuda pública municipal'],
  'Desarrollo rural': ['apoyar a productores de limón', 'fortalecer los caminos saca cosechas', 'impulsar la agricultura sustentable'],
  Cultura: ['proteger el patrimonio cultural', 'fomentar la lectura', 'apoyar a artesanas y artesanos'],
  Turismo: ['promover el turismo sustentable', 'mejorar la seguridad en destinos turísticos', 'fortalecer los pueblos mágicos'],
};
const AUTORIDADES = [
  ['Secretaría de Salud estatal (demo)', 'estatal'], ['Secretaría de Educación estatal (demo)', 'estatal'], ['Ayuntamiento demo', 'municipal'], ['Comisión estatal del agua (demo)', 'estatal'], ['Dependencia federal (demo)', 'federal'], ['Organismo autónomo (demo)', 'autonomo'],
] as const;
const EXTERNOS = ['Poder Ejecutivo del Estado (demo)', 'Ayuntamiento (demo)', 'Iniciativa ciudadana (demo)'];

let nAs = 0;
const asuntosCreados: Fila[] = [];
function nuevoAsunto(tipo: string, prefijo: string): Fila {
  const tema = elegir(TEMAS);
  const fecha = elegir(sesiones.filter((s) => s.fecha <= sumarDias(CORTE, -2))).fecha;
  const texto = `${elegir(TITULOS[tema])} (folio demo ${nAs + 1})`;
  const titulo =
    tipo === 'iniciativa' ? `Iniciativa con proyecto de decreto para ${texto}` : tipo === 'exhorto' ? `Exhorto para ${texto}` : `Punto de acuerdo para ${texto}`;
  const id = `${prefijo}-${fecha.slice(0, 4)}-${pad(++nAs, 4)}`;
  const f: Fila = {
    id_asunto: id, tipo, titulo, descripcion: `Propuesta ficticia de demostración sobre ${tema.toLowerCase()}.`, tema, fecha_presentacion: fecha, expediente: `EXP-DEMO-${pad(nAs, 4)}`,
    estado_procesal: 'presentado', fecha_dictamen: '', resultado_dictamen: '', fecha_votacion: '', resultado_votacion: '', fecha_aprobacion: '', numero_decreto_acuerdo: '', fecha_publicacion: '', id_asunto_origen: '',
    url_ficha: `https://example.org/demo/asunto/${id.toLowerCase()}`, url_documento: `https://example.org/demo/documento/${id.toLowerCase()}.pdf`,
    id_fuente: evidencia('gaceta', `Gaceta: presentación de ${id}`, fecha), estado_verificacion: prob(0.92) ? 'verificado' : 'pendiente', notas: '',
  };
  agregar('asuntos', f);
  asuntosCreados.push(f);
  // Promoventes
  const r = azar();
  const pesos = dips.filter((d) => enFunciones(d, fecha));
  if (r < 0.1 && tipo === 'iniciativa') {
    agregar('asunto_promoventes', { id_asunto: id, id_diputado: '', promovente_externo: elegir(EXTERNOS), rol: 'autor', id_fuente: f.id_fuente });
  } else {
    const n = r < 0.72 ? 1 : ent(2, 4);
    const elegidos = new Set<string>();
    while (elegidos.size < n) {
      const d = elegir(pesos);
      if (azar() < d.actividad / 1.5) elegidos.add(d.id);
    }
    [...elegidos].forEach((idD, i) => agregar('asunto_promoventes', { id_asunto: id, id_diputado: idD, promovente_externo: '', rol: i === 0 ? 'autor' : 'coautor', id_fuente: f.id_fuente }));
    const libres = pesos.filter((d) => !elegidos.has(d.id));
    if (prob(0.08) && libres.length) agregar('asunto_promoventes', { id_asunto: id, id_diputado: elegir(libres).id, promovente_externo: '', rol: 'adherente', id_fuente: f.id_fuente });
  }
  return f;
}

let nDecreto = 0;
function avanzar(f: Fila, permiteTurno = true) {
  const edad = (Date.parse(CORTE) - Date.parse(f.fecha_presentacion)) / 86_400_000;
  const urgente = f.tipo !== 'iniciativa' && prob(0.35);
  if (urgente) {
    // Dispensa de trámite: se vota el mismo día, sin turno a comisión.
    f.fecha_votacion = f.fecha_presentacion;
    const ok = prob(0.85);
    f.estado_procesal = ok ? 'aprobado' : 'rechazado';
    f.resultado_votacion = ok ? 'aprobado' : 'rechazado';
    if (ok) f.fecha_aprobacion = f.fecha_presentacion;
    return;
  }
  if (!permiteTurno) return;
  const turno = sumarDias(f.fecha_presentacion, ent(0, 7));
  if (turno > CORTE) return;
  f.estado_procesal = 'turnado';
  const comPrincipal = temaComision[f.tema];
  agregar('asunto_comisiones', { id_asunto: f.id_asunto, id_comision: comPrincipal, rol: 'dictaminadora', fecha_turno: turno, fecha_dictamen: '', id_fuente: f.id_fuente });
  const conjunta = prob(0.25) ? (comPrincipal === 'COM-12' ? 'COM-10' : 'COM-12') : '';
  if (conjunta) agregar('asunto_comisiones', { id_asunto: f.id_asunto, id_comision: conjunta, rol: 'coadyuvante', fecha_turno: turno, fecha_dictamen: '', id_fuente: f.id_fuente });
  if (edad < 40 || prob(0.4)) return; // sigue en comisión
  const dictamen = sumarDias(turno, ent(20, 240));
  if (dictamen > CORTE) return;
  f.fecha_dictamen = dictamen;
  f.estado_procesal = 'dictaminado';
  const aprobatorio = prob(0.78);
  f.resultado_dictamen = aprobatorio ? 'En sentido positivo' : 'En sentido negativo';
  for (const t of tablas.asunto_comisiones) if (t.id_asunto === f.id_asunto) t.fecha_dictamen = dictamen;
  const sesVoto = sesiones.find((s) => s.fecha >= sumarDias(dictamen, ent(1, 20)));
  if (!sesVoto || prob(0.1)) return;
  f.fecha_votacion = sesVoto.fecha;
  f.estado_procesal = aprobatorio ? 'aprobado' : 'rechazado';
  f.resultado_votacion = aprobatorio ? 'aprobado' : 'rechazado';
  if (aprobatorio) f.fecha_aprobacion = sesVoto.fecha;
  // Dictamen como asunto propio, vinculado a su origen.
  const idDic = `DIC-${sesVoto.fecha.slice(0, 4)}-${pad(++nAs, 4)}`;
  const dic: Fila = {
    id_asunto: idDic, tipo: 'dictamen', titulo: `Dictamen relativo a: ${f.titulo}`, descripcion: `Dictamen ficticio que resuelve ${f.id_asunto}.`, tema: f.tema, fecha_presentacion: dictamen, expediente: f.expediente,
    estado_procesal: aprobatorio ? 'aprobado' : 'rechazado', fecha_dictamen: dictamen, resultado_dictamen: f.resultado_dictamen, fecha_votacion: sesVoto.fecha, resultado_votacion: aprobatorio ? 'aprobado' : 'rechazado', fecha_aprobacion: aprobatorio ? sesVoto.fecha : '',
    numero_decreto_acuerdo: '', fecha_publicacion: '', id_asunto_origen: f.id_asunto, url_ficha: '', url_documento: `https://example.org/demo/dictamen/${idDic.toLowerCase()}.pdf`, id_fuente: evidencia('gaceta', `Dictamen ${idDic}`, dictamen), estado_verificacion: 'verificado', notas: '',
  };
  agregar('asuntos', dic);
  if (f.tipo === 'iniciativa' && aprobatorio) {
    const num = `DEC-DEMO-${pad(++nDecreto, 3)}`;
    f.numero_decreto_acuerdo = num;
    dic.numero_decreto_acuerdo = num;
    const pub = sumarDias(sesVoto.fecha, ent(5, 45));
    if (pub <= CORTE && prob(0.85)) {
      f.fecha_publicacion = pub;
      f.estado_procesal = 'publicado';
      dic.fecha_publicacion = pub;
      dic.estado_procesal = 'publicado';
    }
  }
  votacion(sesVoto, idDic, aprobatorio);
}

// ------------------------------------------------------------ votaciones
let nVot = 0;
function votacion(s: Ses, idAsunto: string, aprobado: boolean) {
  const id = `VOT-${pad(++nVot, 4)}`;
  const presentes = dips.filter((d) => enFunciones(d, s.fecha));
  const votos: [string, string][] = presentes.map((d) => {
    if (prob(0.06)) return [d.id, 'ausente'];
    if (prob(0.02)) return [d.id, 'no_localizado'];
    const r = azar();
    return [d.id, aprobado ? (r < 0.85 ? 'favor' : r < 0.93 ? 'contra' : 'abstencion') : r < 0.3 ? 'favor' : r < 0.85 ? 'contra' : 'abstencion'];
  });
  let favor = votos.filter((v) => v[1] === 'favor').length;
  const contra = votos.filter((v) => v[1] === 'contra').length;
  // Asegura coherencia entre totales y resultado.
  if (aprobado && favor <= contra) for (const v of votos) if (v[1] === 'contra' && favor <= contra + 1) { v[1] = 'favor'; favor++; }
  const fin = { favor: votos.filter((v) => v[1] === 'favor').length, contra: votos.filter((v) => v[1] === 'contra').length, abst: votos.filter((v) => v[1] === 'abstencion').length };
  const nominal = prob(0.85);
  agregar('votaciones', {
    id_votacion: id, id_sesion: s.id, id_asunto: idAsunto, descripcion: 'Votación del dictamen en lo general', tipo_votacion: nominal ? 'nominal' : 'economica',
    resultado: fin.favor > fin.contra ? 'aprobado' : 'rechazado', total_favor: String(fin.favor), total_contra: String(fin.contra), total_abstencion: String(fin.abst),
    id_fuente: evidencia('diario_debates', `Votación ${id}`, s.fecha), estado_verificacion: 'verificado',
  });
  if (nominal) for (const [idD, sentido] of votos) agregar('votos', { id_votacion: id, id_diputado: idD, sentido, id_fuente: '' });
}

for (let i = 0; i < 230; i++) avanzar(nuevoAsunto('iniciativa', 'INI'));
for (let i = 0; i < 95; i++) {
  const f = nuevoAsunto('exhorto', 'EXH');
  avanzar(f);
  const aprobado = f.estado_procesal === 'aprobado';
  const [autoridad, orden] = elegir(AUTORIDADES);
  const envio = aprobado && prob(0.85) ? minFecha(sumarDias(f.fecha_aprobacion, ent(1, 15)), CORTE) : '';
  const busco = envio && prob(0.75);
  const resp = busco ? (prob(0.45) ? 'si' : 'no') : '';
  const fResp = resp === 'si' ? minFecha(sumarDias(envio, ent(10, 120)), CORTE) : '';
  const acciones = resp === 'si' && prob(0.35) ? 'La autoridad informó acciones relacionadas (demostración).' : '';
  agregar('exhortos', {
    id_exhorto: `EXF-${pad(i + 1, 4)}`, id_asunto: f.id_asunto, autoridad_destinataria: autoridad, orden_gobierno: orden, fecha_envio: envio,
    id_fuente_envio: envio ? evidencia('acta', `Oficio de envío del exhorto ${f.id_asunto}`, envio) : '', respuesta_localizada: resp, fecha_respuesta: fResp,
    id_fuente_respuesta: fResp ? evidencia('comunicado', `Respuesta al exhorto ${f.id_asunto}`, fResp) : '', acciones_posteriores: acciones, id_fuente_acciones: acciones ? evidencia('comunicado', `Acciones sobre ${f.id_asunto}`, fResp) : '',
    verificacion_seguimiento: prob(0.9) ? 'verificado' : 'no_verificado', notas: '',
  });
}
for (let i = 0; i < 40; i++) avanzar(nuevoAsunto('punto_acuerdo', 'PDA'));
// Decretos registrados por separado con el mismo número (prueba de no duplicar).
for (const f of asuntosCreados.filter((a) => a.fecha_publicacion).slice(0, 6)) {
  agregar('asuntos', {
    ...f, id_asunto: `DCR-${f.numero_decreto_acuerdo}`, tipo: 'decreto', titulo: `Decreto ${f.numero_decreto_acuerdo}`, id_asunto_origen: f.id_asunto, fecha_presentacion: f.fecha_aprobacion, fecha_dictamen: '', resultado_dictamen: '',
    id_fuente: evidencia('periodico_oficial', `Periódico Oficial: ${f.numero_decreto_acuerdo}`, f.fecha_publicacion), notas: 'Mismo número de decreto que su iniciativa: se cuenta una sola vez.',
  });
}
for (let i = 0; i < 6; i++) {
  const fecha = elegir(sesiones).fecha;
  agregar('asuntos', {
    id_asunto: `ACU-${fecha.slice(0, 4)}-${pad(++nAs, 4)}`, tipo: 'acuerdo', titulo: `Acuerdo parlamentario de trámite interno ${i + 1}`, descripcion: 'Acuerdo ficticio.', tema: 'Gobierno interior', fecha_presentacion: fecha, expediente: '',
    estado_procesal: 'aprobado', fecha_dictamen: '', resultado_dictamen: '', fecha_votacion: fecha, resultado_votacion: 'aprobado', fecha_aprobacion: fecha, numero_decreto_acuerdo: `AC-DEMO-${i + 1}`, fecha_publicacion: '', id_asunto_origen: '',
    url_ficha: '', url_documento: '', id_fuente: evidencia('gaceta', `Acuerdo ${i + 1}`, fecha), estado_verificacion: 'verificado', notas: '',
  });
}

// ------------------------------------------------------------ intervenciones
const asuntosConFecha = tablas.asuntos.filter((a) => a.fecha_votacion || a.fecha_presentacion);
for (let i = 0; i < 640; i++) {
  const s = elegir(sesiones.filter((x) => !ultimas.has(x.id)));
  const d = elegir(dips.filter((x) => enFunciones(x, s.fecha) && azar() < x.actividad / 1.5));
  if (!d) continue;
  const a = prob(0.7) ? elegir(asuntosConFecha) : undefined;
  agregar('intervenciones', {
    id_intervencion: `INT-${pad(i + 1, 4)}`, id_sesion: s.id, id_diputado: d.id, id_asunto: a?.id_asunto ?? '', asunto_texto: a ? '' : 'Asuntos generales', tema: a?.tema ?? elegir(TEMAS),
    tipo_intervencion: a ? elegir(['presentacion', 'a_favor', 'a_favor', 'en_contra', 'posicionamiento']) : elegir(['asuntos_generales', 'posicionamiento', 'mocion']),
    url_documento: `https://example.org/demo/diario/${s.id.toLowerCase()}`, pagina: String(ent(3, 80)), id_fuente: evidencia('diario_debates', `Diario de los Debates ${s.id}`, s.fecha), estado_verificacion: prob(0.93) ? 'verificado' : 'pendiente',
  });
}

// ------------------------------------------------------------ compromisos y agenda
const ESTADOS_COMP = ['cumplido_documentado', 'avance_documentado', 'sin_avance_localizado', 'pendiente_seguimiento', 'pendiente_seguimiento', 'no_verificado'];
for (let i = 0; i < 22; i++) {
  const fecha = sumarDias('2024-10-05', ent(0, 680));
  const estado = elegir(ESTADOS_COMP);
  const conResultado = estado === 'cumplido_documentado' || estado === 'avance_documentado';
  const id = `COMP-${pad(i + 1, 3)}`;
  agregar('compromisos', {
    id_compromiso: id, descripcion: `Compromiso público ficticio de demostración sobre ${elegir(TEMAS).toLowerCase()}.`, fecha_origen: fecha, fecha_limite: prob(0.3) ? sumarDias(fecha, ent(60, 300)) : '',
    resultado_documentado: conResultado ? 'Se documentó un avance (demostración).' : '', estado_seguimiento: estado, id_fuente: evidencia('comunicado', `Declaración pública ${id}`, fecha),
    id_fuente_resultado: conResultado ? evidencia('comunicado', `Evidencia de resultado ${id}`, sumarDias(fecha, 90)) : '', notas: '',
  });
  const n = ent(1, 3);
  const ps = new Set<string>();
  while (ps.size < n) ps.add(elegir(dips).id);
  [...ps].forEach((idD, j) => agregar('compromiso_participantes', { id_compromiso: id, id_diputado: idD, rol: j === 0 ? 'responsable' : 'participante' }));
}
for (let i = 0; i < 80; i++) {
  const fecha = sumarDias('2024-10-10', ent(0, 730));
  if (fecha > CORTE) continue;
  agregar('agenda', { id_actividad: `AGE-${pad(i + 1, 3)}`, fecha, id_diputado: elegir(dips).id, tipo: elegir(['foro', 'audiencia', 'gestión', 'recorrido', 'informe']), descripcion: 'Actividad pública ficticia de demostración.', lugar: 'Municipio demo', id_fuente: evidencia('comunicado', `Actividad AGE-${pad(i + 1, 3)}`, fecha), notas: '' });
}

// ------------------------------------------------------------ errores intencionales (para mostrar las validaciones)
const ERR = 'ERROR INTENCIONAL DE DEMOSTRACIÓN';
const base = tablas.asuntos[3];
agregar('asuntos', { ...base, id_asunto: 'INI-DUP-0001', notas: `${ERR}: asunto capturado dos veces con otro ID.` });
agregar('asuntos', { ...tablas.asuntos[10], id_asunto: 'INI-FECHA-0001', titulo: 'Iniciativa con fecha inválida (demo)', fecha_presentacion: '2025-02-30', notas: `${ERR}: fecha inexistente.` });
agregar('asuntos', { ...tablas.asuntos[12], id_asunto: 'EXH-ESTADO-0001', tipo: 'exhorto', titulo: 'Exhorto con estado incompatible (demo)', estado_procesal: 'publicado', fecha_publicacion: '', notas: `${ERR}: un exhorto no se publica como decreto.` });
agregar('asunto_promoventes', { id_asunto: 'INI-FECHA-0001', id_diputado: 'DIP-99', promovente_externo: '', rol: 'autor', id_fuente: '' });
agregar('intervenciones', { ...tablas.intervenciones[0], id_intervencion: 'INT-SINFUENTE', id_fuente: '', estado_verificacion: 'no_verificado' });
const v0 = tablas.votaciones.find((v) => v.tipo_votacion === 'nominal');
if (v0) v0.total_favor = String(Number(v0.total_favor) + 1);

// ------------------------------------------------------------ escritura
function escribir(carpeta: string, conDatos: boolean) {
  mkdirSync(carpeta, { recursive: true });
  for (const n of NOMBRES_TABLAS) {
    const cols = ESQUEMA[n].columnas.map((c) => c.nombre);
    writeFileSync(join(carpeta, `${n}.csv`), aCsv(cols, conDatos ? tablas[n] : []));
  }
}
escribir(join(RAIZ, 'demo'), true);
writeFileSync(
  join(RAIZ, 'demo', 'manifiesto.json'),
  JSON.stringify({ id: 'demo', nombre: 'Datos de demostración (ficticios)', es_demo: true, fecha_corte: CORTE, descripcion: 'Conjunto generado automáticamente para mostrar el funcionamiento del tablero. Ninguna persona, partido, cifra ni documento es real.' }, null, 2) + '\n',
);

const oficial = join(RAIZ, 'oficial');
if (!existsSync(join(oficial, 'manifiesto.json'))) {
  escribir(oficial, false);
  writeFileSync(
    join(oficial, 'manifiesto.json'),
    JSON.stringify({ id: 'oficial', nombre: 'Datos oficiales verificados', es_demo: false, fecha_corte: '', descripcion: 'Información pública documentada de la LXI Legislatura. Pendiente de integración.' }, null, 2) + '\n',
  );
  console.log('Plantillas vacías creadas en public/datos/oficial/');
} else console.log('public/datos/oficial/ ya existe: no se sobrescribe.');

if (!existsSync(join(RAIZ, 'config.json'))) writeFileSync(join(RAIZ, 'config.json'), JSON.stringify({ conjunto: 'demo' }, null, 2) + '\n');
console.log(Object.entries(tablas).map(([k, v]) => `${k}: ${v.length}`).join('\n'));
