import type { ReactNode } from 'react';
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
import { BarraComparada } from './BarraComparada';
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

/** Fecha de inicio de una licencia que sigue abierta (sin fecha de regreso), o null. */
/** Licencia que sigue vigente a la fecha de corte: sin fecha de regreso, o con regreso posterior al corte. */
export function licenciaActual(d: Diputado, corte = ''): [string, string] | null {
  const l = (d.licencias ?? []).find(([a, b]) => a && (!b || (corte && a <= corte && corte <= b)));
  return l ? [l[0], l[1]] : null;
}

export function licenciaVigente(d: Diputado, corte = ''): string | null {
  return licenciaActual(d, corte)?.[0] ?? null;
}

export function periodoEjercicio(d: Diputado, corte = ''): string {
  const actual = licenciaActual(d, corte);
  const pasadas = (d.licencias ?? []).filter(([a, b]) => b && a !== actual?.[0]).map(([a, b]) => `licencia ${fechaCorta(a)} – ${fechaCorta(b)}`);
  const fin = actual
    ? actual[1]
      ? `con licencia del ${fechaCorta(actual[0])} al ${fechaCorta(actual[1])}`
      : `con licencia desde ${fechaCorta(actual[0])}, no ha regresado`
    : d.fecha_fin && corte && d.fecha_fin > corte
      ? `en funciones (hasta el ${fechaCorta(d.fecha_fin)}, cuando termina la licencia de la persona titular)`
      : d.fecha_fin
        ? fechaCorta(d.fecha_fin)
        : 'en funciones';
  const base = `${fechaCorta(d.fecha_inicio)} – ${fin}`;
  return pasadas.length ? `${base} (${pasadas.join('; ')})` : base;
}

/** «suplente» (distrito) o «en sustitución» (lista de partido, que no tiene suplente); vacío si es titular. */
export function etiquetaSuplencia(d: Diputado): string {
  if (d.calidad !== 'suplente') return '';
  return d.tipo_representacion === 'RP' ? 'en sustitución' : 'suplente';
}

/** Quién ocupa hoy el lugar de una persona con licencia. */
function EnSuLugar({ d }: { d: Diputado }) {
  const { base } = useDatos();
  const corte = base.manifiesto.fecha_corte;
  // Quien ocupa el lugar a la fecha de corte (puede tener ya fecha de salida, si la licencia tiene fecha de regreso).
  const quien = base.diputados.find((x) => x.id_titular === d.id_diputado && x.fecha_inicio <= corte && (!x.fecha_fin || x.fecha_fin >= corte));
  return quien ? (
    <>
      En su lugar está <Link to={`/diputaciones/${encodeURIComponent(quien.id_diputado)}`}>{quien.nombre_completo}</Link>.
    </>
  ) : null;
}

function EnlaceTitular({ d }: { d: Diputado }) {
  const { base } = useDatos();
  const t = d.id_titular ? base.idx.diputado.get(d.id_titular) : undefined;
  return t ? <Link to={`/diputaciones/${encodeURIComponent(t.id_diputado)}`}>{t.nombre_completo}</Link> : <>la persona titular</>;
}

export function DatosGenerales({ d }: { d: Diputado }) {
  const corte = useDatos().base.manifiesto.fecha_corte;
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
            {d.tipo_representacion === 'RP' ? (
              <>
                Entró en lugar de <EnlaceTitular d={d} />, por ser la siguiente persona en la <Termino t="sustitucion">lista de su partido</Termino>
              </>
            ) : (
              <>
                <Termino t="suplente">Suplente</Termino> de <EnlaceTitular d={d} />
              </>
            )}
          </dd>
        </>
      )}
      {licenciaActual(d, corte) && (
        <>
          <dt>Situación</dt>
          <dd>
            {licenciaActual(d, corte)![1] ? (
              <>
                Tiene <Termino t="licencia">licencia</Termino> del {fechaCorta(licenciaActual(d, corte)![0])} al {fechaCorta(licenciaActual(d, corte)![1])}.{' '}
              </>
            ) : (
              <>
                Pidió <Termino t="licencia">licencia</Termino> el {fechaCorta(licenciaActual(d, corte)![0])} y no ha regresado al Congreso.{' '}
              </>
            )}
            <EnSuLugar d={d} />
          </dd>
        </>
      )}
      <dt>En el cargo</dt>
      <dd>{periodoEjercicio(d, corte)}</dd>
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

/** Un dato de la ficha: la cifra en su columna, a la izquierda, y la frase a tamaño normal. */
function Dato({ cifra, children }: { cifra: string; children: ReactNode }) {
  return (
    <li className="dato-fila">
      <span className="dato-fila__cifra" aria-hidden="true">
        {cifra}
      </span>
      <div className="dato-fila__texto">{children}</div>
    </li>
  );
}

