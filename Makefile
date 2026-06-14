.PHONY: audit build check lint test verify

NPM ?= npm
override REPO_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

lint:
	cd "$(REPO_ROOT)" && $(NPM) run lint

test:
	cd "$(REPO_ROOT)" && $(NPM) test

build:
	cd "$(REPO_ROOT)" && $(NPM) run build

audit:
	cd "$(REPO_ROOT)" && $(NPM) run audit

verify:
	cd "$(REPO_ROOT)" && $(NPM) run verify

check: verify
	cd "$(REPO_ROOT)" && scripts/check-baseline.sh
