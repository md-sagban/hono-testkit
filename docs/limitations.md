# Limitations and compatibility

[Overview](../README.md) · [Getting started](getting-started.md) ·
[Recipes](recipes.md) · [Test runners](test-runners.md) ·
[Runtime testing](runtime-testing.md) ·
[Durable Objects](durable-objects.md) · [Troubleshooting](troubleshooting.md)

## Compatibility

| Target | Status |
| --- | --- |
| Hono 4 | Supported |
| Node.js 22 and 24 | Tested in CI |
| ESM and CommonJS consumers | Built and tested |
| Vitest 4 | Used by this repository |
| Cloudflare `workerd` | Compatibility test included |
| Bun and Deno | Not tested |
| Cloudflare remote resources | Not tested by the local suite |

Node.js 22 is the minimum supported version. Repository development and CI use
currently supported Node.js LTS releases.

## Test-double boundaries

The mocks cover common application testing behavior, not every Cloudflare API or
production guarantee.

- KV does not emulate global replication, caching, propagation delays, quotas,
  or eventual consistency.
- R2 does not emulate network behavior, multipart uploads, conditional requests,
  jurisdiction, quotas, or production consistency details.
- D1 runs SQLite through `sql.js`; it does not emulate Cloudflare transport,
  sessions, replicas, bookmarks, quotas, or production concurrency.
- Queue mocks capture producer messages; they do not emulate delivery retries,
  batching schedules, dead-letter queues, acknowledgements, or consumer events.
- Service bindings capture fetch requests; they do not emulate placement,
  deployment boundaries, RPC lifecycle, or network failures unless explicitly
  configured by the test.
- Execution context draining waits for captured promises but does not reproduce
  the complete Workers event lifecycle.
- Durable Objects are intentionally tested with the Workers runtime rather than
  mocked. See [Testing Durable Objects](durable-objects.md).

Use runtime integration tests for behavior that depends on a platform guarantee.
Use remote tests only when the behavior cannot be represented locally.
