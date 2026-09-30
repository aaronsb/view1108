// The recorder: offscreen canvases, layout, and drawing one frame of kernel output.
"use strict";
// The picture is drawn to an offscreen canvas (ctx), then presented to the visible one (mctx) with
// optional film jitter and bloom.
const cv = document.getElementById("cv"), mctx = cv.getContext("2d");
const mk = () => document.createElement("canvas");
const off = mk(), bl1 = mk(), bl2 = mk(), bl3 = mk(), am1 = mk(), am2 = mk(), am3 = mk(), amS = mk(), ctx = off.getContext("2d"), b1c = bl1.getContext("2d"), b2c = bl2.getContext("2d"), b3c = bl3.getContext("2d"), a1c = am1.getContext("2d"), a2c = am2.getContext("2d"), a3c = am3.getContext("2d"), aSc = amS.getContext("2d");
// ---- layout ----
const HDR = 0.115, BOXF = 0.80, HGT = 1.10;
const RM_NMI = 938.1;   // lunar radius 1737.4 km (IAU mean radius) in n. mi.
function resize() {
  const wrapW = document.getElementById("wrap").clientWidth;
  W = Math.floor(Math.max(280, Math.min(wrapW, (innerHeight - (STILL ? 0 : 190)) / HGT)));
  Hh = Math.floor(W * HGT);
  dpr = (DEBUG && +QP("dpr")) || window.devicePixelRatio || 1;
  dpr = Math.max(1, Math.min(dpr, 1800 / W));   // cap the backing store at about 1800 device px wide: the film is soft anyway and bloom cost scales with pixels
  cv.style.width = W + "px"; cv.style.height = Hh + "px";
  cv.width = off.width = Math.round(W * dpr); cv.height = off.height = Math.round(Hh * dpr);
  beamFrames = []; beamNextStart = 0;   // BEAM traces are in canvas px: retrace after a resize
  bl1.width = Math.ceil(cv.width / 2); bl1.height = Math.ceil(cv.height / 2);
  bl2.width = Math.ceil(cv.width / 4); bl2.height = Math.ceil(cv.height / 4);
  bl3.width = am3.width = Math.ceil(cv.width / 8); bl3.height = am3.height = Math.ceil(cv.height / 8);
  am1.width = amS.width = bl1.width; am1.height = amS.height = bl1.height; am2.width = bl2.width; am2.height = bl2.height;
}
// Framed plots sit inside a margin for lettering; unframed shots (as in the film) fill the width.
let framed = true;
const box = () => framed ? { x: W * (1 - BOXF) / 2, y: W * HDR, s: W * BOXF } : { x: 0, y: W * 0.02, s: W };

