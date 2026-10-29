import { HashRouter, Route, Routes } from 'react-router-dom';
import { Disposicion } from './componentes/Disposicion';
import { ProveedorDatos } from './estado/DatosContext';
import { Rutas } from './rutas';

/**
 * HashRouter: el sitio funciona como archivos estáticos en cualquier
 * servidor (incluido GitHub Pages) sin configurar redirecciones.
 */
export default function App() {
  return (
    <ProveedorDatos>
      <HashRouter>
        <Routes>
          <Route element={<Disposicion />}>{Rutas()}</Route>
        </Routes>
      </HashRouter>
    </ProveedorDatos>
  );
}
