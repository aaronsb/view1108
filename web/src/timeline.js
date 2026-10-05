// Timeline (Review): the scenario's TIMELINE cards (SP-4029's event lists, build/names.js) as chapter marks under the
// time scrubber and as a jump list, and the Apollo in Real Time companion window (Apollo 11 only).
"use strict";
const SCENE_SCENARIO = { 9: "2" };   // VINIT's scene-to-scenario map (CLAUDE.md): scene 9 Apollo 8, the rest Apollo 11
const tlScenario = () => SCENE_SCENARIO[scene] || "1";
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
const airtOn = () => tlScenario() === "1";
function airtSync() { if (airt && !airt.closed && airtOn()) try { airt.location = airtUrl(get); } catch (e) { airt = null; } }   // refused: wait for the button

// Apollo in Real Time plays at 1x, so a link to it puts the replay at 1x and playing too (Tour and Attract,
// which drive time themselves, give way to Free-look; Live keeps its clock at 1x).
// In Free-look it also starts Following: the scene tracks the g.e.t. (tlFit) until a manual scene or time change.
function airtRealTime() {
  if (mode === "attract" || mode === "tour") startMode("free");
  if (mode === "live") liveIdx = LIVE_RATES.indexOf(1); else speedIdx = SPEEDS.indexOf(1);
  playing = true; follow = mode === "free"; syncUI();
}

