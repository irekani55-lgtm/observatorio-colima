import { Link } from 'react-router-dom';
import { CALIDAD_CARGO, TIPOS_REPRESENTACION, etiquetaDe } from '../config/catalogos';
import type { Diputado } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { asistenciaDeDiputado } from '../indicadores/asistencia';
import { indicadoresAsuntosDiputado } from '../indicadores/asuntos';
import { describirPeriodo, fechaCorta, type Filtro } from '../indicadores/filtro';
import { Foto } from './Foto';
import { Partido } from './Partido';
import { Insignia } from './Insignia';
import { fmt, fmtPct, plural } from './Tarjeta';

/** Construye un enlace conservando el periodo filtrado. */
export function enlaceConPeriodo(ruta: string, f: Filtro, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (f.anio) p.set('anio', String(f.anio));
  if (f.desde) p.set('desde', f.desde);
  if (f.hasta) p.set('hasta', f.hasta);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const q = p.toString();
  return q ? `${ruta}?${q}` : ruta;
}

export function periodoEjercicio(d: Diputado): string {
  return `${fechaCorta(d.fecha_inicio)} – ${d.fecha_fin ? fechaCorta(d.fecha_fin) : 'en funciones'}`;
}

export function DatosGenerales({ d }: { d: Diputado }) {
  return (
    <dl>
      <dt>Partido</dt>
      <dd>
        <Partido id={d.id_partido} />
        {d.criterio_adscripcion && <div className="muy-pequeno texto-3">{d.criterio_adscripcion}</div>}
      </dd>
      <dt>Representación</dt>
      <dd>{etiquetaDe(TIPOS_REPRESENTACION, d.tipo_representacion)}</dd>
      {d.tipo_representacion === 'MR' && (
        <>
          <dt>Distrito</dt>
          <dd>{d.distrito != null ? `Distrito electoral local ${d.distrito}` : 'Sin dato'}</dd>
        </>
      )}
      <dt>Calidad</dt>
      <dd>{etiquetaDe(CALIDAD_CARGO, d.calidad)}</dd>
      <dt>Ejercicio</dt>
      <dd>{periodoEjercicio(d)}</dd>
    </dl>
  );
}

