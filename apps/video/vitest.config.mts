import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Server-only modules can be unit tested outside Next.js.
      "server-only": path.resolve(import.meta.dirname, "src/lib/__tests__/empty.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
