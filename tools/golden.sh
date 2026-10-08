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
#   page/<reel id>.json        byte for byte: each reel's page.json (a scenario reel's situations,
#                              SPAN tables and timeline; a playlist reel's REEL and SHOT cards;
#                              tools/gen_data.py, packed by tools/pack.py)
#   tables-<reel id>.txt       each scenario reel's run tables as data: build/viewsvg with VIEW_DUMP=1
#                              (tools/vdump.f), after its card reader (src/vdeck.f) has loaded that
#                              reel's decks (build/decks/<reel id>.txt; the kernel holds one reel at
#                              a time, #26 slice 7e), writes their counts and every scenario-specific table's used entries (legs and
#                              the TABLE legs from ROW cards, events, timeline, START, REF and BURN
#                              rows, burn cues, situations, the scenarios' epoch, site and pad), each
#                              double as its bit pattern in hex, so a changed value shows as data and
#                              not only through a render.  The page's SPAN tables are in page/.
#   render/*.txt               build/viewsvg's SVG on stdout and hdr(1..24) on stderr (VIEW_HDR) for
#                              every case in CASES, its reel's decks loaded the same way (VIEW_REEL)
#   render/nb-<reel>-<name>.txt  each scenario notebook figure (#29): the case of that name in the
#                              figures block of reel <reel>'s notebook.md, rendered once by
#                              tools/notebook.py into build/figures/<reel>/<name>.svg and .hdr, the
#                              two files one after the other.  tools/pack.py packs that same .svg, so
#                              a change that alters a figure fails the check and changes the package.
#
# The tape round trip (#26 slice 6), run by capture and check, writes no file into the capture:
# for each case in TAPES the engine runs (VIEW_SIM), its tape is written as a deck (VIEW_TAPEW,
# tools/vtape.f), and the frame drawn from that tape read back by the card reader (VIEW_DECK:
# the case's reel's decks, then the tape; FLAGS 11) must equal the frame drawn from the engine's
# own tape: the SVG line for line and hdr(1..16, 21..24) digit for digit.  Only the source and its
# reference errors differ, and they must read as a deck tape's: hdr(17) 3 where the tape is drawn,
# hdr(18..20) 0, the SVG's "source" line to match.  Each case also says which source its frame
# must report (TAPES' last column), so the step cannot pass with no tape drawn, and the tape read
# back, written again (VIEW_TAPEW after the decks), must be the first tape's rows text for text.
# Any other difference fails the step.
#
# The mask: in viewdata.f, viewdims.inc, vdvoc.f and vdvoc.inc, comment lines (C in column 1) that quote a source
# location are dropped: a path or file name under data/ or tools/, a *.scn or *.py name, or the name
# of tools/gen_data.py's BURN_CUES table.  These lines say where the tables came from, which a
# data move changes by design; every other line, comments carrying card sources included, must
# match.  names.js and page/ have no such strings and are compared unmasked.  The number of masked lines per
# file is recorded (masked.txt) and compared, so the mask cannot quietly swallow new lines.  The
# commit and whether the tree was dirty are recorded too (source.txt; printed by check, not compared).
set -euo pipefail
cd "$(dirname "$0")/.."

MASK='^[Cc].*(data/|tools/|\.scn|\.py|BURN_CUES)'

