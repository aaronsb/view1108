#!/usr/bin/env python3
"""Image comparison with a similarity score (#103): the engine of `make golden-diff` and `make shots-check`.

  tools/imgdiff.py golden            build/golden vs build/golden.new -> build/golden.diff/
  tools/imgdiff.py shots [--only G]  build/shots vs build/shots-baseline -> build/shots-diff/

Score of a case = 100 - changed pixels / total pixels * 100, after the fuzz (a colour distance under FUZZ percent
counts as equal).  100 is identical.  A score at or above the pass score auto-passes: listed in the report and
notice.json with its score, never looked at.  Below it, the case is in the verification queue (notice.json
"queue", the report's first section, with its before|after|diff montage); the exit status is 1 only when the
queue is not empty.  A changed non-render file, an added or removed case, and a differing image size are queued.

Tools: ImageMagick (magick, compare) and rsvg-convert.  Output is deterministic (sorted, no timestamps).
Settings come from the environment (the Makefile gives the defaults): FUZZ, GOLDEN_PASS_SCORE, SHOTS_PASS_SCORE,
SHOTS_UNSTABLE_SCORE (the pass score of the shots that are not byte-stable).
"""
import base64, difflib, fnmatch, html, json, os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FUZZ = float(os.environ.get("FUZZ", "2"))
SVG_W = 880                       # fixed render width; height follows the viewBox (880x850), black background
UNSTABLE = ("boot", "room-drive-row-demo")   # shots that are not byte-stable (CLAUDE.md)


def run(*cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def compare(a, b, diff_png):
    """(changed, total, score) of two PNGs; writes the diff image.  Different sizes: (None, None, 0)."""
    ia = run("magick", "identify", "-format", "%w %h", str(a)).stdout.split()
    ib = run("magick", "identify", "-format", "%w %h", str(b)).stdout.split()
    if ia != ib or len(ia) != 2:
        return None, None, 0.0
    total = int(ia[0]) * int(ia[1])
    r = run("compare", "-metric", "AE", "-fuzz", f"{FUZZ}%", str(a), str(b), str(diff_png))
    if r.returncode > 1:
        sys.exit(f"compare failed: {r.stderr.strip()}")
    changed = int(float(r.stderr.split()[0]))
    return changed, total, round(100.0 - 100.0 * changed / total, 4)


def montage(a, b, diff, out):
    r = run("magick", "montage", str(a), str(b), str(diff), "-tile", "3x1", "-geometry", "+4+4",
            "-background", "#333333", str(out))
    if r.returncode:
        sys.exit(f"montage failed: {r.stderr.strip()}")


def case_png(svg_text, path):
    r = subprocess.run(["rsvg-convert", "-w", str(SVG_W), "-b", "black", "-o", str(path)],
                       input=svg_text.encode(), capture_output=True)
    return r.returncode == 0


def split_render(text):
    """A render capture: the SVG up to </svg>, then the hdr words."""
    i = text.find("</svg>")
    if i < 0:
        return text, ""
    j = text.find("\n", i)
    j = len(text) if j < 0 else j + 1
    return text[:j], text[j:]


def hdr_words(txt):
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"^hdr\((\d+)\) =\s*(.*)$", txt, re.M)}


def nvec(svg):
    m = re.search(r"\bnvec\s+(\d+)", svg)
    return int(m.group(1)) if m else None


def files_of(d):
    return sorted(str(p.relative_to(d)) for p in d.rglob("*") if p.is_file())


def b64(p):
    return "data:image/png;base64," + base64.b64encode(Path(p).read_bytes()).decode()


def pct(score):
    return round(100.0 - score, 4)


def sc(c):
    return c["score"] if c["score"] is not None else "n/a"


