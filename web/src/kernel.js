// Kernel loading: the FORTRAN wasm, the wasm2js fallback or the dev mock, and access to its globals.
"use strict";
const WASM_B64 = "__WASM_B64__";
// The SHA-256 of the kernel build above (build/view.opt.wasm; tools/assemble.py), which every reel must name.
const KERNEL_SHA = "__KERNEL_SHA__";
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
    // The page's data from the reels the page embeds, whose decks the mock does not read; without reels, the stand-in.
    setPageData(typeof VIEW_REELS !== "undefined" ? await reelLibrary() : [{ manifest: { id: "mock" }, page: STANDIN_PAGE }]);
    LS.deck = SITS[0].reel;
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
    const reels = await reelLibrary();
    setPageData(reels);
    // Every scenario reel's decks once, so a deck error stops the boot rather than a later switch, in reverse load
    // order: the first, the boot reel, is the one left in the kernel.
    for (const r of scenarioReels().reverse()) loadDecks(r);
  }
  LS.mode = REELS[DEFAULT_REEL].alias;
  if (DEBUG) window.VIEW_KERNEL = K;
}

// The reels embedded in the page (VIEW_REELS, build/reels.js, tools/pack.py), unpacked once at boot (reelpkg.js),
// in their load order; a reel that does not unpack, or names another kernel build, stops the boot. REEL_LIB keeps
// them for switching scenario reels in the kernel (useDeck); their page.json are the page's situations, spans,
// timelines and playlists (config.js setPageData).
let REEL_LIB = [];
async function reelLibrary() {
  if (typeof VIEW_REELS === "undefined") throw new Error("no reels (build/reels.js)");
  if (typeof DecompressionStream === "undefined")
    throw new Error("THIS BROWSER CANNOT UNPACK REELS (no DecompressionStream: Chrome 80, Firefox 113, Safari 16.4 or later)");
  REEL_LIB = [];
  for (const r of VIEW_REELS) REEL_LIB.push(await readReel(r.b64, KERNEL_SHA, r.id));
  return REEL_LIB;
}
const scenarioReels = () => REEL_LIB.filter(r => r.manifest.kind === "scenario");
// One scenario reel's run decks through the kernel's card reader (src/vdeck.f), replacing the run tables (deck_open):
// the kernel holds one scenario reel at a time, each numbering its own scenario and situations (#26 slice 7e). One card
// image a line as character codes, each file closed with deck_file; a deck error throws with its reel, file and line.
// Synchronous: the reel's files are already unpacked.
function loadDecks(reel) {
  const enc = new TextEncoder(), at = [];
  LS.deck = "";
  K.deck_open();
  for (const [path, text] of reelDecks(reel)) {
    const lines = text.split("\n");
    if (lines.at(-1) === "") lines.pop();   // the file's last newline ends a card, as natively
    lines.forEach((ln, i) => {
      const b = enc.encode(ln.replace(/\r$/, "")), card = new Int32Array(K.memory.buffer, K.in_card.value, 1024);
      for (let j = 0; j < Math.min(b.length, 1024); j++) card[j] = b[j];
      K.deck_card(b.length);
      at.push(`${path}:${i + 1}`);
    });
    K.deck_file();
  }
  K.deck_close();
  const err = new Int32Array(K.memory.buffer, K.out_dkerr.value, 1)[0];
  const card = new Int32Array(K.memory.buffer, K.out_dkcrd.value, 1)[0];
  if (err) throw new Error(`DECK ERROR ${String(err).padStart(2, "0")} AT ${at[card - 1] ?? "the end of the decks"}`);
  LS.deck = reel.manifest.id;
}
// The scenario reel `id`'s decks into the kernel unless they are there already (loader.js mount, before view_init).
// The mock kernel reads no decks.
function useDeck(id) {
  if (USE_MOCK || LS.deck === id) return;
  const r = scenarioReels().find(x => x.manifest.id === id);
  if (!r) throw new Error(`no scenario reel ${id}`);
  loadDecks(r);
}

// ---- kernel access (views are re-made on every access; memory may grow) ----
const buf = () => K.memory.buffer;
const rd = g => new Float64Array(buf(), K[g].value, 1)[0];
const wr = (g, v) => { new Float64Array(buf(), K[g].value, 1)[0] = v; };
const ri = g => new Int32Array(buf(), K[g].value, 1)[0];
const wi = (g, v) => { new Int32Array(buf(), K[g].value, 1)[0] = v; };
// Every scene selection goes through here (loader.js mount), so a running simulation re-fills its tape for the scene
// (sim.js); one frame at the scene's defaults follows.
const viewInit = s => { K.view_init(s); simAfterInit(); K.view_frame(); };
