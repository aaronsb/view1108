// On-screen control pad: the keyboard's look and time keys as buttons, for mouse and touch.
"use strict";
// A press acts at once and hands control to the viewer, as a key press does. Held look keys repeat like a held key:
// after PAD_DELAY ms, then every PAD_EVERY ms. The rates are our choice, near common desktop key-repeat defaults.
const PAD_DELAY = 500, PAD_EVERY = 33;
const PAD_REPEATS = new Set(["left", "right", "up", "down", "rollL", "rollR", "zoomIn", "zoomOut"]);
const padHeld = new Map();   // pointerId -> { b, timer }: one entry per finger, so two keys can be held at once
function padRelease(id) {
  const h = padHeld.get(id); if (!h) return;
  clearTimeout(h.timer); h.b.classList.remove("held"); padHeld.delete(id);
}
function padPress(b, id) {
  const a = b.dataset.act, h = { b, timer: 0 };
  leaveAttract(); ACT[a]();
  padHeld.set(id, h); b.classList.add("held");
  if (PAD_REPEATS.has(a)) { const rep = () => { ACT[a](); h.timer = setTimeout(rep, PAD_EVERY); }; h.timer = setTimeout(rep, PAD_DELAY); }
}
const pad = $("pad");
pad.addEventListener("pointerdown", e => {
  const b = e.target.closest("button[data-act]"); if (!b || e.button > 0) return;
  e.preventDefault(); padRelease(e.pointerId);
  b.setPointerCapture(e.pointerId); padPress(b, e.pointerId);
});
for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) pad.addEventListener(t, e => padRelease(e.pointerId));
window.addEventListener("blur", () => { for (const id of [...padHeld.keys()]) padRelease(id); });
// Enter on a focused key arrives as a click with no pointer (detail 0); pointer clicks were handled on pointerdown.
pad.addEventListener("click", e => { const b = e.target.closest("button[data-act]"); if (b && e.detail === 0) { leaveAttract(); ACT[b.dataset.act](); } });
pad.addEventListener("contextmenu", e => e.preventDefault());   // a long press on touch would open a menu
