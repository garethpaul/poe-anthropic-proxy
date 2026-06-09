# Poe Proxy Upstream Response Shape

status: completed

## Context

`buildAnthropicResponse()` assumed non-streaming Poe responses always included
`choices[0].message`. If the upstream response was malformed, the mapper failed
with a generic property-access error instead of a deterministic compatibility
error.

## Goals

- Detect missing `choices[0].message` before response mapping continues.
- Raise `Poe response missing choices[0].message` for malformed non-streaming
  upstream responses.
- Cover the malformed response shape with deterministic Node tests.
- Document the local mapping guard in README, SECURITY, VISION, and CHANGES.

## Verification

- `npm test`
- `npm run verify`
- `make check`
- `git diff --check`
