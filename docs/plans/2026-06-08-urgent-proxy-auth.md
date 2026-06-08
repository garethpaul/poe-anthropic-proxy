---
title: Urgent Proxy Authentication
type: fix
status: active
date: 2026-06-08
origin: public repository security audit
execution: code
---

# Urgent Proxy Authentication

## Summary

Require caller authentication before the Poe-Anthropic proxy forwards requests with the server-side Poe API key.

## Problem Frame

The proxy listens on `0.0.0.0` and forwards `/v1/messages` requests to Poe using `POE_API_KEY`. Without caller authentication, any reachable deployment becomes an open relay for that upstream credential.

## Requirements

- R1. `/v1/messages` must reject requests without a valid bearer token before calling Poe.
- R2. The inbound proxy token must be separate from `POE_API_KEY`.
- R3. Startup must fail closed unless `PROXY_AUTH_TOKEN` is set.
- R4. Local unauthenticated operation must require explicit `ALLOW_UNAUTHENTICATED_PROXY=true`.
- R5. README and `.env.example` must document the caller token.
- R6. Tests must cover authorized and unauthorized route behavior.
- R7. The GitHub issue and PR must be marked `URGENT`.

## Implementation Unit

### U1. Bearer Token Gate

- **Goal:** Add a route-level authorization guard backed by `PROXY_AUTH_TOKEN`, reject unauthorized requests with `401`, and keep the Poe fetch unreachable on denied requests.
- **Files:** `poe-proxy.js`, `test/poe-proxy.test.js`, `.env.example`, `README.md`
- **Verification:** `npm test`, `npm run audit`, `git diff --check`.

## Risks

- Existing local clients need to send `Authorization: Bearer <PROXY_AUTH_TOKEN>`. This is intentional because the proxy carries an upstream API credential.
