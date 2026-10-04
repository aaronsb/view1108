// Film-effect preferences: stored choices, URL overrides, effective values.
"use strict";
// Nostalgia toggles: null = automatic (on in Attract/Tour and the Print tab), true/false = the viewer's choice (remembered).
const prefs = { jitter: null, bloom: null, dust: null, fps: null, catalog: "nav", listing: "dark", disp: "auto", hz: "16" };
const NAV_MAG = NAMES.NAV_MAG || 3.8;   // magnitude limit passing the 391 brightest stars (tools/gen_data.py -> build/names.js)
try { Object.assign(prefs, JSON.parse(localStorage.getItem("view1108.prefs") || "{}")); } catch (e) { /* storage unavailable */ }
const savePrefs = () => { try { localStorage.setItem("view1108.prefs", JSON.stringify(prefs)); } catch (e) { /* ignore */ } };
const auto = () => mode === "attract" || mode === "tour";
const filmAuto = () => auto() || tab === "print";
// URL parameters override stored prefs for this visit only, and are never written to storage. A toggle clicked
// by the viewer drops the URL value for that effect and saves the viewer's own choice.
const urlOv = {}; for (const k of ["jitter", "bloom", "dust", "fps"]) { const v = UP.get(k); if (v === "0" || v === "1") urlOv[k] = v === "1"; }
if (UP.get("catalog") === "nav" || UP.get("catalog") === "full") urlOv.catalog = UP.get("catalog");
if (["auto", "film", "scope"].includes(UP.get("disp"))) urlOv.disp = UP.get("disp");
if (UP.get("hz") === "16" || UP.get("hz") === "steady") urlOv.hz = UP.get("hz");
const urlFlag = k => k in urlOv ? urlOv[k] : null;
// The screen: FILM, the microfilm recorder (the effects below), or SCOPE, the room's UNIVAC 1558 console (none of
// them: render.js scopeRender). AUTO (ours): the 1558's screen while the room shows it; on the page SCOPE when it was
// reached through the room, except Attract (the film clip) and the Print tab; FILM otherwise, as in Tiled.
const dispChoice = () => urlOv.disp || prefs.disp;
const effDisp = () => {
  if (roomShown) return "scope";
  const d = dispChoice();
  return d !== "auto" ? d : roomIn && mode !== "attract" && tab !== "print" ? "scope" : "film";
};
const isFilm = () => effDisp() === "film";
// SCOPE refresh: "16" redraws the frame as a beam pass every 1/16 s on a decaying phosphor; "steady" holds it still.
const scopeHz = () => (urlOv.hz || prefs.hz) === "steady" ? "steady" : "16";
const scopeLive = () => !isFilm() && scopeHz() === "16" && mode !== "beam";   // Beam traces itself (beam.js)
const effJit = () => !isFilm() ? false : urlFlag("jitter") !== null ? urlFlag("jitter") : prefs.jitter !== null ? prefs.jitter : filmAuto();
const effBloom = () => !isFilm() ? false : urlFlag("bloom") !== null ? urlFlag("bloom") : prefs.bloom !== null ? prefs.bloom : filmAuto();
const effDust = () => !isFilm() ? false : urlFlag("dust") !== null ? urlFlag("dust") : prefs.dust !== null ? prefs.dust : filmAuto();
const effFps = () => mode === "beam" || !isFilm() ? false : urlFlag("fps") !== null ? urlFlag("fps") : prefs.fps !== null ? prefs.fps : filmAuto();   // film rate: present at 16 fps
const effCatalog = () => (urlOv.catalog || prefs.catalog) === "full" ? "full" : "nav";
const toggleCatalog = () => { const c = effCatalog() === "full" ? "nav" : "full"; delete urlOv.catalog; prefs.catalog = c; savePrefs(); syncUI(); };
const toggle = k => {
  if (!isFilm()) { flash("SCOPE: NO FILM EFFECTS"); return; }
  const cur = k === "jitter" ? effJit() : k === "dust" ? effDust() : k === "fps" ? effFps() : effBloom(); delete urlOv[k]; prefs[k] = !cur; savePrefs(); syncUI();
};
const setDisp = d => { delete urlOv.disp; prefs.disp = d; savePrefs(); syncUI(); };
const cycleDisp = () => setDisp({ auto: "film", film: "scope", scope: "auto" }[dispChoice()]);
const setHz = h => { delete urlOv.hz; prefs.hz = h; savePrefs(); syncUI(); };
