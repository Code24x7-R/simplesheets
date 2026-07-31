import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// When building for GitHub Pages, serve from /<repo-name>/ subpath
const isGithubPages = process.env.GITHUB_PAGES === 'true';

// Build timestamp — injected at compile time
const BUILD_TIMESTAMP = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  base: isGithubPages ? '/simplesheets/' : '/',
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          xlsx: ['xlsx'],
          vendor: ['react', 'react-dom'],
          html2pdf: ['html2pdf.js'],
        },
      },
    },
  },
});
