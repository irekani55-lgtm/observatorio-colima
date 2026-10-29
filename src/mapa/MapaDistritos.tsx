import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { CONFIG_MAPA } from '../config/mapa';
import { Aviso } from '../componentes/Aviso';
import { EnlaceExterno } from '../componentes/Fuente';
import { IcoInfo } from '../componentes/Iconos';
import { esquemaHexagonal, mapaDesdeGeojson, type Mapa } from './geometria';

type EstadoCarga = { tipo: 'cargando' } | { tipo: 'oficial'; mapa: Mapa } | { tipo: 'esquema'; mapa: Mapa; motivo: string };

async function leerJson(url: string): Promise<FeatureCollection | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const t = await r.text();
    if (/^\s*</.test(t)) return null; // el servidor devolvió HTML (archivo inexistente)
    const j = JSON.parse(t) as FeatureCollection;
    return j?.type === 'FeatureCollection' && Array.isArray(j.features) ? j : null;
  } catch {
    return null;
  }
}

/** Carga la cartografía oficial o, si no existe, el esquema de respaldo. */
export function useCartografia(): EstadoCarga {
  const [estado, setEstado] = useState<EstadoCarga>({ tipo: 'cargando' });
  useEffect(() => {
    let vivo = true;
    (async () => {
      const base = import.meta.env.BASE_URL;
      const fc = await leerJson(`${base}${CONFIG_MAPA.archivoDistritos}`);
      if (!vivo) return;
      if (!fc || fc.features.length === 0) {
        setEstado({ tipo: 'esquema', mapa: esquemaHexagonal(), motivo: `No se encontró el archivo ${CONFIG_MAPA.archivoDistritos}.` });
        return;
      }
      const contorno = await leerJson(`${base}${CONFIG_MAPA.archivoEstado}`);
      try {
        setEstado({ tipo: 'oficial', mapa: mapaDesdeGeojson(fc, CONFIG_MAPA.propiedadesDistrito, CONFIG_MAPA.encuadre, contorno ?? undefined) });
      } catch (e) {
        setEstado({ tipo: 'esquema', mapa: esquemaHexagonal(), motivo: `No se pudo procesar la cartografía: ${e instanceof Error ? e.message : String(e)}` });
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);
  return estado;
}

interface Props {
  mapa: Mapa;
  seleccionado: number | null;
  onSeleccionar: (d: number) => void;
  etiquetaDistrito?: (d: number) => string;
  titulo: string;
}

/**
 * Lienzo SVG del mapa. Cada distrito es un control accesible: se activa con
 * clic, toque, Enter o Espacio. El cursor resalta y muestra el número.
 */
export function LienzoMapa({ mapa, seleccionado, onSeleccionar, etiquetaDistrito, titulo }: Props) {
  const [hover, setHover] = useState<{ d: number; x: number; y: number } | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  function mover(e: React.PointerEvent, d: number) {
    if (e.pointerType !== 'mouse' || !caja.current) return; // en táctil no hay "hover"
    const r = caja.current.getBoundingClientRect();
    setHover({ d, x: e.clientX - r.left, y: e.clientY - r.top });
  }

  // El distrito seleccionado se dibuja al final para que su borde quede encima.
  const formas = [...mapa.formas].sort((a, b) => Number(a.distrito === seleccionado) - Number(b.distrito === seleccionado));

  return (
    <div className="mapa-lienzo" ref={caja} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${mapa.ancho} ${mapa.alto}`} role="group" aria-label={titulo}>
        <title>{titulo}</title>
        {formas.map((f) => {
          const sel = f.distrito === seleccionado;
          const nombre = etiquetaDistrito?.(f.distrito) ?? `Distrito ${f.distrito}`;
          return (
            <path
              key={`${f.distrito}-${f.d.length}`}
              d={f.d}
              className={`mapa-forma${sel ? ' seleccionado' : ''}${hover?.d === f.distrito ? ' hover' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={nombre}
              aria-pressed={sel}
              data-distrito={f.distrito}
              onPointerMove={(e) => mover(e, f.distrito)}
              onPointerEnter={(e) => mover(e, f.distrito)}
              onClick={() => onSeleccionar(f.distrito)}
              onFocus={() => setHover(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSeleccionar(f.distrito);
                }
              }}
            />
          );
        })}
        {mapa.contorno && <path d={mapa.contorno} className="mapa-contorno" aria-hidden="true" />}
        {mapa.formas.map((f) => (
          <text key={`t-${f.distrito}-${f.d.length}`} x={f.centro[0]} y={f.centro[1]} style={{ fontSize: Math.max(13, mapa.ancho / 48) }} className={`mapa-etiqueta${f.distrito === seleccionado ? ' seleccionado' : ''}`} aria-hidden="true">
            {f.distrito}
          </text>
        ))}
      </svg>
      {hover && (
        <div className="mapa-tooltip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
          {etiquetaDistrito?.(hover.d) ?? `Distrito ${hover.d}`}
        </div>
      )}
    </div>
  );
}

/** Rótulo de origen bajo el mapa: oficial o esquema. */
export function SelloMapa({ estado }: { estado: EstadoCarga }) {
  if (estado.tipo === 'oficial') {
    const f = CONFIG_MAPA.fuente;
    return (
      <>
        <p className="mapa-sello">
          <IcoInfo width={14} height={14} />
          <span>
            Fuente: <EnlaceExterno url={f.url}>{f.nombre}</EnlaceExterno>, {f.institucion}. {f.distritacion}.{!estado.mapa.geografico && ' Coordenadas proyectadas.'} Las islas Revillagigedo quedan fuera del encuadre.
          </span>
        </p>
        {!f.verificado && <p className="mapa-sello">Metadatos de la cartografía pendientes de confirmar contra la fuente oficial.</p>}
        {estado.mapa.advertencias.map((a) => (
          <Aviso key={a} tipo="alerta">
            {a}
          </Aviso>
        ))}
      </>
    );
  }
  if (estado.tipo === 'esquema')
    return (
      <Aviso tipo="alerta" titulo="Esquema no geográfico">
        <p>
          Cada hexágono representa un distrito electoral local, ordenados por número. <strong>No muestra límites, forma, tamaño ni ubicación de los distritos.</strong> {estado.motivo}
        </p>
        <p>
          Para mostrar el mapa real, coloque la cartografía oficial del IEE Colima en <code>public/{CONFIG_MAPA.archivoDistritos}</code> (instrucciones en <code>public/geo/LEEME.md</code>).
        </p>
      </Aviso>
    );
  return null;
}
