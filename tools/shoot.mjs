#!/usr/bin/env node
// Scripted screenshots and headless checks (#77): `make shots`. Runs each shot of tools/shots.mjs in headless Chromium
// against web/view1108.html and writes build/shots/<name>.png; prints one PASS or FAIL line per shot and exits 1 when
// any shot fails (2 when it cannot run at all).
//
//   node tools/shoot.mjs                 every shot
//   node tools/shoot.mjs --only 'room-*' the shots whose name matches (a name or a glob; comma-separated for several)
//   node tools/shoot.mjs --list          the shots' names and URLs, nothing run
//
// How: the page is served from web/ by a small static server inside this process (127.0.0.1, a free port), and
// Chromium (the one tools/film_sheet.py uses: `chromium`, or $CHROMIUM) runs headless with its remote debugging pipe
// on a free port; this script drives it over the DevTools protocol with Node's own WebSocket, so it needs no npm
// package. Each shot gets a fresh browser context (its own storage: no remembered prefs, room choice or quality from
// another shot), a fixed viewport at device scale 1, and the page URL with ?debug (the VIEW_* test hooks) and the
// determinism switches: jitter=0, dust=0, fps=0 (no film weave, dust or 16 fps presentation), hz=steady (the 1558
// scope held still, not redrawn as a decaying beam pass), labdust=0 (no dust motes in the room) and labmotion=0 (the
// room's machines held still: the tape units' reels, the FASTRAND II, the CPU lamp panel) unless the shot sets
// `effects: true`, and always labq=low (the room's quality tier pinned). Chromium runs with TZ=UTC and the page's wall
// clock frozen at WALL.
// Chromium picks its own GPU path (SwiftShader where there is no GPU; forcing SwiftShader made a canvas-heavy shot take
// 7 s instead of 1), so PNGs repeat byte for byte on one machine, not across machines. The page has no seed of its
// own, so Math.random is replaced by a seeded generator (SEED) that restarts at every animation frame: the film's
// flicker and grain and the room's tube strikes come out the same in every frame and every run.
// The Chromium profile is build/shots/.chromium-<pid>, removed at exit, failures and interrupts included; nothing is
// written outside build/.
//
// A shot (tools/shots.mjs) is { name, url, viewport?, effects?, steps?, expect?, allow? }:
//   url       the query after view1108.html? (the page's link parameters, README "Link parameters")
//   viewport  [width, height] in CSS px (default DEFAULT_VIEWPORT)
//   effects   true: the film's weave, dust and 16 fps, the scope's refresh and the room's dust motes as the page
//             would have them (the shot's PNG then differs from run to run)
//   steps     run in order after the page has booted (window.VIEW_KERNEL set, or #err lettered):
//               { js: "expr" }        evaluate in the page (a promise is awaited)
//               { wait: "expr", timeout? }  poll every 50 ms until the expression is truthy (default 15 s)
//               { expect: [expr, want?] }  a check here, between steps (as `expect` below)
//               { frames: n }         n animation frames drawn
//               { ms: n }             a plain delay (prefer wait or frames)
//               { key: "Escape" }     a key press (key names as KeyboardEvent.key: Escape, Enter, " ", "a", ...)
//               { click: "#sel" }     a left click at the centre of the first element the selector matches;
//               { click: [x, y] }     or at client px
//               { vp: [w, h] }        the viewport resized, CSS px (a window narrowed or widened mid-shot)
//   expect    after the steps and two more frames: [expr] (truthy) or [expr, want]: want a RegExp (tested against
//             String(value)) or a value (compared as JSON)
//   allow     RegExps of console errors this shot accepts
//   timeout   ms for the whole shot (default SHOT_TIMEOUT); a shot that overruns fails and its page is closed
// Every shot also checks that the WebAssembly kernel runs (not the wasm2js fallback), that the page logged no console
// error or uncaught exception, and that #err is empty. Chromium gone mid-run ends the run with exit 2.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { SHOTS } from "./shots.mjs";

