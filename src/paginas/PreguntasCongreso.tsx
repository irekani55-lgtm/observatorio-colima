import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { colorPartido, SERIES } from '../componentes/colores';
import { etiquetaMes, GraficaBarras, GraficaLineas, PanelGrafica } from '../componentes/Graficas';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
import { fmt } from '../componentes/Tarjeta';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { asuntosFiltrados } from '../indicadores/asuntos';
import { diputadosFiltrados } from '../indicadores/filtro';
import { asistenciaPorMes, avancePropuestas, divisionVotaciones, origenesPropuestas, propuestasPorLugar, resultadoExhortos } from '../indicadores/numeros';
import { votacionesFiltradas } from '../indicadores/votaciones';

const deCada10 = (n: number, d: number) => (d ? Math.round((n / d) * 10) : 0);
const pct = (v: number) => `${v.toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`;

/**
 * «El Congreso en números» para la ciudadanía: seis preguntas, cada una con su respuesta en una frase y una sola
 * gráfica. Describen la actividad documentada; ninguna califica a personas ni a partidos.
 */
/** En pantallas angostas las etiquetas de las barras ocupan menos, para que las barras se vean. */
function useAngosto() {
  const consulta = '(max-width: 600px)';
  const [angosto, setAngosto] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(consulta).matches));
  useEffect(() => {
    const m = window.matchMedia?.(consulta);
    if (!m) return;
    const f = () => setAngosto(m.matches);
    m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, []);
  return angosto;
}

