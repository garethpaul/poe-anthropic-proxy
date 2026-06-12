# Poe Anthropic Proxy CI Baseline

status: completed

## Context

The proxy already has deterministic Node tests, syntax checks, npm audit, and a
scripted repository baseline through `make check`. The missing guard was hosted
CI that repeats the same no-live-credentials gate.

## Changes

- Added `.github/workflows/check.yml` for GitHub Actions.
- Installed dependencies with `npm ci` on Node 20 and Node 24.
- Ran `make check` in the hosted workflow.
- Pinned third-party actions, disabled persisted checkout credentials, and used
  blank credentials plus an invalid upstream URL.
- Extended the baseline script and docs so the exact hosted contract remains
  visible and reviewable.

## Verification

- `make check`
- hostile workflow mutations
- `git diff --check`
