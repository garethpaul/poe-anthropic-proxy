---
title: Location-Independent Make Gates
type: fix
date: 2026-06-14
---

# Location-Independent Make Gates

status: planned

## Summary

Make every repository verification target run against the repository that owns
the Makefile, regardless of the caller's current directory, and make the
portable baseline checker reject regressions in that contract.

## Problem Frame

The Makefile currently invokes npm and the baseline checker relative to the
caller's working directory. An absolute Makefile invocation from another
directory therefore cannot serve as a reliable fleet-level gate even though
the checker itself already resolves repository files from its own location.

## Requirements

- R1. Derive one absolute repository root from the loaded Makefile without
  accepting a caller-provided override.
- R2. Run lint, test, build, audit, verify, and the baseline checker from that
  root while preserving the existing target graph and output behavior.
- R3. Extend the baseline checker with exact contracts for root derivation and
  every rooted recipe so partial or cosmetic fixes fail closed.
- R4. Preserve proxy runtime behavior, tests, dependencies, lockfile, workflow,
  credentials, environment variables, and public documentation outside the
  narrow verification contract.

## Assumptions

- GNU Make's loaded-Makefile path is available in the supported Linux hosted
  lanes and is the established fleet pattern for caller-independent gates.
- The portable shell checker should continue deriving its own root so direct
  checker execution remains independent of the caller.

## Implementation Units

### U1. Root every Make gate

**Files:** `Makefile`

Derive an override-protected absolute repository root and execute each npm
script plus the checker after changing to that directory. Keep the current
aliases and dependency ordering intact.

**Test scenarios:**

- Invoke each gate from the repository root and observe the existing scripts.
- Invoke the full gate through the absolute Makefile path from an unrelated
  directory and observe the same successful checks.
- Supply a conflicting root variable and confirm the Makefile still selects
  its own repository.

### U2. Enforce and document the contract

**Files:** `scripts/check-baseline.sh`,
`docs/plans/2026-06-14-location-independent-make.md`

Require the exact root declaration and rooted recipes, then record completed
verification only after the final implementation has passed. The checker must
reject mutations to root derivation, each npm target, and the checker recipe.

**Test scenarios:**

- Remove or weaken each root-sensitive Make fragment independently and confirm
  the checker rejects every mutation.
- Run the final gate on Node 20 and Node 24 from both caller locations.
- Confirm shell syntax, whitespace, intended paths, generated artifacts,
  credential patterns, dependency state, runtime sources, tests, and workflows
  remain clean or unchanged as applicable.

## Scope Boundaries

- No proxy request, authentication, rate-limit, model-mapping, timeout,
  streaming, or response behavior changes.
- No dependency, lockfile, workflow, environment-variable, or deployment
  changes.
- No new build abstraction beyond the existing Make and portable shell
  contracts.

## Verification

Completion requires all Make aliases from the repository root, full checks
through the absolute Makefile path from an external directory, Node 20 and 24
coverage, isolated hostile mutations for every new static contract, and clean
diff, artifact, credential, dependency, and protected-path audits.
