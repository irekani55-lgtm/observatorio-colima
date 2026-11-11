import { Link } from 'react-router-dom';
import { EnlaceExterno } from '../componentes/Fuente';
import { PERIODOS_SESION, etiquetaDe } from '../config/catalogos';
import { useDatos } from '../estado/DatosContext';
import { fechaCorta } from '../indicadores/filtro';

/** Constitución Política del Estado Libre y Soberano de Colima, versión publicada por el Congreso del Estado. */
export const CONSTITUCION_COLIMA = {
  url: 'https://congresocol.gob.mx/web/Sistema/uploads/LegislacionEstatal/Constitucion/Constitucion_17sept2022.pdf',
  nota: 'Versión publicada por el Congreso del Estado; última reforma registrada en ese archivo: Decreto 163, 17 de septiembre de 2022.',
};

/** Qué le toca a la gobernadora según la Constitución de Colima, en palabras sencillas y con sus artículos. */
export function ExplicacionGobernadora() {
  return (
    <div className="pequeno">
      <p>
        La gobernadora encabeza el gobierno del estado. La Constitución de Colima le da derecho a <strong>proponer leyes al Congreso</strong>, igual que a las diputaciones, a los ayuntamientos, al Supremo Tribunal de Justicia y a los órganos
        autónomos (artículo 39, fracción II). Por eso muchas propuestas vienen de ella: el Congreso decide si las aprueba.
      </p>
      <p>Entre lo que le toca hacer (artículo 58), por ejemplo:</p>
      <ul>
        <li>Publicar y aplicar las leyes que aprueba el Congreso (fracción III).</li>
        <li>Mandar cada año al Congreso, a más tardar el 31 de octubre, cuánto dinero espera recibir el estado y en qué lo va a gastar (fracción XIX).</li>
        <li>Cuidar que el dinero público se maneje conforme a las leyes y presentar cada año las cuentas del gobierno al Congreso (fracciones XXI y XXII).</li>
        <li>Dirigir y fomentar la educación pública y procurar que mejore la vida de la gente en todos los sentidos (fracción XXIII).</li>
        <li>Organizar la planeación del desarrollo del estado, con participación ciudadana y consulta popular (fracción XLI).</li>
        <li>Promover el desarrollo económico, social y cultural del estado (fracción XLII).</li>
      </ul>
      <p>
        También tiene límites: por ejemplo, no puede negarse a publicar las leyes del Congreso salvo en los casos que marca la Constitución, ni usar el dinero público para algo distinto de lo que dice la ley (artículo 59).
      </p>
      <p className="muy-pequeno texto-3">
        Fuente: <EnlaceExterno url={CONSTITUCION_COLIMA.url}>Constitución Política del Estado Libre y Soberano de Colima</EnlaceExterno>, artículos 39, 58 y 59. {CONSTITUCION_COLIMA.nota}
      </p>
    </div>
  );
}

/** Explicación sencilla de un exhorto que el acta no dice si se aprobó, con el texto exacto del acta y su enlace. */
export function ExhortoSinResultado({ id }: { id: string }) {
  const { base } = useDatos();
  const a = base.idx.asunto.get(id);
  if (!a) return null;
  const autores = a.promoventes
    .filter((p) => p.rol === 'autor' || p.rol === 'coautor')
    .map((p) => (p.id_diputado ? base.idx.diputado.get(p.id_diputado)?.nombre_completo ?? p.id_diputado : p.promovente_externo))
    .filter(Boolean);
  const obs = base.observaciones.find((o) => o.id_registro === id);
  const sesion = base.sesiones.find((s) => s.fecha === a.fecha_presentacion && s.tipo_sesion === 'ordinaria') ?? base.sesiones.find((s) => s.fecha === a.fecha_presentacion);
  // Resumen a partir del texto del acta: lo que se pide, sin la fórmula «dio lectura a un Punto de Acuerdo para exhortar a que».
  const pide = (a.descripcion || a.titulo)
    .replace(/^.*?para\s+exhortar\s+(a\s+)?(que\s+)?/i, '')
    .replace(/\s+y\s+a\s+la\s+/i, ' y la ')
    .replace(/,\s+(mantengan|realicen|atiendan|revisen|implementen|garanticen|informen)\b/i, ' $1')
    .replace(/\.$/, '');
  // Una sola idea: se corta antes de las aclaraciones largas («, incluso…», «, para garantizar…»).
  const corte = pide.slice(60).search(/,\s+(incluso|para|con el fin|a fin)\b/i);
  const pideCorto = corte >= 0 ? pide.slice(0, 60 + corte) : pide;
  return (
    <section style={{ marginTop: '0.75rem' }}>
      <p>
        <strong>De qué trataba:</strong> {autores.length ? autores.join(', ') : 'Se'} pidió que {pideCorto.charAt(0).toLowerCase() + pideCorto.slice(1)}.
      </p>
      <p>
        <strong>Qué significa que no tenga resultado:</strong> el acta de la sesión solo dice que la propuesta se leyó. No dice si se votó, si se aprobó, si se mandó a una comisión para estudiarla o si se retiró. Por eso no podemos decir si se
        aprobó o no.
        {obs?.descripcion.includes('taquigrafía') && <> Según el área de taquigrafía del Congreso, este tipo de exhortos se resuelve en la misma sesión, pero el acta no lo anota.</>}
      </p>
      <p>
        <strong>Fecha de la sesión:</strong> {fechaCorta(a.fecha_presentacion)}
        {sesion?.numero_sesion != null && (
          <>
            {' '}
            (sesión {sesion.tipo_sesion === 'ordinaria' ? 'ordinaria' : sesion.tipo_sesion} número {sesion.numero_sesion}, {etiquetaDe(PERIODOS_SESION, sesion.periodo).toLowerCase()})
          </>
        )}
        .
      </p>
      <p>
        <strong>Lo que dice el acta</strong>, en la parte de «Asuntos generales»:
      </p>
      <blockquote>{a.descripcion || a.titulo}</blockquote>
      {a.url_ficha && (
        <p>
          <EnlaceExterno url={a.url_ficha}>Ver el acta original</EnlaceExterno>
          <span className="muy-pequeno texto-3"> (archivo de Word del Congreso; busque el párrafo de arriba en «Asuntos generales»)</span>
        </p>
      )}
      {obs && (
        <p className="muy-pequeno texto-3">
          Está anotado en la <Link to="/fuentes#bitacora">bitácora de observaciones</Link> ({obs.id_observacion}).
        </p>
      )}
    </section>
  );
}
