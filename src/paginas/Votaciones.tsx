import { useMemo } from 'react';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { BarraFiltros, FiltroParam } from '../componentes/Filtros';
import { EnlaceFuente } from '../componentes/Fuente';
import { InsigniaCatalogo } from '../componentes/Insignia';
import { Tabla } from '../componentes/Tabla';
import { EnlaceDip, nombreDip, TablaVotos } from '../componentes/TablasRegistros';
import { fmt, Tarjeta } from '../componentes/Tarjeta';
import { CUADRE_VOTACION, ESTADOS_VERIFICACION, RESULTADOS_VOTACION, SENTIDOS_VOTO, TIPOS_VOTACION, etiquetaDe } from '../config/catalogos';
import type { Votacion, VotoInferido } from '../datos/modelo';
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
  const conCuadre = votaciones.filter((v) => v.cuadre);
  const coinciden = conCuadre.filter((v) => v.cuadre === 'coincide').length;
  const sinNombre = conCuadre.reduce((n, v) => n + (v.cuadre === 'faltan_nombres' ? (v.votos_sin_nombre ?? 0) : 0), 0);
  const inferidos = base.votosInferidos.filter((v) => ids.has(v.id_votacion) && (!idDip || v.id_diputado === idDip) && (!sentido || v.sentido === sentido) && (!filtro.partido || base.idx.diputado.get(v.id_diputado)?.id_partido === filtro.partido));

  return (
    <>
      <EncabezadoPagina titulo="Votaciones">
        <p>Votaciones del Pleno y, cuando la fuente lo permite, el sentido del voto de cada persona.</p>
      </EncabezadoPagina>
      <Aviso>
        El sentido del voto solo se registra cuando la fuente oficial lo acredita. <strong>Nunca se deduce del partido ni del resultado general</strong>; si la fuente no lo permite, aparece como «voto no localizado». Las votaciones económicas normalmente no dejan registro individual.
      </Aviso>
      <Aviso titulo="Asistencia no es lo mismo que votar">
        Una persona puede tener asistencia en la sesión y no aparecer en una votación: según el área de taquigrafía parlamentaria del Congreso, ocurre cuando sale del salón para atender otros asuntos y no regresa a tiempo para votar. En esos casos el acta no le asigna voto y aquí tampoco se le cuenta como abstención.
      </Aviso>
      <BarraFiltros campos={['anio', 'fechas', 'partido']} extraLimpiar={['diputado', 'sentido']}>
        <FiltroParam id="diputado" etiqueta="Diputada o diputado" ancho opciones={base.diputados.map((d) => ({ valor: d.id_diputado, etiqueta: d.nombre_completo }))} />
        <FiltroParam id="sentido" etiqueta="Sentido del voto" opciones={Object.entries(SENTIDOS_VOTO).map(([k, v]) => ({ valor: k, etiqueta: v.etiqueta }))} />
      </BarraFiltros>
      <div className="rejilla rejilla--tarjetas">
        <Tarjeta titulo="Votaciones registradas" valor={base.votaciones.length ? fmt(votaciones.length) : null} detalle={`${fmt(nominales)} nominales`} />
        <Tarjeta titulo="Votos individuales" valor={base.votaciones.length ? fmt(votos.length) : null} detalle={porSentido.filter((x) => x.n).map((x) => `${etiquetaDe(SENTIDOS_VOTO, x.k)}: ${fmt(x.n)}`).join(' · ')} explica="Solo votos escritos en el acta." />
        <Tarjeta titulo="Lista y total coinciden" valor={conCuadre.length ? `${fmt(coinciden)} de ${fmt(conCuadre.length)}` : null} detalle={`${fmt(sinNombre)} votos del total oficial sin nombre en el acta`} explica="Votaciones nominales en que la lista del acta suma lo mismo que el total que declara la Presidencia." />
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
            {
              id: 'cu',
              titulo: 'Lista vs. total',
              valor: (v) => (v.cuadre ? etiquetaDe(CUADRE_VOTACION, v.cuadre) : ''),
              render: (v) =>
                v.cuadre ? (
                  <span className="pequeno">
                    <InsigniaCatalogo catalogo={CUADRE_VOTACION} valor={v.cuadre} />
                    {v.cuadre === 'faltan_nombres' && <span className="num"> {v.votos_sin_nombre}</span>}
                    {v.observaciones && <div className="muy-pequeno texto-3">{v.observaciones}</div>}
                  </span>
                ) : (
                  <span className="texto-3">—</span>
                ),
            },
            { id: 'v', titulo: 'Verificación', valor: (v) => v.estado_verificacion, render: (v) => <InsigniaCatalogo catalogo={ESTADOS_VERIFICACION} valor={v.estado_verificacion} /> },
            { id: 'fu', titulo: 'Fuente', valor: (v) => v.id_fuente, render: (v) => <EnlaceFuente id={v.id_fuente} corto /> },
          ]}
        />
      </section>
      <section className="seccion">
        <h2>Votos individuales</h2>
        <TablaVotos votos={votos} titulo="Votos individuales" archivo="votos" />
      </section>
      <section className="seccion">
        <h2>Votos probables deducidos por el Observatorio</h2>
        <p className="seccion__intro">
          Votos que el acta <strong>no escribe</strong>, pero que se deducen con confianza alta al cuadrar la lista con el total oficial: la persona está escrita sin sentido de voto, es la única presente que no aparece, o el total declarado es igual a todas las diputaciones en funciones. <strong>No se suman</strong> a los votos individuales ni a ningún indicador. Los casos de confianza media o baja no se atribuyen a nadie.
        </p>
        <Tabla<VotoInferido>
          titulo="Votos probables"
          filas={inferidos}
          clave={(v) => `${v.id_votacion}|${v.id_diputado}`}
          archivo="votos_probables"
          ordenInicial={{ id: 'f', desc: true }}
          vacio="No hay votos probables para los filtros elegidos."
          columnas={[
            { id: 'f', titulo: 'Fecha', valor: (v) => base.idx.sesion.get(base.idx.votacion.get(v.id_votacion)?.id_sesion ?? '')?.fecha ?? '', render: (v) => fechaCorta(base.idx.sesion.get(base.idx.votacion.get(v.id_votacion)?.id_sesion ?? '')?.fecha) },
            { id: 'v', titulo: 'Votación', valor: (v) => v.id_votacion, render: (v) => <span className="muy-pequeno num">{v.id_votacion}</span> },
            { id: 'd', titulo: 'Diputada/o', valor: (v) => nombreDip(base, v.id_diputado), render: (v) => <EnlaceDip id={v.id_diputado} /> },
            { id: 's', titulo: 'Sentido probable', valor: (v) => etiquetaDe(SENTIDOS_VOTO, v.sentido) },
            { id: 'fu', titulo: 'Fundamento', valor: (v) => v.fundamento, render: (v) => <span className="muy-pequeno">{v.fundamento}</span> },
          ]}
        />
      </section>
    </>
  );
}
