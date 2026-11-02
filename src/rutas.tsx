import { Route } from 'react-router-dom';
import Inicio from './paginas/Inicio';
import Congreso from './paginas/Congreso';
import { RedirigirMapa } from './paginas/Mapa';
import Directorio from './paginas/Directorio';
import Perfil from './paginas/Perfil';
import RepresentacionProporcional from './paginas/RepresentacionProporcional';
import Asistencias from './paginas/Asistencias';
import Asuntos from './paginas/Asuntos';
import Exhortos from './paginas/Exhortos';
import Intervenciones from './paginas/Intervenciones';
import Comisiones from './paginas/Comisiones';
import Votaciones from './paginas/Votaciones';
import Compromisos from './paginas/Compromisos';
import Eficacia from './paginas/Eficacia';
import Metodologia from './paginas/Metodologia';
import Fuentes from './paginas/Fuentes';
import NoEncontrada from './paginas/NoEncontrada';

/** Rutas de la aplicación (separadas para reutilizarlas en las pruebas). */
export function Rutas() {
  return (
    <>
      <Route index element={<Inicio />} />
      <Route path="congreso" element={<Congreso />} />
      <Route path="mapa" element={<RedirigirMapa />} />
      <Route path="diputaciones" element={<Directorio />} />
      <Route path="diputaciones/:id" element={<Perfil />} />
      <Route path="representacion-proporcional" element={<RepresentacionProporcional />} />
      <Route path="asistencias" element={<Asistencias />} />
      <Route path="asuntos" element={<Asuntos />} />
      <Route path="exhortos" element={<Exhortos />} />
      <Route path="intervenciones" element={<Intervenciones />} />
      <Route path="comisiones" element={<Comisiones />} />
      <Route path="votaciones" element={<Votaciones />} />
      <Route path="compromisos" element={<Compromisos />} />
      <Route path="eficacia" element={<Eficacia />} />
      <Route path="metodologia" element={<Metodologia />} />
      <Route path="fuentes" element={<Fuentes />} />
      <Route path="*" element={<NoEncontrada />} />
    </>
  );
}
