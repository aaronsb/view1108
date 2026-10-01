// Runs the Fortran kernel headless, as WebAssembly and as the wasm2js
// fallback, and checks the two agree for every scene.
// Usage: node tools/selftest.mjs
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import url from 'url';
const R = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

// LFortran imports libm as env._lfortran_dXXX (and fma from contraction):
// satisfy any of them from Math.
const env = new Proxy({}, {
  has: () => true,
  get(_, k) {
    if (k === 'fma') return (a, b, c) => a * b + c;
    if (k === 'pow') return Math.pow;
    const m = /^_lfortran_d?(\w+?)$/.exec(String(k));
    if (m && typeof Math[m[1]] === 'function') return Math[m[1]];
    throw new Error('selftest: no provider for import env.' + String(k));
  },
});
const wasm = fs.readFileSync(path.join(R, 'build/view.opt.wasm'));
const mod = await WebAssembly.compile(wasm);
const imports = {};
for (const im of WebAssembly.Module.imports(mod)) imports[im.name] = env[im.name];
const W = (await WebAssembly.instantiate(mod, { env: imports })).exports;
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(R, 'build/fallback.js'), 'utf8'), ctx);
const F = ctx.VIEW1108_ASM(imports);

const f64 = (K, name, n) => Array.from(new Float64Array(K.memory.buffer, K[name].value, n));
const i32 = (K, name) => new Int32Array(K.memory.buffer, K[name].value, 1)[0];
function run(K, scene, flags = 3, view = 0, target = 0, lablv = 0, get = null) {
  K.view_init(scene);
  new Int32Array(K.memory.buffer, K.in_flags.value, 1)[0] = flags;
  if (K.in_view) {
    new Int32Array(K.memory.buffer, K.in_view.value, 1)[0] = view;
    new Int32Array(K.memory.buffer, K.in_target.value, 1)[0] = target;
  }
  if (K.in_lablv) new Int32Array(K.memory.buffer, K.in_lablv.value, 1)[0] = lablv;
  if (get !== null) new Float64Array(K.memory.buffer, K.in_get.value, 1)[0] = get;
  K.view_frame();
  const nvec = i32(K, 'nvec'), nstar = i32(K, 'nstar'), nlab = i32(K, 'nlab');
  const ntxt = i32(K, 'ntxt'), nchr = i32(K, 'nchr');
  return { nvec, nstar, nlab, ntxt, hdr: f64(K, 'hdr', 24), vbuf: f64(K, 'vbuf', 5 * nvec),
           lbuf: f64(K, 'lbuf', 4 * nlab),
           tbuf: f64(K, 'tbuf', 4 * ntxt),
           tchr: Array.from(new Int32Array(K.memory.buffer, K.tchr.value, nchr)),
           init: f64(K, 'in_get', 1)[0] };
}
// Scenes and the scenario each runs on (1 Apollo 11 as flown; 2 Apollo 8 as flown, scene 9).
const SCENES = [1, 2, 3, 4, 5, 6, 7, 8, 9], SCN = { 9: 2 };
const maxdiff = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
let ok = true;
for (const scene of SCENES) {
  const a = run(W, scene), b = run(F, scene);
  const t0 = performance.now(); for (let i = 0; i < 50; i++) W.view_frame();
  const ms = (performance.now() - t0) / 50;
  const same = a.nvec === b.nvec && a.nstar === b.nstar && a.nlab === b.nlab &&
               maxdiff(a.hdr, b.hdr) === 0 && maxdiff(a.vbuf, b.vbuf) === 0 &&
               a.ntxt === b.ntxt && maxdiff(a.tbuf, b.tbuf) === 0 &&
               a.tchr.join() === b.tchr.join();
  console.log(`scene ${scene}: GET ${a.hdr[0].toFixed(0)} s  vectors ${a.nvec}/${b.nvec}` +
    `  stars ${a.nstar}/${b.nstar}  labels ${a.nlab}/${b.nlab}  text ${a.ntxt}/${b.ntxt}` +
    `  ${same ? 'identical' : 'DIFFER'}  wasm ${ms.toFixed(2)} ms/frame`);
  if (!same || a.nvec === 0) ok = false;
}
// Views and camera targets (in_view, in_target): every scene external, and window views aimed at the
// Earth, the Moon and the Sun; wasm and the fallback must agree.
if (W.in_view) {
  let same = true, n = 0;
  for (const scene of SCENES)
    for (const [v, t] of [[1, 0], [1, 4], [0, 1], [0, 2], [0, 3], [2, 0], [3, 0], [2, 1]]) {
      const a = run(W, scene, 3, v, t), b = run(F, scene, 3, v, t); n++;
      if (!(a.nvec === b.nvec && a.nstar === b.nstar && maxdiff(a.hdr, b.hdr) === 0 &&
            maxdiff(a.vbuf, b.vbuf) === 0)) same = false;
    }
  console.log(`views and targets: ${n} frames  ${same ? 'identical' : 'DIFFER'}`);
  if (!same) ok = false;
}
// Cabin interiors (in_flags bit 4): the CM and LM stations in every scene with and without the
// bit; wasm and the fallback must agree, and the bit must add lines where a station is drawn.
if (W.in_view) {
  let same = true, n = 0, more = 0;
  for (const scene of SCENES)
    for (const v of [2, 3]) {
      const off = run(W, scene, 3, v, 0), a = run(W, scene, 3 | 16, v, 0), b = run(F, scene, 3 | 16, v, 0); n++;
      if (!(a.nvec === b.nvec && maxdiff(a.hdr, b.hdr) === 0 && maxdiff(a.vbuf, b.vbuf) === 0)) same = false;
      if (a.nvec > off.nvec) more++;
    }
  console.log(`cabins: ${n} frames  ${same ? 'identical' : 'DIFFER'}  ${more} with interior lines`);
  if (!same || more === 0) ok = false;
}
// Label levels (in_lablv 0-3) with vehicle labels, markers and the launch pad: every scene in
// its own view and external, plus frames where markers or the pad show (scene 6 in the LM's
// descent, scene 1 external on the Moon, scene 3 over Florida); wasm and the fallback must agree
// on vectors, labels and text.
if (W.in_lablv) {
  let same = true, n = 0, kinds = new Set();
  const cases = [];
  for (const scene of SCENES)
    for (const v of [0, 1]) for (const lv of [0, 1, 2, 3]) cases.push([scene, v, 0, lv, null]);
  for (const lv of [1, 2, 3])
    cases.push([6, 0, 0, lv, 369640], [1, 1, 2, lv, null], [3, 0, 0, lv, 5800], [3, 1, 1, lv, 1200],
               [9, 1, 1, lv, 8000]);
  for (const [scene, v, t, lv, get] of cases) {
    const a = run(W, scene, 3, v, t, lv, get), b = run(F, scene, 3, v, t, lv, get); n++;
    for (let i = 0; i < a.nlab; i++) kinds.add(a.lbuf[4 * i + 2]);
    if (!(a.nvec === b.nvec && a.nlab === b.nlab && maxdiff(a.hdr, b.hdr) === 0 &&
          maxdiff(a.vbuf, b.vbuf) === 0 && maxdiff(a.lbuf, b.lbuf) === 0 && a.ntxt === b.ntxt &&
          maxdiff(a.tbuf, b.tbuf) === 0 && a.tchr.join() === b.tchr.join())) same = false;
  }
  // The new label kinds must actually occur: 8 vehicles, 9 the launch pad.
  const seen = kinds.has(8) && kinds.has(9);
  console.log(`label levels: ${n} frames  ${same ? 'identical' : 'DIFFER'}  vehicle and pad labels ${seen ? 'seen' : 'MISSING'}`);
  if (!same || !seen) ok = false;
}
// Scene 9 (Apollo 8 Earthrise, scenario 2): its own g.e.t. base (hdr 16 = the Apollo 8 epoch
// less Apollo 11's, -17,887,260 s), the Earth in the frame, and scene 1 unchanged after it.
{
  const a = run(W, 9), b = run(F, 9), c = run(W, 1);
  const good = a.hdr[6] === 9 && Math.abs(a.hdr[15] + 17887260) < 0.1 && a.hdr[0] === 272919.7 &&
               maxdiff(a.vbuf, b.vbuf) === 0 && c.hdr[15] === 0 && a.nvec > 0;
  console.log(`scene 9: g.e.t. ${a.hdr[0]} s, epoch offset ${a.hdr[15].toFixed(2)} s  ${good ? 'ok' : 'WRONG'}`);
  if (!good) ok = false;
}
// Simulation mode: run the engine with delta correction on (1) and off (0), then draw every
// scene from the tape (in_flags bit 3) and check wasm and the fallback agree; also time sim_run.
if (W.sim_run) {
  for (const sf of [1, 0]) {
    let same = true, drawn = 0, ms = 0, last = 0;
    for (const scene of SCENES) {
      // The engine runs over the current scenario: once for each scenario, after its scene's view_init.
      if ((SCN[scene] || 1) !== last) {
        last = SCN[scene] || 1; W.view_init(scene); F.view_init(scene);
        const t0 = performance.now(); W.sim_run(sf); ms += performance.now() - t0; F.sim_run(sf);
      }
      const a = run(W, scene, 3 | 8), b = run(F, scene, 3 | 8);
      if (!(a.nvec === b.nvec && a.nstar === b.nstar && maxdiff(a.hdr, b.hdr) === 0 &&
            maxdiff(a.vbuf, b.vbuf) === 0)) same = false;
      if (a.hdr[16] > 0) drawn++;
    }
    console.log(`sim flags ${sf}: sim_run ${ms.toFixed(1)} ms (wasm, both scenarios)  scenes drawn from the tape ${drawn}` +
      `  ${same ? 'identical' : 'DIFFER'}`);
    if (!same || drawn === 0) ok = false;
  }
}
console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1);
