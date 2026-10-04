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

// A jump to an event: what the GET box does, with the free-look scrubber re-centred on it.
function tlJump(g) {
  leaveAttract(); livePin = null;
  get = mode === "live" ? Math.max(LIVE_MIN, Math.min(LIVE_MAX, g)) : g;
  if (mode !== "live") get0 = get;
  airtSync();
}
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
    const r = document.createElement("div"); r.className = "tlrow"; r.dataset.i = i; r.title = "Jump to " + getStr(e[0]);
    r.innerHTML = `<span class="tlg"></span><span class="tlk"></span><span class="tln"></span>`;
    r.children[0].textContent = (e[0] < 0 ? "-" : "") + hms3(Math.floor(Math.abs(e[0]))); r.children[1].textContent = e[1]; r.children[2].textContent = e[2];
    r.onclick = () => tlJump(e[0]);
    if (on) {
      const a = document.createElement("a"); a.href = airtUrl(e[0]); a.target = "airt"; a.textContent = "↗"; a.title = "Open this moment in Apollo in Real Time";
      a.onclick = ev => ev.stopPropagation();
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
$("bairt").onclick = () => { airt = window.open(airtUrl(get), "airt"); };   // kept with its opener: re-pointing a named window needs it
$("bairtre").onclick = airtSync;
$("scrub").addEventListener("change", airtSync);   // a released scrub, not each step of the drag
$("geti").addEventListener("change", airtSync);    // after controls.js's handler has set the time
for (const id in JUMPS) $(id).addEventListener("click", airtSync);
tlChips(); tlList();
setInterval(tlTick, 200);
if (DEBUG) window.VIEW_AIRT = airtUrl;
