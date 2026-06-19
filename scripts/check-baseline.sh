#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
README="$ROOT_DIR/README.md"
MAKEFILE="$ROOT_DIR/Makefile"
PACKAGE_JSON="$ROOT_DIR/package.json"
GITIGNORE="$ROOT_DIR/.gitignore"
DOCS_PLANS="$ROOT_DIR/docs/plans"

require_file() {
  path=$1
  if [ ! -f "$ROOT_DIR/$path" ]; then
    printf '%s\n' "Required file is missing: $path" >&2
    exit 1
  fi
}

require_text() {
  path=$1
  text=$2
  if ! grep -Fq "$text" "$ROOT_DIR/$path"; then
    printf '%s\n' "$path must preserve the contract: $text" >&2
    exit 1
  fi
}

for path in \
  ".github/workflows/check.yml" \
  "AGENTS.md" \
  ".env.example" \
  ".gitignore" \
  "CHANGES.md" \
  "Makefile" \
  "README.md" \
  "SECURITY.md" \
  "VISION.md" \
  "docs/anthropic-request-field-support.md" \
  "package.json" \
  "package-lock.json" \
  "poe-proxy.js" \
  "test/poe-proxy.test.js" \
  "docs/plans/2026-06-08-poe-proxy-check-wrapper.md" \
  "docs/plans/2026-06-09-scripted-baseline-check.md" \
  "docs/plans/2026-06-10-ci-baseline.md" \
  "docs/plans/2026-06-10-hosted-proxy-validation.md" \
  "docs/plans/2026-06-10-poe-proxy-upstream-timeout.md" \
  "docs/plans/2026-06-12-credential-free-hosted-validation.md" \
  "docs/plans/2026-06-12-proxy-rate-limiting.md" \
  "docs/plans/2026-06-13-unsupported-anthropic-request-fields.md" \
  "docs/plans/2026-06-13-configurable-model-mapping.md" \
  "docs/plans/2026-06-14-location-independent-make.md" \
  "docs/plans/2026-06-16-internal-error-redaction.md" \
  "scripts/check-baseline.sh"; do
  require_file "$path"
done

for internal_error_contract in \
  'const INTERNAL_PROXY_ERROR = "Internal proxy error";' \
  'return { error: INTERNAL_PROXY_ERROR };'; do
  require_text "poe-proxy.js" "$internal_error_contract"
done

if grep -Fq 'return { error: err.message };' "$ROOT_DIR/poe-proxy.js"; then
  printf '%s\n' "generic proxy failures must not return raw exception messages" >&2
  exit 1
fi

for test_contract in \
  'createServer redacts unexpected internal errors from clients' \
  'createServer ends failed streams without exposing internal errors' \
  'private endpoint https://user:secret@example.test failed' \
  'private stream diagnostic secret' \
  'assert.deepEqual(response.json(), { error: "Internal proxy error" })' \
  'assert.equal(response.body.includes(privateDetail), false)' \
  'assert.equal(response.body.includes("Internal proxy error"), false)' \
  'assert.equal(loggedErrors[0][0].message, privateDetail)'; do
  require_text "test/poe-proxy.test.js" "$test_contract"
done

for document_contract in \
  'Unexpected internal proxy failures return a stable generic 500 response' \
  'Unexpected internal proxy failures must not return raw exception details' \
  'Keep unexpected internal proxy diagnostics out of client responses' \
  'internal proxy error redaction'; do
  case "$document_contract" in
    Unexpected\ internal\ proxy\ failures\ return*) document="README.md" ;;
    Unexpected\ internal\ proxy\ failures\ must*) document="SECURITY.md" ;;
    Keep\ unexpected*) document="VISION.md" ;;
    *) document="CHANGES.md" ;;
  esac
  require_text "$document" "$document_contract"
done

for evidence in \
  'status: completed' \
  '32 tests passed' \
  'npm audit --audit-level=moderate' \
  'absolute Makefile path from /tmp' \
  'hostile mutations were rejected' \
  'git diff --check'; do
  require_text "docs/plans/2026-06-16-internal-error-redaction.md" "$evidence"
done

for payload_contract in \
  'model: mapModelName(payload.model || defaultModel, modelMappings)' \
  'messages,' \
  'max_tokens: payload.max_tokens' \
  'temperature: payload.temperature !== undefined ? payload.temperature : 1' \
  'stream: payload.stream === true' \
  'if (tools.length > 0) poePayload.tools = tools'; do
  require_text "poe-proxy.js" "$payload_contract"
