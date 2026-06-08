---
title: Inbound Proxy Auth
type: fix
status: completed
date: 2026-06-08
---

# Inbound Proxy Auth

## Summary

Require callers to authenticate to the local proxy before the service forwards
requests with the configured Poe API key, and bind the server to localhost by
default.

## Requirements

- R1. `/v1/messages` must reject missing inbound proxy credentials with 401.
- R2. `/v1/messages` must reject invalid inbound proxy credentials with 403.
- R3. Rejected requests must not call the upstream Poe fetch implementation.
- R4. Startup must require `POE_PROXY_API_KEY` alongside `POE_API_KEY`.
- R5. Local server binding must default to `127.0.0.1` and remain configurable
  through `HOST`.
- R6. README, CHANGES, and the bug note must document the new auth boundary.
- R7. `.env.example` must document `POE_PROXY_API_KEY` and the localhost
  default so sample setup matches startup requirements.

## Verification

- `npm test`
- `npm run audit`
- `npm run verify`
- `git diff --check`
