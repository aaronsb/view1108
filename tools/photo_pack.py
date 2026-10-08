#!/usr/bin/env python3
"""reference/photos/<frame>.jpg -> data/missions/<mission>/<scenario file stem>/media/<frame, lower case>.jpg: the packed
copy of each photograph with a situation in data/photos.tsv (#75), the file tools/pack.py packs byte for byte as the
reel's media member media/<frame>.jpg. Run by hand when a row or a scan changes (needs Pillow); the build never runs it,
so a package does not depend on the Pillow and libjpeg that made the copy.

Each copy is the scan reduced to a long side of 1024 px (LANCZOS), turned by the row's `turn` (quarter turns clockwise,
to the photograph's usual presentation), JPEG quality 80, optimized, without metadata: the reduction the Fusion fits in
data/photos.tsv were made on (ours). A copy over the media limit (tools/notebook.py MEDIA_MAX, 256 KB) is refused.

  tools/photo_pack.py            write every copy, and print each with its size
  tools/photo_pack.py --check    write nothing; exit 1 if a copy is missing or is not what the scan gives today
"""
import io, pathlib, sys

from PIL import Image

import notebook
import photos

R = pathlib.Path(__file__).resolve().parent.parent
LONG, QUALITY = 1024, 80
TURNS = {0: None, 1: Image.Transpose.ROTATE_270, 2: Image.Transpose.ROTATE_180, 3: Image.Transpose.ROTATE_90}


def reduce(src, turn):
    im = Image.open(src)
    im.thumbnail((LONG, LONG), Image.LANCZOS)
    if TURNS[turn] is not None:
        im = im.transpose(TURNS[turn])
    b = io.BytesIO()
    im.save(b, "JPEG", quality=QUALITY, optimize=True)
    return b.getvalue()


def main():
    check = sys.argv[1:] == ["--check"]
    if sys.argv[1:] not in ([], ["--check"]):
        sys.exit("usage: tools/photo_pack.py [--check]")
    folders = {rid: src for rid, kind, src, _ in notebook.reels() if kind == "scenario"}
    bad = 0
    for row in photos.rows():
        if not row["sit"]:
            continue
        if row["reel"] not in folders:
            sys.exit(f"photo_pack: {row['frame']}: no scenario reel {row['reel']}")
        turn = int(row["turn"] or 0)
        if turn not in TURNS:
            sys.exit(f"photo_pack: {row['frame']}: turn {turn} is not 0 to 3")
        data = reduce(R / "reference" / "photos" / f"{row['frame']}.jpg", turn)
        if len(data) > notebook.MEDIA_MAX:
            sys.exit(f"photo_pack: {row['frame']}: {len(data)} bytes, more than {notebook.MEDIA_MAX}")
        out = folders[row["reel"]] / "media" / photos.media_file(row["frame"])
        if check:
            if not out.is_file() or out.read_bytes() != data:
                print(f"photo_pack: {out.relative_to(R)} is not the reduced scan of {row['frame']}")
                bad += 1
            continue
        out.parent.mkdir(exist_ok=True)
        out.write_bytes(data)
        print(f"{out.relative_to(R)}  {len(data)} bytes")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
