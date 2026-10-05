// Source tab: colour theme, listing font and size (ours, a modern comfort). A theme is a set of CSS variables on
// #srcws (page.css, Source block); this sets data-sxtheme and data-sxfont there and --sx-fs, and mounts the picker
// in the Source toolbar once srcview.js has built it. Remembered per viewer; ?theme= overrides for one visit.
"use strict";
const SXT_THEMES = [["phosphor", "PHOSPHOR"], ["dark", "DARK"], ["light", "LIGHT"], ["contrast", "HIGH CONTRAST"]];
const SXT_FONTS = [["auto", "FONT: THEME"], ["3270", "3270 (period)"], ["jbm", "JETBRAINS MONO"], ["system", "SYSTEM MONO"]];
const SXT_KEY = "view1108.srctheme", SXT_FS = [11, 12, 13, 14, 15, 16, 18, 20];
const sxt = { theme: "phosphor", font: "auto", fs: 14 };
try { Object.assign(sxt, JSON.parse(localStorage.getItem(SXT_KEY) || "{}")); } catch (e) { /* storage unavailable */ }
const sxtValid = (list, v) => list.some(([k]) => k === v);
if (!sxtValid(SXT_THEMES, sxt.theme)) sxt.theme = "phosphor";
if (!sxtValid(SXT_FONTS, sxt.font)) sxt.font = "auto";
if (!SXT_FS.includes(sxt.fs)) sxt.fs = 14;
let sxtLink = UP.get("theme");   // a link's theme applies to this visit only, until the viewer picks one
if (!sxtValid(SXT_THEMES, sxtLink)) sxtLink = null;
const sxtTheme = () => sxtLink || sxt.theme;
// The link parameter: the theme in use, when it is not the default.
function srcThemeParam() { return sxtTheme() === "phosphor" ? null : sxtTheme(); }
function sxtApply() {
  const ws = $("srcws"), th = sxtTheme();
  ws.dataset.sxtheme = th;
  ws.dataset.sxfont = sxt.font !== "auto" ? sxt.font : th === "phosphor" ? "3270" : "jbm";
  ws.style.setProperty("--sx-fs", sxt.fs + "px");
  if ($("sxthm")) { $("sxthm").value = th; $("sxfnt").value = sxt.font; $("sxfdn").disabled = sxt.fs === SXT_FS[0]; $("sxfup").disabled = sxt.fs === SXT_FS[SXT_FS.length - 1]; }
}
function sxtSave() { try { localStorage.setItem(SXT_KEY, JSON.stringify(sxt)); } catch (e) { /* ignore */ } }
function sxtMount() {
  const bar = $("sxbar"); if (!bar || $("sxlook")) return;
  const opts = l => l.map(([k, t]) => `<option value="${k}">${t}</option>`).join("");
  const box = document.createElement("span"); box.id = "sxlook";
  box.innerHTML = `<select id="sxthm" aria-label="Colour theme" title="Colour theme">${opts(SXT_THEMES)}</select>`
    + `<select id="sxfnt" aria-label="Listing font" title="Listing font (THEME: 3270 with PHOSPHOR, else JetBrains Mono)">${opts(SXT_FONTS)}</select>`
    + `<button id="sxfdn" title="Smaller text" aria-label="Smaller text">A&minus;</button><button id="sxfup" title="Larger text" aria-label="Larger text">A+</button>`;
  bar.appendChild(box);
  $("sxthm").onchange = e => { sxt.theme = e.target.value; sxtLink = null; sxtSave(); sxtApply(); };
  $("sxfnt").onchange = e => { sxt.font = e.target.value; sxtSave(); sxtApply(); };
  const step = d => { sxt.fs = SXT_FS[Math.max(0, Math.min(SXT_FS.length - 1, SXT_FS.indexOf(sxt.fs) + d))]; sxtSave(); sxtApply(); };
  $("sxfdn").onclick = () => step(-1); $("sxfup").onclick = () => step(1);
  sxtApply();
}
sxtApply();
new MutationObserver(sxtMount).observe($("srcws"), { childList: true });
