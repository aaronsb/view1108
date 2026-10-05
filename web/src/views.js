// View point, target and label level, the cabin and its walls, and scene 8. Each control appears only when the kernel
// has its input (in_view, in_target, in_lablv; in_flags bits 4 and 5 when a station frame changes with them), and
// scene 8 only when view_init accepts it; an older kernel runs as before.
"use strict";
const VIEWS = ["window", "external", "cm", "lm"];          // in_view: 0 WINDOW, 1 EXTERNAL, 2 CM station, 3 LM station
const TARGETS = ["default", "earth", "moon", "sun", "csm", "lm"];   // in_target: 0 the scene's own
const LAB_LEVELS = ["off", "primary", "secondary", "all"];  // in_lablv
const STATION_FOV = 100;
const FEAT = { view: false, target: false, lablv: false, cabin: false, walls: false, scene8: false, scene9: false };
const SCENE_MISSION = { 9: "APOLLO 8" };   // named in the status line when the scene's scenario is not Apollo 11
let viewMode = 0, targetId = 0, cabin = true;   // cabin: the CM or LM interior in a station view (in_flags bit 4)
let walls = true;   // walls: with the cabin, the outside seen only through its windows (in_flags bit 5)
// Attract and Tour draw the cabin, with its walls, in their station shots.
const cabinFlag = () => FEAT.cabin && (cabin || auto()) ? 16 : 0;
const wallsFlag = () => FEAT.walls && cabinFlag() && (walls || auto()) ? 32 : 0;
// EXTERNAL, like the Moon view, orbits the target: drag and the look keys turn azimuth and elevation around it.
const orbiting = () => scene === 6 || viewMode === 1;
function featInputs() {   // every frame, before view_frame
  if (FEAT.view) wi("in_view", viewMode);
  if (FEAT.target) wi("in_target", targetId);
  if (FEAT.lablv) wi("in_lablv", labLv);
}
function featSyncUI() {
  $("jumps").hidden = epoch !== 0;   // the jump buttons are Apollo 11 times
  if (FEAT.view) document.querySelectorAll("#viewgrp button:not(#bcab):not(#bwal)").forEach((b, i) => b.classList.toggle("on", i === viewMode));
  if (FEAT.target) document.querySelectorAll("#targrp button").forEach((b, i) => b.classList.toggle("on", i === targetId));
  if (FEAT.cabin) { const b = $("bcab"); b.classList.toggle("on", cabin); b.disabled = viewMode !== 2 && viewMode !== 3; }
  if (FEAT.walls) { const b = $("bwal"); b.classList.toggle("on", walls); b.disabled = $("bcab").disabled || !cabin; }
}
// hdr(22): the crew stations the scene offers (1 CM, 2 LM). A kernel without it leaves 0 there: then hdr(21), the
// vehicles in the scene's world (1 CSM, 2 LM), which leaves out the one the camera rides.
let stMask = -1;
function featTick() {
  if (!FEAT.view) return;
  const h = new Float64Array(buf(), K.hdr.value, 24), m = (h[21] | 0) || (h[20] | 0);
  if (m === stMask) return; stMask = m;
  const b = document.querySelectorAll("#viewgrp button"); b[2].disabled = !(m & 1); b[3].disabled = !(m & 2);
}
// After boot, before the first scene. The scene 8 probe: a kernel without it falls back to scene 1 (hdr(7) = 1).
function featInit() {
  FEAT.view = !!K.in_view; FEAT.target = !!K.in_target; FEAT.lablv = !!K.in_lablv;
  const probe = s => { K.view_init(s); K.view_frame(); return new Float64Array(buf(), K.hdr.value, 7)[6] === s; };
  FEAT.scene8 = probe(8); FEAT.scene9 = probe(9);
  // The cabin probe: scene 1 from the CM station with a 170 deg field draws more with bit 4 than without.
  if (FEAT.view) {
    const nv = fl => { K.view_init(1); wi("in_view", 2); wr("in_fov", 170); wi("in_flags", fl); K.view_frame(); return new Int32Array(buf(), K.nvec.value, 1)[0]; };
    FEAT.cabin = nv(16) > nv(0);
    // The walls probe: the same frame with bit 5 too draws less (the Moon and stars only through the windows).
    FEAT.walls = FEAT.cabin && nv(48) < nv(16); wi("in_view", 0); wi("in_flags", 0);
  }
  if (FEAT.scene8) {
    SCENES[7] = "Translunar stack"; addSceneButton(8);
    TOUR.push(...TOUR8); ATTRACT.push(ATTRACT8);
  }
  if (FEAT.scene9) { SCENES[8] = "Apollo 8 Earthrise"; addSceneButton(9); TOUR.push(...TOUR9); }
  if (FEAT.scene8 || FEAT.scene9) {
    $("hint").textContent = $("hint").textContent.replace("1-7: scene", `1-${SCENES.length}: scene`);
    LEN.tour = TOUR.reduce((a, s) => a + s.dur, 0); LEN.attract = ATTRACT.reduce((a, s) => a + s.dur, 0);
  }
  $("viewgrp").hidden = !FEAT.view; $("targrp").hidden = !FEAT.target; $("bcab").hidden = !FEAT.cabin; $("bwal").hidden = !FEAT.walls;
  $("bcab").onclick = toggleCabin; $("bwal").onclick = toggleWalls;
  // Into a crew station, at least the 100 deg field of the report's CSM window plots (MSC IN 69-FM-197, PDF pp. 53,
  // 263): a scene's own field (8 deg in Earthrise) shows none of the cabin, and with its walls none of the outside.
  document.querySelectorAll("#viewgrp button:not(#bcab):not(#bwal)").forEach((b, i) => { b.onclick = () => {
    leaveAttract(); if (i >= 2 && viewMode < 2) fov = clampFov(Math.max(fov, STATION_FOV)); viewMode = i; syncUI();
  }; });
  document.querySelectorAll("#targrp button").forEach((b, i) => { b.onclick = () => { leaveAttract(); targetId = i; syncUI(); }; });
}
// ?view=window|external|cm|lm and ?target=default|earth|moon|sun|csm|lm (or their numbers).
function featParams() {
  const pick = (k, names) => { const v = UP.get(k); if (v === null) return null; const i = names.indexOf(v.toLowerCase()); return i >= 0 ? i : /^\d$/.test(v) && +v < names.length ? +v : null; };
  const v = pick("view", VIEWS), t = pick("target", TARGETS);
  if (FEAT.view && v !== null) viewMode = v;
  if (FEAT.target && t !== null) targetId = t;
  if (FEAT.cabin && (UP.get("cabin") === "0" || UP.get("cabin") === "1")) cabin = UP.get("cabin") === "1";
  if (FEAT.walls && (UP.get("walls") === "0" || UP.get("walls") === "1")) walls = UP.get("walls") === "1";
}
function toggleCabin() { if (!FEAT.cabin) return; leaveAttract(); cabin = !cabin; syncUI(); }
function toggleWalls() { if (!FEAT.walls) return; leaveAttract(); walls = !walls; syncUI(); }
