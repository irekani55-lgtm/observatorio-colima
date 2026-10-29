import { useMemo } from 'react';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { BarraFiltros, FiltroParam } from '../componentes/Filtros';
import { InsigniaCatalogo } from '../componentes/Insignia';
import { TablaAsuntos } from '../componentes/TablasRegistros';
import { fmt, Tarjeta } from '../componentes/Tarjeta';
import { Aviso } from '../componentes/Aviso';
import { ESTADOS_APROBADOS, ESTADOS_PENDIENTES, ESTADOS_PROCESALES, ETAPAS_POR_TIPO, TIPOS_ASUNTO, etiquetaDe, type TipoAsunto } from '../config/catalogos';
import type { Asunto } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { asuntosFiltrados, idsDiputadosPromoventes, resumenAsuntos, tiemposProcesales } from '../indicadores/asuntos';

/** Filtro por estado: admite un estado concreto o un grupo ("aprobados", "pendientes"). */
export function cumpleEstado(a: Asunto, estado: string): boolean {
  if (!estado) return true;
  if (estado === 'aprobados') return ESTADOS_APROBADOS.includes(a.estado_procesal);
  if (estado === 'pendientes') return ESTADOS_PENDIENTES.includes(a.estado_procesal);
  return a.estado_procesal === estado;
}

export default function Asuntos() {
  const { base } = useDatos();
  const [filtro, , params] = useFiltro();
  const tipo = params.get('tipo') ?? '';
  const estado = params.get('estado') ?? '';
  const tema = params.get('tema') ?? '';
  const comision = params.get('comision') ?? '';
  const idDip = params.get('diputado') ?? '';

  const lista = useMemo(
    () =>
      asuntosFiltrados(base, filtro, tipo ? [tipo as TipoAsunto] : undefined).filter(
        (a) => cumpleEstado(a, estado) && (!tema || a.tema === tema) && (!comision || a.turnos.some((t) => t.id_comision === comision)) && (!idDip || idsDiputadosPromoventes(a).includes(idDip)),
      ),
    [base, filtro, tipo, estado, tema, comision, idDip],
  );
  const res = resumenAsuntos(lista);
  const tiempos = tiemposProcesales(lista);
  const temas = [...new Set(base.asuntos.map((a) => a.tema).filter(Boolean))].sort();

  return (
    <>
      <EncabezadoPagina titulo="Iniciativas y asuntos legislativos">
        <p>Iniciativas, dictámenes, decretos, acuerdos, puntos de acuerdo y exhortos registrados. Cada asunto aparece una sola vez aunque tenga varios promoventes o se haya turnado a varias comisiones.</p>
      </EncabezadoPagina>
      <BarraFiltros extraLimpiar={['tipo', 'estado', 'tema', 'comision', 'diputado']}>
        <FiltroParam id="tipo" etiqueta="Tipo de asunto" opciones={Object.entries(TIPOS_ASUNTO).map(([k, v]) => ({ valor: k, etiqueta: v.etiqueta }))} />
        <FiltroParam
          id="estado"
          etiqueta="Estado procesal"
          opciones={[{ valor: 'aprobados', etiqueta: 'Aprobados (incluye publicados)' }, { valor: 'pendientes', etiqueta: 'Pendientes (en trámite)' }, ...Object.entries(ESTADOS_PROCESALES).map(([k, v]) => ({ valor: k, etiqueta: v.etiqueta }))]}
        />
        <FiltroParam id="tema" etiqueta="Tema" opciones={temas.map((t) => ({ valor: t, etiqueta: t }))} />
        <FiltroParam id="comision" etiqueta="Comisión" ancho opciones={base.comisiones.map((c) => ({ valor: c.id_comision, etiqueta: c.nombre }))} />
        <FiltroParam id="diputado" etiqueta="Promovente" ancho opciones={base.diputados.map((d) => ({ valor: d.id_diputado, etiqueta: d.nombre_completo }))} />
      </BarraFiltros>

      <div className="rejilla rejilla--tarjetas">
        <Tarjeta titulo="Asuntos (únicos)" valor={fmt(res.total)} detalle={Object.entries(res.porTipo).map(([k, n]) => `${etiquetaDe(TIPOS_ASUNTO, k)}: ${n}`).join(' · ')} />
        <Tarjeta titulo="Aprobados" valor={fmt(lista.filter((a) => ESTADOS_APROBADOS.includes(a.estado_procesal)).length)} explica="Incluye los publicados." />
        <Tarjeta titulo="En trámite" valor={fmt(res.pendientes)} explica="Presentados, turnados o dictaminados sin resolución del Pleno." />
        <Tarjeta titulo="Sin estado verificable" valor={fmt((res.porEstado.no_localizado ?? 0) + (res.porEstado.no_verificado ?? 0))} explica="Información no localizada o estado no verificado." />
        <Tarjeta
          titulo="Tiempo turno → dictamen"
          valor={tiempos.turnoDictamen.mediana == null ? null : `${fmt(tiempos.turnoDictamen.mediana)} días`}
          pendiente="Sin fechas suficientes"
          detalle={`Mediana · ${fmt(tiempos.turnoDictamen.casos)} de ${fmt(tiempos.universo)} asuntos con ambas fechas`}
        />
      </div>

      {res.sinPromoventes > 0 && <Aviso tipo="alerta">{fmt(res.sinPromoventes)} asuntos no tienen promoventes registrados y no se atribuyen a ninguna persona.</Aviso>}

      <details className="desplegable" style={{ marginTop: '1rem' }}>
        <summary>¿Qué significa cada estado procesal y qué etapas tiene cada tipo de asunto?</summary>
        <dl className="definiciones" style={{ marginTop: '0.75rem' }}>
          {Object.entries(ESTADOS_PROCESALES).map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt><InsigniaCatalogo catalogo={ESTADOS_PROCESALES} valor={k} /></dt>
              <dd>{v.descripcion}</dd>
            </div>
          ))}
        </dl>
        <p className="pequeno texto-2" style={{ marginTop: '0.75rem' }}>No todos los asuntos siguen el mismo procedimiento. Etapas admitidas:</p>
        <ul className="pequeno">
          {Object.entries(ETAPAS_POR_TIPO).map(([t, etapas]) => (
            <li key={t}>
              <strong>{etiquetaDe(TIPOS_ASUNTO, t)}:</strong> {etapas.filter((e) => !['pendiente', 'no_localizado', 'no_verificado'].includes(e)).map((e) => etiquetaDe(ESTADOS_PROCESALES, e).toLowerCase()).join(' → ')}
            </li>
          ))}
        </ul>
      </details>

      <section className="seccion">
        <h2>Registros</h2>
        <TablaAsuntos asuntos={lista} titulo="Asuntos legislativos" archivo="asuntos" resaltar={idDip || undefined} />
      </section>
    </>
  );
}
