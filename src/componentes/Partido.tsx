import { useDatos } from '../estado/DatosContext';
import { colorPartido } from './colores';

export function Partido({ id }: { id: string }) {
  const { base } = useDatos();
  const p = base.idx.partido.get(id);
  return (
    <span className="insignia insignia--partido" title={p?.nombre ?? 'Partido no registrado'}>
      <span className="punto" style={{ background: colorPartido(base, id) }} aria-hidden="true" />
      {p?.siglas ?? (id || 'Sin adscripción')}
    </span>
  );
}
