# Credential-free hosted proxy validation

status: completed

## Context

The prepared workflow validated Node 24 but used floating actions and allowed
checkout to persist its repository credential. Upstream added a pinned Node 20
and Node 24 matrix, but fragment-based checks could still accept additional or
shadowed workflow settings.

## Decision

1. Preserve the pinned, read-only Node 20 and Node 24 validation matrix.
2. Set `persist-credentials: false` for checkout.
3. Keep Poe credentials blank and set `POE_BASE_URL` to
   `https://invalid.example` so accidental network access cannot reach Poe.
4. Enforce the exact workflow text from the portable shell baseline.
5. Require contributor guidance for inbound authentication, server-side Poe
   credentials, localhost binding, and private environment files.

## Verification

- `make check`
- Node 20 and Node 24 package gates
- focused hostile mutations for credentials, actions, events, permissions,
  runner and matrix drift, live upstream URLs, and plan status
- `git diff --check`

The hosted workflow remains a deterministic no-live-credentials gate and does
not perform deployment or credentialed smoke tests.