const R = path.resolve(import.meta.dirname, "..");
const WEB = path.join(R, "web"), OUT = path.join(R, "build", "shots");
const PAGE = "view1108.html";
const DEFAULT_VIEWPORT = [1280, 800];
const SEED = 1108;
const SHOT_TIMEOUT = 90000;   // ms, a whole shot
const CHROMIUM = process.env.CHROMIUM || "chromium";

// ---- arguments ----
const argv = process.argv.slice(2);
let only = null, list = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--list") list = true;
  else if (argv[i] === "--only" && i + 1 < argv.length) only = argv[++i];
  else if (argv[i].startsWith("--only=")) only = argv[i].slice(7);
  else { console.error(`shoot: unknown argument ${argv[i]} (--only <name|glob>[,...], --list)`); process.exit(2); }
}
const glob = g => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
const pats = only ? only.split(",").filter(Boolean).map(glob) : null;
const names = new Set();
for (const s of SHOTS) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s.name) || names.has(s.name)) { console.error(`shoot: bad or repeated shot name ${s.name}`); process.exit(2); }
  names.add(s.name);
}
const chosen = SHOTS.filter(s => !pats || pats.some(p => p.test(s.name)));
const DET = effects => effects ? "debug&labq=low" : "debug&labq=low&jitter=0&dust=0&fps=0&hz=steady&labdust=0&labmotion=0";
const query = s => DET(s.effects) +(s.url ? "&" + s.url.replace(/^[?&]/, "") : "");
if (list) { for (const s of SHOTS) console.log(`${s.name.padEnd(28)} ${PAGE}?${query(s)}`); process.exit(0); }
if (!chosen.length) { console.error(`shoot: no shot matches ${only}`); process.exit(2); }
if (!fs.existsSync(path.join(WEB, PAGE))) { console.error(`shoot: web/${PAGE} is missing (run make build)`); process.exit(2); }

