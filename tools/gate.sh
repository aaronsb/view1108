#!/usr/bin/env bash
# Quiet gate runner (#119): tools/gate.sh <gate> <command...>
# Runs the command with its output in build/logs/<gate>.log and prints one line: PASS or FAIL, the gate, the seconds
# and the last line of the log (the gate's own summary: the selftest's, "shots: N of N passed", golden's check line).
# On failure it adds only the failing lines (at most GATE_LINES, default 20) and the log's path, and exits with the
# command's status.  VERBOSE=1 runs the command with its output as it is, nothing hidden.
# GATE_LABEL names the gate on the line when the log's name is not enough (a slice: golden [pad]).
set -uo pipefail
cd "$(dirname "$0")/.."
gate=$1; shift
if [ -n "${VERBOSE:-}" ]; then exec "$@"; fi
mkdir -p build/logs
log=build/logs/$gate.log
t0=$SECONDS
"$@" > "$log" 2>&1
rc=$?
last=$(grep -v '^[[:space:]]*$' "$log" | tail -1 | cut -c1-150)
[ "$last" = PASS ] && last="all $(grep -c ' ' "$log") check lines passed"
label=${GATE_LABEL:-$gate}
if [ "$rc" -eq 0 ]; then
  printf 'PASS  %-14s %4ss  %s\n' "$label" "$((SECONDS - t0))" "$last"
else
  printf 'FAIL  %-14s %4ss  %s\n' "$label" "$((SECONDS - t0))" "$last"
  # The failing items: lines that say so, with the lines under them that give the reason; else the log's tail.
  if grep -qE 'FAIL|[Ee]rror|differ|not ok|refused' "$log"; then
    grep -m "${GATE_LINES:-20}" -A2 -E 'FAIL|[Ee]rror|differ|not ok|refused' "$log" | grep -v '^--$' | head -n "${GATE_LINES:-20}" | cut -c1-200 | sed 's/^/      /'
  else
    tail -n "${GATE_LINES:-20}" "$log" | cut -c1-200 | sed 's/^/      /'
  fi
  echo "      log: $log"
fi
exit "$rc"
