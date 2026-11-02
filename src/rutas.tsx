import { Navigate, Route, useLocation, useSearchParams } from 'react-router-dom';
import Inicio from './paginas/Inicio';
import Congreso from './paginas/Congreso';
import { RedirigirMapa } from './paginas/Mapa';
import Directorio from './paginas/Directorio';
import Perfil from './paginas/Perfil';
import Asistencias from './paginas/Asistencias';
import Asuntos from './paginas/Asuntos';
import Exhortos from './paginas/Exhortos';
import Intervenciones from './paginas/Intervenciones';
import Comisiones from './paginas/Comisiones';
import Votaciones from './paginas/Votaciones';
import Compromisos from './paginas/Compromisos';
import Metodologia from './paginas/Metodologia';
import Fuentes from './paginas/Fuentes';
import NoEncontrada from './paginas/NoEncontrada';

/** «Indicadores» se unió a «El Congreso en números». */
function RedirigirIndicadores() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/congreso', search, hash: '#indicadores' }} replace />;
}

/** «Representación proporcional» se unió a «Diputaciones» (filtro «Por lista»). */
function RedirigirRp() {
  const [params] = useSearchParams();
  const persona = params.get('persona');
  return <Navigate to={persona ? `/diputaciones/${encodeURIComponent(persona)}` : '/diputaciones?representacion=RP'} replace />;
}

/** Rutas de la aplicación (separadas para reutilizarlas en las pruebas). */
export function Rutas() {
  return (
    <>
      <Route index element={<Inicio />} />
      <Route path="congreso" element={<Congreso />} />
      <Route path="mapa" element={<RedirigirMapa />} />
      <Route path="diputaciones" element={<Directorio />} />
      <Route path="diputaciones/:id" element={<Perfil />} />
      <Route path="representacion-proporcional" element={<RedirigirRp />} />
      <Route path="asistencias" element={<Asistencias />} />
      <Route path="asuntos" element={<Asuntos />} />
      <Route path="exhortos" element={<Exhortos />} />
      <Route path="intervenciones" element={<Intervenciones />} />
      <Route path="comisiones" element={<Comisiones />} />
      <Route path="votaciones" element={<Votaciones />} />
      <Route path="compromisos" element={<Compromisos />} />
      <Route path="eficacia" element={<RedirigirIndicadores />} />
      <Route path="metodologia" element={<Metodologia />} />
      <Route path="fuentes" element={<Fuentes />} />
      <Route path="*" element={<NoEncontrada />} />
    </>
  );
}
