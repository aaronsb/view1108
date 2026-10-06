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
// Live: the scene follows the mission phase from GET: the Live scenario's LIVE spans (SPAN cards, config.js), each
// the phase while g.e.t. < to. Its JUMP spans pin a windowed situation for a while (the jump buttons), named by its
// title; its PIN spans are situations that are no phase, pinned at the current time when picked in Live.
const LIVE_MIN = 700, LIVE_MAX = TETP;     // kernel's Earth-orbit scene is valid from about 700 s
const PHASES = spansOf(LIVE_SCN).live.map(([to, scene, name]) => ({ to: to ?? Infinity, scene, name }));
const JUMPS = spansOf(LIVE_SCN).jump.map(j => ({ scene: j.scene, get: j.get, len: j.len, name: sitOf(j.scene).title, button: j.button }));
const LIVE_PINS = spansOf(LIVE_SCN).pin;
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
  wr("in_get", LS.get); wr("in_yaw", 0); wr("in_pitch", 0); wr("in_roll", 0); wr("in_fov", 60); wi("in_flags", 0);
  K.view_frame();
  const H = new Float64Array(buf(), K.hdr.value, 16);
  const rho = Math.asin(Math.min(1, RE_NMI / Math.max(RE_NMI, H[2]))) * 180 / Math.PI;
  LS.yaw = plotToAngle(H[10], 60); LS.pitch = plotToAngle(H[11], 60) - (plotToAngle(L, 60) - rho);
}
const QP = k => { const m = new RegExp("[?&]" + k + "=([^&]+)").exec(location.search); return m ? m[1] : null; };
const filmQ = /[?&]film=([\d.]+)/.exec(location.search);
// Scene 8 (a modern addition), appended to the Tour where the situation exists (below): orbit the stack from outside,
// then look out of the CM's left rendezvous window (yaw -4, pitch 21 from the CM station's +X: the window's
// centre seen from the eye, CMINT in src/models.f). view: 0 WINDOW, 1 EXTERNAL, 2 CM, 3 LM station.
// Attract, after the film's four shots, where scene 8 exists: orbit the stack from outside, captioned as ours.
// Yaw circles the stack's long axis, which looks alike from every side, so the shot rises in elevation from side-on
// toward the LM end and drifts a little in azimuth, with the stack about half the frame.
const ATTRACT8 = { name: "Translunar stack - a modern addition, not 1969 film", scene: 8, dur: 12, fl: 0, cap: true, view: 1, fov: 24, yaw: u => 150 + 50 * u, pitch: u => -10 + 45 * u, p: [0, 12] };
// Scene 9, Apollo 8 Earthrise (24 Dec 1968), appended to the Tour where the situation exists: the Earth rises at 4x.
// The GET span around the scene's default is our first guess; tune it against the kernel's scene.
const TOUR9 = [{ name: "Apollo 8 Earthrise", scene: 9, dur: 120, fl: 2, p: [-120, 360] }];
const TOUR8 = [
  { name: "Translunar stack - external", scene: 8, dur: 90, fl: 2, view: 1, fov: 24, yaw: u => 120 + 120 * u, pitch: u => -10 + 45 * (1 - Math.cos(2 * Math.PI * u)) / 2, p: [0, 90] },
  { name: "Translunar stack - CM window", scene: 8, dur: 60, fl: 2, view: 2, yaw: -4, pitch: 21, p: [90, 150] }
];
// The added shots join the lists where their situation exists (build/names.js; #18 replaces these lists).
if (hasScene(ATTRACT8.scene)) ATTRACT.push(ATTRACT8);
TOUR.push(...[...TOUR8, ...TOUR9].filter(sh => hasScene(sh.scene)));
const LEN = { attract: ATTRACT.reduce((a, s) => a + s.dur, 0), tour: TOUR.reduce((a, s) => a + s.dur, 0) };
const val = (x, u) => typeof x === "function" ? x(u) : x;
let autoCap = false;   // caption an unframed Attract shot (the added, non-film ones)
let follow = false;   // Following (timeline.js): the scene tracks the g.e.t. while the replay plays alongside Apollo in Real Time
let autoT = filmQ ? +filmQ[1] : 0, autoShot = -1, fadeA = 0, capName = "", livePin = null, liveIdx = 0;

