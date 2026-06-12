# Poe Anthropic Proxy CI Baseline

status: completed

## Context

The proxy already has deterministic Node tests, syntax checks, npm audit, and a
scripted repository baseline through `make check`. The missing guard was hosted
CI that repeats the same no-live-credentials gate.

## Changes

- Added `.github/workflows/check.yml` for GitHub Actions.
- Installed dependencies with `npm ci` on Node 24.
- Ran `make check` in the hosted workflow.
- Extended the baseline script and docs so hosted CI remains visible.

## Verification

- `make check`
- `git diff --check`
