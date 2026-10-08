#!/usr/bin/env python3
"""The reel packer (#26 slice 7): each scenario of data/missions/ and each playlist of data/reels/ as a
reel package.

A reel is one .tar.gz (build/reels/<id>.reel.tar.gz), manifest.json first. A scenario reel (kind
"scenario", <id> = <mission folder>-<scenario file stem>) then holds the mission's mission.scn and the
scenario's .scn, each copied byte for byte (the kernel's card reader reads them, src/vdeck.f;
tools/gen_data.py checks them), and page.json, the page's data for the scenario (its situations, its
mission, range zero and SPAN cards, its timeline; #26 slice 7d). Each scenario reel numbers its own
scenario and situations, and the page's kernel holds one at a time (#26 slice 7e). A playlist reel (kind
"playlist", <id> its folder under data/reels/; #26 slice 7e) holds its run.scn, byte for byte (the
kernel never reads it), and page.json, its REEL and SHOT cards as the playlist player reads them; its
manifest's `uses` lists the scenario reels its shots name, in their order of first use. tools/gen_data.py
writes each page.json as build/page/<id>.json and this copies it. A reel with a scenario notebook (#29; its source
notebook/notebook.md in data/missions/<mission>/<scenario file stem>/ or data/reels/<id>/, tools/notebook.py) also
holds notebook/notebook.md, byte for byte (type "notebook"), and each figure it names as notebook/figures/<name>.svg
(type "figure"), the SVG tools/notebook.py rendered into build/figures/<id>/<name>.svg, the same file the golden gate
captures (tools/golden.sh, case nb-<id>-<name>); tools/build.sh renders the figures before it packs. The reel's
photographs, media/<name>.jpg or .png in its source folder (raster only, each named by an attach block or a photo
event; #29 slice g, #75; tools/notebook.py reel_media), are packed byte for byte as media/<name>.jpg or .png (type
"media"), and a scenario reel's photo events (data/photos.tsv, tools/photos.py) as its page.json `photos`. The manifest names the kernel build the
reel is for, by the SHA-256 of build/view.opt.wasm, and never carries code (#26, 2026-10-06 decision). Packages are reproducible: USTAR members with mtime 0,
uid/gid 0, no user or group names, mode 0644, no directory entries; gzip with mtime 0 and no file
name: the same bytes again for a given Python and zlib (the selftest packs twice and compares). Writes:

  build/reels/<id>.reel.tar.gz   the package
  build/reels/<id>/              its members, unpacked (for reading)
  build/reels/index.json         the reels in load order (missions by folder, then scenarios by file
                                 name, as build/decks/reels.txt; then the playlists by folder): id,
                                 kind, title, mission (a scenario reel's), uses (a playlist's), file,
                                 sha256
  build/reels.js                 VIEW_REELS: each package base64, in that order, for the page
                                 (tools/assemble.py embeds it; web/src/reelpkg.js unpacks it)

  tools/pack.py [--out DIR]      write into DIR instead of build/ (the selftest packs twice and
                                 compares the bytes)
  tools/pack.py --stamp-native   record build/viewsvg.json: the SHA-256 of build/viewsvg and of the sources it was
                                 built from (tools/build.sh native, after it links the driver)
  tools/pack.py --needs-native   print why packing needs build/viewsvg (notebook figures, golden-case figures among
                                 them, a situation whose g.e.t. only the kernel resolves), one line each; nothing if
                                 none (tools/build.sh stops early without gfortran when there is any)

Reels in a package are per scenario (operator, 2026-10-07): a mission's second scenario would be a
second reel carrying its own copy of mission.scn.
"""
import base64, gzip, hashlib, io, json, os, pathlib, re, shutil, subprocess, sys, tarfile

import notebook
import photos

R = pathlib.Path(__file__).resolve().parent.parent
D = R / "data"
FORMAT = "view1108-reel/1"


def card_name(text, kind):
    """The NAME= of the first card of this kind (the cards' own text; gen_data.py checks it)."""
    m = re.search(rf'^{kind}\b.*?\bNAME="([^"]*)"', text, re.M)
    if not m:
        sys.exit(f"pack.py: no {kind} card with NAME=")
    return m.group(1)


