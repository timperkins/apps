import { defineConfig } from 'vite';

// Shown in the corner so a phone can tell which deploy it is running.
const stamp = new Date().toISOString().replace(/^\d{4}-(\d\d)-(\d\d)T(\d\d):(\d\d).*$/, '$1$2.$3$4');

// Relative base so the build works at a subdomain root and on preview channels.
export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(stamp) },
});
