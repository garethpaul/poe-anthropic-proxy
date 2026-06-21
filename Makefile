.PHONY: audit build check lint root-test test verify

override SHELL := /bin/sh
override .SHELLFLAGS := -c
ifneq ($(strip $(MAKEFILES)),)
$(error MAKEFILES must be empty; repository verification requires this Makefile to be loaded alone)
endif
override MAKEFILES :=
ifneq ($(origin MAKEFILE_LIST),file)
$(error MAKEFILE_LIST must not be overridden)
endif
override REPO_ROOT := $(shell path='$(subst ','"'"',$(MAKEFILE_LIST))'; path=$$(printf '%s' "$$path" | /usr/bin/sed 's/^ //'); [ -f "$$path" ] || exit 1; directory=$$(/usr/bin/dirname -- "$$path"); CDPATH= cd -- "$$directory" && /bin/pwd -P)
export REPO_ROOT
ifeq ($(strip $(REPO_ROOT)),)
$(error repository Makefile path could not be resolved)
endif
override NPM := npm
override NODE := node

lint:
	cd "$$REPO_ROOT" && $(NPM) run lint

test:
	cd "$$REPO_ROOT" && $(NPM) test

build:
	cd "$$REPO_ROOT" && $(NPM) run build

audit:
	cd "$$REPO_ROOT" && $(NPM) run audit

verify: root-test
	cd "$$REPO_ROOT" && $(NPM) run verify

root-test:
	cd "$$REPO_ROOT" && $(NODE) scripts/test-makefile-root.js

check: verify
	cd "$$REPO_ROOT" && scripts/check-baseline.sh
