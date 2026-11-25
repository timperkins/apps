import { defineConfig } from 'vite';

// Relative base so the build works at a subdomain root and on preview channels.
// Four pages: the game, the unit and building showcase at /units/, and the
// UI kit (every part of the interface, in each design on the table) at /ui/,
// and every sound, spoken line and music loop at /audio/.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { main: 'index.html', units: 'units/index.html', ui: 'ui/index.html', audio: 'audio/index.html' },
    },
  },
});
