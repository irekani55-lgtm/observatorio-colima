import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BuscadorDistrito } from "../componentes/BuscadorDistrito";
import { EncabezadoPagina } from "../componentes/Disposicion";
import { fmt, fmtPct } from "../componentes/Tarjeta";
import { Termino } from "../componentes/Termino";
import { LEGISLATURA } from "../config/legislatura";
import { useDatos } from "../estado/DatosContext";
import { asistenciaAgregada } from "../indicadores/asistencia";
import { esAprobado } from "../indicadores/asuntos";
import { contarPorAlcance } from "../indicadores/clasificacion";
import { fechaCorta } from "../indicadores/filtro";
import { MapaInteractivo } from "./Mapa";

/** Las tres tareas de una diputación, en palabras sencillas. */
const FUNCIONES = [
  {
    titulo: "Hacer leyes",
    texto:
      "Propone leyes nuevas o cambios a las que ya existen, y vota para aprobarlas o rechazarlas.",
    enlace: { a: "/asuntos?tipo=iniciativa", texto: "Ver las propuestas" },
  },
  {
    titulo: "Representar",
    texto:
      "Lleva al Congreso las necesidades de la gente de su distrito o de todo el estado y habla por ella en tribuna.",
    enlace: { a: "/intervenciones", texto: "Ver quién habla en tribuna" },
  },
  {
    titulo: "Vigilar al gobierno",
    texto:
      "Revisa en qué se gasta el dinero público y pide a otras autoridades que atiendan problemas (exhortos).",
    enlace: { a: "/exhortos", texto: "Ver los exhortos" },
  },
];

/**
 * Página de inicio: ¿quién me representa? y un resumen en tres frases.
 * Los números completos y las gráficas están en «El Congreso en números» (/congreso).
 */
export default function Inicio() {
  const { base } = useDatos();
  const resumen = useMemo(() => {
    const ini = base.asuntos.filter((a) => a.tipo === "iniciativa");
    const iniAprob = ini.filter(esAprobado);
    const exh = base.asuntos.filter((a) => a.tipo === "exhorto");
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
      <EncabezadoPagina
        titulo="¿Qué hace su diputada o diputado en el Congreso de Colima?"
        destacado
      >
        <p>
          Conozca quién le representa en el Congreso del Estado y qué ha hecho.
          Todos los datos vienen de documentos oficiales.
        </p>
        <p className="pequeno texto-3">
          Datos al <strong>{corte ? fechaCorta(corte) : "sin definir"}</strong>{" "}
          · <Link to="/metodologia">¿Cómo obtenemos los datos?</Link>
        </p>
      </EncabezadoPagina>

      <section
        className="seccion"
        aria-labelledby="titulo-mapa-inicio"
        style={{ marginTop: 0 }}
      >
        <h2 id="titulo-mapa-inicio">¿Quién le representa?</h2>
        <p className="seccion__intro">
          Búsquelo con el número de sección de su credencial para votar o toque
          su distrito en el mapa.
        </p>
        <BuscadorDistrito clave="mapa_distrito" />
        <MapaInteractivo clave="mapa_distrito" />
      </section>

      <section className="seccion" aria-labelledby="titulo-funciones">
        <h2 id="titulo-funciones">¿Qué hace una diputación?</h2>
        <p className="seccion__intro">
          El Congreso de Colima tiene {LEGISLATURA.integracion.total}{" "}
          diputaciones. Cada una tiene tres tareas principales:
        </p>
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

      {hayDatos && (
        <section className="seccion" aria-labelledby="titulo-resumen">
          <h2 id="titulo-resumen">El Congreso en resumen</h2>
          <ul className="resumen-frases">
            <li>
              Se han presentado <strong>{fmt(resumen.ini)}</strong>{" "}
              <Termino t="iniciativa">iniciativas</Termino> y el Congreso aprobó{" "}
              <strong>{fmt(resumen.iniAprob)}</strong>. De las aprobadas,{" "}
              <strong>{fmt(resumen.alcance.fondo)}</strong> cambian o crean
              leyes; <strong>{fmt(resumen.alcance.tramite)}</strong> son
              trámites que se repiten cada año (como descuentos en el predial o
              leyes de ingresos de los municipios) y{" "}
              <strong>{fmt(resumen.alcance.conmemorativa)}</strong> son
              reconocimientos o fechas conmemorativas.{" "}
              <Link
                to="/metodologia#clasificacion-propuestas"
                className="texto-3"
              >
                ¿Cómo las separamos?
              </Link>
            </li>
            <li>
              Se presentaron <strong>{fmt(resumen.exh)}</strong>{" "}
              <Termino t="exhorto">exhortos</Termino> y el Congreso aprobó{" "}
              <strong>{fmt(resumen.exhAprob)}</strong>. Aprobar un exhorto no
              obliga a la autoridad a atenderlo.
            </li>
            {resumen.asis.porcentaje != null && (
              <li>
                En conjunto, las diputaciones registraron asistencia en el{" "}
                <strong>{fmtPct(resumen.asis.porcentaje)}</strong> de las{" "}
                <Termino t="sesion">sesiones</Termino> en que les tocaba estar.
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
