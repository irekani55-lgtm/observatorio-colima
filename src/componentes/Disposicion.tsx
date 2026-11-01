import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { FUENTES_INSTITUCIONALES, LEGISLATURA } from '../config/legislatura';
import { useDatos } from '../estado/DatosContext';
import { fechaCorta } from '../indicadores/filtro';
import { EnlaceExterno } from './Fuente';
import { cssPartidos } from './colores';
import { IcoCongreso, IcoLuna, IcoMenu, IcoSol, IcoX } from './Iconos';

export const NAV_PRINCIPAL = [
  { a: '/', texto: 'Inicio', fin: true },
  { a: '/mapa', texto: 'Mapa por distrito' },
  { a: '/diputaciones', texto: 'Diputaciones' },
  { a: '/representacion-proporcional', texto: 'Representación proporcional' },
  { a: '/asuntos', texto: 'Actividad legislativa' },
  { a: '/eficacia', texto: 'Indicadores' },
  { a: '/metodologia', texto: 'Metodología' },
  { a: '/fuentes', texto: 'Fuentes y datos' },
];

export const NAV_ACTIVIDAD = [
  { a: '/asistencias', texto: 'Asistencias' },
  { a: '/asuntos', texto: 'Iniciativas y asuntos' },
  { a: '/exhortos', texto: 'Exhortos' },
  { a: '/intervenciones', texto: 'Intervenciones' },
  { a: '/comisiones', texto: 'Comisiones' },
  { a: '/votaciones', texto: 'Votaciones' },
  { a: '/compromisos', texto: 'Compromisos' },
];

export const NOTA_PUBLICA =
  'Este dashboard presenta información pública documentada sobre la actividad legislativa de las diputadas y los diputados de la LXI Legislatura del Congreso del Estado de Colima. Los indicadores describen aspectos específicos de la actividad y del avance de los asuntos legislativos; no constituyen, por sí solos, una calificación definitiva de la calidad, la relevancia social o el impacto del trabajo de cada legislador. La ausencia de un registro no demuestra necesariamente que una actividad no se haya realizado. Se recomienda consultar las fuentes y la metodología antes de interpretar o comparar los resultados.';

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
    window.scrollTo?.(0, 0);
  }, [loc.pathname]);
  const enActividad = NAV_ACTIVIDAD.some((n) => loc.pathname.startsWith(n.a));

  return (
    <>
      <style>{cssPartidos(base)}</style>
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
              <span className="subnav__etiqueta">Actividad</span>
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
            <div>
              <h2>Datos</h2>
              <p>
                Conjunto: <strong>{base.manifiesto.nombre}</strong>
                <br />
                Fecha de corte: {base.manifiesto.fecha_corte ? fechaCorta(base.manifiesto.fecha_corte) : 'sin definir'}
              </p>
              <ul>
                <li><Link to="/metodologia">Metodología</Link></li>
                <li><Link to="/fuentes">Fuentes y calidad de datos</Link></li>
              </ul>
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

export function EncabezadoPagina({ titulo, children, migas, destacado }: { titulo: string; children?: ReactNode; migas?: { a: string; texto: string }[]; destacado?: boolean }) {
  useEffect(() => {
    document.title = `${titulo} | Observatorio Legislativo Colima`;
  }, [titulo]);
  return (
    <header className={`encabezado-pagina${destacado ? ' encabezado-pagina--destacado' : ''}`}>
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
