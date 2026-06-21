# Safe Make Root

status: completed

## Context

The existing Make wrapper ignored a simple `REPO_ROOT` assignment, but GNU
Make split absolute Makefile paths containing spaces, accepted replacement of
its automatic `MAKEFILE_LIST`, and allowed callers to replace the executable
`NPM` command. External validation could therefore run against another
directory or command while appearing to use the repository gate.

## Requirements

- Derive one canonical absolute root from the checked-in Makefile location.
- Fail closed when command-line or environment input replaces `MAKEFILE_LIST`.
- Ignore caller-controlled `REPO_ROOT` and `NPM` values for every public target.
- Preserve all proxy tests, audits, workflow policy, credentials, and runtime
  behavior.
- Support external absolute Makefile paths containing spaces and apostrophes.

## Scope Boundaries

- Do not change proxy request, authentication, rate-limit, model, timeout,
  streaming, response, dependency, lockfile, environment, or network behavior.
- Do not contact Poe or Anthropic services.
- Do not weaken the existing baseline checker or Node test suite.

## Work Completed

The Makefile now rejects replacement of its automatic file list, derives a
canonical root through quoted POSIX shell operations, and protects the npm
executable assignment. A dependency-free Node regression suite dry-runs every
public target from an unrelated directory under normal and hostile root and
command overrides, then exercises both Makefile-list injection channels.

## Verification Completed

- Root and external `make check` passed through an absolute Makefile path in a
  checkout whose name contains spaces and an apostrophe.
- The regression suite passed 35 target/override cases.
- It also passed 2 MAKEFILE_LIST rejection cases.
- Command-line and environment `REPO_ROOT` and `NPM` attempts retained the
  canonical checkout root and npm command.
- All 35 dependency-free proxy tests and the zero-vulnerability moderate audit
  passed on Node 20 and Node 24 without live service calls.
- Shell and JavaScript syntax, `git diff --check`, and strict Git object
  validation passed.
