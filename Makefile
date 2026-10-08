# VIEW-1108 developer commands. `make` alone prints this list.

LF_BIN ?= $(HOME)/lf/bin
PORT   ?= 8108
PIDFILE = build/serve.pid
LOGFILE = build/serve.log
# Each scenario reel's situations as <reel id>:<situation id>, from build/scenes.json (tools/gen_data.py, the
# SITUATION cards; each reel numbers its own, #26 slice 7e); read when a recipe runs.
SCENES  = $(shell python3 -c 'import json; print(*("%s:%s" % (r["id"], s) for r in json.load(open("build/scenes.json"))["reels"] for s in r["scenes"]))')
# Kernel elements: every fixed-form file in src/ but the generated BLOCK DATA (the catalogs, the
# card reader's vocabulary).
KSRC    = $(filter-out src/viewdata.f src/vdvoc.f,$(wildcard src/*.f))

# Image comparison (#103): a case's score is 100 - changed-pixel percent after the fuzz; at or above the pass score it
# auto-passes, below it the case is in the verification queue and the target exits 1.
FUZZ                 ?= 2
GOLDEN_PASS_SCORE    ?= 99.5
SHOTS_PASS_SCORE     ?= 99.5
SHOTS_UNSTABLE_SCORE ?= 90

# Quiet gates (#119): each gate prints one line and keeps its output in build/logs/<gate>.log; VERBOSE=1 prints it all.
# AREA=a,b runs a slice of the golden cases or the shots (tools/areas.tsv), for iteration only.
GATE = ./tools/gate.sh

export VERBOSE AREA LF_BIN FUZZ GOLDEN_PASS_SCORE SHOTS_PASS_SCORE SHOTS_UNSTABLE_SCORE

.DEFAULT_GOAL := help
.PHONY: help sheet build page data native test lab-test shots lint lint-body check check-affected golden golden-check golden-diff shots-baseline shots-check serve stop status clean

help: ## Show this list
	@echo "VIEW-1108 — make <target>   (LF_BIN=$(LF_BIN)  PORT=$(PORT))"
	@echo
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  %-8s %s\n", $$1, $$2}'

build: ## Full build: data -> FORTRAN -> wasm -> web/view1108.html, then self-test
	@$(GATE) build ./tools/build.sh

page: ## Rebuild the page without the kernel: the lab bundle (web/lab) and the assembled web/view1108.html
	@$(GATE) page sh -c 'npm --prefix web/lab run --silent build && python3 tools/assemble.py'

data: ## Regenerate src/viewdata.f and build/names.js from data/
	python3 tools/gen_data.py

native: ## Build the native SVG renderer (build/viewsvg) with gfortran
	./tools/build.sh native

test: ## Run the headless self-test (wasm vs wasm2js fallback, every scene)
	@$(GATE) selftest node tools/selftest.mjs

lab-test: ## web/lab: tsc --noEmit, then npm test
	@$(GATE) lab sh -c 'npm --prefix web/lab run --silent typecheck && npm --prefix web/lab run --silent test'

shots: ## Scripted screenshots and checks (tools/shots.mjs) -> build/shots/*.png; ONLY=<name|glob>, LIST=1
	@$(if $(LIST),VERBOSE=1 )GATE_LABEL='shots$(if $(AREA), [$(AREA)])' $(GATE) shots node tools/shoot.mjs $(if $(AREA),--area '$(AREA)') $(if $(ONLY),--only '$(ONLY)') $(if $(LIST),--list)

sheet: ## Regenerate docs/media/film-vs-view1108.png (film vs our page; needs chromium + Pillow)
	python3 tools/film_sheet.py

lint: ## Check kernel dialect, compile warnings, and script syntax
	@$(GATE) lint $(MAKE) --no-print-directory lint-body

lint-body:
	python3 tools/lint_dialect.py $(KSRC) src/vdvoc.f src/viewcom.inc src/viewdims.inc src/viewsit.inc \
	  src/vdvoc.inc src/vdeck.inc
	gfortran -fsyntax-only -std=legacy -Wall -Wno-unused-dummy-argument -Isrc $(KSRC)
	# All elements as one unit too, so calls between elements are checked against each other.
	@mkdir -p build && cat $(KSRC) > build/kernel_all.f
	gfortran -fsyntax-only -std=legacy -Wall -Wno-unused-dummy-argument -Isrc build/kernel_all.f
	# viewdata.f, vdvoc.f: LFortran needs the DATA implied-DO index declared; gfortran warns about it.
	gfortran -fsyntax-only -std=legacy -Wall -Wno-unused-variable -Isrc src/viewdata.f src/vdvoc.f
	gfortran -fsyntax-only -Wall -Jbuild src/shell.f90
	# tools/vdump.f: the native driver's run-table dump for the golden gate (not a kernel element).
	gfortran -fsyntax-only -std=legacy -Wall -fimplicit-none -Isrc tools/vdump.f
	python3 -m py_compile tools/*.py
	node --check tools/selftest.mjs
	node --check tools/shoot.mjs
	node --check tools/shots.mjs
	python3 tools/imgdiff.py selfcheck
	python3 tools/lint_fonts.py
	bash -n tools/golden-diff.sh
	bash -n tools/shots-check

check: native ## Render every situation natively to build/check/<reel>-s<N>.png for eyeballing
	mkdir -p build/check
	@test -n "$(SCENES)" || { echo 'check: no scenes in build/scenes.json' >&2; exit 1; }
	for rs in $(SCENES); do r=$${rs%:*}; s=$${rs#*:}; VIEW_REEL=$$r build/viewsvg $$s > build/check/$$r-s$$s.svg && \
	  rsvg-convert -b black build/check/$$r-s$$s.svg -o build/check/$$r-s$$s.png; done
	@ls build/check/*.png

golden: ## Capture the golden master (generated tables, native renders) into build/golden
	./tools/golden.sh capture

golden-check: ## Re-capture and diff against build/golden; fails on any difference
	@GATE_LABEL='golden$(if $(AREA), [$(AREA)])' $(GATE) golden ./tools/golden.sh check

golden-diff: ## Re-capture, score each difference from build/golden -> build/golden.diff/report.html; exit 1 on a non-empty verification queue
	./tools/golden-diff.sh

shots-baseline: ## Copy build/shots/*.png to build/shots-baseline (the reference for shots-check)
	./tools/shots-check baseline

shots-check: ## make shots, then score each PNG against the baseline -> build/shots-diff; ONLY=<name|glob>
	./tools/shots-check check

check-affected: ## Run only the gates and slices the change can affect (tools/affected.tsv); DRY=1 prints the plan
	python3 tools/affected.py $(if $(DRY),--dry-run)

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
