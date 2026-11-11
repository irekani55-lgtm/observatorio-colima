import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FUENTES_INSTITUCIONALES, LEGISLATURA } from '../config/legislatura';
import { useDatos } from '../estado/DatosContext';
import { fechaCorta } from '../indicadores/filtro';
import { EnlaceExterno } from './Fuente';
import { cssPartidos } from './colores';
import { CAMBIOS_VISTA_PREVIA, claseNuevo, MARCAR_CAMBIOS, Nuevo } from './Nuevo';
import { IcoCongreso, IcoLuna, IcoMenu, IcoSol, IcoX } from './Iconos';

/** Tres opciones. La lista de diputaciones se abre desde el inicio («¿Sabe su nombre?»). Metodología y Fuentes van al pie, en «¿De dónde salen los datos?». */
export const NAV_PRINCIPAL = [
  { a: '/', texto: 'Inicio', fin: true },
  { a: '/asuntos', texto: '¿Qué se hace en el Congreso?' },
  { a: '/congreso', texto: 'El Congreso en números' },
];

export const NAV_ACTIVIDAD = [
  { a: '/asistencias', texto: 'Asistencias' },
  { a: '/asuntos', texto: 'Propuestas' },
  { a: '/exhortos', texto: 'Exhortos' },
  { a: '/intervenciones', texto: 'Quién habla' },
  { a: '/comisiones', texto: 'Comisiones' },
  { a: '/votaciones', texto: 'Votaciones' },
];

export const NOTA_PUBLICA =
  'Este Observatorio muestra lo que han hecho las diputadas y los diputados de la LXI Legislatura del Congreso de Colima, con información de documentos oficiales. Los números cuentan lo que está en esos documentos: no dicen quién trabaja mejor ni qué tan importante fue cada cosa. Si algo no aparece, no quiere decir que no pasó. Antes de comparar, revise de dónde salen los datos.';

