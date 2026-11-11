import { useMemo, useState } from 'react';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { EnlaceExterno } from '../componentes/Fuente';
import { Insignia, InsigniaCatalogo } from '../componentes/Insignia';
import { Tabla } from '../componentes/Tabla';
import { fmt, fmtPct, Tarjeta } from '../componentes/Tarjeta';
import { CONFIANZA_OBSERVACION, ESTADOS_OBSERVACION, TIPOS_FUENTE, etiquetaDe } from '../config/catalogos';
import { FUENTES_INSTITUCIONALES } from '../config/legislatura';
import { CONFIG_MAPA } from '../config/mapa';
import type { Evidencia, Observacion } from '../datos/modelo';
import { CATEGORIAS_PROBLEMA, resumenProblemas, type Problema, type Severidad } from '../datos/validar';
import { useDatos } from '../estado/DatosContext';
import { coberturaEvidencia } from '../indicadores/evidencia';
import { fechaCorta } from '../indicadores/filtro';
import { EnlaceFuente } from '../componentes/Fuente';

const SEVERIDAD: Record<Severidad, { etiqueta: string; descripcion: string; tono: 'negativo' | 'alerta' | 'info' }> = {
  error: { etiqueta: 'Error', descripcion: 'Impide un cálculo correcto o contradice otra información.', tono: 'negativo' },
  advertencia: { etiqueta: 'Advertencia', descripcion: 'Dato incompleto o dudoso que conviene revisar.', tono: 'alerta' },
  aviso: { etiqueta: 'Aviso', descripcion: 'Información útil para la revisión.', tono: 'info' },
};

