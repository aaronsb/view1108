// Room and Tiled: the workbench inside a 3D machine room (web/lab, inlined from build/lab.js as VIEW_LAB), or the
// plain page. The lab is started only when Room is chosen: in Tiled there is no WebGL context and no extra frame loop.
// In the room the vector terminal's screen is the plot (#cv), the glass terminal opens Source and the microfilm recorder
// opens Print; clicking one flies the camera to it, and on arrival the page shows that tab. The Room button, or Esc on a plot tab or in Source (once
// Source has closed its own overlays), flies back out.
"use strict";
const LAB = typeof VIEW_LAB !== "undefined" ? VIEW_LAB : null;
const ROOM_KEY = "view1108.space";
let roomAvail = !!LAB && LAB.supported() && !BARE;   // BARE covers ?still too
let roomPref = "room";   // the viewer's stored choice; Room unless they chose Tiled
try { const v = localStorage.getItem(ROOM_KEY); if (v === "room" || v === "tiled") roomPref = v; } catch (e) { /* storage unavailable */ }
let roomWant = UP.get("space") === "room" || UP.get("space") === "tiled" ? UP.get("space") : roomPref;   // ?space= for this visit only
let roomIn = false;      // the lab is running (Room, on a wide screen)
let roomShown = false;   // the lab is on screen and the page hidden
let roomCanvasTab = "review";   // the plot tab the vector terminal opens (Review, Simulate or Fusion)
let roomState = null;

function labState() {
  const s = roomState || (roomState = { sound: {} });
  s.tab = tab; s.mode = mode; s.playing = playing; s.get = get; s.scene = scene; s.frameNo = drawNo;
  s.sound.ctx = sndCtx; s.sound.out = sndOut; s.sound.on = sndOn; s.sound.bed = soundBed; s.sound.whine = whineNode();
  return s;
}
// Discrete events for the room's equipment (beam frames, engine runs).
function labEvent(type, at = performance.now()) { if (roomIn) LAB.event({ type, at }); }

