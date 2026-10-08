#!/usr/bin/env python3
"""Scenario notebooks (#29 slice c): each reel's notebook source, its figure cases, and the one render of each figure.

A reel's notebook is Markdown, notebook/notebook.md in the reel's source folder: data/missions/<mission>/<scenario
file stem>/ for a scenario reel, data/reels/<id>/ for a playlist reel (the folder that holds its run.scn). Nothing
else is kept in notebook/: its figures are renders, never stored. A figure is named in the text as a Markdown image
whose path is figures/<name>.svg, and made by the case of that name in the notebook's one fenced block with the info
string `figures`, one case per line in tools/golden.sh's CASES columns (ours):

    ```figures
    # name     | environment  | reel             | viewsvg arguments
    earthrise  |              | apollo11-asflown | 1
    descent    | VIEW_LABLV=2 | apollo11-asflown | 5 369600
    ```

  name          [a-z0-9][a-z0-9-]*, the figure's file name (figures/<name>.svg); unique in the notebook
  environment   VIEW_VIEW, VIEW_TARGET, VIEW_LABLV, VIEW_SIM as KEY=integer (build/viewsvg's in_view, in_target,
                in_lablv, the engine run), or blank
  reel          the scenario reel whose decks are loaded (VIEW_REEL): a scenario reel's notebook names its own reel,
                a playlist's one of the reels it uses
  arguments     build/viewsvg's: situation (its id in that reel), then GET, yaw, pitch, roll, fov, flags, each a
                number or '-' (the situation's default)

Lines starting with # and blank lines in the block are skipped. Every figure the text names has a case, every case
is named in the text, and the text names no other image. The block stays in the packed notebook.md (copied byte for
byte), so a reader of the reel can see how each figure was made.

One render serves the golden gate and the package: `render` runs build/viewsvg once per case and writes
build/figures/<reel id>/<name>.svg (stdout) and .hdr (stderr, VIEW_HDR=1); tools/golden.sh captures those files as
the cases nb-<reel id>-<name>, and tools/pack.py packs the .svg as notebook/figures/<name>.svg.

  tools/notebook.py render       render every notebook's figures into build/figures/ (needs build/viewsvg,
                                 build/decks/ and build/scenes.json: tools/build.sh native)
  tools/notebook.py list         print each case as "<reel id> <name>", the notebooks in load order
"""
import json, os, pathlib, re, shutil, subprocess, sys

R = pathlib.Path(__file__).resolve().parent.parent
D = R / "data"
FIGDIR = R / "build" / "figures"
NAME = re.compile(r"[a-z0-9][a-z0-9-]*$")
ENVS = ("VIEW_VIEW", "VIEW_TARGET", "VIEW_LABLV", "VIEW_SIM")
IMAGE = re.compile(r"!\[[^\]]*\]\(([^)\s]*)[^)]*\)")
NUM = re.compile(r"(-|[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?)$")


def fail(where, why):
    sys.exit(f"notebook: {where}: {why}")


def reels():
    """The reels in load order (tools/pack.py's): [(id, kind, source folder, uses or None)], uses read from build/page/
    for a playlist."""
    out = []
    for mdir in sorted(p for p in (D / "missions").iterdir() if p.is_dir()):
        for sfile in sorted(p for p in mdir.glob("*.scn") if p.name != "mission.scn"):
            out.append((f"{mdir.name}-{sfile.stem}", "scenario", mdir / sfile.stem, None))
    for rdeck in sorted((D / "reels").glob("*/run.scn")):
        rid = rdeck.parent.name
        pfile = R / "build" / "page" / f"{rid}.json"
        uses = list(dict.fromkeys(sh["reel"] for sh in json.loads(pfile.read_text())["shots"])) if pfile.is_file() else []
        out.append((rid, "playlist", rdeck.parent, uses))
    return out


def prose(text, where="notebook.md"):
    """The notebook's lines outside fenced blocks, and its `figures` blocks' lines: (prose lines, [block lines])."""
    lines, blocks, fence = [], [], None
    for ln in text.split("\n"):
        if fence is None and ln.startswith("```"):
            fence = ln[3:].strip()
            if fence == "figures":
                blocks.append([])
        elif fence is not None and ln.startswith("```"):
            fence = None
        elif fence == "figures":
            blocks[-1].append(ln)
        elif fence is None:
            lines.append(ln)
    if fence is not None:
        fail(where, "a fenced block is not closed")
    return lines, blocks


def refs(text, where="notebook.md"):
    """The figure names the text's images name, in order of first use (outside fenced blocks); an image naming
    anything but figures/<name>.svg is refused."""
    out = []
    for ln in prose(text, where)[0]:
        for path in IMAGE.findall(ln):
            m = re.fullmatch(r"figures/(.+)\.svg", path)
            if not m or not NAME.match(m.group(1)):
                fail(where, f"an image {path!r}: a notebook's images are figures/<name>.svg")
            if m.group(1) not in out:
                out.append(m.group(1))
    return out


