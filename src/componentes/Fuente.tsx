import { useDatos } from '../estado/DatosContext';
import { IcoEnlace } from './Iconos';

export function esUrlSegura(u: string | undefined): u is string {
  return Boolean(u && /^https?:\/\/[^\s]+$/i.test(u));
}

/** Enlace externo seguro; si la URL no es válida muestra el texto sin enlace. */
export function EnlaceExterno({ url, children, sinIcono }: { url?: string; children: React.ReactNode; sinIcono?: boolean }) {
  if (!esUrlSegura(url)) return <span className="texto-3">{children} (enlace no disponible)</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {children}
      {!sinIcono && <IcoEnlace width={13} height={13} style={{ marginLeft: 3, verticalAlign: '-1px' }} />}
      <span className="sr-only"> (abre en otra pestaña)</span>
    </a>
  );
}

/** Muestra la evidencia referida por id_fuente. */
export function EnlaceFuente({ id, corto }: { id?: string; corto?: boolean }) {
  const { base } = useDatos();
  if (!id) return <span className="texto-3 muy-pequeno">Sin fuente</span>;
  const e = base.idx.evidencia.get(id);
  if (!e) return <span className="texto-3 muy-pequeno" title={`ID ${id} no encontrado en evidencias`}>Fuente {id} no localizada</span>;
  return (
    <span className="muy-pequeno">
      <EnlaceExterno url={e.url}>{corto ? 'Fuente' : e.titulo || id}</EnlaceExterno>
      {!corto && e.pagina && <span className="texto-3"> · p. {e.pagina}</span>}
    </span>
  );
}
