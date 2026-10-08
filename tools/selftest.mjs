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

// The run decks through the kernel's card reader (src/vdeck.f), one line a card, each file closed with deck_file; the
// kernel has no other source of its scenarios and situations. It holds one scenario reel's decks at a time, each reel
// numbering its own scenario and situations (#26 slice 7e): REELS_IN the scenario reels in load order
// (build/decks/reels.txt), DECKS[reel] their decks (build/decks/<reel>.txt, tools/gen_data.py), LINES[reel] their cards.
const REELS_IN = fs.readFileSync(path.join(R, 'build/decks/reels.txt'), 'utf8').split('\n').filter(Boolean);
const DECKS = Object.fromEntries(REELS_IN.map(r =>
  [r, fs.readFileSync(path.join(R, 'build/decks', r + '.txt'), 'utf8').split('\n').filter(Boolean)]));
const EOF = '\u0000end of file';
const LINES = Object.fromEntries(REELS_IN.map(r =>
  [r, DECKS[r].flatMap(p => [...fs.readFileSync(path.join(R, p), 'utf8').replace(/\n$/, '').split('\n'), EOF])]));
const A11 = REELS_IN[0];   // the first scenario reel, the page's boot reel (Apollo 11)
const enc = new TextEncoder();
// The reel each kernel instance holds (use), or none after any other load.
const held = new Map();
function load(K, lines, reel = null) {
  held.delete(K);
  K.deck_open();
  for (const ln of lines) {
    if (ln === EOF) { K.deck_file(); continue; }
    const b = enc.encode(ln), card = new Int32Array(K.memory.buffer, K.in_card.value, 1024);
    for (let i = 0; i < Math.min(b.length, 1024); i++) card[i] = b[i];
    K.deck_card(b.length);
  }
  K.deck_close();
  const r = ['out_dkerr', 'out_dkcrd', 'out_dkwrn'].map(g => new Int32Array(K.memory.buffer, K[g].value, 1)[0]);
  if (reel && !r[0]) held.set(K, reel);
  return r;
}
// Scenario reel `reel`'s decks into K unless it holds them already, as the page's useDeck (web/src/kernel.js).
function use(K, reel) {
  if (held.get(K) === reel) return;
  const [e, c] = load(K, LINES[reel], reel);
  if (e) throw new Error(`selftest: ${reel}: the decks were refused, deck error ${e} at card ${c}`);
}
for (const K of [W, F]) for (const r of [...REELS_IN].reverse()) use(K, r);

