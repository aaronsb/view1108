#!/usr/bin/env python3
"""Fill web/page.template.html -> web/view1108.html (single self-contained file).

Placeholders: __WASM_B64__ (build/view.opt.wasm), __FALLBACK_JS__ (build/fallback.js),
__NAMES_JS__ (build/names.js), __FORTRAN_SRC__ (src/view.f, HTML-escaped),
__FONT_3270_B64__ (web/fonts/3270-Regular.subset.woff2).
"""
import base64, html, pathlib, sys

R = pathlib.Path(__file__).resolve().parent.parent
INPUTS = {
    "template": R / "web/page.template.html",
    "wasm": R / "build/view.opt.wasm",
    "fallback": R / "build/fallback.js",
    "names": R / "build/names.js",
    "fortran": R / "src/view.f",
    "font": R / "web/fonts/3270-Regular.subset.woff2",
}
missing = [f"  {k}: {p.relative_to(R)}" for k, p in INPUTS.items() if not p.is_file()]
if missing:
    sys.exit("assemble.py: missing inputs (run tools/build.sh first):\n" + "\n".join(missing))

t = INPUTS["template"].read_text()
# Function replacements so '\' and '&' in payloads are never interpreted.
subs = {
    "__FORTRAN_SRC__": html.escape(INPUTS["fortran"].read_text(), quote=False),
    "__FALLBACK_JS__": INPUTS["fallback"].read_text().replace("</script", "<\\/script"),
    "__NAMES_JS__": INPUTS["names"].read_text().replace("</script", "<\\/script"),
    "__FONT_3270_B64__": base64.b64encode(INPUTS["font"].read_bytes()).decode(),
    "__WASM_B64__": base64.b64encode(INPUTS["wasm"].read_bytes()).decode(),
}
# Replace only the payload slots, not the dev-guard `var __FALLBACK_JS__, __NAMES_JS__;` line.
guard = "var __FALLBACK_JS__, __NAMES_JS__;"
t = t.replace(guard, "")
for k, v in subs.items():
    if k not in t:
        sys.exit(f"assemble.py: placeholder {k} not found in template")
    t = t.replace(k, v)
out = R / "web/view1108.html"
out.write_text(t)
print("wrote", out, len(t), "bytes")
