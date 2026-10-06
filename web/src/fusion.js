// Fusion: a crew photograph over the vector frame at its moment. The photographs and their timing are
// data/photos.tsv (tools/photo_pack.py embeds the ones with a scene); the photo is drawn on the visible canvas after
// the film effects, clipped to the plot box and placed in plot degrees, so it follows the plot through any resize.
"use strict";
let PHOTOS = [];
try { PHOTOS = JSON.parse($("photos").textContent); } catch (e) { /* unassembled page (?mock): no photographs */ }
// The 70 mm Hasselblad gate, 55.74 mm: our measurement on the ASU scan of AS08-14-2383 (CLAUDE.md, scene 9). A lens
// of focal length f then spans 2 atan(27.87 / f) across the frame, which on our gnomonic plot is 55.74 / f radians of
// plot units. Our computation; we take each scan's long side to be the gate.
const GATE_MM = 55.74;
// Our fits, made on the embedded scans (reference/photos) against the kernel's Earth disc and lunar horizon.
// turn: quarter turns clockwise from the scan to the photo's usual presentation. cam: yaw, pitch, roll added to the
// scene's defaults, the pointing that brings the kernel's Earth and horizon to the photo's. x, y: the photo's centre,
// plot deg; rot: deg counterclockwise; scale: % of the lens's field.
const FUSION_FITS = {
  "AS08-14-2383": { turn: 1, cam: [0, 0, 0], x: 0.056, y: -0.018, rot: -0.70, scale: 100.28,
    note: "Our fit on this scan: the Earth's disc to about a pixel. The kernel's horizon sits about 0.1° below the photograph's (0.25° on the left, where the far terrain rises), about 2 s of Earth rise. The photograph is turned 0.7° from the horizon the scene's TURN= card (applied by REFTRN) was fitted to on the ASU scan." },
  "AS08-14-2384": { turn: 1, cam: [0.727, 1.315, 7.955], x: 0, y: 0, rot: 0, scale: 100.33,
    note: "Our fit on this scan: the Earth's disc, and the horizon's tilt by pointing (rolled 8° from AS08-14-2383). The kernel's horizon sits about 0.4° below the photograph's, about 8 s of Earth rise against a quoted ~1 s." },
  "AS08-13-2329": { turn: 0, cam: [-1.184, -3.185, 13.323], x: 0, y: 0, rot: 0, scale: 100.71,
    note: "Our fit on this scan: the Earth's disc, and the horizon's tilt by pointing (another window, rolled 13°). The kernel's horizon sits about 0.25° below the photograph's, about 5 s of Earth rise: its Earth has cleared the horizon, the photograph's has not." }
};
const FUSION_KEY = "view1108.fusion";
const fz = { align: {}, op: 0.5, blend: "source-over" };   // remembered: each photo's alignment, opacity, blend
try { Object.assign(fz, JSON.parse(localStorage.getItem(FUSION_KEY) || "{}")); } catch (e) { /* storage unavailable */ }
if (!fz.align || typeof fz.align !== "object") fz.align = {};
const fzSave = () => { try { localStorage.setItem(FUSION_KEY, JSON.stringify(fz)); } catch (e) { /* ignore */ } };
let fCur = null, fImg = null, fPinned = true, fMoving = false, fCam0 = [0, 0, 0];   // fCam0: the scene's default look
const fFit = p => FUSION_FITS[p.frame] || { turn: 0, cam: [0, 0, 0], x: 0, y: 0, rot: 0, scale: 100, note: "Not fitted yet: align it by hand (Move photo), then Copy alignment." };
// The viewer's alignment once they change it (remembered), else our fit.
const fAlign = () => fz.align[fCur.frame] || (({ x, y, rot, scale }) => ({ x, y, rot, scale }))(fFit(fCur));
const fEdit = () => fz.align[fCur.frame] || (fz.align[fCur.frame] = fAlign());
const lensMm = p => /unverified/i.test(p.lens_mm) ? NaN : parseFloat(p.lens_mm);   // NaN when unknown or unverified
const lensFov = p => lensMm(p) > 0 ? 2 * Math.atan(GATE_MM / 2 / lensMm(p)) * 180 / Math.PI : null;
const hasBracket = p => p.get === "" && p.get_lo !== "" && p.get_hi !== "";
const photoGet = p => p.get !== "" ? +p.get : hasBracket(p) ? (+p.get_lo + +p.get_hi) / 2 : +p.get_lo;
const plotHalf = () => { const h = new Float64Array(buf(), K.hdr.value, 16)[14]; return h > 0 ? h : LS.fov / 2; };   // hdr(15)

// The photo's view: its scene in the window view, its g.e.t. held, the fitted pointing, the lens's field.
function fusionView() {
  if (!fCur) return;
  const p = fCur;
  LS.view = 0; LS.target = 0;
  setScene(+p.scene); fCam0 = [LS.yaw, LS.pitch, LS.roll];
  const c = fFit(p).cam; LS.yaw += c[0]; LS.pitch += c[1]; LS.roll += c[2];
  LS.get = LS.get0 = photoGet(p); LS.playing = false;
  LS.fov = lensFov(p) || LS.fov0;
  fPinned = true; fusionUI();
}
function fusionPick(i) {
  fCur = PHOTOS[i]; fImg = new Image(); fImg.src = fCur.img;
  fusionView(); fusionList();
  const b = $("fget"); $("fgetw").hidden = !hasBracket(fCur);
  if (hasBracket(fCur)) { b.min = fCur.get_lo; b.max = fCur.get_hi; b.value = LS.get; }
}

