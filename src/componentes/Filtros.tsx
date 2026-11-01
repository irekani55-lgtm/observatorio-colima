import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ANIOS_LEGISLATIVOS } from '../config/legislatura';
import { TIPOS_REPRESENTACION } from '../config/catalogos';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { describirPeriodo, type Filtro } from '../indicadores/filtro';
import { IcoCalendario, IcoReiniciar } from './Iconos';

type Campo = 'anio' | 'fechas' | 'partido' | 'representacion' | 'distrito';

/** Barra de filtros comunes. Los valores viven en la URL. */
export function BarraFiltros({ campos = ['anio', 'fechas', 'partido', 'representacion'], children, extraLimpiar = [] }: { campos?: Campo[]; children?: ReactNode; extraLimpiar?: string[] }) {
  const { base } = useDatos();
  const [f, actualizar, params, fijar] = useFiltro();
  const hayFiltros = Boolean(f.anio || f.desde || f.hasta || f.partido || f.tipoRepresentacion || f.distrito || extraLimpiar.some((k) => params.get(k)));
  // Las fechas exactas quedan ocultas: para la mayoría basta el año. Se muestran si ya hay fechas elegidas.
  const [verFechas, setVerFechas] = useState(false);
  const fechasVisibles = verFechas || Boolean(f.desde || f.hasta);
  // En celular la barra se recoge detrás de un botón para no ocupar media pantalla.
  const [abiertoMovil, setAbiertoMovil] = useState(false);
  const ultimaFecha = base.manifiesto.fecha_corte;

  // Si se llegó desde el botón de una diputación (p. ej. «Ver propuestas» en su ficha), la página ya sabe de
  // quién se trata: en lugar de la barra de filtros se muestra a quién corresponde y cómo ver a todas.
  const idDip = params.get('diputado');
  const dip = idDip ? base.idx.diputado.get(idDip) : undefined;
  if (dip) {
    return (
      <p className="filtros-contexto">
        Está viendo los registros de{' '}
        <Link to={`/diputaciones/${encodeURIComponent(dip.id_diputado)}`}>
          <strong>{dip.nombre_completo}</strong>
        </Link>{' '}
        · {describirPeriodo(f, ultimaFecha)} ·{' '}
        <button type="button" className="boton boton--fantasma boton--chico" onClick={() => fijar({ diputado: undefined })}>
          Ver de todas las diputaciones
        </button>
      </p>
    );
  }

  return (
    <>
      <button type="button" className="boton boton--chico filtros__abrir" aria-expanded={abiertoMovil} aria-controls="barra-filtros" onClick={() => setAbiertoMovil(!abiertoMovil)}>
        <IcoCalendario width={15} height={15} /> {abiertoMovil ? 'Ocultar filtros' : `Filtrar · ${describirPeriodo(f, base.manifiesto.fecha_corte)}`}
      </button>
      <form id="barra-filtros" className={`filtros${abiertoMovil ? '' : ' filtros--cerrado-movil'}`} role="search" aria-label="Filtros" onSubmit={(e) => e.preventDefault()}>
        {campos.includes('anio') && (
          <div className="campo">
            <label htmlFor="f-anio">Año legislativo</label>
            <select id="f-anio" value={f.anio ?? ''} onChange={(e) => actualizar({ anio: e.target.value })}>
              <option value="">Toda la Legislatura</option>
              {ANIOS_LEGISLATIVOS.anios.map((a) => (
                <option key={a.numero} value={a.numero}>
                  {a.etiqueta}
                </option>
              ))}
            </select>
          </div>
        )}
        {campos.includes('fechas') && fechasVisibles && (
          <>
            <div className="campo">
              <label htmlFor="f-desde">Desde</label>
              <input id="f-desde" type="date" value={f.desde ?? ''} max={f.hasta || ultimaFecha || undefined} onChange={(e) => actualizar({ desde: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="f-hasta">Hasta</label>
              <input id="f-hasta" type="date" value={f.hasta ?? ''} min={f.desde || undefined} onChange={(e) => actualizar({ hasta: e.target.value })} />
            </div>
          </>
        )}
        {campos.includes('fechas') && !fechasVisibles && (
          <div className="filtros__acciones">
            <button type="button" className="boton boton--fantasma boton--chico" onClick={() => setVerFechas(true)}>
              <IcoCalendario width={15} height={15} /> Elegir fechas exactas
            </button>
          </div>
        )}
        {campos.includes('partido') && (
          <div className="campo">
            <label htmlFor="f-partido">Partido</label>
            <select id="f-partido" value={f.partido ?? ''} onChange={(e) => actualizar({ partido: e.target.value })}>
              <option value="">Todos</option>
              {base.partidos.map((p) => (
                <option key={p.id_partido} value={p.id_partido}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        {campos.includes('representacion') && (
          <div className="campo">
            <label htmlFor="f-rep">Cómo llegó al cargo</label>
            <select id="f-rep" value={f.tipoRepresentacion ?? ''} onChange={(e) => actualizar({ tipoRepresentacion: e.target.value })}>
              <option value="">Todas las diputaciones</option>
              {Object.keys(TIPOS_REPRESENTACION).map((k) => (
                <option key={k} value={k}>
                  {k === 'MR' ? 'Ganó en su distrito' : 'Por lista de su partido'}
                </option>
              ))}
            </select>
          </div>
        )}
        {campos.includes('distrito') && (
          <div className="campo">
            <label htmlFor="f-distrito">Distrito</label>
            <select id="f-distrito" value={f.distrito ?? ''} onChange={(e) => actualizar({ distrito: e.target.value })}>
              <option value="">Todos</option>
              {Array.from({ length: 16 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Distrito {d}
                </option>
              ))}
            </select>
          </div>
        )}
        {children}
        {hayFiltros && (
          <div className="filtros__acciones">
            <button
              type="button"
              className="boton boton--fantasma boton--chico"
              onClick={() => {
                // Una sola navegación para limpiar todo.
                fijar(Object.fromEntries(['anio', 'desde', 'hasta', 'partido', 'representacion', 'distrito', ...extraLimpiar].map((k) => [k, undefined])));
              }}
            >
              <IcoReiniciar width={15} height={15} /> Limpiar filtros
            </button>
          </div>
        )}
      </form>
      <PeriodoActivo filtro={f} />
    </>
  );
}

export function PeriodoActivo({ filtro }: { filtro: Filtro }) {
  const { base } = useDatos();
  return (
    <p className="periodo-activo">
      <IcoCalendario />
      <span>
        <strong>Periodo de análisis:</strong> {describirPeriodo(filtro, base.manifiesto.fecha_corte)}
      </span>
      {!ANIOS_LEGISLATIVOS.verificado && <span className="texto-3">(límites de los años legislativos por verificar)</span>}
    </p>
  );
}

/** Selector adicional ligado a un parámetro de URL. */
export function FiltroParam({ id, etiqueta, opciones, todos = 'Todos', ancho }: { id: string; etiqueta: string; opciones: { valor: string; etiqueta: string }[]; todos?: string; ancho?: boolean }) {
  const [, , params, fijar] = useFiltro();
  return (
    <div className={`campo${ancho ? ' campo--ancho' : ''}`}>
      <label htmlFor={`f-${id}`}>{etiqueta}</label>
      <select id={`f-${id}`} value={params.get(id) ?? ''} onChange={(e) => fijar(id, e.target.value || undefined)}>
        <option value="">{todos}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}
