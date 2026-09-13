import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.runtime.jsonc" },
    }),
  ],
  test: {
    include: ["test/runtime/*.test.ts"],
  },
});
