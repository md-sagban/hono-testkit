# hono-testkit

[![CI](https://github.com/md-sagban/hono-testkit/actions/workflows/ci.yml/badge.svg)](https://github.com/md-sagban/hono-testkit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/hono-testkit.svg)](https://www.npmjs.com/package/hono-testkit)
[![npm downloads](https://img.shields.io/npm/dm/hono-testkit.svg)](https://www.npmjs.com/package/hono-testkit)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Typed, in-memory Cloudflare bindings for testing Hono applications without
connecting to real KV, D1, R2, or Queue resources.

Use it for fast, deterministic unit and route tests. Use Cloudflare's Vitest
integration when a test depends on the actual Workers runtime, persistence,
concurrency, or Durable Object lifecycle.

The in-memory mocks and Hono harness do not import Vitest and are test-runner
agnostic. This repository uses Vitest because Cloudflare's local `workerd`
plugin is built for it. See [Test runners](docs/test-runners.md) for Vitest,
Jest, `node:test`, and Bun examples and their support level.

## Choose the right test layer

| What you need to verify | Recommended tool |
| --- | --- |
| Route behavior with controlled bindings | `hono-testkit` |
| KV, D1, R2, Queue, and service calls | `hono-testkit` |
| Workers runtime compatibility | Cloudflare Vitest integration |
| Durable Object runtime behavior | Cloudflare Vitest integration |
| Provisioned remote Cloudflare resources | Wrangler remote tests |

## Install

```bash
npm install --save-dev hono-testkit
```

Install your preferred test runner separately. The examples below use Vitest,
but the core package also works with Jest, `node:test`, and Bun.

## Test a Hono route

```ts
import { Hono } from "hono";
import { expect, test } from "vitest";
import {
  createHonoTestHarness,
  mockR2,
} from "hono-testkit";

const bindings = {
  FILES: mockR2(),
};

const app = new Hono<{ Bindings: typeof bindings }>();

app.post("/files", async (c) => {
  await c.env.FILES.put("hello.txt", "Hello");
  return c.json({ ok: true });
});

const harness = createHonoTestHarness(app, bindings);

test("stores a file", async () => {
  const response = await harness.post("/files");

  expect(response.status).toBe(200);
  expect(bindings.FILES.has("hello.txt")).toBe(true);
});
```

## Isolated suites

Use a binding factory when every test must start from clean state:

```ts
import { Hono } from "hono";
import { afterAll, beforeEach } from "vitest";
import { createHonoTestSuite, mockD1, mockKV } from "hono-testkit";

const createBindings = async () => ({
  CACHE: mockKV(),
  DB: await mockD1({
    schema: "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)",
  }),
});

type Bindings = Awaited<ReturnType<typeof createBindings>>;
const app = new Hono<{ Bindings: Bindings }>();
const suite = await createHonoTestSuite(app, createBindings);

beforeEach(() => suite.reset());
afterAll(() => suite.dispose());
```

## Request builder

Using the suite from the previous example:

```ts
const response = await suite
  .build("/api/profile")
  .bearer("test-token")
  .cookie("session", "abc")
  .json({ name: "Test" })
  .post();
```

The builder also supports `FormData` without overriding its multipart boundary.

## KV

`mockKV()` supports `put`, `get`, `getWithMetadata`, `delete`, prefix listing,
pagination, expiration, and test inspection helpers.

## R2

`mockR2()` supports `put`, `get`, `head`, `delete`, listing, metadata, streams,
text, JSON, blobs, and array buffers.

## D1

`mockD1()` runs real SQLite queries in memory through `sql.js`. It supports
`prepare`, `bind`, `first`, `all`, `raw`, `run`, transactional `batch`, `exec`,
and database dumps.

```ts
import { mockD1 } from "hono-testkit";

const database = await mockD1({
  schema: "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)",
  seed: "INSERT INTO users VALUES (1, 'test@example.com')",
});

const user = await database
  .prepare("SELECT * FROM users WHERE id = ?")
  .bind(1)
  .first();
```

## Queues

`mockQueue()` captures `send` and `sendBatch` calls. Inspect `messages`, call
`drain()` to consume them, or `clear()` between tests.

## Service bindings

```ts
import { expect } from "vitest";
import { mockService } from "hono-testkit";

const PAYMENTS = mockService(() => Response.json({ paid: true }));
const response = await PAYMENTS.fetch("https://payments.test/charge");

expect(PAYMENTS.lastRequest?.url).toContain("/charge");
```

Use `failNext()` to test one-shot service failures.

## Generated Cloudflare types

Mocks intentionally implement the common unit-testing surface rather than every
production method. Adapt a mock to a generated binding type while retaining its
inspection helpers:

```ts
import { asBinding, mockD1, mockKV } from "hono-testkit";

const CACHE = asBinding<KVNamespace>()(mockKV());
const DB = asBinding<D1Database>()(await mockD1());
```

## Execution context

`mockExecutionContext()` captures `waitUntil()` promises. Call `drain()` before
asserting background side effects.

## Runtime compatibility

The repository includes an integration test that runs a real Hono Worker inside
Cloudflare's local `workerd` runtime through `@cloudflare/vitest-plugin`.

```bash
pnpm test:runtime
```

This local test does not require a Cloudflare account or Wrangler login. It
checks that the Hono harness and the KV, D1, R2, Queue, service, and execution
context mocks can execute inside the Workers runtime.

## Durable Objects

Durable Objects are intentionally not mocked. Their identity, persistent
storage, concurrency, alarms, eviction, RPC, and WebSocket behavior depend on
the Workers runtime. Test them with Cloudflare's Vitest integration instead of
an in-memory double. See [Testing Durable Objects](docs/durable-objects.md).

## Documentation

- [Getting started](docs/getting-started.md)
- [Practical recipes](docs/recipes.md)
- [Test runners](docs/test-runners.md)
- [API reference](docs/api-reference.md)
- [Runtime testing](docs/runtime-testing.md)
- [Testing Durable Objects](docs/durable-objects.md)
- [Limitations and compatibility](docs/limitations.md)
- [Troubleshooting](docs/troubleshooting.md)

## Scope

This package intentionally provides fast unit-test doubles. Use Miniflare or
Cloudflare's Vitest integration for runtime-accurate integration tests. The D1
double runs real SQLite, but it does not emulate Cloudflare's network, limits,
replication, or production consistency behavior.

## Contributing

Contributions and bug reports are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md)
for the development and verification workflow.

## Author

[Mohammed Sagban](https://github.com/md-sagban)

## License

MIT © 2026 Mohammed Sagban. See [LICENSE](LICENSE).