# One render per line: NAME | environment | scenario reel | viewsvg arguments (situation GET yaw
# pitch roll fov flags; the situation by its id in the reel).  Environment: VIEW_VIEW, VIEW_TARGET,
# VIEW_LABLV (in_view, in_target, in_lablv) and VIEW_SIM (run the engine first; flags +8 draw from
# the tape).  GETs are g.e.t. s of the reel's scenario.  The names keep the scene numbers of one
# numbering for all reels (before #26 slice 7e: s9 is Apollo 8's situation 1), so a capture
# compares file for file across that change.
CASES=$(cat <<'EOF'
s1-default        |                              | apollo11-asflown | 1
s2-default        |                              | apollo11-asflown | 2
s3-default        |                              | apollo11-asflown | 3
s4-default        |                              | apollo11-asflown | 4
s5-default        |                              | apollo11-asflown | 5
s6-default        |                              | apollo11-asflown | 6
s7-default        |                              | apollo11-asflown | 7
s8-default        |                              | apollo11-asflown | 8
s9-default        |                              | apollo8-asflown  | 1
s1-367500         |                              | apollo11-asflown | 1 367500
s1-369000         |                              | apollo11-asflown | 1 369000
s2-600000         |                              | apollo11-asflown | 2 600000
s2-700000         |                              | apollo11-asflown | 2 700000
s2-273100         |                              | apollo11-asflown | 2 273100
s3-600            |                              | apollo11-asflown | 3 600
s3-10000          |                              | apollo11-asflown | 3 10000
s3-40000          |                              | apollo11-asflown | 3 40000
s4-360600         |                              | apollo11-asflown | 4 360600
s4-361200         |                              | apollo11-asflown | 4 361200
s5-369600         |                              | apollo11-asflown | 5 369600
s5-369900         |                              | apollo11-asflown | 5 369900
s5-370000         |                              | apollo11-asflown | 5 370000
s6-300000         |                              | apollo11-asflown | 6 300000
s6-400000         |                              | apollo11-asflown | 6 400000
s6-500000         |                              | apollo11-asflown | 6 500000
s7-11500          |                              | apollo11-asflown | 7 11500
s7-12500          |                              | apollo11-asflown | 7 12500
s7-16803          |                              | apollo11-asflown | 7 16803
s8-30000          |                              | apollo11-asflown | 8 30000
s8-80000          |                              | apollo11-asflown | 8 80000
s8-200000         |                              | apollo11-asflown | 8 200000
s9-250000         |                              | apollo8-asflown  | 1 250000
s9-290000         |                              | apollo8-asflown  | 1 290000
s9-300000         |                              | apollo8-asflown  | 1 300000
s9-10300          |                              | apollo8-asflown  | 1 10300
s9-look           |                              | apollo8-asflown  | 1 - 20 -5 10 30
s9-fov            |                              | apollo8-asflown  | 1 272000 0 0 0 60
s1-look           |                              | apollo11-asflown | 1 - -30 10 0 -
s5-look           |                              | apollo11-asflown | 5 - 10 -10 5 70
s3-look           |                              | apollo11-asflown | 3 - 45 0 0 90
s1-flags0         |                              | apollo11-asflown | 1 - 0 0 0 - 0
s3-flags1         |                              | apollo11-asflown | 3 - 0 0 0 - 1
s6-flags2         |                              | apollo11-asflown | 6 - 0 0 0 - 2
s4-flags7         |                              | apollo11-asflown | 4 - 0 0 0 - 7
s8-flags7         |                              | apollo11-asflown | 8 - 0 0 0 - 7
s9-flags0         |                              | apollo8-asflown  | 1 - 0 0 0 - 0
s1-ext            | VIEW_VIEW=1                  | apollo11-asflown | 1
s2-ext-moon       | VIEW_VIEW=1 VIEW_TARGET=2    | apollo11-asflown | 2
s3-earth          | VIEW_TARGET=1                | apollo11-asflown | 3
s5-sun            | VIEW_TARGET=3                | apollo11-asflown | 5
s7-sivb           | VIEW_TARGET=4                | apollo11-asflown | 7
s9-ext            | VIEW_VIEW=1 VIEW_TARGET=1    | apollo8-asflown  | 1 8000
s9-ext-def        | VIEW_VIEW=1                  | apollo8-asflown  | 1
s6-cm-cabin       | VIEW_VIEW=2                  | apollo11-asflown | 6 - 0 0 0 - 19
s7-cm-mask        | VIEW_VIEW=2 VIEW_LABLV=3     | apollo11-asflown | 7 - 0 0 0 - 51
s5-lm-cabin       | VIEW_VIEW=3                  | apollo11-asflown | 5 - 0 0 0 - 19
s5-lm-mask        | VIEW_VIEW=3 VIEW_LABLV=3     | apollo11-asflown | 5 - 0 0 0 - 51
s1-lab1           | VIEW_LABLV=1                 | apollo11-asflown | 1
s6-lab2           | VIEW_LABLV=2                 | apollo11-asflown | 6
s6-lab3-descent   | VIEW_LABLV=3                 | apollo11-asflown | 6 369640
s1-ext-lab2       | VIEW_VIEW=1 VIEW_TARGET=2 VIEW_LABLV=2 | apollo11-asflown | 1
s3-lab3-florida   | VIEW_LABLV=3                 | apollo11-asflown | 3 5800
s3-ext-lab2       | VIEW_VIEW=1 VIEW_TARGET=1 VIEW_LABLV=2 | apollo11-asflown | 3 1200
s9-ext-lab3       | VIEW_VIEW=1 VIEW_TARGET=1 VIEW_LABLV=3 | apollo8-asflown  | 1 8000
s3-burn-sivb      | VIEW_LABLV=2                 | apollo11-asflown | 3 600
s3-burn-sivb-ext  | VIEW_VIEW=1 VIEW_LABLV=2     | apollo11-asflown | 3 10000
s7-burn-sps       | VIEW_LABLV=2                 | apollo11-asflown | 7 16803
s2-burn-loi       | VIEW_LABLV=2                 | apollo11-asflown | 2 273100
s5-burn-dps       | VIEW_LABLV=2                 | apollo11-asflown | 5 369600
s5-burn-dps-ext   | VIEW_VIEW=1 VIEW_LABLV=2     | apollo11-asflown | 5 365790
s4-burn-aps       | VIEW_LABLV=2                 | apollo11-asflown | 4 447900
s8-burn-mcc       | VIEW_VIEW=1 VIEW_LABLV=2     | apollo11-asflown | 8 96300
s2-burn-tei       | VIEW_LABLV=2                 | apollo11-asflown | 2 487500
s9-burn-mcc       | VIEW_LABLV=2                 | apollo8-asflown  | 1 39700
s9-burn-loi       | VIEW_LABLV=2                 | apollo8-asflown  | 1 249000
s9-burn-loi2-ext  | VIEW_VIEW=1 VIEW_LABLV=2     | apollo8-asflown  | 1 264950
s9-burn-tei       | VIEW_VIEW=1 VIEW_LABLV=2     | apollo8-asflown  | 1 321600
s9-burn-sivb      | VIEW_LABLV=2                 | apollo8-asflown  | 1 10300
s1-sim1           | VIEW_SIM=1                   | apollo11-asflown | 1 - 0 0 0 - 11
s2-sim1           | VIEW_SIM=1                   | apollo11-asflown | 2 - 0 0 0 - 11
s3-sim1           | VIEW_SIM=1                   | apollo11-asflown | 3 - 0 0 0 - 11
s5-sim0           | VIEW_SIM=0                   | apollo11-asflown | 5 - 0 0 0 - 11
s8-sim1           | VIEW_SIM=1                   | apollo11-asflown | 8 - 0 0 0 - 11
s9-sim1           | VIEW_SIM=1                   | apollo8-asflown  | 1 - 0 0 0 - 11
s9-sim0           | VIEW_SIM=0                   | apollo8-asflown  | 1 - 0 0 0 - 11
s1-cm             | VIEW_VIEW=2                  | apollo11-asflown | 1
s2-cm             | VIEW_VIEW=2                  | apollo11-asflown | 2
s3-cm             | VIEW_VIEW=2                  | apollo11-asflown | 3
s4-cm             | VIEW_VIEW=2                  | apollo11-asflown | 4
s7-cm             | VIEW_VIEW=2                  | apollo11-asflown | 7
s8-cm             | VIEW_VIEW=2                  | apollo11-asflown | 8
s8-cm-cabin       | VIEW_VIEW=2                  | apollo11-asflown | 8 - 0 0 0 - 19
s9-cm             | VIEW_VIEW=2                  | apollo8-asflown  | 1
s9-cm-8000        | VIEW_VIEW=2                  | apollo8-asflown  | 1 8000
s5-cm             | VIEW_VIEW=2                  | apollo11-asflown | 5
s2-cm-tgt-moon    | VIEW_VIEW=2 VIEW_TARGET=2    | apollo11-asflown | 2
s4-lm             | VIEW_VIEW=3                  | apollo11-asflown | 4
s4-lm-cabin       | VIEW_VIEW=3                  | apollo11-asflown | 4 - 0 0 0 - 19
s7-lm             | VIEW_VIEW=3                  | apollo11-asflown | 7
s7-lm-mask        | VIEW_VIEW=3 VIEW_LABLV=3     | apollo11-asflown | 7 - 0 0 0 - 51
s8-lm             | VIEW_VIEW=3                  | apollo11-asflown | 8
s8-lm-cabin       | VIEW_VIEW=3                  | apollo11-asflown | 8 - 0 0 0 - 19
s6-lm             | VIEW_VIEW=3                  | apollo11-asflown | 6
s9-lm             | VIEW_VIEW=3                  | apollo8-asflown  | 1
s4-lm-docked      | VIEW_VIEW=3                  | apollo11-asflown | 4 350000
s4-cm-docked      | VIEW_VIEW=2                  | apollo11-asflown | 4 350000
s1-lm-undocked    | VIEW_VIEW=3                  | apollo11-asflown | 1 360900
s1-cm-undocked    | VIEW_VIEW=2                  | apollo11-asflown | 1 360900
s4-lm-tpf         | VIEW_VIEW=3                  | apollo11-asflown | 4 460500
s4-cm-tpf         | VIEW_VIEW=2                  | apollo11-asflown | 4 460500
s2-lm-sep         | VIEW_VIEW=3                  | apollo11-asflown | 2 12100
s2-cm-sep         | VIEW_VIEW=2                  | apollo11-asflown | 2 12100
s3-lm-eject       | VIEW_VIEW=3                  | apollo11-asflown | 3 16000
s8-lm-13000       | VIEW_VIEW=3                  | apollo11-asflown | 8 13000
s8-cm-13000       | VIEW_VIEW=2                  | apollo11-asflown | 8 13000
s7-ext            | VIEW_VIEW=1                  | apollo11-asflown | 7
s7-ext-look       | VIEW_VIEW=1                  | apollo11-asflown | 7 - 20 -10 5 -
s7-ext-lab3       | VIEW_VIEW=1 VIEW_LABLV=3     | apollo11-asflown | 7 12200
s4-ext            | VIEW_VIEW=1                  | apollo11-asflown | 4
s4-ext-360900     | VIEW_VIEW=1                  | apollo11-asflown | 4 360900
s4-ext-lab3       | VIEW_VIEW=1 VIEW_LABLV=3     | apollo11-asflown | 4
s4-tgt-lm         | VIEW_TARGET=5                | apollo11-asflown | 4
s5-ext            | VIEW_VIEW=1                  | apollo11-asflown | 5
s6-ext-csm        | VIEW_VIEW=1 VIEW_TARGET=4    | apollo11-asflown | 6
s6-look           |                              | apollo11-asflown | 6 - 30 20 10 -
s8-ext-earth      | VIEW_VIEW=1 VIEW_TARGET=1    | apollo11-asflown | 8
s8-tgt-lm         | VIEW_TARGET=5                | apollo11-asflown | 8
s9-ext-def-earth  | VIEW_VIEW=1                  | apollo8-asflown  | 1 8000
s2-ext-cmsep      | VIEW_VIEW=1 VIEW_LABLV=2     | apollo11-asflown | 2 701500
EOF
)