// Drawn after present(): over the film, under nothing.
function fusionDraw() {
  if (tab !== "fusion" || !fCur || +fCur.scene !== LS.situation || !fPinned || !fImg || !fImg.complete || !fImg.naturalWidth) return;
  const a = fAlign(), half = plotHalf(), b = box(), k = b.s / (2 * half);
  const wPlot = (lensMm(fCur) > 0 ? GATE_MM / lensMm(fCur) * 180 / Math.PI : 2 * half) * a.scale / 100;
  const s = wPlot * k / Math.max(fImg.naturalWidth, fImg.naturalHeight), w = fImg.naturalWidth * s, h = fImg.naturalHeight * s;
  mctx.save(); mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mctx.beginPath(); mctx.rect(b.x, b.y, b.s, b.s); mctx.clip();
  mctx.globalAlpha = fz.op; mctx.globalCompositeOperation = fz.blend;
  mctx.translate(b.x + b.s / 2 + a.x * k, b.y + b.s / 2 - a.y * k);
  mctx.rotate(fFit(fCur).turn * Math.PI / 2 - a.rot * Math.PI / 180);
  mctx.drawImage(fImg, -w / 2, -h / 2, w, h);
  mctx.restore();
}

// ---- dock ----
function fusionList() {
  const box_ = $("flist"); box_.textContent = "";
  PHOTOS.forEach((p, i) => {
    const r = document.createElement("button"); r.type = "button"; r.className = "fprow";
    const t = p.get !== "" ? getStr(+p.get) : p.get_lo !== "" ? (p.get_hi !== "" ? getStr(+p.get_lo) + "–" : "after ") + getStr(+(p.get_hi || p.get_lo)) : "?";
    r.innerHTML = "<span></span><span></span>"; r.children[0].textContent = p.frame; r.children[1].textContent = t;
    r.disabled = !p.img;
    r.title = p.img ? p.window_or_vehicle : "Not shown yet, no matching scene: " + p.needs;
    r.classList.toggle("on", p === fCur);
    r.onclick = () => fusionPick(i);
    box_.appendChild(r);
  });
}
function fusionUI() {
  const p = fCur; $("fctl").hidden = !p;
  if (!p) return;
  const a = fAlign(), f = lensFov(p);
  const when = p.get !== "" ? "g.e.t. " + getStr(+p.get) : hasBracket(p) ? `g.e.t. ${getStr(+p.get_lo)} to ${getStr(+p.get_hi)} (shown: ${getStr(LS.get)})` : "g.e.t. " + getStr(photoGet(p));
  const info = $("finfo"); info.textContent = "";
  const line = (t, cls) => { const d = document.createElement("div"); if (cls) d.className = cls; d.textContent = t; info.appendChild(d); return d; };
  line(`${p.frame}  Apollo ${p.mission}, magazine ${p.magazine}`, "fhd");
  line(p.window_or_vehicle);
  line(`${when}. Timing: ${p.get_src}.`);
  line(f ? `Lens ${p.lens_mm} mm: ${f.toFixed(2)}° across the ${GATE_MM} mm gate (our computation), the plot's field.` : `Lens ${p.lens_mm || "unknown"}: no field prior; the photo spans the plot.`);
  line(fFit(p).note);
  const cr = line("Credit NASA/JSC. ");
  const ln = document.createElement("a"); ln.href = p.url; ln.target = "_blank"; ln.rel = "noopener"; ln.textContent = "Source scan"; cr.appendChild(ln);
  for (const [id, v, d] of [["fax", a.x, 3], ["fay", a.y, 3], ["far", a.rot, 2], ["fas", a.scale, 2]]) if (document.activeElement !== $(id)) $(id).value = v.toFixed(d);
  $("fop").value = Math.round(fz.op * 100);
  document.querySelectorAll("#fblend button").forEach(b => b.classList.toggle("on", b.dataset.blend === fz.blend));
  $("funpin").classList.toggle("on", !fPinned);
  $("fmove").classList.toggle("on", fMoving);
}
const fNudge = (dx, dy, dr, ds) => { if (!fCur) return; const a = fEdit(); a.x += dx; a.y += dy; a.rot += dr; a.scale = Math.max(10, a.scale + ds); fzSave(); fusionUI(); };
$("fop").oninput = e => { fz.op = e.target.value / 100; fzSave(); };
document.querySelectorAll("#fblend button").forEach(b => { b.onclick = () => { fz.blend = b.dataset.blend; fzSave(); fusionUI(); }; });
for (const [id, key] of [["fax", "x"], ["fay", "y"], ["far", "rot"], ["fas", "scale"]])
  $(id).onchange = e => { const v = parseFloat(e.target.value); if (fCur && isFinite(v)) { fEdit()[key] = v; fzSave(); } fusionUI(); };
