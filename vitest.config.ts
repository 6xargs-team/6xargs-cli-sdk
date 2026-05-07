import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      thresholds: {
        lines: 60,
        functions: 60,
      },
    },
  },
  resolve: {
    conditions: ["node"],
  },
});
