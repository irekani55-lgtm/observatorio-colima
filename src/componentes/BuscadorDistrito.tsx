import { useEffect, useState } from 'react';
import { LEGISLATURA } from '../config/legislatura';
import type { Diputado } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { Aviso } from './Aviso';
import { etiquetaSuplencia } from './FichaDiputado';
import { EnlaceExterno } from './Fuente';
import { EnlaceDip } from './TablasRegistros';

type Situacion = 'igual' | 'cambio_distrito' | 'nueva' | 'sin_casilla_2024' | 'solo_2024';

interface Seccion {
  seccion: number;
  /** Distrito en la cartografía vigente del INE (vacío si la sección ya no existe). */
  distrito: number | null;
  municipio: string;
  /** Distrito en que votó la sección en la elección de 2024 (PREP del IEE). */
  distrito2024: number | null;
  situacion: Situacion;
}

/** Nombres con acentos de los 10 municipios (la cartografía del INE los trae en mayúsculas y sin acentos). */
const MUNICIPIOS: Record<string, string> = {
  ARMERIA: 'Armería',
  COLIMA: 'Colima',
  COMALA: 'Comala',
  COQUIMATLAN: 'Coquimatlán',
  CUAUHTEMOC: 'Cuauhtémoc',
  IXTLAHUACAN: 'Ixtlahuacán',
  MANZANILLO: 'Manzanillo',
  MINATITLAN: 'Minatitlán',
  TECOMAN: 'Tecomán',
  'VILLA DE ALVAREZ': 'Villa de Álvarez',
};

function useSecciones() {
  const [estado, setEstado] = useState<{ cargando: boolean; secciones: Map<number, Seccion> }>({ cargando: true, secciones: new Map() });
  useEffect(() => {
    let vivo = true;
    fetch(`${import.meta.env.BASE_URL}geo/secciones_distrito.csv`)
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '')
      .then((t) => {
        const m = new Map<number, Seccion>();
        const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);
        for (const linea of t.trim().split(/\r?\n/).slice(1)) {
          const [s, d, mun, d24, sit] = linea.split(',');
          const seccion = num(s);
          if (seccion == null || (num(d) == null && num(d24) == null)) continue;
          m.set(seccion, { seccion, distrito: num(d), municipio: MUNICIPIOS[mun ?? ''] ?? mun ?? '', distrito2024: num(d24), situacion: (sit || 'igual') as Situacion });
        }
        if (vivo) setEstado({ cargando: false, secciones: m });
      });
    return () => {
      vivo = false;
    };
  }, []);
  return estado;
}

/** Quien ejerce hoy la curul del distrito (sin fecha de fin), o la persona más reciente. */
function enFuncionesHoy(lista: Diputado[]): Diputado | undefined {
  return lista.find((d) => !d.fecha_fin) ?? [...lista].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0];
}

/**
 * «¿En qué distrito vivo?»: la persona escribe la sección electoral de su credencial para votar y obtiene su
 * distrito local y quién la representa. `clave` es el parámetro de la URL del mapa que se selecciona.
 */
export function BuscadorDistrito({ clave = 'distrito' }: { clave?: string }) {
  const { base } = useDatos();
  const [, , , fijar] = useFiltro();
  const { cargando, secciones } = useSecciones();
  const [texto, setTexto] = useState('');
  const [buscado, setBuscado] = useState<string | null>(null);

  if (!cargando && secciones.size === 0) return null;
  const numero = buscado && /^\d{1,4}$/.test(buscado) ? Number(buscado) : null;
  const hallada = numero != null ? secciones.get(numero) : undefined;
  // El diputado de la persona es el del distrito en que votó su sección en 2024; si la sección es posterior, el vigente.
  const distritoRep = hallada ? (hallada.distrito2024 ?? hallada.distrito) : null;
  const titulares = distritoRep ? base.diputados.filter((d) => d.tipo_representacion === 'MR' && d.distrito === distritoRep) : [];
  const actual = enFuncionesHoy(titulares);
  const dist = distritoRep ? base.distritos.find((x) => x.distrito === distritoRep) : undefined;
  return (
    <div className="panel" style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '1.05rem', marginTop: 0 }}>¿En qué distrito vivo?</h3>
      <p className="pequeno texto-2">
        Busque la palabra <strong>SECCIÓN</strong> al frente de su credencial para votar y escriba ese número.
      </p>
      <form
        className="fila-flex"
        role="search"
        aria-label="Buscar distrito por sección electoral"
        onSubmit={(e) => {
          e.preventDefault();
          setBuscado(texto.trim().replace(/^0+(?=\d)/, ''));
        }}
      >
        <div className="campo" style={{ maxWidth: 180 }}>
          <label htmlFor="buscar-seccion">Número de sección</label>
          <input id="buscar-seccion" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))} placeholder="0123" />
        </div>
        <button type="submit" className="boton boton--primario" style={{ alignSelf: 'flex-end' }} disabled={cargando || !texto}>
          Buscar
        </button>
      </form>

      <div aria-live="polite">
        {buscado != null && numero == null && <Aviso tipo="alerta">Escriba solo números (hasta cuatro).</Aviso>}
        {numero != null && !hallada && (
          <Aviso tipo="alerta" titulo={`No encontramos la sección ${String(numero).padStart(4, '0')}`}>
            Revise el número en su credencial. También puede buscarlo en el <EnlaceExterno url="https://ubicatucasilla.ine.mx/">sitio del INE</EnlaceExterno>.
          </Aviso>
        )}
        {hallada && distritoRep && (
          <div style={{ marginTop: '0.75rem' }}>
            <p className="dato-claro">
              Su distrito es el <strong>{distritoRep}</strong>
              {dist?.cabecera && <> ({dist.cabecera})</>}.
            </p>
            {actual ? (
              <p className="dato-claro">
                Quien le representa en el Congreso: <EnlaceDip id={actual.id_diputado} />
                {etiquetaSuplencia(actual) && <span className="texto-3"> ({etiquetaSuplencia(actual)})</span>}.
              </p>
            ) : (
              <p className="texto-3">No hay una diputación registrada para este distrito.</p>
            )}
            {hallada.situacion === 'cambio_distrito' && (
              <Aviso tipo="alerta" titulo="Su sección cambió de distrito">
                En 2024 votó en el distrito {hallada.distrito2024}. En la próxima elección votará en el distrito {hallada.distrito}.
              </Aviso>
            )}
            {hallada.situacion === 'solo_2024' && (
              <Aviso titulo="Este número de sección ya no existe">
                Se dividió en secciones nuevas después de 2024. Si su credencial es nueva, puede tener otro número.
              </Aviso>
            )}
            <p className="fila-flex">
              <button
                type="button"
                className="boton"
                onClick={() => {
                  fijar({ persona: undefined, [clave]: String(distritoRep) });
                  requestAnimationFrame(() => document.querySelector('[aria-label="Ficha del distrito seleccionado"]')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
                }}
              >
                Ver qué ha hecho
              </button>
            </p>
            <p className="pequeno">
              Además, le representan <strong>{LEGISLATURA.integracion.RP} diputaciones de todo el estado</strong>.{' '}
              <button
                type="button"
                className="boton boton--fantasma boton--chico"
                onClick={() => document.getElementById(`${clave === 'distrito' ? 'rp' : `${clave}_rp`}-titulo`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}
              >
                Ver quiénes son
              </button>
            </p>
            <p className="muy-pequeno texto-3">Fuentes: INE e IEE Colima.</p>
          </div>
        )}
      </div>
    </div>
  );
}
