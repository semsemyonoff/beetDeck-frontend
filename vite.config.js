import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Origin the dev server proxies /api and /static to (the beetDeck backend API).
// Defaults to a backend running on the same host; override with BACKEND_URL.
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Dev server serves from '/'; the production build is served by the backend
  // under /static/dist/.
  base: command === 'build' ? '/static/dist/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: true,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': BACKEND,
      '/static': BACKEND,
    },
  },
}));
