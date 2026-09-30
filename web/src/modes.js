// Modes: Attract and Tour shot lists, Live, Free-look, Beam entry, scene selection.
"use strict";

// ---- shot lists (plain data; tune here) ----
// Each shot: name, scene, dur (real seconds), fl (bit0 labels, bit1 frame), optional fov/yaw/pitch/roll
// (number, or function of the shot fraction u), and a time law:
//   p = [a, b]: GET offset (s) from the scene's default GET, linear in u; or
//   tte = [[u, seconds to entry interface], ...], log-interpolated (Earth approach);
//   limb = [[u, deg], ...] steers the camera to keep the Earth's limb top at that screen elevation.
// Attract: the film's four shots, film seconds (0-5.9 Earthrise, 5.9-20.5 approach, 20.5-26 LM, 26-36.4 descent).
// Tour: the same scenes at slow real-time rates, dips to black between shots.
const TETP = 702186;     // entry interface, GET seconds
const APPROACH = [[0, 11600], [0.14, 6500], [0.62, 900], [1, 600]];
const LIMB = [[0, -11], [0.14, -11.6], [0.62, -13], [1, -6]];
const ATTRACT = [
  { name: "Earthrise",      scene: 1, dur: 5.9,  fl: 2, roll: -3, p: [30, 68] },
  { name: "Earth approach", scene: 2, dur: 14.6, fl: 0, fov: 60, tte: APPROACH, limb: LIMB },
  { name: "LM pirouette",   scene: 4, dur: 5.5,  fl: 0, p: [0, 45] },
  { name: "LM descent",     scene: 5, dur: 10.4, fl: 2, p: [-64, 149] }   // film 27 s = GET 369676, 35 s = 369840, linear; 26 s and 36.4 s extrapolated (scene default 369720)
];
const TOUR_FADE = 0.8;   // seconds of fade at each end of a tour shot
const TOUR = [
  { name: "Earthrise",      scene: 1, dur: 200, fl: 2, fov: 14, roll: -3, pitch: u => 4 * u, p: [0, 200] },
  { name: "Earth approach", scene: 2, dur: 150, fl: 0, fov: 60, tte: APPROACH, limb: LIMB },
  { name: "Earth limb",     scene: 3, dur: 90,  fl: 2, yaw: u => -15 + 30 * u, p: [0, 90] },
  { name: "Transposition & docking", scene: 7, dur: 110, fl: 2, p: [-60, 160] },   // 3:20:30 to just after docking at 3:24:03, about 2x
  { name: "LM pirouette",   scene: 4, dur: 120, fl: 0, p: [0, 240] },
  { name: "LM descent",     scene: 5, dur: 115, fl: 2, p: [-64, 225] },
  { name: "Moon view \u2014 spin to explore", scene: 6, dur: 75, fl: 3, yaw: u => -180 + 360 * u, pitch: u => 14 * Math.sin(2 * Math.PI * u), p: [0, 0] }
];
// Live: the scene follows the mission phase from GET.
const LIVE_MIN = 700, LIVE_MAX = TETP;     // kernel's Earth-orbit scene is valid from about 700 s
const PHASES = [
  { to: 10200, scene: 3, name: "Earth parking orbit" },
  { to: 75 * 3600 + 50 * 60, scene: 2, name: "Translunar coast" },
  { to: 135 * 3600 + 24 * 60, scene: 1, name: "Lunar orbit" },
  { to: Infinity, scene: 2, name: "Transearth coast" }
];
const JUMPS = { jtd: { scene: 7, get: 12030, len: 280, name: "Transposition & docking" }, jundock: { scene: 4, get: 360720, len: 1800, name: "LM rendezvous" }, jdesc: { scene: 5, get: 369720, len: 280, name: "LM descent" } };
const LIVE_RATES = [1, 10, 60, 300, 1000];
function lerpTab(t, u) { for (let i = 1; i < t.length; i++) if (u <= t[i][0]) return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * (u - t[i - 1][0]) / (t[i][0] - t[i - 1][0]); return t[t.length - 1][1]; }
// Plot units to view angle: the kernel plots a direction at angle theta off the boresight at radius k tan(theta / k)
// (k = 1 up to a 100 deg field, rising to 2 at 170 deg), so theta = k atan(rho / k).
const kOf = f => f <= 100 ? 1 : Math.min(2, 1 + (f - 100) / 70);
const plotToAngle = (rho, f) => { const k = kOf(f); return k * Math.atan(rho * Math.PI / 180 / k) * 180 / Math.PI; };
const RE_NMI = 3443.9;
// Aim the camera at the Earth: probe the kernel with no look offset and read hdr(11,12), the body centre's plot
// X,Y (deg, valid off-frame); the Earth's angular radius comes from the range. Yaw/pitch then put the limb top at
// plot elevation L, worked out in view angles.
function steerToEarth(L) {
  wr("in_get", get); wr("in_yaw", 0); wr("in_pitch", 0); wr("in_roll", 0); wr("in_fov", 60); wi("in_flags", 0);
  K.view_frame();
  const H = new Float64Array(buf(), K.hdr.value, 16);
  const rho = Math.asin(Math.min(1, RE_NMI / Math.max(RE_NMI, H[2]))) * 180 / Math.PI;
  yaw = plotToAngle(H[10], 60); pitch = plotToAngle(H[11], 60) - (plotToAngle(L, 60) - rho);
}
const QP = k => { const m = new RegExp("[?&]" + k + "=([^&]+)").exec(location.search); return m ? m[1] : null; };
const filmQ = /[?&]film=([\d.]+)/.exec(location.search);
const LEN = { attract: ATTRACT.reduce((a, s) => a + s.dur, 0), tour: TOUR.reduce((a, s) => a + s.dur, 0) };
const val = (x, u) => typeof x === "function" ? x(u) : x;
let mode = "attract", autoT = filmQ ? +filmQ[1] : 0, autoShot = -1, fadeA = 0, capName = "", livePin = null, liveIdx = 0;

