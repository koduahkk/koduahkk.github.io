import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Next.js guards that only matter inside the app bundle.
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node", fileParallelism: false },
});
