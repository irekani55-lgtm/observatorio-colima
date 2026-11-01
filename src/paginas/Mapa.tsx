import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { FichaResumen, periodoEjercicio } from '../componentes/FichaDiputado';
import { BarraFiltros } from '../componentes/Filtros';
import { IcoReiniciar } from '../componentes/Iconos';
import { LEGISLATURA } from '../config/legislatura';
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
  const ficha = useRef<HTMLElement>(null);
  const seleccionar = (d: number | null) => {
    fijar({ persona: undefined, [clave]: d == null ? undefined : String(d) });
    // En pantallas angostas la ficha queda debajo del mapa: se lleva a la vista.
    if (d != null && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) {
      requestAnimationFrame(() => ficha.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    }
  };

  return (
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
              <LienzoMapa mapa={cartografia.mapa} seleccionado={sel} onSeleccionar={(d) => seleccionar(d === sel ? null : d)} etiquetaDistrito={nombreDe} titulo="Mapa de distritos electorales locales de Colima" />
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
          {sel == null ? (
            <>
              <h2 style={{ fontSize: '1.1rem' }}>Vista general</h2>
              <p className="texto-2">Seleccione un distrito para consultar la ficha de su diputada o diputado y sus tres indicadores principales: asistencia a sesiones, iniciativas aprobadas y exhortos aprobados.</p>
              <p className="pequeno texto-3">
                En pantallas táctiles, toque el distrito. Con teclado, use Tab para recorrer los distritos y Enter para seleccionar.
              </p>
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
                  {p.calidad === 'suplente' && <span className="texto-3"> (suplente)</span>}
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
      <BarraFiltros campos={['anio', 'fechas']} />
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
