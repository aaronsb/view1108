#!/usr/bin/env python3
"""data/photos.tsv + reference/photos/*.jpg -> build/photos.json, the Fusion tab's photographs (web/src/fusion.js).

Every row of the table goes in, as an object keyed by its column names. A row with a situation (sit) also carries its image,
reduced to a long side of 1024 px (JPEG quality 80, orientation as scanned) as a data URI; rows without one are
listed but not embedded, since the page cannot show them in place yet. Needs Pillow.
"""
import base64, io, json, pathlib, sys

try:
    from PIL import Image
except ImportError:
    # Without Pillow the page builds without photographs (assemble.py takes an empty list).
    print("photo_pack: Pillow not installed; Fusion's photographs left out", file=sys.stderr)
    sys.exit(0)

R = pathlib.Path(__file__).resolve().parent.parent
LONG, QUALITY = 1024, 80
rows = [l.split("\t") for l in (R / "data/photos.tsv").read_text().splitlines() if l.strip() and not l.startswith("#")]
head, out, total = rows[0], [], 0
for r in rows[1:]:
    p = dict(zip(head, r + [""] * (len(head) - len(r))))
    src = R / "reference/photos" / (p["frame"] + ".jpg")
    if p["sit"] and src.is_file():
        im = Image.open(src)
        im.thumbnail((LONG, LONG), Image.LANCZOS)
        b = io.BytesIO(); im.save(b, "JPEG", quality=QUALITY, optimize=True)
        p["img"] = "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
        p["w"], p["h"] = im.size
        total += len(p["img"])
    out.append(p)
(R / "build").mkdir(exist_ok=True)
(R / "build/photos.json").write_text(json.dumps(out, separators=(",", ":")))
print(f"photo_pack: {sum('img' in p for p in out)} of {len(out)} photographs embedded, {total / 1e6:.2f} MB as base64", file=sys.stderr)
