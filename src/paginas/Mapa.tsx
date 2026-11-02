import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { etiquetaSuplencia, FichaResumen, periodoEjercicio } from '../componentes/FichaDiputado';
import { IcoReiniciar } from '../componentes/Iconos';
import { COALICIONES_2024, LEGISLATURA } from '../config/legislatura';
import { colorPartido } from '../componentes/colores';
import { Foto } from '../componentes/Foto';
import { Termino } from '../componentes/Termino';
import { enFunciones } from '../indicadores/filtro';
import { CONFIG_MAPA } from '../config/mapa';
import { EnlaceExterno } from '../componentes/Fuente';
import type { Base, Diputado } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { LienzoMapa, SelloMapa, useCartografia } from '../mapa/MapaDistritos';
import { Tabla } from '../componentes/Tabla';
import { BuscadorDistrito } from '../componentes/BuscadorDistrito';
import { fmt, fmtPct } from '../componentes/Tarjeta';
import { EnlaceDip } from '../componentes/TablasRegistros';
import { indicadoresDePersonas, type IndicadoresPersonas } from '../indicadores/distritos';

/** Personas que ocuparon la curul de un distrito: primero quien está en funciones. */
export function personasDelDistrito(b: Base, distrito: number): Diputado[] {
  return b.diputados
    .filter((d) => d.tipo_representacion === 'MR' && d.distrito === distrito)
    .sort((a, c) => Number(Boolean(a.fecha_fin)) - Number(Boolean(c.fecha_fin)) || c.fecha_inicio.localeCompare(a.fecha_inicio));
}

/** Demarcación del distrito (IEE) y enlace a su mapa oficial. */
function InfoDistrito({ n }: { n: number }) {
  const { base } = useDatos();
  const d = base.distritos.find((x) => x.distrito === n);
  return (
    <p className="pequeno texto-2" style={{ marginTop: '-0.25rem' }}>
      {d?.cabecera && <>Demarcación: <strong>{d.cabecera}</strong>. </>}
      {d?.municipios.length ? <>Municipio{d.municipios.length > 1 ? 's' : ''}: {d.municipios.join(', ')}. </> : null}
      <EnlaceExterno url={CONFIG_MAPA.urlMapaOficial(n)}>Mapa oficial del distrito (IEE, PDF)</EnlaceExterno>
    </p>
  );
}

/**
 * Mapa interactivo de los 16 distritos con la ficha del distrito elegido. Lo usan la página de Inicio y la del
 * mapa. `clave` es el parámetro de la URL que guarda el distrito: en Inicio se usa uno propio para que elegir un
 * distrito no filtre los demás indicadores de la página.
 */