def tar_gz(members):
    """members [(name, bytes)] as a reproducible .tar.gz."""
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.USTAR_FORMAT) as tf:
        for name, data in members:
            ti = tarfile.TarInfo(name)
            ti.size, ti.mtime, ti.mode, ti.uid, ti.gid, ti.uname, ti.gname = len(data), 0, 0o644, 0, 0, "", ""
            tf.addfile(ti, io.BytesIO(data))
    out = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=out, mtime=0, compresslevel=9) as gz:
        gz.write(raw.getvalue())
    return out.getvalue()


def notebook_members(rid, kind, src, uses, sits, photo_media=()):
    """The reel's notebook and media members and their manifest entries: ([(name, bytes)], [entry]), both empty
    without either. Each figure is build/figures/<rid>/<name>.svg as tools/notebook.py rendered it; `photo_media`, the
    media files the reel's photo events name."""
    nb = notebook.load(rid, kind, src, uses, sits, photo_media)
    if not nb:
        # No notebook: the reel's photographs are its photo events' alone.
        media = notebook.reel_media(src)
        notebook.media_unnamed(src, media, set(photo_media))
        return media_members(rid, media)
    why = notebook.stale(rid, nb)
    if why:
        sys.exit(f"pack.py: {rid}: build/figures/{rid}/ is stale: {why} (tools/notebook.py render)")
    members, entries = [("notebook/notebook.md", nb["text"])], [{"path": "notebook/notebook.md", "type": "notebook"}]
    for name, *_ in nb["cases"]:
        fig = R / "build" / "figures" / rid / f"{name}.svg"
        if not fig.is_file():
            sys.exit(f"pack.py: no {fig.relative_to(R)} (tools/notebook.py render writes it, with build/viewsvg)")
        path = f"notebook/figures/{name}.svg"
        if len(path) > 100:
            sys.exit(f"pack.py: {rid}: {path}: a member name longer than 100 characters (USTAR)")
        bad = notebook.svg_unsafe(fig.read_bytes().decode("utf-8", "replace"))
        if bad:
            sys.exit(f"pack.py: {rid}: {fig.relative_to(R)} holds {bad}, which a figure may not (tools/notebook.py svg_unsafe, the allowlist)")
        members.append((path, fig.read_bytes()))
        entries.append({"path": path, "type": "figure"})
    m, e = media_members(rid, nb["media"])
    return members + m, entries + e


def media_members(rid, media):
    """The reel's photographs (#29 slice g, #75): each file of media/, raster only and named by an attach or a photo
    event (tools/notebook.py checks both), byte for byte as media/<file>."""
    members, entries = [], []
    for name, data in media.items():
        path = f"media/{name}"
        if len(path) > 100:
            sys.exit(f"pack.py: {rid}: {path}: a member name longer than 100 characters (USTAR)")
        members.append((path, data))
        entries.append({"path": path, "type": "media"})
    return members, entries


# The event listing (#29 slice f, #73; ours): one list per scenario reel, generated here from the reel's own data and
# added to its packed page.json as `listing`, never typed by hand. The packed page.json is build/page/<id>.json
# (tools/gen_data.py: the reel's situations and its TIMELINE cards) with two keys added, `listing` and `quickviews`;
# the rest is what gen_data wrote. Each entry, in g.e.t. order (a situation before an event at the same g.e.t.;
# otherwise the situations in id order and the events in timeline order):
#   {"kind": "situation", "id": <its NAME=>, "name": <its TITLE=>, "get": s, "sit": <its id in the reel>,
#    "view": <its VIEW=>, "target": <its TARGET=>, "fov": <its default field, deg, or null: the recipe's own>}
#   {"kind": "event", "id": <the row's name as a slug; a name the timeline repeats adds @ and the row's g.e.t.,
#    [-]h:mm:ss[.hh], e.g. midcourse-correction-ignition@26:44:58.64>, "name": <the row's name>, "get": s,
#    "tl": <its KIND=>}
#   {"kind": "photo", "id": <its frame>, "name": <its frame>, "get": s, "sit": <its situation's id>}  (#75: a photo
#    event, page.json `photos`, tools/photos.py; its g.e.t. its own, else its bracket's midpoint, else the bracket's
#    start: tools/photos.py event_get)
# A situation's g.e.t. is its page.json `get` or, where its card's rule is the kernel's own (ERISE: the Earthrise
# search, src/traj.f ERFIND), hdr(1) of build/viewsvg at its defaults: the time view_init gives the page. At one g.e.t.
# situations come first, then events, then photo events, each in its own order. Picking a situation entry applies the
# situation's own view; an event entry moves the time; a photo entry opens Fusion at the photograph (web/src/fusion.js).
LIST_KINDS = ("situation", "event", "photo")


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "event"


