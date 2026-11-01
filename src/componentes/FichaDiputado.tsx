import { Link } from 'react-router-dom';
import { CALIDAD_CARGO, etiquetaDe } from '../config/catalogos';
import type { Diputado } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { asistenciaDeDiputado } from '../indicadores/asistencia';
import { indicadoresDePersonas } from '../indicadores/distritos';
import { describirPeriodo, fechaCorta, type Filtro } from '../indicadores/filtro';
import { Foto } from './Foto';
import { Partido } from './Partido';
import { Termino } from './Termino';
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
  const base = `${fechaCorta(d.fecha_inicio)} – ${d.fecha_fin ? fechaCorta(d.fecha_fin) : 'en funciones'}`;
  const lic = (d.licencias ?? []).map(([a, b]) => `licencia ${fechaCorta(a)} – ${b ? fechaCorta(b) : 'vigente'}`);
  return lic.length ? `${base} (${lic.join('; ')})` : base;
}

export function DatosGenerales({ d }: { d: Diputado }) {
  return (
    <dl>
      <dt>Partido</dt>
      <dd>
        <Partido id={d.id_partido} />
      </dd>
      <dt>Cómo llegó al cargo</dt>
      <dd>
        {d.tipo_representacion === 'MR' ? (
          <>
            Ganó la elección en el <Termino t="distrito">distrito {d.distrito ?? '—'}</Termino>
          </>
        ) : (
          <>
            Por la lista de su partido (<Termino t="representacion_proporcional">representación proporcional</Termino>)
          </>
        )}
      </dd>
      {d.calidad === 'suplente' && (
        <>
          <dt>Cargo</dt>
          <dd>
            <Termino t="suplente">Suplente</Termino> en funciones
          </dd>
        </>
      )}
      <dt>En el cargo</dt>
      <dd>{periodoEjercicio(d)}</dd>
    </dl>
  );
}

/** Ficha breve en lenguaje ciudadano: lo más importante primero y el resto en «Ver todos los datos». */
export function FichaResumen({ d, filtro }: { d: Diputado; filtro: Filtro }) {
  const { base } = useDatos();
  const asis = asistenciaDeDiputado(base, d, filtro);
  const mas = indicadoresDePersonas(base, [d], filtro);
  const veces = (n: number, destacar = false) => (
    <>
      {destacar ? <strong>{fmt(n)}</strong> : fmt(n)} {n === 1 ? 'vez' : 'veces'}
    </>
  );

  return (
    <article aria-label={`Ficha de ${d.nombre_completo}`}>
      <div className="ficha">
        <Foto url={d.url_foto} archivo={d.archivo_foto} nombre={d.nombre_completo} />
        <div>
          <h3 className="ficha__nombre">{d.nombre_completo}</h3>
          <DatosGenerales d={d} />
        </div>
      </div>
      <p className="pequeno texto-3" style={{ marginTop: '0.75rem' }}>
        Periodo: {describirPeriodo(filtro, base.manifiesto.fecha_corte)}
      </p>

      <h4 className="indicador__titulo">¿Qué ha hecho en el Congreso?</h4>
      <ul className="lista-limpia" style={{ display: 'grid', gap: '0.75rem' }}>
        <li className="dato-claro">
          {asis.porcentaje == null ? (
            <span className="texto-3">Asistencia: sin datos suficientes en este periodo.</span>
          ) : (
            <>
              <Termino t="pase_lista">Registró asistencia</Termino> en <strong>{fmt(asis.asistencias)}</strong> de {fmt(asis.denominador)} <Termino t="sesion">sesiones</Termino> ({fmtPct(asis.porcentaje)}).
              {asis.justificadas > 0 && <> Faltó con permiso {veces(asis.justificadas)}.</>}
              {asis.ausencias > 0 && <> Faltó sin permiso {veces(asis.ausencias)}.</>}
            </>
          )}{' '}
          <Link className="pequeno" to={enlaceConPeriodo('/asistencias', filtro, { diputado: d.id_diputado })}>
            Ver sesiones
          </Link>
        </li>
        <li className="dato-claro">
          {mas.iniciativasPresentadas === 0 ? (
            <>
              No ha presentado <Termino t="iniciativa">propuestas de ley</Termino>.
            </>
          ) : (
            <>
              Presentó <strong>{fmt(mas.iniciativasPresentadas)}</strong> <Termino t="iniciativa">{mas.iniciativasPresentadas === 1 ? 'propuesta de ley' : 'propuestas de ley'}</Termino>; el Congreso aprobó {fmt(mas.iniciativasAprobadas)}.{' '}
              <Link className="pequeno" to={enlaceConPeriodo('/asuntos', filtro, { diputado: d.id_diputado, tipo: 'iniciativa' })}>
                Ver propuestas
              </Link>
            </>
          )}
        </li>
        <li className="dato-claro">
          {mas.exhortosPresentados === 0 ? (
            <>
              No ha presentado <Termino t="exhorto">exhortos</Termino>.
            </>
          ) : (
            <>
              Pidió a otras autoridades atender un problema (<Termino t="exhorto">exhortos</Termino>) {veces(mas.exhortosPresentados, true)}; el Congreso{' '}
              {mas.exhortosAprobados === 0 ? 'no aprobó ninguno' : <>aprobó {mas.exhortosAprobados === mas.exhortosPresentados && mas.exhortosPresentados > 1 ? 'todos' : fmt(mas.exhortosAprobados)}</>}.
            </>
          )}
        </li>
        <li className="dato-claro">
          {mas.intervenciones === 0 ? (
            <>
              No ha hablado ante el Congreso (<Termino t="tribuna">tribuna</Termino>).
            </>
          ) : (
            <>
              Habló ante el Congreso (<Termino t="tribuna">tribuna</Termino>) {veces(mas.intervenciones, true)}.
            </>
          )}
        </li>
      </ul>

      <details className="desplegable" style={{ marginTop: '1rem' }}>
        <summary>Ver todos los datos</summary>
        <dl className="definiciones pequeno" style={{ marginTop: '0.75rem' }}>
          <dt>
            <Termino t="dictamen">Dictámenes</Termino> sobre sus propuestas
          </dt>
          <dd className="num">{fmt(mas.dictamenesDeSusIniciativas)}</dd>
          <dt>
            Dictámenes de la <Termino t="comision">comisión</Termino> que encabeza
          </dt>
          <dd className="num">{mas.comisionesQuePreside ? fmt(mas.dictamenesComisionesQuePreside) : 'No encabeza ninguna'}</dd>
          <dt>Dictámenes de las comisiones de las que forma parte</dt>
          <dd className="num">
            {fmt(mas.dictamenesComisionesQueIntegra)} <span className="texto-3">({plural(mas.comisionesQueIntegra, 'comisión', 'comisiones')})</span>
          </dd>
          <dt>
            <Termino t="punto_acuerdo">Puntos de acuerdo</Termino> que presentó
          </dt>
          <dd className="num">{fmt(mas.puntosAcuerdo)}</dd>
          <dt>Votaciones en que su voto quedó escrito en el acta</dt>
          <dd className="num">{fmt(mas.votosRegistrados)}</dd>
        </dl>
        <p className="muy-pequeno texto-3">
          Los dictámenes son trabajo de toda la comisión, no de una sola persona. Que un dato no aparezca no significa que no ocurrió: solo contamos lo que está en documentos oficiales.
        </p>
      </details>

      <p style={{ marginTop: '1rem' }}>
        <Link className="boton boton--primario" to={enlaceConPeriodo(`/diputaciones/${encodeURIComponent(d.id_diputado)}`, filtro)}>
          Ver su perfil completo
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
