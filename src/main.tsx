import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Tipografía incluida en el sitio (sin pedirla a servidores externos): más privacidad y funciona sin internet.
import '@fontsource/public-sans/latin-400.css';
import '@fontsource/public-sans/latin-600.css';
import '@fontsource/public-sans/latin-700.css';
import '@fontsource/public-sans/latin-400-italic.css';
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
