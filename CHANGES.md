# Changes

## 2026-06-08

- Added a root `make check` wrapper for the proxy verification gate.
- Required inbound proxy authorization with `POE_PROXY_API_KEY` before
  forwarding requests with the server-side Poe API key.
- Bound the local server to `127.0.0.1` by default unless `HOST` is explicitly
  configured.
- Added deterministic route tests for missing and invalid proxy credentials.
- Updated `.env.example` and tests so required proxy-auth placeholders stay in
  sync with startup requirements.
- Added a route-time upstream Poe API key guard so programmatic server usage
  fails locally before forwarding with an invalid bearer token.
- Normalized environment configuration so padded values are trimmed and blank
  credentials are treated as unset.
