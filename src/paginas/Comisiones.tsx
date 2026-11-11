import { useMemo } from 'react';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
import { Link } from 'react-router-dom';
import { Aviso } from '../componentes/Aviso';
import { SERIES } from '../componentes/colores';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { enlaceConPeriodo } from '../componentes/FichaDiputado';
import { BarraFiltros } from '../componentes/Filtros';
import { EnlaceExterno } from '../componentes/Fuente';
import { GraficaBarras, PanelGrafica } from '../componentes/Graficas';
import { Tabla } from '../componentes/Tabla';
import { EnlaceDip } from '../componentes/TablasRegistros';
import { fmt, fmtPct, Tarjeta } from '../componentes/Tarjeta';
import { CARGOS_COMISION, etiquetaDe } from '../config/catalogos';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { asuntosUnicosTurnados, indicadoresComisiones, type IndicadoresComision } from '../indicadores/comisiones';

export default function Comisiones() {
  const { base } = useDatos();
  const [filtro] = useFiltro();
  const periodo = { anio: filtro.anio, desde: filtro.desde, hasta: filtro.hasta };
  const ind = useMemo(() => indicadoresComisiones(base, periodo), [base, periodo.anio, periodo.desde, periodo.hasta]); // eslint-disable-line react-hooks/exhaustive-deps
  const unicos = asuntosUnicosTurnados(ind);
  const sumaTurnos = ind.reduce((s, i) => s + i.turnados, 0);
  const datos = ind.map((i) => ({ nombre: i.comision.nombre, dictaminados: i.dictaminados, pendientes: i.pendientes })).sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <>
      <EncabezadoPagina titulo="Comisiones: los grupos que estudian cada tema">
        <p className={claseNuevo()}>
          Antes de que todo el Congreso vote una propuesta, la estudia una comisión: un grupo pequeño de diputadas y diputados que se dedica a un tema, como salud, educación o agua. La comisión da su opinión (dictamen) y después vota todo el
          Congreso. Aquí puede ver cuántas propuestas recibió cada comisión y cuántas ya revisó.
          <Nuevo texto="en palabras sencillas" />
        </p>
      </EncabezadoPagina>
      <Aviso>
        Cada comisión trabaja temas distintos y recibe cantidades distintas de propuestas, así que compárelas con cuidado. Si no encontramos el acta de una reunión, no quiere decir que no se reunió.
      </Aviso>
      <BarraFiltros campos={['anio', 'fechas']} />
      {base.comisiones.length === 0 && <Aviso tipo="alerta" titulo="Información pendiente de integración">No hay comisiones cargadas (<code>comisiones.csv</code>).</Aviso>}
      <div className="rejilla rejilla--tarjetas">
        <Tarjeta titulo="Comisiones" valor={base.comisiones.length ? fmt(base.comisiones.length) : null} />
        <Tarjeta titulo="Asuntos únicos turnados" valor={base.comisiones.length ? fmt(unicos) : null} detalle={`${fmt(sumaTurnos)} turnos en total`} explica="Un asunto turnado a varias comisiones cuenta una vez en este total." />
        {base.reuniones.length ? (
          <Tarjeta titulo="Reuniones documentadas" valor={fmt(ind.reduce((s, i) => s + i.reuniones, 0))} detalle={`${fmt(ind.reduce((s, i) => s + i.reunionesConActa, 0))} con acta localizada`} />
        ) : (
          <Tarjeta
            titulo="Reuniones reportadas por el Congreso"
            valor={base.comisiones.some((c) => c.reuniones_reportadas != null) ? fmt(base.comisiones.reduce((s, c) => s + (c.reuniones_reportadas ?? 0), 0)) : null}
            detalle="Suma de los totales que publica la página de comisiones"
            explica="El Congreso no publica la fecha ni la asistencia de cada reunión; las reuniones conjuntas pueden contarse en más de una comisión."
          />
        )}
      </div>
      <section className="seccion">
        <PanelGrafica titulo="Asuntos turnados por comisión" nota="Cada barra suma los turnos de la comisión, por eso el total de barras supera el de asuntos únicos." datos={datos} columnas={[{ clave: 'nombre', etiqueta: 'Comisión' }, { clave: 'dictaminados', etiqueta: 'Dictaminados' }, { clave: 'pendientes', etiqueta: 'Pendientes' }]}>
          <GraficaBarras datos={datos} claveX="nombre" series={[{ clave: 'dictaminados', etiqueta: 'Dictaminados', color: SERIES[0] }, { clave: 'pendientes', etiqueta: 'Pendientes de dictamen', color: SERIES[3] }]} horizontal apilado anchoEtiqueta={210} />
        </PanelGrafica>
      </section>
      <section className="seccion">
        <h2>Comparar las comisiones</h2>
        <Tabla<IndicadoresComision>
          titulo="Comisiones"
          filas={ind}
          clave={(i) => i.comision.id_comision}
          archivo="comisiones"
          columnas={[
            { id: 'n', titulo: 'Comisión', valor: (i) => i.comision.nombre, render: (i) => (i.comision.url ? <EnlaceExterno url={i.comision.url}>{i.comision.nombre}</EnlaceExterno> : i.comision.nombre) },
            { id: 'int', titulo: 'Integrantes', valor: (i) => i.integrantes.length, render: (i) => (i.integrantes.length ? <ul className="lista-limpia muy-pequeno">{i.integrantes.map((x) => <li key={x.id_diputado}><EnlaceDip id={x.id_diputado} /> · {etiquetaDe(CARGOS_COMISION, x.cargo)}</li>)}</ul> : <span className="texto-3">No documentados</span>) },
            { id: 't', titulo: 'Propuestas recibidas', numerica: true, valor: (i) => i.turnados, render: (i) => <Link to={enlaceConPeriodo('/asuntos', periodo, { comision: i.comision.id_comision })}>{fmt(i.turnados)}</Link> },
            { id: 'd', titulo: 'Ya revisadas (dictamen)', numerica: true, valor: (i) => i.dictaminados },
            { id: 'p', titulo: 'Por revisar', numerica: true, valor: (i) => i.pendientes },
            { id: 'pl', titulo: 'Votadas por todo el Congreso', numerica: true, valor: (i) => i.llegaronAlPleno },
            {
              id: 'r',
              titulo: 'Reuniones',
              numerica: true,
              valor: (i) => (i.reuniones || i.comision.reuniones_reportadas) ?? 0,
              render: (i) => (i.reuniones ? `${i.reuniones} (${i.reunionesConActa} con acta)` : i.comision.reuniones_reportadas != null ? `${i.comision.reuniones_reportadas} reportadas` : '—'),
            },
            { id: 'a', titulo: 'Asistencia a sus reuniones', numerica: true, valor: (i) => i.asistencia.porcentaje, render: (i) => (i.asistencia.porcentaje == null ? <span className="texto-3">Sin listas verificables</span> : `${fmtPct(i.asistencia.porcentaje)} (${i.asistencia.asistencias}/${i.asistencia.evaluables})`) },
            { id: 'm', titulo: 'Días que suele tardar en revisar', numerica: true, valor: (i) => i.diasTurnoDictamen.mediana, render: (i) => (i.diasTurnoDictamen.mediana == null ? '—' : `${fmt(i.diasTurnoDictamen.mediana)} días (n=${i.diasTurnoDictamen.casos})`) },
          ]}
        />
      </section>
    </>
  );
}
