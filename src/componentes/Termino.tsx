import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GLOSARIO, type TerminoGlosario } from '../config/glosario';

/** Palabra con su explicación del glosario. Se abre al tocarla o con el teclado (funciona en celulares). */
export function Termino({ t, children }: { t: TerminoGlosario; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [desplazar, setDesplazar] = useState(0);
  const globo = useRef<HTMLSpanElement>(null);
  const id = useId();

  // Si el globo se sale de la pantalla por la derecha, se recorre hacia adentro.
  useLayoutEffect(() => {
    if (!abierto || !globo.current || typeof window === 'undefined') return;
    const r = globo.current.getBoundingClientRect();
    const sobra = r.right - (window.innerWidth - 12);
    if (sobra > 0) setDesplazar(-Math.min(sobra, r.left - 12));
  }, [abierto]);

  return (
    <span className="termino">
      <button
        type="button"
        className="termino__palabra"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => {
          setDesplazar(0);
          setAbierto(!abierto);
        }}
      >
        {children}
      </button>
      {abierto && (
        <span id={id} ref={globo} role="note" className="termino__explicacion" style={desplazar ? { left: desplazar } : undefined}>
          {GLOSARIO[t]}
        </span>
      )}
    </span>
  );
}
