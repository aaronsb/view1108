// Timeline (Review, Simulate, Print): the scenario's TIMELINE cards (SP-4029's event lists, its reel's page.json) as
// chapter marks under the time scrubber, and the reel's event listing (#29 slice f, #73; tools/pack.py, reelpkg.js) as
// the event list: its situations as marked entries, each with its quick-view key where it has one, among its timeline
// events. Picking a situation applies its view (its situation at its defaults, its own view and target); picking an
// event moves the time (tlJump). Keys 1-9 are the reel's quick views and do exactly what picking their entry does.
// Follow, for any scenario with FOLLOW spans; and the Apollo in Real Time companion window (Apollo 11 only), whose
// buttons start Following too. The listing, its marks and the quick views are ours.
"use strict";
const tlScenario = () => LS.scn;   // the loaded scenario, by its reel's id (config.js TL, SCNS)
const TL_KINDS = NAMES.TL_KINDS || [];
const tlListing = () => (SCNS[tlScenario()] || {}).listing || [];   // the loaded reel's event listing
const tlQuick = () => (SCNS[tlScenario()] || {}).quick || {};       // its quick views, key -> entry id
const tlKeyOf = id => Object.keys(tlQuick()).find(k => tlQuick()[k] === id) || "";
// Noteworthy: our own short list of the mission's milestones, matched by kind and a pattern on the SP-4029 row name.
const TL_NOTE = [
  ["LAUNCH", /^Liftoff/], ["ORBIT", /^Earth orbit insertion/], ["ORBIT", /^Translunar injection$/],
  ["SEP", /^CSM docked with LM/], ["BURN", /^Lunar orbit insertion ignition/], ["SEP", /^CSM\/LM undocked/],
  ["BURN", /powered descent engine ignition/], ["SURFACE", /^LM lunar landing/], ["SURFACE", /lunar liftoff/],
  ["SEP", /^CSM\/LM docked/], ["BURN", /^Transearth injection ignition/], ["ENTRY", /^Entry$/], ["ENTRY", /^Splashdown/]
];
const tlNoteworthy = e => TL_NOTE.some(([k, re]) => e[1] === k && re.test(e[2]));
let tlFilter = "note";   // "note", "all" or a kind
const tlEvents = () => (TL[tlScenario()] || { events: [] }).events;

// Apollo in Real Time's address for a g.e.t., as its page reads it (apolloinrealtime.org/11/index.js, read
// 2026-10-04: secondsToTimeStr and $.getUrlVar("t")): ?t=HHH:MM:SS, hours to 3 digits; a negative time is |t| so
// formatted with its first character replaced by "-".
const hms3 = t => String(Math.floor(t / 3600)).padStart(3, "0") + ":" + pad2(Math.floor(t / 60) % 60) + ":" + pad2(t % 60);
function airtUrl(g) {
  const s = hms3(Math.floor(Math.abs(g)));
  return "https://apolloinrealtime.org/11/?t=" + (g < 0 ? "-" + s.slice(1) : s);
}
let airt = null;   // the companion window's handle, from its button's click
const airtOn = () => LS.mission === "APOLLO 11";   // the companion site's mission (its address above)
function airtSync() { if (airt && !airt.closed && airtOn()) try { airt.location = airtUrl(LS.get); } catch (e) { airt = null; } }   // refused: wait for the button

// Apollo in Real Time plays at 1x, so a link to it puts the replay at 1x and playing too (Tour and Attract,
// which drive time themselves, give way to Free-look; Live keeps its clock at 1x).
// In Free-look it also starts Following: the scene tracks the g.e.t. (tlFit) until a manual scene or time change.
function airtRealTime() {
  leaveAttract();
  if (LS.mode === "live") liveIdx = LIVE_RATES.indexOf(1); else speedIdx = SPEEDS.indexOf(1);
  track({ playing: true }); follow = LS.mode === "free"; syncUI();
}

