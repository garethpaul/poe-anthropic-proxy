# poe-anthropic-proxy

<!-- README-OVERVIEW-IMAGE -->
![Project overview](docs/readme-overview.svg)

## Overview

`garethpaul/poe-anthropic-proxy` is a Node.js or JavaScript project. Proxy requests from Poe Chat Completions API to Anthropic Format

This README is based on the checked-in source, manifests, scripts, and repository metadata on the `main` branch. The project language mix found during review was: JavaScript (2).

## Repository Contents

- `README.md` - project overview and local usage notes
- `package.json` - JavaScript dependency and script metadata
- `docs` - source or example code
- `package-lock.json` - JavaScript dependency and script metadata
- `SECURITY.md` - security reporting and disclosure guidance
- `test` - source or example code
- `VISION.md` - project direction and maintenance guardrails

Additional scan context:

- Source directories: docs, test
- Dependency and build manifests: package-lock.json, package.json
- Entry points or build surfaces: package.json
- Test-looking files: docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md, test/poe-proxy.test.js

## Getting Started

### Prerequisites

- Git
- Node.js and npm

### Setup

```bash
git clone https://github.com/garethpaul/poe-anthropic-proxy.git
cd poe-anthropic-proxy
npm install
```

The setup commands above are derived from repository files. Legacy mobile, Python, or JavaScript samples may require older SDKs or package versions than a modern workstation uses by default.

## Running or Using the Project

- Run `npm start` for the default development command.
- Run `npm run dev` for the development server when that script is appropriate.

Detected npm scripts:

- `npm run audit` - `npm audit --audit-level=moderate`
- `npm run dev` - `node --watch poe-proxy.js`
- `npm run start` - `node poe-proxy.js`
- `npm run test` - `node --test`
- `npm run verify` - `npm test && npm run audit`

## Testing and Verification

- `npm test`

When the required SDK or runtime is unavailable, use static checks and source review first, then verify on a machine that has the matching platform toolchain.

## Configuration and Secrets

- Detected references to OpenAI. Keep API keys, OAuth credentials, tokens, and account-specific values in local configuration only.
- `POE_API_KEY` is required for upstream Poe access.
- `PROXY_AUTH_TOKEN` is required for callers of this proxy. Send it as `Authorization: Bearer <token>` on every `/v1/messages` request.
- `ALLOW_UNAUTHENTICATED_PROXY=true` is only for local experiments; public deployments should leave it unset or `false`.

Example local configuration:

```bash
export POE_API_KEY="your_poe_api_key_here"
export PROXY_AUTH_TOKEN="$(openssl rand -hex 32)"
```

Example authenticated request:

```bash
curl http://localhost:3000/v1/messages \
  -H "content-type: application/json" \
  -H "authorization: Bearer $PROXY_AUTH_TOKEN" \
  -d '{"messages":[{"role":"user","content":"hello"}],"max_tokens":32}'
```

## Security and Privacy Notes

- Review changes touching authentication or token handling; examples from the scan include docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md, poe-proxy.js, test/poe-proxy.test.js.
- Review changes touching external API calls or credential-adjacent configuration; examples from the scan include docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md, poe-proxy.js, test/poe-proxy.test.js.
- Review changes touching network requests, sockets, or service endpoints; examples from the scan include poe-proxy.js, test/poe-proxy.test.js.
- Review changes touching file, media, JSON, XML, CSV, OCR, or data parsing; examples from the scan include docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md, poe-proxy.js, test/poe-proxy.test.js.
- Review changes touching database, model, or persistence code; examples from the scan include docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md, poe-proxy.js, test/poe-proxy.test.js.

## Maintenance Notes

- See `SECURITY.md` for vulnerability reporting and safe research guidance.
- See `VISION.md` for project direction and contribution guardrails.

## Contributing

Keep changes small and tied to the project that is already present in this repository. For code changes, document the toolchain used, avoid committing generated dependency directories or local configuration, and update this README when setup or verification steps change.

## Existing Project Notes

Prior README summary:

> Poe-Anthropic Bridge <!-- README-OVERVIEW-IMAGE --> A proxy server that bridges between Anthropic's Messages API format and Poe's OpenAI-compatible API. Setup Install dependencies: Use Node.js 20 or newer. Copy the sample environment file and configure your Poe API key: Required setting:
