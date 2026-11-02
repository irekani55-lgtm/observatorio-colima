import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { DatosGenerales } from '../componentes/FichaDiputado';
import { BarraFiltros } from '../componentes/Filtros';
import { Foto } from '../componentes/Foto';
import { EnlaceExterno, EnlaceFuente } from '../componentes/Fuente';
import { InsigniaCatalogo } from '../componentes/Insignia';
import { Tabla } from '../componentes/Tabla';
import { TablaAsistencias, TablaAsuntos, TablaIntervenciones, TablaVotos } from '../componentes/TablasRegistros';
import { fmt, fmtPct } from '../componentes/Tarjeta';
import { CARGOS_COMISION, ESTADOS_VERIFICACION, SEGUIMIENTO_COMPROMISO, etiquetaDe } from '../config/catalogos';
import type { Diputado } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { asistenciaDeDiputado } from '../indicadores/asistencia';
import { asuntosDeDiputado, contarDecretosPublicados, indicadoresAsuntosDiputado, tiemposProcesales } from '../indicadores/asuntos';
import { participacionComisionesDiputado } from '../indicadores/comisiones';
import { compromisosFiltrados } from '../indicadores/compromisos';
import { fichasExhortos } from '../indicadores/exhortos';
import { fechaCorta, fechaEnPeriodo } from '../indicadores/filtro';
import { intervencionesFiltradas } from '../indicadores/intervenciones';
import { votosDeDiputado, votosDivididosDeDiputado } from '../indicadores/votaciones';
import { contarPorAlcance } from '../indicadores/clasificacion';
import { referenciaCongreso } from '../indicadores/distritos';
import { BarraComparada } from '../componentes/BarraComparada';

