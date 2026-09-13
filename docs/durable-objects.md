# Testing Durable Objects

[Overview](../README.md) · [Getting started](getting-started.md) ·
[Test runners](test-runners.md) · [Runtime testing](runtime-testing.md) ·
[Limitations](limitations.md) ·
[Troubleshooting](troubleshooting.md)

`hono-testkit` intentionally does not provide an in-memory Durable Object mock.

Durable Objects are more than a namespace with `idFromName()` and `get()`.
Correct behavior depends on object identity, persistent storage, input and output
gates, single-threaded coordination, alarms, eviction, RPC, and hibernatable
WebSockets. A small JavaScript double would not validate those guarantees and
could allow incorrect production behavior to pass tests.

Use Cloudflare's Vitest integration and configure the Durable Object in the
application's Wrangler file. Cloudflare provides runtime helpers including:

- `runInDurableObject()` to inspect an instance and its storage
- `runDurableObjectAlarm()` to trigger a scheduled alarm
- `evictDurableObject()` to test recovery after instance eviction
- `listDurableObjectIds()` to inspect namespace instances
- `reset()` to clear data attached to test bindings

These tests execute against `workerd` and preserve the lifecycle rules that an
in-memory mock would miss.

See Cloudflare's official guides:

- [Testing Durable Objects](https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/)
- [Workers Vitest test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/)
