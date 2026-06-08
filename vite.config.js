import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend (Flask API) origin the dev server proxies /api and /static to.
// In the DWE `frontend` container this is the `app` service on the compose
// network; override with BACKEND_URL when running the dev server elsewhere
// (e.g. http://localhost:5001 from the host).
const BACKEND = process.env.BACKEND_URL || 'http://app:5000';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Dev server serves from '/'; the production build is served under Flask's
  // /static/dist/ by the backend (or a separate prod image).
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