const PESTANAS = ['Asistencias', 'Asuntos', 'Exhortos', 'Intervenciones', 'Comisiones', 'Votaciones', 'Compromisos', 'Agenda', 'Fuentes'] as const;

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string | number | null; detalle?: string }) {
  return (
    <>
      <dt>{etiqueta}</dt>
      <dd>
        <strong className="num">{valor == null ? 'Pendiente' : typeof valor === 'number' ? fmt(valor) : valor}</strong>
        {detalle && <span className="texto-3 muy-pequeno"> · {detalle}</span>}
      </dd>
    </>
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
  const [tab, setTab] = useState<(typeof PESTANAS)[number]>('Asistencias');

  const calc = useMemo(() => {
    const asis = asistenciaDeDiputado(base, d, periodo);
    const ind = indicadoresAsuntosDiputado(base, d, periodo);
    const asuntos = asuntosDeDiputado(base, d.id_diputado, periodo);
    const inter = intervencionesFiltradas(base, periodo).filter((i) => i.id_diputado === d.id_diputado);
    const votos = votosDeDiputado(base, d.id_diputado, periodo);
    const com = participacionComisionesDiputado(base, d.id_diputado, periodo);
    const exh = fichasExhortos(base, periodo).filter((x) => x.asunto.promoventes.some((p) => p.id_diputado === d.id_diputado && (p.rol === 'autor' || p.rol === 'coautor')));
    const comp = compromisosFiltrados(base, periodo, d.id_diputado);
    const tiempos = tiemposProcesales(ind.iniciativasPresentadas.asuntos);
    const agenda = base.agenda.filter((a) => a.id_diputado === d.id_diputado && fechaEnPeriodo(a.fecha, periodo));
    const alcance = contarPorAlcance(ind.iniciativasPresentadas.asuntos);
    const div = votosDivididosDeDiputado(base, d.id_diputado, periodo);
    const ref = referenciaCongreso(base, periodo);
    return { asis, ind, asuntos, inter, votos, com, exh, comp, tiempos, agenda, alcance, div, ref };
  }, [base, d, periodo.anio, periodo.desde, periodo.hasta]); // eslint-disable-line react-hooks/exhaustive-deps
  const { asis, ind, asuntos, inter, votos, com, exh, comp, tiempos, agenda, alcance, div, ref } = calc;

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
        <BarraFiltros campos={['anio']} />
        <div className="perfil-tareas">
          <div className="panel dimension">
            <h3 className="ficha__funcion">
              <span className="ficha__funcion-num" aria-hidden="true">1</span>
              Hacer leyes
            </h3>
            <dl className="definiciones">
              <Dato etiqueta="Propuestas de ley presentadas" valor={ind.iniciativasPresentadas.total} detalle={`${ind.iniciativasPresentadas.individuales} solo de esta persona, ${ind.iniciativasPresentadas.compartidos} con otras`} />
              <Dato etiqueta="…que cambian o crean leyes" valor={alcance.fondo} detalle={`${alcance.tramite} trámites, ${alcance.conmemorativa} reconocimientos`} />
              <Dato etiqueta="Lo más común en el Congreso" valor={ref.medianaIniciativas == null ? null : `${fmt(ref.medianaIniciativas)} propuestas`} />
              <Dato etiqueta="Aprobadas por el Congreso" valor={ind.iniciativasAprobadas.total} />
              <Dato etiqueta="Ya publicadas como ley o decreto" valor={contarDecretosPublicados(ind.iniciativasPresentadas.asuntos)} />
              <Dato etiqueta="Todavía sin resolver" valor={ind.iniciativasPendientes.total} />
              <Dato etiqueta="Tiempo típico hasta aprobarse" valor={tiempos.presentacionAprobacion.mediana == null ? 'Sin casos todavía' : `${fmt(tiempos.presentacionAprobacion.mediana)} días`} detalle={tiempos.presentacionAprobacion.casos ? `mediana de ${tiempos.presentacionAprobacion.casos} ${tiempos.presentacionAprobacion.casos === 1 ? 'caso' : 'casos'}` : undefined} />
              <Dato etiqueta="Votos escritos con su nombre en el acta" valor={votos.total} detalle={`${votos.porSentido.favor} a favor, ${votos.porSentido.contra} en contra, ${votos.porSentido.abstencion} abstenciones`} />
              <Dato etiqueta="En votaciones divididas" valor={div.divididas ? `${fmt(div.conVoto)} de ${fmt(div.divididas)}` : null} detalle={div.conVoto ? `${div.porSentido.favor} a favor, ${div.porSentido.contra} en contra, ${div.porSentido.abstencion} abstenciones` : undefined} />
            </dl>
            <p className="muy-pequeno">
              <Link to="/metodologia#clasificacion-propuestas">¿Cómo separamos las propuestas?</Link> · <Link to="/metodologia#votaciones-divididas">¿Qué es una votación dividida?</Link>
            </p>
          </div>
          <div className="panel dimension">
            <h3 className="ficha__funcion">
              <span className="ficha__funcion-num" aria-hidden="true">2</span>
              Representar
            </h3>
            <dl className="definiciones">
              <dt>Asistencia a las sesiones</dt>
              <dd>
                <strong className="num">{asis.porcentaje == null ? 'Pendiente' : fmtPct(asis.porcentaje)}</strong>
                <span className="texto-3 muy-pequeno">
                  {' '}
                  · {asis.asistencias} de {asis.denominador}
                  {asis.definitivo ? '' : ' · provisional'}
                </span>
                {asis.porcentaje != null && <BarraComparada valor={asis.porcentaje} referencia={ref.asistencia} />}
              </dd>
              <Dato etiqueta="Faltas" valor={asis.ausencias + asis.justificadas} detalle={`${asis.justificadas} con permiso, ${asis.ausencias} sin permiso`} />
              <Dato etiqueta="Veces que habló ante el Congreso" valor={inter.length} />
              <Dato etiqueta="Comisiones de las que forma parte" valor={com.cargos.length} />
              <Dato etiqueta="Asistencia a reuniones de comisión" valor={com.porcentaje == null ? null : fmtPct(com.porcentaje)} detalle={`${com.asistencias} de ${com.evaluables} reuniones con lista`} />
            </dl>
          </div>
          <div className="panel dimension">
            <h3 className="ficha__funcion">
              <span className="ficha__funcion-num" aria-hidden="true">3</span>
              Vigilar al gobierno
            </h3>
            <dl className="definiciones">
              <Dato etiqueta="Exhortos presentados" valor={ind.exhortosPresentados.total} />
              <Dato etiqueta="Exhortos aprobados" valor={ind.exhortosAprobados.total} detalle={ind.exhortosAprobadosSinVerificar ? `+${ind.exhortosAprobadosSinVerificar} sin verificar` : undefined} />
              <Dato etiqueta="Exhortos con respuesta de la autoridad" valor={exh.filter((x) => x.seguimiento === 'con_respuesta' || x.seguimiento === 'con_acciones').length} />
              <Dato etiqueta="Puntos de acuerdo" valor={ind.puntosAcuerdo.total} />
              <Dato etiqueta="Compromisos con avance documentado" valor={comp.filter((c) => c.estado_seguimiento === 'cumplido_documentado' || c.estado_seguimiento === 'avance_documentado').length} detalle={`de ${comp.length} registrados`} />
            </dl>
            <p className="muy-pequeno texto-3">Un exhorto es una petición a otra autoridad para que atienda un problema. Aprobarlo no obliga a la autoridad a atenderlo.</p>
          </div>
        </div>
      </section>

      <section className="seccion">
        <h2>Registros</h2>
        <div className="pestanas" role="tablist" aria-label="Registros de la persona">
          {PESTANAS.map((p) => (
            <button key={p} type="button" role="tab" id={`tab-${p}`} aria-selected={tab === p} aria-controls="panel-registros" onClick={() => setTab(p)}>
              {p}
            </button>
          ))}
        </div>
        <div id="panel-registros" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'Asistencias' && (
            <>
              {!asis.definitivo && <Aviso tipo="alerta">Hay {asis.pendientes + asis.sinRegistro + asis.noVerificadas} sesiones elegibles sin registro verificable: no se cuentan como ausencias y quedan fuera del porcentaje.</Aviso>}
              <TablaAsistencias registros={asis.registros} titulo="Asistencias" archivo={`asistencias-${d.id_diputado}`} conDiputado={false} />
            </>
          )}
          {tab === 'Asuntos' && (
            <>
              <TablaAsuntos asuntos={asuntos} titulo="Asuntos promovidos" archivo={`asuntos-${d.id_diputado}`} resaltar={d.id_diputado} />
              <h3 style={{ marginTop: '1.5rem' }}>Dictámenes relacionados con sus iniciativas</h3>
              <TablaAsuntos asuntos={ind.dictamenesRelacionados} titulo="Dictámenes relacionados" archivo={`dictamenes-${d.id_diputado}`} />
            </>
          )}
          {tab === 'Exhortos' && <TablaAsuntos asuntos={exh.map((x) => x.asunto)} titulo="Exhortos promovidos" archivo={`exhortos-${d.id_diputado}`} resaltar={d.id_diputado} />}
          {tab === 'Intervenciones' && <TablaIntervenciones lista={inter} titulo="Intervenciones" archivo={`intervenciones-${d.id_diputado}`} conDiputado={false} />}
          {tab === 'Comisiones' && (
            <Tabla
              titulo="Comisiones"
              filas={com.cargos}
              clave={(c) => c.id_comision + c.fecha_inicio}
              archivo={`comisiones-${d.id_diputado}`}
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
          {tab === 'Votaciones' && <TablaVotos votos={votos.votos} titulo="Votos" archivo={`votos-${d.id_diputado}`} conDiputado={false} />}
          {tab === 'Compromisos' && (
            <Tabla
              titulo="Compromisos"
              filas={comp}
              clave={(c) => c.id_compromiso}
              archivo={`compromisos-${d.id_diputado}`}
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