def write_reports(outdir, title, pass_score, cases, extra_head=""):
    """cases: dicts with name, status (verify|autopass), score (or None), note, montage (path under build/ or None)."""
    queue = [c for c in cases if c["status"] == "verify"]
    auto = [c for c in cases if c["status"] == "autopass"]
    notice = {"tool": title, "fuzz_pct": FUZZ, "pass_score": pass_score,
              "queue": [{"case": c["name"], "score": c["score"], "montage": c.get("montage"), "note": c["note"]}
                        for c in queue],
              "autopass": [{"case": c["name"], "score": c["score"]} for c in auto]}
    (outdir / "notice.json").write_text(json.dumps(notice, indent=1) + "\n")
    md = [f"# {title}", "", f"Score = 100 - changed-pixel percent (fuzz {FUZZ}%). Pass score {pass_score}. "
          f"Verification queue: {len(queue)}; auto-passed: {len(auto)}.", ""]
    if extra_head:
        md += [extra_head, ""]
    md += ["## Verification queue", ""]
    md += [f"- {c['name']}: score {sc(c)} - {c['note']}" + (f" ({c['montage']})" if c.get("montage") else "")
           for c in queue] or ["(empty)"]
    md += ["", "## Auto-passed", ""]
    md += [f"- {c['name']}: score {c['score']} - {c['note']}" for c in auto] or ["(none)"]
    (outdir / "report.md").write_text("\n".join(md) + "\n")
    h = ["<!doctype html><meta charset=utf-8><title>" + html.escape(title) + "</title>",
         "<style>body{background:#111;color:#ddd;font:14px monospace;margin:16px}img{max-width:100%;display:block}"
         "pre{background:#000;padding:8px;overflow:auto}h2{color:#fc6}.s{color:#f88}</style>",
         f"<h1>{html.escape(title)}</h1><p>Score = 100 - changed-pixel percent (fuzz {FUZZ}%). Pass score {pass_score}. "
         f"Verification queue: {len(queue)}; auto-passed: {len(auto)}.</p>"]
    if extra_head:
        h.append(f"<p>{html.escape(extra_head)}</p>")
    h.append("<h2>Verification queue</h2>")
    for c in queue:
        h.append(f"<h3>{html.escape(c['name'])} <span class=s>score {sc(c)}</span></h3><p>{html.escape(c['note'])}</p>")
        if c.get("montage"):
            h.append(f"<p>before | after | diff</p><img src=\"{b64(ROOT / 'build' / c['montage'])}\">")
        if c.get("excerpt"):
            h.append("<pre>" + html.escape(c["excerpt"]) + "</pre>")
    if not queue:
        h.append("<p>(empty)</p>")
    h.append("<h2>Auto-passed</h2><ul>")
    h += [f"<li>{html.escape(c['name'])}: score {c['score']} - {html.escape(c['note'])}</li>" for c in auto]
    h.append("</ul>")
    (outdir / "report.html").write_text("\n".join(h) + "\n")
    return queue, auto


def finish(tool, queue, auto, where):
    for c in auto:
        print(f"{tool}: auto-pass {c['name']} score {c['score']}")
    for c in queue:
        print(f"NOTICE {tool}: verify {c['name']} score {sc(c)}: {c['note']}")
    if queue:
        print(f"{tool}: FAIL: {len(queue)} case(s) in the verification queue ({len(auto)} auto-passed); see {where}",
              file=sys.stderr)
        return 1
    print(f"{tool}: PASS ({len(auto)} auto-passed, none to verify)")
    return 0


def golden():
    pass_score = float(os.environ.get("GOLDEN_PASS_SCORE", "99.5"))
    old, new = ROOT / "build/golden", ROOT / "build/golden.new"
    if not old.is_dir() or not new.is_dir():
        sys.exit("golden-diff: needs build/golden (make golden) and build/golden.new (make golden-check)")
    out = ROOT / "build/golden.diff"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    fo = {f for f in files_of(old) if f != "source.txt"}
    fn = {f for f in files_of(new) if f != "source.txt"}
    cases = []
    for f in sorted(fo - fn):
        cases.append({"name": f, "status": "verify", "score": None, "note": "removed"})
    for f in sorted(fn - fo):
        cases.append({"name": f, "status": "verify", "score": None, "note": "added"})
    for f in sorted(fo & fn):
        a, b = (old / f).read_bytes(), (new / f).read_bytes()
        if a == b:
            continue
        if f.startswith("render/"):
            cases.append(render_case(f, a.decode(), b.decode(), out, pass_score))
        else:
            ta, tb = a.decode(errors="replace").splitlines(), b.decode(errors="replace").splitlines()
            ex = "\n".join(list(difflib.unified_diff(ta, tb, "golden/" + f, "golden.new/" + f, lineterm="", n=1))[:40])
            cases.append({"name": f, "status": "verify", "score": None,
                          "note": "non-render file changed", "excerpt": ex})
    queue, auto = write_reports(out, "golden-diff", pass_score, cases,
                                f"{len(fo & fn)} files compared, {len(cases)} differ.")
    for c in queue:
        if c.get("excerpt"):
            print(f"--- {c['name']}\n{c['excerpt']}")
    return finish("golden-diff", queue, auto, "build/golden.diff/report.html")


