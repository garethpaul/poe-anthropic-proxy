# Gate Exit-Status Channel

status: completed

## Context

`scripts/check-baseline.sh` pinned the Makefile with unanchored `grep -Fq`
substring checks. Two single-line mutations therefore disarmed the whole gate
while every pin kept passing byte-identically:

1. **Appended status swallowing.** `cd "$$REPO_ROOT" && $(NPM) run verify` is a
   substring of `cd "$$REPO_ROOT" && $(NPM) run verify || true`. The command
   still ran and still printed its failures, but the exit status was discarded.
   A planted upstream-token bypass (`if (!safeTokenEqual(token, proxyApiKey))`
   rewritten to `if (false)`) made `node --test` print
   `not ok 36 - createServer rejects unauthenticated requests before upstream
   fetch`, and `make check` still exited 0.
2. **Dropped prerequisite.** `check:` is a substring of `check: verify`, so the
   target-existence loop accepted rewriting `check: verify` to `check:`. That
   made `make check` run zero tests -- no TAP output at all -- and exit 0 with
   the same auth bypass planted.

`scripts/test-makefile-root.js` already spawned Make with fake `npm`/`node`
loggers, but only ever asserted `status === 0`. A dispatch log proves a runner
RAN; it can never prove the runner GATES. CI ran only `make check`, so every
verdict travelled through a single exit status that either mutation discarded.

The `package.json` script pins were already correct: they end in a closing
quote, which anchors the value and rejects an appended `|| true`. This change
brings the Makefile pins up to that existing standard.

## Requirements

- Anchor every Makefile recipe and rule line to a whole-line match so appended,
  prefixed, or removed text fails closed.
- Observe failure PROPAGATION, not just dispatch: prove a failing individual
  command makes each dependent target exit nonzero.
- Observe the runners from OUTSIDE Make, so a disarmed wrapper cannot hide a red
  suite from CI.
- Preserve all proxy request, auth, rate-limit, model, timeout, streaming,
  response, credential, and network behavior.

## Scope Boundaries

- No runtime behavior change; `poe-proxy.js` is untouched.
- No new dependencies.

## Changes

- `scripts/check-baseline.sh`: added `grep -Fqx` whole-line pins for all seven
  recipe lines and for the `verify: root-test` / `check: verify` rule lines;
  pinned the new failure-injection block in `test-makefile-root.js`; extended the
  exact pinned workflow copy with the direct CI observer steps.
- `scripts/test-makefile-root.js`: added 10 per-command failure-injection
  propagation cases (failing `npm` across 6 targets, failing `node` across 3,
  failing `check-baseline.sh` across 1). Each asserts a NONZERO Make exit and
  reasserts the failing command ran from the checkout, so a nonzero status is not
  misattributed to a broken Makefile parse.
- `.github/workflows/check.yml`: added `npm run verify` and
  `scripts/check-baseline.sh` as direct out-of-band observer steps alongside
  `make check`.

## Verification

Clean baseline before any probe: `make check` exit 0, 37 tests passed,
`Mixed-stream index mutation rejected.`, root test reporting 77 executed
target/authority cases.

Mutation evidence, each applied by hand and confirmed to be syntactically valid,
importable, and actually executing (`node --check` clean; failures were assertion
failures, not build errors):

| Mutation | Before fix | After fix | Catching line |
| --- | --- | --- | --- |
| auth bypass only (control) | exit 2 caught | exit 2 caught | `not ok 36` test |
| auth bypass + `\|\| true` on `verify` recipe | **exit 0 SHIPS GREEN** | exit 2 caught | failure injection: `failing npm did not fail the check gate` |
| auth bypass + `check: verify` -> `check:` | **exit 0, zero tests ran** | exit 2 caught | `Makefile rule line must match exactly, preserving its prerequisites` |
| `\|\| true` on `check` recipe | not caught | exit 2 caught | failure injection: `failing check-baseline.sh` |
| delete `verify` recipe line (DS-3) | exit 2 caught | exit 2 caught | pre-existing substring pin |
| `\|\| true` inside `package.json` verify script | exit 2 caught | exit 2 caught | pre-existing quote-anchored pin |
| delete failure-injection block | n/a | exit 2 caught | `Makefile root test must preserve: const FAILURE_INJECTIONS = [` |
| remove direct CI observer steps | n/a | exit 2 caught | exact pinned workflow comparison |

Attribution was traced for each row rather than accepting "make check failed" as
evidence. For the dropped-prerequisite mutation the failure injection cannot be
the catcher, because `make check` no longer runs `root-test` at all; the
anchored rule-line pin in `check-baseline.sh` carries that load, and
`check-baseline.sh` still runs from the `check` recipe.

Residual bootstrap limit, measured and reported rather than papered over: with
the `check`, `verify`, and `root-test` recipes ALL neutered and the prerequisite
dropped simultaneously, `make check` exits 0. The direct CI steps are what catch
that case -- `npm run verify` exits 1 on `not ok 36`, and
`scripts/check-baseline.sh` exits 1 reporting the recipe tampering. Going green
now requires a coordinated multi-file edit that also deletes pinned CI steps,
instead of one appended `|| true`.

Post-fix full gate: `make check` exit 0; direct `npm run verify` exit 0; direct
`scripts/check-baseline.sh` exit 0; root test reporting 77 executed
target/authority cases and 10 failure-injection propagation cases.
