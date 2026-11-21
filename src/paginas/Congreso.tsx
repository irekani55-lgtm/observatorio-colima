import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Aviso } from '../componentes/Aviso';
import { colorPartido, COLOR_TIPO_ASUNTO, SERIES } from '../componentes/colores';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { enlaceConPeriodo } from '../componentes/FichaDiputado';
import { BarraFiltros } from '../componentes/Filtros';
import { etiquetaMes, GraficaBarras, GraficaLineas, Leyenda, PanelGrafica } from '../componentes/Graficas';
import { fmt, fmtPct, Tarjeta } from '../componentes/Tarjeta';
import { ESTADOS_PROCESALES, TIPOS_ASUNTO, etiquetaDe } from '../config/catalogos';
import { ANIOS_LEGISLATIVOS, LEGISLATURA } from '../config/legislatura';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { asistenciaAgregada } from '../indicadores/asistencia';
import { asuntosFiltrados, esAprobado, idsDiputadosPromoventes, resumenAsuntos } from '../indicadores/asuntos';
import { coberturaEvidencia } from '../indicadores/evidencia';
import { diputadosFiltrados, enFunciones, fechaEnPeriodo } from '../indicadores/filtro';
import { NotaTablaDistritos, TablaDistritos } from './Mapa';
import { IndicadoresDetallados } from './Eficacia';
import { PreguntasCongreso } from './PreguntasCongreso';
import { CuantoGana } from '../componentes/CuantoGana';
import { ejercioEnPeriodo, TablaComparativa } from './Directorio';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';

const recortar = (v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v);

/** Nombre corto de una comisión para etiquetas de gráfica («Hacienda, Fiscalización y Cuenta Pública» → «Hacienda»). */
export function nombreCorto(nombre: string): string {
  const especiales: Record<string, string> = {
    'Estudios Legislativos y Puntos Constitucionales': 'Estudios Legislativos',
    'Vigilancia del Órgano Superior de Auditoria y Fiscalización Gubernamental del Estado': 'Vigilancia del OSAFIG',
    'Anticorrupción y Transparencia Gubernamental': 'Anticorrupción',
    'Peticiones y Participación Ciudadana': 'Peticiones',
    'Protección y Derecho al Agua': 'Derecho al Agua',
    'Seguridad Pública y Protección Civil': 'Seguridad Pública',
    'Presupuesto y Disciplina Financiera': 'Presupuesto',
  };
  const limpio = nombre.replace(/\s+/g, ' ').replace(/^Comisi[oó]n(es)? de /i, '').trim();
  if (especiales[limpio]) return especiales[limpio];
  const corte = limpio.split(',')[0].trim();
  return corte.length > 28 ? `${corte.slice(0, 27)}…` : corte;
}
const TIPOS_GRAFICA = ['iniciativa', 'exhorto', 'punto_acuerdo', 'dictamen'] as const;

