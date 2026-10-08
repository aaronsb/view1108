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

A row may instead be `name | golden=<case>` (#29 slice f; ours): the figure is the render of that case of
tools/golden.sh's CASES, which must be drawn from the notebook's own reel (a playlist's: a reel it uses), so a figure
that one golden case already draws has one render and one check. It is rendered with the case's environment, reel and
arguments into the same build/figures/ file and packed like any figure, but golden.sh captures no nb-* case for it:
the golden case's capture covers the frame, and capture and check draw the case again and require the figure the reel
package carries (build/reels/<id>/notebook/figures/<name>.svg) to equal it, so a stale package fails.

Lines starting with # and blank lines in the block are skipped. Every figure the text names has a case, every case
is named in the text, and the text names no other image: outside fenced blocks every "![" must open an inline image
![alt](figures/<name>.svg) (alt text without "]"), and an HTML <img> or a reference definition ("[r]: ...", which
reference-style images need) is refused. web/src/reelpkg.js reelFigureRefs applies the same rules. The block stays in the packed notebook.md (copied byte for
byte), so a reader of the reel can see how each figure was made.

One render serves the golden gate and the package: `render` runs build/viewsvg once per case and writes
build/figures/<reel id>/<name>.svg (stdout) and .hdr (stderr, VIEW_HDR=1); tools/golden.sh captures those files as
the cases nb-<reel id>-<name>, and tools/pack.py packs the .svg as notebook/figures/<name>.svg. With them it writes
build/figures/<reel id>/cases.json, what the render was made from (stamp: the cases, each with the SHA-256 of its
reel's decks, and the SHA-256 of build/viewsvg); tools/pack.py refuses a reel whose stamp today differs (stale), so a
case, deck or driver changed since the render cannot be packed with the old figure.

  tools/notebook.py render       render every notebook's figures into build/figures/ (needs build/viewsvg,
                                 build/decks/ and build/scenes.json: tools/build.sh native)
  tools/notebook.py list         print each case as "<reel id> <name>", the notebooks in load order (not the
                                 golden=<case> rows, whose capture is the golden case's)
  tools/notebook.py golden-refs  print each golden=<case> row as "<reel id> <name> <case>"
"""
import hashlib, json, os, pathlib, re, shutil, subprocess, sys

R = pathlib.Path(__file__).resolve().parent.parent
D = R / "data"
FIGDIR = R / "build" / "figures"
NAME = re.compile(r"[a-z0-9][a-z0-9-]*$")
ENVS = ("VIEW_VIEW", "VIEW_TARGET", "VIEW_LABLV", "VIEW_SIM")
IMAGE = re.compile(r"!\[[^\]]*\]\(([^)\s]*)[^)]*\)")
REFDEF = re.compile(r" {0,3}\[[^\]]+\]:")
HTMLIMG = re.compile(r"<img\b", re.I)
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
        if HTMLIMG.search(ln):
            fail(where, f"an HTML <img> ({ln.strip()[:60]!r}): a notebook's images are ![alt](figures/<name>.svg)")
        if REFDEF.match(ln):
            fail(where, f"a reference definition ({ln.strip()[:60]!r}): a notebook's images are inline, "
                        "![alt](figures/<name>.svg)")
        if ln.count("![") != len(IMAGE.findall(ln)):
            fail(where, f"an image not written ![alt](figures/<name>.svg) ({ln.strip()[:60]!r}): no \"]\" in alt "
                        "text, no reference-style images")
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
    cases, golden = [], {}
    for ln in blocks[0] if blocks else []:
        if not ln.strip() or ln.lstrip().startswith("#"):
            continue
        f = [x.strip() for x in ln.split("|")]
        if len(f) == 2 and f[1].startswith("golden="):
            # A golden case's render as the figure (#29; ours): the case of that name in tools/golden.sh's CASES,
            # drawn from this notebook's own reel (a playlist's: one it uses). One render, one check: its capture is
            # the golden case's, and the packed figure must equal that case drawn again (golden.sh, capture and check).
            name, gc = f[0], f[1][len("golden="):]
            if not NAME.match(name):
                fail(where, f"figure case {name!r}: a name is [a-z0-9][a-z0-9-]*")
            if any(c[0] == name for c in cases):
                fail(where, f"figure case {name}: named twice")
            g = golden_cases().get(gc)
            if not g:
                fail(where, f"figure case {name}: golden={gc}: no such case in tools/golden.sh's CASES")
            if (kind == "scenario" and g[1] != rid) or (kind == "playlist" and g[1] not in uses):
                fail(where, f"figure case {name}: golden={gc} is drawn from reel {g[1]}, not this notebook's own")
            cases.append((name, g[0], g[1], g[2]))
            golden[name] = gc
            continue
        if len(f) != 4:
            fail(where, f"figure case {ln.strip()!r}: not four fields (name | environment | reel | arguments) "
                        "or two (name | golden=<case>)")
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
    return {"text": raw, "cases": cases, "golden": golden}


def golden_cases():
    """tools/golden.sh's CASES: {case name: ({environment}, reel, [arguments])}, read from the script itself."""
    t = (R / "tools" / "golden.sh").read_text()
    m = re.search(r"^CASES=\$\(cat <<'EOF'\n(.*?)\nEOF$", t, re.M | re.S)
    if not m:
        fail("tools/golden.sh", "no CASES block")
    out = {}
    for ln in m.group(1).split("\n"):
        f = [x.strip() for x in ln.split("|")]
        if len(f) == 4:
            out[f[0]] = (dict(e.split("=", 1) for e in f[1].split()), f[2], f[3].split())
    return out


def notebooks():
    """[(reel id, notebook)] for each reel that has one, in load order."""
    sits = scenes()
    return [(rid, nb) for rid, kind, src, uses in reels() for nb in [load(rid, kind, src, uses, sits)] if nb]


# What a figure may hold (#29 slice d, reviews of PR #69; ours): an ALLOWLIST, the elements and attributes
# tools/viewsvg.f90 writes (svg, g, line, circle, rect, text; their geometry, paint and font attributes), checked over
# every golden render and figure. The page shows a figure as an <img> from a data: URL, but a reader may open it as a
# page, so anything else is refused: a <! (doctype, entity, comment, CDATA) anywhere, a <? other than a leading XML
# declaration (after at most a byte order mark, which the page's TextDecoder drops), an element or attribute not on
# the list (a prefixed name among them: h:script, s:script, xlink:href but to #...), an href to anything but a
# fragment, a style, url( or attributeName, a javascript: URL, an entity other than the five XML ones and numeric
# references, and a tag the scanner cannot read whole. Whitespace is XML's: space, tab, CR, LF. The scan is linear
# (#79): each tag is read once, left to right, by patterns anchored where the last one ended, whose parts cannot
# trade characters, so a tag of 200K spaces costs what its length costs. The same rule is web/src/reelpkg.js
# reelSvgUnsafe, which the page applies when it unpacks a reel; the selftest runs both over every figure and golden
# render, so a kernel that writes a new element fails loudly, and times both on hostile tags.
SVG_ELEMENTS = {"svg", "g", "line", "circle", "rect", "text"}
SVG_ATTRS = {"xmlns", "xmlns:xlink", "width", "height", "viewBox", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r",
             "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-dasharray", "font-family", "font-size",
             "href", "xlink:href"}
SVG_NS = {"xmlns": "http://www.w3.org/2000/svg", "xmlns:xlink": "http://www.w3.org/1999/xlink"}
_TAG = re.compile(r"<([^<>]*)>")
# A tag's body (between < and >): its head (a / for a closing tag, then the element's name), its attributes, one at a
# time, and its end (whitespace, and in an opening tag one /).
_HEAD = re.compile(r"[ \t\r\n]*(?:(/)[ \t\r\n]*)?([^ \t\r\n/<>]+)")
_ATTR = re.compile(r"""[ \t\r\n]+([^ \t\r\n=/<>"']+)[ \t\r\n]*=[ \t\r\n]*(?:"([^"<>]*)"|'([^'<>]*)')""")
_END = re.compile(r"[ \t\r\n]*(?:/[ \t\r\n]*)?")
_WS = re.compile(r"[ \t\r\n]*")


def svg_unsafe(text):
    """Why the SVG text `text` may not be a figure (the allowlist above), or None."""
    s = re.sub(r"^\ufeff?[ \t\r\n]*<\?xml[^<>?]*\?>", "", text, count=1)
    if "<!" in s:
        return "a <! declaration (doctype, entity, comment or CDATA)"
    if "<?" in s:
        return "a <? processing instruction"
    for bad in ("javascript:", "url("):   # style and attributeName are off the attribute list
        if bad in s.lower():
            return f"{bad!r}"
    if re.search(r"&(?!(?:amp|lt|gt|quot|apos|#[0-9]{1,7}|#x[0-9a-fA-F]{1,6});)", s):
        return "an entity other than the XML ones"
    rest = _TAG.sub("", s)
    if "<" in rest or ">" in rest:
        return "a tag the scanner cannot read whole"
    for m in _TAG.finditer(s):
        body = m.group(1)
        t = _HEAD.match(body)
        if not t or t.group(2) not in SVG_ELEMENTS:
            return f"an element not on the list ({(t.group(2) if t else body)[:40]!r})"
        k = t.end()
        if t.group(1):
            if not _WS.fullmatch(body, k):
                return "a closing tag with attributes"
            continue
        while a := _ATTR.match(body, k):
            k = a.end()
            name, val = a.group(1), a.group(2) if a.group(2) is not None else a.group(3)
            if name not in SVG_ATTRS:
                return f"an attribute not on the list ({name!r})"
            if name in SVG_NS and val != SVG_NS[name]:
                return f"a namespace not SVG's ({val[:40]!r})"
            if name in ("href", "xlink:href") and not val.startswith("#"):
                return "an href to anything but #..."
        if not _END.fullmatch(body, k):
            left = body[k:].lstrip(" \t\r\n")[:40]
            return f"a tag the scanner cannot read whole ({left!r})"
    return None


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def stamp(nb):
    """What a notebook's figures are rendered from: the SHA-256 of build/viewsvg and each case with the SHA-256 of
    its reel's decks (build/decks/<reel>.txt's files, in order)."""
    def decks(reel):
        lst = R / "build" / "decks" / f"{reel}.txt"
        return hashlib.sha256(b"".join(sha(R / f).encode() for f in lst.read_text().split())).hexdigest()
    return {"viewsvg": sha(R / "build" / "viewsvg"),
            "cases": [[name, env, reel, args, decks(reel)] for name, env, reel, args in nb["cases"]],
            "golden": nb["golden"]}


def stale(rid, nb):
    """Why build/figures/<rid>/ is not the render of this notebook today, or None (tools/pack.py)."""
    f = FIGDIR / rid / "cases.json"
    if not f.is_file():
        return f"no {f.relative_to(R)}"
    was, now = json.loads(f.read_text()), stamp(nb)
    if was["viewsvg"] != now["viewsvg"]:
        return "build/viewsvg has changed since the figures were rendered"
    if was["cases"] != now["cases"] or was.get("golden") != now["golden"]:
        return "its figure cases or their reels' decks have changed since the figures were rendered"
    return None


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
            bad = svg_unsafe(pathlib.Path(f"{out}.svg").read_text(errors="replace"))
            if bad:
                fail(f"{rid} figure {name}", f"the render holds {bad}, which a figure may not")
            n += 1
        (FIGDIR / rid / "cases.json").write_text(json.dumps(stamp(nb), indent=1) + "\n")
    print(f"notebook: {n} figures rendered into build/figures/")


def check_svgs(paths):
    """Run the allowlist over SVG files and golden render captures (the SVG part, up to </svg>): print a line per
    file refused and return their number."""
    bad = 0
    for p in paths:
        t = pathlib.Path(p).read_text(errors="replace")
        k = t.find("</svg>")
        why = svg_unsafe(t[:k + 6] if k >= 0 else t)
        if why:
            print(f"{p}: {why}")
            bad += 1
    return bad


def main():
    if sys.argv[1:2] == ["check-svg"]:
        sys.exit(1 if check_svgs(sys.argv[2:]) else 0)
    if sys.argv[1:] == ["render"]:
        render()
    elif sys.argv[1:] == ["list"]:
        for rid, nb in notebooks():
            for c in nb["cases"]:
                if c[0] not in nb["golden"]:
                    print(rid, c[0])
    elif sys.argv[1:] == ["golden-refs"]:
        for rid, nb in notebooks():
            for name, gc in nb["golden"].items():
                print(rid, name, gc)
    else:
        sys.exit("usage: tools/notebook.py render|list|golden-refs")


if __name__ == "__main__":
    main()
