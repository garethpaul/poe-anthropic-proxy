.PHONY: test audit verify check

NPM ?= npm

test:
	$(NPM) test

audit:
	$(NPM) run audit

verify:
	$(NPM) run verify

check: verify
