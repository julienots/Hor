import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Mode « single » : produit un unique fichier HTML autonome (dist-single/index.html).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: mode === 'single'
    ? { outDir: 'dist-single', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 4000 }
    : {
        outDir: 'dist',
        chunkSizeWarningLimit: 1500,
        rollupOptions: { input: { main: resolve(__dirname, 'index.html'), viewer: resolve(__dirname, 'viewer.html') } },
      },
  server: { port: 5173 },
}));
