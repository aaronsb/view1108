// Buttons, time entry, pointer, wheel and keyboard controls.
"use strict";
// ---- UI ----
function syncUI() {
  document.querySelectorAll("#scenes button").forEach(b => b.classList.toggle("on", +b.dataset.scene === LS.situation));
  document.getElementById("bplay").textContent = LS.playing ? "Pause" : "Play";
  document.getElementById("reel").hidden = !auto();   // the mounted reel is the demo (modes.js reelLabel)
  document.querySelector("#ppause small").textContent = LS.playing ? "PAUSE" : "PLAY";
  document.getElementById("spd").textContent = LS.mode === "beam" ? BEAM_SPEEDS[beamIdx].short : (LS.mode === "live" ? LIVE_RATES[liveIdx] : SPEEDS[speedIdx]) + "x";
  document.getElementById("spd").title = LS.mode === "beam" ? BEAM_SPEEDS[beamIdx].name + ". " + BEAM_TIP : "";
  document.querySelectorAll("[data-mode]").forEach(b => b.classList.toggle("on", LS.mode === b.dataset.mode));
  document.getElementById("bbeam").classList.toggle("on", LS.mode === "beam");
  document.getElementById("bspd").textContent = BEAM_SPEEDS[beamIdx].name;
  document.getElementById("bhid").classList.toggle("on", hidden);
  document.getElementById("bjit").classList.toggle("on", effJit());
  document.getElementById("bdust").classList.toggle("on", effDust());
  document.getElementById("bfps").classList.toggle("on", effFps());
  document.getElementById("bblm").classList.toggle("on", effBloom());
  for (const id of ["bjit", "bdust", "bfps", "bblm"]) $(id).disabled = !isFilm();   // the SCOPE has no film effects
  document.querySelectorAll("[data-disp]").forEach(b => b.classList.toggle("on", b.dataset.disp === dispChoice()));
  document.querySelectorAll("[data-hz]").forEach(b => { b.classList.toggle("on", b.dataset.hz === scopeHz()); b.disabled = isFilm(); });
  document.getElementById("bcat").textContent = "Catalog " + (effCatalog() === "full" ? "full" : "nav");
  document.getElementById("blab").classList.toggle("on", LS.labLv > 0);
  if (FEAT.lablv) document.getElementById("blab").textContent = "Labels " + LAB_LEVELS[LS.labLv];
  featSyncUI();
  document.getElementById("bfrm").classList.toggle("on", frame);
}
const $ = id => document.getElementById(id);
function addSceneButton(s) { const b = document.createElement("button"); b.textContent = s + " " + SCENES[s - 1]; b.dataset.scene = s; b.onclick = () => loadReel(P({ scene: s })); $("scenes").appendChild(b); }
SCENES.forEach((n, i) => addSceneButton(i + 1));
// The number keys pick scenes 1 to 9, as many as there are situations.
const KEY_SCENES = Math.min(9, SCENES.length);
$("hintscenes").textContent = KEY_SCENES > 1 ? `1-${KEY_SCENES}` : "1";
document.querySelectorAll("[data-mode]").forEach(b => { b.onclick = () => loadReel(P({ mode: b.dataset.mode })); });
// The jump buttons, one per JUMP span of the Live scenario: its button text and its start time, h:mm:ss. Each loads
// Live at the jump, as a link with mode=live, its scene and its time would.
for (const j of JUMPS) {
  const b = document.createElement("button"), g = Math.round(j.get);
  b.textContent = `${j.button} ${Math.floor(g / 3600)}:${pad2(Math.floor(g / 60) % 60)}:${pad2(g % 60)}`;
  b.onclick = () => loadReel(P({ mode: "live", scene: j.scene, get: j.get })); $("jumps").appendChild(b);
}
const bump = d => { if (LS.mode === "beam") beamIdx = Math.max(0, Math.min(BEAM_SPEEDS.length - 1, beamIdx + d)); else if (LS.mode === "live") liveIdx = Math.max(0, Math.min(LIVE_RATES.length - 1, liveIdx + d)); else speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, speedIdx + d)); syncUI(); };
const parseGet = t => {
  const u = /^\s*(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\s*Z?\s*$/.exec(t);   // a UTC timestamp
  if (u) return (Date.UTC(+u[1], +u[2] - 1, +u[3], +u[4], +u[5], +u[6]) - LS.zero) / 1000;
  return parseGetHms(t);
};
const parseGetHms = t => { const m = t.trim().split(":").map(Number); if (m.some(isNaN)) return null; return m.length === 3 ? m[0] * 3600 + m[1] * 60 + m[2] : m.length === 2 ? m[0] * 3600 + m[1] * 60 : m[0]; };
$("geti").onchange = e => { const g = parseGet(e.target.value); if (g === null) return; leaveAttract(); loadReel(P({ get: g })); e.target.blur(); };
$("bjit").onclick = () => toggle("jitter");
$("bdust").onclick = () => toggle("dust");
$("bfps").onclick = () => toggle("fps");
$("bblm").onclick = () => toggle("bloom");
$("bcat").onclick = toggleCatalog;
document.querySelectorAll("[data-disp]").forEach(b => { b.onclick = () => setDisp(b.dataset.disp); });
document.querySelectorAll("[data-hz]").forEach(b => { b.onclick = () => setHz(b.dataset.hz); });
$("bhid").onclick = () => { leaveAttract(); hidden = !hidden; syncUI(); };
$("bplay").onclick = () => { if (demoHeld()) { drivePlay(); return; } leaveAttract(); track({ playing: !LS.playing }); syncUI(); };
$("bslow").onclick = () => { leaveAttract(); bump(-1); };
$("bfast").onclick = () => { leaveAttract(); bump(1); };
$("breset").onclick = () => { leaveAttract(); loadReel(P({ by: "reset" })); };
$("blab").onclick = () => { leaveAttract(); track({ labLv: FEAT.lablv ? (LS.labLv + 1) % 4 : LS.labLv ? 0 : 3 }); syncUI(); };   // OFF, PRIMARY, SECONDARY, ALL, or on/off
$("bfrm").onclick = () => { leaveAttract(); frame = !frame; syncUI(); };
$("scrub").oninput = e => { leaveAttract(); livePin = null; track({ get: LS.mode === "live" ? Number(e.target.value) : LS.get0 + Number(e.target.value) }); };

const clampFov = v => Math.max(1, Math.min(170, v));
const plotPx = () => box().s;
const ptrs = new Map(); let pinch0 = 0, fovPinch = 0;
cv.addEventListener("pointerdown", e => { leaveAttract(); cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); cv.focus();
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); fovPinch = LS.fov; } });
cv.addEventListener("pointermove", e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY;
  if (ptrs.size === 1) {
    if (orbiting()) {   // Moon view or EXTERNAL: yaw/pitch are longitude/latitude (azimuth/elevation) around the target, so dragging spins it under the pointer
      const Hh_ = new Float64Array(buf(), K.hdr.value, 16), R = Hh_[12] > 0 && Hh_[14] > 0 ? Hh_[12] / Hh_[14] * plotPx() / 2 : 0.85 * (LS.fov0 / LS.fov) * plotPx() / 2;   // disc radius in px: hdr(13) over the box half-width hdr(15)
      const d = 180 / Math.PI / R;   // degrees of longitude per px at the disc centre
      const y = LS.yaw - dx * d; track({ yaw: ((y + 180) % 360 + 360) % 360 - 180, pitch: Math.max(-90, Math.min(90, LS.pitch + dy * d)) });
    } else { const Hh_ = new Float64Array(buf(), K.hdr.value, 16), d = 2 * (Hh_[14] > 0 ? Hh_[14] : LS.fov / 2) / plotPx(); track({ yaw: LS.yaw - dx * d, pitch: Math.max(-90, Math.min(90, LS.pitch + dy * d)) }); }
  }
  else if (ptrs.size === 2 && pinch0 > 0) { const [a, b] = [...ptrs.values()]; track({ fov: clampFov(fovPinch * pinch0 / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]))) }); }
});
const up = e => { ptrs.delete(e.pointerId); pinch0 = 0; };
cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
cv.addEventListener("wheel", e => { e.preventDefault(); leaveAttract(); track({ fov: clampFov(LS.fov * Math.exp(e.deltaY * 0.001)) }); }, { passive: false });

