import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LEGISLATURA } from '../config/legislatura';
import type { Diputado } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { Aviso } from './Aviso';
import { EnlaceExterno } from './Fuente';
import { EnlaceDip } from './TablasRegistros';

interface Seccion {
  seccion: number;
  distrito: number;
  municipio: string;
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
        for (const linea of t.trim().split(/\r?\n/).slice(1)) {
          const [s, d, mun] = linea.split(',');
          if (/^\d+$/.test(s ?? '') && /^\d+$/.test(d ?? '')) m.set(Number(s), { seccion: Number(s), distrito: Number(d), municipio: MUNICIPIOS[mun ?? ''] ?? mun ?? '' });
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
  const titulares = hallada ? base.diputados.filter((d) => d.tipo_representacion === 'MR' && d.distrito === hallada.distrito) : [];
  const actual = enFuncionesHoy(titulares);
  const dist = hallada ? base.distritos.find((x) => x.distrito === hallada.distrito) : undefined;

  return (
    <div className="panel" style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '1.05rem', marginTop: 0 }}>¿En qué distrito vivo?</h3>
      <p className="pequeno texto-2">
        Escriba el número de <strong>sección</strong> que aparece al frente de su credencial para votar del INE (cuatro dígitos, por ejemplo 0123).
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
          <label htmlFor="buscar-seccion">Sección electoral</label>
          <input id="buscar-seccion" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" value={texto} onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))} placeholder="0123" />
        </div>
        <button type="submit" className="boton boton--primario" style={{ alignSelf: 'flex-end' }} disabled={cargando || !texto}>
          Buscar
        </button>
      </form>

      <div aria-live="polite">
        {buscado != null && numero == null && <Aviso tipo="alerta">Escriba solo el número de sección (hasta cuatro dígitos).</Aviso>}
        {numero != null && !hallada && (
          <Aviso tipo="alerta" titulo={`No encontramos la sección ${String(numero).padStart(4, '0')}`}>
            Revise el número en su credencial. Las secciones de Colima van de la 0002 a la 0446 en la cartografía vigente del INE; algunas se renumeraron en ajustes recientes. También puede consultar su ubicación en el <EnlaceExterno url="https://ubicatucasilla.ine.mx/">sitio del INE</EnlaceExterno>.
          </Aviso>
        )}
        {hallada && (
          <div style={{ marginTop: '0.75rem' }}>
            <p>
              La sección <strong className="num">{String(hallada.seccion).padStart(4, '0')}</strong> ({hallada.municipio}) pertenece al <strong>distrito electoral local {hallada.distrito}</strong>
              {dist?.cabecera && <> (cabecera: {dist.cabecera})</>}.
            </p>
            {actual ? (
              <p>
                Su diputada o diputado de mayoría relativa: <EnlaceDip id={actual.id_diputado} />
                {actual.calidad === 'suplente' && <span className="texto-3"> (suplente en funciones)</span>}.
              </p>
            ) : (
              <p className="texto-3">No hay una diputación registrada para este distrito.</p>
            )}
            <p className="fila-flex">
              <button type="button" className="boton" onClick={() => fijar({ persona: undefined, [clave]: String(hallada.distrito) })}>
                Ver su ficha en el mapa
              </button>
            </p>
            <p className="muy-pequeno texto-3">
              Además, las {LEGISLATURA.integracion.RP} diputaciones de <Link to="/representacion-proporcional">representación proporcional</Link> representan a todo el estado. Sección y distrito según la cartografía vigente del INE (Base Geográfica Digital, enero 2026).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
