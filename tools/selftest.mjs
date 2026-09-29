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
function run(K, scene) {
  K.view_init(scene);
  new Int32Array(K.memory.buffer, K.in_flags.value, 1)[0] = 3;
  K.view_frame();
  const nvec = i32(K, 'nvec'), nstar = i32(K, 'nstar'), nlab = i32(K, 'nlab');
  const ntxt = i32(K, 'ntxt'), nchr = i32(K, 'nchr');
  return { nvec, nstar, nlab, ntxt, hdr: f64(K, 'hdr', 16), vbuf: f64(K, 'vbuf', 5 * nvec),
           tbuf: f64(K, 'tbuf', 4 * ntxt),
           tchr: Array.from(new Int32Array(K.memory.buffer, K.tchr.value, nchr)),
           init: f64(K, 'in_get', 1)[0] };
}
const maxdiff = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);
let ok = true;
for (const scene of [1, 2, 3, 4, 5]) {
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
console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1);
