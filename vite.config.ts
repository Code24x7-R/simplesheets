import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// When building for GitHub Pages, serve from /<repo-name>/ subpath
const isGithubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  plugins: [react()],
  base: isGithubPages ? '/simplesheets/' : '/',
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
