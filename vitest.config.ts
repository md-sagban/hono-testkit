import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      thresholds: {
        statements: 85,
        branches: 60,
        functions: 90,
        lines: 85,
      },
    },
  },
});
