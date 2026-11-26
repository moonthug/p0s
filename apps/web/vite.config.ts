import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3300';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5300,
    // Mirrors nginx in production: /api/* → the API with the prefix stripped.
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
