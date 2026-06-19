# Internal Proxy Error Log Redaction

status: completed

## Problem

Unexpected proxy exceptions now produce stable client responses, but the raw
exception is still passed to `console.error`. Error messages can contain
private upstream endpoints, embedded credentials, response fragments, or other
request-adjacent diagnostics, so client redaction alone does not prevent secret
exposure through collected logs.

## Prioritized Requirements

- P0. Never log raw unexpected proxy exception objects or messages.
- P0. Emit one stable operator marker for unexpected internal failures before
  and after streaming headers are sent.
- P1. Preserve the current generic 500 response, started-stream termination,
  timeout status/log, upstream HTTP error forwarding, authentication, rate
  limiting, request translation, and SSE framing.
- P1. Add mutation-sensitive tests, static contracts, synchronized guidance,
  and completed verification evidence.

## Implementation Units

### U1. Stable internal failure log

**File:** `poe-proxy.js`

Define one stable internal log message and use it instead of passing the raw
exception to `console.error` in the generic catch path.

### U2. Log-redaction regressions

**File:** `test/poe-proxy.test.js`

Update both existing internal-error cases to require the stable marker and
prove that private exception details are absent from every logged argument.

### U3. Contracts and guidance

**Files:** `scripts/check-baseline.sh`, `README.md`, `SECURITY.md`, `VISION.md`,
`CHANGES.md`, `docs/plans/2026-06-17-internal-error-log-redaction.md`

Protect the stable source marker, absence of raw exception logging, both
regressions, guidance, and completed plan evidence against isolated mutations.

## Validation

- Run focused internal-error tests, the complete Node suite, lint/build/audit,
  every Make alias, and the absolute Makefile gate from an external directory.
- Reject isolated mutations of the stable marker, raw-error prohibition,
  pre-stream regression, streaming regression, guidance, and plan status.
- Audit the exact stacked diff, generated dependencies and artifacts, secrets,
  conflict markers, modes, binaries, large files, and whitespace.

## Scope Boundaries

- Do not alter client response bodies, status codes, timeout handling, upstream
  HTTP error payload forwarding, or SSE framing.
- Do not add structured logging dependencies or include exception names,
  messages, stacks, causes, URLs, headers, or request payloads.
- Do not contact Poe or use live credentials.
- Do not merge or close PR #8 or any predecessor.

## Risks

- Operators lose raw exception detail in application logs; the stable marker
  still distinguishes unexpected failures from the separately logged timeout
  path without risking credential disclosure.
- Broader structured observability would require a separate reviewed design.
- This change is stacked on PR #8, which must remain open and merge first.

## Work Completed

- Added one stable unexpected-failure log marker and replaced raw exception
  logging in the generic pre-stream and started-stream catch path.
- Updated both existing internal-error regressions to require the exact marker
  and prove private exception details are absent from every logged argument.
- Extended structural contracts and synchronized repository, security, vision,
  and changelog guidance.

## Verification Completed

- `node --test --test-name-pattern="internal errors" test/poe-proxy.test.js`
  passed both focused error paths.
- The complete 32-test suite, `npm run verify`, and every Make alias passed on
  Node 20.19.5 and Node 24.16.0.
- Fresh `npm ci --ignore-scripts` installs and
  `npm audit --audit-level=moderate` completed with zero vulnerabilities.
- The absolute Makefile gate passed from an external working directory.
- Six isolated hostile mutations were rejected: stable marker, raw exception
  logging, pre-stream regression, streaming regression, guidance, and completed
  plan status.
- `git diff --check` plus generated dependency/artifact, secret,
  conflict-marker, binary, size, and mode audits passed.
- No live Poe request or real credential was used.
