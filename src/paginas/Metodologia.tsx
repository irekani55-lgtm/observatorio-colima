import { EncabezadoPagina, NOTA_PUBLICA } from '../componentes/Disposicion';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
import { InsigniaCatalogo } from '../componentes/Insignia';
import {
  ESTADOS_ASISTENCIA,
  ESTADOS_PROCESALES,
  ESTADOS_VERIFICACION,
  ETAPAS_POR_TIPO,
  SEGUIMIENTO_COMPROMISO,
  SEGUIMIENTO_EXHORTO,
  SENTIDOS_VOTO,
  TIPOS_ASUNTO,
  etiquetaDe,
  type EntradaCatalogo,
} from '../config/catalogos';
import { ANIOS_LEGISLATIVOS, LEGISLATURA } from '../config/legislatura';
import { ESQUEMA, NOMBRES_TABLAS } from '../datos/esquema';
import { useDatos } from '../estado/DatosContext';
import { fechaCorta } from '../indicadores/filtro';
import { REGLAS_ALCANCE } from '../indicadores/clasificacion';
import { UMBRAL_DIVIDIDA } from '../indicadores/votaciones';

const INDICADORES: { nombre: string; mide: string; calculo: string; denominador: string; faltantes: string }[] = [
  {
    nombre: 'Asistencia a las sesiones',
    mide: 'En cuántas sesiones estuvo cada persona.',
    calculo: 'Sesiones en que asistió ÷ sesiones que le tocaban, por cien.',
    denominador: 'Las sesiones en que estaba en el cargo, con la lista oficial: asistió, faltó con permiso o faltó sin permiso.',
    faltantes: 'Si no tenemos la lista de una sesión, no la contamos como falta: la dejamos fuera y avisamos que el porcentaje todavía puede cambiar.',
  },
  {
    nombre: 'Propuestas de ley presentadas y aprobadas',
    mide: 'Cuántas propuestas firmó cada persona y cuántas aprobó el Congreso.',
    calculo: 'Contamos cada propuesta una sola vez. «Aprobada» quiere decir que el Congreso la aprobó (y, en su caso, ya se publicó).',
    denominador: 'Para el porcentaje: las propuestas presentadas en el mismo periodo.',
    faltantes: 'Si no sabemos quién firmó una propuesta, no se la contamos a nadie.',
  },
  {
    nombre: 'Exhortos presentados y aprobados',
    mide: 'Cuántas peticiones a otras autoridades propuso cada persona y cuántas aprobó el Congreso.',
    calculo: 'Contamos cada exhorto una sola vez. En la ficha de cada persona solo cuentan los que ya revisamos.',
    denominador: 'Los exhortos presentados en el periodo.',
    faltantes: 'Si el acta no dice quién lo propuso, aparece como «por revisar».',
  },
  {
    nombre: '¿Respondió la autoridad a un exhorto?',
    mide: 'Qué pasó después de aprobar un exhorto: si se envió, si la autoridad respondió o hizo algo.',
    calculo: 'Revisamos en orden: si no se aprobó, si falta revisar, si hubo acciones, si hubo respuesta o si no la encontramos.',
    denominador: 'Los exhortos aprobados.',
    faltantes: 'Nunca decimos que una autoridad «no cumplió»: si no encontramos respuesta, solo decimos eso.',
  },
  {
    nombre: 'Leyes publicadas (decretos)',
    mide: 'Cuántas decisiones del Congreso se publicaron en el periódico oficial del estado y ya están vigentes.',
    calculo: 'Contamos cada número de decreto una sola vez, para no contar dos veces la propuesta, la opinión de la comisión y la ley publicada.',
    denominador: 'No se compara: es un conteo.',
    faltantes: 'Si algo se aprobó pero no tiene fecha de publicación, no lo contamos como publicado.',
  },
  {
    nombre: 'Propuestas sin resolver',
    mide: 'Cuántas propuestas siguen esperando una decisión.',
    calculo: 'Las que se presentaron, están en comisión, ya tienen opinión de comisión o siguen sin resolver.',
    denominador: 'Las propuestas del periodo.',
    faltantes: 'Las que no sabemos en qué van se cuentan aparte.',
  },
  {
    nombre: 'Cuánto tarda una propuesta',
    mide: 'Cuántos días pasan entre que se presenta, se manda a comisión, la comisión opina y se aprueba.',
    calculo: 'Usamos la mediana: el valor del medio si se ordenan todos los casos. Así un caso muy lento no cambia todo el resultado.',
    denominador: 'Solo las propuestas que tienen las dos fechas; siempre decimos cuántas son.',
    faltantes: 'Las que todavía no se resuelven no tienen fecha final y quedan fuera; por eso el número tiende a mostrar las más rápidas.',
  },
  {
    nombre: 'Veces que habló ante el Congreso',
    mide: 'Cuántas veces cada persona pasó al frente (la tribuna) a hablar, según el documento donde se escribe todo lo que se dice en las sesiones.',
    calculo: 'Contamos cada vez que habló.',
    denominador: 'No se compara: es un conteo.',
    faltantes: 'Si de una sesión no está ese documento, no aparecen sus intervenciones. No mide qué tan buenos fueron sus argumentos.',
  },
  {
    nombre: 'Cómo votó cada persona',
    mide: 'Cómo votó cada persona, cuando el acta lo dice con su nombre.',
    calculo: 'Contamos los votos a favor, en contra y abstenciones. Comparamos los nombres del acta con el total que anunció quien dirige la sesión.',
    denominador: 'Los votos que el acta anota con nombre.',
    faltantes: 'Si el acta no lo dice, aparece «El acta no dice cómo votó». Nunca lo deducimos por su partido ni por el resultado.',
  },
  {
    nombre: 'Comisiones',
    mide: 'Cuántas propuestas recibió cada comisión, cuántas revisó y cuántas le faltan; sus reuniones y quién asistió.',
    calculo: 'Si una propuesta se mandó a dos comisiones, cuenta en cada una; en el total del Congreso cuenta una sola vez.',
    denominador: 'Las propuestas que recibió la comisión en el periodo.',
    faltantes: 'Si no encontramos el acta de una reunión, no quiere decir que no se reunió.',
  },
  {
    nombre: 'Datos con documento',
    mide: 'Qué parte de los datos tiene un documento oficial que lo respalda, con su enlace.',
    calculo: 'Datos con un documento enlazado ÷ todos los datos, por cien.',
    denominador: 'Todos los datos de diputaciones, sesiones, asistencias, propuestas, intervenciones, votaciones, reuniones, compromisos y agenda.',
    faltantes: 'Un enlace puede dejar de funcionar después de la fecha en que lo consultamos.',
  },
];

