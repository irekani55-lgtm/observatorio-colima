import { useMemo } from 'react';
import { Aviso } from '../componentes/Aviso';
import { SERIES } from '../componentes/colores';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { BarraFiltros, FiltroParam } from '../componentes/Filtros';
import { GraficaBarras, PanelGrafica } from '../componentes/Graficas';
import { TablaIntervenciones, nombreDip } from '../componentes/TablasRegistros';
import { fmt, Tarjeta } from '../componentes/Tarjeta';
import { TIPOS_INTERVENCION, etiquetaDe } from '../config/catalogos';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';
import { conteoPor, intervencionesFiltradas } from '../indicadores/intervenciones';

export default function Intervenciones() {
  const { base } = useDatos();
  const [filtro, , params] = useFiltro();
  const idDip = params.get('diputado') ?? '';
  const tema = params.get('tema') ?? '';
  const tipo = params.get('tipo') ?? '';
  const lista = useMemo(() => intervencionesFiltradas(base, filtro).filter((i) => (!idDip || i.id_diputado === idDip) && (!tema || i.tema === tema) && (!tipo || i.tipo_intervencion === tipo)), [base, filtro, idDip, tema, tipo]);
  const porPersona = conteoPor(lista, (i) => nombreDip(base, i.id_diputado)).sort((a, b) => a.clave.localeCompare(b.clave));
  const porTema = conteoPor(lista, (i) => i.tema);
  const temas = [...new Set(base.intervenciones.map((i) => i.tema).filter(Boolean))].sort();
  const verificadas = lista.filter((i) => i.estado_verificacion === 'verificado').length;

  return (
    <>
      <EncabezadoPagina titulo="Intervenciones en tribuna">
        <p>Intervenciones registradas en el Diario de los Debates, versiones estenográficas y otros documentos oficiales.</p>
      </EncabezadoPagina>
      <Aviso>
        El número de intervenciones describe <strong>participación documentada</strong>. No mide la calidad de los argumentos ni su impacto, y una mayor cantidad no significa mejor desempeño.
      </Aviso>
      <BarraFiltros extraLimpiar={['diputado', 'tema', 'tipo']}>
        <FiltroParam id="diputado" etiqueta="Diputada o diputado" ancho opciones={base.diputados.map((d) => ({ valor: d.id_diputado, etiqueta: d.nombre_completo }))} />
        <FiltroParam id="tema" etiqueta="Tema" opciones={temas.map((t) => ({ valor: t, etiqueta: t }))} />
        <FiltroParam id="tipo" etiqueta="Tipo de intervención" opciones={Object.entries(TIPOS_INTERVENCION).map(([k, v]) => ({ valor: k, etiqueta: v.etiqueta }))} />
      </BarraFiltros>
      <div className="rejilla rejilla--tarjetas">
        <Tarjeta titulo="Intervenciones documentadas" valor={base.intervenciones.length ? fmt(lista.length) : null} detalle={`${fmt(verificadas)} verificadas`} />
        <Tarjeta titulo="Personas con intervenciones" valor={base.intervenciones.length ? fmt(new Set(lista.map((i) => i.id_diputado)).size) : null} />
        <Tarjeta titulo="Temas abordados" valor={base.intervenciones.length ? fmt(porTema.length) : null} />
        <Tarjeta titulo="Tipo más frecuente" valor={lista.length ? etiquetaDe(TIPOS_INTERVENCION, conteoPor(lista, (i) => i.tipo_intervencion)[0].clave) : null} />
      </div>
      <section className="seccion rejilla rejilla--2">
        <PanelGrafica titulo="Intervenciones por persona" nota="Orden alfabético." datos={porPersona} columnas={[{ clave: 'clave', etiqueta: 'Persona' }, { clave: 'total', etiqueta: 'Intervenciones' }]}>
          <GraficaBarras datos={porPersona} claveX="clave" series={[{ clave: 'total', etiqueta: 'Intervenciones', color: SERIES[0] }]} horizontal anchoEtiqueta={190} etiquetaEje={(v) => (v.length > 26 ? `${v.slice(0, 25)}…` : v)} />
        </PanelGrafica>
        <PanelGrafica titulo="Temas abordados" datos={porTema} columnas={[{ clave: 'clave', etiqueta: 'Tema' }, { clave: 'total', etiqueta: 'Intervenciones' }]}>
          <GraficaBarras datos={porTema} claveX="clave" series={[{ clave: 'total', etiqueta: 'Intervenciones', color: SERIES[2] }]} horizontal anchoEtiqueta={150} />
        </PanelGrafica>
      </section>
      <section className="seccion">
        <h2>Registros</h2>
        <TablaIntervenciones lista={lista} titulo="Intervenciones" archivo="intervenciones" />
      </section>
    </>
  );
}
