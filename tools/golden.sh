#!/usr/bin/env bash
# Golden master for data refactors: capture the generated tables and a spread of native renders,
# or re-capture and compare against the last capture.
#
#   tools/golden.sh capture    regenerate and capture into build/golden/ (the baseline)
#   tools/golden.sh check      regenerate, capture into build/golden.new/, diff against build/golden/;
#                              exit 1 on any difference, naming each file that differs
#
# Captured (build/, gitignored; the baseline is a build output, never committed):
#   viewdata.f, viewdims.inc,  as tools/gen_data.py writes them, with one mask (below): the static
#   vdvoc.f, vdvoc.inc         catalogs, the decks' codes and the card reader's vocabulary
#   scenes.json                byte for byte (the scene list make check and the selftest read)
#   names.js                   byte for byte, plus names.pretty.json (the same JSON, indented) so a
#                              difference shows as readable lines
#   tables.txt                 the run tables as data: build/viewsvg with VIEW_DUMP=1 (tools/vdump.f),
#                              after its card reader (src/vdeck.f) has loaded build/decks.txt's decks,
#                              writes their counts and every scenario-specific table's used entries (legs and
#                              the TABLE legs from ROW cards, events, timeline, START, REF and BURN
#                              rows, burn cues, situations, the scenarios' epoch, site and pad), each
#                              double as its bit pattern in hex, so a changed value shows as data and
#                              not only through a render.  The page's SPAN tables are in names.js.
#   render/*.txt               build/viewsvg's SVG on stdout and hdr(1..24) on stderr (VIEW_HDR) for
#                              every case in CASES, the decks loaded the same way
#
# The mask: in viewdata.f, viewdims.inc, vdvoc.f and vdvoc.inc, comment lines (C in column 1) that quote a source
# location are dropped: a path or file name under data/ or tools/, a *.scn or *.py name, or the name
# of tools/gen_data.py's BURN_CUES table.  These lines say where the tables came from, which a
# data move changes by design; every other line, comments carrying card sources included, must
# match.  names.js has no such strings and is compared unmasked.  The number of masked lines per
# file is recorded (masked.txt) and compared, so the mask cannot quietly swallow new lines.  The
# commit and whether the tree was dirty are recorded too (source.txt; printed by check, not compared).
set -euo pipefail
cd "$(dirname "$0")/.."

MASK='^[Cc].*(data/|tools/|\.scn|\.py|BURN_CUES)'