// The camera for a g.e.t., outside Live (whose phases are coarser and pin the windowed scenes through its jumps): each
// scenario's FOLLOW spans (its SPAN cards, which carry their sources; config.js), [until, scene, view, target, fov],
// the span applying while g.e.t. < until (config.js followAt). view and target are in_view and in_target (0: the
// scene's own); fov the field in degrees (null: the scene's default).
const EXT_NOTE = "external view of the Earth";
const WIN_NOTE = "the CSM window aimed at the Earth";
const tlFor = g => followAt(tlScenario(), g);
// The current view suits g if it is the span's scene, in the view and target the span names (where FEAT.view offers
// them) and, where the span leaves one to the scene, not still in the one tlFit put for an earlier span; a station or
// external view the viewer chose where the span leaves the view to the scene is kept.
let tlPut = null;   // [view, target] tlFit put, where it put either
const tlSuits = g => {
  const [, s, v = 0, t = 0] = tlFor(g);
  if (s !== LS.situation) return false;
  if (!FEAT.view) return true;
  if ((v && LS.view !== v) || (t && LS.target !== t)) return false;
  return !(tlPut && ((!v && tlPut[0] && LS.view === tlPut[0]) || (!t && tlPut[1] && LS.target === tlPut[1])));
};
function tlFit(g) {   // load the span for g.e.t. g: its scene, view, target and field (loader.js, by="follow")
  const [, s, v = 0, t = 0, w = null] = tlFor(g);
  loadReel(P({ by: "follow", scene: s, view: v, target: t, fov: w, get: g }));
  tlPut = FEAT.view && (v || t) ? [v, t] : null;
}
// A jump to an event: the scene that suits its time (tlFit), else only the time, with the scrubber re-centred on it.
function tlJump(g) {
  leaveAttract();
  if (LS.mode !== "live" && !tlSuits(g)) tlFit(g); else loadReel(P({ by: "event", get: g }));
  airtSync();
}
// An entry of the listing picked (the list, a quick-view key, the notebook's run sheet): a situation applies its view
// (a viewer's pick of its scene, its own view and target: loader.js loadPick), an event moves the time (tlJump).
function tlPick(e) {
  if (e.kind !== "situation") { tlJump(e.get); return; }
  leaveAttract(); tlManual();
  loadReel(P({ scene: e.scene, view: 0, target: 0 }));
  airtSync();
}
// Key k (1-9): the loaded reel's quick view, if it maps one. True if it did something.
function tlQuickKey(k) {
  const e = tlListing().find(x => x.id === tlQuick()[k]);
  if (e) tlPick(e);
  return !!e;
}
const tlFov = e => e.fov === null ? "its own field" : `${e.fov}°`;
const tlTitle = e => {
  if (e.kind === "situation") return `Apply ${e.name}: ${e.view} view, target ${e.target}, ${tlFov(e)}, at ${getStr(e.get)}`;
  const [, s, v = 0, t = 0] = tlFor(e.get);
  const note = v === 1 && t === 1 ? EXT_NOTE : v === 0 && t === 1 ? WIN_NOTE : v === 1 ? "external view"
    : v === 2 ? "CM station" : v === 3 ? "LM station" : "";
  return `Jump to ${getStr(e.get)}: scene ${s} ${SCENES[s - 1]}` + (note ? ", " + note : "");
};
const tlGetStr = g => (g < 0 ? "-" : "") + hms3(Math.floor(Math.abs(g)));
const tlSpan = () => LS.mode === "live" ? [LIVE_MIN, LIVE_MAX] : [LS.get0 - 7200, LS.get0 + 7200];   // the scrubber's (loop.js)

