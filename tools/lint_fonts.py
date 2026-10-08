#!/usr/bin/env python3
"""Allowlist lint for font stacks in the web sources (#95).

Every face the page and the room print in is bundled (web/fonts/, THIRD_PARTY.md), so every family named in a font
stack must be one declared by an @font-face in web/src/page.css or web/lab/gallery.html, or a generic keyword
(serif, sans-serif, monospace, ui-monospace, system-ui ...), compared case-insensitively. A named system face
draws differently on every OS.

Stacks are found where they are written: a `font:` or `.font =` value (the family list follows the size), a
`font-family`/`fontFamily` value, the page's family variables (--lab, --hd, --term, --sx-mono, --sx-ui) and
string constants named *FONT*, *SERIF*, *SANS*, *HAND*, *TYPED*, *SCRIPT* or *MONO*. A stack may also name
`var(...)` or `${...}` (a variable or constant checked where it is defined). As a backstop, a list of well-known
proprietary names is refused anywhere outside comments (the PDF writer's base-14 /BaseFont is not a stack).

usage: lint_fonts.py [file ...]   (default: the web sources)
"""
import pathlib
import re
import sys

R = pathlib.Path(__file__).resolve().parent.parent
FACE_FILES = ("web/src/page.css", "web/lab/gallery.html")
GENERIC = {"serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-monospace", "ui-sans-serif",
           "ui-serif", "ui-rounded", "emoji", "math", "fangsong", "inherit", "initial", "unset", "revert"}
BAD = re.compile(
    r"Courier New|\bCourier\b(?! Prime)|Helvetica|Arial|Georgia|Times|Eurostile|Liberation|Segoe|Roboto|Menlo|Consolas|"
    r"Calibri|Verdana|Tahoma|Trebuchet|Palatino|Garamond|Lucida|DejaVu|Cascadia|Fira Code|Comic|Bradley Hand|Chalkboard|"
    r"-apple-system|BlinkMacSystemFont|SF Mono|SF Pro|San Francisco|Monaco\b|Impact\b|Optima\b|Futura\b|Univers\b|"
    r"Frutiger|Gill Sans|Snell|Brush Script|Chancery", re.I)
SKIP = re.compile(r"^\s*(//|/\*|\*)|/BaseFont")
EXT = {".js", ".ts", ".css", ".html"}
SIZE = re.compile(r"(?<=[\d}.])(?:px|pt|em|rem|%)\b(?:/[^\s,;]+)?\s*", re.I)
KEY = re.compile(r"(?:font-family|fontFamily|--lab|--hd|--term|--sx-mono|--sx-ui)\s*[:=]\s*(?P<v>[^;}]*)")
FONTKV = re.compile(r"\bfont\s*[:=]\s*(?P<v>[^;}]*)")
CONST = re.compile(r"\b(?P<n>[A-Z_0-9]*(?:FONT|SERIF|SANS|HAND|TYPED|SCRIPT|MONO)[A-Z_0-9]*)\s*=\s*"
                   r"(?P<q>['\"`])(?P<v>.*?)(?P=q)")


def faces():
    out = set()
    for f in FACE_FILES:
        out |= {m.lower() for m in re.findall(r"@font-face\s*\{[^}]*?font-family\s*:\s*[\"']([^\"']+)[\"']", (R / f).read_text(), re.S)}
    return out


def names(text):
    """The family names of a comma list at the start of text, quoted or bare."""
    out, s = [], text.strip()
    while s:
        if s[0] in "\"'":
            e = s.find(s[0], 1)
            if e < 0:
                break
            out.append(s[1:e])
            s = s[e + 1:].lstrip()
        else:
            m = re.match(r"[^,;\"'`]+", s)
            if not m:
                break
            out.append(m.group(0).strip())
            s = s[m.end():].lstrip()
        if not s.startswith(","):
            break
        s = s[1:].lstrip()
    return [n for n in out if n]


def unquote(v):
    """Drop the quote that opens a JS string value (and its closer), keeping the family quotes inside."""
    v = v.strip()
    if v[:1] in ("'", "`"):
        return v[1:].rstrip("'`").strip()
    if v[:1] == '"':
        m = SIZE.search(v)
        if m and '"' not in v[1:m.start()]:
            return v[1:].rstrip('"').strip()
    return v


def family_part(v):
    v = unquote(v)
    m = SIZE.search(v)
    return v[m.end():] if m else v


def check_line(line, ok):
    found = []
    for m in KEY.finditer(line):
        found += names(unquote(m.group("v")))
    for m in FONTKV.finditer(line):
        v = unquote(m.group("v"))
        if SIZE.search(v):
            found += names(family_part(v))
    for m in CONST.finditer(line):
        found += names(family_part(m.group("v")))
    bad = []
    for n in found:
        k = n.lower().strip()
        if k in GENERIC or k in ok or k.startswith("var(") or k.startswith("${") or k[:1].isdigit():
            continue
        bad.append(n)
    return bad


def files():
    for d in ("web/src", "web/lab/src"):
        yield from sorted(p for p in (R / d).rglob("*") if p.suffix in EXT)
    yield R / "web/page.template.html"
    yield R / "web/lab/gallery.html"


def main(argv):
    ok = faces()
    if not ok:
        print("lint_fonts: no @font-face found in", FACE_FILES)
        return 1
    bad = n = 0
    for p in map(pathlib.Path, argv) if argv else files():
        for i, line in enumerate(p.read_text(errors="replace").splitlines(), 1):
            if SKIP.search(line):
                continue
            n += 1
            why = [f"family '{x}' is not a bundled face or a generic keyword" for x in check_line(line, ok)]
            m = BAD.search(line)
            if m and not why and re.search(r"font|FONT|SERIF|SANS|HAND|SCRIPT", line):
                why.append(f"proprietary name '{m.group(0)}'")
            for w in why:
                bad += 1
                print(f"{p}:{i}: {w} in a font stack; bundle a free face (THIRD_PARTY.md), end the stack in a generic family")
    if not n:
        print("lint_fonts: scanned nothing")
        return 1
    if bad:
        print(f"lint_fonts: {bad} problem(s)")
        return 1
    print(f"lint_fonts: ok ({n} lines, {len(ok)} bundled families: {', '.join(sorted(ok))})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
