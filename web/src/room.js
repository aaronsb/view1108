// Room and Tiled: the workbench inside a 3D machine room (web/lab, inlined from build/lab.js as VIEW_LAB), or the
// plain page. The lab is started only when Room is chosen: in Tiled there is no WebGL context and no extra frame loop.
// In the room the vector terminal's screen is the plot (#cv), the glass terminal opens Source, the microfilm recorder
// opens Print, the line printer the kernel listing on greenbar and the bookcase (or one of its binders) the library; clicking one flies the camera to its
// close-up, and a click there shows that tab (or the listing, over it). The Room button, or Esc on a plot tab or in Source (once
// Source has closed its own overlays), flies back out.
"use strict";
const LAB = typeof VIEW_LAB !== "undefined" ? VIEW_LAB : null;
const ROOM_KEY = "view1108.space";
let roomAvail = !!LAB && LAB.supported() && !BARE;   // BARE covers ?still too
let roomPref = "room";   // the viewer's stored choice; Room unless they chose Tiled
try { const v = localStorage.getItem(ROOM_KEY); if (v === "room" || v === "tiled") roomPref = v; } catch (e) { /* storage unavailable */ }
// A link naming a view (a tab, mode, scene, code location or photograph) opens on that view: Tiled for this visit,
// unless it says ?space= itself.
const roomDeep = ["tab", "mode", "scene", "code", "photo"].some(k => UP.has(k));
let roomWant = UP.get("space") === "room" || UP.get("space") === "tiled" ? UP.get("space") : roomDeep ? "tiled" : roomPref;   // ?space= for this visit only
let roomIn = false;      // the lab is running (Room, on a wide screen)
let roomShown = false;   // the lab is on screen and the page hidden
let roomCanvasTab = "review";   // the plot tab the vector terminal opens (Review, Simulate or Fusion)
let roomState = null;

function labState() {
  const s = roomState || (roomState = { sound: {} });
  s.tab = tab; s.mode = LS.mode; s.playing = LS.playing; s.get = LS.get; s.scene = LS.situation; s.frameNo = drawNo;
  s.sound.ctx = sndCtx; s.sound.out = sndOut; s.sound.on = sndOn; s.sound.bed = soundBed; s.sound.whine = whineNode(); s.sound.printer = printerRoute;
  return s;
}
// Discrete events for the room's equipment (beam frames, engine runs).
function labEvent(type, at = performance.now(), lines = 0) { if (roomIn) LAB.event({ type, at, lines }); }

