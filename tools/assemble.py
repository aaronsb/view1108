#!/usr/bin/env python3
"""Fill web/page.template.html -> web/view1108.html (single self-contained file).

Page modules: each <link rel="stylesheet" href="src/X.css"> becomes an inline <style>, and each run of
<script src="src/X.js"></script> tags becomes one inline script whose modules share a strict-mode closure,
joined in tag order. Placeholders: __WASM_B64__ (build/view.opt.wasm), __FALLBACK_JS__ (build/fallback.js),
__NAMES_JS__ (build/names.js), __REELS_JS__ (build/reels.js, tools/pack.py: the reel packages, base64, which
the page unpacks at boot and whose run decks the kernel's card reader loads), __KERNEL_SHA__ (the SHA-256 of
build/view.opt.wasm, computed here, which each reel's manifest must name), __FORTRAN_SRC__ (the kernel listing:
every src/*.f but the generated viewdata.f, the driver vdrive.f (or view.f) first, then the INCLUDE files
viewdims.inc and viewcom.inc, each element preceded by
a line of a form feed and its path, HTML-escaped),
__FONT_3270_B64__ (web/fonts/3270-Regular.subset.woff2), __FONT_JBM_B64__ (web/fonts/JetBrainsMono-Regular.subset.woff2),
__FONT_MICH_B64__ (web/fonts/Michroma-Regular.subset.woff2, the machine room's nameplates),
__FONT_CPR_B64__ and __FONT_CPB_B64__ (web/fonts/CourierPrime-Regular.subset.woff2 and -Bold, the notebook binder's typed pages),
__LIBRARY_JSON__ (web/library/library.json, the reference library's manifest; the PDFs stay beside the page),
__LAB_JS__ (build/lab.js, the machine room bundled from web/lab; empty when absent, and the page has no Room).
The kernel's symbol table (build/symbols.json, tools/gen_symbols.py) follows the listing's </pre> as
<script type="application/json" id="fsym">, when that file is there.
"""
import base64, hashlib, html, pathlib, re, sys

R = pathlib.Path(__file__).resolve().parent.parent
INPUTS = {
    "template": R / "web/page.template.html",
    "wasm": R / "build/view.opt.wasm",
    "fallback": R / "build/fallback.js",
    "names": R / "build/names.js",
    "reels": R / "build/reels.js",
    "font": R / "web/fonts/3270-Regular.subset.woff2",
    "fontjbm": R / "web/fonts/JetBrainsMono-Regular.subset.woff2",
    "fontmich": R / "web/fonts/Michroma-Regular.subset.woff2",
    "fontcpr": R / "web/fonts/CourierPrime-Regular.subset.woff2",
    "fontcpb": R / "web/fonts/CourierPrime-Bold.subset.woff2",
    "library": R / "web/library/library.json",
}
missing = [f"  {k}: {p.relative_to(R)}" for k, p in INPUTS.items() if not p.is_file()]
if missing:
    sys.exit("assemble.py: missing inputs (run tools/build.sh first):\n" + "\n".join(missing))

KSRC = sorted((f for f in (R / "src").glob("*.f") if f.name != "viewdata.f"), key=lambda f: (f.name not in ("vdrive.f", "view.f"), f.name))
KSRC += [R / "src" / n for n in ("viewdims.inc", "viewcom.inc", "viewsit.inc", "vdeck.inc", "vdvoc.inc")
         if (R / "src" / n).is_file()]
if not KSRC:
    sys.exit("assemble.py: no kernel sources src/*.f")
t = INPUTS["template"].read_text()
WEB = R / "web"


def module(rel):
    f = WEB / rel
    if not f.is_file():
        sys.exit(f"assemble.py: page module {rel} not found")
    s = f.read_text()
    if "</script" in s or "</style" in s:
        sys.exit(f"assemble.py: {rel} contains a closing tag")
    return s


t = re.sub(r'<link rel="stylesheet" href="(src/[\w.-]+\.css)">',
           lambda m: "<style>" + module(m.group(1)) + "</style>", t)


def scripts(m):
    rels = re.findall(r'src="(src/[\w.-]+\.js)"', m.group(0))
    body = "".join(re.sub(r'^"use strict";\n', "", module(r), flags=re.M) for r in rels)
    return '<script>\n(() => {\n"use strict";\n' + body + "})();\n</script>\n"


t = re.sub(r'(?:<script src="src/[\w.-]+\.js"></script>\n)+', scripts, t)
SYMS = R / "build/symbols.json"
if SYMS.is_file():
    fsym = '<script type="application/json" id="fsym">' + SYMS.read_text().replace("</", "<\\/") + "</script>"
    t = t.replace("__FORTRAN_SRC__</pre>", "__FORTRAN_SRC__</pre>\n__FSYM__", 1)
# Function replacements so '\' and '&' in payloads are never interpreted.
subs = {
    "__FORTRAN_SRC__": html.escape("".join(f"\f{f.relative_to(R)}\n{f.read_text()}" for f in KSRC), quote=False),
    "__FALLBACK_JS__": INPUTS["fallback"].read_text().replace("</script", "<\\/script"),
    "__NAMES_JS__": INPUTS["names"].read_text().replace("</script", "<\\/script"),
    "__REELS_JS__": INPUTS["reels"].read_text().replace("</", "<\\/"),
    "__KERNEL_SHA__": hashlib.sha256(INPUTS["wasm"].read_bytes()).hexdigest(),
    "__FONT_3270_B64__": base64.b64encode(INPUTS["font"].read_bytes()).decode(),
    "__FONT_JBM_B64__": base64.b64encode(INPUTS["fontjbm"].read_bytes()).decode(),
    "__FONT_MICH_B64__": base64.b64encode(INPUTS["fontmich"].read_bytes()).decode(),
    "__FONT_CPR_B64__": base64.b64encode(INPUTS["fontcpr"].read_bytes()).decode(),
    "__FONT_CPB_B64__": base64.b64encode(INPUTS["fontcpb"].read_bytes()).decode(),
    "__LIBRARY_JSON__": INPUTS["library"].read_text().replace("</", "<\\/"),
    "__WASM_B64__": base64.b64encode(INPUTS["wasm"].read_bytes()).decode(),
}
LAB = R / "build/lab.js"
subs["__LAB_JS__"] = LAB.read_text().replace("</script", "<\\/script") if LAB.is_file() else ""
if "__FSYM__" in t:
    subs["__FSYM__"] = fsym
# Replace only the payload slots, not the dev-guard `var __FALLBACK_JS__, __NAMES_JS__, ...;` line.
guard = "var __FALLBACK_JS__, __NAMES_JS__, __REELS_JS__, __LAB_JS__;"
t = t.replace(guard, "")
for k, v in subs.items():
    if k not in t:
        sys.exit(f"assemble.py: placeholder {k} not found in template")
    t = t.replace(k, v)
out = R / "web/view1108.html"
out.write_text(t)
print("wrote", out, len(t), "bytes")
