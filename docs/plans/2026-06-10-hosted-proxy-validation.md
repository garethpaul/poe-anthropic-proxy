# Hosted Proxy Validation

status: completed

## Context

The proxy has a lockfile, injected-fetch tests, inbound authentication, and
upstream credential guards, but no hosted validation runs the full dependency
and security gate.

## Priorities

1. Run the full `make check` gate on Node 20 and Node 24.
2. Install dependencies exactly from `package-lock.json` with `npm ci`.
3. Preserve inbound auth, upstream-key, schema, and error-mapping tests.
4. Run the configured moderate-level dependency audit.
5. Keep all proxy and upstream credentials absent from hosted jobs.

## Implementation Units

Add a commit-pinned, read-only hosted Linux matrix with a fixed runner,
timeout, and concurrency cancellation. Enforce the workflow contract from the
portable shell baseline.

## Verification

- `npm ci --ignore-scripts`
- `npm test`
- `make check`
- Node 20 and Node 24 test execution
- workflow YAML parse
- `git diff --check`
- successful hosted Linux `Check` workflow for both Node versions

## Boundaries

- Do not use live Poe requests or provide API credentials.
- Do not change proxy request or response behavior in this pass.
- Do not update dependencies outside the existing lockfile.