// The camera for a g.e.t., outside Live (whose PHASES are coarser and pin the windowed scenes through JUMPS): each
// scenario's time cut into spans [until, scene, view, target, fov], the span applying while g.e.t. < until. view and
// target are in_view and in_target (0, or absent: the scene's own); fov the field in degrees (absent: the scene's
// default). [t, s, 1, 1, 20]: no scene's own camera has a state or draws anything useful then, so the scene's EXTERNAL
// view looks at the Earth at a 20 deg field (ours), the disc with its LC-39A mark (learth.f DPAD); the CSM is marked
// where VSTATE puts it. The spans are ours, from the scenarios' cards and the kernel's code (data/scenarios/*.scn, src/*.f):
const EXT_NOTE = "external view of the Earth";
const WIN_NOTE = "the CSM window aimed at the Earth";
const TL_SCENES = {
  1: [   // Apollo 11
    [709.33, 3, 1, 1, 20],  // before Earth orbit insertion (the first LEG card, CIRC FROM 0:11:49.33): LEGAT stretches the parking orbit back
    [10800, 3],             // CIRC leg and the TLI conic: scene 3's forward horizon view (vdrive.f SCNCAM) loses the Earth near 3:00 (our run)
    [11723, 3, 1, 1, 20],   // TLI coast to the CSM's separation from the S-IVB, 3:15:23 (TIMELINE row, SP p. 106)
    [12243.1, 7],           // S7POSE: 100 ft until APPR, closing to the DOCK event, 3:24:03.1 (MR Table 7-II p. 7-9)
    [15423, 7, 1, 5, 40],   // docked, seen from outside (S7POSE puts the CSM on the LM's axis) to the stack's ejection, 4:17:03 (TIMELINE row, SP p. 106); 40 deg ours
    [272990.37, 8],         // the docked stack (S8POSE) on the translunar conics to LOI ignition, 75:49:50.37 (TIMELINE row; LUNAR FROM 75:49:50.4)
    [360720, 1],            // lunar orbit (LUNAR legs, LUNORB) to the UNDOCK event
    [362401.9, 4],          // LMPIRO's LM 300 ft away, to the separation cutoff 100:40:01.9 (third LUNAR leg's T)
    [369339.9, 1],          // to the modelled descent: LMDESC's last 600 s before the TOUCH event
    [447720.79, 5],         // the descent, then the landed LM (LMDESC holds TAU at 0), to lunar liftoff 124:22:00.79 (TIMELINE row)
    [487573.7, 1],          // lunar orbit to the transearth leg (CONIC FROM 135:26:13.7)
    [698400, 2],            // transearth coast: scene 2's held attitude (VINIT) keeps the Earth in frame to about 194:00 (our run)
    [702186.7, 3],          // the entry approach in scene 3's horizon view, to the EI event 195:03:05.7
    [Infinity, 3, 1, 1, 20] // the entry leg past EI is a conic without an atmosphere
  ],
  2: [   // Apollo 8 (data/scenarios/apollo8-asflown.scn): scene 9 rides its LUNAR legs (LUNORB) with the Earthrise
         // camera, and the Earth legs with scene 3's forward view above the horizon (vdrive.f SCNCAM, traj.f LUNIN).
         // The 50 deg field of the window views is MSC IN 69-FM-197's for the CSM window aimed at the Earth on
         // Apollo 11's transearth coast (figure 7.3.2-1, "constant field of view (earth)", printed p. 207).
    [694.98, 9, 1, 1, 20],  // before the CIRC leg, FROM 0:11:34.98 (SP p. 45 ascent table)
    [10565.5, 9, 0, 0, 70], // the CIRC leg (to 2:50:37.79, then stretched) to TLI, 2:56:05.5 (EVENT TLI, MR8 Table 5-II p. 5-7): the horizon view at scene 3's 70 deg (VINIT)
    [14400, 9, 1, 1, 20],   // the TLI conic while the Earth's disc overfills the window's 50 deg field, to about 4:00 (our run)
    [248900.4, 9, 0, 1, 50],// the translunar conics to LOI ignition, 69:08:20.4 (the first LUNAR leg's FROM; EVENT LOI1, MR8 Table 3-I p. 3-3)
    [321556.6, 9],          // lunar orbit to TEI ignition, 89:19:16.6 (the last LUNAR leg's TO; EVENT TEI, MR8 Table 3-I p. 3-3)
    [528372.8, 9, 0, 1, 50],// the transearth conics to entry interface, 146:46:12.8 (EVENT EI, MR8 Table 3-I p. 3-4)
    [Infinity, 9, 1, 1, 20] // the entry leg past EI is a conic without an atmosphere
  ]
};
const tlFor = g => { const t = TL_SCENES[tlScenario()]; return t.find(s => g < s[0]) || t[t.length - 1]; };
// The current view suits g if it is the span's scene, in the view and target the span names (where FEAT.view offers
// them) and, where the span leaves one to the scene, not still in the one tlFit put for an earlier span; a station or
// external view the viewer chose where the span leaves the view to the scene is kept.
let tlPut = null;   // [view, target] tlFit put, where it put either
const tlSuits = g => {
  const [, s, v = 0, t = 0] = tlFor(g);
  if (s !== scene) return false;
  if (!FEAT.view) return true;
  if ((v && viewMode !== v) || (t && targetId !== t)) return false;
  return !(tlPut && ((!v && tlPut[0] && viewMode === tlPut[0]) || (!t && tlPut[1] && targetId === tlPut[1])));
};
function tlFit(g) {   // put the scene and look for g.e.t. g: the span's view, target and field, else the scene's
  const [, s, v = 0, t = 0, w = null] = tlFor(g), f = follow;
  setScene(s); follow = f;
  const named = FEAT.view && (v || t);
  viewMode = named ? v : 0; targetId = named ? t : 0; tlPut = named ? [v, t] : null;
  if (w != null && (named || (!v && !t))) fov = fov0 = w;
  get = get0 = g; syncUI();
}
// A jump to an event: the scene that suits its time (tlFit), else only the time, with the scrubber re-centred on it.
function tlJump(g) {
  leaveAttract(); livePin = null;
  if (mode === "live") get = Math.max(LIVE_MIN, Math.min(LIVE_MAX, g));
  else if (!tlSuits(g)) tlFit(g);
  else get = get0 = g;
  airtSync();
}
const tlTitle = g => {
  const [, s, v = 0, t = 0] = tlFor(g);
  const note = v === 1 && t === 1 ? EXT_NOTE : v === 0 && t === 1 ? WIN_NOTE : v === 1 ? "external view" : "";
  return `Jump to ${getStr(g)}: scene ${s} ${SCENES[s - 1]}` + (note ? ", " + note : "");
};
const tlSpan = () => mode === "live" ? [LIVE_MIN, LIVE_MAX] : [get0 - 7200, get0 + 7200];   // the scrubber's (loop.js)

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
  const key = [tlScenario(), tlFilter, mode === "live", Math.round(get0)].join(" ");
  if (key !== tlKey) {
    const scn = tlKey.split(" ")[0]; tlKey = key;
    if (scn !== tlScenario()) { tlList(); $("tlairt").hidden = !airtOn(); }
    tlMarks();
  }
  if (mode !== "free") follow = false;
  if (follow && !tlSuits(get)) { tlFit(get); tlScene = scene; }   // the companion plays on at this time: not re-pointed
  $("bfollow").hidden = !follow;
  if (scene !== tlScene) { tlScene = scene; if (mode !== "attract" && mode !== "tour") airtSync(); }
  const ev = tlEvents(); let c = -1;
  for (let i = 0; i < ev.length && ev[i][0] <= get; i++) c = i;
  if (c === tlCur) return; tlCur = c;
  let best = null;
  for (const r of $("tllist").children) { r.classList.remove("cur"); if (+r.dataset.i <= c) best = r; }
  if (!best) return;
  best.classList.add("cur");   // scrolled into view within the list only, never moving the dock
  const box = $("tllist"), top = best.offsetTop;   // the list is the offset parent (page.css)
  if (top < box.scrollTop || top + best.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top - box.clientHeight / 3;
}
$("bairt").onclick = () => { airtRealTime(); airt = window.open(airtUrl(get), "airt"); };   // kept with its opener: re-pointing a named window needs it
$("bairtre").onclick = () => { airtRealTime(); airtSync(); };
$("bfollow").onclick = () => { follow = false; };
$("scrub").addEventListener("input", () => { follow = false; });
$("scrub").addEventListener("change", airtSync);   // a released scrub, not each step of the drag
$("geti").addEventListener("change", () => { follow = false; airtSync(); });    // after controls.js's handler has set the time
for (const id in JUMPS) $(id).addEventListener("click", airtSync);
tlChips(); tlList();
setInterval(tlTick, 200);
if (DEBUG) {   // test hooks: the companion's address, the view a jump or Following leaves, and a time to play from
  window.VIEW_AIRT = airtUrl;
  window.VIEW_TL = { state: () => ({ scene, viewMode, targetId, fov, get, mode, follow }), seek: g => { get = g; } };
}
