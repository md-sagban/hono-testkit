# Test runners

[Overview](../README.md) · [Getting started](getting-started.md) ·
[Recipes](recipes.md) · [API reference](api-reference.md) ·
[Runtime testing](runtime-testing.md) · [Troubleshooting](troubleshooting.md)

`hono-testkit` does not import assertion, mocking, or test-runner APIs. Its core
factories return ordinary JavaScript objects, promises, `Request` objects, and
`Response` objects. You can therefore use the core mocks with any runner that
provides the web APIs available in Node.js 22 or newer.

Vitest is used by this repository because Cloudflare's `workerd` integration is
a Vitest plugin. It is not installed as a production dependency of
`hono-testkit`.

## Support levels

| Runner | Core mocks and Hono harness | Local `workerd` integration |
| --- | --- | --- |
| Vitest 4 | Tested in CI | Tested in CI |
| Node.js `node:test` | Manually verified | Not provided by the Vitest plugin |
| Jest 30 | Manually verified | Not provided by the Vitest plugin |
| Bun test 1.4 | Manually verified | Not supported here |
| Deno test | Not currently tested | Not supported here |

The packed `0.1.0` package has been exercised manually with Node.js
`node:test`, Jest 30, and Bun test 1.4. These checks covered KV, R2, D1, Queue,
service bindings, execution context, and the Hono harness and suite. Only Vitest
is part of the automated compatibility matrix today.

## Vitest

```ts
import { expect, test } from "vitest";
import { mockQueue } from "hono-testkit";

test("sends a job", async () => {
  const queue = mockQueue<{ userId: number }>();
  await queue.send({ userId: 1 });

  expect(queue.messages[0]?.body).toEqual({ userId: 1 });
});
```

Use Vitest when you also need Cloudflare's local Workers runtime:

```bash
pnpm add -D vitest @cloudflare/vitest-plugin
```

## Node.js test runner

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { mockQueue } from "hono-testkit";

test("sends a job", async () => {
  const queue = mockQueue<{ userId: number }>();
  await queue.send({ userId: 1 });

  assert.deepEqual(queue.messages[0]?.body, { userId: 1 });
});
```

Compile TypeScript before running it, or configure a TypeScript execution tool
appropriate for your project.

## Jest

```ts
import { expect, test } from "@jest/globals";
import { mockQueue } from "hono-testkit";

test("sends a job", async () => {
  const queue = mockQueue<{ userId: number }>();
  await queue.send({ userId: 1 });

  expect(queue.messages[0]?.body).toEqual({ userId: 1 });
});
```

Configure Jest for ESM or CommonJS according to the application's own module
setup. `hono-testkit` publishes both formats with separate TypeScript
declarations.

## Bun test

```ts
import { expect, test } from "bun:test";
import { mockQueue } from "hono-testkit";

test("sends a job", async () => {
  const queue = mockQueue<{ userId: number }>();
  await queue.send({ userId: 1 });

  expect(queue.messages[0]?.body).toEqual({ userId: 1 });
});
```

Bun 1.4 has passed a manual packed-package compatibility check, but it is not
part of the current CI matrix or the package's declared support guarantee.

## What remains runner-independent?

The following APIs do not require Vitest:

- `createHonoTestHarness()` and `createHonoTestSuite()`
- `mockKV()`, `mockR2()`, `mockD1()`, and `mockQueue()`
- `mockService()` and `mockExecutionContext()`
- request builders, inspection helpers, and `asBinding()`

The runner only supplies test organization, assertions, spies, and reporting.
For runtime-accurate Workers tests, follow [Runtime testing](runtime-testing.md).
