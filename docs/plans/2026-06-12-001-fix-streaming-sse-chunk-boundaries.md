---
title: Streaming SSE Chunk Boundary Handling
type: fix
status: completed
date: 2026-06-12
---

# Streaming SSE Chunk Boundary Handling

## Summary

Buffer partial Poe server-sent event lines across response-body chunks so the
Anthropic streaming bridge does not discard valid JSON split by the network.

## Problem Frame

The streaming loop currently decodes and splits each `ReadableStream` chunk in
isolation. When a `data:` line spans chunks, both fragments fail JSON parsing
and the content delta is lost even though the upstream stream is valid.

## Prioritized Engineering Backlog

1. Preserve partial SSE lines across upstream chunks and add deterministic
   split-boundary regressions in this change.
2. Validate streaming `choices[0].delta` shapes before dereferencing them in a
   future focused response-integrity pass.
3. Link downstream client disconnects to upstream request cancellation in a
   separate lifecycle and resource-management change.

## Requirements

- R1. The stream parser must preserve an incomplete line until the next chunk.
- R2. UTF-8 decoding must preserve multibyte characters split across chunks.
- R3. Complete `data:` lines and `[DONE]` markers must retain their existing
  Anthropic SSE event mapping.
- R4. A final unterminated `data:` line must be processed when the upstream
  body closes.
- R5. Tests, baseline checks, README, SECURITY, VISION, and CHANGES must
  preserve chunk-boundary handling.

## Key Technical Decisions

- **Buffer decoded text by line:** Keep one pending text fragment between
  reads and process only newline-terminated records during the loop.
- **Use streaming UTF-8 decoding:** Pass `{ stream: true }` to `TextDecoder`
  and flush it at EOF so split code points are reconstructed correctly.
- **Unify line dispatch:** Route both loop records and the final buffered
  record through the same dispatch loop to avoid divergent parsing behavior.

## Implementation Units

### U1. Buffer upstream SSE records

- **Goal:** Replace per-chunk splitting with a pending-line buffer and decoder
  flush at EOF.
- **Files:** `poe-proxy.js`
- **Verification:** Focused streaming server-injection tests.

### U2. Add split-boundary regressions

- **Goal:** Cover JSON split across chunks, a split UTF-8 character, and a final
  unterminated record before `[DONE]` or body close.
- **Files:** `test/poe-proxy.test.js`, `scripts/check-baseline.sh`
- **Verification:** `npm test` and `make check`.

### U3. Document streaming integrity

- **Goal:** Explain that upstream network chunking cannot alter translated
  content.
- **Files:** `README.md`, `SECURITY.md`, `VISION.md`, `CHANGES.md`
- **Verification:** `make check` and `git diff --check`.

## Acceptance Examples

- AE1. Given one JSON `data:` line split between two chunks, when the proxy
  streams it, then the Anthropic text delta contains the full content. Covers
  R1 and R3.
- AE2. Given a multibyte character split between byte chunks, when the stream
  is decoded, then the emitted text contains the original character. Covers
  R2.
- AE3. Given a complete final `data:` line without a trailing newline, when the
  body closes, then the record is processed rather than discarded. Covers R4.

## Scope Boundaries

- Do not change non-streaming response mapping.
- Do not redesign tool-call accumulation or event names.
- Do not add client-disconnect cancellation in this change.

## Risks And Mitigations

- Processing the pending buffer twice could duplicate output. Remove each
  complete record from the buffer before dispatch and flush only the remainder.
- Decoder misuse could corrupt Unicode. Use streaming decode for chunks and a
  final zero-argument decode to flush internal bytes.

## Verification

- `npm test`
- `npm run lint`
- `npm run build`
- `npm audit --audit-level=moderate`
- `make check`
- `git diff --check`
