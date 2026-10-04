// Film-effect preferences: stored choices, URL overrides, effective values.
"use strict";
// Nostalgia toggles: null = automatic (on in Attract/Tour and the Print tab), true/false = the viewer's choice (remembered).
const prefs = { jitter: null, bloom: null, dust: null, fps: null, catalog: "nav", listing: "dark" };
const NAV_MAG = NAMES.NAV_MAG || 3.8;   // magnitude limit passing the 391 brightest stars (tools/gen_data.py -> build/names.js)
try { Object.assign(prefs, JSON.parse(localStorage.getItem("view1108.prefs") || "{}")); } catch (e) { /* storage unavailable */ }
const savePrefs = () => { try { localStorage.setItem("view1108.prefs", JSON.stringify(prefs)); } catch (e) { /* ignore */ } };
const auto = () => mode === "attract" || mode === "tour";
const filmAuto = () => auto() || tab === "print";
// URL parameters override stored prefs for this visit only, and are never written to storage. A toggle clicked
// by the viewer drops the URL value for that effect and saves the viewer's own choice.
const urlOv = {}; for (const k of ["jitter", "bloom", "dust", "fps"]) { const v = UP.get(k); if (v === "0" || v === "1") urlOv[k] = v === "1"; }
if (UP.get("catalog") === "nav" || UP.get("catalog") === "full") urlOv.catalog = UP.get("catalog");
const urlFlag = k => k in urlOv ? urlOv[k] : null;
const effJit = () => urlFlag("jitter") !== null ? urlFlag("jitter") : prefs.jitter !== null ? prefs.jitter : filmAuto();
const effBloom = () => urlFlag("bloom") !== null ? urlFlag("bloom") : prefs.bloom !== null ? prefs.bloom : filmAuto();
const effDust = () => urlFlag("dust") !== null ? urlFlag("dust") : prefs.dust !== null ? prefs.dust : filmAuto();
const effFps = () => mode === "beam" ? false : urlFlag("fps") !== null ? urlFlag("fps") : prefs.fps !== null ? prefs.fps : filmAuto();   // film rate: present at 16 fps
const effCatalog = () => (urlOv.catalog || prefs.catalog) === "full" ? "full" : "nav";
const toggleCatalog = () => { const c = effCatalog() === "full" ? "nav" : "full"; delete urlOv.catalog; prefs.catalog = c; savePrefs(); syncUI(); };
const toggle = k => { const cur = k === "jitter" ? effJit() : k === "dust" ? effDust() : k === "fps" ? effFps() : effBloom(); delete urlOv[k]; prefs[k] = !cur; savePrefs(); syncUI(); };
