import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { TarjetaDiputado } from '../componentes/FichaDiputado';
import { BarraFiltros } from '../componentes/Filtros';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
import { Partido } from '../componentes/Partido';
import { Tabla, type Columna } from '../componentes/Tabla';
import { fmtPct } from '../componentes/Tarjeta';
import type { Diputado } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { asistenciaDeDiputado } from '../indicadores/asistencia';
import { indicadoresAsuntosDiputado } from '../indicadores/asuntos';
import { diputadosFiltrados, hayFiltroDePeriodo, intervalo, type Filtro } from '../indicadores/filtro';
import { intervencionesFiltradas } from '../indicadores/intervenciones';

/** ¿La persona ejerció el cargo en algún momento del periodo? */
export function ejercioEnPeriodo(d: Diputado, f: Filtro): boolean {
  if (!hayFiltroDePeriodo(f)) return true;
  const { desde, hasta } = intervalo(f);
  return d.fecha_inicio <= hasta && (!d.fecha_fin || d.fecha_fin >= desde);
}

export default function Directorio() {
  const { base } = useDatos();
  const [filtro, , , fijar] = useFiltro();
  const [vista, setVista] = useState<'fichas' | 'tabla'>('fichas');
  const lista = diputadosFiltrados(base, filtro)
    .filter((d) => ejercioEnPeriodo(d, filtro))
    .sort((a, b) => (a.tipo_representacion === b.tipo_representacion ? (a.distrito ?? 99) - (b.distrito ?? 99) || a.nombre_completo.localeCompare(b.nombre_completo) : a.tipo_representacion === 'MR' ? -1 : 1));

  const filas = useMemo(() => {
    const inter = intervencionesFiltradas(base, filtro);
    return lista.map((d) => {
      const a = asistenciaDeDiputado(base, d, filtro);
      const i = indicadoresAsuntosDiputado(base, d, filtro);
      return { d, asistencia: a.porcentaje, provisional: !a.definitivo, ini: i.iniciativasPresentadas.total, iniAprob: i.iniciativasAprobadas.total, exh: i.exhortosPresentados.total, exhAprob: i.exhortosAprobados.total, inter: inter.filter((x) => x.id_diputado === d.id_diputado).length };
    });
  }, [base, filtro, lista]);
  type FilaT = (typeof filas)[number];

  const columnas: Columna<FilaT>[] = [
    { id: 'nombre', titulo: 'Nombre', valor: (f) => f.d.nombre_completo, render: (f) => <Link to={`/diputaciones/${encodeURIComponent(f.d.id_diputado)}`}>{f.d.nombre_completo}</Link> },
    { id: 'partido', titulo: 'Partido', valor: (f) => base.idx.partido.get(f.d.id_partido)?.siglas ?? f.d.id_partido, render: (f) => <Partido id={f.d.id_partido} /> },
    { id: 'rep', titulo: 'Representación', valor: (f) => (f.d.tipo_representacion === 'MR' ? `Distrito ${f.d.distrito}` : 'RP') },
    { id: 'asis', titulo: 'Asistencia', numerica: true, valor: (f) => f.asistencia, render: (f) => (f.asistencia == null ? 'Pendiente' : `${fmtPct(f.asistencia)}${f.provisional ? '*' : ''}`) },
    { id: 'ini', titulo: 'Iniciativas presentadas', numerica: true, valor: (f) => f.ini },
    { id: 'inia', titulo: 'Iniciativas aprobadas', numerica: true, valor: (f) => f.iniAprob },
    { id: 'exh', titulo: 'Exhortos presentados', numerica: true, valor: (f) => f.exh },
    { id: 'exha', titulo: 'Exhortos aprobados', numerica: true, valor: (f) => f.exhAprob },
    { id: 'int', titulo: 'Intervenciones', numerica: true, valor: (f) => f.inter },
  ];

  return (
    <>
      <EncabezadoPagina titulo="Directorio de diputadas y diputados">
        <p>
          Personas que han ejercido una curul en la LXI Legislatura según el catálogo cargado, incluidas las personas que entraron por una licencia: suplentes en los distritos y, en las diputaciones por lista, la siguiente persona de la lista del partido (esas no tienen suplente).
        </p>
      </EncabezadoPagina>
      <div className={`fila-flex${claseNuevo()}`} role="group" aria-label="Cómo llegaron al cargo" style={{ marginBottom: '0.75rem' }}>
        <button type="button" className="boton boton--chico" aria-pressed={!filtro.tipoRepresentacion} onClick={() => fijar('representacion', undefined)}>
          Todas
        </button>
        <button type="button" className="boton boton--chico" aria-pressed={filtro.tipoRepresentacion === 'MR'} onClick={() => fijar('representacion', 'MR')}>
          Ganaron en su distrito
        </button>
        <button type="button" className="boton boton--chico" aria-pressed={filtro.tipoRepresentacion === 'RP'} onClick={() => fijar('representacion', 'RP')}>
          Llegaron por la lista de su partido
        </button>
        <Nuevo texto="aquí quedó lo que antes era «Representación proporcional»" />
      </div>
      <BarraFiltros campos={['anio', 'fechas', 'partido', 'distrito']} />
      {base.diputados.length === 0 ? (
        <Aviso tipo="alerta" titulo="Información pendiente de integración">
          El catálogo <code>diputados.csv</code> está vacío. Consulte <Link to="/fuentes#integracion">cómo integrar los datos</Link>.
        </Aviso>
      ) : (
        <>
          <div className="fila-flex" role="group" aria-label="Vista" style={{ marginBottom: '0.75rem' }}>
            <button type="button" className="boton boton--chico" aria-pressed={vista === 'fichas'} onClick={() => setVista('fichas')}>
              Fichas
            </button>
            <button type="button" className="boton boton--chico" aria-pressed={vista === 'tabla'} onClick={() => setVista('tabla')}>
              Tabla comparativa
            </button>
            <span className="pequeno texto-2">{lista.length} personas</span>
          </div>
          {vista === 'fichas' ? (
            <div className="rejilla rejilla--3">
              {lista.map((d) => (
                <TarjetaDiputado key={d.id_diputado} d={d} />
              ))}
            </div>
          ) : (
            <>
              <Aviso>
                Cada columna es un indicador independiente y puede ordenarse por separado. <strong>No se calcula una calificación global</strong>: un número mayor describe más actividad documentada, no mejor desempeño. * Asistencia provisional (hay sesiones sin registro verificable).
              </Aviso>
              <Tabla titulo="Comparativo de indicadores por persona" columnas={columnas} filas={filas} clave={(f) => f.d.id_diputado} archivo="directorio-indicadores" porPagina={30} />
            </>
          )}
        </>
      )}
    </>
  );
}
