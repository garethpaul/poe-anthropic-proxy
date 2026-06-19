# Security Policy

## Supported Versions

The supported security scope for `poe-anthropic-proxy` is the current default branch, `main`. Older commits, tags, branches, forks, demos, and generated artifacts are not actively supported unless the repository explicitly marks them as maintained.

Project summary: Proxy requests from Poe Chat Completions API to Anthropic Format

## Reporting a Vulnerability

Please report suspected vulnerabilities through GitHub's private vulnerability reporting or by opening a draft GitHub Security Advisory for `garethpaul/poe-anthropic-proxy` when that option is available. If GitHub does not show a private reporting option for this repository, contact the repository owner through GitHub and avoid posting exploit details publicly until the issue can be assessed.

Do not open a public issue that includes exploit code, secrets, personal data, or detailed reproduction steps for an unpatched vulnerability.

## What to Include

Helpful reports include:

- the affected file, endpoint, permission, dependency, or workflow
- a concise impact statement explaining what an attacker could do
- reproduction steps using test data and accounts you control
- the branch, commit SHA, platform version, device, runtime, or dependency versions used
- logs, screenshots, or proof-of-concept snippets that demonstrate impact without exposing private data

## Project Security Posture

- This repository appears to be a Node.js or JavaScript project. The active security scope is the code and documentation on the default branch.
- Review found authentication, token, or session-related code paths; changes in those areas should receive security-focused review before merge.
- Review found external API integrations or credential-adjacent configuration; changes in those areas should receive security-focused review before merge.
- Review found network clients, sockets, web APIs, or service endpoints; changes in those areas should receive security-focused review before merge.
- Review found file, document, data, or media parsing flows; changes in those areas should receive security-focused review before merge.
- Review found database, model, query, or persistence-related code; changes in those areas should receive security-focused review before merge.
- Dependency manifests detected: package.json, package-lock.json. Dependency updates should preserve lockfiles when present and avoid introducing packages without a clear maintenance reason.

## Service and API Notes

For web services, APIs, sockets, or scraping workflows, prioritize reports involving authentication bypass, authorization errors, injection, server-side request forgery, unsafe deserialization, credential leakage, data exposure, or denial-of-service conditions. Use test accounts and minimal proof-of-concept traffic only.

The `/v1/messages` route must have both `POE_PROXY_API_KEY` and `POE_API_KEY`
configured before it forwards a request. Missing upstream Poe credentials should
return a local `503` response instead of sending a request with an invalid bearer
token.
Blank or whitespace-only credential environment values are treated as missing
configuration.
Run `npm run lint`, `npm run build`, `make lint`, and `make build` before
changing route handling, payload translation, or credential checks.
Malformed upstream Poe responses should fail with explicit local mapping errors
instead of generic property-access failures.
Upstream Poe error payloads should preserve the upstream status and use a local
status fallback when Poe sends an empty error body.
Malformed Poe tool call arguments should fail with explicit local mapping
errors instead of generic JSON parse failures.
Malformed Poe tool definitions should be ignored before forwarding instead of
leaking generic request-shape failures.
Invalid tool names or schemas should be treated as malformed Poe tool
definitions and omitted locally before upstream forwarding.
GitHub Actions runs the same no-live-credentials `make check` gate as local
development. Do not add live Poe calls, deployment, or credentialed smoke tests
to that workflow without a separate security review.
Every Poe request should use a bounded upstream request timeout so stalled
connections cannot retain proxy resources indefinitely.
Rate limiting must run before proxy authorization and upstream work so abusive
clients cannot consume unbounded request or Poe capacity.
Timeout responses and logs should use stable text rather than raw runtime error
details.
Unexpected internal proxy failures must not return raw exception details to
callers; detailed diagnostics belong only on the server-side operator path.
Poe stream chunk boundaries must be buffered before JSON parsing so ordinary
network segmentation cannot silently remove translated response content.

## Dependency and Supply Chain Security

Pinned, read-only hosted Linux validation installs the lockfile exactly, runs
the test suite and moderate-level audit, and does not receive proxy or upstream
API credentials.
Checkout credentials are not persisted, and `POE_BASE_URL` points to an invalid
domain so an accidental live request cannot reach Poe during hosted validation.

Dependency updates should come from trusted package managers and should keep lockfiles in sync when lockfiles exist. Do not commit credentials, private keys, tokens, generated secrets, or machine-local configuration. If a vulnerability depends on a compromised package, typosquatting risk, insecure transitive dependency, or unsafe build step, include the package name, affected version, and the path through which it is used.

Treat `POE_MODEL_MAPPINGS_JSON` model mapping overrides as deployment
configuration, not a secret. Keep
it within the documented size and entry limits, use only reviewed model and bot
names, and do not log its contents. Invalid shapes stop configuration loading
before the server starts.

## Safe Research Guidelines

The ignored Anthropic request fields documented in
[`docs/anthropic-request-field-support.md`](docs/anthropic-request-field-support.md)
do not gain Anthropic semantics merely because the proxy accepts the request.
Security-sensitive behavior such as metadata handling, stop conditions,
thinking controls, tool selection, media blocks, and cache controls requires an
explicit implementation and deterministic tests before it is relied upon.

Good-faith research is welcome when it stays within these boundaries:

- use only accounts, devices, data, and infrastructure that you own or have explicit permission to test
- avoid destructive actions, persistence, spam, phishing, social engineering, or denial-of-service testing
- minimize access to personal data and stop testing immediately if private data is exposed
- do not exfiltrate secrets or third-party data; report the minimum evidence needed to verify impact
- keep vulnerability details confidential until the maintainer has assessed the report

## Maintainer Response

The maintainer will review complete reports as availability allows, prioritize issues by exploitability and impact, and coordinate a fix or mitigation when the affected code is still maintained. For sample, archived, or educational repositories, the likely remediation may be documentation, dependency updates, or clearly marking unsupported code rather than a production-style patch release.
