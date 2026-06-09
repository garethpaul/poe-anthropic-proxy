# Poe Proxy Upstream API Key Route Guard

status: completed

## Context

`start()` already refuses to launch without `POE_API_KEY`, but `createServer()`
can also be used directly in tests or embedded runtimes. Without a route-time
guard, a valid inbound proxy token could still reach the fetch layer with an
invalid `Authorization: Bearer undefined` upstream header.

## Goals

- Reject `/v1/messages` locally when the upstream Poe API key is missing.
- Preserve the existing inbound `POE_PROXY_API_KEY` requirement.
- Avoid calling the injected upstream fetch implementation when
  `POE_API_KEY is not configured`.
- Document the behavior in README, SECURITY, VISION, and CHANGES.

## Verification

- `npm test`
- `npm run verify`
- `make check`
- `git diff --check`