export default function Congreso() {
  const { base } = useDatos();
  const [filtro] = useFiltro();
  const [agrupar, setAgrupar] = useState<'diputado' | 'partido'>('partido');

  const dips = diputadosFiltrados(base, filtro);
  const dipsComparar = dips.filter((d) => ejercioEnPeriodo(d, filtro));
  const asis = useMemo(() => asistenciaAgregada(base, dips, filtro), [base, dips, filtro]);
  const asuntos = useMemo(() => asuntosFiltrados(base, filtro), [base, filtro]);
  const res = resumenAsuntos(asuntos);
  const evid = coberturaEvidencia(base);
  const hayAsuntos = base.asuntos.length > 0;
  const enFuncionesHoy = dips.filter((d) => enFunciones(d, base.manifiesto.fecha_corte)).length;

  // --- Actividad por año legislativo
  const porAnio = ANIOS_LEGISLATIVOS.anios.map((a) => {
    const fila: Record<string, string | number> = { anio: a.etiqueta.replace(/ \(.*\)/, '') + ` (${a.inicio.slice(0, 4)}–${a.fin.slice(2, 4)})` };
    for (const t of TIPOS_GRAFICA) fila[t] = asuntos.filter((x) => x.tipo === t && x.anio_legislativo === a.numero).length;
    return fila;
  });
  const sinAnio = asuntos.filter((x) => !x.anio_legislativo).length;

  // --- Estado procesal
  const porEstado = Object.keys(ESTADOS_PROCESALES)
    .map((k) => ({ estado: etiquetaDe(ESTADOS_PROCESALES, k), total: res.porEstado[k] ?? 0 }))
    .filter((x) => x.total > 0);

  // --- Iniciativas por tema: las 10 comisiones con más iniciativas y el resto agrupado, con nombres cortos.
  const temas = new Map<string, number>();
  for (const a of asuntos) if (a.tipo === 'iniciativa') temas.set(a.tema || 'Sin tema', (temas.get(a.tema || 'Sin tema') ?? 0) + 1);
  const ordenTemas = [...temas.entries()].sort((a, b) => b[1] - a[1]);
  const porTema = ordenTemas.slice(0, 10).map(([tema, total]) => ({ tema: nombreCorto(tema), nombre: tema, total }));
  if (ordenTemas.length > 10) porTema.push({ tema: 'Otras comisiones', nombre: ordenTemas.slice(10).map(([t]) => t).join('; '), total: ordenTemas.slice(10).reduce((s_, [, n]) => s_ + n, 0) });

  // --- Actividad por diputado o partido (asuntos únicos por grupo)
  const actividad = useMemo(() => {
    const grupos = new Map<string, { iniciativa: Set<string>; exhorto: Set<string>; punto_acuerdo: Set<string> }>();
    for (const a of asuntos) {
      if (a.tipo !== 'iniciativa' && a.tipo !== 'exhorto' && a.tipo !== 'punto_acuerdo') continue;
      for (const id of idsDiputadosPromoventes(a)) {
        const d = base.idx.diputado.get(id);
        if (!d || !dips.includes(d)) continue;
        const k = agrupar === 'partido' ? d.id_partido : d.id_diputado;
        if (!grupos.has(k)) grupos.set(k, { iniciativa: new Set(), exhorto: new Set(), punto_acuerdo: new Set() });
        grupos.get(k)![a.tipo].add(a.id_asunto);
      }
    }
    return [...grupos.entries()]
      .map(([k, g]) => {
        const d = base.idx.diputado.get(k);
        const nombre = agrupar === 'partido' ? (base.idx.partido.get(k)?.siglas ?? k) : (d?.nombre_completo ?? k);
        return { clave: k, nombre, partido: agrupar === 'partido' ? k : (d?.id_partido ?? ''), iniciativa: g.iniciativa.size, exhorto: g.exhorto.size, punto_acuerdo: g.punto_acuerdo.size, total: g.iniciativa.size + g.exhorto.size + g.punto_acuerdo.size };
      })
      .sort((a, b) => b.total - a.total);
  }, [asuntos, agrupar, base, dips]);

  // --- Evolución mensual
  const evolucion = useMemo(() => {
    const m = new Map<string, { presentados: number; aprobados: number }>();
    const flujo = asuntos.filter((a) => a.tipo === 'iniciativa' || a.tipo === 'exhorto' || a.tipo === 'punto_acuerdo');
    const sumar = (mes: string, k: 'presentados' | 'aprobados') => {
      if (!m.has(mes)) m.set(mes, { presentados: 0, aprobados: 0 });
      m.get(mes)![k]++;
    };
    for (const a of flujo) {
      if (a.fecha_presentacion) sumar(a.fecha_presentacion.slice(0, 7), 'presentados');
      if (esAprobado(a) && a.fecha_aprobacion && fechaEnPeriodo(a.fecha_aprobacion, filtro)) sumar(a.fecha_aprobacion.slice(0, 7), 'aprobados');
    }
    const meses = [...m.keys()].sort();
    if (meses.length === 0) return [];
    // Rellena meses sin actividad para no unir puntos lejanos.
    const salida: { mes: string; presentados: number; aprobados: number }[] = [];
    for (let [a, mm] = meses[0].split('-').map(Number); `${a}-${String(mm).padStart(2, '0')}` <= meses[meses.length - 1]; mm === 12 ? ((a += 1), (mm = 1)) : (mm += 1)) {
      const k = `${a}-${String(mm).padStart(2, '0')}`;
      salida.push({ mes: k, ...(m.get(k) ?? { presentados: 0, aprobados: 0 }) });
    }
    return salida;
  }, [asuntos, filtro]);

  const seriesTipo = TIPOS_GRAFICA.map((t) => ({ clave: t, etiqueta: etiquetaDe(TIPOS_ASUNTO, t), color: COLOR_TIPO_ASUNTO[t] }));
  const seriesAct = (['iniciativa', 'exhorto', 'punto_acuerdo'] as const).map((t) => ({ clave: t, etiqueta: etiquetaDe(TIPOS_ASUNTO, t), color: COLOR_TIPO_ASUNTO[t] }));
  const partidosEnGrafica = [...new Set(actividad.map((x) => x.partido))];

  return (
    <>
      <EncabezadoPagina titulo="El Congreso en números">
        <p>Preguntas sobre lo que hace el Congreso de Colima en esta Legislatura ({LEGISLATURA.periodo}), contestadas con documentos oficiales. Para ver a una persona en particular, búsquela en el <Link to="/">inicio</Link>.</p>
      </EncabezadoPagina>
      <CuantoGana />
      <BarraFiltros campos={['anio']} />
      <PreguntasCongreso />

      <section className={`seccion${claseNuevo()}`} aria-labelledby="titulo-a-fondo">
        <h2 id="titulo-a-fondo">Para revisar a fondo</h2>
        <p className="seccion__intro">Las tablas y gráficas completas, para periodistas, estudiantes y quien quiera revisar cada número.</p>
        <Nuevo texto="lo técnico quedó aquí, guardado" />
        <details className="desplegable" id="totales">
          <summary>Todos los totales y las gráficas detalladas</summary>
          <div style={{ marginTop: '0.75rem' }}>
            <BarraFiltros campos={['partido', 'representacion']} />

          <div className="rejilla rejilla--tarjetas">
            <Tarjeta
              titulo="Diputaciones"
              valor={base.diputados.length ? fmt(enFuncionesHoy) : null}
              detalle={dips.length > enFuncionesHoy ? `Además, ${fmt(dips.length - enFuncionesHoy)} ocuparon un lugar durante una licencia` : undefined}
              explica="Incluye a quienes entraron por una licencia (suplentes de distrito y sustitutos de la lista de un partido); por eso puede superar el número de curules."
              enlace={{ a: '/diputaciones', texto: 'Ver directorio' }}
            />
            <Tarjeta
              titulo="Asistencia a sesiones del Pleno"
              valor={asis.porcentaje == null ? null : fmtPct(asis.porcentaje)}
              pendiente={base.sesiones.length ? 'Pendiente de verificación' : 'Información pendiente de integración'}
              detalle={
                <>
                  {fmt(asis.asistencias)} de {fmt(asis.denominador)} registros evaluables
                  {!asis.definitivo && <strong> · Provisional: {fmt(asis.pendientes + asis.sinRegistro + asis.noVerificadas)} registros sin verificar</strong>}
                </>
              }
              explica="Asistencias registradas ÷ sesiones elegibles con información verificable."
              enlace={{ a: enlaceConPeriodo('/asistencias', filtro), texto: 'Ver asistencias' }}
            />
            <Tarjeta titulo="Iniciativas presentadas" valor={hayAsuntos ? fmt(res.iniciativasPresentadas) : null} explica="Iniciativas únicas presentadas en el periodo, de cualquier promovente." enlace={{ a: enlaceConPeriodo('/asuntos', filtro, { tipo: 'iniciativa' }), texto: 'Ver iniciativas' }} />
            <Tarjeta
              titulo="Iniciativas aprobadas"
              valor={hayAsuntos ? fmt(res.iniciativasAprobadas) : null}
              detalle={res.iniciativasPresentadas ? `${fmtPct((res.iniciativasAprobadas / res.iniciativasPresentadas) * 100)} de las presentadas en el periodo` : undefined}
              explica="Aprobadas por el Pleno (incluye las ya publicadas)."
              enlace={{ a: enlaceConPeriodo('/asuntos', filtro, { tipo: 'iniciativa', estado: 'aprobados' }), texto: 'Ver aprobadas' }}
            />
            <Tarjeta titulo="Dictámenes aprobados" valor={hayAsuntos ? fmt(res.dictamenesAprobados) : null} explica="Dictámenes de comisión aprobados por el Pleno." enlace={{ a: enlaceConPeriodo('/asuntos', filtro, { tipo: 'dictamen', estado: 'aprobados' }), texto: 'Ver dictámenes' }} />
            <Tarjeta titulo="Exhortos aprobados" valor={hayAsuntos ? fmt(res.exhortosAprobados) : null} explica="Aprobación del Congreso; no implica que la autoridad lo haya atendido." enlace={{ a: enlaceConPeriodo('/exhortos', filtro), texto: 'Ver exhortos' }} />
            <Tarjeta titulo="Decretos publicados" valor={hayAsuntos ? fmt(res.decretosPublicados) : null} explica="Números de decreto únicos publicados en el Periódico Oficial, cuando corresponde." enlace={{ a: enlaceConPeriodo('/asuntos', filtro, { estado: 'publicado' }), texto: 'Ver publicados' }} />
            <Tarjeta titulo="Asuntos pendientes" valor={hayAsuntos ? fmt(res.pendientes) : null} explica="Presentados, turnados o dictaminados que aún no se resuelven en el Pleno." enlace={{ a: enlaceConPeriodo('/asuntos', filtro, { estado: 'pendientes' }), texto: 'Ver pendientes' }} />
            <Tarjeta
              titulo="Registros con evidencia verificable"
              valor={evid.porcentaje == null ? null : fmtPct(evid.porcentaje)}
              detalle={`${fmt(evid.conEvidencia)} de ${fmt(evid.total)} registros enlazan a un documento`}
              explica="Toda la base, sin filtros: registros cuya fuente existe y tiene URL."
              enlace={{ a: '/fuentes', texto: 'Ver calidad de datos' }}
            />
          </div>

          {(filtro.partido || filtro.tipoRepresentacion) && (
            <Aviso>Con filtro de partido o representación, los asuntos se cuentan si al menos un promovente cumple el filtro. Un asunto compartido entre partidos aparece en ambos.</Aviso>
          )}

            <div className="rejilla rejilla--2">
              <PanelGrafica titulo="Actividad legislativa por año" nota={`Asuntos únicos por año legislativo, según su fecha de presentación.${sinAnio ? ` ${sinAnio} asuntos sin fecha válida no se ubican en un año.` : ''}`} datos={porAnio} columnas={[{ clave: 'anio', etiqueta: 'Año legislativo' }, ...seriesTipo.map((s) => ({ clave: s.clave, etiqueta: s.etiqueta }))]} vacio={asuntos.length === 0}>
                <GraficaBarras datos={porAnio} claveX="anio" series={seriesTipo} />
              </PanelGrafica>

              <PanelGrafica titulo="Asuntos por estado procesal" nota="Estado actual documentado de todos los asuntos del periodo." datos={porEstado} columnas={[{ clave: 'estado', etiqueta: 'Estado' }, { clave: 'total', etiqueta: 'Asuntos' }]}>
                <GraficaBarras datos={porEstado} claveX="estado" series={[{ clave: 'total', etiqueta: 'Asuntos', color: SERIES[0] }]} horizontal anchoEtiqueta={170} />
              </PanelGrafica>

              <PanelGrafica
                titulo="Iniciativas por tema"
                nota="El tema es la comisión principal a la que se turnó cada iniciativa. Se muestran las 10 con más iniciativas; el resto se agrupa en «Otras comisiones». El nombre completo aparece al pasar el cursor y en la tabla."
                datos={porTema}
                columnas={[{ clave: 'nombre', etiqueta: 'Comisión' }, { clave: 'total', etiqueta: 'Iniciativas' }]}
              >
                <GraficaBarras datos={porTema} claveX="tema" series={[{ clave: 'total', etiqueta: 'Iniciativas', color: SERIES[0] }]} horizontal anchoEtiqueta={160} alto={porTema.length * 34 + 50} etiquetaX={(v) => porTema.find((x) => x.tema === v)?.nombre ?? v} etiquetaEje={(v) => v} />
              </PanelGrafica>

              <PanelGrafica titulo="Evolución de los asuntos legislativos" nota="Iniciativas, exhortos y puntos de acuerdo presentados y aprobados por mes (los dictámenes no se suman para no contar dos veces el mismo asunto)." datos={evolucion} columnas={[{ clave: 'mes', etiqueta: 'Mes' }, { clave: 'presentados', etiqueta: 'Presentados' }, { clave: 'aprobados', etiqueta: 'Aprobados' }]}>
                <GraficaLineas datos={evolucion} claveX="mes" etiquetaX={etiquetaMes} series={[{ clave: 'presentados', etiqueta: 'Presentados', color: SERIES[0] }, { clave: 'aprobados', etiqueta: 'Aprobados', color: SERIES[1] }]} />
              </PanelGrafica>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <PanelGrafica
                titulo={agrupar === 'partido' ? 'Asuntos presentados por partido' : 'Asuntos presentados por diputada o diputado'}
                nota={
                  <>
                    Asuntos únicos en los que el grupo o la persona figura como autora o coautora. Un asunto compartido cuenta para cada promovente, así que la suma de barras puede superar el total. <strong>Describe actividad documentada; no mide calidad ni impacto.</strong>
                  </>
                }
                datos={actividad}
                columnas={[{ clave: 'nombre', etiqueta: agrupar === 'partido' ? 'Partido' : 'Persona' }, ...seriesAct.map((s) => ({ clave: s.clave, etiqueta: s.etiqueta })), { clave: 'total', etiqueta: 'Total' }]}
              >
                <div className="fila-flex" role="group" aria-label="Agrupar por" style={{ marginBottom: '0.5rem' }}>
                  <span className="pequeno texto-2">Agrupar por:</span>
                  <button type="button" className="boton boton--chico" aria-pressed={agrupar === 'partido'} onClick={() => setAgrupar('partido')}>
                    Partido
                  </button>
                  <button type="button" className="boton boton--chico" aria-pressed={agrupar === 'diputado'} onClick={() => setAgrupar('diputado')}>
                    Diputada o diputado
                  </button>
                </div>
                <GraficaBarras datos={actividad} claveX="nombre" series={seriesAct} horizontal apilado anchoEtiqueta={agrupar === 'partido' ? 70 : 190} etiquetaEje={agrupar === 'diputado' ? recortar : undefined} />
                {agrupar === 'diputado' && (
                  <>
                    <p className="muy-pequeno texto-3">Partido de cada persona:</p>
                    <Leyenda series={partidosEnGrafica.map((p) => ({ clave: p, etiqueta: base.idx.partido.get(p)?.siglas ?? p, color: colorPartido(base, p) }))} />
                    <ul className="lista-limpia muy-pequeno texto-2" style={{ columns: '14rem', marginTop: '0.25rem' }}>
                      {actividad.map((x) => (
                        <li key={x.clave}>
                          <span className="punto" style={{ background: colorPartido(base, x.partido), marginRight: 6 }} />
                          <Link to={`/diputaciones/${encodeURIComponent(x.clave)}`}>{x.nombre}</Link> · {base.idx.partido.get(x.partido)?.siglas}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </PanelGrafica>
            </div>
          </div>
        </details>
        <details className="desplegable" id="distritos">
          <summary>Comparar los 16 distritos</summary>
          <div style={{ marginTop: '0.75rem' }}>
            <NotaTablaDistritos />
            <TablaDistritos />
          </div>
        </details>
        <details className="desplegable" id="comparar">
          <summary>Comparar a las diputaciones, dato por dato</summary>
          <div style={{ marginTop: '0.75rem' }}>
            <p className="seccion__intro">Cada columna se ordena por separado. Sirve para ver diferencias, no para decir quién trabaja mejor.</p>
            <TablaComparativa lista={dipsComparar} />
          </div>
        </details>
        <details className="desplegable" id="indicadores">
          <summary>Indicadores detallados: cómo se calcula cada número y sus límites</summary>
          <div style={{ marginTop: '0.75rem' }}>
            <IndicadoresDetallados />
          </div>
        </details>
      </section>
    </>
  );
}
