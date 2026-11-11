import { useMemo } from 'react';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
import { Aviso } from '../componentes/Aviso';
import { colorPartido, SERIES } from '../componentes/colores';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { BarraFiltros, FiltroParam } from '../componentes/Filtros';
import { EnlaceFuente } from '../componentes/Fuente';
import { GraficaBarras, Leyenda, PanelGrafica } from '../componentes/Graficas';
import { Tabla } from '../componentes/Tabla';
import { TablaAsistencias } from '../componentes/TablasRegistros';
import { fmt, fmtPct, Tarjeta } from '../componentes/Tarjeta';
import { ESTADOS_ASISTENCIA, PERIODOS_SESION, TIPOS_SESION, etiquetaDe } from '../config/catalogos';
import type { Sesion } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { asistenciaAgregada, asistenciaDeDiputado, sesionesElegibles } from '../indicadores/asistencia';
import { diputadosFiltrados, fechaCorta, sesionEnPeriodo } from '../indicadores/filtro';

export default function Asistencias() {
  const { base } = useDatos();
  const [filtro, , params] = useFiltro();
  const idDip = params.get('diputado') ?? '';
  const estado = params.get('estado') ?? '';
  const periodoSesion = params.get('periodo_sesion') ?? '';

  const dips = diputadosFiltrados(base, filtro).filter((d) => !idDip || d.id_diputado === idDip);
  const res = useMemo(() => asistenciaAgregada(base, dips, filtro), [base, dips, filtro]);
  const registros = res.registros.filter((r) => (!estado || r.estado === estado) && (!periodoSesion || r.sesion.periodo === periodoSesion));
  const elegibles = sesionesElegibles(base, filtro);

  const porPersona = useMemo(
    () =>
      dips
        .map((d) => {
          const r = asistenciaDeDiputado(base, d, filtro);
          const siglas = base.idx.partido.get(d.id_partido)?.siglas ?? d.id_partido;
          const corto = d.nombre_completo.length > 24 ? `${d.nombre_completo.slice(0, 23)}…` : d.nombre_completo;
          return { nombre: d.nombre_completo, partido: siglas, id_partido: d.id_partido, etiqueta: `${corto} (${siglas})`, id: d.id_diputado, porcentaje: r.porcentaje == null ? null : Math.round(r.porcentaje * 10) / 10, evaluables: r.denominador, sinVerificar: r.pendientes + r.noVerificadas + r.sinRegistro };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [base, dips, filtro],
  );

  const sesiones = base.sesiones.filter((s) => sesionEnPeriodo(s, filtro) && (!periodoSesion || s.periodo === periodoSesion));
  const conteoSesion = useMemo(() => {
    const m = new Map<string, { asis: number; total: number }>();
    for (const a of base.asistencias) {
      const c = m.get(a.id_sesion) ?? { asis: 0, total: 0 };
      c.total++;
      if (a.estado === 'asistencia') c.asis++;
      m.set(a.id_sesion, c);
    }
    return m;
  }, [base]);

  return (
    <>
      <EncabezadoPagina titulo="¿Quién asiste a las sesiones?">
        <p className={claseNuevo()}>
          Aquí puede ver si cada diputada o diputado estuvo en las sesiones, que son las reuniones donde todo el Congreso discute y vota. Importa porque quien no está, no puede votar ni hablar por la gente que representa.
          <Nuevo texto="en palabras sencillas" />
        </p>
      </EncabezadoPagina>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem' }}>¿Cómo se calcula?</h2>
        <p className="pequeno" style={{ marginTop: 0 }}>
          Contamos en cuántas sesiones asistió la persona y lo dividimos entre las sesiones que le tocaban (asistió + faltó con permiso + faltó sin permiso). Si no tenemos la lista de una sesión, <strong>no la contamos como falta</strong>.
        </p>
        <details className="saber-mas">
          <summary>Saber más</summary>
          <p className="pequeno">
            Solo cuentan las sesiones en que la persona estaba en el cargo. No se cuentan las de la Comisión Permanente (el grupo pequeño que se reúne cuando el Congreso está de descanso), porque no todas las diputaciones forman parte. La numeración de
            las sesiones empieza de nuevo cada año; por eso cada sesión tiene una clave propia.
          </p>
        </details>
      </div>

      <Aviso titulo="La lista oficial se toma al final">
        Una falta significa que la persona no estaba cuando se pasó lista la última vez; pudo estar antes y salir, o llegar después.
        <details className="saber-mas">
          <summary>Saber más</summary>
          <p>
            La lista de asistencia que publica el Congreso coincide con el último pase de lista de cada sesión en el 99.5&nbsp;% de los casos. Por eso alguien con falta pudo estar al inicio y votar. Cuando el acta dice que votó, lo anotamos en la
            columna de observaciones, sin cambiar el dato oficial. Los casos en que la página del Congreso mezclaba dos sesiones se resolvieron con el acta de cada sesión (vea la bitácora en Fuentes).
          </p>
        </details>
      </Aviso>

      <BarraFiltros extraLimpiar={['diputado', 'estado', 'periodo_sesion']}>
        <FiltroParam id="diputado" etiqueta="Diputada o diputado" ancho opciones={base.diputados.map((d) => ({ valor: d.id_diputado, etiqueta: d.nombre_completo }))} />
        <FiltroParam id="estado" etiqueta="Estado del registro" opciones={[...Object.entries(ESTADOS_ASISTENCIA).map(([k, v]) => ({ valor: k, etiqueta: v.etiqueta as string })), { valor: 'sin_registro', etiqueta: 'Sin registro capturado' }]} />
        <FiltroParam id="periodo_sesion" etiqueta="Periodo de sesiones" opciones={Object.entries(PERIODOS_SESION).map(([k, v]) => ({ valor: k, etiqueta: v.etiqueta }))} />
      </BarraFiltros>

      {base.sesiones.length === 0 && (
        <Aviso tipo="alerta" titulo="Información pendiente de integración">
          No hay sesiones cargadas (<code>sesiones.csv</code>), por lo que no puede calcularse la asistencia.
        </Aviso>
      )}
      {!res.definitivo && res.sesionesElegibles > 0 && (
        <Aviso tipo="alerta" titulo="El porcentaje todavía puede cambiar">
          En {fmt(res.pendientes + res.sinRegistro + res.noVerificadas)} de {fmt(res.sesionesElegibles)} casos todavía no tenemos una lista confiable. No cuentan como falta; el porcentaje puede cambiar cuando los revisemos.
        </Aviso>
      )}

      <div className="rejilla rejilla--tarjetas">
        <Tarjeta titulo="Asistencia" valor={res.porcentaje == null ? null : fmtPct(res.porcentaje)} pendiente="Pendiente de verificación" detalle={`${fmt(res.asistencias)} ÷ ${fmt(res.denominador)} registros evaluables`} explica={res.definitivo ? 'Cálculo con todos los registros verificados.' : 'Provisional: hay registros fuera del denominador.'} />
        <Tarjeta titulo="Sesiones elegibles" valor={fmt(elegibles.length)} detalle={`${fmt(res.sesionesElegibles)} registros persona–sesión esperados`} explica="Sesiones del periodo marcadas como elegibles para el indicador." />
        <Tarjeta titulo="Asistencias registradas" valor={fmt(res.asistencias)} />
        <Tarjeta titulo="Ausencias registradas" valor={fmt(res.ausencias)} explica="Sin justificación documentada." />
        <Tarjeta titulo="Justificadas" valor={fmt(res.justificadas)} explica="Ausencias con justificación pública. Forman parte del denominador." />
        <Tarjeta titulo="Pendientes o no verificadas" valor={fmt(res.pendientes + res.noVerificadas + res.sinRegistro)} explica="Excluidas del denominador. Nunca se cuentan como ausencias." />
      </div>

      <section className="seccion">
        <PanelGrafica
          titulo="Asistencia por persona"
          nota="Orden alfabético; cada barra lleva el color y las siglas del partido de la persona. Las barras omiten a quien no tiene registros evaluables. La comparación debe considerar los registros pendientes de cada persona (ver tabla)."
          datos={porPersona}
          columnas={[{ clave: 'nombre', etiqueta: 'Persona' }, { clave: 'partido', etiqueta: 'Partido' }, { clave: 'porcentaje', etiqueta: 'Asistencia (%)' }, { clave: 'evaluables', etiqueta: 'Registros evaluables' }, { clave: 'sinVerificar', etiqueta: 'Sin verificar' }]}
          vacio={porPersona.every((p) => p.porcentaje == null)}
        >
          <p className="muy-pequeno texto-3" style={{ margin: 0 }}>Partido:</p>
          <Leyenda series={[...new Set(porPersona.map((p) => p.id_partido))].map((id) => ({ clave: id, etiqueta: base.idx.partido.get(id)?.siglas ?? id, color: colorPartido(base, id) }))} />
          <GraficaBarras
            datos={porPersona.filter((p) => p.porcentaje != null)}
            claveX="etiqueta"
            series={[{ clave: 'porcentaje', etiqueta: 'Asistencia (%)', color: SERIES[0] }]}
            colorFila={(f) => colorPartido(base, String(f.id_partido))}
            horizontal
            anchoEtiqueta={230}
          />
        </PanelGrafica>
      </section>

      <section className="seccion">
        <h2>Asistencia de cada persona en cada sesión</h2>
        <p className="seccion__intro">Un renglón por persona y sesión elegible. Las sesiones sin dato aparecen como «Sin registro capturado».</p>
        <TablaAsistencias registros={registros} titulo="Registros de asistencia" archivo="asistencias" />
      </section>

      <section className="seccion">
        <h2>Todas las sesiones</h2>
        <Tabla<Sesion>
          titulo="Catálogo de sesiones"
          filas={sesiones}
          clave={(s) => s.id_sesion}
          archivo="sesiones"
          ordenInicial={{ id: 'fecha', desc: true }}
          columnas={[
            { id: 'fecha', titulo: 'Fecha', valor: (s) => s.fecha, render: (s) => fechaCorta(s.fecha) },
            { id: 'id', titulo: 'ID', valor: (s) => s.id_sesion },
            { id: 'anio', titulo: 'Año de la Legislatura', numerica: true, valor: (s) => s.anio_legislativo ?? '' },
            { id: 'per', titulo: 'Periodo', valor: (s) => etiquetaDe(PERIODOS_SESION, s.periodo) },
            { id: 'tipo', titulo: 'Tipo', valor: (s) => etiquetaDe(TIPOS_SESION, s.tipo_sesion) },
            { id: 'num', titulo: 'Número', numerica: true, valor: (s) => s.numero_sesion ?? '' },
            { id: 'eleg', titulo: '¿Cuenta para la asistencia?', valor: (s) => (s.cuenta_para_asistencia ? 'Sí' : 'No') },
            { id: 'asis', titulo: 'Asistieron / les tocaba', numerica: true, valor: (s) => conteoSesion.get(s.id_sesion)?.asis ?? 0, render: (s) => { const c = conteoSesion.get(s.id_sesion); return c ? `${c.asis} / ${c.total}` : <span className="texto-3">Sin lista</span>; } },
            { id: 'f', titulo: 'Fuente', valor: (s) => s.id_fuente, render: (s) => <EnlaceFuente id={s.id_fuente} corto /> },
          ]}
        />
      </section>
    </>
  );
}
