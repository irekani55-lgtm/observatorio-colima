/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: permite publicar el sitio en cualquier subcarpeta (GitHub Pages, servidor institucional).
export default defineConfig({
  base: './',
  plugins: [react()],
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
