import { useState } from 'react';
import { IcoPersona } from './Iconos';

/**
 * Fotografía oficial. Si no hay URL o la imagen no carga, muestra un
 * marcador neutro: nunca se sustituye por otra imagen.
 */
export function Foto({ url, archivo, nombre }: { url?: string; archivo?: string; nombre: string }) {
  // En la versión sin conexión las fotos viajan dentro del mismo archivo (window.__ARCHIVOS__).
  const ruta = archivo ? archivo.replace(/^\//, '') : '';
  const incrustada = ruta ? (globalThis as unknown as { __ARCHIVOS__?: Record<string, string> }).__ARCHIVOS__?.[ruta] : undefined;
  const src = incrustada ?? (archivo ? `${import.meta.env.BASE_URL}${ruta}` : url);
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
