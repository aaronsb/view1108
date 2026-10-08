// Room and Tiled: the workbench inside a 3D machine room (web/lab, inlined from build/lab.js as VIEW_LAB), or the
// plain page. The lab is started only when Room is chosen: in Tiled there is no WebGL context and no extra frame loop.
// What each piece of equipment does is the lab's station table (web/lab/src/stations.ts, VIEW_LAB.stations): the vector
// terminal's screen is the plot (#cv), the glass terminal opens Source, the microfilm recorder Print, the line printer
// the kernel listing on greenbar over the page, the bookcase (or one of its binders) the library over it; clicking one
// flies the camera to its close-up, and a click there shows that tab or overlay. The drive is the mounted reel's
// STOP/START (drivePlay, player.js), used in place. The tape rack holds the site reel index (reels.js reelIndex, handed
// over as hooks.reels): a reel pulled there and used on a tape unit is mounted through reelMount, Tabbed's reel list's
// loadReel (#19). A second click on a pulled reel, or on a pulled mission notebook on the bookcase, asks a modal
// (ask.js, roomAsk; the operator, 2026-10-07): LOAD NEW SIMULATION SCENARIO? mounts the reel through reelMount, LOAD
// SIMULATION AND REVIEW NOTEBOOK? mounts it and opens the notebook, or only opens it (#29). The notebook viewer's "Load
// this reel" comes back to the room with that reel out and carried (roomCarry). The Room button, or Esc (the one stack,
// esc.js), flies back out.
"use strict";
const LAB = typeof VIEW_LAB !== "undefined" ? VIEW_LAB : null;
const ROOM_KEY = "view1108.space";
let roomAvail = !!LAB && LAB.supported() && !BARE;   // BARE covers ?still too
let roomPref = "room";   // the viewer's stored choice; Room unless they chose Tiled
try { const v = localStorage.getItem(ROOM_KEY); if (v === "room" || v === "tiled") roomPref = v; } catch (e) { /* storage unavailable */ }
// A link naming a view (a tab, mode, situation (scn, sit or scene), code location or photograph) opens on that view: Tiled for this visit,
// unless it says ?space= itself.
const roomDeep = ["tab", "mode", "scn", "sit", "scene", "code", "photo"].some(k => UP.has(k));
let roomWant = UP.get("space") === "room" || UP.get("space") === "tiled" ? UP.get("space") : roomDeep ? "tiled" : roomPref;   // ?space= for this visit only
let roomIn = false;      // the lab is running (Room, on a wide screen)
let roomShown = false;   // the lab is on screen and the page hidden
let roomCanvasTab = "review";   // the plot tab the vector terminal opens (Review, Simulate or Fusion)
let roomState = null;

