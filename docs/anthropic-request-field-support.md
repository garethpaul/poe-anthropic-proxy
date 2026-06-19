# Anthropic Request Field Support

Review date: 2026-06-13

The `/v1/messages` route is a focused compatibility adapter, not a complete
implementation of every Anthropic Messages request option. This contract is
derived from the current `buildPoeMessages`, `buildPoeTools`, and
`buildPoePayload` implementation.

## Mapped Top-Level Fields

- `model`: mapped to the configured Poe model name; missing values use the
  configured default model.
- `system`: string values become one system message; arrays contribute
  normalized text/content blocks.
- `messages`: normalized into Poe/OpenAI-compatible message objects.
- `max_tokens`: forwarded as `max_tokens` without additional policy.
- `temperature`: forwarded when present and defaults to `1` when absent.
- `stream`: enabled only when the value is exactly `true`.
- `tools`: valid definitions become function tools.

## Partially Normalized Content

- string content and blocks with string `text` or `content` values become text
- `tool_use` blocks become assistant `tool_calls`
- `tool_result` blocks become separate `tool` messages
- tool input schemas have nested JSON Schema `format: uri` annotations removed
  for Poe compatibility
- malformed tool definitions, invalid names/schemas, and `BatchTool` are omitted

Non-text image and document blocks are not translated. `cache_control` metadata
on system, message, or tool content is not preserved.

## Currently Ignored Top-Level Fields

The adapter does not forward or emulate these request fields:

- `metadata`
- `stop_sequences`
- `top_p`
- `top_k`
- `service_tier`
- `thinking`
- `tool_choice`

Ignored fields are not rejected. Callers must not assume Anthropic behavior for
them merely because the request receives a successful proxy response.

## Change Rule

Any new compatibility claim must update this document and add deterministic
translation or route tests. Runtime behavior remains authoritative when this
document and implementation disagree.
