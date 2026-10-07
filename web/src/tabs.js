// Tabs: the workspace and the dock's control groups. Review, Simulate, Print and Fusion share the plot; Source has
// its own workspace, and the frame loop rests while it is open (loop.js).
"use strict";
const TABS = ["review", "simulate", "print", "fusion", "source"];
const TAB_OF = { attract: "review", tour: "review", free: "review", live: "simulate", beam: "print" };   // a mode's home tab
let tab = "review";
const canvasTab = () => tab !== "source";
// A tab is presentation: showing one never changes the mode, the situation or the time (docs/systems-model.md,
// section 4, rule 2). Each tab's own controls change them: Review's Mode group, Simulate's Live button, Print's Beam
// trace, a Fusion photograph.
function setTab(t) {
  if (!TABS.includes(t)) return;
  tab = t;
  showTab(); syncUI();
  if (canvasTab()) resize();
}
function showTab() {
  document.body.dataset.tab = tab;
  document.querySelectorAll("#tabs [data-tab]").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
  document.querySelectorAll("#ctl .shade").forEach(s => s.classList.toggle("offtab", !s.dataset.tabs.split(" ").includes(tab)));
  $("srcws").hidden = tab !== "source";
  if (tab === "source") srcShow();
}
document.querySelectorAll("#tabs [data-tab]").forEach(b => { b.onclick = () => setTab(b.dataset.tab); });
// T and Beam trace: start or stop Beam in Print. Beam outlives the tab, so away from Print with Beam running, T only
// shows Print and the trace goes on; a second T there stops it.
const toggleBeam = () => {
  if (tab !== "print") { setTab("print"); if (LS.mode === "beam") return; }
  loadReel(P({ mode: LS.mode === "beam" ? "free" : "beam" }));
};
$("bbeam").onclick = toggleBeam;
const bumpBeam = d => { beamIdx = Math.max(0, Math.min(BEAM_SPEEDS.length - 1, beamIdx + d)); syncUI(); };
$("bbslow").onclick = () => bumpBeam(-1);
$("bbfast").onclick = () => bumpBeam(1);
showTab();
