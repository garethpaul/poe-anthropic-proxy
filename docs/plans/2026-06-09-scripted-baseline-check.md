# Scripted Baseline Check

status: completed

## Context

The proxy has deterministic Node tests, npm verification aliases, and a root
`make check` wrapper, but it did not have a scriptable repository baseline guard
for package script wiring, credential documentation, completed plan metadata,
and local metadata hygiene.

## Objectives

- Keep `make check` as the root verification command.
- Add a script-level baseline guard for required repository files.
- Protect package scripts used by `npm run verify`.
- Keep local secrets and editor metadata out of the proxy repository while
  allowing the checked-in `.env.example` template.

## Work Completed

- Added `scripts/check-baseline.sh`.
- Wired the script into `make check` after the existing npm verify gate.
- Added `*.iml` to local editor metadata ignore coverage.
- Updated README, VISION, and CHANGES.

## Verification

- `scripts/check-baseline.sh`
- `npm test`
- `make check`
- `git diff --check`

## Follow-Up Candidates

- Add narrower baseline checks for new compatibility mappings as they gain
  deterministic tests.
- Add CI for `make check` if the proxy becomes actively maintained.
