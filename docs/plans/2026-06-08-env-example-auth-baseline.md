---
title: Env Example Auth Baseline
type: test
status: completed
date: 2026-06-08
---

# Env Example Auth Baseline

## Summary

Keep `.env.example` aligned with the proxy's required inbound and upstream
credentials.

## Work Completed

- Added `POE_PROXY_API_KEY` to `.env.example`.
- Documented the default `HOST=127.0.0.1` binding in `.env.example`.
- Added a Node test that verifies required sample environment keys are present
  and still use placeholders.

## Verification

- `npm test`
- `npm run verify`
- `git diff --check`
