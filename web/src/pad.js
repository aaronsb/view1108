// On-screen control pad: the keyboard's look and time keys as buttons, for mouse and touch.
"use strict";
// A press acts at once and hands control to the viewer, as a key press does. Held look keys repeat like a held key:
// after PAD_DELAY ms, then every PAD_EVERY ms. The rates are our choice: the delay half a common desktop default's, so
// a held cap starts moving soon (#72), the rate near the common one.
const PAD_DELAY = 250, PAD_EVERY = 33;
const PAD_REPEATS = new Set(["left", "right", "up", "down", "rollL", "rollR", "zoomIn", "zoomOut"]);
const padHeld = new Map();   // pointerId -> { b, timer }: one entry per finger, so two keys can be held at once
function padRelease(id) {
  const h = padHeld.get(id); if (!h) return;
  clearTimeout(h.timer); h.b.classList.remove("held"); padHeld.delete(id);
}
// The pause key starts a demo the drive stopped (player.js demoHeld) rather than taking control.
function padAct(a) { if (a === "pause" && demoHeld()) drivePlay(); else { leaveAttract(); ACT[a](); } }
function padPress(b, id) {
  const a = b.dataset.act, h = { b, timer: 0 };
  padAct(a);
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
pad.addEventListener("click", e => { const b = e.target.closest("button[data-act]"); if (b && e.detail === 0) padAct(b.dataset.act); });
pad.addEventListener("contextmenu", e => e.preventDefault());   // a long press on touch would open a menu

// The pad's mode (#72): the toggle over it, its left third the key set (ARROWS, WASD), its right two thirds the action
// (LOOK, MOVE; key V). Each cap shows its key and what it does in that mode; MOVE shows the pad in reverse video
// (page.css). Under WASD the hint greys the W, S and D shortcuts, which wait until ARROWS (controls.js).
const PAD_GLYPH = { arrows: { up: "&uarr;", down: "&darr;", left: "&larr;", right: "&rarr;" }, wasd: { up: "W", down: "S", left: "A", right: "D" } };
const PAD_KEY = { arrows: { up: "Up arrow", down: "Down arrow", left: "Left arrow", right: "Right arrow" }, wasd: { up: "W", down: "S", left: "A", right: "D" } };
// [cap text, what it does] for LOOK and MOVE; LOOK's arrows keep their bare caps, as before the toggle.
const PAD_LOOK = { up: ["", "Pitch up"], down: ["", "Pitch down"], left: ["", "Yaw left"], right: ["", "Yaw right"],
  rollL: ["ROLL", "Roll left"], rollR: ["ROLL", "Roll right"], reset: ["RESET", "Reset the view"] };
const PAD_MOVE = { up: ["FWD", "Move the eye forward"], down: ["BACK", "Move the eye back"], left: ["LEFT", "Slide the eye left"],
  right: ["RIGHT", "Slide the eye right"], rollL: ["DOWN", "Move the eye down"], rollR: ["UP", "Move the eye up"], reset: ["EYE", "Put the eye back"] };
const PAD_LETTER = { rollL: "Q", rollR: "E", reset: "R" };
function padSync() {
  const set = PADM.wasd ? "wasd" : "arrows", tab = PADM.move ? PAD_MOVE : PAD_LOOK;
  for (const b of pad.querySelectorAll("button[data-act]")) {
    const a = b.dataset.act, t = tab[a]; if (!t) continue;
    const glyph = PAD_GLYPH[set][a] || PAD_LETTER[a], key = PAD_KEY[set][a] || PAD_LETTER[a];
    let cap = t[0]; if (!cap && PADM.wasd) cap = a === "up" || a === "down" ? "PITCH" : "YAW";   // a letter alone would not say
    b.innerHTML = glyph + (cap ? `<small>${cap}</small>` : "");
    b.title = `${t[1]} (${key})`; b.setAttribute("aria-label", t[1]);
  }
  pad.classList.toggle("move", PADM.move);
  const k = $("bkeys"), m = $("bmove");
  k.textContent = PADM.wasd ? "WASD" : "ARROWS"; k.classList.toggle("on", PADM.wasd); k.setAttribute("aria-pressed", String(PADM.wasd));
  m.textContent = PADM.move ? "MOVE" : "LOOK"; m.classList.toggle("on", PADM.move); m.setAttribute("aria-pressed", String(PADM.move));
  $("hint").classList.toggle("wasd", PADM.wasd);
}
function padToggle(which) { if (which === "keys") PADM.wasd = !PADM.wasd; else PADM.move = !PADM.move; padSync(); }
$("bkeys").onclick = () => padToggle("keys");
$("bmove").onclick = () => padToggle("move");
// Test hooks (?debug): the pad's mode, the eye and what the W, S and D shortcuts would change; act(a, n) presses cap a
// n times, as the keyboard and the pad do.
if (DEBUG) window.VIEW_PAD = {
  state: () => ({ wasd: PADM.wasd, move: PADM.move, eye: [...eyeOff], kind: eyeKind(), yaw: LS.yaw, pitch: LS.pitch,
    walls, dust: effDust(), disp: dispChoice() }),
  act: (a, n = 1) => { for (let i = 0; i < n; i++) ACT[a](); } };
