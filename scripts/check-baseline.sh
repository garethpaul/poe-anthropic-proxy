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
  "scripts/check-baseline.sh"; do
  require_file "$path"
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

if ! grep -Fq "scripts/check-baseline.sh" "$MAKEFILE"; then
  printf '%s\n' "Makefile must run scripts/check-baseline.sh from make check." >&2
  exit 1
fi

for target in "lint:" "test:" "build:" "audit:" "verify:" "check:"; do
  if ! grep -Fq "$target" "$MAKEFILE"; then
    printf '%s\n' "Makefile must expose the $target gate." >&2
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

for documented in "POE_API_KEY" "POE_PROXY_API_KEY" "POE_UPSTREAM_TIMEOUT_MS" "upstream request timeout" "make check" "npm run verify" "scripts/check-baseline.sh" "hosted Linux" "GitHub Actions"; do
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