def scenes():
    p = R / "build" / "scenes.json"
    if not p.is_file():
        fail(str(p.relative_to(R)), "missing (tools/gen_data.py writes it first)")
    return {r["id"]: set(r["scenes"]) for r in json.loads(p.read_text())["reels"]}


def load(rid, kind, src, uses, sits=None):
    """A reel's notebook: None, or {"text": bytes, "cases": [(name, {env}, reel, [args])]} in the block's order,
    checked."""
    nd = src / "notebook"
    if not nd.exists():
        return None
    where = str((nd / "notebook.md").relative_to(R))
    extra = sorted(str(p.relative_to(R)) for p in nd.rglob("*") if p.name != "notebook.md" or p.parent != nd)
    if extra:
        fail(where, f"notebook/ holds {', '.join(extra)}: only notebook.md (figures are renders, never stored)")
    if not (nd / "notebook.md").is_file():
        fail(where, "missing (notebook/ holds nothing else)")
    raw = (nd / "notebook.md").read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        fail(where, f"not UTF-8 ({e})")
    blocks = prose(text, where)[1]
    if len(blocks) > 1:
        fail(where, f"{len(blocks)} figures blocks, not one")
    sits = scenes() if sits is None else sits
    cases = []
    for ln in blocks[0] if blocks else []:
        if not ln.strip() or ln.lstrip().startswith("#"):
            continue
        f = [x.strip() for x in ln.split("|")]
        if len(f) != 4:
            fail(where, f"figure case {ln.strip()!r}: not four fields (name | environment | reel | arguments)")
        name, envs, reel, args = f[0], f[1].split(), f[2], f[3].split()
        if not NAME.match(name):
            fail(where, f"figure case {name!r}: a name is [a-z0-9][a-z0-9-]*")
        if any(c[0] == name for c in cases):
            fail(where, f"figure case {name}: named twice")
        env = {}
        for e in envs:
            k, _, v = e.partition("=")
            if k not in ENVS or not re.fullmatch(r"\d+", v) or k in env:
                fail(where, f"figure case {name}: environment {e!r}: one each of {', '.join(ENVS)}, =integer")
            env[k] = v
        if kind == "scenario" and reel != rid:
            fail(where, f"figure case {name}: reel {reel}: a scenario reel's notebook draws from its own reel, {rid}")
        if kind == "playlist" and reel not in uses:
            fail(where, f"figure case {name}: reel {reel} is not one the playlist uses ({', '.join(uses)})")
        if not 1 <= len(args) <= 7 or not all(NUM.match(a) for a in args):
            fail(where, f"figure case {name}: arguments {f[3]!r}: a situation, then up to six numbers or '-'")
        if not re.fullmatch(r"\d+", args[0]) or int(args[0]) not in sits.get(reel, ()):
            fail(where, f"figure case {name}: {reel} has no situation {args[0]}")
        cases.append((name, env, reel, args))
    named = refs(text, where)
    have = [c[0] for c in cases]
    for n in named:
        if n not in have:
            fail(where, f"the text names figures/{n}.svg, which has no case in the figures block")
    for n in have:
        if n not in named:
            fail(where, f"figure case {n} is not named in the text (an image figures/{n}.svg)")
    return {"text": raw, "cases": cases}


def notebooks():
    """[(reel id, notebook)] for each reel that has one, in load order."""
    sits = scenes()
    return [(rid, nb) for rid, kind, src, uses in reels() for nb in [load(rid, kind, src, uses, sits)] if nb]


def render():
    exe = R / "build" / "viewsvg"
    if not exe.is_file():
        fail(str(exe.relative_to(R)), "missing (tools/build.sh native builds it)")
    if FIGDIR.exists():
        shutil.rmtree(FIGDIR)
    base = {k: v for k, v in os.environ.items() if not k.startswith("VIEW_")}
    n = 0
    for rid, nb in notebooks():
        (FIGDIR / rid).mkdir(parents=True)
        for name, env, reel, args in nb["cases"]:
            out = FIGDIR / rid / name
            with open(f"{out}.svg", "wb") as so, open(f"{out}.hdr", "wb") as se:
                r = subprocess.run([str(exe), *args], cwd=R, stdout=so, stderr=se,
                                   env={**base, "VIEW_HDR": "1", "VIEW_REEL": reel, **env})
            if r.returncode:
                fail(f"{rid} figure {name}", f"build/viewsvg exited {r.returncode} (see {out}.hdr)")
            n += 1
    print(f"notebook: {n} figures rendered into build/figures/")


def main():
    if sys.argv[1:] == ["render"]:
        render()
    elif sys.argv[1:] == ["list"]:
        for rid, nb in notebooks():
            for c in nb["cases"]:
                print(rid, c[0])
    else:
        sys.exit("usage: tools/notebook.py render|list")


if __name__ == "__main__":
    main()
