import { useMemo } from 'react';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { BarraFiltros, FiltroParam } from '../componentes/Filtros';
import { EnlaceFuente } from '../componentes/Fuente';
import { InsigniaCatalogo } from '../componentes/Insignia';
import { Tabla } from '../componentes/Tabla';
import { EnlaceDip } from '../componentes/TablasRegistros';
import { fmt, Tarjeta } from '../componentes/Tarjeta';
import { SEGUIMIENTO_COMPROMISO, etiquetaDe } from '../config/catalogos';
import type { Compromiso } from '../datos/modelo';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { compromisosFiltrados } from '../indicadores/compromisos';
import { fechaCorta } from '../indicadores/filtro';

export default function Compromisos() {
  const { base } = useDatos();
  const [filtro, , params] = useFiltro();
  const idDip = params.get('diputado') ?? '';
  const estado = params.get('estado') ?? '';
  const todos = useMemo(() => compromisosFiltrados(base, filtro, idDip || undefined), [base, filtro, idDip]);
  const lista = todos.filter((c) => !estado || c.estado_seguimiento === estado);
  const n = (k: string) => todos.filter((c) => c.estado_seguimiento === k).length;

  return (
    <>
      <EncabezadoPagina titulo="Seguimiento de compromisos públicos">
        <p>Compromisos expresados públicamente por diputadas y diputados que pueden documentarse con fuentes verificables, y lo que se ha documentado sobre ellos.</p>
      </EncabezadoPagina>
      <Aviso>
        Solo se registran fechas límite cuando la fuente las establece. Un compromiso <strong>no se clasifica como incumplido</strong> sin evidencia que lo acredite; la falta de avances localizados se muestra como «sin avance localizado».
      </Aviso>
      <BarraFiltros extraLimpiar={['diputado', 'estado']}>
        <FiltroParam id="diputado" etiqueta="Diputada o diputado" ancho opciones={base.diputados.map((d) => ({ valor: d.id_diputado, etiqueta: d.nombre_completo }))} />
        <FiltroParam id="estado" etiqueta="Seguimiento" opciones={Object.entries(SEGUIMIENTO_COMPROMISO).map(([k, v]) => ({ valor: k, etiqueta: v.etiqueta }))} />
      </BarraFiltros>
      <div className="rejilla rejilla--tarjetas">
        <Tarjeta titulo="Compromisos registrados" valor={base.compromisos.length ? fmt(todos.length) : null} />
        <Tarjeta titulo="Con cumplimiento documentado" valor={base.compromisos.length ? fmt(n('cumplido_documentado')) : null} />
        <Tarjeta titulo="Con avance documentado" valor={base.compromisos.length ? fmt(n('avance_documentado')) : null} />
        <Tarjeta titulo="Sin avance localizado" valor={base.compromisos.length ? fmt(n('sin_avance_localizado')) : null} explica="No equivale a incumplimiento." />
        <Tarjeta titulo="Pendientes o no verificados" valor={base.compromisos.length ? fmt(n('pendiente_seguimiento') + n('no_verificado')) : null} />
      </div>
      <section className="seccion">
        <Tabla<Compromiso>
          titulo="Compromisos"
          filas={lista}
          clave={(c) => c.id_compromiso}
          archivo="compromisos"
          ordenInicial={{ id: 'o', desc: true }}
          vacio="No hay compromisos públicos documentados con estos filtros."
          columnas={[
            { id: 'id', titulo: 'ID', valor: (c) => c.id_compromiso },
            { id: 'd', titulo: 'Compromiso', valor: (c) => c.descripcion },
            { id: 'p', titulo: 'Participantes', valor: (c) => c.participantes.map((p) => p.id_diputado).join(' '), render: (c) => <ul className="lista-limpia muy-pequeno">{c.participantes.map((p) => <li key={p.id_diputado}><EnlaceDip id={p.id_diputado} />{p.rol && ` · ${p.rol}`}</li>)}</ul> },
            { id: 'o', titulo: 'Origen', valor: (c) => c.fecha_origen, render: (c) => fechaCorta(c.fecha_origen) },
            { id: 'l', titulo: 'Fecha límite', valor: (c) => c.fecha_limite, render: (c) => (c.fecha_limite ? fechaCorta(c.fecha_limite) : <span className="texto-3">No establecida</span>) },
            { id: 'r', titulo: 'Resultado documentado', valor: (c) => c.resultado_documentado, render: (c) => c.resultado_documentado || <span className="texto-3">—</span> },
            { id: 'e', titulo: 'Seguimiento', valor: (c) => etiquetaDe(SEGUIMIENTO_COMPROMISO, c.estado_seguimiento), render: (c) => <InsigniaCatalogo catalogo={SEGUIMIENTO_COMPROMISO} valor={c.estado_seguimiento} /> },
            { id: 'f', titulo: 'Evidencia', sinBusqueda: true, valor: (c) => c.id_fuente, render: (c) => <span className="muy-pequeno">Origen: <EnlaceFuente id={c.id_fuente} corto />{c.id_fuente_resultado && <> · Resultado: <EnlaceFuente id={c.id_fuente_resultado} corto /></>}</span> },
          ]}
        />
      </section>
    </>
  );
}
