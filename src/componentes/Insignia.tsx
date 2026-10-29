import type { EntradaCatalogo } from '../config/catalogos';
import { IcoAlerta, IcoCheck, IcoInfo, IcoInterrogacion, IcoMenos, IcoReloj, IcoX } from './Iconos';

const ICONOS = {
  positivo: IcoCheck,
  negativo: IcoX,
  pendiente: IcoReloj,
  alerta: IcoInterrogacion,
  info: IcoInfo,
  neutro: IcoMenos,
};

/** Distintivo de estado: color + icono + texto (nunca solo color). */
export function Insignia({ entrada, clave, titulo }: { entrada?: EntradaCatalogo; clave?: string; titulo?: string }) {
  if (!entrada) {
    return (
      <span className="insignia insignia--alerta" title="Valor fuera de catálogo">
        <IcoAlerta /> {clave || 'Sin dato'}
      </span>
    );
  }
  const tono = entrada.tono ?? 'neutro';
  const Icono = ICONOS[tono];
  return (
    <span className={`insignia insignia--${tono}`} title={titulo ?? entrada.descripcion}>
      <Icono /> {entrada.etiqueta}
    </span>
  );
}

export function InsigniaCatalogo({ catalogo, valor }: { catalogo: Record<string, EntradaCatalogo>; valor: string }) {
  return <Insignia entrada={catalogo[valor]} clave={valor} />;
}
