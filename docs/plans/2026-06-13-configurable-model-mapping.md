# Configurable Model Mapping

status: pending

## Context

The proxy exposes `POE_MODEL` for the default request model, but its seven
Anthropic-to-Poe name mappings are hard-coded inside `mapModelName`. Operators
cannot adapt a known Anthropic model name to an available Poe bot without a
source change, and the built-in mapping table is not documented as a stable
default contract.

## Requirements

- Keep the existing seven built-in mappings as visible, tested defaults.
- Accept optional `POE_MODEL_MAPPINGS_JSON` as a JSON object whose keys and
  values are trimmed nonempty strings.
- Merge valid custom entries over the built-in mappings while preserving
  pass-through behavior for unknown model names.
- Reject malformed JSON, arrays, non-string entries, blank keys or values, and
  oversized mapping configuration before server startup.
- Prove through a deterministic route test that a configured override reaches
  the injected Poe upstream request.
- Document the environment variable, default mappings, validation boundary,
  and credential-safe operational guidance.

## Scope Boundaries

- Do not change the default Poe model, request authentication, rate limiting,
  timeout handling, tool conversion, response shaping, or streaming behavior.
- Do not add dependencies or make live Poe requests.
- Do not print custom mapping contents during startup or error handling.

## Verification Plan

- Run focused configuration, mapping, payload, and route tests on Node 20 and
  Node 24.
- Run `npm test`, every Make alias, and the moderate-level dependency audit on
  both declared runtimes.
- Run shell syntax, exact-diff, secret, captured-prompt, generated-artifact,
  dependency-drift, and documentation checks.
- Run focused hostile mutations against defaults, parsing limits, invalid
  shapes, merge precedence, route propagation, docs, and completed evidence.

## Work Completed

Pending implementation.

## Verification Completed

Pending implementation and validation.
