import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 3000, host: '0.0.0.0' },
  plugins: [],
  build: { target: 'es2022' },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});

