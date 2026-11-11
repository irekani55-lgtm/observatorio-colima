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
    nombre: 'Asistencia a sesiones del Pleno',
    mide: 'Presencia registrada en las sesiones del Pleno.',
    calculo: 'asistencias registradas ÷ sesiones elegibles con información verificable × 100',
    denominador: 'Sesiones marcadas como elegibles, dentro del periodo y en fechas en que la persona ejercía el cargo, con estado «asistencia», «ausencia» o «ausencia justificada». Las justificadas forman parte del denominador y se informan aparte.',
    faltantes: 'Los registros «pendientes», «no verificados» y las sesiones sin captura se excluyen del denominador y NUNCA se cuentan como ausencia. Si existen, el porcentaje se rotula como provisional.',
  },
  {
    nombre: 'Iniciativas presentadas / aprobadas',
    mide: 'Iniciativas en las que la persona figura como autora o coautora y su desenlace en el Pleno.',
    calculo: 'Conteo de id_asunto únicos de tipo iniciativa; «aprobadas» = estado aprobado o publicado.',
    denominador: 'Para el porcentaje de aprobación: iniciativas presentadas en el mismo periodo (por fecha de presentación).',
    faltantes: 'Iniciativas sin promovente registrado no se atribuyen a nadie y se reportan en Calidad de datos.',
  },
  {
    nombre: 'Exhortos presentados / aprobados',
    mide: 'Exhortos promovidos por la persona y aprobados por el Congreso.',
    calculo: 'Conteo de id_asunto únicos de tipo exhorto con estado aprobado. En la ficha individual solo se cuentan los de autoría verificada; los demás se muestran como «pendientes de verificación».',
    denominador: 'Exhortos presentados en el periodo.',
    faltantes: 'Si el registro no permite identificar a los promoventes, el dato se muestra pendiente de verificación.',
  },
  {
    nombre: 'Seguimiento de exhortos',
    mide: 'Lo documentado después de aprobar un exhorto: envío, respuesta y acciones de la autoridad.',
    calculo: 'Estado derivado en orden: no aprobado → no verificado → acciones documentadas → respuesta localizada → sin respuesta localizada → pendiente de seguimiento.',
    denominador: 'Exhortos aprobados.',
    faltantes: 'Nunca se deriva «incumplido». «Sin respuesta localizada» significa que se buscó y no se encontró.',
  },
  {
    nombre: 'Decretos publicados',
    mide: 'Resoluciones publicadas en el Periódico Oficial.',
    calculo: 'Números de decreto únicos con publicación; si falta el número, cuenta el id_asunto. Evita contar dos veces la iniciativa, su dictamen y el decreto.',
    denominador: 'No aplica (conteo).',
    faltantes: 'Asuntos aprobados sin fecha de publicación no se cuentan como publicados.',
  },
  {
    nombre: 'Asuntos pendientes',
    mide: 'Asuntos en trámite.',
    calculo: 'Asuntos con estado presentado, turnado, dictaminado o pendiente.',
    denominador: 'Asuntos del periodo.',
    faltantes: '«Información no localizada» y «estado no verificado» se cuentan aparte, no como pendientes.',
  },
  {
    nombre: 'Tiempos procesales',
    mide: 'Días entre presentación, turno, dictamen y aprobación.',
    calculo: 'Mediana de días entre fechas registradas (la mediana es menos sensible a casos extremos que el promedio).',
    denominador: 'Solo asuntos con ambas fechas; se informa cuántos casos entran al cálculo.',
    faltantes: 'Asuntos sin alguna fecha quedan fuera; los pendientes no tienen fecha final, lo que sesga hacia los asuntos más rápidos.',
  },
  {
    nombre: 'Intervenciones en tribuna',
    mide: 'Participación documentada en el Diario de los Debates.',
    calculo: 'Conteo de intervenciones registradas.',
    denominador: 'No aplica (conteo).',
    faltantes: 'Sesiones sin Diario de los Debates disponible no aportan intervenciones. No mide calidad ni impacto.',
  },
  {
    nombre: 'Votaciones',
    mide: 'Sentido del voto individual cuando la fuente lo acredita.',
    calculo: 'Conteo por sentido. Se cotejan los totales oficiales contra los votos individuales capturados.',
    denominador: 'Votos individuales capturados.',
    faltantes: 'Si la fuente no permite acreditarlo: «voto no localizado». Nunca se infiere del partido ni del resultado.',
  },
  {
    nombre: 'Comisiones',
    mide: 'Asuntos turnados, dictaminados y pendientes; reuniones y asistencia de integrantes.',
    calculo: 'Por comisión, cada turno cuenta. En el total general, cada asunto cuenta una sola vez aunque se haya turnado a varias comisiones.',
    denominador: 'Asuntos turnados a la comisión en el periodo (por fecha de turno).',
    faltantes: 'No haber localizado un acta no se interpreta como que no hubo reunión.',
  },
  {
    nombre: 'Registros con evidencia verificable',
    mide: 'Qué proporción de la base está respaldada por un documento enlazado.',
    calculo: 'Registros cuyo id_fuente existe en «evidencias» y tiene URL válida ÷ registros de las tablas principales × 100.',
    denominador: 'Todas las filas de diputados, sesiones, asistencias, asuntos, intervenciones, votaciones, reuniones, compromisos y agenda.',
    faltantes: 'Un enlace puede dejar de funcionar después de la fecha de consulta registrada.',
  },
];