// ---- cleanup: the profile and the server, on any exit ----
const PROFILE = path.join(OUT, `.chromium-${process.pid}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let browser = null, server = null, cdp = null, closing = null;
const running = () => browser && browser.exitCode === null && browser.signalCode === null;
// Chromium closed over the protocol (killed when it does not go in 3 s), the server stopped, then the profile removed
// once nothing writes into it.
function shutdown() {
  return closing ??= (async () => {
    if (cdp) await Promise.race([cdp.send("Browser.close").catch(() => null), sleep(2000)]);
    if (running()) {
      const gone = new Promise(r => browser.once("exit", r));
      await Promise.race([gone, sleep(3000)]);
      if (running()) { browser.kill("SIGKILL"); await Promise.race([gone, sleep(2000)]); }
    }
    server?.close();
    // Chromium's helpers can still be writing for a moment after the browser exits: remove until it stays removed.
    for (let i = 0; i < 10; i++) {
      fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      await sleep(200);
      if (!fs.existsSync(PROFILE)) return;
    }
    throw new Error(`could not remove ${path.relative(R, PROFILE)}`);
  })();
}
const finish = code => shutdown().catch(e => { console.error(`shoot: cleanup: ${e.message}`); code ||= 2; }).finally(() => process.exit(code));
// An exit that skipped finish: the same, as far as a synchronous handler can.
process.on("exit", () => {
  if (running()) browser.kill("SIGKILL");
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* best effort */ }
});
for (const [sig, code] of [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]]) process.on(sig, () => finish(code));
for (const ev of ["uncaughtException", "unhandledRejection"]) process.on(ev, e => { console.error(`shoot: ${ev}: ${e?.stack || e}`); finish(2); });

// ---- the static server: web/, read only ----
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".pdf": "application/pdf", ".woff2": "font/woff2", ".wasm": "application/wasm" };
function serve() {
  return new Promise((ok, bad) => {
    server = http.createServer((req, res) => {
      let f;
      try {
        const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
        if (u === "/favicon.ico") { res.writeHead(204); res.end(); return; }   // the page names no icon
        f = path.join(WEB, path.normalize(u));
      } catch { res.writeHead(400); res.end(); return; }   // a malformed URL
      if (!f.startsWith(WEB + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(f).on("error", () => res.destroy()).pipe(res);
    });
    server.on("error", bad);
    server.listen(0, "127.0.0.1", () => ok(server.address().port));
  });
}

// ---- Chromium and a DevTools protocol client ----
async function launch() {
  fs.rmSync(PROFILE, { recursive: true, force: true });   // a fresh profile, even if a pid was reused
  fs.mkdirSync(PROFILE, { recursive: true });
  const args = ["--headless=new", "--no-sandbox", `--user-data-dir=${PROFILE}`, "--remote-debugging-port=0",
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1",
    `--window-size=${DEFAULT_VIEWPORT.join(",")}`, "--enable-unsafe-swiftshader", "--font-render-hinting=none",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
    "--disable-extensions", "--disable-component-update", "--disable-sync", "--metrics-recording-only",
    "--disable-breakpad", "--disable-crash-reporter", "about:blank"];
  browser = spawn(CHROMIUM, args, { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, TZ: "UTC" } });
  let stderr = "";
  browser.stderr.on("data", d => { stderr = (stderr + d).slice(-4000); });
  const failed = new Promise((_, bad) => { browser.on("error", e => bad(new Error(`cannot start ${CHROMIUM}: ${e.message}`))); });
  const port = path.join(PROFILE, "DevToolsActivePort");
  const found = (async () => {
    for (let i = 0; i < 300; i++) {
      if (browser.exitCode !== null) throw new Error(`${CHROMIUM} exited (${browser.exitCode}): ${stderr.trim().split("\n").pop()}`);
      try { const [p, ws] = fs.readFileSync(port, "utf8").split("\n"); if (p && ws) return `ws://127.0.0.1:${p}${ws}`; } catch { /* not yet */ }
      await sleep(50);
    }
    throw new Error(`${CHROMIUM} gave no debugging port in 15 s`);
  })();
  return Promise.race([found, failed]);
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.calls = new Map(); this.subs = new Set();
    this.ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id !== undefined) {
        const c = this.calls.get(m.id); this.calls.delete(m.id);
        if (c) m.error ? c.bad(new Error(`${c.method}: ${m.error.message}`)) : c.ok(m.result);
      } else for (const f of this.subs) f(m);
    };
    this.open = new Promise((ok, bad) => { this.ws.onopen = ok; this.ws.onerror = () => bad(new Error("DevTools connection failed")); });
    this.closed = false;
    // Chromium gone: every call still waiting fails now, and every later one at once.
    this.ws.onclose = () => {
      this.closed = true;
      for (const c of this.calls.values()) c.bad(new Error(`${c.method}: DevTools connection closed (Chromium gone)`));
      this.calls.clear();
    };
  }
  send(method, params = {}, sessionId) {
    if (this.closed) return Promise.reject(new Error(`${method}: DevTools connection closed (Chromium gone)`));
    const id = ++this.id;
    return new Promise((ok, bad) => { this.calls.set(id, { ok, bad, method }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); });
  }
  on(f) { this.subs.add(f); return () => this.subs.delete(f); }
}

