# Configurable Model Mapping

status: completed

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

- Exported the seven frozen default mappings and added bounded parsing for an
  optional `POE_MODEL_MAPPINGS_JSON` object.
- Merged safe trimmed overrides over the defaults, preserved unknown-name
  pass-through behavior, and rejected malformed, oversized, excessive, blank,
  non-string, and prototype-sensitive entries before startup.
- Propagated the resolved mapping table through configuration, server creation,
  and payload translation without changing authentication or transport logic.
- Documented the defaults, limits, environment example, and credential-safe
  operational boundary, with static contracts for implementation and evidence.

## Verification Completed

- Node 20.19.5: all 30 focused tests passed, including custom override route
  propagation and invalid configuration boundaries.
- `npm audit --audit-level=moderate` reported zero vulnerabilities.
- Node 20.19.5 and Node 24.16.0: `make check` passed all 30 tests, syntax/build
  gates, the portable baseline checker, and the moderate-level audit.
- Eight focused hostile mutations covering a built-in default, byte and entry
  limits, merge assignment, route propagation, environment example,
  documentation, and plan status were rejected.
- JavaScript and portable shell syntax, `git diff --check`, exact-path,
  generated-artifact, secret, captured-prompt, and dependency-drift scans
  passed.
