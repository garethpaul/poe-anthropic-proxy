# [P1] Require caller authentication before proxying with a server API key

## Severity

P1 - security/authentication

## Evidence

- `poe-proxy.js:22`: `apiKey: env.POE_API_KEY,`
- `poe-proxy.js:281`: `fastify.post("/v1/messages", async (request, reply) => {`
- `poe-proxy.js:288`: `Authorization: `Bearer ${apiKey}`,`
- `poe-proxy.js:517`: `await fastify.listen({ port: config.port, host: "0.0.0.0" });`

## Problem

The service exposes an HTTP route that accepts caller-supplied request bodies, forwards them to an upstream API with the server's configured API key, and listens on `0.0.0.0` without checking any inbound authorization header or API key. If the service is reachable from a network, any caller can spend the configured upstream credential and send arbitrary model requests through the account.

## Suggested fix

Require an inbound proxy token or session before building the upstream request, reject missing or invalid credentials with 401 or 403, bind only to localhost by default for local-only use, and add route tests that prove unauthenticated `/v1/messages` requests do not reach the upstream fetch implementation.

## Review metadata

- Repository: `garethpaul/poe-anthropic-proxy`
- Reviewed commit: `4bd9547366365048cbb6a1b2f42b65d330925f4f`
- Labels: `bug`, `codex-review`, `severity:P1`
- Codex review fingerprint: `a79b25ca60c148d3`