const f64 = (K, name, n) => Array.from(new Float64Array(K.memory.buffer, K[name].value, n));
const i32 = (K, name) => new Int32Array(K.memory.buffer, K[name].value, 1)[0];
// One frame of situation s ({reel, id}, a row of SIT below) in K, its reel's decks loaded first.
function run(K, s, flags = 3, view = 0, target = 0, lablv = 0, get = null) {
  use(K, s.reel);
  K.view_init(s.id);
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
// The page's data (#26 slices 7d, 7e): the reel packages the page embeds (build/reels.js, tools/pack.py), unpacked by
// the page's own reader and read by its own reelPages (web/src/reelpkg.js): the situations, each with its reel, its id
// there and its scene (its place across the reels), each reel's scenario and spans (SCNS) and timeline (TL), by reel
// id, and the playlist reels (LISTS). The cases below pick situations by what their cards say, not by number.
const crypto = await import('crypto'), { execFileSync } = await import('child_process');
const ctxR = vm.createContext({ atob, TextDecoder, Blob, Response, DecompressionStream, Uint8Array, JSON, Error,
  Map, Number, String, parseInt, Math });
const RP = vm.runInContext(fs.readFileSync(path.join(R, 'web/src/reelpkg.js'), 'utf8') +
  '\n({ readReel, reelDecks, untar, reelPages, sceneOfLink })', ctxR);
const reelsJs = fs.readFileSync(path.join(R, 'build/reels.js'), 'utf8');
const VR = vm.runInNewContext(reelsJs + '\nVIEW_REELS');
const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(R, 'build/view.opt.wasm'))).digest('hex');
const reels = [];
for (const r of VR) reels.push(await RP.readReel(r.b64, sha, r.id));
const PAGE = RP.reelPages(reels), SIT = PAGE.sits, SCNS = PAGE.scns, TL = PAGE.tl, LISTS = PAGE.lists;
const SCENES = SIT;
const sname = s => `${s.reel}/${s.id}`;
const sitWhere = (what, f) => { const s = SIT.find(f); if (!s) throw new Error('selftest: no situation ' + what); return s; };
const DOCK = sitWhere('with the docking pose (POSE=S7POSE)', s => s.pose === 'S7POSE');
const DISC = sitWhere('body-centred (RECIPE BODYCTR)', s => s.recipe === 'BODYCTR');
const LUNAR = sitWhere('on the local vertical aimed at the Moon', s => s.recipe === 'LOCALVERT' && s.target === 'MOON');
const EARTHLV = sitWhere('on the local vertical aimed at the Earth', s => s.recipe === 'LOCALVERT' && s.target === 'EARTH');
const OTHER = sitWhere('of a second scenario reel', s => s.reel !== A11);
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
  console.log(`scene ${scene.scene} (${sname(scene)}): GET ${a.hdr[0].toFixed(0)} s  vectors ${a.nvec}/${b.nvec}` +
    `  stars ${a.nstar}/${b.nstar}  labels ${a.nlab}/${b.nlab}  text ${a.ntxt}/${b.ntxt}` +
    `  ${same ? 'identical' : 'DIFFER'}  wasm ${ms.toFixed(2)} ms/frame`);
  if (!same || a.nvec === 0) ok = false;
}
// Views and camera targets (in_view, in_target): every scene external, and window views aimed at the
// Earth, the Moon, the Sun and the S-IVB; wasm and the fallback must agree.
if (W.in_view) {
  let same = true, n = 0;
  for (const scene of SCENES)
    for (const [v, t] of [[1, 0], [1, 4], [0, 1], [0, 2], [0, 3], [2, 0], [3, 0], [2, 1], [0, 6], [1, 6]]) {
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
// Window mask (in_flags bit 5): with the cabin (bit 4) in the CM and LM stations, the outside only
// through the windows. Wasm and the fallback must agree; bit 5 without bit 4 changes nothing; a
// masked frame never has more vectors, stars or labels than the unmasked one, and some have fewer.
// The docking situation's CM station looks along +X at the LM, where the CM has no window:
// unmasked, the LM's lines cross the middle of the frame; masked, the only line there is the
// X-axis mark (CMCAB, about 1 deg from the centre).
if (W.in_view) {
  let same = true, inert = true, fewer = 0, n = 0, never = true;
  for (const scene of SCENES)
    for (const v of [2, 3]) {
      const u = run(W, scene, 3 | 16, v, 0, 3), a = run(W, scene, 3 | 16 | 32, v, 0, 3), b = run(F, scene, 3 | 16 | 32, v, 0, 3); n++;
      if (!(a.nvec === b.nvec && a.nstar === b.nstar && a.nlab === b.nlab && maxdiff(a.vbuf, b.vbuf) === 0 &&
            maxdiff(a.lbuf, b.lbuf) === 0 && maxdiff(a.tbuf, b.tbuf) === 0)) same = false;
      const o = run(W, scene, 3, v, 0, 3), o5 = run(W, scene, 3 | 32, v, 0, 3);
      if (!(o.nvec === o5.nvec && o.nstar === o5.nstar && maxdiff(o.vbuf, o5.vbuf) === 0)) inert = false;
      if (a.nvec > u.nvec || a.nstar > u.nstar || a.nlab > u.nlab) never = false;
      if (a.nvec < u.nvec) fewer++;
    }
  // Lines with a point within 3 deg of the centre (ends and midpoint), and their largest reach.
  const mid = r => { let c = 0, far = 0; for (let i = 0; i < r.nvec; i++) {
    const p = r.vbuf.slice(5 * i, 5 * i + 4), q = [[p[0], p[1]], [p[2], p[3]], [(p[0] + p[2]) / 2, (p[1] + p[3]) / 2]];
    if (q.some(([x, y]) => Math.hypot(x, y) < 3)) { c++; far = Math.max(far, ...q.map(([x, y]) => Math.hypot(x, y))); } }
    return [c, far]; };
  const [cu] = mid(run(W, DOCK, 1 | 16, 2)), [cm, fm] = mid(run(W, DOCK, 1 | 16 | 32, 2));
  const centre = cu > 20 && cm > 0 && fm < 1.2;
  console.log(`window mask: ${n} frames  ${same ? 'identical' : 'DIFFER'}  bit 5 alone ${inert ? 'inert' : 'CHANGES FRAMES'}` +
    `  ${fewer} with fewer vectors${never ? '' : '  MORE IN SOME'}  scene ${DOCK.scene} centre: ${cu} lines unmasked, ${cm} masked` +
    ` (out to ${fm.toFixed(2)} deg)${centre ? '' : '  WRONG'}`);
  if (!same || !inert || !never || fewer === 0 || !centre) ok = false;
}
// Label levels (in_lablv 0-3) with vehicle labels, markers and the launch pad: every scene in
// its own view and external, plus frames where markers or the pad show (the Moon view in the LM's
// descent, Earthrise external on the Moon, the Earth limb over Florida, Apollo 8 in its ascent);
// wasm and the fallback must agree on vectors, labels and text.
if (W.in_lablv) {
  let same = true, n = 0, kinds = new Set();
  const cases = [];
  for (const scene of SCENES)
    for (const v of [0, 1]) for (const lv of [0, 1, 2, 3]) cases.push([scene, v, 0, lv, null]);
  for (const lv of [1, 2, 3])
    cases.push([DISC, 0, 0, lv, 369640], [LUNAR, 1, 2, lv, null], [EARTHLV, 0, 0, lv, 5800],
               [EARTHLV, 1, 1, lv, 1200], [OTHER, 1, 1, lv, 8000]);
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
// Every situation as its cards say: hdr(7) its id in its reel, hdr(1) its default g.e.t. where the cards fix
// it (an EVENT plus an offset, or a g.e.t.; not ERISE, which ERFIND computes), hdr(16) its
// scenario's epoch offset from Apollo 11's range zero (its page.json range zero less A11_ZERO, to
// the 0.1 s the EPOCH card's JD gives); and the first again afterwards, unchanged by the
// scenarios after it.  Those expected values come from the same cards, so two facts are also held
// here as literals, independent of the cards: Apollo 8's epoch offset, -17,887,260 s (its range
// zero 1968-12-21 12:51:00 UTC, MR8 p. 2-1, less Apollo 11's; CLAUDE.md, hdr(16)), and its
// Earthrise photograph's g.e.t., 75:48:39.7 = 272,919.7 s (SVS 4129, the PHOTO event).
const A11_ZERO = Date.UTC(1969, 6, 16, 13, 32, 0);   // Apollo 11's range zero, 1969-07-16 13:32:00 UTC (CLAUDE.md, in_get)
{
  const a = run(W, OTHER), b = run(F, OTHER);
  const good = Math.abs(a.hdr[15] + 17887260) < 0.1 && a.hdr[0] === 272919.7 && maxdiff(a.vbuf, b.vbuf) === 0;
  console.log(`Apollo 8 (scene ${OTHER.scene}, ${sname(OTHER)}): g.e.t. ${a.hdr[0]} s, epoch offset ${a.hdr[15].toFixed(2)} s  ${good ? 'ok' : 'WRONG'}`);
  if (!good) ok = false;
}
{
  const bad = [];
  for (const s of [...SIT, SIT[0]]) {
    const a = run(W, s), b = run(F, s), ep = (SCNS[s.reel].zero - A11_ZERO) / 1000;
    if (!(a.hdr[6] === s.id && Math.abs(a.hdr[15] - ep) < 0.1 && (s.get === null || Math.abs(a.hdr[0] - s.get) < 1e-6) &&
          maxdiff(a.vbuf, b.vbuf) === 0 && a.nvec > 0)) bad.push(sname(s));
  }
  console.log(`situations: ${SIT.length} as their cards say (default g.e.t., epoch offset from the range zeros)  ${bad.length ? 'WRONG: ' + bad.join(' ') : 'ok'}`);
  if (bad.length) ok = false;
}
// The page's data from the reels (#26 slices 7d, 7e): each reel's page.json is build/page/<id>.json as tools/gen_data.py
// wrote it; a scenario reel's holds its scenario, numbered 1, the situations build/scenes.json (gen_data's scene list)
// gives that reel, in id order from 1, and its spans and timeline, every span naming one of them. Literals, so it is not
// only the files against themselves: the Apollo 8 Earthrise situation's default g.e.t., 272,919.7 s (SVS 4129, as
// above), and the range zeros, 1969-07-16 13:32:00 UTC (Apollo 11) and 1968-12-21 12:51:00 UTC (Apollo 8, MR8 p. 2-1).
// Addressing: every scene=N in docs/ and README.md (the old links, #22) opens the Nth situation of build/scenes.json's
// reels in order, as one numbering gave them before #26 slice 7e (scene=9: Apollo 8's Earthrise, a literal); and that
// situation's (scn, sit) by id and by NAME open the same scene.
{
  const bad = [], scenes = JSON.parse(fs.readFileSync(path.join(R, 'build/scenes.json'), 'utf8'));
  for (const r of reels) {
    const id = r.manifest.id, f = path.join(R, 'build/page', id + '.json');
    if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== r.files.get('page.json')) bad.push(`${id}: page.json is not ${f}`);
    if (r.manifest.kind !== 'scenario') continue;
    const want = (scenes.reels.find(x => x.id === id) || { scenes: [] }).scenes;
    if (r.page.scenario.id !== 1 || r.page.situations.map(s => s.id).join() !== want.join() || want[0] !== 1)
      bad.push(`${id}: scenario ${r.page.scenario.id}, situations ${r.page.situations.map(s => s.id)}, not 1 and ${want}`);
    if (!r.page.timeline.events.length || !Object.values(r.page.scenario.spans).some(t => t.length)) bad.push(`${id}: no timeline or spans`);
  }
  if (scenes.reels.map(x => x.id).join() !== REELS_IN.join()) bad.push(`scenes.json's reels ${scenes.reels.map(x => x.id)}, not ${REELS_IN}`);
  const zero = { 'APOLLO 11': A11_ZERO, 'APOLLO 8': Date.UTC(1968, 11, 21, 12, 51, 0) };
  for (const [m, z] of Object.entries(zero))
    if (!Object.values(SCNS).some(c => c.mission === m && c.zero === z)) bad.push(`${m}: range zero not ${new Date(z).toISOString()}`);
  const a8 = OTHER;
  if (!(a8.get === 272919.7 && SCNS[a8.reel].mission === 'APOLLO 8')) bad.push(`Apollo 8 Earthrise: default g.e.t. ${a8.get}`);
  const md = [path.join(R, 'README.md'), ...fs.readdirSync(path.join(R, 'docs'), { recursive: true })
    .filter(f => f.endsWith('.md')).map(f => path.join(R, 'docs', f))];
  const old = [...new Set(md.flatMap(f => [...fs.readFileSync(f, 'utf8').matchAll(/[?&]scene=(\d+)/g)].map(m => +m[1])))].sort((x, y) => x - y);
  const oneNumbering = scenes.reels.flatMap(x => x.scenes.map(id => [x.id, id]));   // [reel, id] for scene 1, 2, ...
  for (const n of old) {
    const sc = RP.sceneOfLink(SIT, null, null, n), s = SIT[sc - 1] || {}, w = oneNumbering[n - 1] || [];
    if (!(sc === n && s.reel === w[0] && s.id === w[1])) bad.push(`scene=${n} opens ${s.reel}/${s.id}, not ${w.join('/')}`);
    if (RP.sceneOfLink(SIT, s.reel, String(s.id), null) !== sc || RP.sceneOfLink(SIT, s.reel, s.name.toLowerCase(), null) !== sc)
      bad.push(`scn=${s.reel}&sit=${s.id} (or its name) does not open scene ${sc}`);
  }
  if (!old.length) bad.push('no scene=N link in docs/ or README.md');
  const nine = SIT[RP.sceneOfLink(SIT, null, null, 9) - 1] || {};
  if (!(nine.name === 'APOLLO 8 EARTHRISE' && nine.id === 1 && nine.reel === 'apollo8-asflown')) bad.push(`scene=9 opens ${nine.reel}/${nine.id}`);
  try { RP.reelPages([{ manifest: { id: 'nopage' }, page: null }]); bad.push('a reel without page.json: not refused'); }
  catch (err) { if (!/^REEL nopage: no page\.json$/.test(err.message)) bad.push(`a reel without page.json: "${err.message}"`); }
  // A playlist using a scenario reel the page does not hold, and one whose shot names a situation its reel lacks.
  const tour = reels.find(r => r.manifest.id === 'tour'), scen = reels.filter(r => r.manifest.kind === 'scenario');
  for (const [what, rs, re] of [
    ['a playlist using a reel not held', [scen[0], tour], /^REEL tour: uses apollo8-asflown, which this page does not hold$/],
    ['a shot naming a situation its reel lacks', [...scen, { ...tour, page: { ...tour.page, shots: [{ ...tour.page.shots[0], sit: 99 }] } }],
      /^REEL tour: shot 1 names apollo11-asflown situation 99, which that reel does not hold$/]]) {
    try { RP.reelPages(rs); bad.push(`${what}: not refused`); } catch (err) { if (!re.test(err.message)) bad.push(`${what}: "${err.message}"`); }
  }
  console.log(`page data: ${reels.length} reels' page.json, ${SIT.length} situations; old links scene=${old.join(',')} ` +
    `open the same (reel, situation)  ${bad.length ? 'WRONG: ' + bad.join('; ') : 'ok'}`);
  if (bad.length) ok = false;
}
// The playlist reels (#18, packed as reels in #26 slice 7e; data/reels/*/run.scn): every shot's situation exists in the
// scenario reel it names (REEL=), which its manifest lists in `uses`, and its g.e.t. at start and end lies inside that
// situation's scenario (from its first to its last TIMELINE row) and draws there (the kernel takes it as given: hdr(1)
// is that g.e.t., hdr(7) the situation's id in its reel, its reel's decks loaded first, so the tour crosses reels). An
// ERISE shot's times are offsets from the kernel's Earthrise (out_terise, after view_init of its situation), as the
// player resolves them. Literals, so the check is not only the cards against themselves: the demo reel's Earthrise shot
// starts 30 s after the situation's own default (ERFIND's Earthrise less 60 s, as the kernel computes it) and the
// tour's at it, both to 1 ulp; the demo's LM descent shot starts at 369,656 s (102:40:56, the film fit: 27 s = 369,676
// s and 35 s = 369,840 s, extrapolated to 26 s); and the tour uses both scenario reels.
{
  const bad = [];
  const terise = s => { use(W, s.reel); W.view_init(s.id); return W.out_terise ? f64(W, 'out_terise', 1)[0] : NaN; };
  const ulp = x => Math.abs(x) * Number.EPSILON;
  const sitOf = sh => SIT.find(x => x.reel === sh.reel && x.id === sh.sit);
  let n = 0;
  for (const [id, r] of Object.entries(LISTS))
    r.shots.forEach((sh, k) => {
      const s = sitOf(sh), where = `${id} shot ${k + 1}`;
      const man = reels.find(x => x.manifest.id === id).manifest;
      if (!s || s.scene !== sh.scene || !man.uses.includes(sh.reel)) { bad.push(where + ' (no situation)'); return; }
      const ev = TL[s.reel].events.map(e => e[0]);
      const base = sh.rule === 'ERISE' ? terise(s) : 0;
      const g = sh.get ? sh.get.map(x => base + x) : [sh.at - sh.tte[0][1], sh.at - sh.tte[sh.tte.length - 1][1]];
      for (const t of g) {
        const a = run(W, s, 3, sh.view, 0, 0, t); n++;
        if (!(t >= Math.min(...ev) && t <= Math.max(...ev) && a.hdr[0] === t && a.hdr[6] === sh.sit && a.nvec > 0))
          bad.push(`${where} (${sh.name}) at ${t} s`);
      }
    });
  const demo = (LISTS.demo || { shots: [] }).shots;
  const lmd = demo.find(sh => (sitOf(sh) || {}).recipe === 'CREWSTN');
  for (const [id, after] of [['demo', 30], ['tour', 0]]) {
    const rise = ((LISTS[id] || { shots: [] }).shots).find(sh => (sitOf(sh) || {}).get_rule === 'ERISE-60');
    const def = rise && run(W, sitOf(rise)).init, start = rise && terise(sitOf(rise)) + rise.get[0];
    if (!rise || !(Math.abs(start - (def + after)) <= ulp(start)))
      bad.push(`${id} Earthrise: start ${start} s, the situation's default ${def} s plus ${after}`);
  }
  if (!lmd || lmd.get[0] !== 369656) bad.push(`demo LM descent: start ${lmd && lmd.get[0]} s, not 369656`);
  const tourUses = (reels.find(x => x.manifest.id === 'tour') || { manifest: {} }).manifest.uses || [];
  if (tourUses.join() !== 'apollo11-asflown,apollo8-asflown') bad.push(`the tour uses ${tourUses}`);
  console.log(`playlists: ${Object.keys(LISTS).length} (${Object.keys(LISTS).join(', ')}), ${n} shot ends in their scenarios` +
    `  ${bad.length ? 'WRONG: ' + bad.join('; ') : 'ok'}`);
  if (bad.length || !LISTS.demo) ok = false;
}
// Simulation mode: run the engine with delta correction on (1) and off (0), then draw every
// scene from the tape (in_flags bit 3) and check wasm and the fallback agree; also time sim_run.
if (W.sim_run) {
  for (const sf of [1, 0]) {
    let same = true, drawn = 0, ms = 0, last = '';
    for (const scene of SCENES) {
      // The engine runs over the current scenario: once for each scenario reel, after its scene's view_init.
      if (scene.reel !== last) {
        last = scene.reel;
        for (const K of [W, F]) { use(K, scene.reel); K.view_init(scene.id); }
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
// Switching reels (#26 slice 7e): the kernel holds one scenario reel's decks at a time and the page reloads them when
// the situation's reel differs (web/src/kernel.js useDeck). Every situation of the first reel, then of the second,
// then of the first again, in one instance (wasm and the fallback), draws the same frames (default view, labels at all
// levels, external) as each reel's decks loaded into a fresh instance; and the reload time, wasm and fallback.
{
  const fresh = async () => (await WebAssembly.instantiate(mod, { env: imports })).exports;
  const frames = (K, s) => [run(K, s, 3), run(K, s, 3, 0, 0, 3), run(K, s, 3, 1, 0, 2)];
  const same = (x, y) => x.every((a, i) => { const b = y[i]; return a.nvec === b.nvec && a.nstar === b.nstar && a.nlab === b.nlab &&
    a.ntxt === b.ntxt && maxdiff(a.hdr, b.hdr) === 0 && maxdiff(a.vbuf, b.vbuf) === 0 && maxdiff(a.lbuf, b.lbuf) === 0 &&
    maxdiff(a.tbuf, b.tbuf) === 0 && a.tchr.join() === b.tchr.join(); });
  const want = new Map();
  for (const r of REELS_IN) {
    const K = await fresh();
    for (const s of SIT.filter(x => x.reel === r)) want.set(s, frames(K, s));
  }
  const wrong = [];
  let n = 0;
  for (const [name, K] of [['wasm', await fresh()], ['fallback', ctx.VIEW1108_ASM(imports)]])
    for (const r of [A11, ...REELS_IN.slice(1), A11])
      for (const s of SIT.filter(x => x.reel === r)) { n++; if (!same(frames(K, s), want.get(s))) wrong.push(`${name} ${sname(s)}`); }
  // Reload time: alternate the reels' decks into one instance, each load timed.
  const time = {};
  for (const [name, K] of [['wasm', await fresh()], ['fallback', ctx.VIEW1108_ASM(imports)]])
    for (let i = 0; i < 20; i++) for (const r of REELS_IN) {
      const t0 = performance.now(); load(K, LINES[r], r); const dt = performance.now() - t0;
      if (i >= 2) (time[`${name} ${r}`] ||= []).push(dt);
    }
  const ms = Object.entries(time).map(([k, v]) => `${k} ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)} ms`);
  console.log(`reel switch: ${n} situations through ${REELS_IN.length + 1} reel loads per instance  ` +
    `${wrong.length ? 'DIFFER: ' + wrong.join(' ') : 'the same frames as a fresh load of each reel'};  deck reload ${ms.join(', ')}`);
  if (wrong.length) ok = false;
}
// The card reader (src/vdeck.f, #26): the run tables each scenario reel's decks give, as a hash total (deck_sum), are
// the same in wasm, in the fallback and in the native driver (gfortran, its own reader; build/viewsvg with VIEW_REEL
// and VIEW_DKSUM).  Then planted faults in a deck (the first reel's, or the second's where it holds the case), each
// refused with its own deck error, both reels' decks loaded together refused (each numbers its own scenario 1), and
// a refused deck leaving nothing behind for the next load.
const sumOf = K => { K.deck_sum(); return Array.from(new Int32Array(K.memory.buffer, K.out_dksum.value, 4)).join(' '); };
const nativeSum = reel => fs.existsSync(path.join(R, 'build/viewsvg')) ? execFileSync(path.join(R, 'build/viewsvg'), { cwd: R,
  env: Object.fromEntries(Object.entries({ ...process.env, VIEW_DKSUM: '1', VIEW_REEL: reel }).filter(([k]) => k !== 'VIEW_DECK')) })
  .toString().trim() : 'not built';
{
  const fresh = async () => (await WebAssembly.instantiate(mod, { env: imports })).exports;
  const sums = {};
  let good = true;
  for (const r of REELS_IN) {
    use(W, r); use(F, r);
    const sw = sumOf(W), sf = sumOf(F), sn = nativeSum(r);
    sums[r] = sw;
    if (!(sf === sw && (sn === 'not built' || sn === sw))) good = false;
    console.log(`card reader: ${r}: ${DECKS[r].length} decks, ${LINES[r].length - DECKS[r].length} lines; hash total ${sw}` +
      ` (fallback ${sf}, native ${sn})  ${sf === sw && (sn === 'not built' || sn === sw) ? 'equal' : 'DIFFER'}`);
  }
  if (!good) ok = false;
  // Planted faults: [what, expected deck error, the deck's lines].
  const L1 = LINES[A11], L2 = LINES[OTHER.reel];
  const at = (re, f, L = L1) => { const i = L.findIndex(l => re.test(l)); return L.map((l, j) => j === i ? f(l) : l); };
  const tl = L1.find(l => l.startsWith('TIMELINE ')), lastEOF = L1.length - 1;
  const without = re => L1.filter(l => !re.test(l));
  const cases = [
    ['a card of 1100 codes', 1, at(/^EVENT /, l => l + ' SRC="' + 'x'.repeat(1100) + '"')],
    ['a number with two points', 2, at(/^EVENT /, l => l.replace(/ T=\S+/, ' T=1.2.3'))],
    ['eighteen digits', 3, at(/^EPOCH /, l => l.replace(/JD=\S+/, 'JD=2440419.06388900000'))],
    ['an unknown event kind', 4, at(/^EVENT /, l => l.replace(/KIND=\S+/, 'KIND=NOPE'))],
    ['an EVENT without T=', 5, at(/^EVENT /, l => l.replace(/ T=\S+/, ''))],
    ['a ROW outside a TABLE leg', 6, at(/^EVENT /, l => l + '\nROW T=1 LAT=0 LON=0 ALT=0 V=0 FPA=0 HDG=0').flatMap(l => l.split('\n'))],
    ['a scenario ID past the table', 7, at(/^SCENARIO /, l => l.replace(/ID=\S+/, 'ID=99'))],
    ['a situation ID given twice', 8, at(/^SITUATION ID=2 /, l => l.replace('ID=2', 'ID=1'))],
    ['both reels at once (scenario 1 twice)', 8, [...L1, ...L2]],
    ['TABLE rows out of order', 9, at(/^ROW /, l => l.replace(/ T=\S+/, ' T=999:00:00'))],
    ['a burn cue naming no row', 10, at(/^BURNCUE /, l => l.replace(/IGN="[^"]*"/, 'IGN="NO SUCH ROW"'))],
    ['the timeline over its maximum', 16, [...L1.slice(0, lastEOF), ...Array(1500).fill(tl), EOF]],
    ['a situation ID past a gap', 20, at(/^SITUATION ID=8 /, l => l.replace('ID=8', 'ID=12'))],
    ['a scenario ID 2 in a reel of one', 20, at(/^SCENARIO /, l => l.replace(/ID=\S+/, 'ID=2'), L2)],
    ['an open quote', 21, at(/^TIMELINE /, l => l + ' "')],
    ['a word without =', 21, at(/^EVENT /, l => l + ' LOOSE')],
    ['a layer named twice', 22, at(/^SITUATION /, l => l.replace(/LAYERS=(\w+)/, 'LAYERS=$1,$1'))],
    ['a pad name of eight characters', 23, at(/^PAD /, l => l.replace(/NAME=\S+/, 'NAME=LC-39A12'))],
    ['a second, different SITE NAME', 23, at(/^EPOCH /, l => l + '\nSITE NAME="OTHER" LAT=0 LON=0 AZ=0').flatMap(l => l.split('\n'))],
    ['no situation', 24, without(/^(SITUATION|RECIPE|VIEWS|HDRREF) /)],
    ['EPOCH before MISSION', 25, at(/^MISSION /, l => 'EPOCH JD=1\n' + l).flatMap(l => l.split('\n'))],
    ['a scenario without legs', 26, without(/^(LEG|ROW) /)],
    ['a GET= event the scenario lacks', 27, at(/^SITUATION ID=1 /, l => l.replace(/GET=\S+/, 'GET=SLING+10'), L2)],
    ['a scenario file without its SCENARIO card', 6, L1.filter(l => !l.startsWith('SCENARIO '))],
  ];
  const wrong = [];
  for (const [what, want, lines] of cases) {
    const K = await fresh(), [e, c] = load(K, lines);
    if (e !== want || i32(K, 'out_dkerr') !== want) wrong.push(`${what}: deck error ${e} at card ${c}, not ${want}`);
  }
  // A refused deck leaves the tables empty and draws nothing; the next good deck loads clean.
  const K = await fresh(), [e1] = load(K, cases[0][2]);
  K.view_init(1); K.view_frame();
  const empty = i32(K, 'nvec') === 0 && i32(K, 'nstar') === 0;
  const [e2] = load(K, L1), again = sumOf(K);
  if (!(e1 !== 0 && empty && e2 === 0 && again === sums[A11]))
    wrong.push(`a refused deck, then a good one: errors ${e1}, ${e2}, empty frame ${empty}, hash ${again}`);
  // view_frame straight after a reload, without view_init: nothing from the last deck's situation.
  K.view_init(1); K.view_frame();
  load(K, cases[0][2]); K.view_frame();
  const emptyAfter = i32(K, 'nvec') === 0;
  load(K, L1); K.view_frame();
  if (!(emptyAfter && i32(K, 'nvec') > 0))
    wrong.push(`view_frame after a reload without view_init: empty ${emptyAfter}, then ${i32(K, 'nvec')} vectors`);
  console.log(`deck errors: ${cases.length} planted faults, then a good deck after a refused one` +
    `  ${wrong.length ? 'WRONG: ' + wrong.join('; ') : 'each refused, reload clean'}`);
  if (wrong.length) ok = false;
}
// Tapes as data (src/vdktap.f, #26 slice 6): the engine's tape, written by the native driver as a deck (tools/vtape.f,
// VIEW_TAPEW) and read back by the wasm and fallback card readers after its reel's run decks, gives the native reader's
// hash total: the same bits, so the 17-digit numbers read exactly here too.  The frame drawn from it (in_flags bit 3),
// in fresh instances, is the same in wasm and the fallback, with the source a deck tape: hdr(17) 3, hdr(18..20) 0.
// (That it equals the engine's own frame is the golden gate's tape round trip, natively: the gfortran and wasm engines
// differ in their last digits.)  Each scenario reel's first situation.  Then planted faults in a tape, each refused
// with its own deck error.
const VSVG = path.join(R, 'build/viewsvg');
if (W.sim_run && fs.existsSync(VSVG)) {
  const fresh = async () => (await WebAssembly.instantiate(mod, { env: imports })).exports;
  const nenv = extra => { const e = { ...process.env, ...extra }; for (const k of ['VIEW_DECK', 'VIEW_REEL', 'VIEW_SIM', 'VIEW_TAPEW',
    'VIEW_DKSUM', 'VIEW_DUMP', 'VIEW_HDR', 'VIEW_TIME']) if (!(k in extra)) delete e[k]; return e; };
  const tapeFile = path.join(R, 'build/selftest-tape.tsv'), wrong = [];
  let rows = 0;
  for (const reel of REELS_IN) {
    const scene = SIT.find(x => x.reel === reel);
    const tape = execFileSync(VSVG, [String(scene.id)], { cwd: R, env: nenv({ VIEW_REEL: reel, VIEW_SIM: '1', VIEW_TAPEW: '1' }),
      maxBuffer: 1 << 26 }).toString();
    fs.writeFileSync(tapeFile, tape);
    const lines = [...LINES[reel], ...tape.replace(/\n$/, '').split('\n'), EOF];
    rows += lines.length - LINES[reel].length - 2;
    const Kw = await fresh(), Kf = ctx.VIEW1108_ASM(imports), [ew, cw] = load(Kw, lines, reel), [ef] = load(Kf, lines, reel);
    const native = execFileSync(VSVG, [], { cwd: R, env: nenv({ VIEW_DKSUM: '1',
      VIEW_DECK: [...DECKS[reel], tapeFile].join(':') }) }).toString().trim();
    if (ew || ef || sumOf(Kw) !== native || sumOf(Kf) !== native)
      wrong.push(`${reel}: deck errors ${ew} at ${cw}, ${ef}; hash ${sumOf(Kw)}, fallback ${sumOf(Kf)}, native ${native}`);
    const t = run(Kw, scene, 3 | 8), tf = run(Kf, scene, 3 | 8);
    if (!(t.nvec === tf.nvec && t.nvec > 0 && maxdiff(t.vbuf, tf.vbuf) === 0 && maxdiff(t.hdr, tf.hdr) === 0 &&
          t.hdr[16] === 3 && t.hdr[17] === 0 && t.hdr[18] === 0 && t.hdr[19] === 0))
      wrong.push(`${sname(scene)}: the frame from the tape (source ${t.hdr[16]}, ${t.nvec} vectors) ` +
        `differs from the fallback's (source ${tf.hdr[16]}, ${tf.nvec})`);
  }
  fs.rmSync(tapeFile, { force: true });
  // Planted faults: a small tape for scenario 1 after the first reel's run decks, changed one way each.
  const L1 = LINES[A11];
  const row = t => `${t} 6578.0 0 0 0 7.784 0`, TP = ['TAPE SCN=1 CHAN=1', row(10000), row(10060), row(10120)];
  const tcase = (what, want, tp) => [what, want, [...L1, ...tp, EOF]];
  const tcases = [
    tcase('a tape row of six numbers', 22, [...TP, '10180 6578.0 0 0 0 7.784']),
    tcase('a tape row with no tape open', 6, [row(10000)]),
    tcase('tape rows out of time order', 29, [...TP, row(10100)]),
    tcase('a tape of one row', 29, TP.slice(0, 2)),
    tcase('a tape over its maximum', 28, ['TAPE SCN=1', ...Array.from({ length: 30001 }, (_, i) => row(10000 + i))]),
    tcase('a channel past the table', 7, ['TAPE SCN=1 CHAN=5', ...TP.slice(1)]),
    tcase('a scenario not read', 30, ['TAPE SCN=2', ...TP.slice(1)]),
    tcase("a second tape's scenario", 30, [...TP, 'TAPE SCN=2 CHAN=2', ...TP.slice(1)]),
    tcase('a channel given twice', 8, [...TP, ...TP]),
    tcase('eighteen digits in a tape row', 3, [...TP, '10180 6578.00000000000000001 0 0 0 7.784 0']),
    tcase('a tape row after an unknown card', 6, [...TP, 'TAPEE SCN=1 CHAN=2', row(10180)]),
    tcase('a value below the 17-digit range', 3, [...TP, '10180 1.2345678901234567E-30 0 0 0 7.784 0']),
  ];
  for (const [what, want, lines] of tcases) {
    const K = await fresh(), [e, c] = load(K, lines);
    if (e !== want) wrong.push(`${what}: deck error ${e} at card ${c}, not ${want}`);
  }
  // A good small tape: drawn where it covers the time (the source 3), the replay elsewhere.
  {
    const K = await fresh(), [e] = load(K, [...L1, ...TP, EOF], A11);
    const scene = SIT.find(x => x.reel === A11);
    const inT = run(K, scene, 3 | 8, 0, 0, 0, 10030).hdr[16], outT = run(K, scene, 3 | 8, 0, 0, 0, 20000).hdr[16];
    if (e || inT !== 3 || outT !== 0) wrong.push(`a small tape: deck error ${e}, source ${inT} inside, ${outT} outside`);
  }
  console.log(`tapes: the engine's tape read back (${rows} rows, both reels), ${tcases.length} planted faults` +
    `  ${wrong.length ? 'WRONG: ' + wrong.join('; ') : 'same tables and frames, each fault refused'}`);
  if (wrong.length) ok = false;
}
// Reel packages (#26 slice 7; tools/pack.py, web/src/reelpkg.js): the page's own unpacker, run here on the packages the
// page embeds (build/reels.js), gives each reel's files byte for byte as data/ holds them, and the kernel loads each
// scenario reel's decks to the native reader's hash total.  Packing again gives the same bytes.  A reel naming another
// kernel build, a truncated package, a manifest that is not first, or one under another id are refused.
{
  const wrong = [];
  // Each member as data/ holds it: a scenario reel's mission.scn and scenario file from its mission folder, a playlist
  // reel's run.scn from data/reels/<id>/ (page.json, which gen_data writes, is checked above, "page data").
  for (const r of reels) for (const [name, text] of r.files) {
    if (name === 'page.json') continue;
    const src = r.manifest.kind === 'playlist' ? path.join(R, 'data/reels', r.manifest.id, name)
      : path.join(R, 'data/missions', r.manifest.mission.id, name);
    if (!fs.existsSync(src) || fs.readFileSync(src, 'utf8') !== text) wrong.push(`${r.manifest.id}/${name} is not ${src}`);
  }
  // The scenario reels, in their load order, are build/decks/reels.txt's, each reel's decks build/decks/<id>.txt's.
  const scen = reels.filter(r => r.manifest.kind === 'scenario');
  if (scen.map(r => r.manifest.id).join() !== REELS_IN.join()) wrong.push(`scenario reels ${scen.map(r => r.manifest.id)}, not ${REELS_IN}`);
  let ndecks = 0;
  const sumsR = [];
  for (const r of scen) {
    const id = r.manifest.id, decks = RP.reelDecks(r), want = DECKS[id] || [];
    ndecks += decks.length;
    if (decks.length !== want.length || decks.some(([, t], i) => t !== fs.readFileSync(path.join(R, want[i]), 'utf8')))
      wrong.push(`${id}'s decks are not build/decks/${id}.txt's, in order`);
    const K = (await WebAssembly.instantiate(mod, { env: imports })).exports;
    const [e] = load(K, decks.flatMap(([, t]) => [...t.replace(/\n$/, '').split('\n'), EOF]));
    const sumR = sumOf(K), sumN = nativeSum(id);
    sumsR.push(`${id} ${sumR}`);
    if (e || sumR !== sumN) wrong.push(`decks from ${id}: deck error ${e}, hash ${sumR}, native ${sumN}`);
  }
  // Packing again (into a scratch folder) gives the same packages and the same reels.js.
  const tmp = fs.mkdtempSync(path.join(R, 'build/pack-again-'));
  execFileSync('python3', [path.join(R, 'tools/pack.py'), '--out', tmp], { cwd: R });
  const again = fs.readFileSync(path.join(tmp, 'reels.js'), 'utf8') === reelsJs &&
    fs.readdirSync(path.join(R, 'build/reels')).filter(f => f.endsWith('.tar.gz')).every(f =>
      fs.readFileSync(path.join(tmp, 'reels', f)).equals(fs.readFileSync(path.join(R, 'build/reels', f))));
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!again) wrong.push('packing again gave different bytes');
  // Refusals: another kernel build, a truncated package, a package whose first member is not the manifest (made by
  // the packer's own tar_gz, members reversed).
  const refused = async (what, b64, want, kernel = sha) => {
    try { await RP.readReel(b64, kernel, VR[0].id); wrong.push(`${what}: not refused`); }
    catch (err) { if (!want.test(String(err.message))) wrong.push(`${what}: refused as "${err.message}"`); }
  };
  await refused('another kernel build', VR[0].b64, /NAMES KERNEL core [0-9a-f]{8}; THIS PAGE RUNS 00000000$/, '0'.repeat(64));
  const bytes = Buffer.from(VR[0].b64, 'base64');
  await refused('a truncated package', bytes.subarray(0, bytes.length >> 1).toString('base64'), /^REEL \S+: does not unpack: not a gzip stream/);
  // Bad packages made from the first reel's members by the packer's own tar_gz (craft MODE): reversed (the manifest
  // not first), the scenario deck dropped (listed but missing), an extra member (not listed), and the manifest's size
  // field set to -512 with its header checksum made right (the reader once looped on it).
  const craft = mode => execFileSync('python3', ['-c', `import base64, gzip, io, sys, tarfile
sys.path.insert(0, "tools"); import pack
raw = gzip.decompress(base64.b64decode(sys.stdin.read()))
t = tarfile.open(fileobj=io.BytesIO(raw))
m = [(i.name, t.extractfile(i).read()) for i in t.getmembers()]
mode = sys.argv[1]
if mode == "negsize":
    h = bytearray(raw)
    h[124:136] = b"-0000001000" + bytes(1)
    h[148:156] = b"        "
    h[148:156] = (b"%06o" % sum(h[:512])) + bytes(1) + b" "
    out = gzip.compress(bytes(h), mtime=0)
else:
    out = pack.tar_gz({"reverse": m[::-1], "drop": m[:-1], "extra": m + [("extra.txt", b"x")]}[mode])
sys.stdout.write(base64.b64encode(out).decode())`, mode], { cwd: R, input: VR[0].b64 }).toString();
  await refused('the manifest not first', craft('reverse'), /manifest\.json is not first/);
  await refused('a listed file missing', craft('drop'), /is listed but missing/);
  await refused('a member not listed', craft('extra'), /extra\.txt is in it but not listed/);
  await refused('a negative size field', craft('negsize'), /does not unpack: manifest\.json: bad size/);
  try { await RP.readReel(VR[0].b64, sha, 'other-id'); wrong.push('another id: not refused'); }
  catch (err) { if (!/^REEL other-id: its manifest says /.test(err.message)) wrong.push(`another id: "${err.message}"`); }
  // The page as built (web/view1108.html) names the same kernel build: assemble.py's KERNEL_SHA is this wasm's, and
  // every reel's manifest names it.
  const page = fs.existsSync(path.join(R, 'web/view1108.html')) ? fs.readFileSync(path.join(R, 'web/view1108.html'), 'utf8') : '';
  const pageSha = (/const KERNEL_SHA = "([0-9a-f]{64})"/.exec(page) || [])[1];
  if (pageSha !== sha || reels.some(r => r.manifest.kernel.sha256 !== pageSha))
    wrong.push(`the page's KERNEL_SHA ${pageSha} is not the wasm's ${sha.slice(0, 8)} or a manifest's`);
  console.log(`packages: ${reels.length} reels (${reels.map(r => `${r.manifest.id} ${r.manifest.kind}`).join(', ')}), ${ndecks} decks; ` +
    `hash totals ${sumsR.join(', ')}  ${wrong.length ? 'WRONG: ' + wrong.join('; ') : 'members equal data/, packed twice the same, refusals hold'}`);
  if (wrong.length) ok = false;
}
// A situation's defaults are its deck's whatever source the last frame drew from (vdrive.f VINIT reads the replay for
// its set-up: the Earthrise search, the camera's turn and held attitude): view_init after a frame from the engine's
// tape gives the same default g.e.t., look and field, and the same frame at them, as in a fresh instance.
if (W.sim_run) {
  const fresh = async () => (await WebAssembly.instantiate(mod, { env: imports })).exports;
  const defaults = K => ['in_get', 'in_yaw', 'in_pitch', 'in_roll', 'in_fov'].map(g => f64(K, g, 1)[0]);
  const wrong = [];
  let drawn = 0;
  for (const scene of SCENES) {
    const A = await fresh(), B = await fresh();
    use(A, scene.reel); use(B, scene.reel);
    const a = run(A, scene, 3), da = defaults(A);
    B.view_init(scene.id); B.sim_run(0);
    if (run(B, scene, 3 | 8, 0, 0, 0, a.init + 3600).hdr[16] > 0) drawn++;
    const b = run(B, scene, 3), db = defaults(B);
    if (da.some((v, i) => v !== db[i]) || maxdiff(a.vbuf, b.vbuf) !== 0 || a.nvec !== b.nvec)
      wrong.push(`${sname(scene)}: defaults ${da.join(',')} then ${db.join(',')}`);
  }
  if (drawn === 0) wrong.push('no frame drew from the tape');
  console.log(`defaults after a tape frame: ${SCENES.length} situations, ${drawn} drawn from the tape first  ` +
    `${wrong.length ? 'WRONG: ' + wrong.join('; ') : 'the same as fresh'}`);
  if (wrong.length) ok = false;
}
console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1);
