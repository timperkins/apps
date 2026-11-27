import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dir = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/server\//, replacement: dir('./server/') },
      { find: /^@\/shared\//, replacement: dir('./shared/') },
      { find: /^@\//, replacement: dir('./src/') },
    ],
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
