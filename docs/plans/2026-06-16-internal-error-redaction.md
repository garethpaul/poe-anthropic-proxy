---
title: Internal Proxy Error Redaction
status: completed
date: 2026-06-16
---

# Internal Proxy Error Redaction

## Priority

P1 security and diagnostic privacy. Unexpected fetch, mapping, or stream
exceptions are currently returned to authenticated callers through
`err.message`, which can disclose private endpoint, provider, or credential
adjacent detail.

## Problem

The `/v1/messages` handler has explicit stable responses for authentication,
missing upstream credentials, upstream HTTP failures, and timeouts. Its final
generic exception path logs the exception and returns the raw message in a 500
response. A failed injected fetch can therefore reflect arbitrary internal
diagnostics to the client.

## Approach

- Keep detailed unexpected exceptions on the server-side diagnostic path.
- Return one stable generic 500 payload for unexpected non-timeout failures.
- Preserve the existing timeout response, deliberately forwarded upstream HTTP
  error bodies, and successful streaming/non-streaming behavior.
- Add runtime coverage that injects a secret-bearing failure message and proves
  it is absent from the response.
- Extend the dependency-free checker, security guidance, maintenance history,
  and completed verification evidence.

## Files

- `poe-proxy.js`
- `test/poe-proxy.test.js`
- `scripts/check-baseline.sh`
- `README.md`
- `SECURITY.md`
- `VISION.md`
- `CHANGES.md`
- `docs/plans/2026-06-16-internal-error-redaction.md`

## Verification

- Reproduce the current raw exception-message reflection before implementation.
- Cover an authenticated request whose injected fetch rejects with private
  diagnostic text.
- Confirm the response is status 500 with only the stable generic error and
  that no upstream exception detail is returned.
- Run the focused test, full Node 20 suite, syntax/build gates, dependency
  audit, repository `make check`, and external-directory absolute-Makefile gate.
- Reject isolated response, test, checker, guidance, changelog, and completed
  plan mutations.
- Audit the exact diff, generated dependencies and artifacts, secrets, conflict
  markers, binaries, large files, and whitespace.

## Scope Boundaries

- Do not alter authentication, rate limiting, body parsing, model mapping,
  request translation, timeout status, or SSE framing.
- Do not change the existing contract that forwards non-success Poe HTTP
  response bodies with the upstream status code.
- Do not contact Poe or use live credentials.
- Keep PR #7 and its predecessors open and retain base-first stack ordering.

## Success Criteria

- Unexpected internal exception messages cannot appear in generic 500 response
  bodies.
- Server-side diagnostics remain available to operators.
- Existing explicit error and success contracts remain unchanged.

## Verification Completed

- The pre-fix probe reproduced an authenticated 500 response containing a
  private endpoint and embedded credential detail.
- Focused pre-stream and started-stream redaction regressions passed, and all
  32 tests passed on the complete suite.
- Node 20 and Node 24 passed lint, tests, syntax build, dependency audit,
  baseline contracts, and `make check`.
- `npm audit --audit-level=moderate` reported zero vulnerabilities.
- The complete gate passed through the absolute Makefile path from /tmp.
- Eight isolated hostile mutations were rejected across raw exception
  reflection, stable response drift, started-stream termination, response and
  operator diagnostic coverage, guidance, changelog evidence, and completed
  plan status.
- `git diff --check`, exact diff, generated dependency and artifact, secret,
  conflict-marker, binary, and large-file audits passed.
