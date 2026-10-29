import { Link } from 'react-router-dom';
import { EncabezadoPagina } from '../componentes/Disposicion';

export default function NoEncontrada() {
  return (
    <EncabezadoPagina titulo="Página no encontrada">
      <p>
        La dirección no corresponde a ninguna sección. <Link to="/">Volver al inicio</Link>.
      </p>
    </EncabezadoPagina>
  );
}
