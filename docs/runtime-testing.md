# Runtime testing

[Overview](../README.md) · [Getting started](getting-started.md) ·
[Recipes](recipes.md) · [Test runners](test-runners.md) ·
[Durable Objects](durable-objects.md) ·
[Limitations](limitations.md) · [Troubleshooting](troubleshooting.md)

The in-memory doubles are designed for fast route and unit tests. Runtime tests
answer a different question: whether the application behaves correctly inside
Cloudflare's `workerd` runtime.

## Repository runtime check

Run the included compatibility test locally:

```bash
pnpm test:runtime
```

It uses `@cloudflare/vitest-plugin` and a local Wrangler configuration. No
Cloudflare account, remote resource, or Wrangler login is required.

The check runs a real Hono Worker and exercises the harness, KV, D1, R2, Queue,
service binding, and execution context mocks inside `workerd`.

## Application runtime tests

Applications should configure Cloudflare's Vitest plugin using their own
Wrangler configuration:

```ts
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
});
```

Use `hono-testkit` for fast, controlled test doubles. Use bindings supplied by
the Workers runtime when the test must verify Cloudflare lifecycle, persistence,
concurrency, or platform-specific behavior.

Remote testing is a separate final confidence layer. It may require Wrangler
authentication and provisioned Cloudflare resources, while the local runtime
tests do not.
