# VIEW-1108 developer commands. `make` alone prints this list.

LF_BIN ?= $(HOME)/lf/bin
PORT   ?= 8108
PIDFILE = build/serve.pid
LOGFILE = build/serve.log
SCENES  = 1 2 3 4 5 6 7 8
# Kernel elements: every fixed-form file in src/ but the generated BLOCK DATA.
KSRC    = $(filter-out src/viewdata.f,$(wildcard src/*.f))

export LF_BIN

.DEFAULT_GOAL := help
.PHONY: help sheet build data native test lint check golden golden-check serve stop status clean

help: ## Show this list
	@echo "VIEW-1108 — make <target>   (LF_BIN=$(LF_BIN)  PORT=$(PORT))"
	@echo
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  %-8s %s\n", $$1, $$2}'

build: ## Full build: data -> FORTRAN -> wasm -> web/view1108.html, then self-test
	./tools/build.sh

data: ## Regenerate src/viewdata.f and build/names.js from data/
	python3 tools/gen_data.py

native: ## Build the native SVG renderer (build/viewsvg) with gfortran
	./tools/build.sh native

test: ## Run the headless self-test (wasm vs wasm2js fallback, every scene)
	node tools/selftest.mjs

sheet: ## Regenerate docs/media/film-vs-view1108.png (film vs our page; needs chromium + Pillow)
	python3 tools/film_sheet.py

lint: ## Check kernel dialect, compile warnings, and script syntax
	python3 tools/lint_dialect.py $(KSRC) src/viewcom.inc src/viewdims.inc
	gfortran -fsyntax-only -std=legacy -Wall -Wno-unused-dummy-argument -Isrc $(KSRC)
	# All elements as one unit too, so calls between elements are checked against each other.
	@mkdir -p build && cat $(KSRC) > build/kernel_all.f
	gfortran -fsyntax-only -std=legacy -Wall -Wno-unused-dummy-argument -Isrc build/kernel_all.f
	# viewdata.f: LFortran needs the DATA implied-DO index declared; gfortran warns about it.
	gfortran -fsyntax-only -std=legacy -Wall -Wno-unused-variable src/viewdata.f
	gfortran -fsyntax-only -Wall -Jbuild src/shell.f90
	python3 -m py_compile tools/*.py
	node --check tools/selftest.mjs

check: native ## Render every scene natively to build/check/scene<N>.png for eyeballing
	mkdir -p build/check
	for s in $(SCENES); do build/viewsvg $$s > build/check/scene$$s.svg && \
	  rsvg-convert -b black build/check/scene$$s.svg -o build/check/scene$$s.png; done
	@ls build/check/*.png

golden: ## Capture the golden master (generated tables, native renders) into build/golden
	./tools/golden.sh capture

golden-check: ## Re-capture and diff against build/golden; fails on any difference
	./tools/golden.sh check

serve: ## Start a local web server for web/ in the background (PORT=8108)
	@mkdir -p build
	@if [ -f $(PIDFILE) ] && kill -0 $$(cat $(PIDFILE)) 2>/dev/null; then \
	  echo "already running (pid $$(cat $(PIDFILE))): http://localhost:$(PORT)/view1108.html"; exit 0; fi; \
	python3 -m http.server $(PORT) --bind 127.0.0.1 --directory web > $(LOGFILE) 2>&1 & echo $$! > $(PIDFILE); \
	sleep 0.5; \
	if kill -0 $$(cat $(PIDFILE)) 2>/dev/null; then \
	  echo "serving web/ on http://localhost:$(PORT)/view1108.html (pid $$(cat $(PIDFILE)))"; \
	  echo "mock kernel: http://localhost:$(PORT)/page.template.html?mock (loads the page modules from web/src/)"; \
	else echo "server failed to start:"; cat $(LOGFILE); rm -f $(PIDFILE); exit 1; fi

stop: ## Stop the local web server started by `make serve`
	@if [ -f $(PIDFILE) ] && kill -0 $$(cat $(PIDFILE)) 2>/dev/null; then \
	  kill $$(cat $(PIDFILE)) && echo "stopped (pid $$(cat $(PIDFILE)))"; else echo "not running"; fi; \
	rm -f $(PIDFILE)

status: ## Say whether the local web server is running
	@if [ -f $(PIDFILE) ] && kill -0 $$(cat $(PIDFILE)) 2>/dev/null; then \
	  echo "running (pid $$(cat $(PIDFILE))): http://localhost:$(PORT)/view1108.html"; else echo "not running"; fi

clean: stop ## Remove build outputs (keeps build/names.js regeneration via `make data`)
	rm -rf build web/view1108.html
