import { Link } from 'react-router-dom';
import { CALIDAD_CARGO, etiquetaDe } from '../config/catalogos';
import type { Diputado } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { asistenciaDeDiputado } from '../indicadores/asistencia';
import { indicadoresDePersonas, referenciaCongreso } from '../indicadores/distritos';
import { votosDivididosDeDiputado } from '../indicadores/votaciones';
import type { Base } from '../datos/modelo';
import { describirPeriodo, fechaCorta, type Filtro } from '../indicadores/filtro';
import { Foto } from './Foto';
import { Partido } from './Partido';
import { Compartir, QuePuedeHacer } from './QuePuedeHacer';
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
            Por la <Termino t="representacion_proporcional">lista de su partido</Termino>
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

/** La referencia del Congreso es igual para todas las fichas del mismo periodo: se calcula una vez. */
const cacheRef = new WeakMap<Base, Map<string, ReturnType<typeof referenciaCongreso>>>();
function referenciaCongresoMemo(b: Base, f: Filtro) {
  if (!cacheRef.has(b)) cacheRef.set(b, new Map());
  const m = cacheRef.get(b)!;
  const k = `${f.anio ?? ''}|${f.desde ?? ''}|${f.hasta ?? ''}`;
  if (!m.has(k)) m.set(k, referenciaCongreso(b, f));
  return m.get(k)!;
}

/** Ficha breve en lenguaje ciudadano: lo más importante primero y el resto en «Ver todos los datos». */
export function FichaResumen({ d, filtro }: { d: Diputado; filtro: Filtro }) {
  const { base } = useDatos();
  const asis = asistenciaDeDiputado(base, d, filtro);
  const mas = indicadoresDePersonas(base, [d], filtro);
  const ref = referenciaCongresoMemo(base, filtro);
  const div = votosDivididosDeDiputado(base, d.id_diputado, filtro);
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
      <p className="pequeno texto-3" style={{ marginTop: 0 }}>
        Ordenado según las tres tareas de una diputación.
      </p>

      <h5 className="ficha__funcion">1. Hacer leyes</h5>
      <ul className="lista-limpia ficha__datos">
        <li className="dato-claro">
          {mas.iniciativasPresentadas === 0 ? (
            <>
              No ha presentado <Termino t="iniciativa">propuestas de ley</Termino>.
            </>
          ) : (
            <>
              Presentó <strong>{fmt(mas.iniciativasPresentadas)}</strong> <Termino t="iniciativa">{mas.iniciativasPresentadas === 1 ? 'propuesta de ley' : 'propuestas de ley'}</Termino>; el Congreso
              aprobó {fmt(mas.iniciativasAprobadas)}.{' '}
              <Link
                className="pequeno"
                to={enlaceConPeriodo('/asuntos', filtro, {
                  diputado: d.id_diputado,
                  tipo: 'iniciativa',
                })}
              >
                Ver propuestas
              </Link>
              {(mas.alcancePresentadas.tramite > 0 || mas.alcancePresentadas.conmemorativa > 0) && (
                <span className="ficha__nota">
                  De ellas, {fmt(mas.alcancePresentadas.fondo)} cambian o crean leyes
                  {mas.alcancePresentadas.tramite > 0 && <>, {fmt(mas.alcancePresentadas.tramite)} son trámites (como descuentos fiscales)</>}
                  {mas.alcancePresentadas.conmemorativa > 0 && <> y {fmt(mas.alcancePresentadas.conmemorativa)} son reconocimientos o fechas conmemorativas</>}.{' '}
                  <Link to="/metodologia#clasificacion-propuestas">¿Cómo las separamos?</Link>
                </span>
              )}
            </>
          )}
          {ref.medianaIniciativas != null && (
            <span className="ficha__nota">
              Lo más común en el Congreso: {fmt(ref.medianaIniciativas)} {ref.medianaIniciativas === 1 ? 'propuesta' : 'propuestas'} por diputación.
            </span>
          )}
        </li>
        <li className="dato-claro">
          {div.divididas === 0 ? (
            <span className="texto-3">No hubo votaciones divididas en este periodo.</span>
          ) : div.conVoto === 0 ? (
            <>
              En las <strong>{fmt(div.divididas)}</strong> <Termino t="votacion_dividida">votaciones divididas</Termino> del periodo, el acta no escribe su voto.
            </>
          ) : (
            <>
              En las <Termino t="votacion_dividida">votaciones divididas</Termino>, su voto quedó escrito en <strong>{fmt(div.conVoto)}</strong> de {fmt(div.divididas)}: {fmt(div.porSentido.favor)} a
              favor, {fmt(div.porSentido.contra)} en contra
              {div.porSentido.abstencion > 0 && (
                <>
                  {' '}
                  y {fmt(div.porSentido.abstencion)} {div.porSentido.abstencion === 1 ? 'abstención' : 'abstenciones'}
                </>
              )}
              .{' '}
              <Link
                className="pequeno"
                to={enlaceConPeriodo('/votaciones', filtro, {
                  diputado: d.id_diputado,
                  divididas: '1',
                })}
              >
                Ver cómo votó
              </Link>
            </>
          )}
        </li>
      </ul>

      <h5 className="ficha__funcion">2. Representar</h5>
      <ul className="lista-limpia ficha__datos">
        <li className="dato-claro">
          {asis.porcentaje == null ? (
            <span className="texto-3">Asistencia: sin datos suficientes en este periodo.</span>
          ) : (
            <>
              <Termino t="pase_lista">Registró asistencia</Termino> en <strong>{fmt(asis.asistencias)}</strong> de {fmt(asis.denominador)} <Termino t="sesion">sesiones</Termino> (
              {fmtPct(asis.porcentaje)}).
              {asis.justificadas > 0 && <> Faltó con permiso {veces(asis.justificadas)}.</>}
              {asis.ausencias > 0 && <> Faltó sin permiso {veces(asis.ausencias)}.</>}
            </>
          )}{' '}
          <Link
            className="pequeno"
            to={enlaceConPeriodo('/asistencias', filtro, {
              diputado: d.id_diputado,
            })}
          >
            Ver sesiones
          </Link>
          {ref.asistencia != null && <span className="ficha__nota">Todo el Congreso: {fmtPct(ref.asistencia)}.</span>}
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

      <h5 className="ficha__funcion">3. Vigilar al gobierno</h5>
      <ul className="lista-limpia ficha__datos">
        <li className="dato-claro">
          {mas.exhortosPresentados === 0 ? (
            <>
              No ha presentado <Termino t="exhorto">exhortos</Termino>.
            </>
          ) : (
            <>
              Pidió a otras autoridades atender un problema (<Termino t="exhorto">exhortos</Termino>) {veces(mas.exhortosPresentados, true)}; el Congreso{' '}
              {mas.exhortosAprobados === 0 ? (
                'no aprobó ninguno'
              ) : (
                <>aprobó {mas.exhortosAprobados === mas.exhortosPresentados && mas.exhortosPresentados > 1 ? 'todos' : fmt(mas.exhortosAprobados)}</>
              )}
              .
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

      <QuePuedeHacer d={d} />

      <p className="fila-flex" style={{ marginTop: '1rem' }}>
        <Link className="boton boton--primario" to={enlaceConPeriodo(`/diputaciones/${encodeURIComponent(d.id_diputado)}`, filtro)}>
          Ver su perfil completo
        </Link>
        <Compartir d={d} />
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
