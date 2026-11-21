import { Link } from 'react-router-dom';
import { Aviso } from '../componentes/Aviso';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { FichaResumen, periodoEjercicio } from '../componentes/FichaDiputado';
import { Foto } from '../componentes/Foto';
import { Partido } from '../componentes/Partido';
import { LEGISLATURA } from '../config/legislatura';
import { useDatos } from '../estado/DatosContext';
import { useFiltro } from '../estado/useFiltro';

export default function RepresentacionProporcional() {
  const { base } = useDatos();
  const [filtro, , params, fijar] = useFiltro();
  const rp = base.diputados.filter((d) => d.tipo_representacion === 'RP').sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
  const sel = rp.find((d) => d.id_diputado === params.get('persona'));
  const periodo = { anio: filtro.anio, desde: filtro.desde, hasta: filtro.hasta };

  return (
    <>
      <EncabezadoPagina titulo="Diputaciones de representación proporcional">
        <p>
          {LEGISLATURA.integracion.RP} curules se asignan según la votación que obtiene cada partido en todo el estado. Estas diputaciones <strong>no representan a un distrito geográfico</strong>, por lo que no aparecen en el <Link to="/">mapa de distritos</Link>. Sus indicadores se calculan con la misma metodología.
        </p>
      </EncabezadoPagina>
      {rp.length === 0 ? (
        <Aviso tipo="alerta" titulo="Información pendiente de integración">
          No hay diputaciones de representación proporcional en el catálogo cargado.
        </Aviso>
      ) : (
        <div className="mapa-disposicion">
          <section className="panel" aria-labelledby="titulo-rp">
            <h2 id="titulo-rp" style={{ fontSize: '1.1rem' }}>
              Seleccione una persona ({rp.length})
            </h2>
            <ul className="lista-limpia" style={{ display: 'grid', gap: '0.5rem' }}>
              {rp.map((d) => (
                <li key={d.id_diputado}>
                  <button type="button" className="tarjeta-dip" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', gridTemplateColumns: '48px 1fr', borderColor: sel?.id_diputado === d.id_diputado ? 'var(--primario)' : undefined, borderWidth: sel?.id_diputado === d.id_diputado ? 2 : 1 }} aria-pressed={sel?.id_diputado === d.id_diputado} onClick={() => fijar('persona', d.id_diputado)}>
                    <Foto url={d.url_foto} archivo={d.archivo_foto} nombre={d.nombre_completo} />
                    <span>
                      <span className="tarjeta-dip__nombre" style={{ display: 'block' }}>
                        {d.nombre_completo}
                      </span>
                      <span className="tarjeta-dip__meta">
                        <Partido id={d.id_partido} />
                        <span className="muy-pequeno texto-2">{periodoEjercicio(d, base.manifiesto.fecha_corte)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel" aria-live="polite" aria-label="Ficha seleccionada">
            {sel ? (
              <FichaResumen d={sel} filtro={periodo} />
            ) : (
              <>
                <h2 style={{ fontSize: '1.1rem' }}>Ficha</h2>
                <p className="texto-2">Seleccione una diputación para consultar su asistencia, iniciativas aprobadas y exhortos aprobados.</p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
