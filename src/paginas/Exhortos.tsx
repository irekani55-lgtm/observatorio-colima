import { useMemo } from 'react';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
import { Aviso } from '../componentes/Aviso';
import { SERIES } from '../componentes/colores';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { BarraFiltros, FiltroParam } from '../componentes/Filtros';
import { EnlaceExterno, EnlaceFuente } from '../componentes/Fuente';
import { GraficaBarras, PanelGrafica } from '../componentes/Graficas';
import { InsigniaCatalogo } from '../componentes/Insignia';
import { Tabla } from '../componentes/Tabla';
import { Promoventes, nombreDip } from '../componentes/TablasRegistros';
import { fmt, fmtPct, Tarjeta } from '../componentes/Tarjeta';
import { ESTADOS_PROCESALES, SEGUIMIENTO_EXHORTO, etiquetaDe } from '../config/catalogos';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { idsDiputadosPromoventes } from '../indicadores/asuntos';
import { fichasExhortos, resumenExhortos, type FichaExhorto } from '../indicadores/exhortos';
import { fechaCorta } from '../indicadores/filtro';

const ORDEN = { federal: 'Federal', estatal: 'Estatal', municipal: 'Municipal', autonomo: 'Organismo autónomo' } as Record<string, string>;

export default function Exhortos() {
  const { base } = useDatos();
  const [filtro, , params] = useFiltro();
  const idDip = params.get('diputado') ?? '';
  const seg = params.get('seguimiento') ?? '';
  const orden = params.get('orden') ?? '';
  const tema = params.get('tema') ?? '';

  const todas = useMemo(() => fichasExhortos(base, filtro).filter((x) => (!idDip || idsDiputadosPromoventes(x.asunto).includes(idDip)) && (!tema || x.asunto.tema === tema) && (!orden || x.exhorto?.orden_gobierno === orden)), [base, filtro, idDip, tema, orden]);
  const lista = todas.filter((x) => !seg || x.seguimiento === seg);
  const r = resumenExhortos(todas);
  const porSeg = Object.keys(SEGUIMIENTO_EXHORTO)
    .map((k) => ({ estado: etiquetaDe(SEGUIMIENTO_EXHORTO, k), total: todas.filter((x) => x.seguimiento === k).length }))
    .filter((x) => x.total > 0);
  const temas = [...new Set(base.asuntos.filter((a) => a.tipo === 'exhorto').map((a) => a.tema).filter(Boolean))].sort();
  const pct = (n: number, d: number) => (d ? fmtPct((n / d) * 100) : '—');

  return (
    <>
      <EncabezadoPagina titulo="Peticiones a otras autoridades (exhortos)">
        <p className={claseNuevo()}>
          Un exhorto es cuando el Congreso le pide a otra autoridad que atienda un problema o que informe algo. <strong>Aprobarlo no obliga a la autoridad a hacer caso.</strong> Y si no encontramos una respuesta, no quiere decir que la autoridad no
          hizo nada: puede que no se haya publicado.
          <Nuevo texto="en palabras sencillas" />
        </p>
      </EncabezadoPagina>
      <BarraFiltros extraLimpiar={['diputado', 'seguimiento', 'orden', 'tema']}>
        <FiltroParam id="diputado" etiqueta="Quién lo propuso" ancho opciones={base.diputados.map((d) => ({ valor: d.id_diputado, etiqueta: d.nombre_completo }))} />
        <FiltroParam id="seguimiento" etiqueta="Seguimiento" opciones={Object.entries(SEGUIMIENTO_EXHORTO).map(([k, v]) => ({ valor: k, etiqueta: v.etiqueta }))} />
        <FiltroParam id="orden" etiqueta="Orden de gobierno" opciones={Object.entries(ORDEN).map(([k, v]) => ({ valor: k, etiqueta: v }))} />
        <FiltroParam id="tema" etiqueta="Tema" opciones={temas.map((t) => ({ valor: t, etiqueta: t }))} />
      </BarraFiltros>

      {base.asuntos.every((a) => a.tipo !== 'exhorto') && <Aviso tipo="alerta" titulo="Información pendiente de integración">No hay asuntos de tipo «exhorto» en los datos cargados.</Aviso>}

      <div className="rejilla rejilla--tarjetas">
        <Tarjeta titulo="Exhortos presentados" valor={fmt(r.presentados)} />
        <Tarjeta titulo="Aprobados" valor={fmt(r.aprobados)} detalle={`${pct(r.aprobados, r.presentados)} de los presentados`} />
        <Tarjeta titulo="Pendientes" valor={fmt(r.pendientes)} explica="Aún en trámite legislativo." />
        <Tarjeta
          titulo="Enviados a la autoridad"
          valor={todas.some((x) => x.exhorto?.fecha_envio) ? fmt(r.enviados) : null}
          pendiente="Sin dato: las fuentes no publican los oficios de envío"
          detalle={todas.some((x) => x.exhorto?.fecha_envio) ? `${pct(r.enviados, r.aprobados)} de los aprobados` : undefined}
          explica="Con oficio de envío documentado."
        />
        <Tarjeta titulo="Con respuesta oficial localizada" valor={fmt(r.conRespuesta)} detalle={`${pct(r.conRespuesta, r.aprobados)} de los aprobados`} />
        <Tarjeta titulo="Con acciones posteriores documentadas" valor={fmt(r.conAcciones)} detalle={`${pct(r.conAcciones, r.aprobados)} de los aprobados`} />
      </div>

      <section className="seccion rejilla rejilla--2">
        <PanelGrafica titulo="Estado de seguimiento" nota="«Sin respuesta localizada», «pendiente de seguimiento» y «no verificado» son estados distintos; ninguno equivale a incumplimiento." datos={porSeg} columnas={[{ clave: 'estado', etiqueta: 'Estado' }, { clave: 'total', etiqueta: 'Exhortos' }]}>
          <GraficaBarras datos={porSeg} claveX="estado" series={[{ clave: 'total', etiqueta: 'Exhortos', color: SERIES[1] }]} horizontal anchoEtiqueta={190} />
        </PanelGrafica>
        <div className="panel">
          <h3>Qué significa cada estado</h3>
          <dl className="definiciones">
            {Object.entries(SEGUIMIENTO_EXHORTO).map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt><InsigniaCatalogo catalogo={SEGUIMIENTO_EXHORTO} valor={k} /></dt>
                <dd>{v.descripcion}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="seccion">
        <h2>Registros</h2>
        <Tabla<FichaExhorto>
          titulo="Exhortos"
          filas={lista}
          clave={(x) => x.asunto.id_asunto}
          archivo="exhortos"
          ordenInicial={{ id: 'fecha', desc: true }}
          columnas={[
            { id: 'id', titulo: 'ID', valor: (x) => x.exhorto?.id_exhorto ?? x.asunto.id_asunto, render: (x) => <span className="muy-pequeno num">{x.exhorto?.id_exhorto ?? x.asunto.id_asunto}</span> },
            { id: 'titulo', titulo: 'Qué se pidió', valor: (x) => `${x.asunto.titulo} ${x.asunto.tema}`, render: (x) => <div style={{ minWidth: 240 }}>{x.asunto.titulo}<div className="muy-pequeno texto-3">{x.asunto.tema}</div>{x.asunto.descripcion && <details className="muy-pequeno"><summary>Descripción</summary>{x.asunto.descripcion}</details>}</div> },
            { id: 'fecha', titulo: 'Se presentó', valor: (x) => x.asunto.fecha_presentacion, render: (x) => fechaCorta(x.asunto.fecha_presentacion) },
            { id: 'prom', titulo: 'Quién lo propuso', valor: (x) => x.asunto.promoventes.map((p) => nombreDip(base, p.id_diputado) || p.promovente_externo).join('; '), render: (x) => <Promoventes a={x.asunto} resaltar={idDip} /> },
            { id: 'aut', titulo: 'A quién se le pidió', valor: (x) => x.exhorto?.autoridad_destinataria ?? '', render: (x) => x.exhorto?.autoridad_destinataria || <span className="texto-3">No registrada</span> },
            { id: 'com', titulo: 'Comisión que lo estudia', valor: (x) => x.asunto.turnos.map((t) => base.idx.comision.get(t.id_comision)?.nombre).join('; '), render: (x) => (x.asunto.turnos.length ? <span className="muy-pequeno">{x.asunto.turnos.map((t) => `${base.idx.comision.get(t.id_comision)?.nombre ?? t.id_comision} (${fechaCorta(t.fecha_turno)})`).join('; ')}</span> : <span className="muy-pequeno texto-3">Sin turno (dispensa de trámite o sin dato)</span>) },
            { id: 'estado', titulo: 'En qué va', valor: (x) => x.asunto.estado_procesal, render: (x) => <InsigniaCatalogo catalogo={ESTADOS_PROCESALES} valor={x.asunto.estado_procesal} /> },
            {
              id: 'fechas',
              titulo: 'Aprobado / enviado / respondido',
              valor: (x) => x.asunto.fecha_aprobacion,
              render: (x) => (
                <ul className="lista-limpia muy-pequeno num" style={{ minWidth: 150 }}>
                  <li>Aprobación: {x.asunto.fecha_aprobacion ? fechaCorta(x.asunto.fecha_aprobacion) : '—'}</li>
                  <li>Envío: {x.exhorto?.fecha_envio ? <>{fechaCorta(x.exhorto.fecha_envio)} <EnlaceFuente id={x.exhorto.id_fuente_envio} corto /></> : '—'}</li>
                  <li>Respuesta: {x.exhorto?.fecha_respuesta ? <>{fechaCorta(x.exhorto.fecha_respuesta)} <EnlaceFuente id={x.exhorto.id_fuente_respuesta} corto /></> : '—'}</li>
                </ul>
              ),
            },
            { id: 'seg', titulo: '¿Respondió la autoridad?', valor: (x) => etiquetaDe(SEGUIMIENTO_EXHORTO, x.seguimiento), render: (x) => <InsigniaCatalogo catalogo={SEGUIMIENTO_EXHORTO} valor={x.seguimiento} /> },
            { id: 'acc', titulo: 'Qué hizo después', valor: (x) => x.exhorto?.acciones_posteriores ?? '', render: (x) => (x.exhorto?.acciones_posteriores ? <span className="muy-pequeno">{x.exhorto.acciones_posteriores} <EnlaceFuente id={x.exhorto.id_fuente_acciones} corto /></span> : <span className="texto-3">—</span>) },
            { id: 'docs', titulo: 'Documentos', sinBusqueda: true, valor: (x) => x.asunto.url_documento, render: (x) => <span className="muy-pequeno"><EnlaceExterno url={x.asunto.url_documento}>Documento</EnlaceExterno> · <EnlaceFuente id={x.asunto.id_fuente} corto /></span> },
          ]}
        />
      </section>
    </>
  );
}