def get_tag(g):
    """A g.e.t. as an id's suffix: [-]h:mm:ss, with hundredths where the row has them (10213.03 -> 2:50:13.03)."""
    cs = round(abs(g) * 100)
    h, m, s, f = cs // 360000, cs // 6000 % 60, cs // 100 % 60, cs % 100
    return f"{'-' if g < 0 else ''}{h}:{m:02d}:{s:02d}" + (f".{f:02d}".rstrip("0") if f else "")


# The native driver's own stamp (review of PR #86): build/viewsvg.json, written by tools/build.sh native, holds the
# SHA-256 of build/viewsvg and of the sources it is linked from. kernel_get refuses a driver that is not the one the
# stamp names, or whose sources have changed since, so a listing's g.e.t. never comes from a stale kernel.
NATIVE_SRC = ("src/*.f", "src/*.inc", "tools/viewsvg.f90", "tools/vdump.f", "tools/vtape.f")


def native_sources():
    h = hashlib.sha256()
    for f in sorted({p for pat in NATIVE_SRC for p in R.glob(pat)}):
        h.update(f.relative_to(R).as_posix().encode() + b"\0" + f.read_bytes() + b"\0")
    return h.hexdigest()


def stamp_native():
    exe = R / "build" / "viewsvg"
    (R / "build" / "viewsvg.json").write_text(json.dumps(
        {"viewsvg": hashlib.sha256(exe.read_bytes()).hexdigest(), "sources": native_sources()}) + "\n")


def native_stale():
    """Why build/viewsvg may not be used, or None."""
    exe, st = R / "build" / "viewsvg", R / "build" / "viewsvg.json"
    if not exe.is_file():
        return "no build/viewsvg (tools/build.sh native builds it)"
    if not st.is_file():
        return "no build/viewsvg.json (tools/build.sh native writes it)"
    was = json.loads(st.read_text())
    if was.get("viewsvg") != hashlib.sha256(exe.read_bytes()).hexdigest():
        return "build/viewsvg is not the driver build/viewsvg.json names"
    if was.get("sources") != native_sources():
        return "the kernel's or the driver's sources have changed since build/viewsvg was built"
    return None


def needs_native():
    """Why packing needs build/viewsvg: [reason], empty if it does not."""
    why = [f"{rid}: notebook figures" for rid, nb in notebook.notebooks() if nb["cases"]]
    for pf in sorted((R / "build" / "page").glob("*.json")):
        sits = json.loads(pf.read_text()).get("situations") or []
        why += [f"{pf.stem}: situation {s['name']}'s g.e.t. ({s['get_rule']})" for s in sits if s.get("get") is None]
    return why