// ---- in the page ----
// Before any page script: a seeded Math.random (mulberry32) restarted at every animation frame.
// The wall clock (Date.now, new Date(): the room's wall clock) stands at WALL; the page times nothing by it.
const WALL = Date.UTC(1969, 6, 20, 20, 17, 40);
const PRELUDE = `(() => {
  const D = Date, WALL = ${WALL};
  window.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(WALL); } static now() { return WALL; } };
  let s = 0; const seed = () => { s = ${SEED}; }; seed();
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => { seed(); cb(t); });
})();`;
const READY = `!!window.VIEW_KERNEL || !!(document.getElementById("err") && document.getElementById("err").textContent)`;
const FRAMES = n => `new Promise(r => { let k = ${n | 0}; const f = () => (--k <= 0 ? r(true) : requestAnimationFrame(f)); requestAnimationFrame(f); })`;
const KEYS = { Escape: [27, "Escape"], Enter: [13, "Enter"], Tab: [9, "Tab"], " ": [32, "Space"], ArrowLeft: [37, "ArrowLeft"],
  ArrowUp: [38, "ArrowUp"], ArrowRight: [39, "ArrowRight"], ArrowDown: [40, "ArrowDown"], Backspace: [8, "Backspace"] };

// ctx: { browserContextId, cancelled }, shared with the caller, which disposes of the context when the shot times out.
async function runShot(cdp, base, shot, ctx) {
  const errors = [], fails = [];
  const { browserContextId } = await cdp.send("Target.createBrowserContext", { disposeOnDetach: true });
  ctx.browserContextId = browserContextId;
  if (ctx.cancelled) throw new Error("cancelled");
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);
  let loaded = null;
  const off = cdp.on(m => {
    if (m.sessionId !== sessionId) return;
    const p = m.params;
    if (m.method === "Runtime.exceptionThrown") errors.push("exception: " + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split("\n")[0]);
    else if (m.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "assert"))
      errors.push("console.error: " + p.args.map(a => a.value ?? a.description ?? "").join(" ").split("\n")[0]);
    else if (m.method === "Log.entryAdded" && p.entry.level === "error") errors.push("log: " + p.entry.text + (p.entry.url ? " " + p.entry.url : ""));
    else if (m.method === "Page.loadEventFired" && loaded) loaded();
  });
  const evaluate = async expr => {
    const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expr}: ${(r.exceptionDetails.exception?.description || r.exceptionDetails.text).split("\n")[0]}`);
    return r.result.value;
  };
  const waitFor = async (expr, timeout = 15000) => {
    const end = Date.now() + timeout;
    for (;;) {
      if (await evaluate(`!!(${expr})`)) return;
      if (Date.now() > end) throw new Error(`wait timed out (${timeout} ms): ${expr}`);
      await sleep(50);
    }
  };
  const check = async ([expr, ...want]) => {
    let v;
    try { v = await evaluate(expr); } catch (e) { fails.push(e.message); return; }
    if (!want.length) { if (!v) fails.push(`${expr} is ${JSON.stringify(v)}`); }
    else if (want[0] instanceof RegExp) { if (!want[0].test(String(v))) fails.push(`${expr} = ${JSON.stringify(v)}, want ${want[0]}`); }
    else if (JSON.stringify(v) !== JSON.stringify(want[0])) fails.push(`${expr} = ${JSON.stringify(v)}, want ${JSON.stringify(want[0])}`);
  };
  const [w, h] = shot.viewport || DEFAULT_VIEWPORT;
  try {
    await S("Page.enable"); await S("Runtime.enable"); await S("Log.enable");
    await S("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await S("Page.addScriptToEvaluateOnNewDocument", { source: PRELUDE });
    const onload = new Promise(r => { loaded = r; });
    await S("Page.navigate", { url: `${base}/${PAGE}?${query(shot)}` });
    await onload;
    await waitFor(READY, 30000);
    // The WebAssembly kernel, not the wasm2js fallback (or the mock): a shot judges the page as it ships.
    await check(["window.VIEW_CPU", "WebAssembly"]);
    // Every web font loaded before anything is judged: a canvas lettered in the fallback face first differs run to run.
    await evaluate(`Promise.all([...document.fonts].map(f => f.load().catch(() => null))).then(() => document.fonts.ready).then(() => true)`);
    await evaluate(FRAMES(2));
    for (const st of shot.steps || []) {
      if (st.js !== undefined) await evaluate(st.js);
      else if (st.expect !== undefined) await check(st.expect);
      else if (st.wait !== undefined) await waitFor(st.wait, st.timeout);
      else if (st.frames !== undefined) await evaluate(FRAMES(st.frames));
      else if (st.ms !== undefined) await sleep(st.ms);
      else if (st.key !== undefined) {
        const [code, name] = KEYS[st.key] || [st.key.toUpperCase().charCodeAt(0), "Key" + st.key.toUpperCase()];
        const text = st.key.length === 1 ? st.key : undefined;
        await S("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key: st.key, code: name, windowsVirtualKeyCode: code, text });
        await S("Input.dispatchKeyEvent", { type: "keyUp", key: st.key, code: name, windowsVirtualKeyCode: code });
      } else if (st.click !== undefined) {
        const at = Array.isArray(st.click) ? st.click : await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(st.click)});
          if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
        if (!at) throw new Error(`click: no element ${st.click}`);
        const [x, y] = at;
        await S("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await S("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await S("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      } else if (st.vp !== undefined) {
        await S("Emulation.setDeviceMetricsOverride", { width: st.vp[0], height: st.vp[1], deviceScaleFactor: 1, mobile: false });
      } else throw new Error(`unknown step ${JSON.stringify(st)}`);
    }
    await evaluate(FRAMES(2));
    for (const e of shot.expect || []) await check(e);
    const err = await evaluate(`(document.getElementById("err") || {}).textContent || ""`);
    if (err) fails.push(`#err: ${err}`);
  } catch (e) {
    fails.push(e.message);
  } finally {
    if (!ctx.cancelled) try {
      const { data } = await S("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUT, shot.name + ".png"), Buffer.from(data, "base64"));
    } catch (e) { fails.push("screenshot: " + e.message); }
    off();
    try { await cdp.send("Target.closeTarget", { targetId }); await cdp.send("Target.disposeBrowserContext", { browserContextId }); } catch { /* closing */ }
  }
  for (const e of errors) if (!(shot.allow || []).some(a => a.test(e))) fails.push(e);
  return fails;
}

