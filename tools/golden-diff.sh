#!/usr/bin/env bash
# make golden-diff (#103): re-capture (tools/golden.sh check) and report every difference from build/golden as a
# similarity score; the report is build/golden.diff/report.html (and report.md, notice.json).  Exit 1 only when the
# verification queue is not empty (score under GOLDEN_PASS_SCORE, a changed non-render file, an added or removed case).
# Set GOLDEN_DIFF_NOCAPTURE=1 to compare the existing build/golden.new without re-capturing.
set -uo pipefail
cd "$(dirname "$0")/.."
if [ -z "${GOLDEN_DIFF_NOCAPTURE:-}" ]; then
  rm -rf build/golden.new
  ./tools/golden.sh check > build/golden.check.log 2>&1 || true
  # The capture stops early where a packed notebook figure is older than the render: the package is rebuilt by build.sh.
  if grep -qE "packed figure .* is not golden case|figure .*hdr is not golden case" build/golden.check.log; then
    echo 'golden-diff: the capture stopped before its end (a packed figure is stale); rebuild first: LF_BIN=~/lf/bin ./tools/build.sh' >&2
    exit 2
  fi
  [ -d build/golden.new ] || { echo 'golden-diff: the capture failed:' >&2; tail -20 build/golden.check.log >&2; exit 2; }
fi
exec python3 tools/imgdiff.py golden