# One render per line: NAME | environment | viewsvg arguments (scene GET yaw pitch roll fov flags).
# Environment: VIEW_VIEW, VIEW_TARGET, VIEW_LABLV (in_view, in_target, in_lablv) and VIEW_SIM (run
# the engine first; flags +8 draw from the tape).  GETs are g.e.t. s of the scene's scenario.
CASES=$(cat <<'EOF'
s1-default        |                              | 1
s2-default        |                              | 2
s3-default        |                              | 3
s4-default        |                              | 4
s5-default        |                              | 5
s6-default        |                              | 6
s7-default        |                              | 7
s8-default        |                              | 8
s9-default        |                              | 9
s1-367500         |                              | 1 367500
s1-369000         |                              | 1 369000
s2-600000         |                              | 2 600000
s2-700000         |                              | 2 700000
s2-273100         |                              | 2 273100
s3-600            |                              | 3 600
s3-10000          |                              | 3 10000
s3-40000          |                              | 3 40000
s4-360600         |                              | 4 360600
s4-361200         |                              | 4 361200
s5-369600         |                              | 5 369600
s5-369900         |                              | 5 369900
s5-370000         |                              | 5 370000
s6-300000         |                              | 6 300000
s6-400000         |                              | 6 400000
s6-500000         |                              | 6 500000
s7-11500          |                              | 7 11500
s7-12500          |                              | 7 12500
s7-16803          |                              | 7 16803
s8-30000          |                              | 8 30000
s8-80000          |                              | 8 80000
s8-200000         |                              | 8 200000
s9-250000         |                              | 9 250000
s9-290000         |                              | 9 290000
s9-300000         |                              | 9 300000
s9-10300          |                              | 9 10300
s9-look           |                              | 9 - 20 -5 10 30
s9-fov            |                              | 9 272000 0 0 0 60
s1-look           |                              | 1 - -30 10 0 -
s5-look           |                              | 5 - 10 -10 5 70
s3-look           |                              | 3 - 45 0 0 90
s1-flags0         |                              | 1 - 0 0 0 - 0
s3-flags1         |                              | 3 - 0 0 0 - 1
s6-flags2         |                              | 6 - 0 0 0 - 2
s4-flags7         |                              | 4 - 0 0 0 - 7
s8-flags7         |                              | 8 - 0 0 0 - 7
s9-flags0         |                              | 9 - 0 0 0 - 0
s1-ext            | VIEW_VIEW=1                  | 1
s2-ext-moon       | VIEW_VIEW=1 VIEW_TARGET=2    | 2
s3-earth          | VIEW_TARGET=1                | 3
s5-sun            | VIEW_TARGET=3                | 5
s7-sivb           | VIEW_TARGET=4                | 7
s9-ext            | VIEW_VIEW=1 VIEW_TARGET=1    | 9 8000
s9-ext-def        | VIEW_VIEW=1                  | 9
s6-cm-cabin       | VIEW_VIEW=2                  | 6 - 0 0 0 - 19
s7-cm-mask        | VIEW_VIEW=2 VIEW_LABLV=3     | 7 - 0 0 0 - 51
s5-lm-cabin       | VIEW_VIEW=3                  | 5 - 0 0 0 - 19
s5-lm-mask        | VIEW_VIEW=3 VIEW_LABLV=3     | 5 - 0 0 0 - 51
s1-lab1           | VIEW_LABLV=1                 | 1
s6-lab2           | VIEW_LABLV=2                 | 6
s6-lab3-descent   | VIEW_LABLV=3                 | 6 369640
s1-ext-lab2       | VIEW_VIEW=1 VIEW_TARGET=2 VIEW_LABLV=2 | 1
s3-lab3-florida   | VIEW_LABLV=3                 | 3 5800
s3-ext-lab2       | VIEW_VIEW=1 VIEW_TARGET=1 VIEW_LABLV=2 | 3 1200
s9-ext-lab3       | VIEW_VIEW=1 VIEW_TARGET=1 VIEW_LABLV=3 | 9 8000
s3-burn-sivb      | VIEW_LABLV=2                 | 3 600
s3-burn-sivb-ext  | VIEW_VIEW=1 VIEW_LABLV=2     | 3 10000
s7-burn-sps       | VIEW_LABLV=2                 | 7 16803
s2-burn-loi       | VIEW_LABLV=2                 | 2 273100
s5-burn-dps       | VIEW_LABLV=2                 | 5 369600
s5-burn-dps-ext   | VIEW_VIEW=1 VIEW_LABLV=2     | 5 365790
s4-burn-aps       | VIEW_LABLV=2                 | 4 447900
s8-burn-mcc       | VIEW_VIEW=1 VIEW_LABLV=2     | 8 96300
s2-burn-tei       | VIEW_LABLV=2                 | 2 487500
s9-burn-mcc       | VIEW_LABLV=2                 | 9 39700
s9-burn-loi       | VIEW_LABLV=2                 | 9 249000
s9-burn-loi2-ext  | VIEW_VIEW=1 VIEW_LABLV=2     | 9 264950
s9-burn-tei       | VIEW_VIEW=1 VIEW_LABLV=2     | 9 321600
s9-burn-sivb      | VIEW_LABLV=2                 | 9 10300
s1-sim1           | VIEW_SIM=1                   | 1 - 0 0 0 - 11
s2-sim1           | VIEW_SIM=1                   | 2 - 0 0 0 - 11
s3-sim1           | VIEW_SIM=1                   | 3 - 0 0 0 - 11
s5-sim0           | VIEW_SIM=0                   | 5 - 0 0 0 - 11
s8-sim1           | VIEW_SIM=1                   | 8 - 0 0 0 - 11
s9-sim1           | VIEW_SIM=1                   | 9 - 0 0 0 - 11
s9-sim0           | VIEW_SIM=0                   | 9 - 0 0 0 - 11
s1-cm             | VIEW_VIEW=2                  | 1
s2-cm             | VIEW_VIEW=2                  | 2
s3-cm             | VIEW_VIEW=2                  | 3
s4-cm             | VIEW_VIEW=2                  | 4
s7-cm             | VIEW_VIEW=2                  | 7
s8-cm             | VIEW_VIEW=2                  | 8
s8-cm-cabin       | VIEW_VIEW=2                  | 8 - 0 0 0 - 19
s9-cm             | VIEW_VIEW=2                  | 9
s9-cm-8000        | VIEW_VIEW=2                  | 9 8000
s5-cm             | VIEW_VIEW=2                  | 5
s2-cm-tgt-moon    | VIEW_VIEW=2 VIEW_TARGET=2    | 2
s4-lm             | VIEW_VIEW=3                  | 4
s4-lm-cabin       | VIEW_VIEW=3                  | 4 - 0 0 0 - 19
s7-lm             | VIEW_VIEW=3                  | 7
s7-lm-mask        | VIEW_VIEW=3 VIEW_LABLV=3     | 7 - 0 0 0 - 51
s8-lm             | VIEW_VIEW=3                  | 8
s8-lm-cabin       | VIEW_VIEW=3                  | 8 - 0 0 0 - 19
s6-lm             | VIEW_VIEW=3                  | 6
s9-lm             | VIEW_VIEW=3                  | 9
s4-lm-docked      | VIEW_VIEW=3                  | 4 350000
s4-cm-docked      | VIEW_VIEW=2                  | 4 350000
s1-lm-undocked    | VIEW_VIEW=3                  | 1 360900
s1-cm-undocked    | VIEW_VIEW=2                  | 1 360900
s4-lm-tpf         | VIEW_VIEW=3                  | 4 460500
s4-cm-tpf         | VIEW_VIEW=2                  | 4 460500
s2-lm-sep         | VIEW_VIEW=3                  | 2 12100
s2-cm-sep         | VIEW_VIEW=2                  | 2 12100
s3-lm-eject       | VIEW_VIEW=3                  | 3 16000
s8-lm-13000       | VIEW_VIEW=3                  | 8 13000
s8-cm-13000       | VIEW_VIEW=2                  | 8 13000
s7-ext            | VIEW_VIEW=1                  | 7
s7-ext-look       | VIEW_VIEW=1                  | 7 - 20 -10 5 -
s7-ext-lab3       | VIEW_VIEW=1 VIEW_LABLV=3     | 7 12200
s4-ext            | VIEW_VIEW=1                  | 4
s4-ext-360900     | VIEW_VIEW=1                  | 4 360900
s4-ext-lab3       | VIEW_VIEW=1 VIEW_LABLV=3     | 4
s4-tgt-lm         | VIEW_TARGET=5                | 4
s5-ext            | VIEW_VIEW=1                  | 5
s6-ext-csm        | VIEW_VIEW=1 VIEW_TARGET=4    | 6
s6-look           |                              | 6 - 30 20 10 -
s8-ext-earth      | VIEW_VIEW=1 VIEW_TARGET=1    | 8
s8-tgt-lm         | VIEW_TARGET=5                | 8
s9-ext-def-earth  | VIEW_VIEW=1                  | 9 8000
s2-ext-cmsep      | VIEW_VIEW=1 VIEW_LABLV=2     | 2 701500
EOF
)