export function PreguntasCongreso() {
  const { base } = useDatos();
  const angosto = useAngosto();
  const ancho = angosto ? 112 : 190;
  const [filtro] = useFiltro();
  const periodo = { anio: filtro.anio, desde: filtro.desde, hasta: filtro.hasta };
  const c = useMemo(() => {
    const asuntos = asuntosFiltrados(base, periodo);
    return {
      avance: avancePropuestas(asuntos),
      origen: origenesPropuestas(asuntos),
      exhortos: resultadoExhortos(asuntos),
      votos: divisionVotaciones(votacionesFiltradas(base, periodo)),
      partidos: propuestasPorLugar(base, asuntos),
      asistencia: asistenciaPorMes(base, diputadosFiltrados(base, periodo), periodo),
    };
  }, [base, periodo.anio, periodo.desde, periodo.hasta]); // eslint-disable-line react-hooks/exhaustive-deps
  const { avance, origen, exhortos, votos, partidos, asistencia } = c;
  const serie = (clave: string, etiqueta: string) => [{ clave, etiqueta, color: SERIES[0] }];
  const fueraDip = origen.total - (origen.filas.find((f) => f.origen === 'Diputaciones')?.total ?? 0);
  const datosAvance = [
    { paso: 'Llegaron al Congreso', total: avance.presentadas },
    { paso: 'Se aprobaron', total: avance.aprobadas },
    { paso: '…y crean o cambian leyes', total: avance.fondo },
    { paso: '…y son trámites de cada año', total: avance.tramite },
    { paso: '…y son homenajes o fechas', total: avance.conmemorativa },
  ];
  const origenOrdenado = [...origen.filas].sort((a, b) => b.total - a.total);
  const datosExh = [
    { resultado: 'Aprobados', total: exhortos.aprobados },
    { resultado: 'Rechazados', total: exhortos.rechazados },
    { resultado: 'Sin resultado en el acta', total: exhortos.sinResultado },
  ].filter((x) => x.total > 0);
  const datosVotos = [
    { tipo: 'Todos a favor', total: votos.unanimidad },
    { tipo: 'Casi todos (1 o 2 en contra o abstención)', total: votos.casi },
    { tipo: 'Divididas (3 o más de cada lado)', total: votos.divididas },
  ];
  const vals = partidos.map((p) => p.porLugar);
  const rango = vals.length ? `${Math.min(...vals).toLocaleString('es-MX')} y ${Math.max(...vals).toLocaleString('es-MX')}` : '—';
  const asisProm = asistencia.length ? asistencia.reduce((s, x) => s + x.asistencia * x.sesiones, 0) / asistencia.reduce((s, x) => s + x.sesiones, 0) : null;
  const asisMin = asistencia.length ? asistencia.reduce((m, x) => (x.asistencia < m.asistencia ? x : m)) : null;

  return (
    <section className={`seccion${claseNuevo()}`} aria-labelledby="titulo-preguntas" style={{ marginTop: '1rem' }}>
      <h2 id="titulo-preguntas" className="sr-only">
        Seis preguntas sobre el Congreso
      </h2>
      <Nuevo texto="seis preguntas en palabras sencillas, con una gráfica cada una" />
      <div className="rejilla rejilla--2 preguntas">
        <PanelGrafica
          titulo="¿Cuántas propuestas de ley se aprueban?"
          nota={
            <>
              Se aprobaron <strong>{fmt(avance.aprobadas)}</strong> de {fmt(avance.presentadas)}: unas <strong>{deCada10(avance.aprobadas, avance.presentadas)} de cada 10</strong>. De las aprobadas, <strong>{deCada10(avance.tramite, avance.aprobadas)} de cada 10</strong> son trámites que se repiten cada año, como descuentos en el predial o el agua.{' '}
              <Link to="/metodologia#clasificacion-propuestas">¿Cómo las separamos?</Link>
            </>
          }
          datos={datosAvance}
          columnas={[{ clave: 'paso', etiqueta: 'Propuestas' }, { clave: 'total', etiqueta: 'Cuántas' }]}
          vacio={avance.presentadas === 0}
        >
          <GraficaBarras datos={datosAvance} claveX="paso" series={serie('total', 'Propuestas')} horizontal anchoEtiqueta={ancho} valores={fmt} />
        </PanelGrafica>

        <PanelGrafica
          titulo="¿Quién manda las propuestas al Congreso?"
          nota={
            <>
              <strong>{deCada10(fueraDip, origen.total)} de cada 10</strong> propuestas no las presentan las diputaciones: las mandan sobre todo los ayuntamientos y la gobernadora. Las diputaciones también votan esas propuestas.
            </>
          }
          datos={origenOrdenado}
          columnas={[{ clave: 'origen', etiqueta: 'Quién la manda' }, { clave: 'total', etiqueta: 'Propuestas' }]}
          vacio={origen.total === 0}
        >
          <GraficaBarras datos={origenOrdenado} claveX="origen" series={serie('total', 'Propuestas')} horizontal anchoEtiqueta={ancho} valores={fmt} />
        </PanelGrafica>

        <PanelGrafica
          titulo="¿Qué pasó con los exhortos?"
          nota={
            <>
              Un exhorto es cuando el Congreso le pide a otra autoridad que atienda un problema. De {fmt(exhortos.total)}, se aprobaron <strong>{fmt(exhortos.aprobados)}</strong>. Aprobarlo no obliga a la autoridad a hacer caso.
            </>
          }
          datos={datosExh}
          columnas={[{ clave: 'resultado', etiqueta: 'Resultado' }, { clave: 'total', etiqueta: 'Exhortos' }]}
          vacio={exhortos.total === 0}
        >
          <GraficaBarras datos={datosExh} claveX="resultado" series={serie('total', 'Exhortos')} horizontal anchoEtiqueta={ancho} valores={fmt} />
        </PanelGrafica>

        <PanelGrafica
          titulo="¿Qué tan dividido vota el Congreso?"
          nota={
            <>
              En <strong>{deCada10(votos.unanimidad, votos.total)} de cada 10</strong> votaciones con nombres en el acta, todas las diputaciones presentes votaron a favor. Solo <strong>{fmt(votos.divididas)}</strong> de {fmt(votos.total)} estuvieron divididas.{' '}
              <Link to="/votaciones?divididas=1">Ver las divididas</Link>
            </>
          }
          datos={datosVotos}
          columnas={[{ clave: 'tipo', etiqueta: 'Cómo votaron' }, { clave: 'total', etiqueta: 'Votaciones' }]}
          vacio={votos.total === 0}
        >
          <GraficaBarras datos={datosVotos} claveX="tipo" series={serie('total', 'Votaciones')} horizontal anchoEtiqueta={ancho} valores={fmt} />
        </PanelGrafica>

        <PanelGrafica
          titulo="¿Cómo va la asistencia mes a mes?"
          nota={
            asisProm == null ? undefined : (
              <>
                En promedio las diputaciones asistieron al <strong>{pct(asisProm)}</strong> de las sesiones.
                {asisMin && <> El mes más bajo fue {etiquetaMes(asisMin.mes)}, con {pct(asisMin.asistencia)}.</>}
              </>
            )
          }
          datos={asistencia.map((x) => ({ mes: etiquetaMes(x.mes), asistencia: x.asistencia, sesiones: x.sesiones }))}
          columnas={[{ clave: 'mes', etiqueta: 'Mes' }, { clave: 'asistencia', etiqueta: 'Asistencia (%)' }, { clave: 'sesiones', etiqueta: 'Registros' }]}
        >
          <GraficaLineas datos={asistencia} claveX="mes" etiquetaX={etiquetaMes} series={serie('asistencia', 'Asistencia (%)')} dominioY={[0, 100]} sufijoY=" %" />
        </PanelGrafica>

        <PanelGrafica
          titulo="¿Cuántas propuestas presenta cada partido por cada lugar que tiene?"
          nota={
            <>
              Se divide entre los lugares de cada partido, porque un partido con más lugares presenta más en total. Por cada lugar, los partidos presentan entre <strong>{rango}</strong> propuestas. No mide calidad ni impacto.
            </>
          }
          datos={partidos}
          columnas={[{ clave: 'partido', etiqueta: 'Partido' }, { clave: 'lugares', etiqueta: 'Lugares' }, { clave: 'propuestas', etiqueta: 'Propuestas' }, { clave: 'porLugar', etiqueta: 'Por lugar' }]}
        >
          <GraficaBarras datos={partidos} claveX="partido" series={serie('porLugar', 'Propuestas por lugar')} horizontal anchoEtiqueta={70} colorFila={(d) => colorPartido(base, String(d.id_partido))} valores={(v) => v.toLocaleString('es-MX', { maximumFractionDigits: 1 })} />
        </PanelGrafica>
      </div>
    </section>
  );
}