// The Room button by state: lit in the room; in Room space with a terminal's page showing, "← Room", unlit, to go
// back; in Tiled, plain. The button sits after the bar's spacer, so the longer label grows into it and nothing to its
// right moves.
function roomSync() {
  const vis = roomAvail && WIDE.matches, b = $("bspace"), back = roomIn && !roomShown;
  b.hidden = $("btiled").hidden = !vis;
  b.textContent = back ? "← Room" : "Room";
  b.classList.toggle("on", roomIn && !back); $("btiled").classList.toggle("on", !roomIn);
  b.title = back ? "Return to the room (Esc)" : "The workbench inside a machine room";
  syncUI();   // the screen (prefs.js effDisp) follows the room
}
// A flight or a crossfade under way: the room's buttons wait for it.
const roomBusy = () => $("labhost").classList.contains("fading") || (roomIn && LAB.info()?.mode === "flight");
function roomPlace() { $("labhost").style.top = $("tabs").getBoundingClientRect().bottom + "px"; }
// The handover: the lab's flight into a terminal ends where its screen covers the element that screen becomes on the
// page (#cv, the Source workspace, or the listing's page column), and the two crossfade over ROOM_FADE ms. Leaving,
// the lab starts at that pose and fades in over the page before it flies out.
const ROOM_FADE = 250;
// What each terminal opens (its `opens`), the tab that is, and the terminal a tab belongs to.
// The listing and the library open over the page, which keeps its tab.
const ROOM_OPENS = { vector: "workbench", glass: "source", filmrecorder: "print", printer: "listing", library: "library" };
const roomOver = opens => opens === "listing" || opens === "library";
const roomTabOf = opens => opens === "source" || opens === "print" ? opens : roomOver(opens) ? tab : roomCanvasTab;
const roomTermOf = t => t === "source" ? "glass" : t === "print" ? "filmrecorder" : "vector";
const roomScreenEl = opens => opens === "source" ? $("srcws") : roomOver(opens) ? null : cv;
// The printer's page: the listing (listing.js) on greenbar, open over the page; the room fades over it (page.css).
// Its rect is the first sheet's column as far as it shows, as tall as the printer's 14 7/8 x 11 in sheet would be.
let roomListing = false;
function roomListingOpen() {
  if (!roomListing) { roomListing = true; $("list").classList.add("light", "open"); buildPaper(); $("paper").scrollTop = 0; }
  $("blroom").hidden = false;
}
function roomListingClose() { roomListing = false; $("blroom").hidden = true; $("list").classList.remove("open"); $("list").style.visibility = ""; applyListing(); }
// The library (library.js) opened from the bookcase: it has no screen to match (roomRect null), so the flight ends at
// the close-up of the bookcase or binder and the room fades over the overlay.
let roomLibrary = false;
function roomLibraryClose() { roomLibrary = false; $("blibroom").hidden = true; libraryClose(); }
function roomRect(opens) {
  if (opens === "library") return null;
  if (opens !== "listing") return roomScreenEl(opens).getBoundingClientRect();
  const p = $("paper").getBoundingClientRect(), g = $("paper").querySelector(".pg").getBoundingClientRect();
  const x0 = Math.max(p.left, g.left), x1 = Math.min(p.right, g.right);
  return new DOMRect(x0, p.top, x1 - x0, (x1 - x0) * 11 / 14.875);
}
// Lay the page out for a terminal behind the room (hidden, so nothing shows) and give its screen element's rect.
function roomScreenRect(opens) {
  const t = roomTabOf(opens);
  if (tab !== t) setTab(t);
  if (opens === "listing") { roomListingOpen(); $("list").style.visibility = "hidden"; }   // laid out, unseen until arrival
  return roomRect(opens);
}
// Stepped back from a terminal's close-up: the listing laid out unseen for the printer closes again.
function roomLeave(opens) { if (opens === "listing" && roomListing) roomListingClose(); }
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
  const opens = ROOM_OPENS[from], el = roomScreenEl(opens), rect = roomRect(opens);
  $("labhost").classList.add("fading"); $("labhost").style.opacity = "0";
  LAB.show(from, rect, ROOM_FADE);
  const inset = el && roomInset(), fadeIn = () => roomFade(true, () => {
    if (el) roomUnclip(el);
    if (opens === "listing") roomListingClose();
    roomLibraryClose();   // from the bookcase or not, the library does not stay open under the room
    document.body.classList.add("room");
  });
  if (inset) {
    LAB.show(from, rect, 2 * ROOM_FADE);   // hold through the shrink as well
    roomClip(el, "inset(0px)", inset); clearTimeout(roomFadeT); roomFadeT = setTimeout(fadeIn, ROOM_FADE);
  }
  else fadeIn();
  roomSync();
}
function roomArrive(opens, name = "") {
  roomShown = false; document.body.classList.remove("room");
  setTab(roomTabOf(opens));
  if (canvasTab()) cv.focus({ preventScroll: true });
  const el = roomScreenEl(opens), inset = el && roomInset();
  if (inset) roomClip(el, inset, "inset(0px)");
  if (opens === "listing") { roomListingOpen(); $("list").style.visibility = ""; labEvent("print", performance.now(), 6); soundPrintFeed(); }   // the paper moves on as you arrive
  if (opens === "library") { roomLibrary = true; $("blibroom").hidden = false; libraryOpen(name.startsWith("binder:") ? name.slice(7) : undefined); }
  roomFade(false, () => { if (el) roomUnclip(el); if (!roomShown) LAB.hide(); });
  roomSync();
}
// Enter or leave the room to match the choice, the screen width and what the lab could do.
function roomApply() {
  const want = roomAvail && WIDE.matches && roomWant === "room";
  if (want && !roomIn) {
    if (!LAB.start($("labhost"), { screens: { vector: cv }, state: labState, arrive: roomArrive, screenRect: roomScreenRect, leave: roomLeave })) { roomAvail = false; roomSync(); return; }
    roomIn = true; roomShowLab(null);
  } else if (!want && roomIn) {
    LAB.stop(); roomIn = roomShown = false; document.body.classList.remove("room"); resize();
  }
  roomSync();
}
function roomChoose(v) {
  if (roomBusy()) return;
  if (v === "room" && roomShown && LAB.back()) return;   // at a terminal's close-up: step back out
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
  LAB.setTarget(roomTermOf(t), true);   // a tab picked opens on arrival
}, true);
window.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.defaultPrevented || !roomIn || roomShown || typingIn() || $("list").classList.contains("open")) return;
  if (tab !== "source" && fOn()) return;   // Source closed its own overlays first (srcview.js)
  e.preventDefault(); roomShowLab(roomTermOf(tab));
});
// The listing opened from the printer: Esc and its own ← Room go back to the printer (a fresh copy printing takes Esc
// first, printout.js); Close leaves it for the page underneath.
window.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.defaultPrevented || !roomListing || !roomIn || roomShown || roomBusy()) return;
  e.preventDefault(); e.stopImmediatePropagation(); roomShowLab("printer");
}, true);
$("blroom").onclick = () => { if (roomIn && !roomShown && !roomBusy()) roomShowLab("printer"); };
// The library opened from the bookcase: Esc and its ← Room go back to the bookcase; Close leaves it for the page.
window.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.defaultPrevented || !roomLibrary || !roomIn || roomShown || roomBusy()) return;
  e.preventDefault(); e.stopImmediatePropagation(); roomShowLab("library");
}, true);
$("blibroom").onclick = () => { if (roomIn && !roomShown && !roomBusy()) roomShowLab("library"); };
$("blibclose").addEventListener("click", () => { roomLibrary = false; $("blibroom").hidden = true; });
$("bclose").addEventListener("click", () => { if (roomListing) { roomListing = false; $("blroom").hidden = true; } });
WIDE.addEventListener("change", roomApply);
window.addEventListener("resize", () => { if (roomShown) roomPlace(); });
