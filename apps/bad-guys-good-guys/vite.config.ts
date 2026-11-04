import { defineConfig } from 'vitest/config';

// Relative base so the build works at a subdomain root and on preview channels.
export default defineConfig({
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
