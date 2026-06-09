# Tool Name And Schema Validation

status: completed
date: 2026-06-09

## Context

The proxy already ignored malformed tool entries that were not objects. It
could still forward object-shaped tools with missing names, invalid function
names, or missing input schemas, which pushed malformed request metadata to the
upstream Poe API.

## Changes

- Added a local Poe tool-definition validator before request payload mapping.
- Required forwarded tools to have a valid function name and object
  `input_schema`.
- Extended the malformed Poe tool definition tests and docs so invalid names or
  schemas remain local omissions rather than upstream request failures.

## Verification

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run audit`
- `make check`