function roomSync() {
  const vis = roomAvail && WIDE.matches;
  $("bspace").hidden = $("btiled").hidden = !vis;
  $("bspace").classList.toggle("on", roomIn); $("btiled").classList.toggle("on", !roomIn);
  $("bspace").title = roomIn && !roomShown ? "Back to the machine room (Esc on a plot tab)" : "The workbench inside a machine room";
  syncUI();   // the screen (prefs.js effDisp) follows the room
}
function roomPlace() { $("labhost").style.top = $("tabs").getBoundingClientRect().bottom + "px"; }
// The handover: the lab's flight into a terminal ends where its screen covers the element that screen becomes on the
// page (#cv, or the Source workspace), and the two crossfade over ROOM_FADE ms. Leaving, the lab starts at that pose
// and fades in over the page before it flies out.
const ROOM_FADE = 250;
// What each terminal opens (its `opens`), the tab that is, and the terminal a tab belongs to.
const ROOM_OPENS = { vector: "workbench", glass: "source", filmrecorder: "print" };
const roomTabOf = opens => opens === "source" || opens === "print" ? opens : roomCanvasTab;
const roomTermOf = t => t === "source" ? "glass" : t === "print" ? "filmrecorder" : "vector";
const roomScreenEl = opens => opens === "source" ? $("srcws") : cv;
// Lay the page out for a terminal behind the room (hidden, so nothing shows) and give its screen element's rect.
function roomScreenRect(opens) {
  const t = roomTabOf(opens);
  if (tab !== t) setTab(t);
  return roomScreenEl(opens).getBoundingClientRect();
}
let roomFadeT = 0;
function roomFade(into, done) {
  const h = $("labhost");
  clearTimeout(roomFadeT);
  h.style.transition = "none"; h.style.opacity = into ? "0" : "1"; h.classList.add("fading");
  void h.offsetWidth;   // commit the start opacity before the transition
  h.style.transition = `opacity ${ROOM_FADE}ms linear`; h.style.opacity = into ? "1" : "0";
  roomFadeT = setTimeout(() => { h.classList.remove("fading"); h.style.transition = h.style.opacity = ""; done(); }, ROOM_FADE);
}
// The lab matches the screen to the element's height. Where the element is wider (Source's workspace against the
// UNISCOPE's 2:1 face) the page grows sideways out of the screen's rect as the room fades, and shrinks back into it
// before the room fades in: a clip-path inset, from the lab's last match (null when the screen spans the element).
function roomInset() {
  const m = LAB.info()?.mismatch;
  if (!m) return null;
  const i = [m.dy0, -m.dx1, -m.dy1, m.dx0].map(v => Math.max(0, v));
  return i.some(v => v > 2) ? `inset(${i.map(v => v.toFixed(1) + "px").join(" ")})` : null;
}
function roomClip(el, from, to) {
  el.style.transition = "none"; el.style.clipPath = from;
  void el.offsetWidth;
  el.style.transition = `clip-path ${ROOM_FADE}ms cubic-bezier(.25,.7,.3,1)`; el.style.clipPath = to;
}
const roomUnclip = el => { el.style.transition = el.style.clipPath = ""; };
// Show the room; from a terminal ("vector", "glass") the lab starts square to its screen and fades in over the page.
function roomShowLab(from) {
  if (canvasTab() && tab !== "print") roomCanvasTab = tab;
  roomShown = true; roomPlace();
  if (!from) { document.body.classList.add("room"); LAB.show(); roomSync(); return; }
  const el = roomScreenEl(ROOM_OPENS[from]), rect = el.getBoundingClientRect();
  $("labhost").classList.add("fading"); $("labhost").style.opacity = "0";
  LAB.show(from, rect, ROOM_FADE);
  const inset = roomInset(), fadeIn = () => roomFade(true, () => { roomUnclip(el); document.body.classList.add("room"); });
  if (inset) {
    LAB.show(from, rect, 2 * ROOM_FADE);   // hold through the shrink as well
    roomClip(el, "inset(0px)", inset); clearTimeout(roomFadeT); roomFadeT = setTimeout(fadeIn, ROOM_FADE);
  }
  else fadeIn();
  roomSync();
}
function roomArrive(opens) {
  roomShown = false; document.body.classList.remove("room");
  setTab(roomTabOf(opens));
  if (canvasTab()) cv.focus({ preventScroll: true });
  const el = roomScreenEl(opens), inset = roomInset();
  if (inset) roomClip(el, inset, "inset(0px)");
  roomFade(false, () => { roomUnclip(el); if (!roomShown) LAB.hide(); });
  roomSync();
}
// Enter or leave the room to match the choice, the screen width and what the lab could do.
function roomApply() {
  const want = roomAvail && WIDE.matches && roomWant === "room";
  if (want && !roomIn) {
    if (!LAB.start($("labhost"), { screens: { vector: cv }, state: labState, arrive: roomArrive, screenRect: roomScreenRect })) { roomAvail = false; roomSync(); return; }
    roomIn = true; roomShowLab(null);
  } else if (!want && roomIn) {
    LAB.stop(); roomIn = roomShown = false; document.body.classList.remove("room"); resize();
  }
  roomSync();
}
function roomChoose(v) {
  roomWant = v; try { localStorage.setItem(ROOM_KEY, v); } catch (e) { /* ignore */ }
  if (v === "room" && roomIn && !roomShown) roomShowLab(roomTermOf(tab));
  else roomApply();
}
$("bspace").onclick = () => roomChoose("room");
$("btiled").onclick = () => roomChoose("tiled");
// A tab picked while the room is shown flies to its terminal first.
$("tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]");
  if (!b || !roomShown) return;
  e.stopImmediatePropagation();
  const t = b.dataset.tab;
  if (t !== "source" && t !== "print") roomCanvasTab = t;
  LAB.setTarget(roomTermOf(t));
}, true);
window.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.defaultPrevented || !roomIn || roomShown || typingIn() || $("list").classList.contains("open")) return;
  if (tab !== "source" && fOn()) return;   // Source closed its own overlays first (srcview.js)
  e.preventDefault(); roomShowLab(roomTermOf(tab));
});
WIDE.addEventListener("change", roomApply);
window.addEventListener("resize", () => { if (roomShown) roomPlace(); });
