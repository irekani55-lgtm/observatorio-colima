/** Iconos SVG en línea (sin dependencias). Decorativos salvo que se indique `titulo`. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { titulo?: string };
const base = (hijos: React.ReactNode) =>
  function Icono({ titulo, ...p }: P) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden={titulo ? undefined : true} role={titulo ? 'img' : undefined} {...p}>
        {titulo && <title>{titulo}</title>}
        {hijos}
      </svg>
    );
  };

export const IcoCongreso = base(<><path d="M3 21h18M5 21V10l7-5 7 5v11" /><path d="M9 21v-7M12 21v-7M15 21v-7" /></>);
export const IcoInfo = base(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>);
export const IcoAlerta = base(<><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></>);
export const IcoCheck = base(<path d="m5 12 5 5 9-10" />);
export const IcoX = base(<path d="M6 6l12 12M18 6 6 18" />);
export const IcoReloj = base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IcoInterrogacion = base(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01" /></>);
export const IcoMenos = base(<path d="M6 12h12" />);
export const IcoEnlace = base(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>);
export const IcoCalendario = base(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>);
export const IcoPersona = base(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>);
export const IcoMenu = base(<path d="M4 7h16M4 12h16M4 17h16" />);
export const IcoSol = base(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const IcoLuna = base(<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />);
export const IcoDescarga = base(<><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 19h16" /></>);
export const IcoTabla = base(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></>);
export const IcoGrafica = base(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
export const IcoFlecha = base(<path d="M7 10l5 5 5-5" />);
export const IcoReiniciar = base(<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>);
