/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// Dirección pública del sitio (la pone el flujo de publicación; por ejemplo https://observatoriocolima.mx/).
// WhatsApp y las redes sociales solo muestran la imagen de vista previa si su dirección es completa.
const URL_SITIO = process.env.URL_SITIO ? process.env.URL_SITIO.replace(/\/?$/, '/') : '';
const TITULO = 'Observatorio Legislativo Colima';
const DESCRIPCION = '¿Qué hace su diputada o diputado en el Congreso de Colima? Búsquelo con el número de sección de su credencial y vea qué ha hecho, con documentos oficiales.';

function vistaPreviaAlCompartir(): Plugin {
  const meta = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', TITULO],
    ['property', 'og:locale', 'es_MX'],
    ['property', 'og:title', TITULO],
    ['property', 'og:description', DESCRIPCION],
    ['name', 'twitter:card', 'summary_large_image'],
    ...(URL_SITIO
      ? [
          ['property', 'og:url', URL_SITIO],
          ['property', 'og:image', `${URL_SITIO}compartir.png`],
          ['property', 'og:image:width', '1200'],
          ['property', 'og:image:height', '630'],
          ['property', 'og:image:alt', 'Observatorio Legislativo Colima: ¿Qué hace su diputada o diputado en el Congreso de Colima?'],
          ['name', 'twitter:image', `${URL_SITIO}compartir.png`],
        ]
      : []),
  ];
  return {
    name: 'vista-previa-al-compartir',
    transformIndexHtml: () => meta.map(([attr, nombre, contenido]) => ({ tag: 'meta', attrs: { [attr]: nombre, content: contenido }, injectTo: 'head' as const })),
  };
}

// base relativa: permite publicar el sitio en cualquier subcarpeta (GitHub Pages, servidor institucional).
export default defineConfig({
  base: './',
  plugins: [react(), vistaPreviaAlCompartir()],
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas en archivos separados: se almacenan en caché entre versiones del sitio.
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], graficas: ['recharts'], datos: ['papaparse', 'd3-geo'] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
