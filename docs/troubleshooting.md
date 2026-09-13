# Troubleshooting

[Overview](../README.md) · [Getting started](getting-started.md) ·
[Recipes](recipes.md) · [API reference](api-reference.md) ·
[Test runners](test-runners.md) ·
[Runtime testing](runtime-testing.md) · [Limitations](limitations.md)

## A mock is not assignable to a generated Cloudflare binding

The mocks intentionally implement the common unit-testing surface, not every
method in Cloudflare's interfaces. Adapt the type while keeping inspection
helpers:

```ts
const CACHE = asBinding<KVNamespace>()(mockKV());
```

This is a compile-time adapter only. If the application calls an unimplemented
method, add a runtime integration test or extend the test setup for that case.

## TypeScript cannot find Cloudflare binding names

Generate project types with Wrangler and include the generated declaration file
in `tsconfig.json`. Alternatively, install `@cloudflare/workers-types` for a
test-only project. Prefer generated types in applications because they match the
actual Wrangler configuration.

When using `@cloudflare/workers-types` directly, exclude the browser DOM library
to avoid duplicate global declarations:

```json
{
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types", "vitest/globals"]
  }
}
```

## Multipart form parsing fails

Use `.formData(form)` or pass `FormData` directly to `harness.post()`. Do not set
`content-type` manually; the runtime must append the multipart boundary.

## State leaks between tests

Create bindings through `createHonoTestSuite()` and call `suite.reset()` from
`beforeEach`. A plain harness intentionally reuses the same binding objects.

```ts
beforeEach(() => suite.reset());
afterAll(() => suite.dispose());
```

## Background assertions run too early

Work passed to `waitUntil()` continues after the response. Drain the captured
execution context before asserting its effects:

```ts
await harness.executionContext.drain();
```

The returned array contains `PromiseSettledResult` entries, so rejected
background work can also be asserted.

## A D1 query does not throw

`all()` and `run()` model D1 result objects and report failures with
`success: false` and an `error` message. `first()`, `raw()`, and `exec()` reject
when SQLite cannot execute the statement.

Close databases created directly with `database.close()`. Suites close current
D1 mocks automatically during `reset()` and `dispose()`.

## The local runtime test asks for Cloudflare login

The repository's `pnpm test:runtime` command uses local `workerd` and should not
require an account. Authentication is only expected for remote tests or commands
that access provisioned Cloudflare resources.

## Durable Objects are missing from the package

This is intentional. Their correctness depends on runtime-controlled identity,
storage, concurrency, alarms, eviction, RPC, and WebSocket behavior. Follow
[Testing Durable Objects](durable-objects.md) instead of replacing these
guarantees with an in-memory object.

## ESM works but CommonJS types fail

The package publishes separate JavaScript and declaration files for both module
systems. Ensure the package manager installed the complete package and that a
custom bundler alias is not bypassing the package `exports` map. `require()`
should resolve `dist/index.cjs` with `dist/index.d.cts`.

## The test needs behavior not implemented by a mock

Check [Limitations and compatibility](limitations.md). If the behavior is a
Cloudflare platform guarantee, test it with the Workers runtime. If it is a
deterministic producer or storage operation that belongs in this package, add a
focused test before extending the public API.
