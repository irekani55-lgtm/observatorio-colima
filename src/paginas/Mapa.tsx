import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { FichaResumen, periodoEjercicio } from '../componentes/FichaDiputado';
import { BarraFiltros } from '../componentes/Filtros';
import { IcoReiniciar } from '../componentes/Iconos';
import { LEGISLATURA } from '../config/legislatura';
import type { Base, Diputado } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { LienzoMapa, SelloMapa, useCartografia } from '../mapa/MapaDistritos';

/** Personas que ocuparon la curul de un distrito: primero quien está en funciones. */
export function personasDelDistrito(b: Base, distrito: number): Diputado[] {
  return b.diputados
    .filter((d) => d.tipo_representacion === 'MR' && d.distrito === distrito)
    .sort((a, c) => Number(Boolean(a.fecha_fin)) - Number(Boolean(c.fecha_fin)) || c.fecha_inicio.localeCompare(a.fecha_inicio));
}

export default function PaginaMapa() {
  const { base } = useDatos();
  const [filtro, , params, fijar] = useFiltro();
  const cartografia = useCartografia();
  const sel = filtro.distrito ?? null;
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
    fijar({ persona: undefined, distrito: d == null ? undefined : String(d) });
    // En pantallas angostas la ficha queda debajo del mapa: se lleva a la vista.
    if (d != null && typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) {
      requestAnimationFrame(() => ficha.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    }
  };

  return (
    <>
      <EncabezadoPagina titulo="Mapa de distritos electorales locales">
        <p>
          Colima elige {LEGISLATURA.integracion.MR} diputaciones por mayoría relativa, una por cada distrito electoral local. Seleccione un distrito en el mapa o en la lista para ver la ficha de la persona que lo representa. Las {LEGISLATURA.integracion.RP} diputaciones de representación proporcional no corresponden a un distrito y se consultan en <Link to="/representacion-proporcional">su propio apartado</Link>.
        </p>
      </EncabezadoPagina>
      <BarraFiltros campos={['anio', 'fechas']} />

      <div className="mapa-disposicion">
        <section className="panel" aria-label="Mapa">
          <div className="panel__cabecera">
            <h2 style={{ fontSize: '1.1rem' }}>Estado de Colima · 16 distritos locales</h2>
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
              <Aviso tipo="alerta" titulo="Información pendiente de integración">
                No hay una diputación de mayoría relativa registrada para este distrito en el catálogo de diputados.
              </Aviso>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.1rem' }}>Distrito electoral local {sel}</h2>
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
    </>
  );
}
