import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// Build timestamp — injected at compile time
// CI can set BUILD_TIMESTAMP env var; otherwise use current time
const BUILD_TIMESTAMP = process.env.BUILD_TIMESTAMP || new Date().toISOString();

// Git commit hash — injected at compile time
// CI can set GITHUB_SHA env var; otherwise fall back to local git command
const getGitCommitHash = (): string => {
  // Use CI-provided env vars first (reliable in all CI environments)
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 7);
  }
  // Fall back to local git command for development
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
};
const GIT_COMMIT_HASH = getGitCommitHash();

export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
    __GIT_COMMIT_HASH__: JSON.stringify(GIT_COMMIT_HASH),
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
