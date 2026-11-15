import { defineConfig } from 'vite';

// Shown in the corner of Space Defender so a phone can tell which deploy it is running.
const stamp = new Date().toISOString().replace(/^\d{4}-(\d\d)-(\d\d)T(\d\d):(\d\d).*$/, '$1$2.$3$4');

// Relative base so the build works at a subdomain root and on preview channels.
// Space Defender is its own page (run in a frame by the hub) so its global styles and keys stay out of the launcher.
export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(`space defender · ${stamp}`) },
  build: {
    rollupOptions: {
      input: ['index.html', 'space-defender.html'],
    },
  },
});
