import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { BarraFiltros } from '../componentes/Filtros';
import { fmt, fmtPct } from '../componentes/Tarjeta';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { asistenciaAgregada } from '../indicadores/asistencia';
import { asuntosFiltrados, esAprobado, esDictaminado, esPendiente, resumenAsuntos, tiemposProcesales } from '../indicadores/asuntos';
import { indicadoresComisiones } from '../indicadores/comisiones';
import { compromisosFiltrados } from '../indicadores/compromisos';
import { fichasExhortos, resumenExhortos } from '../indicadores/exhortos';
import { diputadosFiltrados } from '../indicadores/filtro';
import { intervencionesFiltradas } from '../indicadores/intervenciones';
import { votacionesFiltradas } from '../indicadores/votaciones';

interface Fila {
  indicador: string;
  valor: string;
  calculo: ReactNode;
  limitacion: string;
  enlace?: string;
}

function TablaDimension({ titulo, descripcion, filas }: { titulo: string; descripcion: string; filas: Fila[] }) {
  return (
    <section className="panel dimension" style={{ marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1.15rem' }}>{titulo}</h2>
      <p className="panel__nota">{descripcion}</p>
      <div className="tabla-envoltura">
        <table className="tabla">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Indicador</th>
              <th scope="col" className="num">Valor</th>
              <th scope="col">Numerador / denominador</th>
              <th scope="col">Limitaciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.indicador}>
                <th scope="row" style={{ fontWeight: 600, background: 'transparent', position: 'static', whiteSpace: 'normal', color: 'var(--texto)' }}>
                  {f.enlace ? <Link to={f.enlace}>{f.indicador}</Link> : f.indicador}
                </th>
                <td className="num" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{f.valor}</td>
                <td className="pequeno">{f.calculo}</td>
                <td className="pequeno texto-2">{f.limitacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const pct = (n: number, d: number) => (d ? fmtPct((n / d) * 100) : 'No calculable');
const dias = (m: number | null) => (m == null ? 'Sin fechas' : `${fmt(m)} días`);

export default function Eficacia() {
  const { base } = useDatos();
  const [filtro] = useFiltro();

  const c = useMemo(() => {
    const dips = diputadosFiltrados(base, filtro);
    const asis = asistenciaAgregada(base, dips, filtro);
    const asuntos = asuntosFiltrados(base, filtro);
    const res = resumenAsuntos(asuntos);
    const flujo = asuntos.filter((a) => ['iniciativa', 'exhorto', 'punto_acuerdo'].includes(a.tipo));
    const tiempos = tiemposProcesales(flujo);
    const inter = intervencionesFiltradas(base, filtro);
    const votaciones = votacionesFiltradas(base, filtro);
    const idsV = new Set(votaciones.map((v) => v.id_votacion));
    const votos = base.votos.filter((v) => idsV.has(v.id_votacion) && dips.some((d) => d.id_diputado === v.id_diputado));
    const com = indicadoresComisiones(base, filtro);
    const ex = resumenExhortos(fichasExhortos(base, filtro));
    const comp = compromisosFiltrados(base, filtro);
    return { dips, asis, asuntos, res, flujo, tiempos, inter, votaciones, votos, com, ex, comp };
  }, [base, filtro]);
  const { dips, asis, res, flujo, tiempos, inter, votaciones, votos, com, ex, comp } = c;
  const reuniones = com.reduce((s, i) => s + i.reuniones, 0);
  const dictaminados = flujo.filter(esDictaminado).length;
  const aprobados = flujo.filter(esAprobado).length;
  const nominales = votaciones.filter((v) => v.tipo_votacion === 'nominal');
  const votosEsperados = nominales.reduce((s, v) => s + base.votos.filter((x) => x.id_votacion === v.id_votacion).length, 0);
  const avanceComp = comp.filter((x) => x.estado_seguimiento === 'cumplido_documentado' || x.estado_seguimiento === 'avance_documentado').length;
  const integrantesConCargo = new Set(base.integrantes.map((i) => i.id_diputado)).size;

  return (
    <>
      <EncabezadoPagina titulo="Indicadores de eficacia legislativa">
        <p>
          Los indicadores se organizan en cuatro dimensiones independientes, tanto para la actividad individual como para el funcionamiento del Congreso. Para cada uno se muestran el valor, su numerador y denominador, y sus limitaciones. Los valores individuales se consultan en el <Link to="/diputaciones">comparativo del directorio</Link> y en cada perfil.
        </p>
      </EncabezadoPagina>
      <Aviso titulo="Sin índice único">
        Este tablero no construye un índice de «mejor diputado» ni un ranking de calidad legislativa: no existe una metodología consensuada que pondere actividades tan distintas como legislar, deliberar, representar y gestionar. Cada indicador describe un aspecto específico.
      </Aviso>
      <BarraFiltros />

      <TablaDimension
        titulo="1. Actividad"
        descripcion="Volumen de actividades documentadas. Describe cuánto se registró, no su calidad ni su relevancia."
        filas={[
          { indicador: 'Iniciativas presentadas', valor: fmt(res.iniciativasPresentadas), calculo: 'Asuntos únicos de tipo iniciativa con fecha de presentación en el periodo.', limitacion: 'Una iniciativa breve y una reforma integral cuentan igual.', enlace: '/asuntos?tipo=iniciativa' },
          { indicador: 'Dictámenes elaborados', valor: fmt(res.porTipo.dictamen ?? 0), calculo: 'Asuntos únicos de tipo dictamen en el periodo.', limitacion: 'Solo los dictámenes capturados como asunto propio.', enlace: '/asuntos?tipo=dictamen' },
          { indicador: 'Exhortos presentados', valor: fmt(ex.presentados), calculo: 'Asuntos únicos de tipo exhorto.', limitacion: 'La clasificación como exhorto depende de la captura.', enlace: '/exhortos' },
          { indicador: 'Intervenciones en tribuna', valor: fmt(inter.length), calculo: `Intervenciones registradas de ${fmt(dips.length)} personas.`, limitacion: 'Depende de la disponibilidad del Diario de los Debates.', enlace: '/intervenciones' },
          { indicador: 'Asistencias registradas', valor: fmt(asis.asistencias), calculo: `${fmt(asis.asistencias)} de ${fmt(asis.sesionesElegibles)} registros persona–sesión esperados.`, limitacion: 'Las sesiones sin lista localizada no se cuentan.', enlace: '/asistencias' },
          { indicador: 'Reuniones de comisión documentadas', valor: fmt(reuniones), calculo: `${fmt(com.reduce((s, i) => s + i.reunionesConActa, 0))} con acta localizada.`, limitacion: 'No haber localizado un acta no prueba que no hubo reunión.', enlace: '/comisiones' },
        ]}
      />
      <TablaDimension
        titulo="2. Avance procesal"
        descripcion="Cuántos asuntos avanzan en el procedimiento y en cuánto tiempo. Iniciativas, exhortos y puntos de acuerdo del periodo."
        filas={[
          { indicador: 'Asuntos dictaminados', valor: pct(dictaminados, flujo.length), calculo: `${fmt(dictaminados)} ÷ ${fmt(flujo.length)} asuntos presentados`, limitacion: 'Los asuntos recientes aún no han tenido tiempo de dictaminarse.' },
          { indicador: 'Asuntos aprobados', valor: pct(aprobados, flujo.length), calculo: `${fmt(aprobados)} ÷ ${fmt(flujo.length)}`, limitacion: 'Aprobar no es el único resultado legítimo: desechar también es una resolución.', enlace: '/asuntos?estado=aprobados' },
          { indicador: 'Asuntos pendientes', valor: pct(flujo.filter(esPendiente).length, flujo.length), calculo: `${fmt(flujo.filter(esPendiente).length)} ÷ ${fmt(flujo.length)}`, limitacion: 'Incluye asuntos presentados hace pocos días.', enlace: '/asuntos?estado=pendientes' },
          { indicador: 'Mediana presentación → turno', valor: dias(tiempos.presentacionTurno.mediana), calculo: `${fmt(tiempos.presentacionTurno.casos)} de ${fmt(tiempos.universo)} asuntos con ambas fechas`, limitacion: 'Solo asuntos con fechas registradas.' },
          { indicador: 'Mediana turno → dictamen', valor: dias(tiempos.turnoDictamen.mediana), calculo: `${fmt(tiempos.turnoDictamen.casos)} de ${fmt(tiempos.universo)} asuntos`, limitacion: 'Excluye los pendientes (sesgo hacia asuntos rápidos).' },
          { indicador: 'Mediana presentación → aprobación', valor: dias(tiempos.presentacionAprobacion.mediana), calculo: `${fmt(tiempos.presentacionAprobacion.casos)} de ${fmt(tiempos.universo)} asuntos`, limitacion: 'Incluye aprobaciones con dispensa de trámite (mismo día).' },
        ]}
      />
      <TablaDimension
        titulo="3. Participación y deliberación"
        descripcion="Presencia y participación en el Pleno y en comisiones."
        filas={[
          { indicador: 'Asistencia al Pleno', valor: asis.porcentaje == null ? 'No calculable' : `${fmtPct(asis.porcentaje)}${asis.definitivo ? '' : ' (provisional)'}`, calculo: `${fmt(asis.asistencias)} ÷ ${fmt(asis.denominador)} registros evaluables`, limitacion: `${fmt(asis.pendientes + asis.noVerificadas + asis.sinRegistro)} registros sin verificar se excluyen.`, enlace: '/asistencias' },
          { indicador: 'Intervenciones por persona', valor: dips.length ? (inter.length / dips.length).toLocaleString('es-MX', { maximumFractionDigits: 1 }) : 'No calculable', calculo: `${fmt(inter.length)} ÷ ${fmt(dips.length)} personas`, limitacion: 'Promedio sensible a valores extremos; ver distribución en Intervenciones.', enlace: '/intervenciones' },
          { indicador: 'Votaciones nominales registradas', valor: fmt(nominales.length), calculo: `${fmt(nominales.length)} de ${fmt(votaciones.length)} votaciones; ${fmt(votos.length)} votos individuales`, limitacion: 'Las votaciones económicas no dejan registro individual.', enlace: '/votaciones' },
          { indicador: 'Votos con sentido acreditado', valor: pct(votos.filter((v) => ['favor', 'contra', 'abstencion'].includes(v.sentido)).length, votos.length), calculo: `Votos a favor, en contra o abstención ÷ ${fmt(votos.length)} votos capturados`, limitacion: `Base: ${fmt(votosEsperados)} votos capturados en votaciones nominales.` },
          { indicador: 'Personas con cargo en comisiones', valor: fmt(integrantesConCargo), calculo: `de ${fmt(base.diputados.length)} en el catálogo`, limitacion: 'Integración vigente según la fuente; puede haber cambios no capturados.', enlace: '/comisiones' },
        ]}
      />
      <TablaDimension
        titulo="4. Seguimiento y resultados documentados"
        descripcion="Lo que se puede documentar después de la aprobación. La ausencia de evidencia no prueba que no haya resultados."
        filas={[
          { indicador: 'Decretos publicados', valor: fmt(res.decretosPublicados), calculo: 'Números de decreto únicos con fecha de publicación oficial.', limitacion: 'No todos los asuntos aprobados requieren publicación.', enlace: '/asuntos?estado=publicado' },
          { indicador: 'Exhortos con respuesta localizada', valor: pct(ex.conRespuesta, ex.aprobados), calculo: `${fmt(ex.conRespuesta)} ÷ ${fmt(ex.aprobados)} exhortos aprobados`, limitacion: `${fmt(ex.pendientesSeguimiento)} aprobados aún sin búsqueda de respuesta; ${fmt(ex.noVerificados)} no verificados.`, enlace: '/exhortos' },
          { indicador: 'Exhortos con acciones posteriores', valor: pct(ex.conAcciones, ex.aprobados), calculo: `${fmt(ex.conAcciones)} ÷ ${fmt(ex.aprobados)}`, limitacion: 'Una respuesta no equivale a atender la solicitud.', enlace: '/exhortos?seguimiento=con_acciones' },
          { indicador: 'Compromisos con avance documentado', valor: pct(avanceComp, comp.length), calculo: `${fmt(avanceComp)} ÷ ${fmt(comp.length)} compromisos registrados`, limitacion: 'Solo compromisos documentables; no es un inventario exhaustivo.', enlace: '/compromisos' },
        ]}
      />
    </>
  );
}