def kernel_get(rid, sit):
    """The g.e.t. the kernel gives situation `sit` of reel `rid` at its defaults: build/viewsvg's hdr(1)."""
    exe = R / "build" / "viewsvg"
    bad = native_stale()
    if bad:
        sys.exit(f"pack.py: {rid} situation {sit}: its g.e.t. is the kernel's, and {bad}")
    env = {k: v for k, v in os.environ.items() if not k.startswith("VIEW_")}
    r = subprocess.run([str(exe), str(sit)], cwd=R, env={**env, "VIEW_HDR": "1", "VIEW_REEL": rid},
                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    m = re.search(r"^hdr\(1\) =\s*(\S+)", r.stderr, re.M)
    if r.returncode or not m:
        sys.exit(f"pack.py: {rid}: build/viewsvg {sit} gave no hdr(1) (exit {r.returncode})")
    return float(m.group(1))


def listing(rid, page):
    """Reel `rid`'s event listing from its page.json (above)."""
    sits, rows = [], []
    for s in page["situations"]:
        g = s["get"] if s["get"] is not None else kernel_get(rid, s["id"])
        sits.append({"kind": "situation", "id": s["name"], "name": s["title"], "get": g, "sit": s["id"],
                     "view": s["view"], "target": s["target"], "fov": s["fov"]})
    # An event's id is stable while its own row is: a name the timeline repeats takes its row's g.e.t., never a
    # position, so a row added elsewhere cannot move a quick view onto another event (review of PR #86). A name that
    # becomes repeated changes its id, and a quickviews.txt naming the old id is then refused, not silently moved.
    count = {}
    for g, kind, name in page["timeline"]["events"]:
        count[slug(name)] = count.get(slug(name), 0) + 1
    for g, kind, name in page["timeline"]["events"]:
        base = slug(name)
        rows.append({"kind": "event", "id": base if count[base] == 1 else f"{base}@{get_tag(g)}", "name": name,
                     "get": g, "tl": kind})
    shots = [{"kind": "photo", "id": p["frame"], "name": p["frame"], "get": photos.event_get(p), "sit": p["sit"]}
             for p in page.get("photos", [])]
    every = sits + rows + shots
    ids = [e["id"] for e in every]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        sys.exit(f"pack.py: {rid}: listing ids {', '.join(dup)} name two entries")
    rank = {k: n for n, k in enumerate(LIST_KINDS)}
    return [every[k] for k in sorted(range(len(every)), key=lambda k: (every[k]["get"], rank[every[k]["kind"]], k))]


# Quick views (#73; ours): the page's keys 1-9 for a scenario reel, each a shortcut to one entry of its listing (a
# situation's NAME or an event's id) that does what picking the entry does. They are a page feature, so they stay out
# of the kernel's run deck: the source is quickviews.txt in the reel's own source folder,
# data/missions/<mission>/<scenario file stem>/, beside its notebook/ (the reel's page-side material, which the card
# reader never reads). One line per key: the key 1-9, a space, the entry's id; '#' lines and blank lines skipped;
# gaps allowed. Without the file the first nine situations, in id order, take keys 1-9. Packed
# as page.json's `quickviews`, {"<key>": "<id>"}; a key or an id the reel does not have is refused here and by
# web/src/reelpkg.js readReel.
def quickviews(rid, src, entries):
    f = src / "quickviews.txt"
    ids = {e["id"] for e in entries}
    if not f.is_file():
        sits = sorted((e for e in entries if e["kind"] == "situation"), key=lambda e: e["sit"])
        return {str(k + 1): s["id"] for k, s in enumerate(sits[:9])}
    where, out = f.relative_to(R), {}
    for n, ln in enumerate(f.read_text(encoding="utf-8").split("\n"), 1):
        if not ln.strip() or ln.lstrip().startswith("#"):
            continue
        m = re.fullmatch(r"\s*([1-9])\s+(\S.*?)\s*", ln)
        if not m:
            sys.exit(f"pack.py: {where}:{n}: not '<key 1-9> <entry id>'")
        if m.group(1) in out:
            sys.exit(f"pack.py: {where}:{n}: key {m.group(1)} given twice")
        if m.group(2) not in ids:
            sys.exit(f"pack.py: {where}:{n}: {m.group(2)!r} is no entry of {rid}'s listing (a situation NAME or an event id)")
        out[m.group(1)] = m.group(2)
    return dict(sorted(out.items()))


def page_bytes(rid, src, pbytes, events):
    """A scenario reel's packed page.json: gen_data's, with its photo events (`events`, tools/photos.py), listing and
    quick views added."""
    page = {**json.loads(pbytes), "photos": events}
    entries = listing(rid, page)
    return (json.dumps({**page, "listing": entries, "quickviews": quickviews(rid, src, entries)}) + "\n").encode()


def write_members(rdir, rid, members):
    for name, data in members:
        f = rdir / rid / name
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(data)


def main():
    out = R / "build"
    if sys.argv[1:] == ["--stamp-native"]:
        stamp_native()
        return
    if sys.argv[1:] == ["--needs-native"]:
        print("\n".join(needs_native()))
        return
    if len(sys.argv) == 3 and sys.argv[1] == "--out":
        out = pathlib.Path(sys.argv[2]).resolve()
    elif len(sys.argv) != 1:
        sys.exit("usage: tools/pack.py [--out DIR | --stamp-native | --needs-native]")
    wasm = R / "build" / "view.opt.wasm"
    if not wasm.is_file():
        sys.exit("pack.py: no build/view.opt.wasm (tools/build.sh builds it first)")
    kernel = {"id": "core", "sha256": hashlib.sha256(wasm.read_bytes()).hexdigest()}
    pdir = R / "build" / "page"
    rdir = out / "reels"
    if rdir.exists():
        shutil.rmtree(rdir)
    rdir.mkdir(parents=True)
    index, page = [], []
    sits = notebook.scenes()
    scenario_ids = {rid for rid, kind, *_ in notebook.reels() if kind == "scenario"}
    for mdir in sorted(p for p in (D / "missions").iterdir() if p.is_dir()):
        mfile = mdir / "mission.scn"
        mtext = mfile.read_bytes()
        mname = card_name(mtext.decode("utf-8"), "MISSION")
        for sfile in sorted(p for p in mdir.glob("*.scn") if p.name != "mission.scn"):
            rid = f"{mdir.name}-{sfile.stem}"
            if any(r["id"] == rid for r in index):
                sys.exit(f"pack.py: two reels named {rid} (mission folder and scenario file names must not "
                         "combine to the same id)")
            if len(sfile.name) > 100:
                sys.exit(f"pack.py: {sfile}: a file name longer than 100 characters (USTAR)")
            stext = sfile.read_bytes()
            pfile = pdir / f"{rid}.json"
            if not pfile.is_file():
                sys.exit(f"pack.py: no {pfile.relative_to(R)} (tools/gen_data.py writes it first)")
            title = f"{mname} {card_name(stext.decode('utf-8'), 'SCENARIO')}"
            pbytes = pfile.read_bytes()
            events = photos.events(rid, {s["id"] for s in json.loads(pbytes)["situations"]},
                                   notebook.reel_media(mdir / sfile.stem), scenario_ids)
            nbm, nbe = notebook_members(rid, "scenario", mdir / sfile.stem, None, sits,
                                        {p["media"][len("media/"):] for p in events})
            manifest = {"format": FORMAT, "id": rid, "kind": "scenario", "title": title,
                        "mission": {"id": mdir.name, "name": mname}, "kernel": kernel,
                        "contents": [{"path": "mission.scn", "type": "scn"},
                                     {"path": sfile.name, "type": "scn"},
                                     {"path": "page.json", "type": "page"}, *nbe]}
            members = [("manifest.json", (json.dumps(manifest, indent=1) + "\n").encode()),
                       ("mission.scn", mtext), (sfile.name, stext), ("page.json", page_bytes(rid, mdir / sfile.stem, pbytes, events)), *nbm]
            pkg = tar_gz(members)
            (rdir / f"{rid}.reel.tar.gz").write_bytes(pkg)
            write_members(rdir, rid, members)
            index.append({"id": rid, "kind": "scenario", "title": title, "mission": mdir.name,
                          "file": f"{rid}.reel.tar.gz", "sha256": hashlib.sha256(pkg).hexdigest()})
            page.append({"id": rid, "b64": base64.b64encode(pkg).decode()})
    scenarios = {r["id"] for r in index}
    for rdeck in sorted((D / "reels").glob("*/run.scn")):
        rid = rdeck.parent.name
        if rid in scenarios:
            sys.exit(f"pack.py: a playlist and a scenario reel both named {rid}")
        pfile = pdir / f"{rid}.json"
        if not pfile.is_file():
            sys.exit(f"pack.py: no {pfile.relative_to(R)} (tools/gen_data.py writes it first)")
        pbytes = pfile.read_bytes()
        reel = json.loads(pbytes)
        uses = list(dict.fromkeys(sh["reel"] for sh in reel["shots"]))
        missing = [u for u in uses if u not in scenarios]
        if missing:
            sys.exit(f"pack.py: playlist {rid} uses {', '.join(missing)}, which is no scenario reel")
        nbm, nbe = notebook_members(rid, "playlist", rdeck.parent, uses, sits)
        manifest = {"format": FORMAT, "id": rid, "kind": "playlist", "title": reel["title"], "kernel": kernel,
                    "uses": uses,
                    "contents": [{"path": "run.scn", "type": "playlist"}, {"path": "page.json", "type": "page"}, *nbe]}
        members = [("manifest.json", (json.dumps(manifest, indent=1) + "\n").encode()),
                   ("run.scn", rdeck.read_bytes()), ("page.json", pbytes), *nbm]
        pkg = tar_gz(members)
        (rdir / f"{rid}.reel.tar.gz").write_bytes(pkg)
        write_members(rdir, rid, members)
        index.append({"id": rid, "kind": "playlist", "title": reel["title"], "uses": uses,
                      "file": f"{rid}.reel.tar.gz", "sha256": hashlib.sha256(pkg).hexdigest()})
        page.append({"id": rid, "b64": base64.b64encode(pkg).decode()})
    (rdir / "index.json").write_text(json.dumps(index, indent=1) + "\n")
    (out / "reels.js").write_text("const VIEW_REELS = " + json.dumps(page) + ";\n")
    print(f"pack: {len(index)} reels ({', '.join(r['id'] for r in index)}), kernel {kernel['sha256'][:8]}")


if __name__ == "__main__":
    main()