export function MapaInteractivo({ clave = 'distrito', titulo = 'Estado de Colima · 16 distritos locales' }: { clave?: string; titulo?: string }) {
  const { base } = useDatos();
  const [filtro, , params, fijar] = useFiltro();
  const cartografia = useCartografia();
  const valor = Number(params.get(clave));
  const sel = Number.isInteger(valor) && valor > 0 ? valor : null;
  const periodo = { anio: filtro.anio, desde: filtro.desde, hasta: filtro.hasta };
  const personas = sel ? personasDelDistrito(base, sel) : [];
  const idPersona = params.get('persona');
  const persona = personas.find((p) => p.id_diputado === idPersona) ?? personas[0];
  const nombreDe = (d: number) => {
    const p = personasDelDistrito(base, d)[0];
    return p ? `Distrito ${d} · ${p.nombre_completo}` : `Distrito ${d}`;
  };
  // Color del partido de quien ocupa hoy la curul; en el mapa la etiqueta también dice el partido.
  const partidoDe = (d: number) => personasDelDistrito(base, d)[0]?.id_partido;
  const siglasDe = (d: number) => base.idx.partido.get(partidoDe(d) ?? '')?.siglas ?? partidoDe(d) ?? '';
  const colorDe = (d: number) => (partidoDe(d) ? colorPartido(base, partidoDe(d)!) : undefined);
  const etiquetaMapa = (d: number) => `${nombreDe(d)}${siglasDe(d) ? ` (${siglasDe(d)})` : ''}`;
  const leyenda = Object.entries(
    Array.from({ length: LEGISLATURA.distritos }, (_, i) => partidoDe(i + 1)).reduce<Record<string, number>>((m, id) => (id ? { ...m, [id]: (m[id] ?? 0) + 1 } : m), {}),
  ).sort((a, b) => b[1] - a[1]);
  // Diputaciones de representación proporcional: representan a todo el estado, no a un distrito.
  const claveRp = clave === 'distrito' ? 'rp' : `${clave}_rp`;
  const corte = base.manifiesto.fecha_corte;
  const plurinominales = base.diputados
    .filter((d) => d.tipo_representacion === 'RP' && enFunciones(d, corte))
    .sort((a, b) => (base.idx.partido.get(a.id_partido)?.orden ?? 99) - (base.idx.partido.get(b.id_partido)?.orden ?? 99) || a.nombre_completo.localeCompare(b.nombre_completo));
  const enCurul = base.diputados.filter((d) => enFunciones(d, corte));
  const porPartido = Object.entries(enCurul.reduce<Record<string, Diputado[]>>((m, d) => ({ ...m, [d.id_partido]: [...(m[d.id_partido] ?? []), d] }), {})).sort(
    (a, b) => b[1].length - a[1].length || (base.idx.partido.get(a[0])?.orden ?? 99) - (base.idx.partido.get(b[0])?.orden ?? 99),
  );
  const siglas = (id: string) => base.idx.partido.get(id)?.siglas ?? id;
  const listaSiglas = (ids: readonly string[]) => ids.map(siglas).join(', ').replace(/, ([^,]*)$/, ' y $1');
  const abrirCurul = (d: Diputado) => (d.tipo_representacion === 'MR' && d.distrito != null ? seleccionar(d.distrito) : seleccionarRp(d.id_diputado));
  const rp = sel == null ? plurinominales.find((d) => d.id_diputado === params.get(claveRp)) : undefined;
  const ficha = useRef<HTMLElement>(null);
  const seleccionarRp = (id: string) => {
    fijar({ persona: undefined, [clave]: undefined, [claveRp]: id });
    requestAnimationFrame(() => ficha.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  };
  const seleccionar = (d: number | null) => {
    fijar({ persona: undefined, [claveRp]: undefined, [clave]: d == null ? undefined : String(d) });
    // En pantallas angostas la ficha queda debajo del mapa: se lleva a la vista.
    if (d != null && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) {
      requestAnimationFrame(() => ficha.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    }
  };

  return (
    <>
      <div className="mapa-disposicion">
        <section className="panel" aria-label="Mapa">
          <div className="panel__cabecera">
            <h2 style={{ fontSize: '1.1rem' }}>{titulo}</h2>
            {sel != null && (
              <button type="button" className="boton boton--chico" onClick={() => seleccionar(null)}>
                <IcoReiniciar width={15} height={15} /> Restablecer selección
              </button>
            )}
          </div>
          {cartografia.tipo === 'cargando' ? (
            <p className="tabla__vacia" role="status">
              Cargando cartografía…
            </p>
          ) : (
            <>
              <LienzoMapa mapa={cartografia.mapa} seleccionado={sel} onSeleccionar={(d) => seleccionar(d === sel ? null : d)} etiquetaDistrito={etiquetaMapa} colorDistrito={colorDe} titulo="Mapa de distritos electorales locales de Colima" />
              <ul className="leyenda-mapa" aria-label="Partido de quien representa cada distrito">
                {leyenda.map(([id, n]) => (
                  <li key={id}>
                    <span className="muestra" style={{ background: colorPartido(base, id) }} aria-hidden="true" />
                    {base.idx.partido.get(id)?.siglas ?? id} <span className="texto-3">· {n} {n === 1 ? 'distrito' : 'distritos'}</span>
                  </li>
                ))}
              </ul>
              <p className="muy-pequeno texto-3" style={{ margin: '0.35rem 0 0' }}>
                Los distritos tienen distinto tamaño pero casi la misma población: el color muestra quién representa cada zona, no cuánta gente vive en ella.
              </p>
              <SelloMapa estado={cartografia} />
            </>
          )}
          <h3 className="pequeno" style={{ marginTop: '1rem' }} id="lista-distritos">
            Seleccionar distrito por número
          </h3>
          <ul className="lista-distritos" aria-labelledby="lista-distritos">
            {Array.from({ length: LEGISLATURA.distritos }, (_, i) => i + 1).map((d) => (
              <li key={d}>
                <button type="button" className="boton boton--chico" aria-pressed={sel === d} aria-label={nombreDe(d)} onClick={() => seleccionar(sel === d ? null : d)}>
                  {d}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel" ref={ficha} aria-live="polite" aria-label="Ficha del distrito seleccionado" style={{ scrollMarginTop: 80 }}>
          {rp ? (
            <>
              <h2 style={{ fontSize: '1.1rem' }}>Diputación de todo el estado</h2>
              <p className="pequeno texto-2" style={{ marginTop: '-0.25rem' }}>
                Llegó al Congreso por la <Termino t="representacion_proporcional">lista de su partido</Termino> y representa a todo Colima.
              </p>
              <FichaResumen d={rp} filtro={periodo} />
            </>
          ) : sel == null ? (
            <>
              <h2 style={{ fontSize: '1.1rem' }}>Elija su distrito</h2>
              <p className="texto-2">Toque su distrito en el mapa o elija su número abajo. Verá quién le representa y qué ha hecho en el Congreso.</p>
              <p className="pequeno texto-3">Con teclado: use Tab para moverse entre los distritos y Enter para elegir uno.</p>
            </>
          ) : !persona ? (
            <>
              <h2 style={{ fontSize: '1.1rem' }}>Distrito {sel}</h2>
              <InfoDistrito n={sel} />
              <Aviso tipo="alerta" titulo="Información pendiente de integración">
                No hay una diputación de mayoría relativa registrada para este distrito en el catálogo de diputados.
              </Aviso>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.1rem' }}>Distrito electoral local {sel}</h2>
              <InfoDistrito n={sel} />
              {personas.length > 1 && (
                <div className="fila-flex pequeno" style={{ marginBottom: '0.75rem' }}>
                  <span className="texto-2">Personas que han ocupado esta curul:</span>
                  {personas.map((p) => (
                    <button key={p.id_diputado} type="button" className="boton boton--chico" aria-pressed={p.id_diputado === persona.id_diputado} onClick={() => fijar('persona', p.id_diputado)}>
                      {p.nombre_completo} ({periodoEjercicio(p)})
                    </button>
                  ))}
                </div>
              )}
              <FichaResumen d={persona} filtro={periodo} />
            </>
          )}
        </section>
      </div>

      {enCurul.length > 0 && (
        <section className="panel curules" aria-labelledby={`${claveRp}-curules`}>
          <h3 id={`${claveRp}-curules`} style={{ fontSize: '1.05rem', marginTop: 0 }}>
            ¿Cómo se reparten los {enCurul.length} lugares del Congreso?
          </h3>
          <div className="curules__grupos">
            {porPartido.map(([id, personas]) => (
              <div key={id} className="curules__grupo">
                <span className="curules__etiqueta">
                  <strong className="num">{personas.length}</strong> {siglas(id)}
                </span>
                <span className="curules__cuadros">
                  {personas.map((d) => (
                    <button
                      key={d.id_diputado}
                      type="button"
                      className="curules__cuadro"
                      style={{ background: colorPartido(base, id) }}
                      title={`${d.nombre_completo} (${siglas(id)})`}
                      aria-label={`${d.nombre_completo}, ${siglas(id)}. Ver su ficha`}
                      onClick={() => abrirCurul(d)}
                    />
                  ))}
                </span>
              </div>
            ))}
          </div>
          <ul className="pequeno texto-2 curules__coaliciones">
            {COALICIONES_2024.map((c) => {
              const n = enCurul.filter((d) => (c.partidos as readonly string[]).includes(d.id_partido)).length;
              return (
                <li key={c.nombre}>
                  {listaSiglas(c.partidos)} se unieron en la elección de 2024 («{c.nombre}») y juntos tienen <strong>{n}</strong> de los {enCurul.length} lugares.
                </li>
              );
            })}
          </ul>
          <p className="muy-pequeno texto-3">Cada cuadro es una persona. Tóquelo para ver qué ha hecho.</p>
        </section>
      )}

      {plurinominales.length > 0 && (
        <section className="panel franja-rp" aria-labelledby={`${claveRp}-titulo`}>
          <h3 id={`${claveRp}-titulo`} style={{ fontSize: '1.05rem', marginTop: 0 }}>
            Además, a todo Colima le representan estas {plurinominales.length} diputaciones
          </h3>
          <p className="pequeno texto-2">
            Llegaron al Congreso por la <Termino t="representacion_proporcional">lista de su partido</Termino>, no por un distrito. Toque a una persona para ver qué ha hecho.
          </p>
          <ul className="franja-rp__lista">
            {plurinominales.map((d) => {
              const partido = base.idx.partido.get(d.id_partido);
              return (
                <li key={d.id_diputado}>
                  <button
                    type="button"
                    className="franja-rp__persona"
                    aria-pressed={rp?.id_diputado === d.id_diputado}
                    style={{ borderLeftColor: colorPartido(base, d.id_partido) }}
                    onClick={() => seleccionarRp(d.id_diputado)}
                  >
                    <span className="franja-rp__foto">
                      <Foto url={d.url_foto} archivo={d.archivo_foto} nombre={d.nombre_completo} />
                    </span>
                    <span>
                      <span className="franja-rp__nombre">{d.nombre_completo}</span>
                      <span className="franja-rp__partido">
                        <span className="muestra" style={{ background: colorPartido(base, d.id_partido) }} aria-hidden="true" />
                        {partido?.siglas ?? d.id_partido}
                        {etiquetaSuplencia(d) && ` · ${etiquetaSuplencia(d)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

interface FilaDistrito extends IndicadoresPersonas {
  distrito: number;
  municipios: string;
  personas: Diputado[];
}

/** Tabla con los indicadores de los 16 distritos, para compararlos. Suma a quienes ocuparon la curul en el periodo. */
export function TablaDistritos() {
  const { base } = useDatos();
  const [filtro] = useFiltro();
  const periodo = { anio: filtro.anio, desde: filtro.desde, hasta: filtro.hasta };
  const filas = useMemo<FilaDistrito[]>(
    () =>
      Array.from({ length: LEGISLATURA.distritos }, (_, i) => i + 1).map((n) => {
        const personas = personasDelDistrito(base, n);
        const dist = base.distritos.find((x) => x.distrito === n);
        return { distrito: n, municipios: dist?.municipios.join(', ') ?? '', personas, ...indicadoresDePersonas(base, personas, periodo) };
      }),
    [base, periodo.anio, periodo.desde, periodo.hasta], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const n = (k: keyof IndicadoresPersonas, titulo: string) => ({ id: k, titulo, numerica: true, valor: (f: FilaDistrito) => f[k] as number, render: (f: FilaDistrito) => <span className="num">{fmt(f[k] as number)}</span> });
  return (
    <Tabla<FilaDistrito>
      titulo="Indicadores por distrito"
      filas={filas}
      clave={(f) => String(f.distrito)}
      archivo="indicadores_por_distrito"
      porPagina={16}
      ordenInicial={{ id: 'd', desc: false }}
      columnas={[
        { id: 'd', titulo: 'Distrito', numerica: true, valor: (f) => f.distrito },
        { id: 'm', titulo: 'Municipios', valor: (f) => f.municipios, render: (f) => <span className="pequeno">{f.municipios || '—'}</span> },
        {
          id: 'p',
          titulo: 'Diputada/o',
          valor: (f) => f.personas.map((p) => p.nombre_completo).join('; '),
          render: (f) => (
            <span className="pequeno">
              {f.personas.map((p, i) => (
                <span key={p.id_diputado}>
                  {i > 0 && <br />}
                  <EnlaceDip id={p.id_diputado} />
                  {etiquetaSuplencia(p) && <span className="texto-3"> ({etiquetaSuplencia(p)})</span>}
                </span>
              ))}
            </span>
          ),
        },
        { id: 'a', titulo: 'Asistencia', numerica: true, valor: (f) => f.asistencia.porcentaje ?? '', render: (f) => <span className="num">{f.asistencia.porcentaje == null ? '—' : fmtPct(f.asistencia.porcentaje)}</span> },
        n('iniciativasPresentadas', 'Iniciativas presentadas'),
        n('iniciativasAprobadas', 'Iniciativas aprobadas'),
        n('dictamenesDeSusIniciativas', 'Dictámenes de sus iniciativas'),
        n('dictamenesComisionesQuePreside', 'Dictámenes de comisiones que preside'),
        n('dictamenesComisionesQueIntegra', 'Dictámenes de comisiones que integra'),
        n('exhortosPresentados', 'Exhortos presentados'),
        n('exhortosAprobados', 'Exhortos aprobados'),
        n('puntosAcuerdo', 'Puntos de acuerdo'),
        n('intervenciones', 'Intervenciones'),
        n('votosRegistrados', 'Votos registrados'),
      ]}
    />
  );
}

/** Nota que acompaña a la tabla por distrito. */
export function NotaTablaDistritos() {
  return (
    <p className="seccion__intro">
      Un distrito no es lo mismo que un municipio: los 16 distritos se forman con secciones electorales según la población. Algunos ocupan solo una parte de un municipio (la ciudad de Colima se reparte entre los distritos 1, 2 y 3) y otros reúnen partes de dos municipios. Cuando una suplente ocupó la curul durante una licencia, sus registros se suman a los del distrito y cada asunto cuenta una sola vez. Los dictámenes se cuentan por las comisiones a las que pertenece la persona: son trabajo colectivo, no individual. Los totales de la tabla no se suman entre distritos, porque un asunto compartido aparece en cada distrito que lo promovió.
    </p>
  );
}

export default function PaginaMapa() {
  return (
    <>
      <EncabezadoPagina titulo="Mapa de distritos electorales locales">
        <p>
          Colima elige {LEGISLATURA.integracion.MR} diputaciones por mayoría relativa, una por cada distrito electoral local. Seleccione un distrito en el mapa o en la lista para ver la ficha de la persona que lo representa. Las {LEGISLATURA.integracion.RP} diputaciones de representación proporcional no corresponden a un distrito y se consultan en <Link to="/representacion-proporcional">su propio apartado</Link>.
        </p>
      </EncabezadoPagina>
      <BuscadorDistrito />
      <MapaInteractivo />
      <section className="seccion">
        <h2>Indicadores por distrito</h2>
        <NotaTablaDistritos />
        <TablaDistritos />
      </section>
    </>
  );
}