def render_case(f, a, b, out, pass_score):
    name = f[len("render/"):-len(".txt")]
    sa, ha = split_render(a)
    sb, hb = split_render(b)
    wa, wb = hdr_words(ha), hdr_words(hb)
    words = [f"hdr({k}) {wa.get(k, '-')} -> {wb.get(k, '-')}"
             for k in sorted(set(wa) | set(wb), key=int) if wa.get(k) != wb.get(k)]
    na, nb = nvec(sa), nvec(sb)
    tmp = out / ".tmp"
    tmp.mkdir(exist_ok=True)
    pa, pb, pd = tmp / "a.png", tmp / "b.png", tmp / "d.png"
    if not (case_png(sa, pa) and case_png(sb, pb)):
        shutil.rmtree(tmp)
        return {"name": f, "status": "verify", "score": 0.0, "montage": None,
                "note": f"nvec {na} -> {nb}; an SVG does not render (the capture is not a valid frame)"}
    changed, total, score = compare(pa, pb, pd)
    note = f"nvec {na} -> {nb}" if na != nb else f"nvec {na}"
    note += f"; {changed} of {total} px changed ({pct(score)}%)" if changed is not None else "; image size changed"
    if words:
        note += "; " + "; ".join(words[:12]) + (f"; +{len(words) - 12} more" if len(words) > 12 else "")
    mont = None
    if changed is not None and (changed or words):
        mont = f"golden.diff/{name}.png"
        montage(pa, pb, pd, out / f"{name}.png")
    # the hdr words are part of the case: a changed word with the same picture still scores 100 but is reported
    status = "autopass" if score >= pass_score else "verify"
    shutil.rmtree(tmp)
    return {"name": f, "status": status, "score": score, "note": note, "montage": mont}


def shots(only):
    base_pass = float(os.environ.get("SHOTS_PASS_SCORE", "99.5"))
    unstable_pass = float(os.environ.get("SHOTS_UNSTABLE_SCORE", "90"))
    cur, base = ROOT / "build/shots", ROOT / "build/shots-baseline"
    out = ROOT / "build/shots-diff"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    pats = [p for p in (only or "").split(",") if p]
    cases, missing = [], []
    for p in sorted(cur.glob("*.png")):
        n = p.stem
        if pats and not any(fnmatch.fnmatch(n, g) for g in pats):
            continue
        bp = base / p.name
        if not bp.exists():
            missing.append(n)
            continue
        ps = unstable_pass if n in UNSTABLE else base_pass
        dpng = out / f"_d_{n}.png"
        changed, total, score = compare(bp, p, dpng)
        if changed == 0:
            dpng.unlink()
            continue
        if changed is None:
            note, mont = "image size changed", None
        else:
            note = f"{changed} of {total} px changed ({pct(score)}%)"
            montage(bp, p, dpng, out / f"{n}.png")
            mont = f"shots-diff/{n}.png"
        dpng.unlink(missing_ok=True)
        if n in UNSTABLE:
            note += f"; not byte-stable, pass score {ps}"
        cases.append({"name": n, "status": "autopass" if score >= ps else "verify", "score": score,
                      "note": note, "montage": mont})
    for n in missing:
        print(f"shots-check: no baseline for {n} (make shots-baseline); not compared")
    queue, auto = write_reports(out, "shots-check", base_pass, cases,
                                f"{len(missing)} shot(s) without a baseline: {', '.join(missing) or 'none'}.")
    return finish("shots-check", queue, auto, "build/shots-diff/report.html")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "golden":
        sys.exit(golden())
    if len(sys.argv) >= 2 and sys.argv[1] == "shots":
        o = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else ""
        sys.exit(shots(o))
    sys.exit(__doc__)
