import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BuscadorDistrito } from '../componentes/BuscadorDistrito';
import { BuscadorNombre } from '../componentes/BuscadorNombre';
import { EncabezadoPagina } from '../componentes/Disposicion';
import { fmt, fmtPct } from '../componentes/Tarjeta';
import { Termino } from '../componentes/Termino';
import { claseNuevo, Nuevo } from '../componentes/Nuevo';
import { LEGISLATURA } from '../config/legislatura';
import { useDatos } from '../estado/DatosContext';
import { asistenciaAgregada } from '../indicadores/asistencia';
import { esAprobado } from '../indicadores/asuntos';
import { contarPorAlcance } from '../indicadores/clasificacion';
import { fechaCorta } from '../indicadores/filtro';
import { MapaInteractivo } from './Mapa';

/** Las tres tareas de una diputación, en palabras sencillas. */
const FUNCIONES = [
  {
    titulo: 'Hacer leyes',
    texto: 'Propone leyes nuevas o cambios a las que ya existen, y vota para aprobarlas o rechazarlas.',
    enlace: { a: '/asuntos?tipo=iniciativa', texto: 'Ver las propuestas' },
  },
  {
    titulo: 'Representar',
    texto: 'Lleva al Congreso las necesidades de la gente de su distrito o de todo el estado y habla por ella en tribuna.',
    enlace: { a: '/intervenciones', texto: 'Ver quién habla en tribuna' },
  },
  {
    titulo: 'Vigilar al gobierno',
    texto: 'Revisa en qué se gasta el dinero público y pide a otras autoridades que atiendan problemas (exhortos).',
    enlace: { a: '/exhortos', texto: 'Ver los exhortos' },
  },
];

/**
 * Página de inicio: ¿quién me representa? y un resumen en tres frases.
 * Los números completos y las gráficas están en «El Congreso en números» (/congreso).
 */
export default function Inicio() {
  const { base } = useDatos();
  const resumen = useMemo(() => {
    const ini = base.asuntos.filter((a) => a.tipo === 'iniciativa');
    const iniAprob = ini.filter(esAprobado);
    const exh = base.asuntos.filter((a) => a.tipo === 'exhorto');
    const asis = asistenciaAgregada(base, base.diputados, {});
    return {
      ini: ini.length,
      iniAprob: iniAprob.length,
      alcance: contarPorAlcance(iniAprob),
      exh: exh.length,
      exhAprob: exh.filter(esAprobado).length,
      asis,
    };
  }, [base]);
  const corte = base.manifiesto.fecha_corte;
  const hayDatos = base.asuntos.length > 0;

  return (
    <>
      <EncabezadoPagina titulo="¿Qué hace su diputada o diputado en el Congreso de Colima?" destacado>
        <p>Conozca quién le representa en el Congreso del Estado y qué ha hecho. Todos los datos vienen de documentos oficiales.</p>
        <p className="pequeno texto-3">
          Datos al <strong>{corte ? fechaCorta(corte) : 'sin definir'}</strong> · <Link to="/metodologia">¿Cómo obtenemos los datos?</Link>
        </p>
      </EncabezadoPagina>

      <section className={`seccion${claseNuevo()}`} aria-labelledby="titulo-funciones" style={{ marginTop: 0 }}>
        <h2 id="titulo-funciones">¿Qué hace una diputación?</h2>
        <Nuevo texto="ahora va al principio" />
        <p className="seccion__intro">El Congreso de Colima tiene {LEGISLATURA.integracion.total} diputaciones. Cada una tiene tres tareas principales:</p>
        <div className="rejilla rejilla--3 funciones">
          {FUNCIONES.map((f, i) => (
            <div key={f.titulo} className="panel funcion">
              <span className="funcion__numero" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{f.titulo}</h3>
              <p className="pequeno">{f.texto}</p>
              <Link className="pequeno" to={f.enlace.a}>
                {f.enlace.texto}
              </Link>
            </div>
          ))}
        </div>
      </section>


      <section className="seccion" aria-labelledby="titulo-mapa-inicio">
        <h2 id="titulo-mapa-inicio">¿Quién le representa?</h2>
        <p className="seccion__intro">Búsquelo con el número de sección de su credencial para votar o toque su distrito en el mapa.</p>
        <div className="buscadores">
          <BuscadorDistrito clave="mapa_distrito" />
          <div className={claseNuevo()}>
            <BuscadorNombre />
            <Nuevo texto="buscar por nombre" />
          </div>
        </div>
        <MapaInteractivo clave="mapa_distrito" />
      </section>

      {hayDatos && (
        <section className={`seccion${claseNuevo()}`} aria-labelledby="titulo-resumen">
          <h2 id="titulo-resumen">El Congreso en resumen</h2>
          <Nuevo texto="ahora va después del mapa" />
          <ul className="resumen-frases">
            <li>
              Desde que empezó esta Legislatura, en octubre de 2024, llegaron al Congreso <strong>{fmt(resumen.ini)}</strong> propuestas de ley y se aprobaron <strong>{fmt(resumen.iniAprob)}</strong>. Pero no todas pesan
              igual: <strong>{fmt(resumen.alcance.fondo)}</strong> crean o cambian leyes; <strong>{fmt(resumen.alcance.tramite)}</strong> son trámites de cada año, como descuentos en el predial o el agua, o las
              cuentas de ingresos de cada municipio; y <strong>{fmt(resumen.alcance.conmemorativa)}</strong> son homenajes o fechas especiales.{' '}
              <Link to="/metodologia#clasificacion-propuestas">¿Cómo las separamos?</Link>
            </li>
            <li>
              Las diputaciones pidieron <strong>{fmt(resumen.exh)}</strong> veces a otras autoridades que atendieran un problema (a esto se le llama <Termino t="exhorto">exhorto</Termino>). El Congreso aprobó{' '}
              <strong>{fmt(resumen.exhAprob)}</strong> de esas peticiones, pero la autoridad no está obligada a hacer caso.
            </li>
            {resumen.asis.porcentaje != null && (
              <li>
                En promedio, las diputaciones fueron al <strong>{fmtPct(resumen.asis.porcentaje)}</strong> de las sesiones del Congreso.
              </li>
            )}
          </ul>
          <p>
            <Link to="/congreso" className="boton boton--primario">
              Ver el Congreso en números
            </Link>
          </p>
        </section>
      )}
    </>
  );
}
