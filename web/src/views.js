// View point, target and label level, and scene 8. Each control appears only when the kernel has its input
// (in_view, in_target, in_lablv), and scene 8 only when view_init accepts it; an older kernel runs as before.
"use strict";
const VIEWS = ["window", "external", "cm", "lm"];          // in_view: 0 WINDOW, 1 EXTERNAL, 2 CM station, 3 LM station
const TARGETS = ["default", "earth", "moon", "sun", "csm", "lm"];   // in_target: 0 the scene's own
const LAB_LEVELS = ["off", "primary", "secondary", "all"];  // in_lablv
const FEAT = { view: false, target: false, lablv: false, scene8: false, scene9: false };
const SCENE_MISSION = { 9: "APOLLO 8" };   // named in the status line when the scene's scenario is not Apollo 11
let viewMode = 0, targetId = 0;
// EXTERNAL, like the Moon view, orbits the target: drag and the look keys turn azimuth and elevation around it.
const orbiting = () => scene === 6 || viewMode === 1;
function featInputs() {   // every frame, before view_frame
  if (FEAT.view) wi("in_view", viewMode);
  if (FEAT.target) wi("in_target", targetId);
  if (FEAT.lablv) wi("in_lablv", labLv);
}
function featSyncUI() {
  $("jumps").hidden = epoch !== 0;   // the jump buttons are Apollo 11 times
  if (FEAT.view) document.querySelectorAll("#viewgrp button").forEach((b, i) => b.classList.toggle("on", i === viewMode));
  if (FEAT.target) document.querySelectorAll("#targrp button").forEach((b, i) => b.classList.toggle("on", i === targetId));
}
// hdr(21): the vehicles the scene has (1 CM/CSM, 2 LM, 4 S-IVB); the CM and LM station views need theirs.
let vehMask = -1;
function featTick() {
  if (!FEAT.view) return;
  const m = new Float64Array(buf(), K.hdr.value, 24)[20] | 0; if (m === vehMask) return; vehMask = m;
  const b = document.querySelectorAll("#viewgrp button"); b[2].disabled = !(m & 1); b[3].disabled = !(m & 2);
}
// After boot, before the first scene. The scene 8 probe: a kernel without it falls back to scene 1 (hdr(7) = 1).
function featInit() {
  FEAT.view = !!K.in_view; FEAT.target = !!K.in_target; FEAT.lablv = !!K.in_lablv;
  const probe = s => { K.view_init(s); K.view_frame(); return new Float64Array(buf(), K.hdr.value, 7)[6] === s; };
  FEAT.scene8 = probe(8); FEAT.scene9 = probe(9);
  if (FEAT.scene8) {
    SCENES[7] = "Translunar stack"; addSceneButton(8);
    TOUR.push(...TOUR8); ATTRACT.push(ATTRACT8);
  }
  if (FEAT.scene9) { SCENES[8] = "Apollo 8 Earthrise"; addSceneButton(9); TOUR.push(...TOUR9); }
  if (FEAT.scene8 || FEAT.scene9) {
    $("hint").textContent = $("hint").textContent.replace("1-7: scene", `1-${SCENES.length}: scene`);
    LEN.tour = TOUR.reduce((a, s) => a + s.dur, 0); LEN.attract = ATTRACT.reduce((a, s) => a + s.dur, 0);
  }
  $("viewgrp").hidden = !FEAT.view; $("targrp").hidden = !FEAT.target;
  document.querySelectorAll("#viewgrp button").forEach((b, i) => { b.onclick = () => { leaveAttract(); viewMode = i; syncUI(); }; });
  document.querySelectorAll("#targrp button").forEach((b, i) => { b.onclick = () => { leaveAttract(); targetId = i; syncUI(); }; });
}
// ?view=window|external|cm|lm and ?target=default|earth|moon|sun|csm|lm (or their numbers).
function featParams() {
  const pick = (k, names) => { const v = UP.get(k); if (v === null) return null; const i = names.indexOf(v.toLowerCase()); return i >= 0 ? i : /^\d$/.test(v) && +v < names.length ? +v : null; };
  const v = pick("view", VIEWS), t = pick("target", TARGETS);
  if (FEAT.view && v !== null) viewMode = v;
  if (FEAT.target && t !== null) targetId = t;
}
