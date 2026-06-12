# AGENTS.md

## Repository purpose

`garethpaul/poe-anthropic-proxy` is a Node.js or JavaScript project. Proxy requests from Poe Chat Completions API to Anthropic Format

## Project structure

- `Makefile` - repository verification targets
- `scripts` - baseline checks and helper scripts
- `docs` - plans, notes, and generated README assets
- `test` - tests and fixtures
- `package.json` - Node package metadata and scripts

## Development commands

- Install dependencies: `npm ci`
- Full baseline: `make check`
- Combined verification: `make verify`
- Lint/static checks: `make lint`
- Tests: `make test`
- Build: `make build`
- package script `dev`: `npm run dev`
- package script `start`: `npm start`
- package script `build`: `npm run build`
- package script `lint`: `npm run lint`
- package script `test`: `npm test`
- package script `verify`: `npm run verify`
- package script `audit`: `npm run audit`
- If a command above skips because a platform toolchain is missing, verify on a machine with that SDK before claiming platform behavior is tested.

## Coding conventions

- Language mix noted in the README: JavaScript (2).
- Use Node >=20.0.0 for package scripts.
- Package module type is `module`.

## Testing guidance

- Test-related files detected: `docs/plans/2026-06-08-poe-anthropic-proxy-security-test-baseline.md`, `test/`, `test/poe-proxy.test.js`
- Start with the narrowest relevant test or Make target, then run `make check` before handing off if the change is not documentation-only.
- Keep README verification notes in sync when commands, fixtures, or supported toolchains change.

## PR / change guidance

- Keep diffs focused on the requested repository and avoid unrelated modernization or formatting churn.
- Preserve public APIs, sample behavior, file formats, and documented environment variables unless the task explicitly changes them.
- Update tests, README notes, or docs/plans when behavior, security posture, or validation commands change.
- Call out skipped platform validation, legacy toolchain assumptions, and any risky files touched in the final summary.

## Safety and gotchas

- Detected references to OpenAI. Keep API keys, OAuth credentials, tokens, and account-specific values in local configuration only.
- `POE_API_KEY` is the upstream Poe credential and must stay server-side.
- `POE_PROXY_API_KEY` is the inbound caller token required by `/v1/messages`.
- Programmatic `createServer()` usage must pass both values; the route returns `503` rather than forwarding with a missing upstream Poe key.
- `.env.example` documents placeholders for both credentials; replace them with private deployment values and do not commit real `.env` files.
- `HOST` defaults to `127.0.0.1`; avoid `0.0.0.0` unless the proxy is behind another authenticated boundary.

## Agent workflow

1. Inspect the README, Makefile, manifests, and the files directly related to the request.
2. Make the smallest source or docs change that satisfies the task; avoid generated, vendored, or local-environment files unless required.
3. Run the narrowest useful validation first, then `make check` or the documented package/platform gate when available.
4. If a required SDK, service credential, or external runtime is unavailable, record the skipped command and why.
5. Summarize changed files, commands run, and remaining risks or follow-up validation.
