// Room and Tiled: the workbench inside a 3D machine room (web/lab, inlined from build/lab.js as VIEW_LAB), or the
// plain page. The lab is started only when Room is chosen: in Tiled there is no WebGL context and no extra frame loop.
// In the room the vector terminal's screen is the plot (#cv) and the glass terminal opens Source; clicking one flies
// the camera to it, and on arrival the page shows that tab. The Room button, or Esc on a plot tab, flies back out.
"use strict";
const LAB = typeof VIEW_LAB !== "undefined" ? VIEW_LAB : null;
const ROOM_KEY = "view1108.space";
let roomAvail = !!LAB && LAB.supported() && !BARE;   // BARE covers ?still too
let roomPref = "room";   // the viewer's stored choice; Room unless they chose Tiled
try { const v = localStorage.getItem(ROOM_KEY); if (v === "room" || v === "tiled") roomPref = v; } catch (e) { /* storage unavailable */ }
let roomWant = UP.get("space") === "room" || UP.get("space") === "tiled" ? UP.get("space") : roomPref;   // ?space= for this visit only
let roomIn = false;      // the lab is running (Room, on a wide screen)
let roomShown = false;   // the lab is on screen and the page hidden
let roomCanvasTab = "review";   // the plot tab the vector terminal opens
let roomState = null;

function labState() {
  const s = roomState || (roomState = { sound: {} });
  s.tab = tab; s.mode = mode; s.playing = playing; s.get = get; s.scene = scene; s.frameNo = drawNo;
  s.sound.ctx = sndCtx; s.sound.out = sndOut; s.sound.on = sndOn; s.sound.bed = soundBed;
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
const roomScreenEl = opens => opens === "source" ? $("srcws") : cv;
// Lay the page out for a terminal behind the room (hidden, so nothing shows) and give its screen element's rect.
function roomScreenRect(opens) {
  const t = opens === "source" ? "source" : roomCanvasTab;
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
// Show the room; from a terminal ("vector", "glass") the lab starts square to its screen and fades in over the page.
function roomShowLab(from) {
  if (canvasTab()) roomCanvasTab = tab;
  roomShown = true; roomPlace();
  if (!from) { document.body.classList.add("room"); LAB.show(); roomSync(); return; }
  const rect = roomScreenEl(from === "glass" ? "source" : "workbench").getBoundingClientRect();
  $("labhost").classList.add("fading"); $("labhost").style.opacity = "0";
  LAB.show(from, rect, ROOM_FADE);
  roomFade(true, () => document.body.classList.add("room"));
  roomSync();
}
function roomArrive(opens) {
  roomShown = false; document.body.classList.remove("room");
  setTab(opens === "source" ? "source" : roomCanvasTab);
  if (canvasTab()) cv.focus({ preventScroll: true });
  roomFade(false, () => { if (!roomShown) LAB.hide(); });
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
  if (v === "room" && roomIn && !roomShown) roomShowLab(tab === "source" ? "glass" : "vector");
  else roomApply();
}
$("bspace").onclick = () => roomChoose("room");
$("btiled").onclick = () => roomChoose("tiled");
// A tab picked while the room is shown flies to its terminal first.
$("tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]");
  if (!b || !roomShown) return;
  e.stopImmediatePropagation();
  if (b.dataset.tab !== "source") roomCanvasTab = b.dataset.tab;
  LAB.setTarget(b.dataset.tab === "source" ? "glass" : "vector");
}, true);
window.addEventListener("keydown", e => {
  if (e.key !== "Escape" || !roomIn || roomShown || !canvasTab() || typingIn() || $("list").classList.contains("open") || fOn()) return;
  e.preventDefault(); roomShowLab("vector");
});
WIDE.addEventListener("change", roomApply);
window.addEventListener("resize", () => { if (roomShown) roomPlace(); });
