#!/usr/bin/env python3
"""Fusion's photographs as photo events (#75): data/photos.tsv, read and checked for tools/pack.py and tools/notebook.py.

A row with a situation (`sit`) is a photo event of its scenario reel (`reel`): tools/pack.py packs its image, the
reduced copy media/<frame in lower case>.jpg in the reel's source folder (tools/photo_pack.py makes it), as the media
member media/<file>, and the row as an entry of the reel's page.json `photos` (below) and a photo entry of its event
listing (tools/pack.py listing). A row without a situation is research, on no tape. The same rules are web/src/reelpkg.js
reelPhotosWrong, which the page applies when it unpacks a reel. The entry (ours):

  {"frame": "AS08-14-2383", "media": "media/as08-14-2383.jpg", "sit": 1,
   "get": 272919.7, "get_lo": null, "get_hi": null, "get_src": "...",   g.e.t. s, or a bracket; get or get_lo given
   "lens_mm": "250", "magazine": "14/B", "where": "CSM window 4 ...", "needs": "...",
   "fit": {"cam": [yaw, pitch, roll], "x": .., "y": .., "rot": .., "scale": ..} or null (not fitted),
   "note": "...", "credit": "NASA/JSC", "url": "https://..."}

fit, from the columns cam_yaw .. fit_scale (all or none): the pointing added to the situation's default look (deg),
the photograph's centre in plot degrees, its rotation (deg counterclockwise) and its scale (% of the lens's field on the
gate), our fit on the packed copy (web/src/fusion.js draws it); note is fit_note. The packed copy is turned to its
usual presentation already (the row's `turn`, applied by tools/photo_pack.py), so the entry carries no turn.
"""
import pathlib, re, sys

R = pathlib.Path(__file__).resolve().parent.parent
TSV = R / "data" / "photos.tsv"
FRAME = re.compile(r"[A-Z0-9][A-Z0-9-]*$")
FIT = ("cam_yaw", "cam_pitch", "cam_roll", "fit_x", "fit_y", "fit_rot", "fit_scale")
NUM = re.compile(r"[-+]?(\d+\.?\d*|\.\d+)$")


def fail(where, why):
    sys.exit(f"photos: {where}: {why}")


def rows(text=None):
    """data/photos.tsv (or `text` in its format) as [{column: text}], '#' lines skipped, the first other line the
    header."""
    lines = [ln for ln in (TSV.read_text(encoding="utf-8") if text is None else text).split("\n")
             if ln.strip() and not ln.startswith("#")]
    head = lines[0].split("\t")
    return [dict(zip(head, ln.split("\t") + [""] * (len(head) - len(ln.split("\t"))))) for ln in lines[1:]]


def media_file(frame):
    return f"{frame.lower()}.jpg"


def media_names(rid, text=None):
    """The media files reel `rid`'s photo events name (unchecked): {file}."""
    return {media_file(r["frame"]) for r in rows(text) if r["reel"] == rid and r["sit"].strip()}


def _num(where, key, v, need=False):
    v = v.strip()
    if not v:
        if need:
            fail(where, f"no {key}")
        return None
    if not NUM.fullmatch(v):
        fail(where, f"{key} {v!r} is not a number")
    return float(v)


def events(rid, sits, media, scenario_reels, text=None):
    """Reel `rid`'s photo events, its rows with a situation, as page.json `photos` entries in the table's order,
    checked: each row's reel a scenario reel (`scenario_reels`), its frame unique in the whole table (Fusion keys a
    photograph by its frame across reels: its remembered alignment, a photo= link), its situation one of the reel's
    (`sits`, ids), its packed copy in the reel's media (`media`, file names), a g.e.t. or a bracket (get_lo not after
    get_hi), its credit and an https source, its fit all numbers or none."""
    out, seen = [], set()
    for r in rows(text):
        where = f"data/photos.tsv {r['frame']}"
        if not FRAME.match(r["frame"]):
            fail(where, "a frame is [A-Z0-9][A-Z0-9-]*")
        if r["reel"] not in scenario_reels:
            fail(where, f"reel {r['reel']!r} is no scenario reel")
        if r["frame"] in seen:
            fail(where, "given twice")
        seen.add(r["frame"])
        if r["reel"] != rid or not r["sit"].strip():
            continue
        if not re.fullmatch(r"\d+", r["sit"].strip()) or int(r["sit"]) not in sits:
            fail(where, f"{rid} has no situation {r['sit'].strip()}")
        f = media_file(r["frame"])
        if f not in media:
            fail(where, f"no media/{f} in {rid}'s source folder (tools/photo_pack.py makes it)")
        get, lo, hi = (_num(where, k, r[k]) for k in ("get", "get_lo", "get_hi"))
        if get is None and lo is None:
            fail(where, "no g.e.t. (get) or bracket (get_lo)")
        if lo is not None and hi is not None and lo > hi:
            fail(where, f"its bracket runs backwards (get_lo {lo} after get_hi {hi})")
        if not r["credit"].strip() or not r["url"].startswith("https://"):
            fail(where, "no credit or https source URL (url)")
        given = [k for k in FIT if r.get(k, "").strip()]
        if given and len(given) != len(FIT):
            fail(where, f"a fit gives {', '.join(given)}, not all of {', '.join(FIT)}")
        fit = None
        if given:
            c = [_num(where, k, r[k], True) for k in FIT]
            if c[6] <= 0:
                fail(where, f"fit_scale {c[6]} is not above 0")
            fit = {"cam": c[0:3], "x": c[3], "y": c[4], "rot": c[5], "scale": c[6]}
        out.append({"frame": r["frame"], "media": f"media/{f}", "sit": int(r["sit"]), "get": get, "get_lo": lo,
                    "get_hi": hi, "get_src": r["get_src"], "lens_mm": r["lens_mm"], "magazine": r["magazine"],
                    "where": r["window_or_vehicle"], "needs": r["needs"], "fit": fit, "note": r.get("fit_note", ""),
                    "credit": r["credit"], "url": r["url"]})
    return out


def event_get(p):
    """A photo event's g.e.t. in the listing: its own, else its bracket's midpoint, else the bracket's start."""
    if p["get"] is not None:
        return p["get"]
    return (p["get_lo"] + p["get_hi"]) / 2 if p["get_hi"] is not None else p["get_lo"]
