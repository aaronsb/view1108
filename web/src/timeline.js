// Timeline (Review): the scenario's TIMELINE cards (SP-4029's event lists, build/names.js) as chapter marks under the
// time scrubber and as a jump list, and the Apollo in Real Time companion window (Apollo 11 only).
"use strict";
const tlScenario = () => String(LS.scenario);   // the loaded scenario
const TL = NAMES.TIMELINE || {}, TL_KINDS = NAMES.TL_KINDS || [];
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
// the span applying while g.e.t. < until. view and target are in_view and in_target (0: the scene's own); fov the
// field in degrees (null: the scene's default).
const EXT_NOTE = "external view of the Earth";
const WIN_NOTE = "the CSM window aimed at the Earth";
const TL_SCENES = Object.fromEntries(Object.keys(SCNS).map(k => [k, spansOf(k).follow.map(([u, ...r]) => [u ?? Infinity, ...r])]));
const tlFor = g => { const t = TL_SCENES[tlScenario()]; return t.find(s => g < s[0]) || t[t.length - 1]; };
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
const tlTitle = g => {
  const [, s, v = 0, t = 0] = tlFor(g);
  const note = v === 1 && t === 1 ? EXT_NOTE : v === 0 && t === 1 ? WIN_NOTE : v === 1 ? "external view"
    : v === 2 ? "CM station" : v === 3 ? "LM station" : "";
  return `Jump to ${getStr(g)}: scene ${s} ${SCENES[s - 1]}` + (note ? ", " + note : "");
};
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
function tlList() {
  const box = $("tllist"); box.textContent = ""; tlCur = -2;
  const on = airtOn();
  tlEvents().forEach((e, i) => {
    if (tlFilter === "note" ? !tlNoteworthy(e) : tlFilter !== "all" && e[1] !== tlFilter) return;
    const r = document.createElement("div"); r.className = "tlrow"; r.dataset.i = i; r.title = tlTitle(e[0]);
    r.innerHTML = `<span class="tlg"></span><span class="tlk"></span><span class="tln"></span>`;
    r.children[0].textContent = (e[0] < 0 ? "-" : "") + hms3(Math.floor(Math.abs(e[0]))); r.children[1].textContent = e[1]; r.children[2].textContent = e[2];
    r.onclick = () => tlJump(e[0]);
    if (on) {
      const a = document.createElement("a"); a.href = airtUrl(e[0]); a.target = "airt"; a.textContent = "↗"; a.title = "Open this moment in Apollo in Real Time";
      a.onclick = ev => { ev.stopPropagation(); tlJump(e[0]); airtRealTime(); };
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
  $("bfollow").hidden = !follow;
  if (LS.situation !== tlScene) { tlScene = LS.situation; if (!auto()) airtSync(); }
  const ev = tlEvents(); let c = -1;
  for (let i = 0; i < ev.length && ev[i][0] <= LS.get; i++) c = i;
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
$("bfollow").onclick = tlManual;
$("scrub").addEventListener("input", tlManual);
$("scrub").addEventListener("change", airtSync);   // a released scrub, not each step of the drag
$("geti").addEventListener("change", () => { tlManual(); airtSync(); });    // after controls.js's handler has set the time
document.querySelectorAll("#jumps button").forEach(b => b.addEventListener("click", airtSync));
tlChips(); tlList();
setInterval(tlTick, 200);
if (DEBUG) {   // test hooks: the companion's address, the view a jump or Following leaves, and a time to play from
  window.VIEW_AIRT = airtUrl;
  window.VIEW_TL = { state: () => ({ scene: LS.situation, viewMode: LS.view, targetId: LS.target, fov: LS.fov, get: LS.get, mode: LS.mode, follow }), seek: g => track({ get: g }) };
}
