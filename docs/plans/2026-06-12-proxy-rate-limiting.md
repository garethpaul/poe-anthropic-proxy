# Proxy request rate limiting

status: completed

## Context

CodeQL alert 1 (`js/missing-rate-limiting`) identifies the authenticated
`POST /v1/messages` route as an expensive request handler without request-rate
controls. A caller with a valid or guessed credential can otherwise consume
upstream capacity, sockets, and process resources without a local bound.

## Decision

1. Register the maintained Fastify rate-limit plugin before routes so rejected
   requests do not reach authentication, payload conversion, or Poe.
2. Default to 60 requests per 60-second window per client address.
3. Accept bounded positive-integer environment overrides for deployment
   tuning while falling back safely for missing or malformed values.
4. Add deterministic route coverage proving the first request succeeds, the
   next request receives HTTP 429, and the rejected request does not call Poe.
5. Enforce the dependency, registration, configuration, documentation, and
   regression-test contract in the repository baseline checker.

## Verification

- Node 20 focused configuration and route tests passed, including HTTP 429 and
  proof that the rejected request did not call the injected Poe upstream.
- Node 20 and Node 24 completed `make check`; all 29 tests passed on both
  runtimes.
- `npm run lint` and `npm run build` passed on both declared runtimes.
- `npm audit --audit-level=moderate` reported zero vulnerabilities across the
  53-package installed graph.
- Nine hostile mutations removing the dependency, import, global scope,
  environment defaults, route regression, HTTP 429 assertion, documentation,
  or completed plan status were all rejected.
