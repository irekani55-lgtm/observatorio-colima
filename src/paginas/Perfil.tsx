import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso } from '../componentes/Aviso';
import { BarraComparada } from '../componentes/BarraComparada';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { DatosGenerales } from '../componentes/FichaDiputado';
import { BarraFiltros } from '../componentes/Filtros';
import { Foto } from '../componentes/Foto';
import { EnlaceExterno, EnlaceFuente } from '../componentes/Fuente';
import { InsigniaCatalogo } from '../componentes/Insignia';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
import { Tabla } from '../componentes/Tabla';
import { TablaAsistencias, TablaAsuntos, TablaIntervenciones, TablaVotos } from '../componentes/TablasRegistros';
import { fmt } from '../componentes/Tarjeta';
import { CARGOS_COMISION, ESTADOS_VERIFICACION, SEGUIMIENTO_COMPROMISO, etiquetaDe } from '../config/catalogos';
import type { Asunto, Compromiso, Diputado, Integrante, Intervencion, Voto } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import type { RegistroAsistencia } from '../indicadores/asistencia';
import { fechaCorta } from '../indicadores/filtro';
import { aSlug, datosPerfil, indicadoresQueNoCuadran, periodoArchivo, PESTANAS, type IndicadorPerfil, type Pestana } from '../indicadores/perfil';

/** Un renglón de indicador. Si sale de registros propios y no vale 0, todo el renglón lleva a sus registros. */
function FilaIndicador({ i, onVer, refAsistencia, pct }: { i: IndicadorPerfil; onVer: () => void; refAsistencia?: number | null; pct?: number | null }) {
  const valor = i.valor == null ? 'Pendiente' : typeof i.valor === 'number' ? fmt(i.valor) : i.valor;
  const clic = Boolean(i.pestana && i.filas && i.conteo && i.conteo > 0);
  const contenido = (
    <>
      <span className="ind__etiqueta">{i.etiqueta}</span>
      <span className="ind__valor">
        <strong className="num">{valor}</strong>
        {i.detalle && <span className="texto-3 muy-pequeno"> · {i.detalle}</span>}
      </span>
      {clic && (
        <span className="ind__ver" aria-hidden="true">
          Ver →
        </span>
      )}
    </>
  );
  return (
    <li className={`ind${claseNuevo(Boolean(i.cambio))}`}>
      {clic ? (
        <button type="button" className="ind__fila ind__fila--enlace" onClick={onVer} aria-label={`${i.etiqueta}: ${valor}${i.detalle ? ` (${i.detalle})` : ''}. Ver ${i.conteo} ${i.conteo === 1 ? 'registro' : 'registros'}`}>
          {contenido}
        </button>
      ) : (
        <div className="ind__fila">{contenido}</div>
      )}
      {i.id === 'asistencia' && pct != null && (
        <div className="ind__extra">
          <BarraComparada valor={pct} referencia={refAsistencia ?? null} />
        </div>
      )}
      {i.nota && <p className="ind__nota muy-pequeno texto-3">ⓘ {i.nota}</p>}
      {i.cambio && <Nuevo texto={i.cambio} />}
    </li>
  );
}

export default function Perfil() {
  const { id = '' } = useParams();
  const { base } = useDatos();
  const d = base.idx.diputado.get(id);
  if (!d)
    return (
      <EncabezadoPagina titulo="Diputación no encontrada" migas={[{ a: '/diputaciones', texto: 'Diputaciones' }]}>
        <p>
          No existe el identificador «{id}» en el catálogo. <Link to="/diputaciones">Volver al directorio</Link>.
        </p>
      </EncabezadoPagina>
    );
  return <PerfilDe d={d} />;
}

