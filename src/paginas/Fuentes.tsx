import { useMemo, useState } from 'react';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { EnlaceExterno } from '../componentes/Fuente';
import { Insignia } from '../componentes/Insignia';
import { Tabla } from '../componentes/Tabla';
import { fmt, fmtPct, Tarjeta } from '../componentes/Tarjeta';
import { TIPOS_FUENTE, etiquetaDe } from '../config/catalogos';
import { FUENTES_INSTITUCIONALES } from '../config/legislatura';
import { CONFIG_MAPA } from '../config/mapa';
import type { Evidencia } from '../datos/modelo';
import { CATEGORIAS_PROBLEMA, resumenProblemas, type Problema, type Severidad } from '../datos/validar';
import { useDatos } from '../estado/DatosContext';
import { coberturaEvidencia } from '../indicadores/evidencia';
import { fechaCorta } from '../indicadores/filtro';

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

  return (
    <>
      <EncabezadoPagina titulo="Fuentes y calidad de datos">
        <p>Fuentes institucionales consultadas, evidencias que respaldan cada registro y resultados de la validación automática de los datos.</p>
      </EncabezadoPagina>

      <section className="seccion">
        <h2>Fuentes institucionales</h2>
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

      <section className="seccion" id="integracion">
        <h2>Estado de la integración de datos</h2>
        {base.manifiesto.es_demo ? (
          <Aviso tipo="alerta" titulo="Se muestran datos de demostración">
            <p>
              El conjunto activo (<code>{idConjunto}</code>) es ficticio. Los nombres («Persona Legisladora Demo»), los partidos («Partido Demo»), las cifras y los documentos (<code>example.org</code>) no son reales. Incluye errores intencionales para mostrar las validaciones.
            </p>
          </Aviso>
        ) : (
          <Aviso>Conjunto activo: <strong>{base.manifiesto.nombre}</strong> ({idConjunto}). {base.manifiesto.descripcion}</Aviso>
        )}
        <ol className="pequeno">
          <li>Capture los datos oficiales en las plantillas de <code>public/datos/oficial/</code> (un CSV por tabla, con los encabezados del <a href="#/metodologia">diccionario de datos</a>). También puede partir de un libro de Excel con una hoja por tabla y convertirlo con <code>npm run datos:excel -- archivo.xlsx oficial</code>.</li>
          <li>Registre cada documento en <code>evidencias.csv</code> y refiéralo desde cada registro con <code>id_fuente</code>.</li>
          <li>Ejecute <code>npm run datos:validar -- oficial</code> y corrija los errores reportados.</li>
          <li>Indique la fecha de corte en <code>public/datos/oficial/manifiesto.json</code> y active el conjunto en <code>public/datos/config.json</code> (<code>{'{"conjunto": "oficial"}'}</code>) o pruebe con <code>?datos=oficial</code> en la dirección.</li>
          <li>
            Para el mapa, coloque la cartografía de distritos del IEE Colima en <code>public/{CONFIG_MAPA.archivoDistritos}</code> (ver <code>public/geo/LEEME.md</code>).
          </li>
        </ol>
        {base.archivosFaltantes.length > 0 && <Aviso tipo="alerta">Archivos no encontrados (se tratan como tablas vacías): {base.archivosFaltantes.map((a) => `${a}.csv`).join(', ')}.</Aviso>}
      </section>

      <section className="seccion">
        <h2>Cobertura de evidencias</h2>
        <p className="seccion__intro">Registros cuyo identificador de fuente existe en el catálogo de evidencias y tiene una URL válida.</p>
        <div className="rejilla rejilla--tarjetas" style={{ marginBottom: '1rem' }}>
          <Tarjeta titulo="Registros con evidencia" valor={cob.porcentaje == null ? null : fmtPct(cob.porcentaje)} detalle={`${fmt(cob.conEvidencia)} de ${fmt(cob.total)}`} />
          <Tarjeta titulo="Evidencias catalogadas" valor={fmt(base.evidencias.length)} detalle={`${fmt(base.evidencias.filter((e) => e.oficial === 'si').length)} de fuente oficial`} />
        </div>
        <Tabla
          titulo="Cobertura por tabla"
          filas={cob.porTabla}
          clave={(t) => t.tabla}
          busqueda={false}
          columnas={[
            { id: 't', titulo: 'Tabla', valor: (t) => t.titulo },
            { id: 'n', titulo: 'Registros', numerica: true, valor: (t) => t.total },
            { id: 'e', titulo: 'Con evidencia', numerica: true, valor: (t) => t.conEvidencia },
            { id: 'o', titulo: 'Con fuente oficial', numerica: true, valor: (t) => t.oficial },
            { id: 'p', titulo: '%', numerica: true, valor: (t) => (t.total ? (t.conEvidencia / t.total) * 100 : null), render: (t) => (t.total ? fmtPct((t.conEvidencia / t.total) * 100) : 'Sin registros') },
          ]}
        />
      </section>

      <section className="seccion">
        <h2>Validación de datos</h2>
        <p className="seccion__intro">Ningún registro se elimina automáticamente: los problemas detectados se listan para revisión.</p>
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
        <div className="fila-flex" role="group" aria-label="Filtrar por severidad" style={{ marginBottom: '0.5rem' }}>
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
            { id: 's', titulo: 'Severidad', valor: (p) => p.severidad, render: (p) => <Insignia entrada={SEVERIDAD[p.severidad]} /> },
            { id: 'c', titulo: 'Tipo', valor: (p) => CATEGORIAS_PROBLEMA[p.categoria] },
            { id: 't', titulo: 'Tabla', valor: (p) => p.tabla },
            { id: 'r', titulo: 'Registro', valor: (p) => p.registro, render: (p) => <code className="muy-pequeno">{p.registro}</code> },
            { id: 'col', titulo: 'Columna', valor: (p) => p.columna ?? '' },
            { id: 'm', titulo: 'Detalle', valor: (p) => p.mensaje },
          ]}
        />
      </section>

      <section className="seccion">
        <h2>Catálogo de evidencias</h2>
        <Tabla<Evidencia>
          titulo="Evidencias"
          filas={base.evidencias}
          clave={(e) => e.id_fuente}
          archivo="evidencias"
          porPagina={20}
          columnas={[
            { id: 'id', titulo: 'ID', valor: (e) => e.id_fuente, render: (e) => <code className="muy-pequeno">{e.id_fuente}</code> },
            { id: 't', titulo: 'Documento', valor: (e) => e.titulo, render: (e) => <EnlaceExterno url={e.url}>{e.titulo || e.url}</EnlaceExterno> },
            { id: 'tipo', titulo: 'Tipo', valor: (e) => etiquetaDe(TIPOS_FUENTE, e.tipo) },
            { id: 'i', titulo: 'Institución', valor: (e) => e.institucion },
            { id: 'o', titulo: 'Oficial', valor: (e) => (e.oficial === 'si' ? 'Sí' : 'No') },
            { id: 'f', titulo: 'Fecha', valor: (e) => e.fecha_documento, render: (e) => fechaCorta(e.fecha_documento) },
            { id: 'c', titulo: 'Consultado', valor: (e) => e.fecha_consulta, render: (e) => fechaCorta(e.fecha_consulta) },
          ]}
        />
      </section>
    </>
  );
}