done

for mapping_contract in \
  'export const DEFAULT_MODEL_MAPPINGS = Object.freeze({' \
  'export function parseModelMappings(value)' \
  'const MAX_MODEL_MAPPINGS_BYTES = 16_384;' \
  'const MAX_MODEL_MAPPINGS_ENTRIES = 100;' \
  'modelMappings: parseModelMappings(env.POE_MODEL_MAPPINGS_JSON)' \
  'mappings[name] = target' \
  '"claude-sonnet-4-20250514": "Claude-Sonnet-4"' \
  '"claude-3-5-sonnet-20241022": "Claude-Sonnet-3.5"' \
  '"claude-3-5-sonnet-20240620": "Claude-Sonnet-3.5"' \
  '"claude-3-5-haiku-20241022": "Claude-Haiku-3.5"' \
  '"claude-3-opus-20240229": "Claude-Opus-3"' \
  '"claude-3-sonnet-20240229": "Claude-Sonnet-3"' \
  '"claude-3-haiku-20240307": "Claude-Haiku-3"' \
  'buildPoePayload(request.body, defaultModel, modelMappings)'; do
  require_text "poe-proxy.js" "$mapping_contract"
done

for field_contract in \
  'Mapped Top-Level Fields' \
  '`model`' \
  '`system`' \
  '`messages`' \
  '`max_tokens`' \
  '`temperature`' \
  '`stream`' \
  '`tools`' \
  '`metadata`' \
  '`stop_sequences`' \
  '`top_p`' \
  '`top_k`' \
  '`service_tier`' \
  '`thinking`' \
  '`tool_choice`' \
  'Non-text image and document blocks are not translated' \
  '`cache_control` metadata' \
  'Ignored fields are not rejected' \
  'must not assume Anthropic behavior'; do
  require_text "docs/anthropic-request-field-support.md" "$field_contract"
done

for document in "README.md" "SECURITY.md" "VISION.md" "CHANGES.md"; do
  require_text "$document" "ignored Anthropic request fields"
  require_text "$document" "model mapping"
done

for evidence in \
  'status: completed' \
  'Node 20' \
  'Node 24' \
  'make check' \
  'hostile mutations rejected' \
  'runtime and test paths had no diff' \
  'git diff --check' \
  'secret, captured-prompt, generated-artifact, and dependency-drift scan'; do
  require_text "docs/plans/2026-06-13-unsupported-anthropic-request-fields.md" "$evidence"
done

for evidence in \
  'status: completed' \
  'Node 20' \
  'Node 24' \
  'npm audit --audit-level=moderate' \
  'hostile mutations' \
  'git diff --check'; do
  require_text "docs/plans/2026-06-13-configurable-model-mapping.md" "$evidence"
done

for evidence in \
  'status: completed' \
  'Node 20.19.5' \
  'Node 24.16.0' \
  'absolute Makefile path from /tmp' \
  'REPO_ROOT=/tmp' \
  'seven isolated hostile mutations' \
  'git diff --check' \
  'credential-pattern'; do
  require_text "docs/plans/2026-06-14-location-independent-make.md" "$evidence"
done

require_text "package.json" '"@fastify/rate-limit": "11.0.0"'
for implementation_contract in \
  'import rateLimit from "@fastify/rate-limit"' \
  'fastify.register(rateLimit' \
  'global: false' \
  'config: {' \
  'rateLimit: {' \
  'max: requestRateLimitMax' \
  'timeWindow: requestRateLimitWindowMs' \
  'POE_RATE_LIMIT_MAX' \
  'POE_RATE_LIMIT_WINDOW_MS'; do
  require_text "poe-proxy.js" "$implementation_contract"
done

node --input-type=module - "$ROOT_DIR/poe-proxy.js" "$ROOT_DIR/test/poe-proxy.test.js" <<'EOF'
import { readFileSync } from "node:fs";

