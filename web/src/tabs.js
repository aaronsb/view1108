// Tabs: the workspace and the dock's control groups. Review, Simulate, Print and Fusion share the plot; Source has
// its own workspace, and the frame loop rests while it is open (loop.js).
"use strict";
const TABS = ["review", "simulate", "print", "fusion", "source"];
const TAB_OF = { attract: "review", tour: "review", free: "review", live: "simulate", beam: "print" };   // a mode's home tab
const REVIEW_MODES = ["attract", "tour", "free"];
let tab = "review";
const canvasTab = () => tab !== "source";
// pick: choose the tab's mode (Review keeps Attract, Tour or Free-look, else Tour; Simulate runs Live; Print and
// Fusion stop Attract or Tour for Free-look). Leaving Print always leaves Beam.
function setTab(t, pick = true) {
  if (!TABS.includes(t)) return;
  const prev = tab; tab = t;
  if (prev === "print" && t !== "print" && mode === "beam") startMode("free");
  if (pick && t !== prev) {
    if (t === "review" && !REVIEW_MODES.includes(mode)) startMode("tour");
    else if (t === "simulate" && mode !== "live") startMode("live");
    else if ((t === "print" || t === "fusion") && auto()) startMode("free");
  }
  showTab(); syncUI();
  if (canvasTab()) resize();
}
function showTab() {
  document.body.dataset.tab = tab;
  document.querySelectorAll("#tabs [data-tab]").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
  document.querySelectorAll("#ctl .shade").forEach(s => s.classList.toggle("offtab", !s.dataset.tabs.split(" ").includes(tab)));
  $("srcws").hidden = tab !== "source";
}
document.querySelectorAll("#tabs [data-tab]").forEach(b => { b.onclick = () => setTab(b.dataset.tab); });
const toggleBeam = () => { if (tab !== "print") setTab("print"); startMode(mode === "beam" ? "free" : "beam"); };
$("bbeam").onclick = toggleBeam;
const bumpBeam = d => { beamIdx = Math.max(0, Math.min(BEAM_SPEEDS.length - 1, beamIdx + d)); syncUI(); };
$("bbslow").onclick = () => bumpBeam(-1);
$("bbfast").onclick = () => bumpBeam(1);
showTab();
