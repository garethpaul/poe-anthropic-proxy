# Safe Make Root

status: completed

## Context

The existing Make wrapper ignored a simple `REPO_ROOT` assignment, but GNU
Make split absolute Makefile paths containing spaces, accepted replacement of
its automatic `MAKEFILE_LIST`, interpolated the root into shell source, and
allowed callers to replace executable or shell authority. External validation
could therefore run commands from another directory or execute checkout-name
content while appearing to use the repository gate.

## Requirements

- Derive one canonical absolute root from the checked-in Makefile location.
- Fail closed when command-line or environment input replaces `MAKEFILE_LIST`.
- Ignore caller-controlled `REPO_ROOT`, `NPM`, `NODE`, `SHELL`, and
  `.SHELLFLAGS` values for every public target.
- Reject `MAKEFILES` preloads and ambiguous multiple-`-f` invocations before a
  repository quality command runs.
- Preserve all proxy tests, audits, workflow policy, credentials, and runtime
  behavior.
- Support external absolute Makefile paths containing spaces, apostrophes,
  quotes, brackets, and backticks without evaluating path content.

## Scope Boundaries

- Do not change proxy request, authentication, rate-limit, model, timeout,
  streaming, response, dependency, lockfile, environment, or network behavior.
- Do not contact Poe or Anthropic services.
- Do not weaken the existing baseline checker or Node test suite.

## Work Completed

The Makefile now rejects replacement or preloading of file-list authority,
derives a canonical root through a fixed POSIX shell, and exports that root as
data instead of interpolating it into recipe source. A dependency-free Node
regression suite executes every public target from an unrelated hostile path,
checks executable and shell overrides, and exercises ambiguous file loading.

## Verification Completed

- Root and external `make check` passed through an absolute Makefile path in a
  checkout whose name contains spaces and an apostrophe.
- The regression suite passed 77 executed target/authority cases.
- It also passed 2 `MAKEFILE_LIST` rejections, 1 MAKEFILES rejection, and
  1 multi-Makefile rejection.
- Command-line and environment root, executable, and shell attempts retained
  the canonical checkout root and fixed quality commands.
- All 35 dependency-free proxy tests and the zero-vulnerability moderate audit
  passed on Node 20 and Node 24 without live service calls.
- Shell and JavaScript syntax, `git diff --check`, and strict Git object
  validation passed.
