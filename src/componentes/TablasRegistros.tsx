/** Tablas de registros reutilizadas por las secciones y por el perfil individual. */
import { Link } from 'react-router-dom';
import { ESTADOS_ASISTENCIA, ESTADOS_PROCESALES, ESTADOS_VERIFICACION, PERIODOS_SESION, ROLES_PROMOVENTE, SENTIDOS_VOTO, TIPOS_ASUNTO, TIPOS_INTERVENCION, TIPOS_SESION, etiquetaDe } from '../config/catalogos';
import type { Asunto, Base, Intervencion } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import type { RegistroAsistencia } from '../indicadores/asistencia';
import { esCompartido } from '../indicadores/asuntos';
import { fechaCorta } from '../indicadores/filtro';
import { EnlaceExterno, EnlaceFuente } from './Fuente';
import { Insignia, InsigniaCatalogo } from './Insignia';
import { Tabla, type Columna } from './Tabla';

const SIN_REGISTRO = { etiqueta: 'Sin registro capturado', descripcion: 'Sesión elegible sin dato. No se cuenta como ausencia.', tono: 'pendiente' as const };

export function nombreDip(b: Base, id: string): string {
  return b.idx.diputado.get(id)?.nombre_completo ?? (id ? `${id} (no registrado)` : '—');
}

export function EnlaceDip({ id }: { id: string }) {
  const { base } = useDatos();
  const d = base.idx.diputado.get(id);
  if (!d) return <span className="texto-3">{id || '—'}</span>;
  return <Link to={`/diputaciones/${encodeURIComponent(id)}`}>{d.nombre_completo}</Link>;
}

export function Promoventes({ a, resaltar }: { a: Asunto; resaltar?: string }) {
  if (a.promoventes.length === 0) return <span className="texto-3">Sin promovente registrado</span>;
  return (
    <ul className="lista-limpia">
      {a.promoventes.map((p, i) => (
        <li key={i} style={{ fontWeight: p.id_diputado && p.id_diputado === resaltar ? 700 : undefined }}>
          {p.id_diputado ? <EnlaceDip id={p.id_diputado} /> : p.promovente_externo}
          <span className="texto-3 muy-pequeno"> · {etiquetaDe(ROLES_PROMOVENTE, p.rol)}</span>
        </li>
      ))}
    </ul>
  );
}

export function TablaAsuntos({ asuntos, titulo, archivo, resaltar, porPagina }: { asuntos: Asunto[]; titulo: string; archivo: string; resaltar?: string; porPagina?: number }) {
  const { base } = useDatos();
  const columnas: Columna<Asunto>[] = [
    { id: 'id', titulo: 'ID', valor: (a) => a.id_asunto, render: (a) => <span className="muy-pequeno num">{a.id_asunto}</span> },
    {
      id: 'titulo',
      titulo: 'Asunto',
      valor: (a) => `${a.titulo} ${a.tema}`,
      render: (a) => (
        <div style={{ minWidth: 260 }}>
          <div>{a.titulo || <span className="texto-3">Sin título</span>}</div>
          <div className="muy-pequeno texto-3">
            {etiquetaDe(TIPOS_ASUNTO, a.tipo)}
            {a.tema && ` · ${a.tema}`}
            {a.expediente && ` · Exp. ${a.expediente}`}
            {a.numero_decreto_acuerdo && ` · ${a.numero_decreto_acuerdo}`}
          </div>
          {a.descripcion && <details className="muy-pequeno"><summary>Descripción</summary>{a.descripcion}</details>}
        </div>
      ),
    },
    { id: 'fecha', titulo: 'Presentación', valor: (a) => a.fecha_presentacion, render: (a) => <span className="num">{fechaCorta(a.fecha_presentacion)}</span> },
    { id: 'prom', titulo: 'Promoventes', valor: (a) => a.promoventes.map((p) => (p.id_diputado ? nombreDip(base, p.id_diputado) : p.promovente_externo)).join('; '), render: (a) => <Promoventes a={a} resaltar={resaltar} /> },
    { id: 'modo', titulo: 'Autoría', valor: (a) => (a.promoventes.length === 0 ? '' : esCompartido(a) ? 'Compartida' : 'Individual') },
    { id: 'com', titulo: 'Comisiones', valor: (a) => a.turnos.map((t) => base.idx.comision.get(t.id_comision)?.nombre ?? t.id_comision).join('; '), render: (a) => (a.turnos.length ? <span className="muy-pequeno">{a.turnos.map((t) => base.idx.comision.get(t.id_comision)?.nombre ?? t.id_comision).join('; ')}</span> : <span className="texto-3 muy-pequeno">Sin turno registrado</span>) },
    { id: 'estado', titulo: 'Estado procesal', valor: (a) => etiquetaDe(ESTADOS_PROCESALES, a.estado_procesal), render: (a) => <InsigniaCatalogo catalogo={ESTADOS_PROCESALES} valor={a.estado_procesal} /> },
    {
      id: 'fechas',
      titulo: 'Etapas',
      sinBusqueda: true,
      valor: (a) => a.fecha_aprobacion || a.fecha_dictamen,
      render: (a) => (
        <ul className="lista-limpia muy-pequeno num" style={{ minWidth: 150 }}>
          {a.turnos[0]?.fecha_turno && <li>Turno: {fechaCorta(a.turnos[0].fecha_turno)}</li>}
          {a.fecha_dictamen && <li>Dictamen: {fechaCorta(a.fecha_dictamen)}{a.resultado_dictamen && ` (${a.resultado_dictamen})`}</li>}
          {a.fecha_votacion && <li>Votación: {fechaCorta(a.fecha_votacion)}</li>}
          {a.fecha_aprobacion && <li>Aprobación: {fechaCorta(a.fecha_aprobacion)}</li>}
          {a.fecha_publicacion && <li>Publicación: {fechaCorta(a.fecha_publicacion)}</li>}
        </ul>
      ),
    },
    { id: 'verif', titulo: 'Verificación', valor: (a) => etiquetaDe(ESTADOS_VERIFICACION, a.estado_verificacion), render: (a) => <InsigniaCatalogo catalogo={ESTADOS_VERIFICACION} valor={a.estado_verificacion} /> },
    {
      id: 'docs',
      titulo: 'Documentos',
      sinBusqueda: true,
      valor: (a) => a.url_documento || a.url_ficha,
      render: (a) => (
        <ul className="lista-limpia muy-pequeno">
          {a.url_ficha && <li><EnlaceExterno url={a.url_ficha}>Ficha</EnlaceExterno></li>}
          {a.url_documento && <li><EnlaceExterno url={a.url_documento}>Documento</EnlaceExterno></li>}
          <li><EnlaceFuente id={a.id_fuente} corto /></li>
        </ul>
      ),
    },
  ];
  return <Tabla titulo={titulo} columnas={columnas} filas={asuntos} clave={(a) => a.id_asunto + a.titulo} archivo={archivo} ordenInicial={{ id: 'fecha', desc: true }} porPagina={porPagina} />;
}

