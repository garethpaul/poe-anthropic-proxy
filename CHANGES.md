# Changes

## 2026-06-08

- Required inbound proxy authorization with `POE_PROXY_API_KEY` before
  forwarding requests with the server-side Poe API key.
- Bound the local server to `127.0.0.1` by default unless `HOST` is explicitly
  configured.
- Added deterministic route tests for missing and invalid proxy credentials.
- Updated `.env.example` and tests so required proxy-auth placeholders stay in
  sync with startup requirements.