/** Ficha con los tres indicadores principales (mapa y representación proporcional). */
export function FichaResumen({ d, filtro }: { d: Diputado; filtro: Filtro }) {
  const { base } = useDatos();
  const asis = asistenciaDeDiputado(base, d, filtro);
  const ind = indicadoresAsuntosDiputado(base, d, filtro);
  const hayExhortos = base.asuntos.some((a) => a.tipo === 'exhorto');
  const hayIniciativas = base.asuntos.some((a) => a.tipo === 'iniciativa');
  const sinVerificarIni = ind.iniciativasAprobadas.noVerificados;

  return (
    <article aria-label={`Ficha de ${d.nombre_completo}`}>
      <div className="ficha">
        <Foto url={d.url_foto} archivo={d.archivo_foto} nombre={d.nombre_completo} />
        <div>
          <h3 className="ficha__nombre">{d.nombre_completo}</h3>
          {d.estado_verificacion !== 'verificado' && (
            <p>
              <Insignia entrada={{ etiqueta: 'Datos generales no verificados', descripcion: 'La integración y adscripción de esta persona aún no se contrastan con la fuente oficial.', tono: 'alerta' }} />
            </p>
          )}
          <DatosGenerales d={d} />
        </div>
      </div>
      <p className="pequeno texto-2" style={{ marginTop: '0.75rem' }}>
        <strong>Periodo de referencia de los indicadores:</strong> {describirPeriodo(filtro, base.manifiesto.fecha_corte)}
      </p>

      <div className="indicadores-ficha">
        <section className="indicador" aria-label="Asistencia a sesiones">
          <h4 className="indicador__titulo">Asistencia a sesiones</h4>
          {asis.porcentaje == null ? (
            <span className="tarjeta__valor--pendiente">{asis.sesionesElegibles === 0 ? 'Sin sesiones en el periodo' : 'Pendiente de verificación'}</span>
          ) : (
            <>
              <span className="indicador__valor">{fmtPct(asis.porcentaje)}</span>
              <div className="barra-progreso" aria-hidden="true">
                <span style={{ width: `${asis.porcentaje}%` }} />
              </div>
            </>
          )}
          <span className="indicador__detalle">
            {fmt(asis.asistencias)} asistencias de {fmt(asis.denominador)} sesiones evaluables
            {asis.justificadas > 0 && ` (incluye ${fmt(asis.justificadas)} ausencias justificadas)`}.
          </span>
          {!asis.definitivo && (
            <span className="indicador__detalle">
              <Insignia entrada={{ etiqueta: 'Provisional', descripcion: '', tono: 'pendiente' }} /> {fmt(asis.pendientes + asis.sinRegistro + asis.noVerificadas)} de {fmt(asis.sesionesElegibles)} sesiones sin registro verificable, excluidas del cálculo.
            </span>
          )}
          <span className="indicador__explica">Porcentaje de sesiones del Pleno con asistencia registrada, entre las sesiones que pueden evaluarse con información verificable.</span>
          <Link className="tarjeta__enlace" to={enlaceConPeriodo('/asistencias', filtro, { diputado: d.id_diputado })}>
            Ver registros de asistencia →
          </Link>
        </section>

        <section className="indicador" aria-label="Iniciativas aprobadas">
          <h4 className="indicador__titulo">Iniciativas aprobadas</h4>
          {hayIniciativas ? <span className="indicador__valor">{fmt(ind.iniciativasAprobadas.total)}</span> : <span className="tarjeta__valor--pendiente">Información pendiente de integración</span>}
          <span className="indicador__detalle">
            {plural(ind.iniciativasAprobadas.individuales, 'individual', 'individuales')} · {plural(ind.iniciativasAprobadas.compartidos, 'compartida', 'compartidas')} · de {plural(ind.iniciativasPresentadas.total, 'presentada', 'presentadas')}
          </span>
          {sinVerificarIni > 0 && <span className="indicador__detalle texto-3">{fmt(sinVerificarIni)} con registro pendiente de verificación.</span>}
          <span className="indicador__explica">Iniciativas en las que figura como autora o coautora y que el Pleno aprobó. Una iniciativa compartida se cuenta una vez para cada promovente, pero una sola vez en el total de la Legislatura.</span>
          <Link className="tarjeta__enlace" to={enlaceConPeriodo('/asuntos', filtro, { diputado: d.id_diputado, tipo: 'iniciativa', estado: 'aprobados' })}>
            Ver iniciativas →
          </Link>
        </section>

        <section className="indicador" aria-label="Exhortos aprobados">
          <h4 className="indicador__titulo">Exhortos aprobados</h4>
          {hayExhortos ? <span className="indicador__valor">{fmt(ind.exhortosAprobados.total)}</span> : <span className="tarjeta__valor--pendiente">Información pendiente de integración</span>}
          <span className="indicador__detalle">
            {plural(ind.exhortosAprobados.individuales, 'individual', 'individuales')} · {plural(ind.exhortosAprobados.compartidos, 'compartido', 'compartidos')} · de {plural(ind.exhortosPresentados.total, 'presentado', 'presentados')}
          </span>
          {ind.exhortosAprobadosSinVerificar > 0 && (
            <span className="indicador__detalle">
              <Insignia entrada={{ etiqueta: 'Pendiente de verificación', descripcion: '', tono: 'alerta' }} /> {fmt(ind.exhortosAprobadosSinVerificar)} aprobado(s) más cuya autoría no está verificada.
            </span>
          )}
          <span className="indicador__explica">Exhortos que promovió y que el Congreso aprobó. Aprobar un exhorto no significa que la autoridad lo haya atendido.</span>
          <Link className="tarjeta__enlace" to={enlaceConPeriodo('/exhortos', filtro, { diputado: d.id_diputado })}>
            Ver exhortos →
          </Link>
        </section>
      </div>
      <p style={{ marginTop: '1rem' }}>
        <Link className="boton boton--primario" to={enlaceConPeriodo(`/diputaciones/${encodeURIComponent(d.id_diputado)}`, filtro)}>
          Consultar perfil completo
        </Link>
      </p>
    </article>
  );
}

export function TarjetaDiputado({ d }: { d: Diputado }) {
  return (
    <Link to={`/diputaciones/${encodeURIComponent(d.id_diputado)}`} className="tarjeta-dip">
      <Foto url={d.url_foto} archivo={d.archivo_foto} nombre={d.nombre_completo} />
      <div>
        <div className="tarjeta-dip__nombre">{d.nombre_completo}</div>
        <div className="tarjeta-dip__meta">
          <Partido id={d.id_partido} />
          <span className="insignia insignia--neutro">{d.tipo_representacion === 'MR' ? `Distrito ${d.distrito ?? '¿?'}` : 'Representación proporcional'}</span>
        </div>
        <div className="muy-pequeno texto-2">
          {etiquetaDe(CALIDAD_CARGO, d.calidad)} · {periodoEjercicio(d)}
        </div>
      </div>
    </Link>
  );
}
