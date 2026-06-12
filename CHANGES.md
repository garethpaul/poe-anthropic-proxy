# Changes

## 2026-06-10

- Added a GitHub Actions workflow that installs dependencies on Node 24 and
  runs the local `make check` gate without live Poe credentials.
- Added deterministic route coverage for upstream Poe error payloads and empty
  upstream error-body fallbacks.

## 2026-06-09

- Added stable `npm run lint`, `npm run build`, `make lint`, and `make build`
  aliases around the dependency-free syntax gate.
- Added `scripts/check-baseline.sh` to protect package script wiring,
  completed plan metadata, credential docs, and local metadata ignores from
  `make check`.

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
- Added an explicit guard for malformed non-streaming Poe responses that are
  missing `choices[0].message`.
- Added an explicit guard for malformed Poe tool call arguments.
- Ignored malformed Poe tool definitions before upstream payload forwarding.
- Omitted tool definitions with invalid Poe tool names or schemas before
  upstream forwarding.
