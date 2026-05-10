import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Default output: web-ui/dist/
    // - Docker picks this up via COPY --from=web-build /web-ui/dist/
    // - For local dev without Docker, run `npm run build:local` instead
    outDir: 'dist',
    emptyOutDir: true,
  },

  // Dev server proxy — forwards /api calls to Spring Boot during development
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
