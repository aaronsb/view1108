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
captures (tools/golden.sh, case nb-<id>-<name>); tools/build.sh renders the figures before it packs. The manifest names the kernel build the
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

Reels in a package are per scenario (operator, 2026-10-07): a mission's second scenario would be a
second reel carrying its own copy of mission.scn.
"""
import base64, gzip, hashlib, io, json, pathlib, re, shutil, sys, tarfile

import notebook

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


def notebook_members(rid, kind, src, uses, sits):
    """The reel's notebook members and their manifest entries: ([(name, bytes)], [entry]), both empty without a
    notebook. Each figure is build/figures/<rid>/<name>.svg as tools/notebook.py rendered it."""
    nb = notebook.load(rid, kind, src, uses, sits)
    if not nb:
        return [], []
    members, entries = [("notebook/notebook.md", nb["text"])], [{"path": "notebook/notebook.md", "type": "notebook"}]
    for name, *_ in nb["cases"]:
        fig = R / "build" / "figures" / rid / f"{name}.svg"
        if not fig.is_file():
            sys.exit(f"pack.py: no {fig.relative_to(R)} (tools/notebook.py render writes it, with build/viewsvg)")
        path = f"notebook/figures/{name}.svg"
        if len(path) > 100:
            sys.exit(f"pack.py: {rid}: {path}: a member name longer than 100 characters (USTAR)")
        members.append((path, fig.read_bytes()))
        entries.append({"path": path, "type": "figure"})
    return members, entries


def write_members(rdir, rid, members):
    for name, data in members:
        f = rdir / rid / name
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(data)


def main():
    out = R / "build"
    if len(sys.argv) == 3 and sys.argv[1] == "--out":
        out = pathlib.Path(sys.argv[2]).resolve()
    elif len(sys.argv) != 1:
        sys.exit("usage: tools/pack.py [--out DIR]")
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
            nbm, nbe = notebook_members(rid, "scenario", mdir / sfile.stem, None, sits)
            manifest = {"format": FORMAT, "id": rid, "kind": "scenario", "title": title,
                        "mission": {"id": mdir.name, "name": mname}, "kernel": kernel,
                        "contents": [{"path": "mission.scn", "type": "scn"},
                                     {"path": sfile.name, "type": "scn"},
                                     {"path": "page.json", "type": "page"}, *nbe]}
            members = [("manifest.json", (json.dumps(manifest, indent=1) + "\n").encode()),
                       ("mission.scn", mtext), (sfile.name, stext), ("page.json", pfile.read_bytes()), *nbm]
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