// Look and time actions, shared by the keyboard and the control pad (pad.js).
const lookStep = () => orbiting() ? 5 : LS.fov * 0.05;
const ACT = {
  left: () => track({ yaw: LS.yaw - lookStep() }), right: () => track({ yaw: LS.yaw + lookStep() }),
  up: () => track({ pitch: Math.min(90, LS.pitch + lookStep()) }), down: () => track({ pitch: Math.max(-90, LS.pitch - lookStep()) }),
  rollL: () => track({ roll: LS.roll - 2 }), rollR: () => track({ roll: LS.roll + 2 }),
  zoomIn: () => track({ fov: clampFov(LS.fov / 1.1) }), zoomOut: () => track({ fov: clampFov(LS.fov * 1.1) }),
  pause: () => { track({ playing: !LS.playing }); syncUI(); },
  slower: () => bump(-1), faster: () => bump(1),
  reset: () => loadReel(P({ by: "reset" }))
};
const KEY_ACT = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", q: "rollL", Q: "rollL", e: "rollR", E: "rollR",
  "+": "zoomIn", "=": "zoomIn", "-": "zoomOut", "_": "zoomOut", " ": "pause", "[": "slower", "]": "faster", r: "reset", R: "reset" };
// A key typed into a text or number field (the g.e.t. box, Fusion's alignment) is that field's, not a command.
const typingIn = () => { const a = document.activeElement; return !!a && (a.tagName === "TEXTAREA" || a.tagName === "SELECT" || (a.tagName === "INPUT" && !["range", "button", "checkbox", "radio"].includes(a.type))); };
window.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ($("list").classList.contains("open") || libraryIsOpen()) return;   // overlays: Esc is the stack's (esc.js)
  if (!canvasTab() || typingIn()) return;
  const k = e.key;
  if (k === "j" || k === "J") { toggle("jitter"); e.preventDefault(); return; }
  if (k === "d" || k === "D") { toggle("dust"); e.preventDefault(); return; }
  if (k === "f" || k === "F") { toggle("fps"); e.preventDefault(); return; }
  if (k === "t" || k === "T") { toggleBeam(); e.preventDefault(); return; }
  if (k === "l" || k === "L") { copyLink(); e.preventDefault(); return; }
  if (k === "b" || k === "B") { toggle("bloom"); e.preventDefault(); return; }
  if (k === "c" || k === "C") { toggleCatalog(); e.preventDefault(); return; }
  if (k === "s" || k === "S") { cycleDisp(); e.preventDefault(); return; }
  if (k === "h" || k === "H") { setHz(scopeHz() === "16" ? "steady" : "16"); e.preventDefault(); return; }
  if ((k === "i" || k === "I") && FEAT.cabin) { toggleCabin(); e.preventDefault(); return; }
  if ((k === "w" || k === "W") && FEAT.walls) { toggleWalls(); e.preventDefault(); return; }
  if (k === " " && demoHeld()) { drivePlay(); e.preventDefault(); return; }
  if (k.length === 1 || k.startsWith("Arrow")) leaveAttract();
  let h = true;
  if (KEY_ACT[k]) ACT[KEY_ACT[k]]();
  else if (/^[1-9]$/.test(k) && +k <= KEY_SCENES) loadReel(P({ scene: +k }));
  else h = false;
  if (h) e.preventDefault();
});
window.addEventListener("resize", resize);
new ResizeObserver(() => requestAnimationFrame(resize)).observe($("wrap"));   // the workspace changes size with the tab, the dock and the link box too
