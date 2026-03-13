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
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
              if (id.includes('motion')) return 'motion';
              if (id.includes('react-router')) return 'router';
              if (id.includes('lucide-react')) return 'icons';
            }
          },
          chunkFileNames: 'assets/[name]-[hash].js',
        },
      },
      chunkSizeWarningLimit: 400,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