function PerfilDe({ d }: { d: Diputado }) {
  const { base } = useDatos();
  const [filtro] = useFiltro();
  const periodo = { anio: filtro.anio, desde: filtro.desde, hasta: filtro.hasta };
  const [tab, setTab] = useState<Pestana>('Asistencias');

  const calc = useMemo(() => datosPerfil(base, d, periodo), [base, d, periodo.anio, periodo.desde, periodo.hasta]); // eslint-disable-line react-hooks/exhaustive-deps
  const { asis, asuntos, inter, votos, cargos, exh, comp, agenda, tareas, ref } = calc;
  const ind = calc.ind;
  const fallas = useMemo(() => indicadoresQueNoCuadran(tareas), [tareas]);

  // Indicador elegido: la pestaña que le toca muestra solo sus filas (o las de una parte del desglose).
  const [sel, setSel] = useState<{ ind: string; parte?: string } | null>(null);
  const indSel = sel ? tareas.flatMap((t) => t.indicadores).find((i) => i.id === sel.ind) : undefined;
  const parteSel = indSel && sel?.parte ? indSel.partes?.find((p) => p.id === sel.parte) : undefined;
  const filasSel = parteSel ? parteSel.filas : indSel?.filas;
  const activo = (p: Pestana) => Boolean(indSel && filasSel && indSel.pestana === p);
  const filasDe = <T,>(p: Pestana, todas: T[]): T[] => (activo(p) ? (filasSel as T[]) : todas);
  const periodoTxt = periodoArchivo(periodo, base.manifiesto.fecha_corte);
  const archivoDe = (p: Pestana, base_: string) =>
    activo(p) ? `${indSel!.id}${parteSel ? `-${parteSel.id}` : ''}_${aSlug(d.nombre_completo)}_${periodoTxt}` : `${base_}_${aSlug(d.nombre_completo)}_${periodoTxt}`;
  function ver(i: IndicadorPerfil, parte?: string) {
    setSel({ ind: i.id, parte });
    if (i.pestana) setTab(i.pestana);
    requestAnimationFrame(() => document.getElementById('registros')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }

  const fuentes = useMemo(() => {
    const ids = new Set<string>([d.id_fuente, ...asuntos.map((a) => a.id_fuente), ...inter.map((i) => i.id_fuente), ...comp.map((c) => c.id_fuente)].filter(Boolean));
    return [...ids].map((i) => base.idx.evidencia.get(i) ?? { id_fuente: i, titulo: 'Fuente no localizada en evidencias', url: '', tipo: '', institucion: '', fecha_documento: '', fecha_consulta: '', oficial: '', pagina: '' });
  }, [base, d, asuntos, inter, comp]);

  return (
    <>
      <EncabezadoPagina titulo={d.nombre_completo} migas={[{ a: '/diputaciones', texto: 'Diputaciones' }]} />
      <div className="panel">
        <div className="ficha ficha--grande">
          <Foto url={d.url_foto} archivo={d.archivo_foto} nombre={d.nombre_completo} />
          <div>
            <DatosGenerales d={d} />
            <ul className="lista-limpia pequeno" style={{ marginTop: '0.75rem', display: 'grid', gap: '0.25rem' }}>
              <li>Periodo legislativo: LXI Legislatura 2024–2027</li>
              <li>{d.url_ficha_oficial ? <EnlaceExterno url={d.url_ficha_oficial}>Ficha oficial en el sitio del Congreso</EnlaceExterno> : <span className="texto-3">Ficha oficial del Congreso: enlace no registrado</span>}</li>
              {d.url_foto && <li className="muy-pequeno texto-3">Origen de la fotografía: <EnlaceExterno url={d.url_foto}>{d.url_foto}</EnlaceExterno></li>}
              <li>
                Fuente del registro: <EnlaceFuente id={d.id_fuente} /> · <InsigniaCatalogo catalogo={ESTADOS_VERIFICACION} valor={d.estado_verificacion} />
              </li>
            </ul>
          </div>
        </div>
      </div>

      <section className="seccion">
        <h2>¿Qué ha hecho en el Congreso?</h2>
        <p className="seccion__intro">
          Ordenado según las tres tareas de una diputación. Cada tarea se muestra por separado: no las sumamos en una calificación. Solo contamos lo que está en documentos oficiales; que un dato no aparezca no prueba que no ocurrió.
        </p>
        <p className={`pequeno${claseNuevo()}`}>
          Toque un renglón que diga <strong>Ver →</strong> para ver los registros que forman ese número. <Nuevo />
        </p>
        <BarraFiltros campos={['anio']} />
        {fallas.length > 0 && (
          <Aviso tipo="alerta" titulo="Hay indicadores que no coinciden con sus registros">
            <ul>
              {fallas.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Aviso>
        )}
        <div className="perfil-tareas">
          {tareas.map((t) => (
            <div key={t.numero} className="panel dimension">
              <h3 className="ficha__funcion">
                <span className="ficha__funcion-num" aria-hidden="true">
                  {t.numero}
                </span>
                {t.titulo}
              </h3>
              <ul className="lista-limpia indicadores">
                {t.indicadores.map((i) => (
                  <FilaIndicador key={i.id} i={i} onVer={() => ver(i)} refAsistencia={ref.asistencia} pct={asis.porcentaje} />
                ))}
              </ul>
              {t.numero === 1 && (
                <p className="muy-pequeno">
                  <Link to="/metodologia#clasificacion-propuestas">¿Cómo separamos las propuestas?</Link> · <Link to="/metodologia#votaciones-divididas">¿Qué es una votación dividida?</Link>
                </p>
              )}
              {t.pie && <p className="muy-pequeno texto-3">{t.pie}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="seccion" id="registros">
        <h2>Registros</h2>
        <div className="pestanas" role="tablist" aria-label="Registros de la persona">
          {PESTANAS.map((p) => (
            <button key={p} type="button" role="tab" id={`tab-${p}`} aria-selected={tab === p} aria-controls="panel-registros" onClick={() => {
                setTab(p);
                setSel(null);
              }}>
              {p}
            </button>
          ))}
        </div>
        <div id="panel-registros" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {indSel && filasSel && indSel.pestana === tab && (
            <div className={`filtro-activo${claseNuevo()}`} role="status">
              <p>
                Mostrando: <strong>{indSel.etiqueta.replace(/^…/, 'Propuestas que ')}</strong>
                {parteSel && <> · {parteSel.etiqueta}</>} · {fmt(filasSel.length)} {filasSel.length === 1 ? 'registro' : 'registros'}{' '}
                <button type="button" className="boton boton--chico" onClick={() => setSel(null)}>
                  ✕ Quitar filtro
                </button>
              </p>
              {indSel.partes && indSel.partes.length > 0 && (
                <div className="filtro-activo__partes" role="group" aria-label="Afinar el filtro">
                  {!indSel.partesHermanas && (
                    <button type="button" className="boton boton--chico" aria-pressed={!parteSel} onClick={() => setSel({ ind: indSel.id })}>
                      Todas ({fmt(indSel.filas!.length)})
                    </button>
                  )}
                  {indSel.partes.map((p) =>
                    p.filas.length === 0 ? (
                      <span key={p.id} className="boton boton--chico boton--inactivo" aria-disabled="true">
                        {p.etiqueta} (0)
                      </span>
                    ) : (
                      <button key={p.id} type="button" className="boton boton--chico" aria-pressed={parteSel?.id === p.id || (indSel.partesHermanas && !parteSel && p.filas === indSel.filas)} onClick={() => setSel({ ind: indSel.id, parte: p.id })}>
                        {p.etiqueta} ({fmt(p.filas.length)})
                      </button>
                    ),
                  )}
                </div>
              )}
              <p className="muy-pequeno texto-3">
                «Descargar CSV» baja solo estas filas. <Nuevo />
              </p>
            </div>
          )}
          {tab === 'Asistencias' && (
            <>
              {!asis.definitivo && !activo('Asistencias') && (
                <Aviso tipo="alerta">
                  {(() => {
                    const n = asis.pendientes + asis.sinRegistro + asis.noVerificadas;
                    return n === 1 ? 'Hay 1 sesión elegible sin registro verificable: no se cuenta como ausencia y queda fuera del porcentaje.' : `Hay ${n} sesiones elegibles sin registro verificable: no se cuentan como ausencias y quedan fuera del porcentaje.`;
                  })()}
                </Aviso>
              )}
              <TablaAsistencias registros={filasDe<RegistroAsistencia>('Asistencias', asis.registros)} titulo="Asistencias" archivo={archivoDe('Asistencias', 'asistencias')} conDiputado={false} />
            </>
          )}
          {tab === 'Asuntos' && (
            <>
              <TablaAsuntos asuntos={filasDe<Asunto>('Asuntos', asuntos)} titulo="Asuntos promovidos" archivo={archivoDe('Asuntos', 'asuntos')} resaltar={d.id_diputado} />
              {!activo('Asuntos') && <h3 style={{ marginTop: '1.5rem' }}>Dictámenes relacionados con sus iniciativas</h3>}
              {!activo('Asuntos') && <TablaAsuntos asuntos={ind.dictamenesRelacionados} titulo="Dictámenes relacionados" archivo={`dictamenes_${aSlug(d.nombre_completo)}_${periodoTxt}`} />}
            </>
          )}
          {tab === 'Exhortos' && <TablaAsuntos asuntos={filasDe<Asunto>('Exhortos', exh.map((x) => x.asunto))} titulo="Exhortos promovidos" archivo={archivoDe('Exhortos', 'exhortos')} resaltar={d.id_diputado} />}
          {tab === 'Intervenciones' && <TablaIntervenciones lista={filasDe<Intervencion>('Intervenciones', inter)} titulo="Intervenciones" archivo={archivoDe('Intervenciones', 'intervenciones')} conDiputado={false} />}
          {tab === 'Comisiones' && (
            <Tabla
              titulo="Comisiones"
              filas={filasDe<Integrante>('Comisiones', cargos)}
              clave={(c) => c.id_comision + c.fecha_inicio}
              archivo={archivoDe('Comisiones', 'comisiones')}
              columnas={[
                { id: 'com', titulo: 'Comisión', valor: (c) => base.idx.comision.get(c.id_comision)?.nombre ?? c.id_comision },
                { id: 'cargo', titulo: 'Cargo', valor: (c) => etiquetaDe(CARGOS_COMISION, c.cargo) },
                { id: 'ini', titulo: 'Desde', valor: (c) => c.fecha_inicio, render: (c) => fechaCorta(c.fecha_inicio) },
                { id: 'fin', titulo: 'Hasta', valor: (c) => c.fecha_fin, render: (c) => (c.fecha_fin ? fechaCorta(c.fecha_fin) : 'Vigente') },
                { id: 'f', titulo: 'Fuente', valor: (c) => c.id_fuente, render: (c) => <EnlaceFuente id={c.id_fuente} corto /> },
              ]}
              vacio="Sin participación en comisiones documentada."
            />
          )}
          {tab === 'Votaciones' && <TablaVotos votos={filasDe<Voto>('Votaciones', votos.votos)} titulo="Votos" archivo={archivoDe('Votaciones', 'votos')} conDiputado={false} />}
          {tab === 'Compromisos' && (
            <Tabla
              titulo="Compromisos"
              filas={filasDe<Compromiso>('Compromisos', comp)}
              clave={(c) => c.id_compromiso}
              archivo={archivoDe('Compromisos', 'compromisos')}
              columnas={[
                { id: 'desc', titulo: 'Compromiso', valor: (c) => c.descripcion },
                { id: 'o', titulo: 'Origen', valor: (c) => c.fecha_origen, render: (c) => fechaCorta(c.fecha_origen) },
                { id: 'l', titulo: 'Fecha límite', valor: (c) => c.fecha_limite, render: (c) => (c.fecha_limite ? fechaCorta(c.fecha_limite) : 'No establecida en la fuente') },
                { id: 'e', titulo: 'Seguimiento', valor: (c) => etiquetaDe(SEGUIMIENTO_COMPROMISO, c.estado_seguimiento), render: (c) => <InsigniaCatalogo catalogo={SEGUIMIENTO_COMPROMISO} valor={c.estado_seguimiento} /> },
                { id: 'f', titulo: 'Evidencia', valor: (c) => c.id_fuente, render: (c) => <><EnlaceFuente id={c.id_fuente} corto />{c.id_fuente_resultado && <> · <EnlaceFuente id={c.id_fuente_resultado} corto /></>}</> },
              ]}
              vacio="Sin compromisos públicos documentados."
            />
          )}
          {tab === 'Agenda' && (
            <Tabla
              titulo="Agenda pública"
              filas={agenda}
              clave={(a) => a.id_actividad}
              archivo={`agenda-${d.id_diputado}`}
              ordenInicial={{ id: 'f', desc: true }}
              columnas={[
                { id: 'f', titulo: 'Fecha', valor: (a) => a.fecha, render: (a) => fechaCorta(a.fecha) },
                { id: 't', titulo: 'Tipo', valor: (a) => a.tipo },
                { id: 'd', titulo: 'Descripción', valor: (a) => a.descripcion },
                { id: 'l', titulo: 'Lugar', valor: (a) => a.lugar },
                { id: 's', titulo: 'Fuente', valor: (a) => a.id_fuente, render: (a) => <EnlaceFuente id={a.id_fuente} corto /> },
              ]}
              vacio="Sin actividades públicas documentadas."
            />
          )}
          {tab === 'Fuentes' && (
            <Tabla
              titulo="Fuentes"
              filas={fuentes}
              clave={(e) => e.id_fuente}
              archivo={`fuentes-${d.id_diputado}`}
              columnas={[
                { id: 'id', titulo: 'ID', valor: (e) => e.id_fuente },
                { id: 't', titulo: 'Documento', valor: (e) => e.titulo, render: (e) => <EnlaceExterno url={e.url}>{e.titulo}</EnlaceExterno> },
                { id: 'i', titulo: 'Institución', valor: (e) => e.institucion },
                { id: 'o', titulo: 'Oficial', valor: (e) => (e.oficial === 'si' ? 'Sí' : e.oficial === 'no' ? 'No' : '—') },
                { id: 'c', titulo: 'Consultado', valor: (e) => e.fecha_consulta, render: (e) => fechaCorta(e.fecha_consulta) },
              ]}
            />
          )}
        </div>
      </section>
    </>
  );
}
