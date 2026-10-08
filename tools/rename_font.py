#!/usr/bin/env python3
"""Rename a subset font's family in place (SIL OFL 1.1 clause 3: a Modified Version may not use a Reserved Font Name).

IBM Plex's RFN is "Plex"; web/fonts/IBMPlex*.subset.woff2 are Modified Versions (subset), so after pyftsubset each is
renamed to a family without it. Sets nameIDs 1, 3, 4, 6 and the typographic 16/17 from the family and the file's own
style (Regular or Bold, read from OS/2 weight), and drops nameID 7 (trademark) and 8-13's Plex wording is left as the
upstream copyright and licence require (0, 13, 14).

usage: rename_font.py "<new family>" file.subset.woff2 [...]
"""
import sys

from fontTools.ttLib import TTFont


def rename(path, family):
    f = TTFont(path)
    bold = f["OS/2"].usWeightClass >= 600
    style = "Bold" if bold else "Regular"
    full = f"{family} {style}"
    ps = family.replace(" ", "") + "-" + style
    nm = f["name"]
    for rec in list(nm.names):
        if rec.nameID in (16, 17, 21, 22, 25):
            nm.removeNames(nameID=rec.nameID)
    for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):
        nm.setName(family, 1, pid, eid, lid)
        nm.setName(style, 2, pid, eid, lid)
        nm.setName(f"{full};VIEW subset", 3, pid, eid, lid)
        nm.setName(full, 4, pid, eid, lid)
        nm.setName(ps, 6, pid, eid, lid)
    for rec in list(nm.names):
        if rec.nameID in (5, 7, 8, 9, 10, 11, 12) and "Plex" in rec.toUnicode():
            nm.removeNames(nameID=rec.nameID)
    f.flavor = "woff2"
    f.save(path)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    for p in sys.argv[2:]:
        rename(p, sys.argv[1])
