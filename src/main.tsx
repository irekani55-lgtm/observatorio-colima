import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './estilos.css';

// Aplica el tema guardado antes del primer pintado.
try {
  const t = localStorage.getItem('olc-tema');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch {
  /* almacenamiento no disponible */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