# The tape round trip: NAME | VIEW_SIM | scenario reel | situation GET | the source the frame from the
# read-back tape must report, hdr(17): 3 where the tape is drawn (after the scenario's START and before entry
# interface), 0 where it is not (s3-tape1's 1:30:00 is before START, s2-ei after entry interface).
TAPES=$(cat <<'EOF'
s1-tape1          | 1 | apollo11-asflown | 1 -      | 3
s1-tape0          | 0 | apollo11-asflown | 1 -      | 3
s2-tape1          | 1 | apollo11-asflown | 2 600000 | 3
s2-tape0          | 0 | apollo11-asflown | 2 600000 | 3
s2-ei             | 1 | apollo11-asflown | 2 702500 | 0
s3-tape1          | 1 | apollo11-asflown | 3 -      | 0
s3-tape-40000     | 1 | apollo11-asflown | 3 40000  | 3
s4-tape1          | 1 | apollo11-asflown | 4 360600 | 3
s7-tape0          | 0 | apollo11-asflown | 7 12500  | 3
s8-tape1          | 1 | apollo11-asflown | 8 -      | 3
s8-tape0          | 0 | apollo11-asflown | 8 80000  | 3
s9-tape1          | 1 | apollo8-asflown  | 1 -      | 3
s9-tape0          | 0 | apollo8-asflown  | 1 250000 | 3
EOF
)

