// Buttons, time entry, pointer, wheel and keyboard controls.
"use strict";
// ---- UI ----
function syncUI() {
  document.querySelectorAll("#scenes button").forEach((b, i) => b.classList.toggle("on", i + 1 === scene));
  document.getElementById("bplay").textContent = playing ? "Pause" : "Play";
  document.querySelector("#ppause small").textContent = playing ? "PAUSE" : "PLAY";
  document.getElementById("spd").textContent = mode === "beam" ? BEAM_SPEEDS[beamIdx].short : (mode === "live" ? LIVE_RATES[liveIdx] : SPEEDS[speedIdx]) + "x";
  document.getElementById("spd").title = mode === "beam" ? BEAM_SPEEDS[beamIdx].name + ". " + BEAM_TIP : "";
  for (const m of ["attract", "tour", "live", "free", "beam"]) document.getElementById("m" + m).classList.toggle("on", mode === m);
  document.getElementById("bhid").classList.toggle("on", hidden);
  document.getElementById("bjit").classList.toggle("on", effJit());
  document.getElementById("bdust").classList.toggle("on", effDust());
  document.getElementById("bfps").classList.toggle("on", effFps());
  document.getElementById("bblm").classList.toggle("on", effBloom());
  document.getElementById("bcat").textContent = "Catalog " + (effCatalog() === "full" ? "full" : "nav");
  document.getElementById("blab").classList.toggle("on", labels);
  document.getElementById("bfrm").classList.toggle("on", frame);
}
const $ = id => document.getElementById(id);
SCENES.forEach((n, i) => { const b = document.createElement("button"); b.textContent = (i + 1) + " " + n; b.onclick = () => setScene(i + 1); $("scenes").appendChild(b); });
for (const m of ["attract", "tour", "live", "free", "beam"]) $("m" + m).onclick = () => startMode(m);
for (const id in JUMPS) $(id).onclick = () => liveJump(JUMPS[id]);
const bump = d => { if (mode === "beam") beamIdx = Math.max(0, Math.min(BEAM_SPEEDS.length - 1, beamIdx + d)); else if (mode === "live") liveIdx = Math.max(0, Math.min(LIVE_RATES.length - 1, liveIdx + d)); else speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, speedIdx + d)); syncUI(); };
const parseGet = t => {
  const u = /^\s*(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\s*Z?\s*$/.exec(t);   // a UTC timestamp
  if (u) return (Date.UTC(+u[1], +u[2] - 1, +u[3], +u[4], +u[5], +u[6]) - LIFTOFF_MS) / 1000;
  return parseGetHms(t);
};
const parseGetHms = t => { const m = t.trim().split(":").map(Number); if (m.some(isNaN)) return null; return m.length === 3 ? m[0] * 3600 + m[1] * 60 + m[2] : m.length === 2 ? m[0] * 3600 + m[1] * 60 : m[0]; };
$("geti").onchange = e => { const g = parseGet(e.target.value); if (g === null) return; leaveAttract(); livePin = null; get = mode === "live" ? Math.max(LIVE_MIN, Math.min(LIVE_MAX, g)) : g; e.target.blur(); };
$("bjit").onclick = () => toggle("jitter");
$("bdust").onclick = () => toggle("dust");
$("bfps").onclick = () => toggle("fps");
$("bblm").onclick = () => toggle("bloom");
$("bcat").onclick = toggleCatalog;
$("bhid").onclick = () => { leaveAttract(); hidden = !hidden; syncUI(); };
$("bplay").onclick = () => { leaveAttract(); playing = !playing; syncUI(); };
$("bslow").onclick = () => { leaveAttract(); bump(-1); };
$("bfast").onclick = () => { leaveAttract(); bump(1); };
$("breset").onclick = () => { leaveAttract(); resetView(); };
$("blab").onclick = () => { leaveAttract(); labels = !labels; syncUI(); };
$("bfrm").onclick = () => { leaveAttract(); frame = !frame; syncUI(); };
$("scrub").oninput = e => { leaveAttract(); livePin = null; get = mode === "live" ? Number(e.target.value) : get0 + Number(e.target.value); };

const clampFov = v => Math.max(1, Math.min(170, v));
const plotPx = () => box().s;
const ptrs = new Map(); let pinch0 = 0, fovPinch = 0;
cv.addEventListener("pointerdown", e => { leaveAttract(); cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); cv.focus();
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); fovPinch = fov; } });
cv.addEventListener("pointermove", e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY;
  if (ptrs.size === 1) {
    if (scene === 6) {   // Moon view: yaw/pitch are the sub-observer longitude/latitude, so dragging spins the globe under the pointer
      const Hh_ = new Float64Array(buf(), K.hdr.value, 16), R = Hh_[12] > 0 && Hh_[14] > 0 ? Hh_[12] / Hh_[14] * plotPx() / 2 : 0.85 * (fov0 / fov) * plotPx() / 2;   // disc radius in px: hdr(13) over the box half-width hdr(15)
      const d = 180 / Math.PI / R;   // degrees of longitude per px at the disc centre
      yaw -= dx * d; pitch = Math.max(-90, Math.min(90, pitch + dy * d)); yaw = ((yaw + 180) % 360 + 360) % 360 - 180;
    } else { const Hh_ = new Float64Array(buf(), K.hdr.value, 16), d = 2 * (Hh_[14] > 0 ? Hh_[14] : fov / 2) / plotPx(); yaw -= dx * d; pitch += dy * d; pitch = Math.max(-90, Math.min(90, pitch)); }
  }
  else if (ptrs.size === 2 && pinch0 > 0) { const [a, b] = [...ptrs.values()]; fov = clampFov(fovPinch * pinch0 / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]))); }
});
const up = e => { ptrs.delete(e.pointerId); pinch0 = 0; };
cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
cv.addEventListener("wheel", e => { e.preventDefault(); leaveAttract(); fov = clampFov(fov * Math.exp(e.deltaY * 0.001)); }, { passive: false });

