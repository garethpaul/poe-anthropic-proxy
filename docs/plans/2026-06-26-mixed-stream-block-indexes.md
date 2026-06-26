# Mixed Stream Content Block Indexes

status: completed

## Goal

Emit valid Anthropic SSE when an upstream Poe stream interleaves assistant text
and tool calls.

## Problem

Poe/OpenAI tool-call indexes are scoped to the `tool_calls` array, while
Anthropic content-block indexes are scoped to the complete ordered content
stream. Reusing an upstream tool index after a text block has started can emit
two different content blocks at index `0`, and the current completion path then
leaves the text block unclosed.

The Anthropic streaming contract documents each content block as a complete
`content_block_start`, delta series, and `content_block_stop` sequence before
the next block: https://platform.claude.com/docs/en/build-with-claude/streaming

## Implementation

1. Add a route regression that streams text before a tool call and asserts
   unique, ordered block indexes and matching stop events.
2. Allocate Anthropic content-block indexes in final emission order.
3. Buffer tool metadata and argument fragments by upstream tool-call index so
   each Anthropic tool block can emit a complete start/delta/stop series.
4. Close the text block before emitting sequential tool blocks, then send
   `message_delta` and `message_stop`.
5. Run the focused test, full repository verification, and a hostile mutation
   that restores upstream tool indexes.

## Verification

- The focused Node 20 regression fails on the original implementation because
  both text and tool blocks start at index `0`.
- The focused text, tool-fragment, and mixed-stream tests pass after allocating
  content-block indexes in emission order and preventing overlapping blocks.
- Node 20.19.5 passes all 36 Node tests, the 77-case Make root suite, the mixed
  stream hostile mutation, syntax checks, and a zero-finding moderate audit.
- Node 24.12.0 passes the same 36 tests, mutation, syntax checks, and audit.
- `git diff --check` passes.
- Hosted exact-head verification remains pending.
