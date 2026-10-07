// Modes: Live, Free-look, Beam entry, scene selection; Attract and Tour are playlist reels (player.js).
"use strict";

const TETP = 702186;     // entry interface, GET seconds: Live's end
// Live: the scene follows the mission phase from GET: the Live scenario's LIVE spans (SPAN cards, config.js), each
// the phase while g.e.t. < to. Its JUMP spans pin a windowed situation for a while (the jump buttons), named by its
// title; its PIN spans are situations that are no phase, pinned at the current time when picked in Live. Read from
// the page's data once it is set at boot (liveInit, main.js).
const LIVE_MIN = 700, LIVE_MAX = TETP;     // kernel's Earth-orbit scene is valid from about 700 s
let PHASES = [], JUMPS = [], LIVE_PINS = [];
function liveInit() {
  PHASES = spansOf(LIVE_SCN).live.map(([to, scene, name]) => ({ to: to ?? Infinity, scene, name }));
  JUMPS = spansOf(LIVE_SCN).jump.map(j => ({ scene: j.scene, get: j.get, len: j.len, name: sitOf(j.scene).title, button: j.button }));
  LIVE_PINS = spansOf(LIVE_SCN).pin;
}
const LIVE_RATES = [1, 10, 60, 300, 1000];
// Plot units to view angle: the kernel plots a direction at angle theta off the boresight at radius k tan(theta / k)
// (k = 1 up to a 100 deg field, rising to 2 at 170 deg), so theta = k atan(rho / k).
const kOf = f => f <= 100 ? 1 : Math.min(2, 1 + (f - 100) / 70);
const plotToAngle = (rho, f) => { const k = kOf(f); return k * Math.atan(rho * Math.PI / 180 / k) * 180 / Math.PI; };
let follow = false;   // Following (timeline.js): the scene tracks the g.e.t. while the replay plays alongside Apollo in Real Time
let capName = "", livePin = null, liveIdx = 0;

// ---- Live ----
// On entering a phase, aim once at the reference body (hdr 11, 12) if it is in front; the look is then left alone.
// Returns that look ({} when the body is behind).
function aimAtBody() {
  wr("in_get", LS.get); wr("in_yaw", 0); wr("in_pitch", 0); wr("in_roll", 0); wr("in_fov", LS.fov); wi("in_flags", 0);
  K.view_frame();
  const H = new Float64Array(buf(), K.hdr.value, 16);
  return H[13] === 1 ? { yaw: H[10], pitch: H[11], roll: 0 } : {};
}
function livePhase(g) {
  if (livePin && g >= livePin.from && g <= livePin.until) return { scene: livePin.scene, name: livePin.name };
  livePin = null;
  return PHASES.find(p => g < p.to);
}
// Each frame in Live: the phase for the time; a new phase's situation is loaded (loader.js, by="phase").
function liveSync() {
  const ph = livePhase(LS.get); capName = ph.name;
  if (ph.scene !== LS.situation) loadReel(P({ by: "phase", scene: ph.scene }));
}
if (DEBUG) {   // test hooks, enabled by ?debug
  window.VIEW_STEP = () => step(performance.now());
  window.VIEW_SEEK = t => { autoT = t; step(performance.now()); };   // with ?film=, jump to auto-mode second t
  window.VIEW_MODE = m => loadReel(P({ mode: m }));
  window.VIEW_STEPAT = t => step(t);   // step at a given time (ms), for BEAM captures
}
