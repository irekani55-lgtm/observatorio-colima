import { useMemo } from 'react';
import { Aviso } from '../componentes/Aviso';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
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
import { esDividida, UMBRAL_DIVIDIDA, votacionesFiltradas } from '../indicadores/votaciones';

export default function Votaciones() {
  const { base } = useDatos();
  const [filtro, , params, fijar] = useFiltro();
  const idDip = params.get('diputado') ?? '';
  const sentido = params.get('sentido') ?? '';
  const soloDivididas = params.get('divididas') === '1';
  const votaciones = useMemo(() => votacionesFiltradas(base, filtro).filter((v) => !soloDivididas || esDividida(v)), [base, filtro, soloDivididas]);
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
        <p>
          Aquí puede ver cómo votó el Congreso cada propuesta y, cuando el acta lo dice, cómo votó cada diputada o diputado. Importa porque el voto es la decisión final: es lo que convierte una propuesta en ley.
        </p>
      </EncabezadoPagina>
      <div className={claseNuevo()}>
        <Aviso>
          Solo anotamos cómo votó una persona cuando el acta lo dice con su nombre. <strong>Nunca lo deducimos por su partido ni por el resultado.</strong>
          <details className="saber-mas">
            <summary>Saber más</summary>
            <p>
              Hay dos formas de votar. En la votación <strong>con nombres (nominal)</strong>, cada diputación dice su voto y el acta lo anota. En la votación <strong>a mano alzada (económica)</strong>, se levanta la mano y el acta normalmente solo anota
              el resultado; por eso ahí no sabemos quién votó cómo. Si el acta no permite saberlo, aparece «El acta no dice cómo votó».
            </p>
          </details>
        </Aviso>
        <Aviso titulo="Estar en la sesión no es lo mismo que votar">
          Alguien puede pasar lista y no aparecer en una votación.
          <details className="saber-mas">
            <summary>Saber más</summary>
            <p>
              Según el área de taquigrafía del Congreso, pasa cuando la persona sale del salón para atender otro asunto y no regresa a tiempo para votar. En ese caso el acta no le anota voto, y aquí tampoco se cuenta como abstención.
            </p>
          </details>
        </Aviso>
        <Nuevo texto="explicaciones cortas, con «Saber más»" />
      </div>
      <BarraFiltros campos={['anio', 'fechas', 'partido']} extraLimpiar={['diputado', 'sentido', 'divididas']}>
        <FiltroParam id="divididas" etiqueta="Qué votaciones" todos="Todas" opciones={[{ valor: '1', etiqueta: 'Solo las divididas (3 o más de cada lado)' }]} />
        <FiltroParam id="diputado" etiqueta="Diputada o diputado" ancho opciones={base.diputados.map((d) => ({ valor: d.id_diputado, etiqueta: d.nombre_completo }))} />
        <FiltroParam id="sentido" etiqueta="Cómo votó" opciones={Object.entries(SENTIDOS_VOTO).map(([k, v]) => ({ valor: k, etiqueta: v.etiqueta }))} />
      </BarraFiltros>
      {soloDivididas && (
        <p className="filtros-contexto">
          Solo votaciones divididas: al menos {UMBRAL_DIVIDIDA} votos a favor y al menos {UMBRAL_DIVIDIDA} en contra o abstenciones ({votaciones.length} en el periodo).{' '}
          <button type="button" className="boton boton--fantasma boton--chico" onClick={() => fijar({ divididas: undefined })}>
            Ver todas las votaciones
          </button>
        </p>
      )}
      <div className={`rejilla rejilla--tarjetas${claseNuevo()}`}>
        <Tarjeta
          titulo="Votaciones"
          valor={base.votaciones.length ? fmt(votaciones.length) : null}
          detalle={`${fmt(nominales)} con nombres en el acta`}
          explica={`El Congreso votó ${fmt(votaciones.length)} veces en este periodo; en ${fmt(nominales)} de ellas el acta anota quién votó cómo.`}
        />
        <Tarjeta
          titulo="Votos con nombre"
          valor={base.votaciones.length ? fmt(votos.length) : null}
          detalle={porSentido.filter((x) => x.n).map((x) => `${etiquetaDe(SENTIDOS_VOTO, x.k)}: ${fmt(x.n)}`).join(' · ')}
          explica="Cada voto que el acta anota con el nombre de la persona."
        />
        <Tarjeta
          titulo="¿Cuadran los votos?"
          valor={conCuadre.length ? `${fmt(coinciden)} de ${fmt(conCuadre.length)}` : null}
          detalle={sinNombre ? `${fmt(sinNombre)} votos anunciados sin nombre en el acta` : undefined}
          explica={`En ${fmt(coinciden)} de ${fmt(conCuadre.length)} votaciones, los nombres del acta suman lo mismo que el total que anunció quien dirige la sesión.`}
        />
      </div>
      <section className="seccion">
        <h2>Cada votación</h2>
        <p className="seccion__intro">Una fila por votación: qué se votó, cómo se votó y el resultado.</p>
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
            { id: 't', titulo: 'Forma de votar', valor: (v) => etiquetaDe(TIPOS_VOTACION, v.tipo_votacion) },
            { id: 'r', titulo: 'Resultado', valor: (v) => v.resultado, render: (v) => <InsigniaCatalogo catalogo={RESULTADOS_VOTACION} valor={v.resultado} /> },
            { id: 'tot', titulo: 'A favor / en contra / abstención', valor: (v) => v.total_favor ?? '', render: (v) => <span className="num">{v.total_favor ?? '—'} / {v.total_contra ?? '—'} / {v.total_abstencion ?? '—'}</span> },
            {
              id: 'cu',
              titulo: '¿Cuadran los nombres con el total?',
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
        <h2>Cómo votó cada persona</h2>
        <p className="seccion__intro">Solo los votos que el acta anota con nombre.</p>
        <TablaVotos votos={votos} titulo="Votos individuales" archivo="votos" />
      </section>
      <section className="seccion">
        <h2>Votos probables</h2>
        <p className="seccion__intro">
          Votos que el acta <strong>no anota con nombre</strong>, pero que podemos deducir con mucha seguridad. <strong>No se suman</strong> a ningún número del Observatorio.
        </p>
        <details className="saber-mas">
          <summary>Saber más: ¿cómo los deducimos?</summary>
          <p className="pequeno">
            Comparamos los nombres del acta con el total que anunció quien dirige la sesión. Solo anotamos un voto probable cuando hay una sola explicación posible: la persona aparece sin decir cómo votó, es la única presente que no aparece, o
            el total anunciado es igual a todas las diputaciones. Si hay dudas, no se lo atribuimos a nadie.
          </p>
        </details>
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
            { id: 's', titulo: 'Cómo votó (probable)', valor: (v) => etiquetaDe(SENTIDOS_VOTO, v.sentido) },
            { id: 'fu', titulo: 'Por qué lo deducimos', valor: (v) => v.fundamento, render: (v) => <span className="muy-pequeno">{v.fundamento}</span> },
          ]}
        />
      </section>
    </>
  );
}
