.PHONY: audit build check lint test verify

NPM ?= npm

lint:
	$(NPM) run lint

test:
	$(NPM) test

build:
	$(NPM) run build

audit:
	$(NPM) run audit

verify:
	$(NPM) run verify

check: verify