function shotGet(sh, u) {
  if (sh.tte) return TETP - Math.exp(lerpTab(sh.tte.map(q => [q[0], Math.log(q[1])]), u));
  const p = (QP("p") && filmQ) ? QP("p").split(",").map(Number) : sh.p;
  return LS.get0 + p[0] + (p[1] - p[0]) * u;
}
function autoStep(dt) {
  const L = LS.mode === "attract" ? ATTRACT : TOUR, len = LEN[LS.mode];
  if (!filmQ) autoT += dt;
  if (LS.mode === "attract" && !filmQ && autoT >= len) { startMode("tour"); return; }
  let t = autoT % len, i = 0;
  while (i < L.length - 1 && t >= L[i].dur) { t -= L[i].dur; i++; }
  const sh = L[i], u = t / sh.dur;
  if (i !== autoShot) {
    autoShot = i; LS.situation = sh.scene; viewInit(sh.scene); readDefaults();
    LS.labLv = sh.fl & 1 ? 3 : 0; LS.view = sh.view || 0; frame = !!(sh.fl & 2); capName = sh.name; autoCap = !!sh.cap; syncUI();
  }
  if (sh.fov) LS.fov = sh.fov;
  if (sh.yaw !== undefined) LS.yaw = val(sh.yaw, u);
  if (sh.pitch !== undefined) LS.pitch = val(sh.pitch, u);
  if (sh.roll !== undefined) LS.roll = val(sh.roll, u);
  if (filmQ) for (const k of ["fov", "yaw", "pitch", "roll"]) if (QP(k) !== null) { const v = +QP(k); if (k === "fov") LS.fov = v; else if (k === "yaw") LS.yaw = v; else if (k === "pitch") LS.pitch = v; else LS.roll = v; }
  LS.get = shotGet(sh, u);
  if (sh.limb && QP("nosteer") === null) steerToEarth(lerpTab(sh.limb, u));
  fadeA = LS.mode === "tour" ? Math.max(0, 1 - t / TOUR_FADE, 1 - (sh.dur - t) / TOUR_FADE) : 0;
}

// ---- Live ----
// On entering a phase, aim once at the reference body (hdr 11, 12) if it is in front; the look is then left alone.
function aimAtBody() {
  wr("in_get", LS.get); wr("in_yaw", 0); wr("in_pitch", 0); wr("in_roll", 0); wr("in_fov", LS.fov); wi("in_flags", 0);
  K.view_frame();
  const H = new Float64Array(buf(), K.hdr.value, 16);
  if (H[13] === 1) { LS.yaw = H[10]; LS.pitch = H[11]; LS.roll = 0; }
}
function livePhase(g) {
  if (livePin && g >= livePin.from && g <= livePin.until) return { scene: livePin.scene, name: livePin.name };
  livePin = null;
  return PHASES.find(p => g < p.to);
}
function liveSync() {
  const ph = livePhase(LS.get); capName = ph.name;
  if (ph.scene !== LS.situation) {          // keep the viewer's look and the time across a scene change
    const g = LS.get, y = LS.yaw, pt = LS.pitch, r = LS.roll;   // keep look and time; FOV returns to the new scene's default
    LS.situation = ph.scene; viewInit(LS.situation); readDefaults(); LS.get = g; LS.yaw = y; LS.pitch = pt; LS.roll = r; LS.get0 = g; aimAtBody(); syncUI();
  }
}
function liveJump(j) {
  startMode("live");
  livePin = { scene: j.scene, from: j.get, until: j.get + j.len, name: j.name };
  LS.situation = j.scene; viewInit(LS.situation); readDefaults(); LS.get = j.get; LS.get0 = LS.get; liveSync(); syncUI();
}

// ---- modes: attract -> tour (loops), live, free ----
function startMode(m) {
  const prev = LS.mode; LS.mode = m; follow = false; autoT = (m === "attract" && filmQ) ? +filmQ[1] : 0; autoShot = -1; fadeA = 0; LS.playing = true;
  if (m === "live") {
    LS.get = Math.max(LIVE_MIN, Math.min(LIVE_MAX, LS.get)); livePin = null;
    LS.situation = livePhase(LS.get).scene; viewInit(LS.situation); const g = LS.get; readDefaults(); LS.get = g; LS.get0 = g; frame = true; LS.labLv = 3; liveSync(); aimAtBody();
  } else if (m === "beam") {
    beamFrames = []; beamNextStart = 0; beamPrevCompute = 0; beamFrameNo = 0; capName = "";
  } else if (m === "free") {
    if (prev === "attract" || prev === "tour") { /* keep the current view and time */ }
    capName = "";
  }
  syncUI();
}
const leaveAttract = () => { if (LS.mode === "attract" || LS.mode === "tour") startMode("free"); };
if (DEBUG) {   // test hooks, enabled by ?debug
  window.VIEW_STEP = () => step(performance.now());
  window.VIEW_SEEK = t => { autoT = t; step(performance.now()); };   // with ?film=, jump to auto-mode second t
  window.VIEW_MODE = startMode;
  window.VIEW_STEPAT = t => step(t);   // step at a given time (ms), for BEAM captures
}

function readDefaults() {
  LS.get = LS.get0 = rd("in_get"); LS.yaw = rd("in_yaw"); LS.pitch = rd("in_pitch"); LS.roll = rd("in_roll"); LS.fov = LS.fov0 = rd("in_fov");
}
function setScene(s) {
  follow = false;
  if (LS.mode === "live" && LIVE_PINS.includes(s)) {   // not a mission phase (the Moon view): in Live it is pinned until the viewer scrubs or types a time
    const g = LS.get, name = sitCaption(s) || SCENES[s - 1]; livePin = { scene: s, from: -Infinity, until: Infinity, name };
    LS.situation = s; viewInit(s); readDefaults(); LS.get = g; LS.get0 = g; capName = name; syncUI(); return;
  }
  if (LS.mode !== "beam") LS.mode = "free"; else beamNextStart = 0; capName = ""; LS.situation = s; viewInit(s); readDefaults(); syncUI();
}
function resetView() { const g = LS.get; viewInit(LS.situation); readDefaults(); LS.get = g; }
