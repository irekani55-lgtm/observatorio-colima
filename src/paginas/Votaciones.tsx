import { useMemo } from 'react';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { BarraFiltros, FiltroParam } from '../componentes/Filtros';
import { EnlaceFuente } from '../componentes/Fuente';
import { InsigniaCatalogo } from '../componentes/Insignia';
import { Tabla } from '../componentes/Tabla';
import { TablaVotos } from '../componentes/TablasRegistros';
import { fmt, Tarjeta } from '../componentes/Tarjeta';
import { ESTADOS_VERIFICACION, RESULTADOS_VOTACION, SENTIDOS_VOTO, TIPOS_VOTACION, etiquetaDe } from '../config/catalogos';
import type { Votacion } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { fechaCorta } from '../indicadores/filtro';
import { votacionesFiltradas } from '../indicadores/votaciones';

export default function Votaciones() {
  const { base } = useDatos();
  const [filtro, , params] = useFiltro();
  const idDip = params.get('diputado') ?? '';
  const sentido = params.get('sentido') ?? '';
  const votaciones = useMemo(() => votacionesFiltradas(base, filtro), [base, filtro]);
  const ids = new Set(votaciones.map((v) => v.id_votacion));
  const votos = base.votos.filter((v) => ids.has(v.id_votacion) && (!idDip || v.id_diputado === idDip) && (!sentido || v.sentido === sentido) && (!filtro.partido || base.idx.diputado.get(v.id_diputado)?.id_partido === filtro.partido));
  const nominales = votaciones.filter((v) => v.tipo_votacion === 'nominal').length;
  const porSentido = Object.keys(SENTIDOS_VOTO).map((k) => ({ k, n: votos.filter((v) => v.sentido === k).length }));

  return (
    <>
      <EncabezadoPagina titulo="Votaciones">
        <p>Votaciones del Pleno y, cuando la fuente lo permite, el sentido del voto de cada persona.</p>
      </EncabezadoPagina>
      <Aviso>
        El sentido del voto solo se registra cuando la fuente oficial lo acredita. <strong>Nunca se deduce del partido ni del resultado general</strong>; si la fuente no lo permite, aparece como «voto no localizado». Las votaciones económicas normalmente no dejan registro individual.
      </Aviso>
      <BarraFiltros campos={['anio', 'fechas', 'partido']} extraLimpiar={['diputado', 'sentido']}>
        <FiltroParam id="diputado" etiqueta="Diputada o diputado" ancho opciones={base.diputados.map((d) => ({ valor: d.id_diputado, etiqueta: d.nombre_completo }))} />
        <FiltroParam id="sentido" etiqueta="Sentido del voto" opciones={Object.entries(SENTIDOS_VOTO).map(([k, v]) => ({ valor: k, etiqueta: v.etiqueta }))} />
      </BarraFiltros>
      <div className="rejilla rejilla--tarjetas">
        <Tarjeta titulo="Votaciones registradas" valor={base.votaciones.length ? fmt(votaciones.length) : null} detalle={`${fmt(nominales)} nominales`} />
        <Tarjeta titulo="Votos individuales" valor={base.votaciones.length ? fmt(votos.length) : null} detalle={porSentido.filter((x) => x.n).map((x) => `${etiquetaDe(SENTIDOS_VOTO, x.k)}: ${fmt(x.n)}`).join(' · ')} />
      </div>
      <section className="seccion">
        <h2>Votaciones</h2>
        <Tabla<Votacion>
          titulo="Votaciones"
          filas={votaciones}
          clave={(v) => v.id_votacion}
          archivo="votaciones"
          ordenInicial={{ id: 'f', desc: true }}
          columnas={[
            { id: 'id', titulo: 'ID', valor: (v) => v.id_votacion },
            { id: 'f', titulo: 'Fecha', valor: (v) => base.idx.sesion.get(v.id_sesion)?.fecha ?? '', render: (v) => fechaCorta(base.idx.sesion.get(v.id_sesion)?.fecha) },
            { id: 's', titulo: 'Sesión', valor: (v) => v.id_sesion },
            { id: 'a', titulo: 'Asunto', valor: (v) => base.idx.asunto.get(v.id_asunto)?.titulo ?? v.descripcion, render: (v) => <span className="pequeno">{base.idx.asunto.get(v.id_asunto)?.titulo ?? '—'}<div className="muy-pequeno texto-3">{v.descripcion}</div></span> },
            { id: 't', titulo: 'Tipo', valor: (v) => etiquetaDe(TIPOS_VOTACION, v.tipo_votacion) },
            { id: 'r', titulo: 'Resultado', valor: (v) => v.resultado, render: (v) => <InsigniaCatalogo catalogo={RESULTADOS_VOTACION} valor={v.resultado} /> },
            { id: 'tot', titulo: 'Favor / contra / abst.', valor: (v) => v.total_favor ?? '', render: (v) => <span className="num">{v.total_favor ?? '—'} / {v.total_contra ?? '—'} / {v.total_abstencion ?? '—'}</span> },
            { id: 'v', titulo: 'Verificación', valor: (v) => v.estado_verificacion, render: (v) => <InsigniaCatalogo catalogo={ESTADOS_VERIFICACION} valor={v.estado_verificacion} /> },
            { id: 'fu', titulo: 'Fuente', valor: (v) => v.id_fuente, render: (v) => <EnlaceFuente id={v.id_fuente} corto /> },
          ]}
        />
      </section>
      <section className="seccion">
        <h2>Votos individuales</h2>
        <TablaVotos votos={votos} titulo="Votos individuales" archivo="votos" />
      </section>
    </>
  );
}