// ---- run ----
const t0 = Date.now();
let failed = 0;
try {
  fs.mkdirSync(OUT, { recursive: true });
  const port = await serve();
  cdp = new CDP(await launch());
  await cdp.open;
  for (const shot of chosen) {
    if (cdp.closed || !running()) throw new Error(`${CHROMIUM} is no longer running; ${chosen.length - chosen.indexOf(shot)} shot(s) not run`);
    const t = Date.now(), ctx = { browserContextId: null, cancelled: false }, limit = shot.timeout || SHOT_TIMEOUT;
    let fails, timer;
    try {
      fails = await Promise.race([runShot(cdp, `http://127.0.0.1:${port}`, shot, ctx),
        new Promise(r => { timer = setTimeout(() => r(null), limit); })]);
    } catch (e) { fails = [e.message]; }
    clearTimeout(timer);
    if (fails === null) {   // timed out: close the shot's page, so the next shot starts clean
      ctx.cancelled = true; fails = [`shot timed out (${limit / 1000} s)`];
      if (ctx.browserContextId) await cdp.send("Target.disposeBrowserContext", { browserContextId: ctx.browserContextId }).catch(() => null);
    }
    const secs = ((Date.now() - t) / 1000).toFixed(1);
    if (fails.length) { failed++; console.log(`FAIL ${shot.name} (${secs} s)`); for (const f of fails) console.log(`     ${f}`); }
    else console.log(`PASS ${shot.name} (${secs} s)  build/shots/${shot.name}.png`);
  }
  if (cdp.closed || !running()) throw new Error(`${CHROMIUM} is no longer running`);
  console.log(`shots: ${chosen.length - failed} of ${chosen.length} passed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await finish(failed ? 1 : 0);
} catch (e) {
  console.error(`shoot: ${e.message}`);
  await finish(2);
}
