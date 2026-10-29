import { useState } from 'react';
import { IcoPersona } from './Iconos';

/**
 * Fotografía oficial. Si no hay URL o la imagen no carga, muestra un
 * marcador neutro: nunca se sustituye por otra imagen.
 */
export function Foto({ url, archivo, nombre }: { url?: string; archivo?: string; nombre: string }) {
  const src = archivo ? `${import.meta.env.BASE_URL}${archivo.replace(/^\//, '')}` : url;
  const [fallo, setFallo] = useState(false);
  return (
    <div className="foto">
      {src && !fallo ? (
        <img src={src} alt={`Fotografía oficial de ${nombre}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFallo(true)} />
      ) : (
        <div className="foto__vacia" role="img" aria-label={`Fotografía no disponible de ${nombre}`}>
          <IcoPersona />
          <span>Fotografía no disponible</span>
        </div>
      )}
    </div>
  );
}
