---
title: Poe Anthropic Proxy Security and Test Baseline
type: chore
status: completed
date: 2026-06-08
---

# Poe Anthropic Proxy Security and Test Baseline

## Summary

Raise the engineering bar for the Poe-Anthropic proxy by removing the current npm audit failures, adding deterministic tests for the API translation logic, and replacing the network-dependent `npm test` command with a repeatable local quality gate.

## Problem Frame

The repository currently has a single executable module that starts the Fastify server at import time and a `test` script that only sends a curl request to a manually running server. `npm audit` reports 9 vulnerabilities, including 7 high-severity findings, with the production Fastify dependency requiring a major-version update to clear the direct and transitive advisories. The upgrade is safest if the request/response mapping behavior is first extracted into pure functions and covered by Node's built-in test runner.

## Requirements

- R1. `npm audit` must report zero known vulnerabilities after dependency updates.
- R2. The Fastify upgrade must preserve the public `/v1/messages` route shape for non-streaming and streaming Anthropic Messages-compatible requests.
- R3. Request translation must preserve system-message handling, text content normalization, tool-use conversion, tool-result conversion, default model mapping, max token propagation, temperature defaults, and stream flags.
- R4. Response translation must preserve stop-reason mapping, message ID conversion, text response content, tool-use response content, and token usage mapping for non-streaming Poe responses.
- R5. Server startup must remain available from `npm start`, but importing translation helpers in tests must not start the HTTP server or require `POE_API_KEY`.
- R6. `npm test` must be a deterministic local test command that does not require a running proxy, a Poe API key, or network access.
- R7. Documentation must describe install, test, audit, environment configuration, and manual proxy verification commands.

## Key Technical Decisions

- **Extract pure translation helpers:** Move Anthropic request normalization, tool schema cleanup, model mapping, stop-reason mapping, and non-streaming response shaping into a module that can be imported without side effects.
- **Create a server factory:** Keep the current CLI behavior while making Fastify construction injectable for tests and future route-level coverage.
- **Use Node's built-in test runner:** Fastify 5's dependency tree requires a modern Node runtime, and the current host runs Node 20.19.5, so `node --test` gives coverage without adding another test framework.
- **Modernize Fastify to the audited current major:** npm currently reports Fastify 5.8.5 as latest, and `npm audit` recommends that version to clear the direct production advisories.
- **Keep streaming tests scoped:** This pass preserves streaming code paths but focuses automated assertions on pure translation behavior and server import/startup safety; full upstream SSE integration can be added after the server factory is in place.

## Scope Boundaries

- This pass does not change the Poe upstream endpoint path.
- This pass does not add authentication in front of the local proxy.
- This pass does not implement full Anthropic API compatibility beyond the behavior already present in `poe-proxy.js`.
- This pass does not make live calls to Poe during automated tests.

## Implementation Units

### U1. Dependency Security Upgrade

- **Goal:** Clear the current npm audit failures while keeping the runtime dependency surface small.
- **Files:** `package.json`, `package-lock.json`
- **Patterns:** Use npm's package-lock v3; keep direct dependencies limited to `fastify` and `dotenv` unless implementation proves another runtime dependency is needed.
- **Test Scenarios:**
  - `npm audit --audit-level=moderate` exits zero.
  - `npm install` resolves Fastify 5.8.5 or newer within the current major.
  - `package-lock.json` records patched `fast-uri`, `fast-json-stringify`, `ajv`, `brace-expansion`, `minimatch`, and `picomatch` versions where present.
  - `package.json` declares Node 20 or newer to match the upgraded Fastify dependency tree.
- **Verification:** `npm audit --audit-level=moderate`

### U2. Import-Safe Translation Helpers

- **Goal:** Make the core request and response mapping deterministic and testable without booting the proxy.
- **Files:** `poe-proxy.js`, `test/poe-proxy.test.js`
- **Patterns:** Export named helpers from `poe-proxy.js`; guard CLI startup behind an entrypoint check using `import.meta.url`.
- **Test Scenarios:**
  - Anthropic system messages and text-array content become Poe chat messages in order.
  - Anthropic `tool_use` content becomes OpenAI-compatible `tool_calls`.
  - Anthropic `tool_result` content becomes OpenAI-compatible tool-role messages.
  - `format: "uri"` is removed recursively from tool input schemas without mutating the original payload object.
  - Default model mapping converts known Anthropic model names and leaves unknown model names unchanged.
  - Default temperature is `1` when omitted, while explicit `0` is preserved.
  - Importing `poe-proxy.js` in tests does not require `POE_API_KEY` and does not call `fastify.listen`.
- **Verification:** `npm test`

### U3. Non-Streaming Response Mapping Coverage

- **Goal:** Cover the Poe-to-Anthropic response adapter so Fastify and dependency changes are bounded by behavior tests.
- **Files:** `poe-proxy.js`, `test/poe-proxy.test.js`
- **Patterns:** Isolate response shaping in a pure helper that accepts the Poe response data and translated request context.
- **Test Scenarios:**
  - Poe text responses map to Anthropic message objects with converted IDs and `end_turn` stop reasons.
  - Poe `tool_calls` map to Anthropic `tool_use` content with parsed JSON input.
  - `length` finish reasons map to `max_tokens`; `tool_calls` maps to `tool_use`.
  - Missing usage data falls back to lightweight word-count estimates.
- **Verification:** `npm test`

### U4. Repeatable Quality Gates and Documentation

- **Goal:** Replace the current manual curl-only test script with repeatable local gates and clear setup instructions.
- **Files:** `package.json`, `README.md`, `.env.example`
- **Patterns:** Keep README concise and command-oriented; document live proxy checks separately from automated tests.
- **Test Scenarios:**
  - `npm test` runs `node --test`.
  - README includes `npm install`, `npm test`, `npm run audit`, `npm run verify`, `npm start`, and the required `POE_API_KEY`.
  - `.env.example` uses a valid newline between `DEBUG=false` and any following content.
  - Manual curl instructions remain available for live verification after startup.
- **Verification:** `npm test`, `npm audit --audit-level=moderate`, manual README review

## Risks & Dependencies

- Fastify 5 is a major upgrade; the route is simple, but local verification must include server construction and route registration.
- Streaming behavior is harder to fully cover without an SSE harness. This plan preserves the implementation and extracts adjacent pure helpers first, leaving broader stream contract tests as a follow-up if route-level testing uncovers instability.
- Live Poe API verification still depends on a real `POE_API_KEY`; automated tests intentionally avoid that external dependency.

## Sources / Research

- `poe-proxy.js` contains the current Fastify server, Anthropic request mapping, Poe request, non-streaming response mapping, and SSE streaming adapter.
- `package.json` currently defines `npm test` as a curl command against `localhost:3000`.
- `npm audit --json` on 2026-06-08 reported 9 vulnerabilities: 7 high and 2 moderate.
- `npm view fastify version` on 2026-06-08 reported `5.8.5`.
- `npm view dotenv version` on 2026-06-08 reported `17.4.2`.
- `npm view nodemon version` on 2026-06-08 reported `3.1.14`.
