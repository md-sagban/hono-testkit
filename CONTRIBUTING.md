# Contributing

## Development

```bash
pnpm install
pnpm check
pnpm test:coverage
```

Every behavior should be covered by a focused test. Test doubles should model
documented Cloudflare behavior closely enough for unit tests and clearly state
where they intentionally differ from the production runtime.

`pnpm check` also runs Knip so unused files and dependencies do not accumulate.

## Before a release

1. Run `pnpm check`.
2. Run `pnpm test:coverage`.
3. Review `CHANGELOG.md`.
4. Run `npm pack --dry-run` and inspect the included files.
5. Test the tarball from a separate example Hono project.

Publishing is intentionally a separate manual action.
