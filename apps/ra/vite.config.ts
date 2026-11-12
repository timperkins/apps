import { defineConfig } from 'vite';

// Relative base so the build works at a subdomain root and on preview channels.
// Two pages: the game, and the unit and building showcase at /units/.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { main: 'index.html', units: 'units/index.html' },
    },
  },
});
