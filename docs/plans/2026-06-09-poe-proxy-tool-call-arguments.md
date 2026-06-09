# Poe Proxy Tool Call Argument Guard Plan

status: completed

## Context

Non-streaming Poe responses can include tool calls whose `function.arguments`
field must be JSON before it can be mapped into Anthropic `tool_use` input.
Malformed argument strings previously surfaced as generic `JSON.parse` syntax
errors.

## Objectives

- Wrap Poe tool-call argument parsing in an explicit local mapping error.
- Add a deterministic unit test for malformed Poe tool call arguments.
- Extend docs and tests so the error message remains stable.

## Verification

- `npm test`
- `make check`
- `npm run verify`
- `git diff --check`

Expected local error:

`Poe tool call arguments must be valid JSON`
