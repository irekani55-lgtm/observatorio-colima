import { Link } from 'react-router-dom';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { EnlaceExterno } from '../componentes/Fuente';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
import { PROYECTO } from '../config/proyecto';

/** Quién hace el Observatorio, cómo corregir un dato, cómo reutilizar los datos y qué pasa con la privacidad. */
export default function Acerca() {
  const correo = PROYECTO.correoContacto;
  return (
    <>
      <EncabezadoPagina titulo="¿Quién hace el Observatorio?">
        <p>
          El Observatorio Legislativo Colima es un proyecto ciudadano e independiente. <strong>No es un sitio oficial</strong> del H. Congreso del Estado de Colima, del Instituto Electoral del Estado de Colima ni de ningún gobierno.
        </p>
      </EncabezadoPagina>
      <Nuevo texto="página nueva: quién lo hace, cómo corregir un dato, uso de los datos y privacidad" />

      <section className={`seccion${claseNuevo()}`} aria-labelledby="acerca-reglas">
        <h2 id="acerca-reglas">Nuestras reglas</h2>
        <ul className="lista-reglas">
          <li>Solo usamos documentos oficiales, y cada número lleva a su documento.</li>
          <li>No calificamos a nadie ni hacemos rankings: mostramos cada dato por separado.</li>
          <li>No cambiamos el registro oficial. Si algo no cuadra, lo anotamos en la <Link to="/fuentes#bitacora">bitácora pública</Link> con su explicación.</li>
          <li>No recibimos dinero de partidos políticos, candidaturas, del Congreso ni de ninguna dependencia de gobierno. Si algún día recibimos apoyo, aquí diremos de quién y para qué.</li>
        </ul>
      </section>

      <section className={`seccion${claseNuevo()}`} aria-labelledby="acerca-corregir" id="corregir">
        <h2 id="acerca-corregir">¿Encontró un dato que no está bien?</h2>
        <p className="seccion__intro">Cualquier persona puede pedir una corrección, y las diputaciones y sus oficinas tienen derecho de réplica.</p>
        <ol className="lista-pasos">
          <li>Díganos qué dato es y en qué página lo vio (puede copiar la dirección de la página).</li>
          <li>Mándenos el documento oficial que muestra el dato correcto: un acta, una lista de asistencia o un acuerdo. Sin documento no podemos cambiar nada.</li>
          <li>Lo revisamos contra los documentos y le contestamos.</li>
          <li>Si el error fue nuestro, lo corregimos. Si el documento oficial dice otra cosa, lo anotamos en la bitácora con los dos documentos. En ambos casos queda registro público.</li>
        </ol>
        {correo ? (
          <p>
            Escríbanos a <a href={`mailto:${correo}`}>{correo}</a>.
          </p>
        ) : (
          <p className="texto-2">Pronto publicaremos aquí un correo para recibir correcciones.</p>
        )}
      </section>

      <section className={`seccion${claseNuevo()}`} aria-labelledby="acerca-datos">
        <h2 id="acerca-datos">¿Puedo usar estos datos?</h2>
        <p>
          Sí. Puede copiarlos, compartirlos y usarlos en sus trabajos, notas o investigaciones, siempre que diga de dónde salieron. Los datos se publican con la licencia{' '}
          <EnlaceExterno url={PROYECTO.licenciaDatos.url}>{PROYECTO.licenciaDatos.nombre}</EnlaceExterno>.
        </p>
        <p>
          Para citarlos, escriba: <em>{PROYECTO.cita}</em>
        </p>
        <p>
          Los archivos se descargan en <Link to="/fuentes">Fuentes, calidad y descargas</Link>.
          {PROYECTO.urlRepositorio && (
            <>
              {' '}El código y los datos también están en <EnlaceExterno url={PROYECTO.urlRepositorio}>su repositorio público</EnlaceExterno>.
            </>
          )}
        </p>
      </section>

      <section className={`seccion${claseNuevo()}`} aria-labelledby="acerca-privacidad">
        <h2 id="acerca-privacidad">Privacidad</h2>
        <ul className="lista-reglas">
          <li>La página no le pide datos personales, no usa cookies y no tiene herramientas de seguimiento ni publicidad.</li>
          <li>Cuando busca su número de sección o un nombre, la búsqueda se hace en su propio celular o computadora: no se envía a ningún lado.</li>
          <li>Solo se guarda en su navegador si eligió el modo claro u oscuro, para recordarlo la próxima vez.</li>
          <li>Como cualquier sitio web, el servicio donde se aloja la página puede registrar datos técnicos de cada visita, como la dirección de internet (IP).</li>
          <li>Las fichas solo muestran información pública de servidoras y servidores públicos en el ejercicio de su cargo.</li>
        </ul>
      </section>
    </>
  );
}
