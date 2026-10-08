#!/usr/bin/env python3
"""Verify only what a change touches (#119).

  tools/affected.py                run the gates and slices the change can affect (make check-affected)
  tools/affected.py -n | --dry-run print the plan, run nothing
  tools/affected.py --paths a b    take these paths as the change (a test of the table)
  tools/affected.py --base REF     the change since REF (default origin/dev)
  tools/affected.py filter KIND AREAS     stdin lines -> those whose area is in AREAS (KIND golden, golden-nb, shots)
  tools/affected.py areas KIND            stdin lines -> "<areas><TAB><line>" (what a name falls under; "-" none)

The change is `git diff --name-only origin/dev...HEAD` plus the working tree and untracked files.  Each path takes
the first row of tools/affected.tsv that matches; a path no row matches runs everything.  The areas of a golden case or
a shot come from tools/areas.tsv (a name with no area runs only in a full run).  Each gate prints one line
(tools/gate.sh); VERBOSE=1 prints what the gates print.  A slice is for iteration; before a PR run every gate in full.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATES = ["build", "page", "selftest", "lab", "lint"]   # in run order; golden and shots follow
MAKE = ["make", "-s", "--no-print-directory"]
TARGET = {"selftest": "test", "lab": "lab-test"}


def rows(name):
    with open(os.path.join(ROOT, "tools", name)) as f:
        return [ln.rstrip("\n").split("\t") for ln in f if ln.strip() and not ln.startswith("#")]


def glob_re(g):
    s, i = "", 0
    while i < len(g):
        if g.startswith("**", i):
            s += ".*"; i += 2
        elif g[i] == "*":
            s += "[^/]*"; i += 1
        elif g[i] == "?":
            s += "[^/]"; i += 1
        else:
            s += re.escape(g[i]); i += 1
    return re.compile("^" + s + "$")


def git(*a):
    r = subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True)
    return [p for p in r.stdout.split("\n") if p] if r.returncode == 0 else None


def changed(ref="origin/dev"):
    base = git("diff", "--name-only", ref + "...HEAD")
    if base is None:
        sys.exit(f"affected: cannot diff against {ref} (git fetch origin)")
    return sorted(set(base + (git("diff", "--name-only", "HEAD") or []) + (git("ls-files", "-o", "--exclude-standard") or [])))


def plan(paths):
    table = [(glob_re(r[0]), r) for r in rows("affected.tsv")]
    gates, golden, shots, why = set(), set(), set(), []
    for p in paths:
        hit = next((r for g, r in table if g.match(p)), None)
        if hit is None:
            gates.add("all"); golden.add("all"); shots.add("all")
            why.append(f"{p}: no row in tools/affected.tsv, so everything")
            continue
        _, gs, gl, sh = (hit + ["-"] * 4)[:4]
        gates |= set(gs.split(",")) - {"-"}
        golden |= set(gl.split(",")) - {"-"}
        shots |= set(sh.split(",")) - {"-"}
        why.append(f"{p}: row {hit[0]}")
    if "all" in gates:
        gates = {"build", "lab", "lint"}
    if "build" in gates:
        gates -= {"page", "selftest"}   # build covers the page and the selftest
    return gates, golden, shots, why


def areas_of(kind, name, reel=None):
    extra = {reel.split("-")[0]} if reel else set()
    for kd, rx, area in rows("areas.tsv"):
        if kd == kind and re.search(rx, name):
            return {area} | extra
    return extra


def line_areas(kind, line):
    if kind == "golden":                     # NAME | env | reel | args
        f = [x.strip() for x in line.split("|")]
        return areas_of("golden", f[0], f[2])
    if kind == "golden-nb":                  # <reel> <figure>
        f = line.split()
        return areas_of("golden", "nb-" + f[1], f[0]) | {"notebook"}
    return areas_of("shots", line.split()[0])


def main():
    a = sys.argv[1:]
    if a[:1] == ["filter"]:
        want = {x for x in a[2].split(",") if x}
        for line in sys.stdin:
            if "all" in want or line_areas(a[1], line.rstrip("\n")) & want:
                sys.stdout.write(line)
        return 0
    if a[:1] == ["areas"]:
        for line in sys.stdin:
            print(",".join(sorted(line_areas(a[1], line.rstrip("\n")))) or "-", line, sep="\t", end="")
        return 0
    dry = "-n" in a or "--dry-run" in a
    paths = a[a.index("--paths") + 1:] if "--paths" in a else changed(a[a.index("--base") + 1] if "--base" in a else "origin/dev")
    if not paths:
        print("affected: no change against origin/dev, nothing to verify")
        return 0
    gates, golden, shots, why = plan(paths)
    full = lambda s: "all" in s
    show = lambda s: "none" if not s else "all" if full(s) else ",".join(sorted(s))
    print(f"affected: {len(paths)} path(s) -> gates {','.join(g for g in GATES if g in gates) or 'none'}; golden {show(golden)}; shots {show(shots)}")
    if dry or "-v" in a:
        for w in why[:12]:
            print("  " + w)
        if len(why) > 12:
            print(f"  ... {len(why) - 12} more")
    if dry:
        return 0
    cmds = [(g, MAKE + [TARGET.get(g, g)]) for g in GATES if g in gates]
    if golden:
        cmds.append(("golden", MAKE + ["golden-check"] + ([] if full(golden) else ["AREA=" + ",".join(sorted(golden))])))
    if shots:
        cmds.append(("shots", MAKE + ["shots"] + ([] if full(shots) else ["AREA=" + ",".join(sorted(shots))])))
    bad, built = 0, True
    for name, c in cmds:
        if not built and name in ("golden", "shots"):
            print(f"SKIP  {name:<14} (the build or page failed)")
            bad += 1
            continue
        if subprocess.run(c, cwd=ROOT).returncode:
            bad += 1
            if name in ("build", "page"):
                built = False
    tail = "" if full(golden) and full(shots) else "; golden/shots are a slice, not the full set: run every gate in full before a PR"
    print(f"check-affected: {len(cmds) - bad} of {len(cmds)} gate(s) passed{tail}")
    return 1 if bad else 0


sys.stdout.reconfigure(line_buffering=True)
sys.exit(main())
