// BEAM mode: vector-by-vector tracing on a fading phosphor.
"use strict";
// ---- BEAM mode: the frame is traced vector by vector on a phosphor that fades ----
// All rates are our estimates (see docs/univac-1108.md, "The recorder" and "Restomod arithmetic"); no recorder
// model is claimed. About 13,000 vectors/s is one S-C 4020 character time per vector (60-85 us) and about 1.3 s is
// the estimated 1108 compute time per frame, both estimates in that page.
const BEAM_SPEEDS = [
  { name: "1108 + RECORDER (EST.)", short: "1108+REC", vps: 13000, pause: 1.3, tau: 1.5 },
  { name: "RECORDER ONLY (EST.)", short: "RECORDER", vps: 13000, pause: 0, tau: 1.5 },
  { name: "SLOW TRACE", short: "SLOW", vps: 1000, pause: 0, tau: 1.5 },
  { name: "PERSISTENCE", short: "PERSIST", vps: 0, pause: 0, tau: 0.15 }   // vps 0: the whole frame in 1/15 s
];
const BEAM_TIP = "Trace rates are estimates (docs/univac-1108.md); no recorder model is claimed.";
let beamFrameNo = 0, beamIdx = 0, beamNew = false, beamNextStart = 0, beamPrevCompute = 0, beamFrames = [], beamPen = null;
// Path-like recorder: strokeText() and the star/vector code call moveTo/lineTo; here they append segments in order.
function BeamRec() { this.segs = []; }
BeamRec.prototype.sub = function (dash) { const r = this, o = { x: 0, y: 0, moveTo(x, y) { o.x = x; o.y = y; }, lineTo(x, y) { r.segs.push(o.x, o.y, x, y, dash); o.x = x; o.y = y; } }; return o; };
// A finished frame becomes a trace: segments in kernel order (vbuf, then stars, then text), each with the time it is drawn.
// Time per segment is 1 unit plus 2 x its length in plot widths (our choice: a constant per-vector time plus a small
// per-length term), so a full-width line costs 3 units. Tracing starts after the 1108 compute pause.
function beamCommit(list, now) {
  const n = list.length / 5, cfg = BEAM_SPEEDS[beamIdx], sg = new Float32Array(n * 4), dsh = new Uint8Array(n), tOn = new Float64Array(n), cost = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = list[i * 5], b = list[i * 5 + 1], c = list[i * 5 + 2], d = list[i * 5 + 3];
    sg[i * 4] = a; sg[i * 4 + 1] = b; sg[i * 4 + 2] = c; sg[i * 4 + 3] = d; dsh[i] = list[i * 5 + 4];
    cost[i + 1] = cost[i] + 1 + 2 * Math.hypot(c - a, d - b) / W;
  }
  const vps = cfg.vps || Math.max(1, cost[n] * 15);   // PERSISTENCE: the frame takes 1/15 s
  const t0 = now + cfg.pause * 1000;
  for (let i = 0; i < n; i++) tOn[i] = t0 + cost[i] / vps * 1000;
  const tEnd = t0 + cost[n] / vps * 1000;
  beamFrames.push({ sg, dsh, tOn, n, tEnd, tau: cfg.tau * 1000 });
  beamNextStart = tEnd;
  soundFrame(tEnd); labEvent("beamFrame", tEnd);
}
const lowerBound = (arr, n, v) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; };
// Draw every traced segment with an intensity that has decayed exp(-age/tau), in a few intensity buckets so each
// bucket is one stroke; the pen (beam spot) is drawn at the segment being traced.
function beamRender(now, lw, flick) {
  const BK = 14, ps = [], pd = []; for (let b = 0; b < BK; b++) { ps.push(new Path2D()); pd.push(new Path2D()); }
  beamPen = null;
  beamFrames = beamFrames.filter(f => now - f.tEnd < 4.6 * f.tau + 50);
  for (const f of beamFrames) {
    if (now < f.tOn[0]) continue;
    const hi = lowerBound(f.tOn, f.n, now + 1e-6), lo = lowerBound(f.tOn, f.n, now - 4.6 * f.tau);
    for (let i = lo; i < hi; i++) {
      const b = Math.min(BK - 1, Math.floor(Math.exp(-(now - f.tOn[i]) / f.tau) * BK)), P = f.dsh[i] ? pd[b] : ps[b];
      P.moveTo(f.sg[i * 4], f.sg[i * 4 + 1]); P.lineTo(f.sg[i * 4 + 2], f.sg[i * 4 + 3]);
    }
    if (now < f.tEnd && hi > 0 && hi < f.n) {   // the pen sits partway along the segment being drawn
      const i = hi - 1, u = Math.min(1, (now - f.tOn[i]) / Math.max(1e-6, f.tOn[i + 1] - f.tOn[i]));
      beamPen = [f.sg[i * 4] + (f.sg[i * 4 + 2] - f.sg[i * 4]) * u, f.sg[i * 4 + 1] + (f.sg[i * 4 + 3] - f.sg[i * 4 + 1]) * u];
    }
  }
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = lw;
  for (let b = 0; b < BK; b++) {
    ctx.strokeStyle = `rgba(255,255,255,${(b + 0.5) / BK * flick})`;
    ctx.setLineDash([]); ctx.stroke(ps[b]); ctx.setLineDash([lw * 5, lw * 4]); ctx.stroke(pd[b]);
  }
  ctx.setLineDash([]);
  if (beamPen) {
    const r = Math.max(2.5, W * 0.005), g = ctx.createRadialGradient(beamPen[0], beamPen[1], 0, beamPen[0], beamPen[1], r * 2.2);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(beamPen[0], beamPen[1], r * 2.2, 0, 6.2832); ctx.fill();
  }
}
