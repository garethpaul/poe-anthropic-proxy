# Poe Upstream Request Timeout

status: completed

## Context

Authenticated proxy requests had no upstream deadline. A stalled Poe connection
could hold a request and server resources indefinitely, including while waiting
for a streaming response.

## Objectives

- Default the upstream request timeout to 30 seconds.
- Accept a 1-300000 millisecond `POE_UPSTREAM_TIMEOUT_MS` override and reject
  invalid or excessive values.
- Pass an `AbortSignal.timeout` signal to every Poe fetch.
- Return and log a stable timeout message without leaking details before
  streaming starts.
- Close an already-started SSE response when its upstream deadline expires.

## Verification

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run audit`
- `make check`
- Mutation: remove the fetch signal and confirm the route test fails.
- Mutation: return a generic `500` for `TimeoutError` and confirm the route test
  fails.
- `git diff --check`