$("fget").oninput = e => { LS.get = +e.target.value; LS.playing = false; fusionUI(); };
$("funpin").onclick = () => { fPinned = !fPinned; fusionUI(); };
$("fret").onclick = () => { fusionView(); if (hasBracket(fCur)) $("fget").value = LS.get; };
$("fmove").onclick = () => { fMoving = !fMoving; fusionUI(); };
$("freset").onclick = () => { if (!fCur) return; delete fz.align[fCur.frame]; fzSave(); fusionUI(); };
$("fcopy").onclick = () => {
  if (!fCur) return;
  const a = fAlign(), r3 = v => +v.toFixed(3);
  const txt = JSON.stringify({ frame: fCur.frame, scene: LS.situation, get: r3(LS.get), turn: fFit(fCur).turn, cam: [r3(LS.yaw - fCam0[0]), r3(LS.pitch - fCam0[1]), r3(LS.roll - fCam0[2])], fov: r3(LS.fov), x: r3(a.x), y: r3(a.y), rot: r3(a.rot), scale: r3(a.scale) });
  const lb = $("linkbox"), fallback = () => { lb.style.display = "block"; lb.value = txt; lb.focus(); lb.select(); flash("COPY THE ALIGNMENT BELOW"); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => flash("ALIGNMENT COPIED"), fallback); else fallback();
};

// Move photo: drag, the arrows (1 px, Shift 10), Q / E (0.1°, Shift 1°), + / - and the wheel (0.1%, Shift 1%) move,
// turn and scale the photo instead of the look. Esc ends it. Capture-phase listeners, so the look controls never see these.
const fPx = () => 2 * plotHalf() / box().s;   // plot deg per css px
const fOn = () => tab === "fusion" && fMoving && fCur;
let fDrag = null;
$("wrap").addEventListener("pointerdown", e => { if (!fOn()) return; e.stopPropagation(); cv.setPointerCapture(e.pointerId); fDrag = [e.clientX, e.clientY]; }, true);
$("wrap").addEventListener("pointermove", e => {
  if (!fOn() || !fDrag) return; e.stopPropagation();
  const d = fPx(); fNudge((e.clientX - fDrag[0]) * d, -(e.clientY - fDrag[1]) * d, 0, 0); fDrag = [e.clientX, e.clientY];
}, true);
for (const t of ["pointerup", "pointercancel"]) $("wrap").addEventListener(t, e => { if (fDrag) { fDrag = null; e.stopPropagation(); } }, true);
$("wrap").addEventListener("wheel", e => { if (!fOn()) return; e.preventDefault(); e.stopPropagation(); fNudge(0, 0, 0, (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 1 : 0.1)); }, { capture: true, passive: false });
window.addEventListener("keydown", e => {
  if (!fOn() || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
  const m = e.shiftKey ? 10 : 1, d = fPx() * m, k = e.key;
  const act = { ArrowLeft: [-d, 0, 0, 0], ArrowRight: [d, 0, 0, 0], ArrowUp: [0, d, 0, 0], ArrowDown: [0, -d, 0, 0],
    q: [0, 0, 0.1 * m, 0], Q: [0, 0, 0.1 * m, 0], e: [0, 0, -0.1 * m, 0], E: [0, 0, -0.1 * m, 0],
    "+": [0, 0, 0, 0.1 * m], "=": [0, 0, 0, 0.1 * m], "-": [0, 0, 0, -0.1 * m], "_": [0, 0, 0, -0.1 * m] }[k];
  if (k === "Escape") { fMoving = false; fusionUI(); }
  else if (act) fNudge(...act);
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
// ?photo=FRAME opens that photograph in its view; a link's own get, fov, yaw, pitch and roll then apply (main.js).
function fusionParams() {
  const i = PHOTOS.findIndex(p => p.frame === UP.get("photo") && p.img);
  if (i < 0) return;
  if (tab !== "fusion") setTab("fusion");
  fusionPick(i);
  const num = k => UP.has(k) && isFinite(+UP.get(k)) && UP.get(k).trim() !== "" ? +UP.get(k) : null;
  const g = UP.has("get") ? parseGet(UP.get("get")) : null; if (g !== null && isFinite(g)) { LS.get = g; $("fget").value = g; }
  if (num("fov") !== null) LS.fov = clampFov(num("fov"));
  if (num("yaw") !== null) LS.yaw = num("yaw");
  if (num("pitch") !== null) LS.pitch = num("pitch");
  if (num("roll") !== null) LS.roll = num("roll");
  fusionUI();
}
fusionList(); fusionUI();
if (DEBUG) window.VIEW_FUSION = { pick: f => fusionPick(PHOTOS.findIndex(p => p.frame === f)), fz, align: () => fCur && fAlign(), state: () => ({ scene: LS.situation, get: LS.get, fov: LS.fov, yaw: LS.yaw, pitch: LS.pitch, roll: LS.roll, mode: LS.mode, tab, link: linkURL() }) };