function Catalogo({ catalogo }: { catalogo: Record<string, EntradaCatalogo> }) {
  return (
    <dl className="definiciones">
      {Object.entries(catalogo).map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{v.tono ? <InsigniaCatalogo catalogo={catalogo} valor={k} /> : v.etiqueta}</dt>
          <dd>
            {v.descripcion}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function Metodologia() {
  const { base } = useDatos();
  return (
    <>
      <EncabezadoPagina titulo="¿Cómo calculamos cada dato?">
        <p className={claseNuevo()}>
          Aquí explicamos de dónde sale cada número, qué cuenta y qué no, y sus límites. Es la parte más detallada del Observatorio, pensada para quien quiere comprobar los cálculos.
          <Nuevo texto="en palabras sencillas" />
        </p>
      </EncabezadoPagina>
      <p className="nota-publica">{NOTA_PUBLICA}</p>

      <section className={`seccion${claseNuevo()}`}>
        <h2>¿Qué periodo cubren los datos?</h2>
        <p>
          Esta Legislatura va de {LEGISLATURA.periodo}. Los datos llegan hasta el <strong>{base.manifiesto.fecha_corte ? fechaCorta(base.manifiesto.fecha_corte) : '(sin definir)'}</strong>. Puede elegir ver todo o un solo año:
        </p>
        <ul>
          {ANIOS_LEGISLATIVOS.anios.map((a) => (
            <li key={a.numero}>
              {a.etiqueta}: {fechaCorta(a.inicio)} a {fechaCorta(a.fin)}
            </li>
          ))}
        </ul>
        <details className="saber-mas">
          <summary>Saber más</summary>
          <p className="pequeno">
            Cada sesión lleva anotado su año, porque la numeración de las sesiones empieza de nuevo cada año. Las propuestas y las intervenciones se ubican por su fecha. Si algo no tiene fecha, solo aparece cuando se ve toda la Legislatura.
            {!ANIOS_LEGISLATIVOS.verificado && ' Las fechas de inicio y fin de cada año todavía están por confirmar con la ley del Congreso.'}
          </p>
        </details>
        <Nuevo texto="en palabras sencillas" />
      </section>

      <section className="seccion">
        <h2>Cómo calculamos cada número</h2>
        <p className="seccion__intro">Toque un tema para ver qué dice el número, cómo lo contamos y qué pasa si falta información.</p>
        {INDICADORES.map((i) => (
          <details className="desplegable" key={i.nombre}>
            <summary>{i.nombre}</summary>
            <dl className="definiciones" style={{ marginTop: '0.6rem' }}>
              <dt>¿Qué dice este número?</dt>
              <dd>{i.mide}</dd>
              <dt>¿Cómo lo contamos?</dt>
              <dd>{i.calculo}</dd>
              <dt>¿Contra qué lo comparamos?</dt>
              <dd>{i.denominador}</dd>
              <dt>¿Y si falta información?</dt>
              <dd>{i.faltantes}</dd>
            </dl>
          </details>
        ))}
      </section>

      <section className={`seccion${claseNuevo()}`}>
        <h2>¿Cómo contamos una propuesta que firmaron varias personas?</h2>
        <ul>
          <li>Cada propuesta aparece una sola vez en el Observatorio, aunque la hayan firmado varias personas o se haya mandado a varias comisiones.</li>
          <li>Si la firmó una sola persona, es una propuesta <strong>sola</strong>; si la firmaron dos o más, es <strong>con otras personas</strong>. Quien se suma después de presentada se muestra, pero no cuenta como autora.</li>
          <li>En la ficha de cada persona, una propuesta compartida cuenta para cada quien la firmó. En el total del Congreso cuenta una sola vez. Por eso, si suma las fichas, le dará más que el total.</li>
          <li>Las propuestas que mandan la gobernadora, los ayuntamientos o la ciudadanía cuentan en el total del Congreso, pero no se le cuentan a ninguna diputación.</li>
          <li>Si elige un partido, aparecen las propuestas en las que firmó al menos una persona de ese partido.</li>
        </ul>
        <Nuevo texto="en palabras sencillas" />
      </section>

      <section className="seccion" id="clasificacion-propuestas">
        <h2>¿Cómo separamos las propuestas de ley?</h2>
        <p className="seccion__intro">
          No todas las propuestas de ley pesan igual. Muchas son trámites que el Congreso aprueba cada año para los municipios. Para que no se confundan con los cambios de fondo, las separamos en tres grupos según palabras de su título y su descripción. Es una regla automática: puede equivocarse en casos raros, y el documento oficial siempre está a un clic.
        </p>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Grupo</th>
                <th scope="col">Qué incluye</th>
              </tr>
            </thead>
            <tbody>
              {REGLAS_ALCANCE.map((r) => (
                <tr key={r.nombre}>
                  <td>{r.alcance === 'tramite' ? 'Trámite' : 'Reconocimiento o fecha conmemorativa'}</td>
                  <td>{r.nombre}</td>
                </tr>
              ))}
              <tr>
                <td>Cambio de fondo</td>
                <td>Todas las demás: leyes nuevas, reformas a leyes y a la Constitución del Estado.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="seccion" id="votaciones-divididas">
        <h2>Votaciones divididas</h2>
        <p>
          Llamamos <strong>votación dividida</strong> a una votación con nombres en el acta en la que, según los totales del acta, al menos {UMBRAL_DIVIDIDA} diputaciones votaron a favor y al menos {UMBRAL_DIVIDIDA} votaron en contra o se abstuvieron. La mayoría de las votaciones del Congreso son por unanimidad o casi; en las divididas se ve mejor la postura de cada persona. Solo contamos votos escritos con nombre en el acta; los votos probables nunca se suman.
        </p>
      </section>

      <section className={`seccion${claseNuevo()}`}>
        <h2>¿En qué paso va una propuesta?</h2>
        <p className="seccion__intro">Estos son los pasos que puede tener una propuesta, desde que llega al Congreso hasta que se publica.</p>
        <Catalogo catalogo={ESTADOS_PROCESALES} />
        <details className="saber-mas">
          <summary>Saber más: los pasos de cada tipo de propuesta</summary>
          <ul className="pequeno">
            {Object.entries(ETAPAS_POR_TIPO).map(([t, e]) => (
              <li key={t}>
                <strong>{etiquetaDe(TIPOS_ASUNTO, t)}</strong>: {TIPOS_ASUNTO[t as keyof typeof TIPOS_ASUNTO].descripcion} Pasos posibles: {e.map((x) => etiquetaDe(ESTADOS_PROCESALES, x).toLowerCase()).join(', ')}.
              </li>
            ))}
          </ul>
          <p className="pequeno">No todas las propuestas siguen los mismos pasos. Si un dato dice que una propuesta está en un paso que no le corresponde, nuestra revisión automática lo marca como error.</p>
        </details>
        <Nuevo texto="en palabras sencillas" />
      </section>

      <section className="seccion rejilla rejilla--2">
        <div className="panel">
          <h3>¿Asistió?</h3>
          <Catalogo catalogo={ESTADOS_ASISTENCIA} />
        </div>
        <div className="panel">
          <h3>¿Respondió la autoridad a un exhorto?</h3>
          <Catalogo catalogo={SEGUIMIENTO_EXHORTO} />
        </div>
        <div className="panel">
          <h3>Cómo votó</h3>
          <Catalogo catalogo={SENTIDOS_VOTO} />
        </div>
        <div className="panel">
          <h3>¿Cumplió lo que prometió?</h3>
          <Catalogo catalogo={SEGUIMIENTO_COMPROMISO} />
        </div>
      </section>

      <section className={`seccion${claseNuevo()}`}>
        <h2>¿Cómo revisamos los datos?</h2>
        <ol>
          <li>Cada dato lleva el documento oficial de donde salió, con su enlace y la fecha en que lo consultamos.</li>
          <li>Usamos primero documentos oficiales: el sitio del Congreso, la Gaceta Parlamentaria (donde el Congreso publica sus documentos), las actas, el portal de transparencia, el periódico oficial del estado y el Instituto Electoral del Estado de Colima. Las noticias nos sirven como pista, nunca como única prueba.</li>
          <li>Un dato está «revisado» cuando una persona lo comparó con el documento oficial.</li>
          <li>Además, una revisión automática busca errores: datos repetidos, fechas imposibles, datos sin documento o números que no cuadran. Nada se borra a escondidas: todo se muestra en «¿De dónde salen los datos?».</li>
        </ol>
        <details className="saber-mas">
          <summary>Saber más: estados de revisión</summary>
          <Catalogo catalogo={ESTADOS_VERIFICACION} />
        </details>
        <Nuevo texto="en palabras sencillas" />
      </section>

      <section className={`seccion${claseNuevo()}`}>
        <h2>Lo que estos datos no dicen</h2>
        <ul>
          <li>Si algo no aparece, no quiere decir que no pasó: puede que no se haya publicado o que todavía no lo hayamos anotado.</li>
          <li>Contamos cuántas cosas hizo cada persona, no qué tan difíciles, importantes o útiles fueron.</li>
          <li>Que se apruebe una propuesta depende también de cuántos votos tiene cada partido, no solo del trabajo de quien la presentó.</li>
          <li>Una persona puede cambiar de partido durante la Legislatura; en cada ficha decimos qué partido usamos.</li>
          <li>Cuando alguien pide licencia, su lugar lo ocupa otra persona; a cada quien le contamos solo el tiempo en que estuvo en el cargo.</li>
          <li>Cada comisión trabaja temas distintos y recibe cantidades distintas de propuestas: no se comparan directamente.</li>
          <li>No hacemos un ranking ni una calificación de quién trabaja mejor.</li>
        </ul>
        <Nuevo texto="en palabras sencillas" />
      </section>

      <section className="seccion">
        <h2>Para quien descarga los datos</h2>
        <p className="seccion__intro">
          Si descarga los archivos para analizarlos (por ejemplo, en Excel), aquí está qué trae cada uno de los {NOMBRES_TABLAS.length} archivos y qué significa cada columna. Esta parte es técnica.
        </p>
        {NOMBRES_TABLAS.map((t) => {
          const def = ESQUEMA[t];
          return (
            <details className="desplegable" key={t}>
              <summary>
                {def.titulo} <code className="muy-pequeno texto-3">{t}.csv</code>
              </summary>
              <p className="pequeno texto-2" style={{ marginTop: '0.5rem' }}>
                {def.descripcion} Identificador: <code>{def.clave.join(' + ')}</code>.
              </p>
              <div className="tabla-envoltura">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Columna</th>
                      <th>Descripción</th>
                      <th>Tipo</th>
                      <th>Obligatoria</th>
                      <th>Relación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {def.columnas.map((c) => (
                      <tr key={c.nombre}>
                        <td><code>{c.nombre}</code></td>
                        <td>{c.descripcion}{c.valores && <div className="muy-pequeno texto-3">Valores: {c.valores.join(', ')}</div>}</td>
                        <td>{c.tipo ?? 'texto'}</td>
                        <td>{c.requerido ? 'Sí' : 'No'}</td>
                        <td>{c.ref ? <code>{`${c.ref.tabla}.${c.ref.columna}`}</code> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </section>
    </>
  );
}
