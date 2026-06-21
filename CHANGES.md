# Changes

## 2026-06-21

- Made every Make quality gate derive and export a canonical root from the
  checked-in Makefile, reject file-list ambiguity, and ignore caller-controlled
  root, executable, and shell authority.
- Added dependency-free regression coverage for all seven public Make targets
  from external checkout paths containing spaces, quotes, brackets,
  apostrophes, and backticks.

## 2026-06-18

- Restricted configurable model lookups to explicit mapping entries so model
  names matching inherited object properties remain valid upstream model names.
- Preserved each OpenAI-compatible streamed tool argument delta instead of
  treating later fragments as cumulative replacements.

## 2026-06-17

- Added internal proxy log redaction so unexpected failures emit a stable
  operator marker instead of raw exception details.

## 2026-06-16

- Added internal proxy error redaction so unexpected fetch, mapping, and stream
  failures return a stable generic 500 response instead of raw diagnostics.

## 2026-06-13

- Added bounded `POE_MODEL_MAPPINGS_JSON` overrides while preserving and
  documenting the seven built-in Anthropic-to-Poe model mappings.

- Documented mapped, partially normalized, and ignored Anthropic request fields
  without changing proxy translation behavior.

## 2026-06-12

- Added configurable per-client request limiting ahead of authentication and
  upstream Poe work, with deterministic HTTP 429 coverage.
- Buffered partial Poe SSE records across stream chunk boundaries before JSON
  parsing, including split UTF-8 characters and final unterminated lines.
- Added direct decoder and injected-route regressions proving streamed content
  survives arbitrary upstream byte segmentation.

## 2026-06-10

- Added pinned, read-only hosted Linux validation on Node 20 and Node 24 using
- Disabled persisted checkout credentials and forced hosted validation to use
  an invalid upstream URL with blank Poe credentials.
- Added deterministic route coverage for upstream Poe error payloads and empty
  upstream error-body fallbacks.
- Added a configurable 30-second Poe upstream request timeout with stable `504`
  handling.

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
