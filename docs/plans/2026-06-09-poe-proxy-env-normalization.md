# Poe Proxy Environment Normalization

status: completed

## Context

`loadConfig()` read environment values directly. Whitespace-padded values could
be passed through to the upstream key, proxy key, or bind host, while
whitespace-only credentials still counted as configured.

## Goals

- Trim string environment values before using them in proxy configuration.
- Treat blank `POE_API_KEY` and `POE_PROXY_API_KEY` values as unset.
- Keep default values for blank optional settings such as `HOST`,
  `POE_BASE_URL`, `POE_MODEL`, and `PORT`.
- Cover the behavior with deterministic Node tests.

## Verification

- `npm test`
- `npm run verify`
- `make check`
- `git diff --check`
