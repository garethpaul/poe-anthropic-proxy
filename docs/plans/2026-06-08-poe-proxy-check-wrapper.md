---
title: Poe Proxy Check Wrapper
type: chore
status: completed
date: 2026-06-08
---

# Poe Proxy Check Wrapper

## Summary

Add a repository-standard `make check` entry point that runs the existing
Node verification gate for the Poe-Anthropic proxy.

## Requirements

- R1. `make check` must run `npm run verify`, including deterministic Node
  tests and the moderate npm audit.
- R2. The Makefile must expose focused `test`, `audit`, `verify`, and `check`
  targets.
- R3. Node tests, README, and CHANGES must document and preserve the wrapper.

## Verification

- `make check`
- `npm run verify`
- `git diff --check`