function tlChips() {
  const box = $("tlkinds"); box.textContent = "";
  for (const k of ["note", "all", ...TL_KINDS]) {
    const b = document.createElement("button"); b.textContent = k === "note" ? "Noteworthy" : k;
    b.classList.toggle("on", k === tlFilter);
    b.onclick = () => { tlFilter = k; tlChips(); tlList(); };
    box.appendChild(b);
  }
}
// The list: every situation, marked, and the events the filter keeps, in g.e.t. order (the listing's).
function tlList() {
  const box = $("tllist"); box.textContent = ""; tlCur = -2;
  const on = airtOn();
  $("hintscenes").textContent = Object.keys(tlQuick()).join(" ") || "none";
  tlListing().forEach((e, i) => {
    const sit = e.kind === "situation", ev = [e.get, e.tl, e.name];
    if (!sit && (tlFilter === "note" ? !tlNoteworthy(ev) : tlFilter !== "all" && e.tl !== tlFilter)) return;
    const r = document.createElement("div"), key = tlKeyOf(e.id);
    r.className = sit ? "tlrow tlsit" : "tlrow"; r.dataset.i = i; r.dataset.id = e.id; r.title = tlTitle(e) + (key ? ` (key ${key})` : "");
    for (const [cls, t] of [["tlg", tlGetStr(e.get)], ["tlk", sit ? "SITUATION" : e.tl], ["tln", e.name]]) {
      const s = document.createElement("span"); s.className = cls; s.textContent = t; r.appendChild(s);
    }
    if (key) { const q = document.createElement("b"); q.className = "tlq"; q.textContent = key; r.children[2].prepend(q); }
    r.onclick = () => tlPick(e);
    if (on) {
      const a = document.createElement("a"); a.href = airtUrl(e.get); a.target = "airt"; a.textContent = "↗"; a.title = "Open this moment in Apollo in Real Time";
      a.onclick = x => { x.stopPropagation(); tlPick(e); airtRealTime(); };
      r.appendChild(a);
    }
    box.appendChild(r);
  });
}
function tlMarks() {
  const box = $("tlmarks"); box.textContent = "";
  const [a, b] = tlSpan();
  tlEvents().forEach(e => {
    if (e[0] < a || e[0] > b || (tlFilter === "note" && !tlNoteworthy(e))) return;
    const m = document.createElement("i"); m.title = getStr(e[0]) + " " + e[2];
    m.style.left = `calc(8px + (100% - 16px) * ${(e[0] - a) / (b - a)})`;   // the range's thumb travels 8 px in from each end
    m.onclick = () => tlJump(e[0]);
    box.appendChild(m);
  });
}
// The nearest event at or before the current time is highlighted in the list.
let tlCur = -2, tlKey = "", tlScene = 0;
function tlTick() {
  const key = [tlScenario(), tlFilter, LS.mode === "live", Math.round(LS.get0)].join(" ");
  if (key !== tlKey) {
    const scn = tlKey.split(" ")[0]; tlKey = key;
    if (scn !== tlScenario()) { tlList(); $("tlairt").hidden = !airtOn(); }
    tlMarks();
  }
  if (LS.mode !== "free") follow = false;
  if (follow && !tlSuits(LS.get)) { tlFit(LS.get); tlScene = LS.situation; }   // the companion plays on at this time: not re-pointed
  const fb = $("bfollow"); fb.hidden = !spansOf(tlScenario()).follow.length;   // Follow: any scenario with FOLLOW spans
  fb.classList.toggle("on", follow); fb.textContent = follow ? "Following" : "Follow";
  if (LS.situation !== tlScene) { tlScene = LS.situation; if (!auto()) airtSync(); }
  const ev = tlListing(); let c = -1;
  for (let i = 0; i < ev.length && ev[i].get <= LS.get; i++) c = i;
  if (c === tlCur) return; tlCur = c;
  let best = null;
  for (const r of $("tllist").children) { r.classList.remove("cur"); if (+r.dataset.i <= c) best = r; }
  if (!best) return;
  best.classList.add("cur");   // scrolled into view within the list only, never moving the dock
  const box = $("tllist"), top = best.offsetTop;   // the list is the offset parent (page.css)
  if (top < box.scrollTop || top + best.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top - box.clientHeight / 3;
}
$("bairt").onclick = () => { airtRealTime(); airt = window.open(airtUrl(LS.get), "airt"); };   // kept with its opener: re-pointing a named window needs it
$("bairtre").onclick = () => { airtRealTime(); airtSync(); };
// A view, target or time the user picks ends Following and forgets the view and target the last jump put.
function tlManual() { follow = false; tlPut = null; }
// Follow, on its own (#35): Free-look (from any mode; a reel gives way as to any input), the span for the current time.
function tlFollow() {
  if (follow) { tlManual(); return; }
  if (LS.mode !== "free") loadReel(P({ mode: "free" }));
  follow = true; tlPut = null; tlTick(); syncUI();
}
$("bfollow").onclick = tlFollow;
$("scrub").addEventListener("input", tlManual);
$("scrub").addEventListener("change", airtSync);   // a released scrub, not each step of the drag
$("geti").addEventListener("change", () => { tlManual(); airtSync(); });    // after controls.js's handler has set the time
tlChips(); tlList();
setInterval(tlTick, 200);
if (DEBUG) {   // test hooks: the companion's address, the view a jump or Following leaves, and a time to play from
  window.VIEW_AIRT = airtUrl;
  window.VIEW_TL = { state: () => ({ scene: LS.situation, scn: LS.scn, viewMode: LS.view, targetId: LS.target, fov: LS.fov, get: LS.get, mode: LS.mode, playing: LS.playing, follow, mounted: reelMounted() }), seek: g => track({ get: g }),
    // the clock paused, at g.e.t. g (seconds or h:mm:ss) when given: for screenshots (tools/shots.mjs)
    hold: g => { track(g === undefined ? { playing: false } : { playing: false, get: parseGet(String(g)) }); syncUI(); } };
}
