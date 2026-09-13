# Practical recipes

[Overview](../README.md) · [Getting started](getting-started.md) ·
[API reference](api-reference.md) · [Test runners](test-runners.md) ·
[Runtime testing](runtime-testing.md) ·
[Troubleshooting](troubleshooting.md)

These recipes show the inspection and lifecycle helpers that are useful in
application tests. Every factory returns a new, independent mock. The focused
snippets assume the named factories and Vitest helpers are already imported.

## Send requests to Hono

```ts
const response = await suite
  .build("/profile")
  .bearer("test-token")
  .cookie("session", "abc")
  .header("x-request-id", "request-1")
  .json({ displayName: "Test User" })
  .patch();

expect(response.status).toBe(200);
```

Use `.formData(form)` for multipart requests. It removes a manually assigned
`content-type` so the runtime can generate the correct multipart boundary.

## KV: metadata, expiration, and pagination

```ts
const cache = mockKV<{ source: string }>();

await cache.put("user:1", JSON.stringify({ active: true }), {
  expirationTtl: 300,
  metadata: { source: "test" },
});

const entry = await cache.getWithMetadata<{ active: boolean }>(
  "user:1",
  "json",
);
expect(entry).toEqual({
  value: { active: true },
  metadata: { source: "test" },
});

const firstPage = await cache.list({ prefix: "user:", limit: 10 });
const nextPage = await cache.list({ cursor: firstPage.cursor, limit: 10 });
```

Use `has()`, `size()`, and `clear()` only for test inspection and cleanup.

## R2: bodies and metadata

```ts
const files = mockR2();
const stored = await files.put(
  "profile.json",
  JSON.stringify({ active: true }),
  {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { owner: "user-1" },
  },
);

const object = await files.get("profile.json");
expect(await object?.json()).toEqual({ active: true });
expect((await files.head("profile.json"))?.etag).toBe(stored?.etag);

const headers = new Headers();
object?.writeHttpMetadata(headers);
expect(headers.get("content-type")).toBe("application/json");

await files.delete("profile.json");
```

Objects also expose `text()`, `arrayBuffer()`, `blob()`, and a `body` stream.

## D1: queries, failures, and transactional batches

```ts
const database = await mockD1({
  schema: "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE)",
});

const insert = await database
  .prepare("INSERT INTO users (id, email) VALUES (?, ?)")
  .bind(1, "test@example.com")
  .run();
expect(insert.success).toBe(true);

const user = await database
  .prepare<{ id: number; email: string }>("SELECT * FROM users WHERE id = ?")
  .bind(1)
  .first();

const failure = await database.prepare("SELECT * FROM missing_table").all();
expect(failure.success).toBe(false);
expect(failure.error).toContain("no such table");

await database.batch([
  database.prepare("UPDATE users SET email = ? WHERE id = 1").bind("new@example.com"),
  database.prepare("INSERT INTO users VALUES (?, ?)").bind(2, "two@example.com"),
]);

const snapshot = database.dump();
expect(snapshot.byteLength).toBeGreaterThan(0);
database.close();
```

`all()` and `run()` return D1-style failure results. Direct helpers such as
`first()`, `raw()`, and `exec()` reject when SQLite cannot execute the query.
Always close standalone databases. A test suite closes them during `reset()`
and `dispose()`.

## Queue: single messages, batches, and draining

```ts
const jobs = mockQueue<{ userId: number }>();

await jobs.send({ userId: 1 }, { contentType: "json", delaySeconds: 10 });
await jobs.sendBatch([
  { body: { userId: 2 } },
  { body: { userId: 3 }, delaySeconds: 30 },
]);

expect(jobs.messages).toHaveLength(3);
const captured = jobs.drain();
expect(captured.map((message) => message.body.userId)).toEqual([1, 2, 3]);
expect(jobs.messages).toHaveLength(0);
```

`drain()` returns and removes messages. `clear()` removes them without returning
them. The mock captures producer calls; it does not run a Queue consumer.

## Service binding: responses and one-shot failures

```ts
const payments = mockService(() => Response.json({ paid: true }));

payments.failNext(new Error("offline"));
await expect(payments.fetch("https://payments.test/charge")).rejects.toThrow(
  "offline",
);

payments.respondWith(() => Response.json({ paid: false }));
const response = await payments.fetch("https://payments.test/charge");
expect(await response.json()).toEqual({ paid: false });
expect(payments.lastRequest?.url).toContain("/charge");
```

Use `requests` to inspect all captured requests and `clear()` to reset the mock.

## Execution context: wait for background work

```ts
const harness = createHonoTestHarness(app, bindings);
const response = await harness.post("/send-email", { userId: 1 });

expect(response.status).toBe(202);
const settled = await harness.executionContext.drain();
expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
```

Call `drain()` before asserting work scheduled through `c.executionCtx.waitUntil()`.

## Reset or dispose a suite

```ts
beforeEach(() => suite.reset());
afterAll(() => suite.dispose());
```

`reset()` drains background work, clears or closes current bindings, and creates
a fresh set. `dispose()` drains and closes the final set without creating more.