/** Ficha breve en lenguaje ciudadano: lo más importante primero y el resto en «Ver todos los datos». */
export function FichaResumen({ d, filtro }: { d: Diputado; filtro: Filtro }) {
  const { base } = useDatos();
  const asis = asistenciaDeDiputado(base, d, filtro);
  const mas = indicadoresDePersonas(base, [d], filtro);
  const ref = referenciaCongresoMemo(base, filtro);
  const div = votosDivididosDeDiputado(base, d.id_diputado, filtro);
  const veces = (n: number) => `${fmt(n)} ${n === 1 ? 'vez' : 'veces'}`;

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
        {base.manifiesto.fecha_corte && (
          <>
            Datos al <strong>{fechaCorta(base.manifiesto.fecha_corte)}</strong> ·{' '}
          </>
        )}
        Periodo: {describirPeriodo(filtro, base.manifiesto.fecha_corte)}
      </p>

      <h4 className="ficha__seccion">¿Qué ha hecho en el Congreso?</h4>
      <p className="pequeno texto-3" style={{ marginTop: 0 }}>
        Ordenado según las tres tareas de una diputación.
      </p>

      <h5 className="ficha__funcion">
        <span className="ficha__funcion-num" aria-hidden="true">1</span>
        Hacer leyes
      </h5>
      <ul className="lista-limpia ficha__datos">
        <Dato cifra={fmt(mas.iniciativasPresentadas)}>
          {mas.iniciativasPresentadas === 0 ? (
            <>No ha presentado propuestas de ley.</>
          ) : (
            <>
              Presentó {fmt(mas.iniciativasPresentadas)} {mas.iniciativasPresentadas === 1 ? 'propuesta de ley' : 'propuestas de ley'}; el Congreso aprobó {fmt(mas.iniciativasAprobadas)}.{' '}
              <Link className="pequeno" to={enlaceConPeriodo('/asuntos', filtro, { diputado: d.id_diputado, tipo: 'iniciativa' })}>
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
        </Dato>
        <Dato cifra={div.divididas === 0 ? '—' : fmt(div.conVoto)}>
          {div.divididas === 0 ? (
            <span className="texto-3">No hubo votaciones divididas en este periodo.</span>
          ) : div.conVoto === 0 ? (
            <>
              En las {fmt(div.divididas)} <Termino t="votacion_dividida">votaciones divididas</Termino> del periodo, el acta no escribe su voto.
            </>
          ) : (
            <>
              En las <Termino t="votacion_dividida">votaciones divididas</Termino>, su voto quedó escrito en {fmt(div.conVoto)} de {fmt(div.divididas)}: {fmt(div.porSentido.favor)} a favor, {fmt(div.porSentido.contra)} en contra
              {div.porSentido.abstencion > 0 && <> y {fmt(div.porSentido.abstencion)} {div.porSentido.abstencion === 1 ? 'abstención' : 'abstenciones'}</>}.{' '}
              <Link className="pequeno" to={enlaceConPeriodo('/votaciones', filtro, { diputado: d.id_diputado, divididas: '1' })}>
                Ver cómo votó
              </Link>
            </>
          )}
        </Dato>
      </ul>

      <h5 className="ficha__funcion">
        <span className="ficha__funcion-num" aria-hidden="true">2</span>
        Representar
      </h5>
      <ul className="lista-limpia ficha__datos">
        <Dato cifra={asis.porcentaje == null ? '—' : fmtPct(asis.porcentaje)}>
          {asis.porcentaje == null ? (
            <span className="texto-3">Asistencia: sin datos suficientes en este periodo.</span>
          ) : (
            <>
              Registró asistencia en {fmt(asis.asistencias)} de {fmt(asis.denominador)} sesiones ({fmtPct(asis.porcentaje)}).
              {asis.justificadas > 0 && <> Faltó con permiso {veces(asis.justificadas)}.</>}
              {asis.ausencias > 0 && <> Faltó sin permiso {veces(asis.ausencias)}.</>}
            </>
          )}{' '}
          <Link className="pequeno" to={enlaceConPeriodo('/asistencias', filtro, { diputado: d.id_diputado })}>
            Ver sesiones
          </Link>
          {asis.porcentaje != null && <BarraComparada valor={asis.porcentaje} referencia={ref.asistencia} />}
        </Dato>
        <Dato cifra={fmt(mas.intervenciones)}>
          {mas.intervenciones === 0 ? <>No ha hablado ante el Congreso.</> : <>Habló ante el Congreso {veces(mas.intervenciones)}.</>}
        </Dato>
      </ul>

      <h5 className="ficha__funcion">
        <span className="ficha__funcion-num" aria-hidden="true">3</span>
        Vigilar al gobierno
      </h5>
      <ul className="lista-limpia ficha__datos">
        <Dato cifra={fmt(mas.exhortosPresentados)}>
          {mas.exhortosPresentados === 0 ? (
            <>No ha pedido a otras autoridades que atiendan un problema (exhortos).</>
          ) : (
            <>
              Pidió a otras autoridades que atendieran un problema (exhortos) {veces(mas.exhortosPresentados)}; el Congreso{' '}
              {mas.exhortosAprobados === 0 ? 'no aprobó ninguno' : <>aprobó {mas.exhortosAprobados === mas.exhortosPresentados && mas.exhortosPresentados > 1 ? 'todos' : fmt(mas.exhortosAprobados)}</>}.
            </>
          )}
        </Dato>
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
  const { base } = useDatos();
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
          {d.calidad === 'suplente' ? (d.tipo_representacion === 'RP' ? 'En sustitución (siguiente en la lista)' : 'Suplente en funciones') : licenciaVigente(d, base.manifiesto.fecha_corte) ? 'Titular con licencia' : etiquetaDe(CALIDAD_CARGO, d.calidad)} · {periodoEjercicio(d, base.manifiesto.fecha_corte)}
        </div>
      </div>
    </Link>
  );
}