roundtrip() {
  local tmp=build/tape-rt decks n=0 bad=0 name sim reel args want sc get src
  local E="env -u VIEW_TIME -u VIEW_VIEW -u VIEW_TARGET -u VIEW_LABLV -u VIEW_DUMP -u VIEW_DKSUM"
  rm -rf "$tmp"; mkdir -p "$tmp"
  while IFS='|' read -r name sim reel args want; do
    name=$(echo $name); sim=$(echo $sim); reel=$(echo $reel); want=$(echo $want)
    read -r sc get <<< "$args"
    decks=$(paste -sd: "build/decks/$reel.txt")
    $E -u VIEW_DECK -u VIEW_HDR VIEW_REEL=$reel VIEW_SIM=$sim VIEW_TAPEW=1 build/viewsvg $sc > "$tmp/$name.tsv"
    $E -u VIEW_DECK VIEW_REEL=$reel VIEW_HDR=1 VIEW_SIM=$sim build/viewsvg $sc $get 0 0 0 - 11 \
      > "$tmp/$name.a.svg" 2> "$tmp/$name.a.hdr"
    if ! $E -u VIEW_SIM VIEW_HDR=1 VIEW_DECK="$decks:$tmp/$name.tsv" \
         build/viewsvg $sc $get 0 0 0 - 11 > "$tmp/$name.b.svg" 2> "$tmp/$name.b.hdr"; then
      echo "golden: tape round trip $name: the card reader refused the tape:" >&2
      sed 's/^/  /' "$tmp/$name.b.hdr" >&2; bad=$((bad + 1)); n=$((n + 1)); continue
    fi
    # The source the frame reports, against the case's: the tape drawn where it should be.
    src=$(sed -nE 's/^hdr\(17\) = +([0-9])\..*/\1/p' "$tmp/$name.b.hdr")
    if [ "$src" != "$want" ]; then
      echo "golden: tape round trip $name: source $src, not $want" >&2; bad=$((bad + 1))
    fi
    # The tape read back, written again: the same rows, text for text (its bits, through 17 digits).
    $E -u VIEW_SIM -u VIEW_HDR VIEW_DECK="$decks:$tmp/$name.tsv" VIEW_TAPEW=1 build/viewsvg $sc \
      > "$tmp/$name.again.tsv"
    if ! diff -q <(grep -v '^\*' "$tmp/$name.tsv") <(grep -v '^\*' "$tmp/$name.again.tsv") > /dev/null; then
      echo "golden: tape round trip $name: the tape read back and written again differs" >&2; bad=$((bad + 1))
    fi
    # The engine's frame with its source lines turned into what a deck tape gives: hdr(17) 3 and
    # hdr(18..20) 0 where the engine's tape was drawn (hdr(17) 1 or 2), hdr(18..20) 0 elsewhere.
    sed -E 's/^(hdr\(17\) = +)[12]\./\13./; s/^(hdr\((18|19|20)\) = +).*/\10.000000000000000E+00/' \
      "$tmp/$name.a.hdr" > "$tmp/$name.x.hdr"
    sed -E 's/^  source [12]  err .*/  source 3  err .0 km .0 ft\/s at .0/' \
      "$tmp/$name.a.svg" > "$tmp/$name.x.svg"
    if ! cmp -s "$tmp/$name.x.svg" "$tmp/$name.b.svg" || ! cmp -s "$tmp/$name.x.hdr" "$tmp/$name.b.hdr"; then
      echo "golden: tape round trip $name: the frame from the tape read back differs:" >&2
      { diff "$tmp/$name.x.svg" "$tmp/$name.b.svg"; diff "$tmp/$name.x.hdr" "$tmp/$name.b.hdr"; } | head -8 >&2
      bad=$((bad + 1))
    fi
    n=$((n + 1))
  done <<< "$TAPES"
  if [ $bad -ne 0 ]; then
    echo "golden: tape round trip FAIL: $bad of $n cases (files in $tmp)" >&2; exit 1
  fi
  rm -rf "$tmp"
  echo "golden: tape round trip PASS: $n cases, each frame drawn from the tape read back equals the engine's"
}

