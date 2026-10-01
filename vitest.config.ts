import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    coverage: {
      reportsDirectory: ".tmp/coverage",
    },
  },
});