function shotGet(sh, u) {
  if (sh.tte) return TETP - Math.exp(lerpTab(sh.tte.map(q => [q[0], Math.log(q[1])]), u));
  const p = (QP("p") && filmQ) ? QP("p").split(",").map(Number) : sh.p;
  return get0 + p[0] + (p[1] - p[0]) * u;
}
function autoStep(dt) {
  const L = mode === "attract" ? ATTRACT : TOUR, len = LEN[mode];
  if (!filmQ) autoT += dt;
  if (mode === "attract" && !filmQ && autoT >= len) { startMode("tour"); return; }
  let t = autoT % len, i = 0;
  while (i < L.length - 1 && t >= L[i].dur) { t -= L[i].dur; i++; }
  const sh = L[i], u = t / sh.dur;
  if (i !== autoShot) {
    autoShot = i; scene = sh.scene; viewInit(sh.scene); readDefaults();
    labels = !!(sh.fl & 1); frame = !!(sh.fl & 2); capName = sh.name; syncUI();
  }
  if (sh.fov) fov = sh.fov;
  if (sh.yaw !== undefined) yaw = val(sh.yaw, u);
  if (sh.pitch !== undefined) pitch = val(sh.pitch, u);
  if (sh.roll !== undefined) roll = val(sh.roll, u);
  if (filmQ) for (const k of ["fov", "yaw", "pitch", "roll"]) if (QP(k) !== null) { const v = +QP(k); if (k === "fov") fov = v; else if (k === "yaw") yaw = v; else if (k === "pitch") pitch = v; else roll = v; }
  get = shotGet(sh, u);
  if (sh.limb && QP("nosteer") === null) steerToEarth(lerpTab(sh.limb, u));
  fadeA = mode === "tour" ? Math.max(0, 1 - t / TOUR_FADE, 1 - (sh.dur - t) / TOUR_FADE) : 0;
}

// ---- Live ----
// On entering a phase, aim once at the reference body (hdr 11, 12) if it is in front; the look is then left alone.
function aimAtBody() {
  wr("in_get", get); wr("in_yaw", 0); wr("in_pitch", 0); wr("in_roll", 0); wr("in_fov", fov); wi("in_flags", 0);
  K.view_frame();
  const H = new Float64Array(buf(), K.hdr.value, 16);
  if (H[13] === 1) { yaw = H[10]; pitch = H[11]; roll = 0; }
}
function livePhase(g) {
  if (livePin && g >= livePin.from && g <= livePin.until) return { scene: livePin.scene, name: livePin.name };
  livePin = null;
  return PHASES.find(p => g < p.to);
}
function liveSync() {
  const ph = livePhase(get); capName = ph.name;
  if (ph.scene !== scene) {          // keep the viewer's look and the time across a scene change
    const g = get, y = yaw, pt = pitch, r = roll;   // keep look and time; FOV returns to the new scene's default
    scene = ph.scene; viewInit(scene); readDefaults(); get = g; yaw = y; pitch = pt; roll = r; get0 = g; aimAtBody(); syncUI();
  }
}
function liveJump(j) {
  startMode("live");
  livePin = { scene: j.scene, from: j.get, until: j.get + j.len, name: j.name };
  scene = j.scene; viewInit(scene); readDefaults(); get = j.get; get0 = get; liveSync(); syncUI();
}

// ---- modes: attract -> tour (loops), live, free ----
function startMode(m) {
  const prev = mode; mode = m; autoT = (m === "attract" && filmQ) ? +filmQ[1] : 0; autoShot = -1; fadeA = 0; playing = true;
  if (m === "live") {
    get = Math.max(LIVE_MIN, Math.min(LIVE_MAX, get)); livePin = null;
    scene = livePhase(get).scene; viewInit(scene); const g = get; readDefaults(); get = g; get0 = g; frame = true; labels = true; liveSync(); aimAtBody();
  } else if (m === "beam") {
    beamFrames = []; beamNextStart = 0; beamPrevCompute = 0; beamFrameNo = 0; capName = "";
  } else if (m === "free") {
    if (prev === "attract" || prev === "tour") { /* keep the current view and time */ }
    capName = "";
  }
  syncUI();
}
const leaveAttract = () => { if (mode === "attract" || mode === "tour") startMode("free"); };
if (DEBUG) {   // test hooks, enabled by ?debug
  window.VIEW_STEP = () => step(performance.now());
  window.VIEW_SEEK = t => { autoT = t; step(performance.now()); };   // with ?film=, jump to auto-mode second t
  window.VIEW_MODE = startMode;
  window.VIEW_STEPAT = t => step(t);   // step at a given time (ms), for BEAM captures
}

function readDefaults() {
  get = get0 = rd("in_get"); yaw = rd("in_yaw"); pitch = rd("in_pitch"); roll = rd("in_roll"); fov = fov0 = rd("in_fov");
}
function setScene(s) {
  if (mode === "live" && s === 6) {   // Moon view is not a mission phase: in Live it is pinned until the viewer scrubs or types a time
    const g = get; livePin = { scene: 6, from: -Infinity, until: Infinity, name: SCENE_CAPTION[6] };
    scene = 6; viewInit(6); readDefaults(); get = g; get0 = g; capName = SCENE_CAPTION[6]; syncUI(); return;
  }
  if (mode !== "beam") mode = "free"; else beamNextStart = 0; capName = ""; scene = s; viewInit(s); readDefaults(); syncUI();
}
function resetView() { const g = get; viewInit(scene); readDefaults(); get = g; }
