# Poe Proxy Tool Definition Shape Plan

status: completed

## Context

`buildPoeTools` assumed `payload.tools` was an array of tool objects. Malformed
request tool metadata such as a non-array value or null entries could throw
while converting the Anthropic-style request into a Poe chat payload.

## Objectives

- Treat non-array `payload.tools` values as no tools.
- Ignore non-object tool entries before mapping Poe function definitions.
- Preserve valid tool conversion and the existing `BatchTool` skip behavior.
- Add deterministic tests and docs for malformed Poe tool definitions.

## Verification

- `npm test`
- `make check`
- `git diff --check`