function labState() {
  const s = roomState || (roomState = { sound: {} });
  s.tab = tab; s.mode = LS.mode; s.playing = LS.playing; s.reel = reelLabel(); s.mounted = reelMounted(); s.get = LS.get; s.frameNo = drawNo;
  s.situation = LS.situation; s.scenario = LS.scenario; s.mission = LS.mission; s.epoch = LS.epoch; s.zero = LS.zero;
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
// From the station table: what each terminal opens (its `opens`), whether that is an overlay (the listing and the
// library open over the page, which keeps its tab), the tab it shows (the workbench: the plot tab last shown), and the
// terminal a tab belongs to.
const STATIONS = LAB ? LAB.stations : [];
const roomStation = opens => STATIONS.find(s => s.opens === opens);
const ROOM_OPENS = Object.fromEntries(STATIONS.filter(s => s.does !== "control").map(s => [s.name, s.opens]));
const roomOver = opens => roomStation(opens)?.does === "overlay";
const roomShelf = opens => roomStation(opens)?.does === "shelf";
const roomBench = t => STATIONS.find(s => s.tabs.includes(t))?.opens === "workbench";   // a plot tab the workbench shows
const roomTabOf = opens => roomOver(opens) ? tab : roomStation(opens).opens === "workbench" ? roomCanvasTab : roomStation(opens).tabs[0];
const roomTermOf = t => (STATIONS.find(s => s.tabs.includes(t)) || roomStation("workbench")).name;
const roomScreenEl = opens => opens === "source" ? $("srcws") : roomOver(opens) || roomShelf(opens) ? null : cv;   // a shelf has no screen
// The printer's page: the listing (listing.js) on greenbar, open over the page; the room fades over it (page.css).
// Its rect is the first sheet's column as far as it shows, as tall as the printer's 14 7/8 x 11 in sheet would be.
let roomListing = false;
function roomListingOpen() {
  if (!roomListing) { roomListing = true; $("list").classList.add("light", "open"); buildPaper(); $("paper").scrollTop = 0; }
  $("blroom").hidden = false;
}
function roomListingClose() { roomListing = false; $("blroom").hidden = true; listingClose(); $("list").style.visibility = ""; applyListing(); }
// The library (library.js) opened from the bookcase, one of its binders or a mission notebook: it has no screen to
// match (roomRect null), so the flight ends at the close-up of the bookcase or binder and the room fades over the
// overlay.
let roomLibrary = false;
function roomLibraryClose() { roomLibrary = false; $("blibroom").hidden = true; libraryClose(); }
// The notebook viewer's "Load this reel" in the room: the room at the rack, with reel `id` out and carried to a tape
// unit (its notebook half out on the bookcase), on the Esc stack as "pulled" (the lab's carryReel). From a page, the
// room comes back in front of the rack; with the room already shown (the library left open as the window widened into
// the room), the camera flies to the rack; while a flight or a crossfade runs, it waits for it.
function roomCarry(id) {
  roomLibraryClose();
  roomToRack(() => LAB.carry(id));
}
// The room at the tape rack (the sim panel's [ RETURN TO REELS ], #73; and roomCarry): from a page, the room comes back
// in front of the rack, and with `close` goes on to the rack's close-up once it has faded in, so a reel can be pulled
// at once; with the room shown, the camera flies to the close-up. While a flight or a crossfade runs, it waits. `then`
// runs once the lab is at (or flying to) the rack.
function roomToRack(then = () => {}, close = false, tries = 0) {
  if (roomBusy()) { if (tries < 40) setTimeout(() => roomToRack(then, close, tries + 1), 100); return; }
  if (roomShown) { then(); LAB.setTarget("rack"); return; }
  roomShowLab("rack");
  then();
  if (close) roomToRack();
}
// The lab asks about what was pulled (hooks.ask): the reel modal or the notebook modal; the answer goes back to the lab
// (VIEW_LAB.answer), which puts it back, mounts its reel (reelMount: a fresh run, the clock stopped) or opens the
// notebook. Esc is the put-back.
function roomAsk(kind, id, title) {
  const back = () => LAB.answer("back");
  if (kind === "reel") askOpen("LOAD NEW SIMULATION SCENARIO?", [
    { label: `LOAD ${title} AND EXEC`, primary: true, run: () => LAB.answer("load") },
    { label: "PUT TAPE BACK", run: back }], back);
  else askOpen("LOAD SIMULATION AND REVIEW NOTEBOOK?", [
    { label: `LOAD ${title} AND OPEN NOTEBOOK`, primary: true, run: () => LAB.answer("loadread") },
    { label: "READ NOTEBOOK ONLY", run: () => LAB.answer("read") },
    { label: "PUT NOTEBOOK BACK", run: back }], back);
}
// Back to the room from a terminal's page or an overlay, standing in front of terminal `from`, unless a flight or a
// crossfade is under way.
function roomBack(from) { if (roomIn && !roomShown && !roomBusy()) roomShowLab(from); }
function roomRect(opens) {
  if (opens !== "listing") return roomScreenEl(opens)?.getBoundingClientRect() ?? null;   // an overlay or a shelf: none
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
  if (roomBench(tab)) roomCanvasTab = tab;
  roomShown = true; roomPlace(); escDrop("terminal");
  if (!from) { document.body.classList.add("room"); LAB.show(); roomSync(); return; }
  const opens = ROOM_OPENS[from], el = roomScreenEl(opens), rect = roomRect(opens);
  $("labhost").classList.add("fading"); $("labhost").style.opacity = "0";
  LAB.show(from, rect, ROOM_FADE);
  const inset = el && roomInset(), fadeIn = () => roomFade(true, () => {
    if (el) roomUnclip(el);
    if (roomListing) roomListingClose();   // from the printer or not (the tab bar's ← Room), the listing and the
    roomLibraryClose();                     // library do not stay open under the room
    document.body.classList.add("room");
  });
  if (inset) {
    LAB.show(from, rect, 2 * ROOM_FADE);   // hold through the shrink as well
    roomClip(el, "inset(0px)", inset); clearTimeout(roomFadeT); roomFadeT = setTimeout(fadeIn, ROOM_FADE);
  }
  else fadeIn();
  roomSync();
}
// Arrival at a terminal's page: on the Esc stack as "terminal" (back to the room in front of its terminal), and an
// overlay above it (back to the printer or the bookcase; with the room gone, it only closes).
function roomArrive(opens, name = "") {
  roomShown = false; document.body.classList.remove("room");
  setTab(roomTabOf(opens));
  escPush("terminal", () => roomBack(roomTermOf(tab)));   // Fusion's Move photo takes Esc first (fusion.js)
  if (canvasTab()) cv.focus({ preventScroll: true });
  const el = roomScreenEl(opens), inset = el && roomInset();
  if (inset) roomClip(el, inset, "inset(0px)");
  if (opens === "listing") {   // the paper moves on as you arrive
    roomListingOpen(); $("list").style.visibility = ""; labEvent("print", performance.now(), 6); soundPrintFeed();
    escPush("listing", () => roomIn ? roomBack("printer") : roomListingClose());
  }
  if (opens === "library") {
    roomLibrary = true; $("blibroom").hidden = false; libraryOpen(name.startsWith("binder:") ? name.slice(7) : undefined);
    escPush("library", () => roomIn ? roomBack("library") : roomLibraryClose());
  }
  roomFade(false, () => { if (el) roomUnclip(el); if (!roomShown) LAB.hide(); });
  roomSync();
}
// Enter or leave the room to match the choice, the screen width and what the lab could do.
function roomApply() {
  const want = roomAvail && WIDE.matches && roomWant === "room";
  if (want && !roomIn) {
    const esc = (k, pop) => pop ? escPush(k, pop) : escDrop(k);
    if (!LAB.start($("labhost"), { screens: { vector: cv }, state: labState, arrive: roomArrive, screenRect: roomScreenRect, leave: roomLeave, drive: drivePlay, esc, reels: reelIndex(), mount: reelMount, ask: roomAsk })) { roomAvail = false; roomSync(); return; }
    roomIn = true; escBase("room", () => { if (roomShown) LAB.home(); }); roomShowLab(null);
  } else if (!want && roomIn) {
    LAB.stop(); roomIn = roomShown = false; document.body.classList.remove("room"); resize();
    askClose(); for (const k of ["room", "terminal", "closeup", "pulled"]) escDrop(k);
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
  if (roomBench(t)) roomCanvasTab = t;
  LAB.setTarget(roomTermOf(t), true);   // a tab picked opens on arrival
}, true);
// The listing opened from the printer: its ← Room (and Esc, roomArrive) go back to the printer; Close leaves it for the
// page underneath. The library opened from the bookcase: the same, back to the bookcase.
$("blroom").onclick = () => roomBack("printer");
$("blibroom").onclick = () => roomBack("library");
// Esc in the room: the browser's own, releasing the pointer lock, is not the stack's.
if (LAB) escGuard = () => roomShown && LAB.escLock();
$("blibclose").addEventListener("click", () => { roomLibrary = false; $("blibroom").hidden = true; });
$("bclose").addEventListener("click", () => { if (roomListing) { roomListing = false; $("blroom").hidden = true; } });
WIDE.addEventListener("change", roomApply);
window.addEventListener("resize", () => { if (roomShown) roomPlace(); });