function leerTema(): 'light' | 'dark' | null {
  try {
    const t = localStorage.getItem('olc-tema');
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

function BotonTema() {
  const [tema, setTema] = useState<'light' | 'dark' | null>(leerTema);
  useEffect(() => {
    if (tema) document.documentElement.dataset.theme = tema;
    else delete document.documentElement.dataset.theme;
  }, [tema]);
  const oscuro = tema ? tema === 'dark' : typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  return (
    <button
      type="button"
      className="boton boton--fantasma boton--chico boton-tema"
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={() => {
        const nuevo = oscuro ? 'light' : 'dark';
        setTema(nuevo);
        try {
          localStorage.setItem('olc-tema', nuevo);
        } catch {
          /* almacenamiento no disponible */
        }
      }}
    >
      {oscuro ? <IcoSol width={18} height={18} /> : <IcoLuna width={18} height={18} />}
    </button>
  );
}

export function BandaDemo() {
  const { base } = useDatos();
  if (!base.manifiesto.es_demo) return null;
  return (
    <div className="banda-demo" role="note">
      <div className="contenedor">
        <strong>DATOS DE DEMOSTRACIÓN.</strong> Las personas, partidos, cifras y documentos que aparecen son ficticios y solo ilustran el funcionamiento del tablero. <Link to="/fuentes#integracion">Cómo integrar los datos oficiales</Link>
      </div>
    </div>
  );
}

export function Disposicion() {
  const { base } = useDatos();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setMenu(false);
    // Un enlace con ancla (p. ej. /metodologia#votaciones-divididas) lleva a esa sección; si no, al inicio.
    const ancla = loc.hash ? document.getElementById(decodeURIComponent(loc.hash.slice(1))) : null;
    if (ancla) requestAnimationFrame(() => ancla.scrollIntoView?.({ block: 'start' }));
    else window.scrollTo?.(0, 0);
  }, [loc.pathname, loc.hash]);
  const enActividad = NAV_ACTIVIDAD.some((n) => loc.pathname.startsWith(n.a));

  return (
    <>
      <style>{cssPartidos(base)}</style>
      {MARCAR_CAMBIOS && (
        <details className="aviso-vista-previa" role="note">
          <summary>Vista previa · Lo marcado en amarillo es nuevo o cambió (en el oficial no aparecen estas marcas). Ver la lista de cambios</summary>
          <ol>
            {CAMBIOS_VISTA_PREVIA.map((c) => (
              <li key={c.texto}>
                {c.texto} <Link to={c.a}>Ir</Link>
              </li>
            ))}
          </ol>
        </details>
      )}
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <BandaDemo />
      <header className="cabecera">
        <div className="contenedor cabecera__barra">
          <Link to="/" className="marca" aria-label="Observatorio Legislativo Colima, inicio">
            <span className="marca__logo" aria-hidden="true">
              <IcoCongreso color="#fff" />
            </span>
            <span className="marca__texto">
              <span className="marca__titulo">Observatorio Legislativo Colima</span>
              <span className="marca__sub">
                {LEGISLATURA.nombre} {LEGISLATURA.periodo}
              </span>
            </span>
          </Link>
          <BotonTema />
          <button type="button" className="boton boton--chico boton-menu" aria-expanded={menu} aria-controls="nav-principal" onClick={() => setMenu(!menu)}>
            {menu ? <IcoX width={18} height={18} /> : <IcoMenu width={18} height={18} />} Menú
          </button>
        </div>
        <div className="contenedor nav-fila">
          <nav aria-label="Navegación principal" className={`nav${menu ? ' abierto' : ''}`} id="nav-principal">
            {NAV_PRINCIPAL.map((n) => (
              <NavLink key={n.a} to={n.a} end={n.fin} className={({ isActive }) => (isActive || (n.a === '/asuntos' && enActividad) ? 'activo' : '')}>
                {n.texto}
              </NavLink>
            ))}
          </nav>
        </div>
        {enActividad && (
          <nav className="subnav" aria-label="Secciones de actividad legislativa">
            <div className="contenedor">
              <span className="subnav__etiqueta">Ver:</span>
              {NAV_ACTIVIDAD.map((n) => (
                <NavLink key={n.a} to={n.a} className={({ isActive }) => (isActive ? 'activo' : '')}>
                  {n.texto}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>
      <main id="contenido" tabIndex={-1}>
        <div className="contenedor">
          <Outlet />
        </div>
      </main>
      <footer className="pie">
        <div className="contenedor">
          <p className="nota-publica">{NOTA_PUBLICA}</p>
          <div className="pie__rejilla" style={{ marginTop: '1.5rem' }}>
            <div className={claseNuevo()}>
              <h2>¿De dónde salen los datos?</h2>
              <p>
                Datos al {base.manifiesto.fecha_corte ? fechaCorta(base.manifiesto.fecha_corte) : 'sin definir'}, tomados de documentos oficiales.
              </p>
              <ul>
                <li><Link to="/metodologia">Cómo calculamos cada dato</Link></li>
                <li><Link to="/fuentes">Fuentes, calidad y descargas</Link></li>
                <li><Link to="/fuentes#bitacora">Bitácora de observaciones</Link></li>
              </ul>
              <Nuevo texto="Metodología y Fuentes ahora están aquí" />
            </div>
            <div>
              <h2>Fuentes oficiales</h2>
              <ul>
                {FUENTES_INSTITUCIONALES.slice(0, 5).map((f) => (
                  <li key={f.id}>
                    <EnlaceExterno url={f.url}>{f.nombre}</EnlaceExterno>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>Sobre este sitio</h2>
              <p>Proyecto ciudadano de consulta. No es un sitio oficial del H. Congreso del Estado de Colima ni del Instituto Electoral del Estado de Colima.</p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

/**
 * «← Regresar»: vuelve a la página anterior dentro del Observatorio. Si la persona entró directo con un enlace
 * (no hay página anterior aquí), la lleva al inicio.
 */
function BotonRegresar() {
  const navegar = useNavigate();
  const loc = useLocation();
  const hayAnterior = loc.key !== 'default';
  return (
    <p className={`regresar${claseNuevo()}`}>
      <button type="button" className="boton boton--fantasma boton--chico" onClick={() => (hayAnterior ? navegar(-1) : navegar('/'))}>
        ← {hayAnterior ? 'Regresar' : 'Ir al inicio'}
      </button>
      <Nuevo texto="botón para regresar" />
    </p>
  );
}

export function EncabezadoPagina({ titulo, children, migas, destacado }: { titulo: string; children?: ReactNode; migas?: { a: string; texto: string }[]; destacado?: boolean }) {
  useEffect(() => {
    document.title = `${titulo} | Observatorio Legislativo Colima`;
  }, [titulo]);
  return (
    <header className={`encabezado-pagina${destacado ? ' encabezado-pagina--destacado' : ''}`}>
      {!destacado && <BotonRegresar />}
      {migas && (
        <nav className="migas" aria-label="Ruta de navegación">
          {migas.map((m, i) => (
            <span key={m.a}>
              <Link to={m.a}>{m.texto}</Link>
              {i < migas.length - 1 ? ' / ' : ' / '}
            </span>
          ))}
        </nav>
      )}
      <h1>{titulo}</h1>
      {children}
    </header>
  );
}