function Catalogo({ catalogo }: { catalogo: Record<string, EntradaCatalogo> }) {
  return (
    <dl className="definiciones">
      {Object.entries(catalogo).map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{v.tono ? <InsigniaCatalogo catalogo={catalogo} valor={k} /> : v.etiqueta}</dt>
          <dd>
            {v.descripcion} <code className="muy-pequeno texto-3">{k}</code>
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

      <section className="seccion">
        <h2>Periodo de análisis</h2>
        <p>
          La {LEGISLATURA.nombre} abarca {LEGISLATURA.periodo}. Los datos se presentan con corte al <strong>{base.manifiesto.fecha_corte ? fechaCorta(base.manifiesto.fecha_corte) : '(sin definir)'}</strong>. Los filtros permiten acotar por año legislativo o por un rango de fechas.
        </p>
        <ul>
          {ANIOS_LEGISLATIVOS.anios.map((a) => (
            <li key={a.numero}>
              {a.etiqueta}: {fechaCorta(a.inicio)} – {fechaCorta(a.fin)}
            </li>
          ))}
        </ul>
        {!ANIOS_LEGISLATIVOS.verificado && <p className="pequeno texto-2">Los límites de cada año legislativo están pendientes de verificar contra la Ley Orgánica del Poder Legislativo y el acta de instalación; se configuran en <code>src/config/legislatura.ts</code>.</p>}
        <p className="pequeno texto-2">
          Las sesiones llevan su año legislativo de forma explícita, porque la numeración se reinicia cada año. Asuntos e intervenciones se ubican en el periodo por su fecha (presentación o sesión). Los registros sin fecha válida solo se incluyen cuando no hay filtro de periodo.
        </p>
      </section>

      <section className="seccion">
        <h2>Indicadores</h2>
        {INDICADORES.map((i) => (
          <details className="desplegable" key={i.nombre}>
            <summary>{i.nombre}</summary>
            <dl className="definiciones" style={{ marginTop: '0.6rem' }}>
              <dt>Qué mide</dt>
              <dd>{i.mide}</dd>
              <dt>Cálculo</dt>
              <dd>{i.calculo}</dd>
              <dt>Denominador</dt>
              <dd>{i.denominador}</dd>
              <dt>Datos faltantes</dt>
              <dd>{i.faltantes}</dd>
            </dl>
          </details>
        ))}
      </section>

      <section className="seccion">
        <h2>Iniciativas compartidas y no duplicación</h2>
        <ul>
          <li>Cada asunto tiene un identificador único y aparece una sola vez en la tabla de asuntos. Los promoventes y las comisiones se registran en tablas de relación aparte.</li>
          <li>Un asunto es <strong>individual</strong> si tiene un solo promovente atribuible (autor/a) y <strong>compartido</strong> si tiene dos o más (autores/as y coautores/as). Las adhesiones posteriores se muestran, pero no cuentan.</li>
          <li>En la ficha de cada persona, un asunto compartido cuenta una vez para cada promovente. En los totales de la Legislatura cuenta una sola vez. Por eso la suma de conteos individuales puede superar el total.</li>
          <li>Los asuntos de promoventes externos (Ejecutivo, ayuntamientos, ciudadanía) cuentan en los totales, pero no se atribuyen a ninguna diputación.</li>
          <li>Con filtro de partido, un asunto se incluye si al menos un promovente pertenece al partido.</li>
        </ul>
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
          Llamamos <strong>votación dividida</strong> a una votación nominal en la que, según los totales del acta, al menos {UMBRAL_DIVIDIDA} diputaciones votaron a favor y al menos {UMBRAL_DIVIDIDA} votaron en contra o se abstuvieron. La mayoría de las votaciones del Congreso son por unanimidad o casi; en las divididas se ve mejor la postura de cada persona. Solo contamos votos escritos con nombre en el acta; los votos probables nunca se suman.
        </p>
      </section>

      <section className="seccion">
        <h2>Estados procesales</h2>
        <p className="seccion__intro">No todos los asuntos siguen el mismo procedimiento. Un estado que no corresponde al tipo de asunto se marca como incompatible en la validación.</p>
        <Catalogo catalogo={ESTADOS_PROCESALES} />
        <h3 style={{ marginTop: '1rem' }}>Etapas admitidas por tipo de asunto</h3>
        <ul className="pequeno">
          {Object.entries(ETAPAS_POR_TIPO).map(([t, e]) => (
            <li key={t}>
              <strong>{etiquetaDe(TIPOS_ASUNTO, t)}</strong> — {TIPOS_ASUNTO[t as keyof typeof TIPOS_ASUNTO].descripcion} Etapas: {e.map((x) => etiquetaDe(ESTADOS_PROCESALES, x).toLowerCase()).join(', ')}.
            </li>
          ))}
        </ul>
      </section>

      <section className="seccion rejilla rejilla--2">
        <div className="panel">
          <h3>Estados de asistencia</h3>
          <Catalogo catalogo={ESTADOS_ASISTENCIA} />
        </div>
        <div className="panel">
          <h3>Seguimiento de exhortos</h3>
          <Catalogo catalogo={SEGUIMIENTO_EXHORTO} />
        </div>
        <div className="panel">
          <h3>Sentido del voto</h3>
          <Catalogo catalogo={SENTIDOS_VOTO} />
        </div>
        <div className="panel">
          <h3>Seguimiento de compromisos</h3>
          <Catalogo catalogo={SEGUIMIENTO_COMPROMISO} />
        </div>
      </section>

      <section className="seccion">
        <h2>Verificación de fuentes</h2>
        <Catalogo catalogo={ESTADOS_VERIFICACION} />
        <ol style={{ marginTop: '1rem' }}>
          <li>Cada registro indica un <code>id_fuente</code> que remite al catálogo de evidencias, con URL, institución, fecha del documento y fecha de consulta.</li>
          <li>Se priorizan las fuentes institucionales: sitio del Congreso, Gaceta Parlamentaria, Diario de los Debates, portal de transparencia, Periódico Oficial e IEE Colima. Las notas de prensa sirven como pista, no como prueba única.</li>
          <li>Un registro es «verificado» cuando una persona revisora lo contrastó contra el documento enlazado.</li>
          <li>La validación automática detecta IDs duplicados, fechas inválidas, registros sin fuente, relaciones inexistentes, estados incompatibles, posibles duplicados, datos incompletos y discrepancias de cálculo. Nada se borra en silencio: todo se reporta en <a href="#/fuentes">Fuentes y calidad de datos</a>.</li>
        </ol>
      </section>

      <section className="seccion">
        <h2>Limitaciones</h2>
        <ul>
          <li>La ausencia de un registro no demuestra que una actividad no se haya realizado: puede no estar publicada o no haberse capturado.</li>
          <li>Los conteos no ponderan la complejidad, la relevancia social ni el impacto de cada asunto.</li>
          <li>La aprobación de una iniciativa depende también de la correlación de fuerzas en el Congreso, no solo del trabajo de quien la presenta.</li>
          <li>La adscripción partidaria puede cambiar durante la Legislatura; el criterio usado se indica en cada ficha.</li>
          <li>Las suplencias dividen la actividad de una curul entre varias personas; los indicadores se calculan por persona y por su periodo de ejercicio.</li>
          <li>Las comisiones tienen cargas y competencias distintas y no son directamente comparables.</li>
          <li>No se construye un índice único ni un ranking de calidad legislativa.</li>
        </ul>
      </section>

      <section className="seccion">
        <h2>Diccionario de datos</h2>
        <p className="seccion__intro">Estructura de las {NOMBRES_TABLAS.length} tablas relacionadas. Los datos originales, los valores calculados y las etiquetas de la interfaz se mantienen separados.</p>
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
