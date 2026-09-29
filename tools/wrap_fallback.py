#!/usr/bin/env python3
"""Turn wasm2js ES-module output into a plain function VIEW1108_ASM(env){...}
so the page can fall back to JavaScript where WebAssembly is unavailable."""
import re, sys
src = open(sys.argv[1]).read()
src = src.replace("import * as env from 'env';", "function VIEW1108_ASM(env){", 1)
cut = src.index("var retasmFunc = asmFunc(")
src = src[:cut] + 'return asmFunc({"env": env});\n}\n'
open(sys.argv[2], "w").write(src)
