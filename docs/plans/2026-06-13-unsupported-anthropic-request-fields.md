# Unsupported Anthropic Request Fields

status: planned

## Context

The proxy documents its endpoint and several translation behaviors, but callers
cannot currently tell which Anthropic Messages request fields are mapped,
partially normalized, or silently ignored by `buildPoePayload`. This can create
false compatibility assumptions even when deterministic tests remain green.

## Priorities

1. Derive a precise request-field contract from the current implementation.
2. Distinguish mapped fields, partially normalized content blocks, and ignored
   fields without claiming full Anthropic compatibility.
3. Enforce the documentation and completed evidence without changing runtime
   behavior.

## Requirements

- R1. Document mapped top-level fields: `model`, `system`, `messages`,
  `max_tokens`, `temperature`, `stream`, and `tools`.
- R2. Document model default/mapping, system normalization, text content,
  `tool_use`, `tool_result`, schema URI-format removal, and malformed-tool
  omission.
- R3. Document currently ignored top-level fields: `metadata`,
  `stop_sequences`, `top_p`, `top_k`, `service_tier`, `thinking`, and
  `tool_choice`.
- R4. Document ignored non-text image, document, and `cache_control` semantics.
- R5. State that ignored fields are not rejected and callers must not assume
  Anthropic behavior for them.
- R6. Link the contract from README, security, vision, and changelog guidance.
- R7. Enforce the field lists, implementation alignment, unchanged runtime
  surfaces, and completed evidence through the baseline checker.

## Verification Plan

- Node 20 and Node 24 focused baseline checks
- `make lint`, `make test`, `make build`, `make audit`, `make verify`, and
  `make check` on both runtimes
- `npm ci --ignore-scripts` and `npm audit --audit-level=moderate`
- run the checker from an external working directory
- parse package/lock/workflow JSON or YAML and README SVG
- run focused hostile mutations against mapped, ignored, content-block,
  no-semantics, implementation-alignment, status, and evidence contracts
- verify `poe-proxy.js`, tests, dependencies, lockfile, workflow, and environment
  examples have no diff
- `git diff --check`
- scan intended paths for secrets, captured prompts, generated artifacts, and
  dependency drift

## Scope Boundaries

- Do not change request translation, request rejection, model defaults, tool
  handling, response mapping, streaming, timeouts, rate limiting, logging, or
  authentication.
- Do not change dependencies, lockfile, workflow, environment defaults, or live
  Poe configuration.
- Do not claim live Poe or full Anthropic protocol compatibility was tested.
