import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    root: 'app',
    publicDir: path.resolve(__dirname, 'public'),
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'app'),
      },
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
