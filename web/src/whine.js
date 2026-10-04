// The 1558's deflection whine: what the scope's yoke and deflection amplifiers might leak while the beam writes the
// plot. Ours throughout: no source documents the 1558's acoustic noise. Designers potted and varnished such magnetics
// to keep them quiet, so this is residual leakage from a well-built machine, kept deliberately faint: it plays only in
// the Room (web/lab places it at the 1558, with a steep distance law, so it is there within about 1.5 m of the screen
// or zoomed into it), only while the plot shows SCOPE outside Beam, and not in Tiled.
//
// Model: with magnetic deflection the yoke's current follows the beam's position, so the voltage across it follows
// the beam's velocity. For each new kernel frame (at most one every 1/16 s) we walk the beam's path for one refresh
// period, in the scope pass's order (vbuf, then the stars as dots), at a cost per stroke like beam.js's (1 unit plus
// 2 per plot width; a blanked move 0.3 plus 1 per width, ours), sample its position at the audio rate, and take
// the change per sample in x and y plus the unblank/blank edges as the signal. Played as a loop of that period (1/16 s
// on SCOPE 16 Hz, 1/60 s and half the level on STEADY) through a high-pass, a gentle peak near 3 kHz and a low-pass,
// soft-clipped; a new frame crossfades in over 30 ms.
"use strict";
const WHINE_GAIN = 0.045;         // the chain's output, before the room's panner (calibrated in docs/lab.md, Sound)
const WHINE_XFADE = 0.03, WHINE_MIN_MS = 1000 / 16 - 2;
let whineIn = null, whineOut = null, whineSrc = null, whineG = null, whineT0 = 0, whinePer = 0, whineLast = -1e9;
let whinePX = new Float32Array(1), whinePY = new Float32Array(1), whineZ = new Float32Array(1);

// The band-shaping chain on ctx: input -> high-pass 150 Hz -> peak 3 kHz -> low-pass 4.5 kHz -> output.
function whineChain(ctx) {
  const f = (type, hz, q, g = 0) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = hz; n.Q.value = q; n.gain.value = g; return n; };
  const input = ctx.createGain(), out = ctx.createGain(); out.gain.value = WHINE_GAIN;
  input.connect(f("highpass", 150, 0.7)).connect(f("peaking", 3000, 2, 6)).connect(f("lowpass", 4500, 0.5)).connect(out);
  return { input, out };
}
// The node the room connects at the 1558 (null until sound has started).
function whineNode() {
  if (!sndCtx) return null;
  if (!whineOut || whineOut.context !== sndCtx) { const c = whineChain(sndCtx); whineIn = c.input; whineOut = c.out; }
  return whineOut;
}