// Look and time actions, shared by the keyboard and the control pad (pad.js).
const lookStep = () => scene === 6 ? 5 : fov * 0.05;
const ACT = {
  left: () => { yaw -= lookStep(); }, right: () => { yaw += lookStep(); },
  up: () => { pitch = Math.min(90, pitch + lookStep()); }, down: () => { pitch = Math.max(-90, pitch - lookStep()); },
  rollL: () => { roll -= 2; }, rollR: () => { roll += 2; },
  zoomIn: () => { fov = clampFov(fov / 1.1); }, zoomOut: () => { fov = clampFov(fov * 1.1); },
  pause: () => { playing = !playing; syncUI(); },
  slower: () => bump(-1), faster: () => bump(1),
  reset: () => resetView()
};
const KEY_ACT = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", q: "rollL", Q: "rollL", e: "rollR", E: "rollR",
  "+": "zoomIn", "=": "zoomIn", "-": "zoomOut", "_": "zoomOut", " ": "pause", "[": "slower", "]": "faster", r: "reset", R: "reset" };
window.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ($("list").classList.contains("open")) { if (e.key === "Escape") $("list").classList.remove("open"); return; }
  const k = e.key;
  if (k === "j" || k === "J") { toggle("jitter"); e.preventDefault(); return; }
  if (k === "d" || k === "D") { toggle("dust"); e.preventDefault(); return; }
  if (k === "f" || k === "F") { toggle("fps"); e.preventDefault(); return; }
  if (k === "t" || k === "T") { startMode("beam"); e.preventDefault(); return; }
  if (k === "l" || k === "L") { copyLink(); e.preventDefault(); return; }
  if (k === "b" || k === "B") { toggle("bloom"); e.preventDefault(); return; }
  if (k === "c" || k === "C") { toggleCatalog(); e.preventDefault(); return; }
  if (k.length === 1 || k.startsWith("Arrow")) leaveAttract();
  let h = true;
  if (KEY_ACT[k]) ACT[KEY_ACT[k]]();
  else if (k >= "1" && k <= String(SCENES.length)) setScene(+k);
  else h = false;
  if (h) e.preventDefault();
});
window.addEventListener("resize", resize);
