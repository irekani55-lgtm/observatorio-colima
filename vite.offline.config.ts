/**
 * Compilación para la versión sin conexión: un solo paquete de JavaScript (sin trozos aparte), que
 * scripts/construir-offline.mjs mete junto con los datos, el mapa y las fotos en un único archivo HTML.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist-offline',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
