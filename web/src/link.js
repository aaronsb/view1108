// LINK button and link parameters.
"use strict";
// ---- LINK: a URL that reproduces the current view (parameters are listed in the README) ----
function linkURL() {
  const q = [], add = (k, v) => q.push(k + "=" + encodeURIComponent(v)), rnd = v => +v.toFixed(3);
  add("mode", mode);
  if (tab !== TAB_OF[mode]) add("tab", tab);
  if (tab === "fusion" && fCur) add("photo", fCur.frame);
  if (mode !== "attract" && mode !== "tour") {
    if (mode !== "live" || livePin) add("scene", scene);
    add("get", getStr(get)); add("fov", rnd(fov)); add("yaw", rnd(yaw)); add("pitch", rnd(pitch)); add("roll", rnd(roll));
    if (mode === "live") add("rate", LIVE_RATES[liveIdx]); else if (mode === "beam") add("bspeed", beamIdx + 1); else add("rate", SPEEDS[speedIdx]);
    if (FEAT.lablv) { if (labLv !== 3) add("lab", labLv); } else if (!labLv) add("labels", 0);
    if (FEAT.view && viewMode) add("view", VIEWS[viewMode]); if (FEAT.target && targetId) add("target", TARGETS[targetId]); if (FEAT.cabin && !cabin) add("cabin", 0); if (FEAT.walls && !walls) add("walls", 0); if (!frame) add("frame", 0); if (hidden) add("hidden", 1);
  }
  if (dispChoice() !== "auto") add("disp", dispChoice());
  if (scopeHz() !== "16") add("hz", scopeHz());
  const dAuto = filmAuto();   // effects whose default is on in the film-like modes and the Print tab
  if (isFilm()) {
    if (effJit() !== dAuto) add("jitter", +effJit());
    if (effDust() !== dAuto) add("dust", +effDust());
    if (effBloom()) add("bloom", 1);
    if (effFps() !== (dAuto && mode !== "beam")) add("fps", +effFps());
  }
  if (effCatalog() === "full") add("catalog", "full");
  if (simAvail && simOn) { add("src", "sim"); add("svu", +simSvu); }
  if (roomAvail && roomWant === "tiled") add("space", "tiled");   // Room is the default where it can run (room.js)
  if (tab === "source" && srcLinkParam()) add("code", srcLinkParam());
  return location.origin === "null" ? location.href.split("?")[0] + "?" + q.join("&") : location.origin + location.pathname + "?" + q.join("&");
}
function copyLink() {
  const url = linkURL(), box = $("linkbox");
  const fallback = () => { box.style.display = "block"; box.value = url; box.focus(); box.select(); flash("COPY THE LINK BELOW"); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => { box.style.display = "none"; flash("COPIED"); }, fallback); else fallback();
}
$("blink").onclick = copyLink;

// ---- URL parameters: mode, tab, scene, get / utc, fov yaw pitch roll, rate, bspeed, labels frame hidden, effects ----
// (space= is read by room.js)
// The tab is the mode's home tab unless ?tab= names another; Beam is always in Print. Without ?mode=, ?tab= picks
// its tab's mode.
function applyTab() {
  const t = UP.get("tab");
  if (mode === "beam" || !TABS.includes(t)) setTab(TAB_OF[mode], false); else setTab(t, !UP.has("mode"));
}
function applyParams() {
  const num = k => { if (!UP.has(k) || UP.get(k).trim() === "") return null; const n = Number(UP.get(k)); return isFinite(n) ? n : null; };
  const flag = k => UP.get(k) === "1" ? true : UP.get(k) === "0" ? false : null;
  const md = ["attract", "tour", "live", "free", "beam"].includes(UP.get("mode")) ? UP.get("mode") : "attract";
  if (md === "attract" || md === "tour") { startMode(md); applyTab(); return; }
  // get/utc are read after the scene is set: a utc is converted with that scene's scenario epoch.
  const gOf = () => { let g = null; for (const k of ["get", "utc"]) if (UP.has(k)) { const v = parseGet(UP.get(k)); if (v !== null && isFinite(v)) g = v; } return g; };
  const sc = num("scene") === null ? 1 : Math.round(num("scene")), scn = hasScene(sc) ? sc : 1;
  const other = scn === 9;   // another mission's scene: Live follows Apollo 11, so it opens in Free-look
  if (md === "free" || md === "beam" || other) { setScene(scn); const g = gOf(); if (g !== null) get = g; if (md === "beam") { const b = Math.round(num("bspeed") ?? 0); if (b >= 1 && b <= BEAM_SPEEDS.length) beamIdx = b - 1; startMode("beam"); } }
  else {   // live: the scene follows the mission phase, except the LM and docking views, which are pinned
    const g = gOf(); if (g !== null) get = g;
    startMode("live");
    if (scn === 6) setScene(6);
    else if (scn === 4 || scn === 5 || scn === 7) { const j = JUMPS[{ 4: "jundock", 5: "jdesc", 7: "jtd" }[scn]]; liveJump({ ...j, get: g ?? j.get }); }
  }
  const r = num("rate"); if (r !== null) { if (md === "live" && !other && LIVE_RATES.includes(r)) liveIdx = LIVE_RATES.indexOf(r); else if ((md === "free" || other) && SPEEDS.includes(r) && r > 0) speedIdx = SPEEDS.indexOf(r); }
  const f = num("fov"); if (f !== null) fov = Math.max(1, Math.min(170, f));
  const y = num("yaw"); if (y !== null) yaw = y;
  const pt = num("pitch"); if (pt !== null) pitch = Math.max(-90, Math.min(90, pt));
  const rl = num("roll"); if (rl !== null) roll = rl;
  if (flag("labels") !== null) labLv = flag("labels") ? 3 : 0;
  const lb = num("lab"); if (lb !== null && lb >= 0 && lb <= 3) labLv = FEAT.lablv ? Math.round(lb) : lb ? 3 : 0;
  featParams();
  if (flag("frame") !== null) frame = flag("frame");
  if (flag("hidden") !== null) hidden = flag("hidden");
  applyTab();
}
