import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// A hash of every sound file, added to their URLs (?v=) so a browser that cached
// an old clip fetches the new one as soon as any sound changes.
function audioVersion(): string {
  const h = createHash('sha1');
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.mp3')) h.update(p).update(readFileSync(p));
    }
  };
  for (const d of ['sfx', 'voice', 'music']) walk(join(fileURLToPath(new URL('.', import.meta.url)), 'public', d));
  return h.digest('hex').slice(0, 10);
}

// Relative base so the build works at a subdomain root and on preview channels.
// Four pages: the game, the unit and building showcase at /units/, and the
// UI kit (every part of the interface, in each design on the table) at /ui/,
// and every sound, spoken line and music loop at /audio/.
export default defineConfig({
  base: './',
  define: { __AUDIO_V__: JSON.stringify(audioVersion()) },
  build: {
    rollupOptions: {
      input: { main: 'index.html', units: 'units/index.html', ui: 'ui/index.html', audio: 'audio/index.html' },
    },
  },
});
