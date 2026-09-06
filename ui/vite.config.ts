import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, open: false, proxy: { '/api': 'http://localhost:8791' } },
  build: { target: 'es2022' },
});
