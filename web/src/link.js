// LINK button and link parameters.
"use strict";
// ---- LINK: a URL that reproduces the current view (parameters are listed in the README) ----
function linkURL() {
  const q = [], add = (k, v) => q.push(k + "=" + encodeURIComponent(v)), rnd = v => +v.toFixed(3);
  add("mode", LS.mode);
  if (tab !== TAB_OF[LS.mode]) add("tab", tab);
  if (tab === "fusion" && fCur) add("photo", fCur.frame);
  if (!auto()) {
    if (LS.mode !== "live" || livePin) add("scene", LS.situation);
    add("get", getStr(LS.get)); add("fov", rnd(LS.fov)); add("yaw", rnd(LS.yaw)); add("pitch", rnd(LS.pitch)); add("roll", rnd(LS.roll));
    if (LS.mode === "live") add("rate", LIVE_RATES[liveIdx]); else if (LS.mode === "beam") add("bspeed", beamIdx + 1); else add("rate", SPEEDS[speedIdx]);
    if (FEAT.lablv) { if (LS.labLv !== 3) add("lab", LS.labLv); } else if (!LS.labLv) add("labels", 0);
    if (FEAT.view && LS.view) add("view", VIEWS[LS.view]); if (FEAT.target && LS.target) add("target", TARGETS[LS.target]); if (FEAT.cabin && !cabin) add("cabin", 0); if (FEAT.walls && !walls) add("walls", 0); if (!frame) add("frame", 0); if (hidden) add("hidden", 1);
  }
  if (dispChoice() !== "auto") add("disp", dispChoice());
  if (scopeHz() !== "16") add("hz", scopeHz());
  const dAuto = filmAuto();   // effects whose default is on in the film-like modes and the Print tab
  if (isFilm()) {
    if (effJit() !== dAuto) add("jitter", +effJit());
    if (effDust() !== dAuto) add("dust", +effDust());
    if (effBloom()) add("bloom", 1);
    if (effFps() !== (dAuto && LS.mode !== "beam")) add("fps", +effFps());
  }
  if (effCatalog() === "full") add("catalog", "full");
  if (simAvail && simOn) { add("src", "sim"); add("svu", +simSvu); }
  if (roomAvail && roomWant === "tiled") add("space", "tiled");   // Room is the default where it can run (room.js)
  if (tab === "source" && srcLinkParam()) add("code", srcLinkParam());
  if (tab === "source" && srcThemeParam()) add("theme", srcThemeParam());
  return location.origin === "null" ? location.href.split("?")[0] + "?" + q.join("&") : location.origin + location.pathname + "?" + q.join("&");
}
function copyLink() {
  const url = linkURL(), box = $("linkbox");
  const fallback = () => { box.style.display = "block"; box.value = url; box.focus(); box.select(); flash("COPY THE LINK BELOW"); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => { box.style.display = "none"; flash("COPIED"); }, fallback); else fallback();
}
$("blink").onclick = copyLink;

// ---- URL parameters: mode, tab, scene, get / utc, fov yaw pitch roll, rate, bspeed, labels frame hidden, effects ----
// (space= is read by room.js; src= and svu= by sim.js; the effects by prefs.js)
// The link is loaded once, at start-up (main.js): its keys go to the loader (loader.js, by="url"), then its tab is
// shown: the tab it names, else the mode's home tab; Beam is always in Print, and a photograph in Fusion. A link that
// names a tab but no mode loads that tab's mode (TAB_MODE, Attract for the others) at the start-up situation, and
// only a photograph's keys with it, as when showing the tab chose the mode (before #16).
const TAB_MODE = { simulate: "live", print: "free", fusion: "free" };
function openLink() {
  let p = new URLSearchParams(UP);
  const t = UP.get("tab");
  if (!UP.has("mode") && TABS.includes(t)) {
    p = P({ mode: TAB_MODE[t] || REELS[DEFAULT_REEL].alias });
    if (UP.has("photo")) for (const k of ["photo", "get", "fov", "yaw", "pitch", "roll"]) if (UP.has(k)) p.set(k, UP.get(k));
  }
  p.set("by", "url");
  loadReel(p);
  setTab(LS.mode === "beam" || !TABS.includes(t) ? TAB_OF[LS.mode] : t);
  if (PHOTOS.some(x => x.frame === UP.get("photo") && x.img)) setTab("fusion");
}
