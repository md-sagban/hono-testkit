# Getting started

[Overview](../README.md) · [Recipes](recipes.md) ·
[API reference](api-reference.md) · [Test runners](test-runners.md) ·
[Runtime testing](runtime-testing.md) ·
[Troubleshooting](troubleshooting.md)

This guide creates a complete Hono route test with isolated KV, R2, D1, and
Queue bindings. Each test receives fresh bindings, so state cannot leak between
tests.

## 1. Install

Install the testkit next to Hono and your test runner:

```bash
pnpm add hono
pnpm add -D hono-testkit vitest
```

The package requires Node.js 22 or newer. It supports ESM and CommonJS; the
examples use ESM and TypeScript.

## 2. Create the application

```ts
// src/app.ts
import { Hono } from "hono";

export interface Bindings {
  CACHE: KVNamespace;
  DB: D1Database;
  FILES: R2Bucket;
  JOBS: Queue<{ userId: number }>;
}

export const app = new Hono<{ Bindings: Bindings }>();

app.post("/users", async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  const inserted = await c.env.DB
    .prepare("INSERT INTO users (email) VALUES (?)")
    .bind(email)
    .run();

  if (!inserted.success) return c.json({ error: inserted.error }, 400);

  const userId = inserted.meta.last_row_id;
  await c.env.CACHE.put(`user:${userId}`, email);
  await c.env.FILES.put(`users/${userId}.json`, JSON.stringify({ email }));
  await c.env.JOBS.send({ userId });

  return c.json({ id: userId, email }, 201);
});
```

The binding interfaces above normally come from `wrangler types`. If your
project does not use generated Cloudflare types, define the interfaces required
by your application or use the inferred mock types shown in the next step.

## 3. Create an isolated test suite

```ts
// test/app.test.ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  asBinding,
  createHonoTestSuite,
  mockD1,
  mockKV,
  mockQueue,
  mockR2,
} from "hono-testkit";
import { app } from "../src/app";

const createBindings = async () => ({
  CACHE: asBinding<KVNamespace>()(mockKV()),
  DB: asBinding<D1Database>()(await mockD1({
    schema: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE
      )
    `,
  })),
  FILES: asBinding<R2Bucket>()(mockR2()),
  JOBS: asBinding<Queue<{ userId: number }>>()(
    mockQueue<{ userId: number }>(),
  ),
});

type TestBindings = Awaited<ReturnType<typeof createBindings>>;
const suite = await createHonoTestSuite<TestBindings>(app, createBindings);

beforeEach(() => suite.reset());
afterAll(() => suite.dispose());

describe("POST /users", () => {
  it("stores the user and schedules the job", async () => {
    const response = await suite
      .build("/users")
      .json({ email: "test@example.com" })
      .post();

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 1,
      email: "test@example.com",
    });
    await expect(suite.bindings.CACHE.get("user:1")).resolves.toBe(
      "test@example.com",
    );
    expect(await (await suite.bindings.FILES.get("users/1.json"))?.json()).toEqual({
      email: "test@example.com",
    });
    expect(suite.bindings.JOBS.messages[0]?.body).toEqual({ userId: 1 });
  });
});
```

`asBinding()` is only a TypeScript adapter. It preserves inspection helpers such
as `messages` and `has()` while making the mock assignable to your generated
binding type. It does not implement methods missing at runtime.

## 4. Run the test

```bash
pnpm vitest run
```

Use `createHonoTestHarness()` when shared state is intentional. Use
`createHonoTestSuite()` when every test should receive newly created bindings.

## 5. Add runtime coverage where needed

Unit doubles cannot reproduce every Workers guarantee. Add Cloudflare runtime
tests for platform behavior and Durable Objects. Continue with
[Runtime testing](runtime-testing.md), then use [Practical recipes](recipes.md)
for focused examples of each mock.
