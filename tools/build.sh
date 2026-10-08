#!/usr/bin/env bash
# Full build: Fortran -> LLVM IR (LFortran, one file at a time) -> wasm32 objects (clang)
#             -> wasm (wasm-ld) -> optimised wasm (wasm-opt) -> JS fallback (wasm2js)
#             -> native driver (gfortran) -> notebook figures -> reel packages
#             -> single-file page (if the template exists) -> selftest.
# Needs lfortran, clang, wasm-ld, wasm-opt, wasm2js, python3, node; npm for the optional machine room.
# Set LF_BIN if the tools are not on PATH (e.g. LF_BIN=$HOME/lf/bin).
#
#   tools/build.sh          full build
#   tools/build.sh native   native SVG driver only (gfortran): build/viewsvg
set -euo pipefail
cd "$(dirname "$0")/.."
B="${LF_BIN:+$LF_BIN/}"
mkdir -p build

python3 tools/gen_data.py
python3 tools/gen_symbols.py || echo "gen_symbols failed; the page builds without the Source tab's symbols" >&2

# The kernel's elements: every fixed-form file in src/ but the generated BLOCK
# DATA files, DATA (see the header of src/vdrive.f).  A new element needs no
# change here.
DATA="viewdata vdvoc"
ELEMS=""
for f in src/*.f; do
  e=$(basename "$f" .f); case " $DATA " in *" $e "*) ;; *) ELEMS="$ELEMS $e" ;; esac
done

native() {
  local objs=""
  for e in $ELEMS $DATA; do
    gfortran -O2 -std=legacy -Isrc -c src/$e.f -o build/${e}_native.o
    objs="$objs build/${e}_native.o"
  done
  # The run-table dump (VIEW_DUMP=1) for the golden gate: native driver only, not the kernel.
  gfortran -O2 -std=legacy -Isrc -c tools/vdump.f -o build/vdump_native.o
  # The engine's tape as a deck (VIEW_TAPEW=1), for the tape round trip: native driver only.
  gfortran -O2 -std=legacy -Isrc -c tools/vtape.f -o build/vtape_native.o
  gfortran -O2 -ffree-line-length-none tools/viewsvg.f90 $objs build/vdump_native.o \
    build/vtape_native.o -o build/viewsvg
  rm -f viewsvg*.mod
  echo "native: build/viewsvg"
}
if [ "${1:-}" = native ]; then native; exit 0; fi

EXPORTS="memory view_init view_frame sim_run in_get in_yaw in_pitch in_roll in_fov in_flags in_src in_view in_target in_lablv out_terise
         vbuf nvec sbuf nstar lbuf nlab hdr tbuf ntxt tchr nchr
         deck_open deck_card deck_file deck_close deck_sum in_card out_dkerr out_dkcrd out_dkwrn out_dksum"
# No --fast: LFortran would optimise for the host (x86 vectors, i64 overflow
# checks that need __multi3).  clang optimises the IR for wasm32 instead.
LF="--no-array-bounds-checking"
# The kernel is period code: implicit interfaces between its routines and
# sequence association (passing CEV(1,J) to a 3-vector dummy).
LFF="--fixed-form --implicit-interface --legacy-array-sections $LF"

# 1. Fortran to LLVM IR, one element at a time.  LFortran emits a native
#    target; strip it so llc can retarget.  COMMON blocks are emitted as strong
#    definitions in every file that names them; in every element but the BLOCK
#    DATA files they are made weak, so the BLOCK DATA initialisers win at link
#    time (and blocks they do not initialise link to one zeroed copy).
for e in $ELEMS $DATA; do
  (cd src && "${B}lfortran" $LFF --show-llvm $e.f) > build/$e.ll
done
"${B}lfortran" $LF --show-llvm src/shell.f90 > build/shell.ll
rm -f src/*.mod *.mod
for f in $ELEMS $DATA shell; do
  sed -i -e '/^target datalayout/d' -e '/^target triple/d' \
         -e '/^@/s/ common / /' \
         -e 's/"target-cpu"="[^"]*"//g' -e 's/"target-features"="[^"]*"//g' \
         -e 's/"tune-cpu"="[^"]*"//g' build/$f.ll
done
for e in $ELEMS shell; do
  sed -i -E 's/^(@__module_file_common_block_[A-Za-z0-9_]+) = (local_unnamed_addr )?global/\1 = weak \2global/' \
    build/$e.ll
done
# LFortran also emits its runtime helpers (_lcompilers_sin_f64 and the like)
# into every file that uses them; the copies are identical, so let the
# linker keep one.
for f in $ELEMS $DATA shell; do
  sed -i -E 's/^define (dso_local )?([^@]*@_lcompilers_)/define linkonce_odr \1\2/' build/$f.ll
done

# 2. IR to wasm32 objects, then link.  Math intrinsics stay as imports (env.*),
#    which the page satisfies with Math.sin, Math.acos, etc.  No saturating
#    float-to-int: wasm2js cannot lower it.
for f in $ELEMS $DATA shell; do
  "${B}clang" --target=wasm32-unknown-unknown -O2 -mbulk-memory -mno-nontrapping-fptoint \
    -Wno-override-module -c build/$f.ll -o build/$f.o
done
EXP=""; for e in $EXPORTS; do [ "$e" = memory ] || EXP="$EXP --export=$e"; done
OBJS=""; for e in $DATA; do OBJS="$OBJS build/$e.o"; done; for e in $ELEMS; do OBJS="$OBJS build/$e.o"; done
"${B}wasm-ld" --no-entry --allow-undefined $EXP -o build/view.wasm $OBJS build/shell.o

# 3. Optimise, and make a plain-JS fallback for browsers without WebAssembly.
"${B}wasm-opt" -O3 --disable-nontrapping-float-to-int build/view.wasm -o build/view.opt.wasm
"${B}wasm2js" -O2 build/view.opt.wasm -o build/view.wasm2js.mjs
python3 tools/wrap_fallback.py build/view.wasm2js.mjs build/fallback.js
# The native driver, then the scenario notebooks' figures with it (build/figures/, tools/notebook.py: the one render
# the golden gate captures and the packer packs), then the reel packages (build/reels/), each naming this kernel
# build by its hash.  A reel whose notebook names figures needs gfortran.
if command -v gfortran >/dev/null; then native; python3 tools/notebook.py render
else rm -rf build/figures; echo "no gfortran: no native driver and no notebook figures" >&2; fi
python3 tools/pack.py

# 4. The machine room (web/lab, TypeScript + three.js) -> build/lab.js, with the esbuild pinned in its
#    package-lock.json.  Optional: without npm, the network or a working bundle the page builds without the Room.
lab() {
  local L=web/lab
  command -v npm >/dev/null || { echo "no npm" >&2; return 1; }
  if [ ! -d $L/node_modules ] || [ $L/package-lock.json -nt $L/node_modules/.package-lock.json ]; then
    npm --prefix $L ci --ignore-scripts --no-audit --no-fund || return 1
  fi
  npm --prefix $L run --silent build
}
rm -f build/lab.js
lab || { rm -f build/lab.js; echo "lab: not built; the page builds without the Room (see web/lab/README.md)" >&2; }

# 5. Page (when the template is there), selftest.
if [ -f web/page.template.html ]; then python3 tools/photo_pack.py; python3 tools/assemble.py; fi
node tools/selftest.mjs
