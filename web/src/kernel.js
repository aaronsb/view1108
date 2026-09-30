// Kernel loading: the FORTRAN wasm, the wasm2js fallback or the dev mock, and access to its globals.
"use strict";
const WASM_B64 = "__WASM_B64__";
const NOWASM = /[?&]nowasm\b/.test(location.search);
const USE_MOCK = /[?&]mock\b/.test(location.search) || WASM_B64.startsWith("__");

// ---- math imports: _lfortran_dsin -> Math.sin, etc. ----
function mathFor(name) {
  const cands = [name, name.replace(/^_lfortran_/, "")];
  for (const c of cands.slice()) cands.push(c.replace(/^d(?=[a-z])/, ""));
  for (const c of cands) {
    if (c === "mod") return (a, b) => a % b;
    if (c === "pow") return Math.pow;
    if (c === "fma") return (a, b, d) => a * b + d;
    if (c === "sign") return (a, b) => (b < 0 || Object.is(b, -0)) ? -Math.abs(a) : Math.abs(a);
    if (c === "max") return Math.max;
    if (c === "min") return Math.min;
    if (typeof Math[c] === "function") return Math[c];
  }
  console.warn("unresolved import", name);
  return () => 0;
}
const proxyEnv = () => new Proxy({}, { get: (t, n) => (typeof n === "string" ? (t[n] || (t[n] = mathFor(n))) : undefined), has: () => true });

let K = null, cpuName = "";
async function boot() {
  if (USE_MOCK) {
    if (typeof VIEW1108_MOCK === "undefined") await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "mock.js"; s.onload = ok; s.onerror = () => no(new Error("mock.js not found")); document.head.appendChild(s); });
    K = VIEW1108_MOCK(); cpuName = "mock kernel";
    if (window.MOCK_NAMES && typeof VIEW_NAMES === "undefined") Object.assign(NAMES, window.MOCK_NAMES);
  } else {
    const bin = Uint8Array.from(atob(WASM_B64), c => c.charCodeAt(0));
    try {
      if (NOWASM) throw new Error("wasm disabled by ?nowasm");
      const mod = await WebAssembly.compile(bin);
      const imp = {};
      for (const i of WebAssembly.Module.imports(mod)) {
        const m = imp[i.module] || (imp[i.module] = {});
        m[i.name] = i.kind === "function" ? mathFor(i.name) : i.kind === "memory" ? new WebAssembly.Memory({ initial: 256 }) : undefined;
      }
      K = (await WebAssembly.instantiate(mod, imp)).exports; cpuName = "WebAssembly";
    } catch (e) {
      console.warn("wasm failed, using JS fallback", e);
      if (typeof VIEW1108_ASM !== "function") throw e;
      K = VIEW1108_ASM(proxyEnv()); cpuName = "wasm2js";
    }
  }
  if (DEBUG) window.VIEW_KERNEL = K;
}

// ---- kernel access (views are re-made on every access; memory may grow) ----
const buf = () => K.memory.buffer;
const rd = g => new Float64Array(buf(), K[g].value, 1)[0];
const wr = (g, v) => { new Float64Array(buf(), K[g].value, 1)[0] = v; };
const ri = g => new Int32Array(buf(), K[g].value, 1)[0];
const wi = (g, v) => { new Int32Array(buf(), K[g].value, 1)[0] = v; };
