## Poe Anthropic Proxy Vision

Poe Anthropic Proxy is a Node.js Fastify service that translates Anthropic
Messages API-style requests into Poe OpenAI-compatible chat requests and maps
responses back into Anthropic-style messages.

The repository is useful as a focused compatibility bridge with deterministic
tests for model mapping, message normalization, tool conversion, stop reasons,
and response shaping.

The goal is to keep the adapter predictable, testable, and explicit about what
it translates and what it does not.

The current focus is:

Priority:

- Keep the authenticated proxy and dependency audit baseline running on pinned
  hosted Linux with Node 20 and Node 24

- Preserve the `/v1/messages` compatibility surface
- Keep Poe API credentials in environment configuration behind inbound proxy auth
- Reject requests locally when the server-side Poe key is missing
- Normalize environment configuration so blank credentials are not accepted
- Keep `npm run lint`, `npm run build`, `make lint`, and `make build` available
  as stable local gate aliases
- Keep a scriptable baseline guard for package scripts and local metadata
- Maintain deterministic tests that do not require live Poe calls
- Keep tool-call and streaming behavior covered by fixtures
- Keep Poe stream chunk boundaries and split UTF-8 decoding covered by
  deterministic fixtures
- Keep malformed upstream response shapes covered by deterministic tests
- Keep upstream error payloads covered by deterministic route tests
- Keep the upstream request timeout configurable and covered by route tests
- Keep unexpected internal proxy diagnostics out of client responses
- Keep per-client request limiting ahead of authentication and upstream work
- Keep malformed tool arguments covered by deterministic tests
- Keep malformed tool definitions covered by deterministic tests
- Keep Poe tool names and schemas validated before upstream forwarding
- Keep mapped, partially normalized, and ignored Anthropic request fields
  explicit and aligned with the translation implementation
- Keep built-in model mappings visible while allowing bounded validated
  deployment overrides
- Keep GitHub Actions aligned with the no-live-credentials `make check` gate
- Keep hosted checkout credential-free and isolate tests from the live Poe URL

Next priorities:

- Keep environment normalization covered as deployment options evolve
- Add live-verification notes that never print API keys

Contribution rules:

- One PR = one focused mapping, endpoint, test, or documentation change.
- Add unit tests for every compatibility promise.
- Do not log prompts, API keys, or tool payloads by default.
- Keep `POE_PROXY_API_KEY` required when forwarding with a server-side Poe key.
- Keep live-network behavior separate from deterministic local tests.

## Security And Responsible Use

Canonical security policy and reporting:

- [`SECURITY.md`](SECURITY.md)

The proxy handles user prompts, tool calls, and API credentials. It should keep
logging minimal by default, avoid credential exposure, and make any forwarding
path visible in configuration and tests.

## What We Will Not Merge (For Now)

- Credential logging or checked-in keys
- Silent request forwarding to unexpected hosts
- Compatibility claims without tests
- Broad protocol rewrites without fixture coverage

This list is a roadmap guardrail, not a permanent rule.
Strong user demand and strong technical rationale can change it.
