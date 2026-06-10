# Poe Proxy Upstream Error Payloads Plan

status: completed

## Context

The proxy already returns upstream non-OK Poe responses before success-response
mapping, but that path did not have deterministic route coverage. Empty upstream
error bodies also produced an unhelpful blank local error value.

## Objectives

- Keep upstream Poe error payloads on the route response with the upstream
  status code.
- Avoid calling success JSON mapping for non-OK upstream responses.
- Add a local `Poe upstream request failed` fallback when the upstream error
  body is empty.
- Document the error-payload behavior in the README, security notes, and
  vision.

## Verification

- `npm test`
- `make check`
- `git diff --check`