capture() {
  local out=$1
  ./tools/build.sh native >/dev/null
  rm -rf "$out"; mkdir -p "$out/render"
  for f in viewdata.f viewdims.inc vdvoc.f vdvoc.inc; do
    grep -Ev "$MASK" "src/$f" > "$out/$f"
  done
  for f in src/viewdata.f src/viewdims.inc src/vdvoc.f src/vdvoc.inc; do
    echo "$f $(grep -Ec "$MASK" "$f" || true) masked lines"
  done > "$out/masked.txt"
  { echo "commit $(git rev-parse HEAD)"
    if [ -n "$(git status --porcelain)" ]; then echo "tree dirty"; else echo "tree clean"; fi
  } > "$out/source.txt"
  [ -f build/decks.txt ] || { echo "golden: no build/decks.txt (tools/gen_data.py writes it)" >&2; exit 1; }
  if ! env -u VIEW_TIME -u VIEW_SIM -u VIEW_VIEW -u VIEW_TARGET -u VIEW_LABLV -u VIEW_HDR \
       -u VIEW_DECK -u VIEW_DKSUM VIEW_DUMP=1 build/viewsvg > "$out/tables.txt"; then
    echo "golden: the card reader refused the decks of build/decks.txt (the deck error is above)" >&2
    exit 1
  fi
  cp build/names.js "$out/names.js"
  cp build/scenes.json "$out/scenes.json"
  python3 -c 'import json,sys; t=open(sys.argv[1]).read(); j=json.loads(t[t.index("=")+1:].rstrip().rstrip(";")); print(json.dumps(j, indent=1))' \
    build/names.js > "$out/names.pretty.json"
  local n=0 name envs args
  while IFS='|' read -r name envs args; do
    name=$(echo $name)
    # shellcheck disable=SC2086
    env -u VIEW_TIME -u VIEW_SIM -u VIEW_VIEW -u VIEW_TARGET -u VIEW_LABLV -u VIEW_DUMP \
      -u VIEW_DECK -u VIEW_DKSUM VIEW_HDR=1 $envs \
      build/viewsvg $args > "$out/render/$name.txt" 2>&1
    n=$((n + 1))
  done <<< "$CASES"
  echo "golden: captured 6 tables, the run-table dump ($(wc -l < "$out/tables.txt") entries) and $n renders into $out"
}

case "${1:-}" in
  capture)
    capture build/golden ;;
  check)
    [ -d build/golden ] || { echo "golden: no baseline in build/golden; run 'make golden' on the reference tree first" >&2; exit 2; }
    capture build/golden.new
    echo "golden: baseline from $(paste -sd' ' build/golden/source.txt 2>/dev/null || echo 'an unrecorded tree');" \
         "this check from $(paste -sd' ' build/golden.new/source.txt)"
    if diff -rq -x source.txt build/golden build/golden.new > build/golden.diff.txt; then
      echo "golden: check PASS: build/golden.new matches build/golden"
    else
      echo "golden: check FAIL: these files differ from the baseline (full diff: diff -r build/golden build/golden.new)" >&2
      sed 's/^/  /' build/golden.diff.txt >&2
      for f in $(grep -E '^Files ' build/golden.diff.txt | awk '{print $2}' | head -3); do
        echo "--- first lines of difference in $f" >&2
        diff "$f" "build/golden.new/${f#build/golden/}" | head -12 >&2 || true
      done
      exit 1
    fi ;;
  *)
    echo "usage: tools/golden.sh capture|check" >&2; exit 2 ;;
esac
