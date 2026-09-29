#!/usr/bin/env bash
# Full build: Fortran -> LLVM IR (LFortran, one file at a time) -> wasm32 objects (clang)
#             -> wasm (wasm-ld) -> optimised wasm (wasm-opt) -> JS fallback (wasm2js)
#             -> single-file page (if the template exists) -> selftest.
# Needs lfortran, clang, wasm-ld, wasm-opt, wasm2js, python3, node.
# Set LF_BIN if the tools are not on PATH (e.g. LF_BIN=$HOME/lf/bin).
#
#   tools/build.sh          full build
#   tools/build.sh native   native SVG driver only (gfortran): build/viewsvg
set -euo pipefail
cd "$(dirname "$0")/.."
B="${LF_BIN:+$LF_BIN/}"
mkdir -p build

python3 tools/gen_data.py

native() {
  gfortran -O2 -std=legacy -Isrc -c src/view.f -o build/view_native.o
  gfortran -O2 -std=legacy -Isrc -c src/viewdata.f -o build/viewdata_native.o
  gfortran -O2 -ffree-line-length-none tools/viewsvg.f90 \
    build/view_native.o build/viewdata_native.o -o build/viewsvg
  rm -f viewsvg*.mod
  echo "native: build/viewsvg"
}
if [ "${1:-}" = native ]; then native; exit 0; fi

EXPORTS="memory view_init view_frame in_get in_yaw in_pitch in_roll in_fov in_flags
         vbuf nvec sbuf nstar lbuf nlab hdr"
# No --fast: LFortran would optimise for the host (x86 vectors, i64 overflow
# checks that need __multi3).  clang optimises the IR for wasm32 instead.
LF="--no-array-bounds-checking"
# The kernel is period code: implicit interfaces between its routines and
# sequence association (passing CEV(1,J) to a 3-vector dummy).
LFF="--fixed-form --implicit-interface --legacy-array-sections $LF"

# 1. Fortran to LLVM IR.  LFortran emits a native target; strip it so llc can
#    retarget.  COMMON blocks are emitted as strong definitions in every file
#    that names them; outside the BLOCK DATA file they are made weak so the
#    BLOCK DATA initialisers win at link time.
(cd src && "${B}lfortran" $LFF --show-llvm view.f) > build/view.ll
(cd src && "${B}lfortran" $LFF --show-llvm viewdata.f) > build/viewdata.ll
"${B}lfortran" $LF --show-llvm src/shell.f90 > build/shell.ll
rm -f src/*.mod *.mod
for f in view viewdata shell; do
  sed -i -e '/^target datalayout/d' -e '/^target triple/d' \
         -e '/^@/s/ common / /' \
         -e 's/"target-cpu"="[^"]*"//g' -e 's/"target-features"="[^"]*"//g' \
         -e 's/"tune-cpu"="[^"]*"//g' build/$f.ll
done
sed -i -E 's/^(@__module_file_common_block_[A-Za-z0-9_]+) = (local_unnamed_addr )?global/\1 = weak \2global/' \
  build/view.ll

# 2. IR to wasm32 objects, then link.  Math intrinsics stay as imports (env.*),
#    which the page satisfies with Math.sin, Math.acos, etc.  No saturating
#    float-to-int: wasm2js cannot lower it.
for f in view viewdata shell; do
  "${B}clang" --target=wasm32-unknown-unknown -O2 -mbulk-memory -mno-nontrapping-fptoint \
    -Wno-override-module -c build/$f.ll -o build/$f.o
done
EXP=""; for e in $EXPORTS; do [ "$e" = memory ] || EXP="$EXP --export=$e"; done
"${B}wasm-ld" --no-entry --allow-undefined $EXP -o build/view.wasm \
  build/viewdata.o build/view.o build/shell.o

# 3. Optimise, and make a plain-JS fallback for browsers without WebAssembly.
"${B}wasm-opt" -O3 --disable-nontrapping-float-to-int build/view.wasm -o build/view.opt.wasm
"${B}wasm2js" -O2 build/view.opt.wasm -o build/view.wasm2js.mjs
python3 tools/wrap_fallback.py build/view.wasm2js.mjs build/fallback.js

# 4. Page (when the template is there), native driver, selftest.
if [ -f web/page.template.html ]; then python3 tools/assemble.py; fi
if command -v gfortran >/dev/null; then native; fi
node tools/selftest.mjs
