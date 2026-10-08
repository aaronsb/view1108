#!/usr/bin/env python3
"""Fail if a proprietary or system-dependent face name appears in a font stack in the web sources (#95).

Every face the page and the room print in is bundled (web/fonts/, THIRD_PARTY.md) and named "<Face> VIEW" (or
"IBM 3270"); a stack is the bundled face, then a generic family (monospace, sans-serif, serif, ui-monospace,
system-ui). A named system face draws differently on every OS. Comment lines and the PDF writer's base-14
/BaseFont (web/src/printout.js, not a CSS stack) are skipped.

usage: lint_fonts.py [file ...]   (default: the web sources)
"""
import pathlib
import re
import sys

R = pathlib.Path(__file__).resolve().parent.parent
BAD = re.compile(
    r"Courier New|\bCourier\b(?! Prime)|Helvetica|Arial|Georgia|Times|Eurostile|Liberation|Segoe|Roboto|Menlo|Consolas|"
    r"Calibri|Verdana|Tahoma|Trebuchet|Palatino|Garamond|Lucida|DejaVu|Cascadia|Fira Code|Comic|Bradley Hand|Chalkboard|"
    r"-apple-system|BlinkMacSystemFont|SF Mono|SF Pro|San Francisco|Monaco\b|Impact\b|Optima\b|Futura\b|Univers\b|Frutiger|Gill Sans")
SKIP = re.compile(r"^\s*(//|/\*|\*)|/BaseFont")
EXT = {".js", ".ts", ".css", ".html"}


def files():
    for d in ("web/src", "web/lab/src"):
        yield from sorted(p for p in (R / d).rglob("*") if p.suffix in EXT)
    yield R / "web/page.template.html"
    yield R / "web/lab/gallery.html"


def main(argv):
    bad = 0
    for p in map(pathlib.Path, argv) if argv else files():
        for n, line in enumerate(p.read_text(errors="replace").splitlines(), 1):
            if SKIP.search(line):
                continue
            m = BAD.search(line)
            if m:
                bad += 1
                print(f"{p}:{n}: proprietary face '{m.group(0)}' in a font stack; bundle a free face "
                      "(THIRD_PARTY.md) and end the stack in a generic family")
    if bad:
        print(f"lint_fonts: {bad} line(s)")
        return 1
    print("lint_fonts: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
