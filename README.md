# poe-anthropic-proxy

<!-- README-OVERVIEW-IMAGE -->
![Project overview](docs/readme-overview.svg)

## Overview

`garethpaul/poe-anthropic-proxy` is a Node.js or JavaScript project. Proxy requests from Poe Chat Completions API to Anthropic Format

This README is based on the checked-in source, manifests, scripts, and repository metadata on the `main` branch. The project language mix found during review was: JavaScript (2).

## Repository Contents

- `README.md` - project overview and local usage notes
- `Makefile` - repository-level verification wrapper
- `package.json` - JavaScript dependency and script metadata
- `docs` - source or example code
- `package-lock.json` - JavaScript dependency and script metadata
- `SECURITY.md` - security reporting and disclosure guidance
- `test` - source or example code
- `VISION.md` - project direction and maintenance guardrails

Additional scan context:

- Source directories: docs, test
- Dependency and build manifests: package-lock.json, package.json
- Entry points or build surfaces: package.json, Makefile
- Test-looking files: docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md, test/poe-proxy.test.js

## Getting Started

### Prerequisites

- Git
- Node.js 20 or newer and npm

### Setup

```bash
git clone https://github.com/garethpaul/poe-anthropic-proxy.git
cd poe-anthropic-proxy
npm ci
export POE_API_KEY=...
export POE_PROXY_API_KEY=...
```

`.env.example` lists the required upstream Poe key, inbound proxy key, and
localhost binding defaults.

The setup commands above are derived from repository files. Legacy mobile, Python, or JavaScript samples may require older SDKs or package versions than a modern workstation uses by default.

## Running or Using the Project

- Run `npm start` for the default development command.
- Run `npm run dev` for the development server when that script is appropriate.
- The server binds to `127.0.0.1` by default. Set `HOST` explicitly only when
  you have a separate access-control boundary.
- Environment values are trimmed before use; blank credential values are treated
  as unset rather than as valid tokens.
- Call `/v1/messages` with `Authorization: Bearer $POE_PROXY_API_KEY`.
- Requests are rejected before upstream forwarding if either the inbound proxy
  token or upstream Poe key is missing.
- Malformed non-streaming upstream responses are rejected with an explicit local
  error before response mapping continues.
- Malformed Poe tool call arguments are rejected with an explicit local mapping
  error before Anthropic tool-use content is returned.
- Malformed Poe tool definitions are ignored before forwarding so bad request
  tool metadata does not crash payload conversion.

Detected npm scripts:

- `npm run audit` - `npm audit --audit-level=moderate`
- `npm run dev` - `node --watch poe-proxy.js`
- `npm run start` - `node poe-proxy.js`
- `npm run test` - `node --test`
- `npm run verify` - `npm test && npm run audit`

## Testing and Verification

Run the local verification gate before changing the proxy:

```bash
make check
npm run verify
```

`make check` delegates to `npm run verify`, which runs deterministic Node tests
and `npm audit --audit-level=moderate`. The tests do not require a live Poe API
key or network access.

When the required SDK or runtime is unavailable, use static checks and source review first, then verify on a machine that has the matching platform toolchain.

## Configuration and Secrets

- Detected references to OpenAI. Keep API keys, OAuth credentials, tokens, and account-specific values in local configuration only.
- `POE_API_KEY` is the upstream Poe credential and must stay server-side.
- `POE_PROXY_API_KEY` is the inbound caller token required by `/v1/messages`.
- Programmatic `createServer()` usage must pass both values; the route returns
  `503` rather than forwarding with a missing upstream Poe key.
- `.env.example` documents placeholders for both credentials; replace them with
  private deployment values and do not commit real `.env` files.
- `HOST` defaults to `127.0.0.1`; avoid `0.0.0.0` unless the proxy is behind
  another authenticated boundary.
- Whitespace-only `POE_API_KEY` or `POE_PROXY_API_KEY` values are treated as
  missing credentials.
- Malformed non-streaming upstream responses are treated as local mapping errors
  instead of leaking generic property-access failures.
- Malformed Poe tool call arguments are treated as local mapping errors instead
  of leaking generic JSON parse failures.
- Malformed Poe tool definitions are ignored before forwarding instead of
  leaking generic request-shape failures.

## Security and Privacy Notes

- Review changes touching authentication or token handling; examples from the scan include docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md, poe-proxy.js, test/poe-proxy.test.js.
- Review changes touching external API calls or credential-adjacent configuration; examples from the scan include docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md, poe-proxy.js, test/poe-proxy.test.js.
- Review changes touching network requests, sockets, or service endpoints; examples from the scan include poe-proxy.js, test/poe-proxy.test.js.
- Review changes touching file, media, JSON, XML, CSV, OCR, or data parsing; examples from the scan include docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md, poe-proxy.js, test/poe-proxy.test.js.
- Review changes touching database, model, or persistence code; examples from the scan include docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md, poe-proxy.js, test/poe-proxy.test.js.

## Maintenance Notes

- See `SECURITY.md` for vulnerability reporting and safe research guidance.
- See `VISION.md` for project direction and contribution guardrails.
- See `CHANGES.md` for maintenance history.
- See `docs/plans/2026-06-08-inbound-proxy-auth.md` for the inbound proxy
  authorization baseline.
- See `docs/plans/2026-06-09-poe-proxy-env-normalization.md` for environment
  normalization guardrails.

## Contributing

Keep changes small and tied to the project that is already present in this repository. For code changes, document the toolchain used, avoid committing generated dependency directories or local configuration, and update this README when setup or verification steps change.
