import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works from any subpath.
  base: './',
  build: {
    rollupOptions: {
      // The big screen and the phone controller are separate pages.
      input: {
        main: 'index.html',
        controller: 'controller.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
