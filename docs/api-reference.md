# API reference

[Overview](../README.md) · [Getting started](getting-started.md) ·
[Recipes](recipes.md) · [Test runners](test-runners.md) ·
[Runtime testing](runtime-testing.md) ·
[Limitations](limitations.md) · [Troubleshooting](troubleshooting.md)

All public APIs are exported from `hono-testkit`.

## Hono harness

### `createHonoTestHarness(app, bindings)`

Creates a lightweight harness around a Hono application. The supplied bindings
are passed as `c.env` on every request.

- `request(input, init?)` sends any request.
- `get(path, init?)` sends a GET request.
- `post(path, body?, init?)` sends a POST request and JSON-encodes plain values.
- `build(path)` creates a fluent request builder.
- `bindings` exposes the injected bindings for assertions.
- `executionContext` exposes the captured test execution context.

### `createHonoTestSuite(app, factory)`

Creates an isolated suite whose binding factory may be synchronous or
asynchronous.

- `reset()` drains pending `waitUntil()` work, clears or closes the current
  bindings, then creates fresh bindings.
- `dispose()` drains pending work and clears or closes the current bindings.
- Request methods are the same as those on `createHonoTestHarness()`.

### Request builder

The object returned by `build(path)` supports:

- `header(name, value)` and `headers(values)`
- `bearer(token)`
- `cookie(name, value)`
- `json(value)`
- `formData(value)`
- `body(value)`
- `send(method?)`, `get()`, `post()`, `put()`, `patch()`, and `delete()`

### `asBinding<Binding>()(mock)`

Adapts a mock to a generated Cloudflare binding type while retaining the mock's
inspection helpers. This is a TypeScript adapter; it does not add unsupported
runtime methods.

## KV

### `mockKV<Metadata>()`

Returns an isolated `MockKVNamespace` with:

- `put`, `get`, `getWithMetadata`, `delete`, and `list`
- text, JSON, `ArrayBuffer`, and stream reads
- expiration and expiration TTL
- metadata, prefixes, cursors, and list limits
- `has`, `size`, and `clear` inspection helpers

## R2

### `mockR2()`

Returns an isolated `MockR2Bucket` with:

- `put`, `get`, `head`, `delete`, and `list`
- HTTP and custom metadata
- object `text`, `json`, `arrayBuffer`, `blob`, and stream helpers
- `has`, `size`, and `clear` inspection helpers

## D1

### `mockD1(options?)`

Creates an in-memory SQLite database using `sql.js`. Options support `schema`,
`seed`, an existing database `data` buffer, and a custom `locateFile` function.

The returned database supports `prepare`, `batch`, `exec`, `dump`, and `close`.
Prepared statements support `bind`, `first`, `all`, `raw`, and `run`.

## Queues

### `mockQueue<Body>()`

Captures calls made through `send` and `sendBatch`. Use `messages` to inspect
captured entries, `drain()` to consume them, and `clear()` to remove them.

## Service bindings

### `mockService(handler)`

Creates a fetch-compatible service binding. Use `requests` or `lastRequest` for
assertions, `respondWith(handler)` to replace the response behavior,
`failNext(error?)` for a one-shot failure, and `clear()` to reset captured state.

## Execution context

### `mockExecutionContext()`

Captures promises passed to `waitUntil()`. Use `drain()` to await all captured
promises. Calls to `passThroughOnException()` are recorded in
`passThroughOnExceptionCalled`.

## Public types and classes

Factory return types are inferred automatically. The corresponding concrete
classes are also exported for explicit annotations and advanced setup:

- `MockKVNamespace`, `MockR2Bucket`, `MockR2Object`, and `MockD1Database`
- `MockD1PreparedStatement`, `MockQueue`, and `MockServiceBinding`
- `MockExecutionContext`

Options, result shapes, request helpers, and metadata interfaces are exported
with their `Mock*`, `Hono*`, `D1*`, or `KV*` names. Prefer the factory functions
unless constructing a class directly is necessary.
