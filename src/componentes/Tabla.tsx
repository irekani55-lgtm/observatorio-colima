import { useMemo, useState, type ReactNode } from 'react';
import { guardarArchivo } from './guardarArchivo';
import { aCsv } from '../datos/csv';
import { IcoDescarga, IcoFlecha } from './Iconos';

export interface Columna<T> {
  id: string;
  titulo: string;
  /** Valor usado para ordenar, buscar y exportar. */
  valor: (fila: T) => string | number | null | undefined;
  /** Representación visual (por defecto, el valor). */
  render?: (fila: T) => ReactNode;
  numerica?: boolean;
  /** Excluir de la búsqueda por texto. */
  sinBusqueda?: boolean;
}

interface Props<T> {
  columnas: Columna<T>[];
  filas: T[];
  clave: (fila: T) => string;
  titulo: string;
  porPagina?: number;
  /** Nombre del archivo CSV de descarga (sin extensión). */
  archivo?: string;
  vacio?: ReactNode;
  ordenInicial?: { id: string; desc?: boolean };
  busqueda?: boolean;
}

/** Tabla accesible con ordenamiento, búsqueda, paginación y descarga CSV. */
export function Tabla<T>({ columnas, filas, clave, titulo, porPagina = 25, archivo, vacio, ordenInicial, busqueda = true }: Props<T>) {
  const [texto, setTexto] = useState('');
  const [orden, setOrden] = useState(ordenInicial ?? null);
  const [pagina, setPagina] = useState(0);

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    let r = filas;
    if (q) {
      const cols = columnas.filter((c) => !c.sinBusqueda);
      r = r.filter((f) => cols.some((c) => String(c.valor(f) ?? '').toLowerCase().includes(q)));
    }
    if (orden) {
      const col = columnas.find((c) => c.id === orden.id);
      if (col) {
        r = [...r].sort((a, b) => {
          const va = col.valor(a);
          const vb = col.valor(b);
          if (va == null || va === '') return 1;
          if (vb == null || vb === '') return -1;
          const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', { numeric: true });
          return orden.desc ? -cmp : cmp;
        });
      }
    }
    return r;
  }, [filas, texto, orden, columnas]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const actual = Math.min(pagina, paginas - 1);
  const visibles = filtradas.slice(actual * porPagina, actual * porPagina + porPagina);

  const [avisoDescarga, setAvisoDescarga] = useState('');
  async function descargar() {
    const cols = columnas.map((c) => c.titulo);
    const datos = filtradas.map((f) => Object.fromEntries(columnas.map((c) => [c.titulo, String(c.valor(f) ?? '')])));
    const blob = new Blob(['﻿' + aCsv(cols, datos)], { type: 'text/csv;charset=utf-8' });
    setAvisoDescarga('');
    const r = await guardarArchivo(`${archivo ?? 'registros'}.csv`, blob);
    if (r === 'no_disponible') setAvisoDescarga('No se pudo descargar aquí. Abra la página en otro navegador e intente de nuevo.');
  }

  return (
    <div>
      <div className="tabla-herramientas">
        {busqueda && (
          <input type="search" placeholder="Buscar en la tabla…" aria-label={`Buscar en ${titulo}`} value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(0); }} />
        )}
        <span className="pequeno texto-2" aria-live="polite">
          {filtradas.length.toLocaleString('es-MX')} {filtradas.length === 1 ? 'registro' : 'registros'}
        </span>
        {archivo && filtradas.length > 0 && (
          <button type="button" className="boton boton--chico" onClick={descargar}>
            <IcoDescarga width={15} height={15} /> Descargar CSV
          </button>
        )}
        {avisoDescarga && (
          <span className="muy-pequeno texto-3" role="status">
            {avisoDescarga}
          </span>
        )}
      </div>
      <div className="tabla-envoltura">
        <table className="tabla">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr>
              {columnas.map((c) => {
                const activo = orden?.id === c.id;
                return (
                  <th key={c.id} scope="col" className={c.numerica ? 'num' : undefined} aria-sort={activo ? (orden?.desc ? 'descending' : 'ascending') : 'none'}>
                    <button type="button" onClick={() => setOrden(activo ? { id: c.id, desc: !orden?.desc } : { id: c.id, desc: c.numerica })}>
                      {c.titulo}
                      {activo && <IcoFlecha width={12} height={12} style={{ transform: orden?.desc ? undefined : 'rotate(180deg)' }} />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} className="tabla__vacia">
                  {vacio ?? 'No hay registros que coincidan con los filtros.'}
                </td>
              </tr>
            ) : (
              visibles.map((f) => (
                <tr key={clave(f)}>
                  {columnas.map((c) => (
                    <td key={c.id} className={c.numerica ? 'num' : undefined}>
                      {c.render ? c.render(f) : (c.valor(f) ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {paginas > 1 && (
        <nav className="paginacion" aria-label={`Paginación de ${titulo}`}>
          <button type="button" className="boton boton--chico" disabled={actual === 0} onClick={() => setPagina(actual - 1)}>
            Anterior
          </button>
          <span>
            Página {actual + 1} de {paginas}
          </span>
          <button type="button" className="boton boton--chico" disabled={actual >= paginas - 1} onClick={() => setPagina(actual + 1)}>
            Siguiente
          </button>
        </nav>
      )}
    </div>
  );
}
