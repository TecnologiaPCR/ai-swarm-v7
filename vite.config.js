import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir:        'dist',
    sourcemap:     false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  preview: {
    port:          process.env.PORT || 8080,
    host:          '0.0.0.0',
    allowedHosts: 'all',
  },
});
