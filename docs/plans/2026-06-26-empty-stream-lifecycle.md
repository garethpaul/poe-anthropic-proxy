# Empty Stream Lifecycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Emit a complete Anthropic streaming lifecycle when Poe successfully terminates a stream before sending content.

**Architecture:** Keep the existing idempotent `sendSuccessMessage()` handshake and invoke it before serializing `[DONE]`. This preserves all non-empty stream behavior while ensuring empty streams still contain `message_start`, `ping`, `message_delta`, and `message_stop` in protocol order.

**Tech Stack:** Node.js 20+, Fastify injection tests, server-sent events.

---

status: completed

### Task 1: Add the failing route regression

**Files:**
- Modify: `test/poe-proxy.test.js`

1. Inject an upstream stream containing only `data: [DONE]`.
2. Assert the exact Anthropic event-name sequence.
3. Assert the terminal stop reason remains `end_turn`.
4. Run the focused test and confirm `message_start` and `ping` are missing.

### Task 2: Complete the terminal handshake

**Files:**
- Modify: `poe-proxy.js`

1. Call the idempotent success handshake before the `[DONE]` terminal branch emits events.
2. Preserve existing content, reasoning, tool, usage, error, and timeout behavior.
3. Run the focused route test and full test suite.

### Task 3: Record and verify behavior

**Files:**
- Modify: `README.md`
- Modify: `SECURITY.md`
- Modify: `VISION.md`
- Modify: `CHANGES.md`
- Modify: `scripts/check-baseline.sh`
- Modify: `docs/plans/2026-06-26-empty-stream-lifecycle.md`

1. Document complete empty-stream lifecycle serialization.
2. Add durable source, test, documentation, and plan contracts.
3. Run `make check`, external-directory `make check`, Node 20 verification, syntax checks, and `git diff --check`.
4. Mutation-test removal of the terminal handshake call.

## Verification

- The focused route test failed first because the empty stream emitted only `message_delta` and `message_stop`.
- `node --test --test-name-pattern='empty successful stream' test/poe-proxy.test.js`
- All 37 Node tests passed.
- Supported Node 20 passed `npm run verify`, including the mixed-stream mutation, syntax/build checks, and a zero-finding moderate dependency audit.
- Removing the `[DONE]` branch handshake call made the focused lifecycle assertion fail for the intended missing events.
- Repository and external-directory `make check`, shell syntax, and `git diff --check` complete the local gate.
- Hosted Node 20 and Node 24 verification and exact-head review remain required before merge.
