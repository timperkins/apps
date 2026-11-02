import { defineConfig } from 'vite';

// Relative base so the build works at a subdomain root and on preview channels.
export default defineConfig({
  base: './',
  // three.js alone is ~600 kB; one chunk is fine for a game.
  build: { chunkSizeWarningLimit: 1000 },
});
