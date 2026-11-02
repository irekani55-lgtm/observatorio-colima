import { fmtPct } from './Tarjeta';

/**
 * Barra de 0 a 100 % con el valor de la persona (relleno) y la referencia del Congreso (marca vertical).
 * Los dos números están escritos al lado, así que la barra solo ayuda a verlo de un vistazo.
 */
export function BarraComparada({ valor, referencia, etiquetaReferencia = 'Todo el Congreso' }: { valor: number; referencia: number | null; etiquetaReferencia?: string }) {
  const lim = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <span className="barra-comp" role="img" aria-label={`${fmtPct(valor)}${referencia != null ? `; ${etiquetaReferencia.toLowerCase()}: ${fmtPct(referencia)}` : ''}`}>
      <span className="barra-comp__pista">
        <span className="barra-comp__valor" style={{ width: `${lim(valor)}%` }} />
        {referencia != null && <span className="barra-comp__ref" style={{ left: `${lim(referencia)}%` }} />}
      </span>
      {referencia != null && (
        <span className="barra-comp__leyenda muy-pequeno texto-3">
          <span className="barra-comp__marca" aria-hidden="true" /> {etiquetaReferencia}: {fmtPct(referencia)}
        </span>
      )}
    </span>
  );
}
