.PHONY: audit build check lint root-test test verify

ifneq ($(origin MAKEFILE_LIST),file)
$(error MAKEFILE_LIST must not be overridden)
endif
override REPO_ROOT := $(shell path='$(subst ','"'"',$(MAKEFILE_LIST))'; path=$$(printf '%s' "$$path" | /usr/bin/sed 's/^ //'); directory=$$(/usr/bin/dirname -- "$$path"); CDPATH= cd -- "$$directory" && /bin/pwd -P)
override NPM := npm

lint:
	cd "$(REPO_ROOT)" && $(NPM) run lint

test:
	cd "$(REPO_ROOT)" && $(NPM) test

build:
	cd "$(REPO_ROOT)" && $(NPM) run build

audit:
	cd "$(REPO_ROOT)" && $(NPM) run audit

verify: root-test
	cd "$(REPO_ROOT)" && $(NPM) run verify

root-test:
	cd "$(REPO_ROOT)" && node scripts/test-makefile-root.js

check: verify
	cd "$(REPO_ROOT)" && scripts/check-baseline.sh