const source = readFileSync(process.argv[2], "utf8");
const tests = readFileSync(process.argv[3], "utf8");
const registrationIndex = source.indexOf("fastify.register(rateLimit");
const routePattern = /fastify\.post\(\s*["']\/v1\/messages["']\s*,\s*\{\s*config\s*:\s*\{\s*rateLimit\s*:\s*\{\s*max\s*:\s*requestRateLimitMax\s*,\s*timeWindow\s*:\s*requestRateLimitWindowMs\s*,?\s*\}\s*,?\s*\}\s*,?\s*\}\s*,\s*handleMessages\s*\)/;
const routeMatch = routePattern.exec(source);
const genericErrorPattern = /console\.error\(err\);\s*if \(reply\.raw\.headersSent\) \{\s*reply\.raw\.end\(\);\s*return;\s*\}\s*reply\.code\(500\);\s*return \{ error: INTERNAL_PROXY_ERROR \};/;

if (!routeMatch) {
  console.error(
    "poe-proxy.js must register /v1/messages with the CodeQL-recognized " +
      "fastify.post(path, options, handler) config.rateLimit contract."
  );
  process.exit(1);
}

if (registrationIndex === -1 || registrationIndex > routeMatch.index) {
  console.error("@fastify/rate-limit must be registered before /v1/messages is installed.");
  process.exit(1);
}

if (!genericErrorPattern.test(source)) {
  console.error(
    "generic proxy failures must terminate started streams before returning the stable 500 payload."
  );
  process.exit(1);
}

function testBody(name) {
  const start = tests.indexOf(`test("${name}"`);
  if (start === -1) return "";
  const next = tests.indexOf("\ntest(\"", start + 1);
  return tests.slice(start, next === -1 ? tests.length : next);
}

const responseRedactionTest = testBody(
  "createServer redacts unexpected internal errors from clients"
);
if (
  !responseRedactionTest.includes(
    'assert.deepEqual(response.json(), { error: "Internal proxy error" })'
  ) ||
  !responseRedactionTest.includes(
    "assert.equal(response.body.includes(privateDetail), false)"
  ) ||
  !responseRedactionTest.includes(
    "assert.equal(loggedErrors[0][0].message, privateDetail)"
  )
) {
  console.error("the pre-stream regression must prove response redaction and operator diagnostics.");
  process.exit(1);
}

const streamRedactionTest = testBody(
  "createServer ends failed streams without exposing internal errors"
);
if (
  !streamRedactionTest.includes("assert.equal(response.statusCode, 200)") ||
  !streamRedactionTest.includes(
    "assert.equal(response.body.includes(privateDetail), false)"
  ) ||
  !streamRedactionTest.includes(
    'assert.equal(response.body.includes("Internal proxy error"), false)'
  )
) {
  console.error("the started-stream regression must prove clean termination without error detail.");
  process.exit(1);
}
EOF

for environment_contract in \
  'POE_RATE_LIMIT_MAX=60' \
  'POE_RATE_LIMIT_WINDOW_MS=60000' \
  'POE_MODEL_MAPPINGS_JSON={}'; do
  require_text ".env.example" "$environment_contract"
done
for test_contract in \
  'createServer rate limits requests before additional upstream work' \
  'assert.equal(limited.statusCode, 429)' \
  'assert.equal(fetchCalls, 1)'; do
  require_text "test/poe-proxy.test.js" "$test_contract"
done
for test_contract in \
  'custom model mappings override visible defaults and reject invalid config' \
  'Private-Sonnet' \
  'exceeds 16384 bytes' \
  'exceeds 100 entries' \
  'model: "Private-Sonnet"'; do
  require_text "test/poe-proxy.test.js" "$test_contract"
done

expected_workflow=$(cat <<'EOF'
name: Check
on:
  pull_request:
  push:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: check-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  test:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    strategy:
      fail-fast: false
      matrix:
        node-version: [20, 24]
    env:
      POE_API_KEY: ""
      POE_PROXY_API_KEY: ""
      POE_BASE_URL: "https://invalid.example"
    steps:
      - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10
        with:
          persist-credentials: false
      - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: make check
EOF
)
actual_workflow=$(cat "$ROOT_DIR/.github/workflows/check.yml")
if [ "$actual_workflow" != "$expected_workflow" ]; then
  printf '%s\n' "GitHub Actions workflow must match the exact pinned, credential-free proxy validation contract." >&2
  exit 1
fi

for target in "lint:" "test:" "build:" "audit:" "verify:" "check:"; do
  if ! grep -Fq "$target" "$MAKEFILE"; then
    printf '%s\n' "Makefile must expose the $target gate." >&2
    exit 1
  fi
done

for make_contract in \
  'override REPO_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))' \
  'cd "$(REPO_ROOT)" && $(NPM) run lint' \
  'cd "$(REPO_ROOT)" && $(NPM) test' \
  'cd "$(REPO_ROOT)" && $(NPM) run build' \
  'cd "$(REPO_ROOT)" && $(NPM) run audit' \
  'cd "$(REPO_ROOT)" && $(NPM) run verify' \
  'cd "$(REPO_ROOT)" && scripts/check-baseline.sh'; do
  if ! grep -Fq "$make_contract" "$MAKEFILE"; then
    printf '%s\n' "Makefile must remain caller-directory independent: $make_contract" >&2
    exit 1
  fi
done

for package_script in \
  '"lint": "node --check poe-proxy.js"' \
  '"test": "node --test"' \
  '"build": "node --check poe-proxy.js"' \
  '"audit": "npm audit --audit-level=moderate"' \
  '"verify": "npm run lint && npm test && npm run build && npm run audit"'; do
  if ! grep -Fq "$package_script" "$PACKAGE_JSON"; then
    printf '%s\n' "package.json must keep script baseline: $package_script" >&2
    exit 1
  fi
done

for documented in "POE_API_KEY" "POE_PROXY_API_KEY" "POE_UPSTREAM_TIMEOUT_MS" "POE_RATE_LIMIT_MAX" "POE_RATE_LIMIT_WINDOW_MS" "upstream request timeout" "HTTP 429" "make check" "npm run verify" "scripts/check-baseline.sh" "hosted Linux" "GitHub Actions"; do
  if ! grep -Fq "$documented" "$README"; then
    printf '%s\n' "README must document $documented." >&2
    exit 1
  fi
done

for guardrail in "POE_API_KEY" "POE_PROXY_API_KEY" "127.0.0.1" "do not commit real"; do
  if ! grep -Fqi "$guardrail" "$ROOT_DIR/AGENTS.md"; then
    printf '%s\n' "AGENTS.md must preserve the guardrail: $guardrail" >&2
    exit 1
  fi
done

for ignored in "node_modules/" ".env" ".env.local" ".vscode/" ".idea/" "*.iml" "*.log" "coverage/"; do
  if ! grep -Fq "$ignored" "$GITIGNORE"; then
    printf '%s\n' ".gitignore must include $ignored" >&2
    exit 1
  fi
done

tracked_local=$(git -C "$ROOT_DIR" ls-files '.env' '.env.*' '.idea' '.vscode' '*.iml' |
  grep -Ev '^\.env\.example$' || true)
if [ -n "$tracked_local" ]; then
  printf '%s\n%s\n' "Local secrets or editor metadata must not be tracked:" "$tracked_local" >&2
  exit 1
fi

found_plan=0
for plan in "$DOCS_PLANS"/*.md; do
  [ -e "$plan" ] || continue
  found_plan=1
  if [ "$(grep -Eic '^status: completed$' "$plan")" -ne 1 ]; then
    printf '%s\n' "$plan must record completed status." >&2
    exit 1
  fi
  if ! grep -iq "verification" "$plan"; then
    printf '%s\n' "$plan must document verification." >&2
    exit 1
  fi
done

if [ "$found_plan" -eq 0 ]; then
  printf '%s\n' "docs/plans must contain completed markdown plans." >&2
  exit 1
fi

for plan in \
  "$DOCS_PLANS/2026-06-08-poe-proxy-check-wrapper.md" \
  "$DOCS_PLANS/2026-06-09-scripted-baseline-check.md" \
  "$DOCS_PLANS/2026-06-10-ci-baseline.md" \
  "$DOCS_PLANS/2026-06-10-hosted-proxy-validation.md" \
  "$DOCS_PLANS/2026-06-12-credential-free-hosted-validation.md"; do
  if ! grep -Fq "make check" "$plan"; then
    printf '%s\n' "$plan must document make check verification." >&2
    exit 1
  fi
done

for streaming_contract in \
  "function createSseLineDecoder" \
  'decoder.decode(chunk, { stream: true })' \
  "lineDecoder.push(value)" \
  "lineDecoder.finish()" \
  "createSseLineDecoder preserves split JSON, UTF-8, and final lines" \
  "createServer preserves streamed SSE data split across byte chunks"; do
  if ! grep -Fq "$streaming_contract" "$ROOT_DIR/poe-proxy.js" "$ROOT_DIR/test/poe-proxy.test.js"; then
    printf '%s\n' "Streaming chunk-boundary contract is missing: $streaming_contract" >&2
    exit 1
  fi
done

for document in "$README" "$ROOT_DIR/SECURITY.md" "$ROOT_DIR/VISION.md" "$ROOT_DIR/CHANGES.md"; do
  if ! grep -Fq "stream chunk boundaries" "$document"; then
    printf '%s\n' "$document must document stream chunk boundaries." >&2
    exit 1
  fi
done
