import { useMemo, useState } from 'react';
import { BarrasLista, Explicacion, type FilaBarra } from '../componentes/BarrasLista';
import { ExhortoSinResultado, ExplicacionGobernadora } from './Explicaciones';
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
export function PreguntasCongreso() {
  const { base } = useDatos();
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
  const [verSinResultado, setVerSinResultado] = useState(false);
  const [verGobernadora, setVerGobernadora] = useState(false);
  const serie = (clave: string, etiqueta: string) => [{ clave, etiqueta, color: SERIES[0] }];
  const tramitesAyun = { ayun: origen.filas.find((f) => f.origen === 'Ayuntamientos')?.tramite ?? 0, total: origen.filas.reduce((n, f) => n + f.tramite, 0) };
  const fueraDip = origen.total - (origen.filas.find((f) => f.origen === 'Diputaciones')?.total ?? 0);
  const datosAvance = [
    { paso: 'Llegaron al Congreso', total: avance.presentadas },
    { paso: 'Se aprobaron', total: avance.aprobadas },
    { paso: `De las ${fmt(avance.aprobadas)} aprobadas: crean o cambian leyes`, total: avance.fondo },
    { paso: `De las ${fmt(avance.aprobadas)} aprobadas: trámites de cada año`, total: avance.tramite },
    { paso: `De las ${fmt(avance.aprobadas)} aprobadas: homenajes o fechas especiales`, total: avance.conmemorativa },
  ];
  const filasAvance: FilaBarra[] = [
    { etiqueta: 'Llegaron al Congreso', valor: avance.presentadas },
    { etiqueta: 'Se aprobaron', valor: avance.aprobadas, destacada: true },
    { etiqueta: `De las ${fmt(avance.aprobadas)} aprobadas:`, valor: 0, encabezado: true },
    { etiqueta: 'Crean o cambian leyes', valor: avance.fondo, nivel: 1 },
    { etiqueta: 'Trámites de cada año', valor: avance.tramite, nivel: 1, destacada: true },
    { etiqueta: 'Homenajes o fechas especiales', valor: avance.conmemorativa, nivel: 1 },
  ];
  const origenOrdenado = [...origen.filas].sort((a, b) => b.total - a.total);
  // Letra chica bajo cada barra: de lo que mandó cada quien, cuánto cambia leyes y cuánto es trámite u homenaje.
  const desglose = (o: { fondo: number; tramite: number; conmemorativa: number }) =>
    [
      o.tramite ? `${fmt(o.tramite)} ${o.tramite === 1 ? 'es trámite' : 'son trámites'}${o.tramite >= 50 ? ' (predial, agua, ingresos de cada municipio)' : ''}` : '',
      o.fondo ? `${fmt(o.fondo)} ${o.fondo === 1 ? 'cambia o crea leyes' : 'cambian o crean leyes'}` : '',
      o.conmemorativa ? `${fmt(o.conmemorativa)} ${o.conmemorativa === 1 ? 'es homenaje' : 'son homenajes'}` : '',
    ]
      .filter(Boolean)
      .join(' · ') || undefined;
  const datosExh = [
    { resultado: 'Aprobados', total: exhortos.aprobados },
    { resultado: 'Rechazados', total: exhortos.rechazados },
    { resultado: 'El acta no dice si se aprobó', total: exhortos.sinResultado },
  ].filter((x) => x.total > 0);
  const filasExh: FilaBarra[] = [
    { etiqueta: 'Aprobados', valor: exhortos.aprobados, destacada: true },
    { etiqueta: 'Rechazados', valor: exhortos.rechazados },
    ...(exhortos.sinResultado ? [{ etiqueta: 'El acta no dice si se aprobó', valor: exhortos.sinResultado, onClick: () => setVerSinResultado(true) }] : []),
  ];
  const datosVotos = [
    { tipo: 'Todos a favor', total: votos.unanimidad },
    { tipo: 'Casi todos (1 o 2 en contra o abstención)', total: votos.casi },
    { tipo: 'Divididas (3 o más de cada lado)', total: votos.divididas },
  ];
  const partidosEtiq = partidos.map((p) => ({ ...p, etiqueta: `${p.partido} (${p.lugares} ${p.lugares === 1 ? 'lugar' : 'lugares'})` }));
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
          <BarrasLista titulo="Propuestas de ley" filas={filasAvance} />
        </PanelGrafica>

        <PanelGrafica
          titulo="¿Quién manda las propuestas al Congreso?"
          nota={
            <>
              <strong>{deCada10(fueraDip, origen.total)} de cada 10</strong> propuestas no las presentan las diputaciones: las mandan sobre todo los ayuntamientos y la gobernadora.{tramitesAyun.total > 0 && <> De los trámites (como los descuentos en el predial), <strong>{deCada10(tramitesAyun.ayun, tramitesAyun.total)} de cada 10</strong> los mandan los ayuntamientos.</>} Las diputaciones también votan esas propuestas.
            </>
          }
          datos={origenOrdenado}
          columnas={[
            { clave: 'origen', etiqueta: 'Quién la manda' },
            { clave: 'total', etiqueta: 'Propuestas' },
            { clave: 'fondo', etiqueta: 'Cambian o crean leyes' },
            { clave: 'tramite', etiqueta: 'Trámites' },
            { clave: 'conmemorativa', etiqueta: 'Homenajes' },
          ]}
          vacio={origen.total === 0}
        >
          <BarrasLista
            titulo="Quién manda las propuestas"
            filas={origenOrdenado.map((o) => ({ etiqueta: o.origen, valor: o.total, destacada: o.origen === 'Ayuntamientos' || o.origen === 'Gobernadora', onClick: o.origen === 'Gobernadora' ? () => setVerGobernadora(true) : undefined, nota: desglose(o) }))}
          />
          <p className="muy-pequeno texto-3" style={{ marginBottom: 0 }}>
            Toque «Gobernadora» para saber qué le toca hacer según la Constitución de Colima.
          </p>
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
          <BarrasLista titulo="Exhortos" filas={filasExh} />
          {exhortos.sinResultado > 0 && <p className="muy-pequeno texto-3" style={{ marginBottom: 0 }}>Toque «El acta no dice si se aprobó» para saber de qué trata.</p>}
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
          <BarrasLista titulo="Cómo votaron" filas={datosVotos.map((v, i) => ({ etiqueta: v.tipo, valor: v.total, destacada: i === 2 }))} />
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
          <GraficaLineas
            datos={asistencia}
            claveX="mes"
            etiquetaX={etiquetaMes}
            series={serie('asistencia', 'Asistencia (%)')}
            dominioY={[0, 100]}
            sufijoY=" %"
            referencia={asisProm == null ? undefined : { valor: Math.round(asisProm * 10) / 10, etiqueta: `Promedio: ${pct(asisProm)}` }}
            marca={asisMin ? { x: asisMin.mes, y: asisMin.asistencia, etiqueta: `Mes más bajo: ${etiquetaMes(asisMin.mes)}, ${pct(asisMin.asistencia)}` } : undefined}
          />
        </PanelGrafica>

        <PanelGrafica
          titulo="¿Cuántas propuestas presenta cada partido por cada lugar que tiene?"
          nota={
            <>
              Se divide entre los lugares de cada partido, porque un partido con más lugares presenta más en total. Por cada lugar, los partidos presentan entre <strong>{rango}</strong> propuestas. No mide calidad ni impacto.
            </>
          }
          datos={partidosEtiq}
          columnas={[{ clave: 'partido', etiqueta: 'Partido' }, { clave: 'lugares', etiqueta: 'Lugares' }, { clave: 'propuestas', etiqueta: 'Propuestas' }, { clave: 'porLugar', etiqueta: 'Por lugar' }]}
        >
          <GraficaBarras datos={partidosEtiq} claveX="etiqueta" series={serie('porLugar', 'Propuestas por lugar')} horizontal anchoEtiqueta={170} colorFila={(d) => colorPartido(base, String(d.id_partido))} valores={(v) => v.toLocaleString('es-MX', { maximumFractionDigits: 1 })} />
        </PanelGrafica>
      </div>
      <Explicacion titulo="¿Qué hace la gobernadora y por qué manda propuestas?" abierta={verGobernadora} onCerrar={() => setVerGobernadora(false)}>
        <ExplicacionGobernadora />
      </Explicacion>
      <Explicacion titulo="Exhortos que el acta no dice si se aprobaron" abierta={verSinResultado} onCerrar={() => setVerSinResultado(false)}>
        {exhortos.sinResultadoLista.map((a) => (
          <ExhortoSinResultado key={a.id_asunto} id={a.id_asunto} />
        ))}
      </Explicacion>
    </section>
  );
}
