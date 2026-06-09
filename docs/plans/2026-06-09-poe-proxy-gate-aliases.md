# Poe Proxy Gate Aliases Plan

status: completed

## Context

The proxy had `npm test`, `npm run verify`, and a root `make check`, but it did
not expose explicit lint or build aliases for the repository gate contract.

## Objectives

- Add `npm run lint` as a dependency-free syntax gate.
- Add `npm run build` as a build-through-syntax-check alias.
- Add `make lint` and `make build` wrappers around the npm aliases.
- Make `npm run verify` execute lint, test, build, and audit in order.
- Document the aliases in the README, security notes, and vision.

## Verification

- `make lint`
- `make test`
- `make build`
- `make check`
- `git diff --check`