export default function Fuentes() {
  const { base, problemas, idConjunto } = useDatos();
  const [sev, setSev] = useState<Severidad | ''>('');
  const r = resumenProblemas(problemas);
  const cob = useMemo(() => coberturaEvidencia(base), [base]);
  const lista = problemas.filter((p) => !sev || p.severidad === sev);
  const [estadoObs, setEstadoObs] = useState<'' | 'abierta' | 'resuelta'>('');
  const [verVotaciones, setVerVotaciones] = useState(false);
  const obs = base.observaciones.filter((o) => (!estadoObs || o.estado === estadoObs) && (verVotaciones || o.tabla !== 'votaciones'));
  const nObs = { abierta: base.observaciones.filter((o) => o.estado === 'abierta').length, resuelta: base.observaciones.filter((o) => o.estado === 'resuelta').length };

  return (
    <>
      <EncabezadoPagina titulo="¿De dónde salen los datos?">
        <p className={claseNuevo()}>
          Todo lo que ve en el Observatorio sale de documentos oficiales del Congreso, del Instituto Electoral del Estado de Colima (IEE) y del Instituto Nacional Electoral (INE). Aquí están esos documentos, las revisiones que hacemos para encontrar
          errores y la bitácora donde anotamos lo que no cuadra. Esta página es la más detallada; sirve sobre todo a quien quiere revisar a fondo.
          <Nuevo texto="en palabras sencillas" />
        </p>
      </EncabezadoPagina>

      <section className="seccion">
        <h2>Los documentos oficiales que usamos</h2>
        <p className="seccion__intro">Estos son los sitios oficiales de donde sacamos la información. Toque cualquiera para abrirlo.</p>
        <div className="rejilla rejilla--3">
          {FUENTES_INSTITUCIONALES.map((f) => (
            <article className="panel" key={f.id}>
              <h3 style={{ fontSize: '1rem' }}>
                <EnlaceExterno url={f.url}>{f.nombre}</EnlaceExterno>
              </h3>
              <p className="muy-pequeno texto-3">{f.institucion}</p>
              <p className="pequeno texto-2">{f.uso}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`seccion${claseNuevo()}`} id="integracion">
        <h2>¿Qué datos se muestran?</h2>
        {base.manifiesto.es_demo ? (
          <Aviso tipo="alerta" titulo="Estos datos son de prueba">
            <p>Los nombres, partidos, números y documentos que ve ahora son inventados, solo para probar el Observatorio. No son reales.</p>
          </Aviso>
        ) : (
          <Aviso>
            Se muestran los datos oficiales: <strong>{base.manifiesto.nombre}</strong>. {base.manifiesto.descripcion}
          </Aviso>
        )}
        {base.archivosFaltantes.length > 0 && <Aviso tipo="alerta">Faltan algunos archivos de datos ({base.archivosFaltantes.map((a) => `${a}.csv`).join(', ')}); esas partes aparecen vacías.</Aviso>}
        <details className="saber-mas">
          <summary>Saber más: instrucciones técnicas para actualizar los datos (para quien mantiene el Observatorio)</summary>
          <ol className="pequeno">
            <li>Capture los datos oficiales en las plantillas de <code>public/datos/oficial/</code> (un CSV por tabla, con los encabezados que se explican en <a href="#/metodologia">«Para quien descarga los datos»</a>). También puede partir de un libro de Excel con una hoja por tabla y convertirlo con <code>npm run datos:excel -- archivo.xlsx oficial</code>.</li>
            <li>Registre cada documento en <code>evidencias.csv</code> y refiéralo desde cada registro con <code>id_fuente</code>.</li>
            <li>Ejecute <code>npm run datos:validar -- oficial</code> y corrija los errores reportados.</li>
            <li>Indique la fecha de corte en <code>public/datos/oficial/manifiesto.json</code> y active el conjunto en <code>public/datos/config.json</code> (<code>{'{"conjunto": "oficial"}'}</code>) o pruebe con <code>?datos=oficial</code> en la dirección (conjunto activo: <code>{idConjunto}</code>).</li>
            <li>
              Para el mapa, coloque la cartografía de distritos en <code>public/{CONFIG_MAPA.archivoDistritos}</code> (ver <code>public/geo/LEEME.md</code>).
            </li>
          </ol>
        </details>
        <Nuevo texto="en palabras sencillas; lo técnico, en «Saber más»" />
      </section>

      <section className="seccion">
        <h2>¿Cuántos datos tienen su documento?</h2>
        <p className="seccion__intro">Cuántos de nuestros datos tienen enlazado el documento oficial de donde salieron.</p>
        <div className="rejilla rejilla--tarjetas" style={{ marginBottom: '1rem' }}>
          <Tarjeta titulo="Datos con documento" valor={cob.porcentaje == null ? null : fmtPct(cob.porcentaje)} detalle={`${fmt(cob.conEvidencia)} de ${fmt(cob.total)}`} explica="Datos que tienen enlazado el documento oficial de donde salieron." />
          <Tarjeta titulo="Documentos consultados" valor={fmt(base.evidencias.length)} detalle={`${fmt(base.evidencias.filter((e) => e.oficial === 'si').length)} son oficiales`} explica="Actas, listas, acuerdos y otros documentos que revisamos." />
        </div>
        <Tabla
          titulo="Datos con documento, por tipo"
          filas={cob.porTabla}
          clave={(t) => t.tabla}
          busqueda={false}
          columnas={[
            { id: 't', titulo: 'Tipo de dato', valor: (t) => t.titulo },
            { id: 'n', titulo: 'Datos', numerica: true, valor: (t) => t.total },
            { id: 'e', titulo: 'Con documento', numerica: true, valor: (t) => t.conEvidencia },
            { id: 'o', titulo: 'Con documento oficial', numerica: true, valor: (t) => t.oficial },
            { id: 'p', titulo: '%', numerica: true, valor: (t) => (t.total ? (t.conEvidencia / t.total) * 100 : null), render: (t) => (t.total ? fmtPct((t.conEvidencia / t.total) * 100) : 'Sin registros') },
          ]}
        />
      </section>

      <section className="seccion" id="bitacora">
        <h2>Bitácora de observaciones</h2>
        <p className={`seccion__intro${claseNuevo()}`}>
          Aquí anotamos todo lo que no cuadra en los documentos oficiales: un total que no coincide, un nombre mal escrito o un archivo que falta. <strong>Nunca cambiamos el documento oficial</strong>: lo anotamos aquí, con su explicación y su documento.
          <Nuevo texto="en palabras sencillas" />
        </p>
        <details className="saber-mas">
          <summary>Saber más</summary>
          <p className="pequeno">
            Una observación está «por resolver» mientras no tengamos un documento o una aclaración del Congreso que la resuelva. Las de cada votación donde no cuadran los votos también se ven en la página de Votaciones; aquí están ocultas para que la
            lista sea más corta, pero puede mostrarlas.
          </p>
        </details>
        <div className="rejilla rejilla--tarjetas" style={{ marginBottom: '1rem' }}>
          <Tarjeta titulo="Por resolver" valor={fmt(nObs.abierta)} explica="Necesitan otro documento o una aclaración del Congreso." />
          <Tarjeta titulo="Resueltas" valor={fmt(nObs.resuelta)} explica="Se aclararon con documentos oficiales o con el Congreso." />
        </div>
        <form className="filtros" aria-label="Filtros de la bitácora" onSubmit={(e) => e.preventDefault()}>
          <div className="campo">
            <label htmlFor="obs-estado">Estado</label>
            <select id="obs-estado" value={estadoObs} onChange={(e) => setEstadoObs(e.target.value as typeof estadoObs)}>
              <option value="">Todas</option>
              <option value="abierta">Por resolver</option>
              <option value="resuelta">Resueltas</option>
            </select>
          </div>
          <div className="campo campo--ancho">
            <label htmlFor="obs-vot">Votaciones donde no cuadran los votos</label>
            <select id="obs-vot" value={verVotaciones ? 'si' : 'no'} onChange={(e) => setVerVotaciones(e.target.value === 'si')}>
              <option value="no">Ocultar (se ven en Votaciones)</option>
              <option value="si">Mostrar también</option>
            </select>
          </div>
        </form>
        <Tabla<Observacion>
          titulo="Bitácora de observaciones"
          filas={obs}
          clave={(o) => o.id_observacion}
          archivo="observaciones"
          ordenInicial={{ id: 'id', desc: false }}
          columnas={[
            { id: 'id', titulo: 'Clave', valor: (o) => o.id_observacion, render: (o) => <span className="muy-pequeno num">{o.id_observacion}</span> },
            { id: 'e', titulo: '¿Resuelta?', valor: (o) => o.estado, render: (o) => <InsigniaCatalogo catalogo={ESTADOS_OBSERVACION} valor={o.estado} /> },
            { id: 't', titulo: 'Sobre qué dato', valor: (o) => `${o.tabla} ${o.id_registro}`, render: (o) => <span className="muy-pequeno">{o.tabla}<div className="texto-3">{o.id_registro}</div></span> },
            { id: 'd', titulo: 'Qué se encontró', valor: (o) => o.descripcion, render: (o) => <span className="pequeno">{o.descripcion}{o.confianza && <div><InsigniaCatalogo catalogo={CONFIANZA_OBSERVACION} valor={o.confianza} /></div>}</span> },
            { id: 'r', titulo: 'Cómo se resolvió', valor: (o) => o.resolucion, render: (o) => (o.resolucion ? <span className="pequeno">{o.resolucion}</span> : <span className="texto-3">—</span>) },
            { id: 'f', titulo: 'Documento', sinBusqueda: true, valor: (o) => o.id_fuente_resolucion || o.id_fuente, render: (o) => (o.id_fuente_resolucion || o.id_fuente ? <EnlaceFuente id={o.id_fuente_resolucion || o.id_fuente} corto /> : <span className="texto-3">—</span>) },
          ]}
        />
      </section>

      <section className="seccion">
        <h2>Revisión automática de errores</h2>
        <p className={`seccion__intro${claseNuevo()}`}>
          Un programa revisa todos los datos y avisa si encuentra algo raro: datos repetidos, fechas imposibles, datos sin documento o números que no cuadran. No borra nada: solo lo anota aquí para que una persona lo revise.
          <Nuevo texto="en palabras sencillas" />
        </p>
        <div className="rejilla rejilla--tarjetas" style={{ marginBottom: '1rem' }}>
          {(Object.keys(SEVERIDAD) as Severidad[]).map((s) => (
            <Tarjeta key={s} titulo={SEVERIDAD[s].etiqueta + 's'} valor={fmt(r.porSeveridad[s])} explica={SEVERIDAD[s].descripcion} />
          ))}
        </div>
        {r.total > 0 && (
          <p className="pequeno">
            {Object.entries(r.porCategoria)
              .map(([c, n]) => `${CATEGORIAS_PROBLEMA[c as keyof typeof CATEGORIAS_PROBLEMA]}: ${n}`)
              .join(' · ')}
          </p>
        )}
        <div className="fila-flex" role="group" aria-label="Filtrar por gravedad" style={{ marginBottom: '0.5rem' }}>
          {(['', 'error', 'advertencia', 'aviso'] as const).map((s) => (
            <button key={s || 'todas'} type="button" className="boton boton--chico" aria-pressed={sev === s} onClick={() => setSev(s)}>
              {s ? SEVERIDAD[s].etiqueta + 's' : 'Todas'}
            </button>
          ))}
        </div>
        <Tabla<Problema>
          titulo="Problemas detectados"
          filas={lista}
          clave={(p) => `${p.tabla}|${p.registro}|${p.columna}|${p.mensaje}`}
          archivo="reporte-validacion"
          vacio="No se detectaron problemas."
          columnas={[
            { id: 's', titulo: 'Gravedad', valor: (p) => p.severidad, render: (p) => <Insignia entrada={SEVERIDAD[p.severidad]} /> },
            { id: 'c', titulo: 'Tipo', valor: (p) => CATEGORIAS_PROBLEMA[p.categoria] },
            { id: 't', titulo: 'Tipo de dato', valor: (p) => p.tabla },
            { id: 'r', titulo: 'Clave del dato', valor: (p) => p.registro, render: (p) => <code className="muy-pequeno">{p.registro}</code> },
            { id: 'col', titulo: 'Campo', valor: (p) => p.columna ?? '' },
            { id: 'm', titulo: 'Qué encontró', valor: (p) => p.mensaje },
          ]}
        />
      </section>

      <section className="seccion">
        <h2>Lista de todos los documentos</h2>
        <p className="seccion__intro">Cada documento oficial que usamos, con su enlace y la fecha en que lo consultamos.</p>
        <Tabla<Evidencia>
          titulo="Evidencias"
          filas={base.evidencias}
          clave={(e) => e.id_fuente}
          archivo="evidencias"
          porPagina={20}
          columnas={[
            { id: 'id', titulo: 'Clave', valor: (e) => e.id_fuente, render: (e) => <code className="muy-pequeno">{e.id_fuente}</code> },
            { id: 't', titulo: 'Documento', valor: (e) => e.titulo, render: (e) => <EnlaceExterno url={e.url}>{e.titulo || e.url}</EnlaceExterno> },
            { id: 'tipo', titulo: 'Tipo', valor: (e) => etiquetaDe(TIPOS_FUENTE, e.tipo) },
            { id: 'i', titulo: 'Institución', valor: (e) => e.institucion },
            { id: 'o', titulo: '¿Es oficial?', valor: (e) => (e.oficial === 'si' ? 'Sí' : 'No') },
            { id: 'f', titulo: 'Fecha del documento', valor: (e) => e.fecha_documento, render: (e) => fechaCorta(e.fecha_documento) },
            { id: 'c', titulo: 'Lo consultamos', valor: (e) => e.fecha_consulta, render: (e) => fechaCorta(e.fecha_consulta) },
          ]}
        />
      </section>
    </>
  );
}