export function TablaAsistencias({ registros, titulo, archivo, conDiputado = true }: { registros: RegistroAsistencia[]; titulo: string; archivo: string; conDiputado?: boolean }) {
  const { base } = useDatos();
  const columnas: Columna<RegistroAsistencia>[] = [
    { id: 'fecha', titulo: 'Fecha', valor: (r) => r.sesion.fecha, render: (r) => <span className="num">{fechaCorta(r.sesion.fecha)}</span> },
    { id: 'id', titulo: 'ID sesión', valor: (r) => r.sesion.id_sesion, render: (r) => <span className="muy-pequeno num">{r.sesion.id_sesion}</span> },
    { id: 'anio', titulo: 'Año leg.', numerica: true, valor: (r) => r.sesion.anio_legislativo ?? '' },
    { id: 'periodo', titulo: 'Periodo', valor: (r) => etiquetaDe(PERIODOS_SESION, r.sesion.periodo) },
    { id: 'tipo', titulo: 'Tipo', valor: (r) => etiquetaDe(TIPOS_SESION, r.sesion.tipo_sesion) },
    { id: 'num', titulo: 'Núm.', numerica: true, valor: (r) => r.sesion.numero_sesion ?? '' },
    ...(conDiputado ? [{ id: 'dip', titulo: 'Diputada/o', valor: (r: RegistroAsistencia) => nombreDip(base, r.id_diputado), render: (r: RegistroAsistencia) => <EnlaceDip id={r.id_diputado} /> }] : []),
    { id: 'estado', titulo: 'Estado', valor: (r) => (r.estado === 'sin_registro' ? SIN_REGISTRO.etiqueta : etiquetaDe(ESTADOS_ASISTENCIA, r.estado)), render: (r) => (r.estado === 'sin_registro' ? <Insignia entrada={SIN_REGISTRO} /> : <InsigniaCatalogo catalogo={ESTADOS_ASISTENCIA} valor={r.estado} />) },
    { id: 'just', titulo: 'Justificación pública', valor: (r) => r.justificacion || '', render: (r) => r.justificacion || <span className="texto-3">—</span> },
    { id: 'obs', titulo: 'Observación del Observatorio', valor: (r) => r.observaciones || '', render: (r) => (r.observaciones ? <span className="muy-pequeno">{r.observaciones}</span> : <span className="texto-3">—</span>) },
    { id: 'fuente', titulo: 'Fuente', sinBusqueda: true, valor: (r) => r.id_fuente, render: (r) => <EnlaceFuente id={r.id_fuente || r.sesion.id_fuente} corto /> },
  ];
  return <Tabla titulo={titulo} columnas={columnas} filas={registros} clave={(r) => `${r.sesion.id_sesion}|${r.id_diputado}`} archivo={archivo} ordenInicial={{ id: 'fecha', desc: true }} />;
}

