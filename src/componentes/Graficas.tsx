/**
 * Gráficas reutilizables. Cada una ofrece vista de tabla (accesibilidad y
 * contraste), leyenda cuando hay 2+ series y tooltip al pasar el cursor.
 */
import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { IcoGrafica, IcoTabla } from './Iconos';

export interface Serie {
  clave: string;
  etiqueta: string;
  color: string;
}

type Dato = Record<string, string | number | null | undefined>;

export function PanelGrafica({ titulo, nota, datos, columnas, children, vacio }: { titulo: string; nota?: ReactNode; datos: Dato[]; columnas: { clave: string; etiqueta: string }[]; children: ReactNode; vacio?: boolean }) {
  const [tabla, setTabla] = useState(false);
  const sinDatos = vacio ?? datos.length === 0;
  return (
    <section className="panel" aria-label={titulo}>
      <div className="panel__cabecera">
        <h3>{titulo}</h3>
        {!sinDatos && (
          <button type="button" className="boton boton--chico" aria-pressed={tabla} onClick={() => setTabla(!tabla)}>
            {tabla ? <IcoGrafica width={15} height={15} /> : <IcoTabla width={15} height={15} />}
            {tabla ? 'Ver gráfica' : 'Ver tabla'}
          </button>
        )}
      </div>
      {nota && <p className="panel__nota">{nota}</p>}
      {sinDatos ? (
        <p className="tabla__vacia">Información pendiente de integración: no hay registros para este periodo y filtros.</p>
      ) : tabla ? (
        <div className="tabla-envoltura" style={{ maxHeight: 360 }}>
          <table className="tabla">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr>
                {columnas.map((c, i) => (
                  <th key={c.clave} scope="col" className={i > 0 ? 'num' : undefined}>
                    {c.etiqueta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.map((d, i) => (
                <tr key={i}>
                  {columnas.map((c, j) => (
                    <td key={c.clave} className={j > 0 ? 'num' : undefined}>
                      {typeof d[c.clave] === 'number' ? (d[c.clave] as number).toLocaleString('es-MX') : (d[c.clave] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export function Leyenda({ series }: { series: Serie[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="leyenda" aria-label="Leyenda">
      {series.map((s) => (
        <li key={s.clave}>
          <span className="muestra" style={{ background: s.color }} aria-hidden="true" />
          {s.etiqueta}
        </li>
      ))}
    </ul>
  );
}

function Globo({ active, payload, label, series, etiquetaX }: Partial<TooltipContentProps<number, string>> & { series: Serie[]; etiquetaX?: (v: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <div className="tooltip__titulo">{etiquetaX ? etiquetaX(String(label)) : String(label)}</div>
      {payload.map((p) => {
        const s = series.find((x) => x.clave === p.dataKey);
        return (
          <div className="tooltip__fila" key={String(p.dataKey)}>
            <span>
              <span className="punto" style={{ background: s?.color ?? String(p.color) }} />
              {s?.etiqueta ?? String(p.name)}
            </span>
            <strong className="num">{typeof p.value === 'number' ? p.value.toLocaleString('es-MX') : String(p.value ?? '—')}</strong>
          </div>
        );
      })}
    </div>
  );
}

const ejeProps = { stroke: 'var(--eje)', tick: { fill: 'var(--texto-3)', fontSize: 12 }, tickLine: false, axisLine: { stroke: 'var(--borde-fuerte)' } } as const;

interface PropsBarras {
  datos: Dato[];
  claveX: string;
  series: Serie[];
  horizontal?: boolean;
  apilado?: boolean;
  alto?: number;
  anchoEtiqueta?: number;
  /** Color por fila (p. ej. por partido) para una sola serie. */
  colorFila?: (d: Dato) => string;
  etiquetaX?: (v: string) => string;
  /** Formato solo para las marcas del eje (p. ej. recortar nombres largos). */
  etiquetaEje?: (v: string) => string;
  /** Escribe el valor al final de cada barra (solo para pocas barras de una serie). */
  valores?: (v: number) => string;
}

export function GraficaBarras({ datos, claveX, series, horizontal, apilado, alto, anchoEtiqueta = 150, colorFila, etiquetaX, etiquetaEje, valores }: PropsBarras) {
  const h = alto ?? (horizontal ? Math.max(220, datos.length * (series.length > 1 && !apilado ? 34 : 26) + 40) : 280);
  return (
    <>
      {series.length > 1 && <Leyenda series={series} />}
      <div className="grafica" style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: valores ? 44 : 16, bottom: 4, left: 0 }} barGap={2} barCategoryGap={horizontal ? 4 : '18%'}>
            <CartesianGrid stroke="var(--rejilla)" horizontal={!horizontal} vertical={horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" allowDecimals={false} {...ejeProps} />
                <YAxis type="category" dataKey={claveX} width={anchoEtiqueta} interval={0} tickFormatter={etiquetaEje ?? etiquetaX} {...ejeProps} />
              </>
            ) : (
              <>
                <XAxis dataKey={claveX} tickFormatter={etiquetaX} {...ejeProps} />
                <YAxis allowDecimals={false} width={40} {...ejeProps} />
              </>
            )}
            <Tooltip cursor={{ fill: 'var(--superficie-2)' }} content={(p) => <Globo {...(p as TooltipContentProps<number, string>)} series={series} etiquetaX={etiquetaX} />} />
            {series.map((s, i) => (
              <Bar
                key={s.clave}
                dataKey={s.clave}
                name={s.etiqueta}
                fill={s.color}
                stackId={apilado ? 'a' : undefined}
                stroke="var(--superficie)"
                strokeWidth={apilado ? 1 : 0}
                maxBarSize={horizontal ? 18 : 36}
                radius={!apilado || i === series.length - 1 ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0}
                isAnimationActive={false}
                shape={
                  colorFila
                    ? (props: unknown) => {
                        const p = props as { x: number; y: number; width: number; height: number; payload: Dato };
                        return <rect x={p.x} y={p.y} width={Math.max(0, p.width)} height={Math.max(0, p.height)} rx={3} fill={colorFila(p.payload)} />;
                      }
                    : undefined
                }
              >
                {valores && <LabelList dataKey={s.clave} position={horizontal ? 'right' : 'top'} formatter={(v: unknown) => valores(Number(v))} style={{ fill: 'var(--texto-2)', fontSize: 12, fontWeight: 600 }} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function GraficaLineas({ datos, claveX, series, alto = 280, etiquetaX, dominioY, sufijoY = '' }: { datos: Dato[]; claveX: string; series: Serie[]; alto?: number; etiquetaX?: (v: string) => string; dominioY?: [number, number]; sufijoY?: string }) {
  return (
    <>
      {series.length > 1 && <Leyenda series={series} />}
      <div className="grafica" style={{ height: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--rejilla)" vertical={false} />
            <XAxis dataKey={claveX} tickFormatter={etiquetaX} minTickGap={24} {...ejeProps} />
            <YAxis allowDecimals={false} width={48} domain={dominioY} tickFormatter={(v) => `${v}${sufijoY}`} {...ejeProps} />
            <Tooltip cursor={{ stroke: 'var(--borde-fuerte)' }} content={(p) => <Globo {...(p as TooltipContentProps<number, string>)} series={series} etiquetaX={etiquetaX} />} />
            {series.map((s) => (
              <Line key={s.clave} type="linear" dataKey={s.clave} name={s.etiqueta} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--superficie)', strokeWidth: 2 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "2025-03" → "mar 2025" */
export const etiquetaMes = (v: string) => (/^\d{4}-\d{2}$/.test(v) ? `${MESES[Number(v.slice(5)) - 1]} ${v.slice(0, 4)}` : v);