// One refresh period of the signal from the current kernel frame, n samples, into a new AudioBuffer of ctx.
function whineBuffer(ctx, per) {
  const sr = ctx.sampleRate, n = Math.max(32, Math.round(sr * per));
  const nv = ri("nvec"), ns = ri("nstar");
  const V = new Float64Array(buf(), K.vbuf.value, nv * 5), S = new Float64Array(buf(), K.sbuf.value, ns * 3);
  const half = new Float64Array(buf(), K.hdr.value, 15)[14] || 1, w = 2 * half;
  const m = nv + ns;
  const ax = i => i < nv ? V[i * 5] : S[(i - nv) * 3], ay = i => i < nv ? V[i * 5 + 1] : S[(i - nv) * 3 + 1];
  const bx = i => i < nv ? V[i * 5 + 2] : S[(i - nv) * 3], by = i => i < nv ? V[i * 5 + 3] : S[(i - nv) * 3 + 1];
  const on = (i) => 1 + 2 * Math.hypot(bx(i) - ax(i), by(i) - ay(i)) / w;
  const jump = (x0, y0, x1, y1) => { const d = Math.hypot(x1 - x0, y1 - y0); return d < 1e-6 ? 0 : 0.3 + d / w; };
  let C = 0;
  for (let i = 0; i < m; i++) C += on(i) + jump(i ? bx(i - 1) : bx(m - 1), i ? by(i - 1) : by(m - 1), ax(i), ay(i));
  if (whinePX.length < n + 1) { whinePX = new Float32Array(n + 1); whinePY = new Float32Array(n + 1); whineZ = new Float32Array(n); }
  const px = whinePX, py = whinePY, z = whineZ;
  z.fill(0, 0, n);
  if (!m || !(C > 0)) { const b = ctx.createBuffer(1, n, sr); return b; }   // nothing drawn: silence
  const du = C / n;
  let t = 0, k = 0;
  // A piece of path from (x0,y0) to (x1,y1) taking c units, beam on or off: sample positions at the boundaries it
  // crosses and add its lit time to the samples it overlaps.
  const piece = (x0, y0, x1, y1, c, lit) => {
    if (c <= 0) return;
    const t1 = t + c;
    while (k <= n && k * du < t1) { const u = (k * du - t) / c; px[k] = x0 + (x1 - x0) * u; py[k] = y0 + (y1 - y0) * u; k++; }
    if (lit) for (let j = Math.floor(t / du); j <= Math.min(n - 1, Math.floor(t1 / du)); j++) z[j] += Math.max(0, Math.min(t1, (j + 1) * du) - Math.max(t, j * du)) / du;
    t = t1;
  };
  for (let i = 0; i < m; i++) {
    const x0 = i ? bx(i - 1) : bx(m - 1), y0 = i ? by(i - 1) : by(m - 1);
    piece(x0, y0, ax(i), ay(i), jump(x0, y0, ax(i), ay(i)), false);
    piece(ax(i), ay(i), bx(i), by(i), on(i), true);
  }
  while (k <= n) { px[k] = px[0]; py[k] = py[0]; k++; }   // rounding: close the loop
  const b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  let e = 0;
  for (let j = 0; j < n; j++) {
    const v = ((px[j + 1] - px[j]) + 0.7 * (py[j + 1] - py[j])) / w * n / 50, dz = 0.3 * (z[j] - z[j ? j - 1 : n - 1]);
    d[j] = v + dz; e += d[j] * d[j];
  }
  // Level: halfway between the raw level and a fixed one, so busy and sparse frames differ but not wildly; soft clip.
  const rms = Math.sqrt(e / n), g = 0.25 / Math.sqrt(Math.max(rms, 1e-4) * 0.25);
  for (let j = 0; j < n; j++) d[j] = Math.tanh(d[j] * g * 1.5) / 1.5;
  return b;
}

// A new kernel frame (loop.js step): rebuild and crossfade, at most every 1/16 s; silent where the whine does not play.
function whineFrame() {
  const now = performance.now();
  if (now - whineLast < WHINE_MIN_MS) return;
  const play = sndOn && sndCtx && sndCtx.state === "running" && roomIn && !isFilm() && mode !== "beam" && whineNode();
  const ctx = sndCtx, t = ctx ? ctx.currentTime + 0.01 : 0;
  if (whineSrc) { whineG.gain.setValueAtTime(whineG.gain.value, t); whineG.gain.linearRampToValueAtTime(0, t + WHINE_XFADE); whineSrc.stop(t + WHINE_XFADE + 0.02); whineSrc = null; }
  if (!play) return;
  whineLast = now;
  const live = scopeLive(), per = live ? 1 / 16 : 1 / 60, b = whineBuffer(ctx, per), dur = b.length / ctx.sampleRate;
  if (per !== whinePer) { whinePer = per; whineT0 = t; }
  whineSrc = ctx.createBufferSource(); whineSrc.buffer = b; whineSrc.loop = true;
  whineG = ctx.createGain(); whineG.gain.setValueAtTime(0, t); whineG.gain.linearRampToValueAtTime(live ? 1 : 0.5, t + WHINE_XFADE);
  whineSrc.connect(whineG).connect(whineIn); whineSrc.start(t, (t - whineT0) % dur);
}
if (DEBUG) window.VIEW_WHINE = { chain: whineChain, buffer: whineBuffer, scene: s => { setScene(s); K.view_frame(); } };   // test hooks (?debug)
