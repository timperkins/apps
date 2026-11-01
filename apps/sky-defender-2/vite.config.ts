import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

// Shown in the corner of the game so a phone can tell which deploy it is running.
const stamp = new Date().toISOString().replace(/^\d{4}-(\d\d)-(\d\d)T(\d\d):(\d\d).*$/, '$1$2.$3$4');

export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(`v${pkg.version} · ${stamp}`) },
  build: { target: 'es2022', outDir: 'dist' },
});