capture() {
  local out=$1
  ./tools/build.sh native >/dev/null
  python3 tools/notebook.py render >/dev/null
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
  [ -f build/decks/reels.txt ] || { echo "golden: no build/decks/reels.txt (tools/gen_data.py writes it)" >&2; exit 1; }
  local reel
  for reel in $(cat build/decks/reels.txt); do
    if ! env -u VIEW_TIME -u VIEW_SIM -u VIEW_VIEW -u VIEW_TARGET -u VIEW_LABLV -u VIEW_HDR \
         -u VIEW_DECK -u VIEW_DKSUM VIEW_REEL=$reel VIEW_DUMP=1 build/viewsvg > "$out/tables-$reel.txt"; then
      echo "golden: the card reader refused the decks of build/decks/$reel.txt (the deck error is above)" >&2
      exit 1
    fi
  done
  cp build/names.js "$out/names.js"
  cp build/scenes.json "$out/scenes.json"
  cp -r build/page "$out/page"
  python3 -c 'import json,sys; t=open(sys.argv[1]).read(); j=json.loads(t[t.index("=")+1:].rstrip().rstrip(";")); print(json.dumps(j, indent=1))' \
    build/names.js > "$out/names.pretty.json"
  local n=0 name envs args
  while IFS='|' read -r name envs reel args; do
    name=$(echo $name); reel=$(echo $reel)
    # shellcheck disable=SC2086
    env -u VIEW_TIME -u VIEW_SIM -u VIEW_VIEW -u VIEW_TARGET -u VIEW_LABLV -u VIEW_DUMP \
      -u VIEW_DECK -u VIEW_DKSUM VIEW_HDR=1 VIEW_REEL=$reel $envs \
      build/viewsvg $args > "$out/render/$name.txt" 2>&1
    n=$((n + 1))
  done <<< "$CASES"
  # The notebook figures, as tools/notebook.py rendered them (the one render tools/pack.py packs).
  local nf=0 f
  while read -r reel name; do
    f=build/figures/$reel/$name
    cat "$f.svg" "$f.hdr" > "$out/render/nb-$reel-$name.txt"
    nf=$((nf + 1))
  done < <(python3 tools/notebook.py list)
  echo "golden: captured 6 tables, $(ls "$out/page" | wc -l) page.json, the run-table dumps ($(cat "$out"/tables-*.txt | wc -l) entries, $(ls "$out"/tables-*.txt | wc -l) reels), $n renders and $nf notebook figures into $out"
  roundtrip
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
