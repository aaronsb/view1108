# Contributing to VIEW-1108

Thanks for your interest. VIEW-1108 is a FORTRAN reconstruction of VIEW, the Apollo-era UNIVAC 1108 window-view program, compiled to WebAssembly. Pull requests, bug reports, corrections and sources are all welcome.

## Build and test

The toolchain is LFortran 0.66, LLVM/clang 23 and binaryen 121 (conda-forge), plus gfortran, node and python3. The [README](README.md#build) has the one-line `micromamba` install.

```
make            # list targets
make build      # FORTRAN -> wasm -> web/view1108.html, then the self-test
make test       # headless self-test (wasm vs wasm2js fallback, every scene)
make lint       # kernel dialect check, compiler warnings, script syntax
make check      # render every scene natively with gfortran to build/check/
make shots      # scripted screenshots and headless checks into build/shots/ (needs chromium)
make serve      # http://localhost:8108/view1108.html  (make stop to end)
```

Before you open a pull request, `make lint` and `make build` should both pass.

## The sourcing rule

Every historical or technical claim, in code comments, docs, the page and commit messages, cites a source we hold or can link: a report page, a URL, a data file. The primary documents are in `reference/`; cite printed page numbers.

A claim without a source is written as conjecture ("our guess", "plausibly") or left out. Our own design choices are labelled as ours.

If you find a claim that is wrong or unsourced, open a "Historical source / correction" issue.

## Kernel dialect: FORTRAN V, with RESTOMOD fences

The kernel (`src/view.f`) is fixed-form FORTRAN in a FORTRAN V style: upper case, `DOUBLE PRECISION` and `INTEGER`, `COMMON` blocks, `BLOCK DATA`, `DO nn ... nn CONTINUE`, `SUBROUTINE` and `FUNCTION` only. Identifiers are at most 6 characters, and there is no `IMPLICIT NONE` (every variable is still declared). No modules, derived types, allocatables, pointers, recursion, array syntax or `END DO`. [CLAUDE.md](CLAUDE.md) and [docs/univac-1108.md](docs/univac-1108.md) give the full rules and their sources.

**Functional first.** Working output beats period purity. Code a 1969 programmer could not have written (a language feature, a data source, an algorithm, a memory budget the 1108 did not have) stays in, fenced so a reader can see the anachronism:

```
C     RESTOMOD: <why, and the year where known>
      ...one statement...

C     RESTOMOD BEGIN: <why>
      ...block...
C     RESTOMOD END
```

`make lint` enforces this: modern constructs are accepted only inside these markers.

Generated files (`src/viewdata.f`, `src/viewdims.inc`) come from `data/` via `make data`; edit the data or `tools/gen_data.py`, not the output.

## Pull requests

- Keep each commit focused on one change, with a message that says what and why.
- Cite sources for any historical claim in the change or the commit message.
- Describe what you checked: `make lint`, `make build`, and for visual changes `make check` or a screenshot.

By contributing you agree your work is released under the [MIT License](LICENSE). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
