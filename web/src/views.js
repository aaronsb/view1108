// View point, target and label level, the cabin and its walls. Each control appears only when the kernel has its
// input (in_view, in_target, in_lablv; in_flags bits 4 and 5 when a station frame changes with them); an older
// kernel runs as before.
"use strict";
const VIEWS = ["window", "external", "cm", "lm"];          // in_view: 0 WINDOW, 1 EXTERNAL, 2 CM station, 3 LM station
const TARGETS = ["default", "earth", "moon", "sun", "csm", "lm", "sivb"];   // in_target: 0 the scene's own
const LAB_LEVELS = ["off", "primary", "secondary", "all"];  // in_lablv
const STATION_FOV = 100;
let stFov = null;   // [the field before a station, the station's]: restored on leaving it
const FEAT = { view: false, target: false, lablv: false, cabin: false, walls: false };
let cabin = true;   // cabin: the CM or LM interior in a station view (in_flags bit 4)
let walls = true;   // walls: with the cabin, the outside seen only through its windows (in_flags bit 5)
// Attract and Tour draw the cabin, with its walls, in their station shots.
const cabinFlag = () => FEAT.cabin && (cabin || auto()) ? 16 : 0;
const wallsFlag = () => FEAT.walls && cabinFlag() && (walls || auto()) ? 32 : 0;
// EXTERNAL, like the body-centred Moon view (its recipe, BODYCTR), orbits the target: drag and the look keys turn
// azimuth and elevation around it.
const orbiting = () => sitOf(LS.situation).recipe === "BODYCTR" || LS.view === 1;
function featInputs() {   // every frame, before view_frame
  if (FEAT.view) wi("in_view", LS.view);
  if (FEAT.target) wi("in_target", LS.target);
  if (FEAT.lablv) wi("in_lablv", LS.labLv);
}
function featSyncUI() {
  if (FEAT.view) document.querySelectorAll("#viewgrp button:not(#bcab):not(#bwal)").forEach((b, i) => b.classList.toggle("on", i === LS.view));
  if (FEAT.target) document.querySelectorAll("#targrp button").forEach((b, i) => b.classList.toggle("on", i === LS.target));
  if (FEAT.cabin) { const b = $("bcab"); b.classList.toggle("on", cabin); b.disabled = LS.view !== 2 && LS.view !== 3; }
  if (FEAT.walls) { const b = $("bwal"); b.classList.toggle("on", walls); b.disabled = $("bcab").disabled || !cabin; }
}
// hdr(22): the crew stations the scene offers (1 CM, 2 LM; 4 set by every kernel that has it). Without it, hdr(21),
// the vehicles in the scene's world (1 CSM, 2 LM), which leaves out the one the camera rides.
let stMask = -1;
function featTick() {
  if (!FEAT.view) return;
  const h = new Float64Array(buf(), K.hdr.value, 24), m = (h[21] & 4) ? h[21] & 3 : h[20] | 0;
  if (FEAT.target) tgtTick(h[22] | 0);
  if (m === stMask) return; stMask = m;
  const b = document.querySelectorAll("#viewgrp button"); b[2].disabled = !(m & 1); b[3].disabled = !(m & 2);
}
// A vehicle the window cannot aim at (#70). hdr(23), the target's status (vview.f TGTPOS): 1 aimed at its own
// point, 2 the vehicle the camera rides, 3 docked to or carried with another (at Earth orbit insertion the CSM, LM
// and S-IVB are one stack: one point), 4 no position at this time, 5 as 3, the LM stowed in the SLA before the
// separation. A kernel without hdr(23) gives 0: nothing changes.
// The caption line says why on every frame, from the target and that frame's hdr(23) (tgtNote), so a link to the
// external view of the docked LM says it too. Only the switch is tied to a pick: a vehicle picked from the window or
// the CM station that the first kernel frame computed after the pick reports as 2, 3 or 5 is shown from outside
// instead (EXTERNAL, which flies round the point it shares), its field closed to 40 deg if wider (the external
// spans' field for a vehicle, Following), so the vehicle 40-60 m off is not lost in a window's wide field. The
// view, field and target the switch left are kept (tgtOut): the next target pick, or Window, goes back to them
// first, so the switch is not one way.
const OUT_FOV = 40;
const VEH_NAMES = { 4: "CSM", 5: "LM", 6: "S-IVB" };
let tgtAsk = null;   // { target, prev, k }: a vehicle just picked, the target before it, kFrames at the pick
let tgtOut = null;   // { target, view, fov, prev, why }: the switch outside a pick made, what it left, and why
const tgtWhy = (t, st) => {
  const n = VEH_NAMES[t];
  return !n ? "" : st === 2 ? `CAMERA RIDES THE ${n}` : st === 3 ? (t === 6 ? "S-IVB ATTACHED" : `${n} DOCKED`)
    : st === 5 ? "LM INSIDE SLA" : st === 4 ? `${n}: NO POSITION AT THIS TIME` : "";
};
// The caption's note, from the last kernel frame's hdr(23) (render.js captionText; its H holds only hdr(1..16)).
function tgtNote() {
  const t = LS.target, st = new Float64Array(buf(), K.hdr.value, 24)[22] | 0;
  if (st === 4) return tgtWhy(t, st);
  const why = tgtWhy(t, st) || (tgtOut && tgtOut.target === t && LS.view === 1 ? tgtOut.why : "");
  return why && LS.view === 1 ? why + ": VIEWING FROM OUTSIDE" : why;
}
// A target button: back to what an earlier switch left, then the pick.
function tgtPick(i) {
  const o = tgtOut; tgtOut = null;
  tgtAsk = VEH_NAMES[i] ? { target: i, prev: o ? o.prev : LS.target, k: kFrames } : null;
  loadReel(P(o ? { view: o.view, fov: o.fov, target: i } : { target: i }));
}
function tgtTick(st) {
  if (tgtOut && tgtOut.target !== LS.target) tgtOut = null;   // another target since (a scene loaded, a link)
  if (!tgtAsk || kFrames <= tgtAsk.k) return;                  // Beam: no frame computed since the pick yet
  const a = tgtAsk; tgtAsk = null;
  if (a.target !== LS.target || LS.view === 1 || !(st === 2 || st === 3 || st === 5)) return;
  tgtOut = { target: a.target, view: LS.view, fov: LS.fov, prev: a.prev, why: tgtWhy(a.target, st) };
  loadReel(P({ view: 1, fov: LS.fov > OUT_FOV ? OUT_FOV : null }));
}
// After boot, before the first scene.
function featInit() {
  FEAT.view = !!K.in_view; FEAT.target = !!K.in_target; FEAT.lablv = !!K.in_lablv;
  // The cabin probe: the first situation of the reel the kernel holds (LS.deck, the boot reel; each reel numbers its
  // own situations) that always offers the CM station, from it with a 170 deg field, draws more with bit 4
  // than without.
  if (FEAT.view) {
    const held = SITS.filter(s => s.reel === LS.deck), cm = (held.find(s => s.stations.cm === "ALWAYS") || held[0]).id;
    const nv = fl => { K.view_init(cm); wi("in_view", 2); wr("in_fov", 170); wi("in_flags", fl); K.view_frame(); return new Int32Array(buf(), K.nvec.value, 1)[0]; };
    FEAT.cabin = nv(16) > nv(0);
    // The walls probe: the same frame with bit 5 too draws less (the Moon and stars only through the windows).
    FEAT.walls = FEAT.cabin && nv(48) < nv(16); wi("in_view", 0); wi("in_flags", 0);
  }
  $("viewgrp").hidden = !FEAT.view; $("targrp").hidden = !FEAT.target; $("bcab").hidden = !FEAT.cabin; $("bwal").hidden = !FEAT.walls;
  $("bcab").onclick = toggleCabin; $("bwal").onclick = toggleWalls;
  // Into a crew station, at least the 100 deg field of the report's CSM window plots (MSC IN 69-FM-197, PDF pp. 53,
  // 263): a scene's own field (8 deg in Earthrise) shows none of the cabin, and with its walls none of the outside.
  document.querySelectorAll("#viewgrp button:not(#bcab):not(#bwal)").forEach((b, i) => { b.onclick = () => {
    leaveAttract(); tlManual();
    // Window after a pick's switch outside: the view, field and target the switch left (tgtOut).
    const o = tgtOut; tgtOut = null; tgtAsk = null;
    if (o && i === 0) { loadReel(P({ view: 0, fov: o.fov, target: o.prev })); return; }
    let f = null;
    if (i >= 2 && LS.view < 2) { stFov = [LS.fov, clampFov(Math.max(LS.fov, STATION_FOV))]; f = stFov[1]; }
    else if (i < 2 && LS.view >= 2 && stFov && LS.fov === stFov[1]) f = stFov[0];   // back out, unless zoomed since
    if (i < 2) stFov = null;
    loadReel(P({ view: i, fov: f }));
  }; });
  document.querySelectorAll("#targrp button").forEach((b, i) => { b.onclick = () => { leaveAttract(); tlManual(); tgtPick(i); }; });
}
function toggleCabin() { if (!FEAT.cabin) return; leaveAttract(); cabin = !cabin; syncUI(); }
function toggleWalls() { if (!FEAT.walls) return; leaveAttract(); walls = !walls; syncUI(); }