export function TablaIntervenciones({ lista, titulo, archivo, conDiputado = true }: { lista: Intervencion[]; titulo: string; archivo: string; conDiputado?: boolean }) {
  const { base } = useDatos();
  const columnas: Columna<Intervencion>[] = [
    { id: 'fecha', titulo: 'Fecha', valor: (i) => base.idx.sesion.get(i.id_sesion)?.fecha ?? '', render: (i) => <span className="num">{fechaCorta(base.idx.sesion.get(i.id_sesion)?.fecha)}</span> },
    { id: 'sesion', titulo: 'Sesión', valor: (i) => i.id_sesion, render: (i) => <span className="muy-pequeno num">{i.id_sesion}</span> },
    ...(conDiputado ? [{ id: 'dip', titulo: 'Diputada/o', valor: (i: Intervencion) => nombreDip(base, i.id_diputado), render: (i: Intervencion) => <EnlaceDip id={i.id_diputado} /> }] : []),
    { id: 'asunto', titulo: 'Asunto discutido', valor: (i) => base.idx.asunto.get(i.id_asunto)?.titulo ?? i.asunto_texto, render: (i) => <span className="pequeno">{base.idx.asunto.get(i.id_asunto)?.titulo ?? (i.asunto_texto || <span className="texto-3">Sin dato</span>)}</span> },
    { id: 'tema', titulo: 'Tema', valor: (i) => i.tema },
    { id: 'tipo', titulo: 'Tipo', valor: (i) => etiquetaDe(TIPOS_INTERVENCION, i.tipo_intervencion) },
    { id: 'doc', titulo: 'Documento', sinBusqueda: true, valor: (i) => i.url_documento, render: (i) => <span className="muy-pequeno"><EnlaceExterno url={i.url_documento}>Diario de los Debates</EnlaceExterno>{i.pagina && ` · p. ${i.pagina}`}</span> },
    { id: 'verif', titulo: 'Verificación', valor: (i) => etiquetaDe(ESTADOS_VERIFICACION, i.estado_verificacion), render: (i) => <InsigniaCatalogo catalogo={ESTADOS_VERIFICACION} valor={i.estado_verificacion} /> },
  ];
  return <Tabla titulo={titulo} columnas={columnas} filas={lista} clave={(i) => i.id_intervencion} archivo={archivo} ordenInicial={{ id: 'fecha', desc: true }} />;
}

export interface FilaVoto {
  id_votacion: string;
  id_diputado: string;
  sentido: string;
}

export function TablaVotos({ votos, titulo, archivo, conDiputado = true }: { votos: FilaVoto[]; titulo: string; archivo: string; conDiputado?: boolean }) {
  const { base } = useDatos();
  const vot = (v: FilaVoto) => base.idx.votacion.get(v.id_votacion);
  const columnas: Columna<FilaVoto>[] = [
    { id: 'fecha', titulo: 'Fecha', valor: (v) => base.idx.sesion.get(vot(v)?.id_sesion ?? '')?.fecha ?? '', render: (v) => <span className="num">{fechaCorta(base.idx.sesion.get(vot(v)?.id_sesion ?? '')?.fecha)}</span> },
    { id: 'id', titulo: 'ID votación', valor: (v) => v.id_votacion, render: (v) => <span className="muy-pequeno num">{v.id_votacion}</span> },
    ...(conDiputado ? [{ id: 'dip', titulo: 'Diputada/o', valor: (v: FilaVoto) => nombreDip(base, v.id_diputado), render: (v: FilaVoto) => <EnlaceDip id={v.id_diputado} /> }] : []),
    { id: 'asunto', titulo: 'Asunto', valor: (v) => base.idx.asunto.get(vot(v)?.id_asunto ?? '')?.titulo ?? vot(v)?.descripcion ?? '', render: (v) => <span className="pequeno">{base.idx.asunto.get(vot(v)?.id_asunto ?? '')?.titulo ?? vot(v)?.descripcion}</span> },
    { id: 'sentido', titulo: 'Sentido del voto', valor: (v) => etiquetaDe(SENTIDOS_VOTO, v.sentido), render: (v) => <InsigniaCatalogo catalogo={SENTIDOS_VOTO} valor={v.sentido} /> },
    { id: 'res', titulo: 'Resultado general', valor: (v) => vot(v)?.resultado ?? '' },
    { id: 'fuente', titulo: 'Fuente', sinBusqueda: true, valor: (v) => vot(v)?.id_fuente ?? '', render: (v) => <EnlaceFuente id={vot(v)?.id_fuente} corto /> },
  ];
  return <Tabla titulo={titulo} columnas={columnas} filas={votos} clave={(v) => `${v.id_votacion}|${v.id_diputado}`} archivo={archivo} ordenInicial={{ id: 'fecha', desc: true }} />;
}