// ---- draw ----
function draw(now) {
  const fl = ri("in_flags");
  const nv = ri("nvec"), ns = ri("nstar"), nl = ri("nlab");
  const V = new Float64Array(buf(), K.vbuf.value, nv * 5);
  const S = new Float64Array(buf(), K.sbuf.value, ns * 3);
  const L = new Float64Array(buf(), K.lbuf.value, nl * 4);
  const H = new Float64Array(buf(), K.hdr.value, 16);
  const F = H[1] || fov, half = H[14] > 0 ? H[14] : F / 2;   // the plot box is +-hdr(15) plot degrees
  framed = !!(fl & 2);
  const b = box(), k = b.s / (2 * half), cx = b.x + b.s / 2, cy = b.y + b.s / 2;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, Hh);
  const flick = 0.93 + 0.07 * Math.random();
  const fs = Math.max(9, Math.min(15, W * 0.024));

  // header
  if (framed) {
  ctx.fillStyle = "#eee"; ctx.textBaseline = "alphabetic";
  ctx.font = `${fs * 1.25}px ${getComputedStyle(document.body).getPropertyValue("--hd")}`;
  ctx.textAlign = "center";
  ctx.fillText("Field of view = " + (F < 10 ? F.toFixed(1) : Math.round(F)) + "°", cx, b.y - fs * 2.3);
  ctx.font = `${fs * 0.95}px "Courier Prime","Courier New",monospace`;
  const rb = H[5] === 1 ? "R_E" : "R_M";
  ctx.fillText(`${rb} = ${Math.round(H[2])} n. mi.   h = ${Math.round(H[3])} stat. mi.   V_I = ${Math.round(H[4])} fps`, cx, b.y - fs * 0.8);

  }
  ctx.save();
  ctx.beginPath(); ctx.rect(framed ? b.x - 2 : 0, b.y - 2, b.s + 4, b.s + 4); ctx.clip();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // vectors: solid and dashed batched into paths
  const beam = mode === "beam", rec = beam && beamNew ? new BeamRec() : null;
  const solid = rec ? rec.sub(0) : new Path2D(), dash = rec ? rec.sub(1) : new Path2D();
  for (let i = 0; i < nv * 5; i += 5) {
    const p = V[i + 4] === 2 ? dash : solid;
    p.moveTo(cx + V[i] * k, cy - V[i + 1] * k); p.lineTo(cx + V[i + 2] * k, cy - V[i + 3] * k);
  }
  // Stars. TN D-6853 p.12: "The user has the option of using two star catalogs. The one more often used
  // consists of the 391 stars used by the Apollo crewmen for navigational sightings. The first 37 stars are
  // the prime Apollo navigational stars and are identified by name on the microfilm. The remaining stars
  // are represented by asterisks. The other catalog contains 1078 star listings, ranging in visual
  // magnitude to 4.5. None of these stars is identified by name, but all appear as dots on the microfilm."
  // NAV: the 391-star navigation catalog approximated as the 391 brightest of ours (NAV_MAG, computed from
  // data/stars.6.json by tools/gen_data.py); drawn as asterisks. FULL: everything, drawn as dots.
  // Our conjecture: the spoke count and length by magnitude (6 to 8 spokes, length 1x to 1.6x), and that
  // the film's round soft dots are these symbols blurred by the CRT-to-film process.
  const bloomOn = effBloom(), fullCat = effCatalog() === "full";
  const named = (x, y) => { for (let j = 0; j < nl * 4; j += 4) if (L[j + 2] === 1 && Math.abs(L[j] - x) < 0.03 && Math.abs(L[j + 1] - y) < 0.03) return true; return false; };
  const rF = Math.max(0.8, W * 0.0026) * (effBloom() ? 1.3 : 1), starP = rec ? rec.sub(0) : new Path2D();
  for (let i = 0; i < ns * 3; i += 3) {
    const m = S[i + 2];
    if (!fullCat && m > NAV_MAG && !named(S[i], S[i + 1])) continue;   // the 37 named stars are always in the NAV catalog
    const t = Math.max(0, Math.min(1, (4.5 - m) / 5.5)), r = rF * (1 + 0.6 * t);
    const x = cx + S[i] * k, y = cy - S[i + 1] * k;
    if (fullCat) { starP.moveTo(x, y); starP.lineTo(x + 0.01, y); if (!bloomOn) starP.lineTo(x + r * 0.5, y); continue; }
    const n = m <= 2 ? 12 : 8, rr = r * 1.1;
    for (let a = 0; a < n; a++) { const th = Math.PI * 2 * a / n - Math.PI / 2; starP.moveTo(x, y); starP.lineTo(x + rr * Math.cos(th), y + rr * Math.sin(th)); }
  }
  const textP = rec ? rec.sub(0) : new Path2D();   // recorder text is not clipped to the plot box: tick numbers sit just outside it
  // Recorder text (kernel tbuf/tchr): tick numbers and names, in the film layer with the vectors.
  if (K.tbuf) {
    const nt = ri("ntxt"), T = new Float64Array(buf(), K.tbuf.value, nt * 4), C = new Int32Array(buf(), K.tchr.value, ri("nchr"));
    for (let j = 0; j < nt * 4; j += 4) {
      let str = ""; for (let q = T[j + 3] - 1; q < C.length && C[q]; q++) str += String.fromCharCode(C[q]);
      const alpha = /[A-Z]/.test(str);
      if (alpha && (!labels || (fullCat && NAMES.NAV.includes(str)))) continue;   // names follow the Labels toggle; FULL catalog has no star names
      strokeText(textP, str, cx + T[j] * k, cy - T[j + 1] * k, T[j + 2] * k);
    }
  }
  // Crater names stay page-side, in the same font, centred on the crater. Largest crater first (the catalog is sorted
  // by diameter, so a lower id is a larger crater); a name whose text rectangle (0.7 x height per character, one height
  // tall) meets one already placed is dropped, the same rule as the kernel's Moon-view labels. Names of craters within
  // two name heights of the Moon's limb (as angles from the Moon's centre) are dropped too: seen edge-on there, they
  // would letter over the limb and its crowded rims. Our rules.
  if (labels) {
    const hd = 2 * half * 0.014, placed = [], cand = [];
    const dir = (x, y) => { const th = plotToAngle(Math.hypot(x, y), F) * Math.PI / 180, ph = Math.atan2(y, x); return [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]; };
    const moon = H[5] === 2 && H[13] === 1 ? dir(H[10], H[11]) : null;   // hdr(6) reference body Moon, hdr(14) in front
    const limbAt = moon ? Math.asin(Math.min(1, RM_NMI / Math.max(RM_NMI, H[2]))) - 2 * hd * Math.PI / 180 : 0;
    const nearLimb = i => { if (!moon) return false; const d = dir(L[i], L[i + 1]); return Math.acos(Math.min(1, d[0] * moon[0] + d[1] * moon[1] + d[2] * moon[2])) > limbAt; };
    for (let i = 0; i < nl * 4; i += 4) if ((L[i + 2] | 0) === 2 && NAMES.CRATER[(L[i + 3] | 0) - 1] && !nearLimb(i)) cand.push(i);
    cand.sort((a, b) => L[a + 3] - L[b + 3]);
    for (const i of cand) {
      const up = NAMES.CRATER[(L[i + 3] | 0) - 1].toUpperCase(), wd = 0.35 * hd * up.length;
      const r = [L[i] - wd, L[i] + wd, L[i + 1] - 0.5 * hd, L[i + 1] + 0.5 * hd];
      if (placed.some(q => r[0] < q[1] && r[1] > q[0] && r[2] < q[3] && r[3] > q[2])) continue;
      placed.push(r);
      strokeText(textP, up, cx + L[i] * k - up.length * 0.7 * hd * k / 2, cy - L[i + 1] * k + hd * k / 2, hd * k);
    }
  }
  // BLOOM: a hairline (about 1 device px) beam; all glow comes from the blur passes in present().
  const lw = bloomOn ? Math.max(1, 0.0009 * cv.width) / dpr : Math.max(1, W / 420); hairline = lw;   // hairline: 0.09% of canvas width, at least 1 device px
  for (const [w, a] of bloomOn ? [[lw, 1 * flick]] : [[lw * 3.2, 0.10 * flick], [lw, 0.95 * flick]]) {
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = w;
    if (beam) break;
    ctx.setLineDash([]); ctx.stroke(solid);
    ctx.setLineDash([lw * 5, lw * 4]); ctx.stroke(dash);
  }
  // stars: the same stroke as every other line; BLOOM (one whole-frame blur) turns the asterisks into round soft dots
  ctx.setLineDash([]); ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(255,255,255,${0.98 * flick})`; ctx.lineWidth = lw; if (!beam) ctx.stroke(starP);
  ctx.restore();
  // recorder text, unclipped, same strokes and glow as the vectors
  for (const [w, a] of bloomOn ? [[lw, 1 * flick]] : [[lw * 3.2, 0.10 * flick], [lw, 0.95 * flick]]) {
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = w; ctx.setLineDash([]); ctx.lineCap = "round"; if (!beam) ctx.stroke(textP);
  }
  if (rec) beamCommit(rec.segs, now);
  if (beam) beamRender(now, lw, flick);

  // axis captions (page lettering; tick numbers and names come from the kernel text records)
  if (framed) {
  ctx.font = `${fs}px ${getComputedStyle(document.body).getPropertyValue("--hd")}`; ctx.fillStyle = "#eee";
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText("X, deg", cx, b.y + b.s + fs * 2);
  ctx.save(); ctx.translate(b.x - fs * 3.2, cy); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "bottom"; ctx.fillText("Y, deg", 0, 0); ctx.restore();
  }
  const showCap = framed || mode !== "attract";   // the film has no text on its unframed shots
  if (showCap) {
  ctx.textAlign = "center"; ctx.fillStyle = "#eee";
  ctx.textBaseline = "top"; ctx.font = `${fs * 1.1}px "Courier Prime","Courier New",monospace`;
  const sc = H[6] | 0;
  ctx.fillText("g.e.t. = " + getStr(H[0]), cx, b.y + b.s + fs * (framed ? 4.0 : 0.5));
  ctx.fillStyle = "#aaa"; ctx.font = `${fs}px ${getComputedStyle(document.body).getPropertyValue("--hd")}`;
  const liveTag = mode === "live" ? `LIVE ${LIVE_RATES[liveIdx]}x   ` : mode === "tour" ? "TOUR   " : "";
  ctx.fillText(liveTag + (capName || SCENE_CAPTION[sc] || SCENES[sc - 1] || "") + (H[5] && !(SCENE_CAPTION[sc] && (!capName || capName === SCENE_CAPTION[sc])) ? (H[5] === 1 ? " - Earth" : " - Moon") : "") + (H[8] > 0 ? `   range ${Math.round(H[8])} ft` : "") + (H[9] > 0 ? `   alt ${Math.round(H[9])} ft` : "") + (roll ? `   roll ${roll.toFixed(0)}°` : ""), cx, b.y + b.s + fs * (framed ? 5.7 : 2.0));
  }

  if (fadeA > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fadeA)})`; ctx.fillRect(0, 0, W, Hh); }
  present(now, bloomOn);
}
