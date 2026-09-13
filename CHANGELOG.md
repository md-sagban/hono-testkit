# Changelog

## 0.1.0 - 2026-09-13

- Add a typed Hono request harness with injected bindings.
- Add in-memory KV with metadata, expiration and paginated listing.
- Add in-memory R2 with object metadata and body helpers.
- Add Queue capture helpers for single and batch messages.
- Add an ExecutionContext test double with `waitUntil()` draining.
- Add SQLite-backed D1 with prepared statements and transactional batches.
- Add isolated test suites with binding reset and disposal.
- Add Service Binding mocks with request capture and one-shot failures.
- Add a fluent Hono request builder for bearer tokens, cookies, JSON and forms.
- Add adapters for Wrangler-generated Cloudflare binding types.
- Add a real `workerd` compatibility test using Cloudflare's Vitest plugin.
- Make the SQLite-backed D1 mock initialize correctly inside Workers runtimes.
- Document the public API, runtime testing, limitations, and the decision to
  test Durable Objects with `workerd` instead of an in-memory mock.
- Add CI checks for supported Node.js versions and Node test coverage.
- Remove unused public aliases and dependencies before the first release.
- Publish separate ESM and CommonJS type conditions and mark the package as
  side-effect free.
- Add an unused-code and dependency check to the local and CI verification flow.
- Expand tests for Queue batches and lifecycle helpers, R2 operations and body
  helpers, request-builder methods, and D1 failure paths.
- Raise coverage thresholds to preserve the newly covered public API surface.
- Fix R2 `writeHttpMetadata()` to emit standard HTTP header names.
- Build distribution files automatically before creating a package tarball.
- Correct README examples so their bindings and test imports are type-safe.
- Run the full verification and coverage checks automatically before publishing.
- Document the concrete public mock classes and exported type families.
- Add a guided documentation path with getting-started, recipes, and
  troubleshooting pages, plus navigation between all guides.
- Add the public GitHub repository, homepage, and issue-tracker metadata.
- Explain test-runner independence and provide examples for Vitest, Jest,
  `node:test`, and Bun with explicit support levels.
- Manually verify every core API from the packed package with Node's test
  runner, Jest 30, and Bun test 1.4.
