import { defineConfig } from 'vite';

// Relative base so the build works at a subdomain root and on preview channels.
// Three pages: the game, the unit and building showcase at /units/, and the
// UI kit (every part of the interface, in each design on the table) at /ui/.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { main: 'index.html', units: 'units/index.html', ui: 'ui/index.html' },
    },
  },
});
