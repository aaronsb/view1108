// Print: the current frame as an SVG file, the film recorder's frame as vectors.
"use strict";
// The file is laid out as the canvas is (render.js box(): a plot box 0.8 of the width under a header, or the full
// width unframed), 1000 units wide. Paths follow the beam's order (beam.js: vbuf, then stars, then text), so the file
// carries the plotting order. All lettering is in the recorder's stroke font (lettering.js), so the file needs no
// font; that font has capitals only, so the page's mixed-case header and captions are set in capitals.
// Stroke widths and star sizes are our choices for print.
const SVG_W = 1000;
function svgFrame(paper) {
  const fl = ri("in_flags"), nv = ri("nvec"), ns = ri("nstar"), nl = ri("nlab");
  const V = new Float64Array(buf(), K.vbuf.value, nv * 5), S = new Float64Array(buf(), K.sbuf.value, ns * 3);
  const L = new Float64Array(buf(), K.lbuf.value, nl * 4), H = new Float64Array(buf(), K.hdr.value, 16);
  const F = H[1] || LS.fov, half = H[14] > 0 ? H[14] : F / 2, fr = !!(fl & 2), Wd = SVG_W, Hd = Math.floor(Wd * HGT);
  const b = fr ? { x: Wd * (1 - BOXF) / 2, y: Wd * HDR, s: Wd * BOXF } : { x: 0, y: Wd * 0.02, s: Wd };
  const k = b.s / (2 * half), cx = b.x + b.s / 2, cy = b.y + b.s / 2, fs = 0.021 * Wd;
  const fg = paper ? "#000" : "#fff", dim = paper ? "#555" : "#aaa", bg = paper ? "#fff" : "#000", lw = paper ? 1.0 : 1.2;
  const n2 = v => (Math.round(v * 100) / 100).toString();
  // A path builder with the Path2D calls strokeText() makes; a moveTo to the pen's position is dropped.
  const pathOf = () => { const p = { d: [], pen: "", moveTo(x, y) { const q = n2(x) + " " + n2(y); if (q !== p.pen) p.d.push("M" + q); p.pen = q; }, lineTo(x, y) { const q = n2(x) + " " + n2(y); p.d.push("L" + q); p.pen = q; } }; return p; };
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Hd}" viewBox="0 0 ${Wd} ${Hd}">`,
    `<title>VIEW-1108 ${LS.scn} situation ${H[6] | 0} g.e.t. ${getStr(H[0])}</title>`,
    `<desc>inputs: reel ${LS.scn} situation ${H[6] | 0} in_get ${rd("in_get")} in_yaw ${rd("in_yaw")} in_pitch ${rd("in_pitch")} in_roll ${rd("in_roll")} in_fov ${rd("in_fov")} in_flags ${fl}</desc>`,
    `<rect id="film" width="${Wd}" height="${Hd}" fill="${bg}"/>`,
    `<clipPath id="plotbox"><rect x="${n2(fr ? b.x - 2 : 0)}" y="${n2(b.y - 2)}" width="${n2(fr ? b.s + 4 : Wd)}" height="${n2(b.s + 4)}"/></clipPath>`,
    `<g fill="none" stroke="${fg}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round">`];
  // vectors: one path per run of one style, in kernel order
  out.push(`<g id="vectors" clip-path="url(#plotbox)">`);
  let run = null, st = 0;
  const flush = () => { if (run && run.d.length) out.push(`<path${st === 2 ? ` stroke-dasharray="${lw * 5} ${lw * 4}"` : ""} d="${run.d.join("")}"/>`); };
  for (let i = 0; i < nv * 5; i += 5) {
    const s = V[i + 4] === 2 ? 2 : 1;
    if (!run || s !== st) { flush(); run = pathOf(); st = s; }
    run.moveTo(cx + V[i] * k, cy - V[i + 1] * k); run.lineTo(cx + V[i + 2] * k, cy - V[i + 3] * k);
  }
  flush();
  // stars: discs sized by magnitude as the page sizes its star symbols, with its catalog filter
  out.push(`</g><g id="stars" clip-path="url(#plotbox)" fill="${fg}" stroke="none">`);
  const fullCat = effCatalog() === "full", rF = 0.0026 * Wd;
  const named = (x, y) => { for (let j = 0; j < nl * 4; j += 4) if (L[j + 2] === 1 && Math.abs(L[j] - x) < 0.03 && Math.abs(L[j + 1] - y) < 0.03) return true; return false; };
  for (let i = 0; i < ns * 3; i += 3) {
    const m = S[i + 2];
    if (!fullCat && m > NAV_MAG && !named(S[i], S[i + 1])) continue;
    const t = Math.max(0, Math.min(1, (4.5 - m) / 5.5));
    out.push(`<circle cx="${n2(cx + S[i] * k)}" cy="${n2(cy - S[i + 1] * k)}" r="${n2(0.55 * rF * (1 + 0.6 * t))}"/>`);
  }
  // recorder text, unclipped: tick numbers sit outside the box
  const txt = pathOf();
  for (const t of textRecords(fullCat)) strokeText(txt, t.s, cx + t.x * k, cy - t.y * k, t.h * k);
  out.push(`</g><path id="text" d="${txt.d.join("")}"/>`);
  const crt = pathOf();
  for (const t of craterNames(L, nl, H, F, half)) strokeText(crt, t.s, cx + t.x * k, cy - t.y * k, t.h * k);
  if (crt.d.length) out.push(`<path id="craters" d="${crt.d.join("")}"/>`);
  // the page's lettering: header, axis captions, g.e.t. and caption; h is a canvas font size, set at cap height
  const caps = s => s.replace(/°/g, " DEG").replace(/[^\x20-\x7e]/g, "-").toUpperCase();
  const centred = (p, s, x, base, h) => { s = caps(s); strokeText(p, s, x - s.length * 0.7 * h * 0.7 / 2, base, h * 0.7); };
  const pg = pathOf(), cap = pathOf();
  if (fr) {
    centred(pg, "Field of view = " + (F < 10 ? F.toFixed(1) : Math.round(F)) + "°", cx, b.y - fs * 2.3, fs * 1.25);
    centred(pg, `${H[5] === 1 ? "R_E" : "R_M"} = ${Math.round(H[2])} n. mi.   h = ${Math.round(H[3])} stat. mi.   V_I = ${Math.round(H[4])} fps`, cx, b.y - fs * 0.8, fs * 0.95);
    centred(pg, "X, deg", cx, b.y + b.s + fs * 2 + fs * 0.7, fs);
  }
  if (fr || !filmReel() || autoCap) {
    centred(pg, "g.e.t. = " + getStr(H[0]), cx, b.y + b.s + fs * (fr ? 4.0 : 0.5) + fs * 1.1 * 0.7, fs * 1.1);
    centred(cap, captionText(H), cx, b.y + b.s + fs * (fr ? 5.7 : 2.0) + fs * 0.7, fs);
  }
  out.push(`<g id="lettering"><path d="${pg.d.join("")}"/>`);
  if (fr) { const y = pathOf(); centred(y, "Y, deg", 0, 0, fs); out.push(`<path transform="translate(${n2(b.x - fs * 3.2)} ${n2(cy)}) rotate(-90)" d="${y.d.join("")}"/>`); }
  if (cap.d.length) out.push(`<path stroke="${dim}" d="${cap.d.join("")}"/>`);
  out.push("</g></g></svg>");
  return out.join("\n");
}
// File name: view1108_<scenario reel id>_s<situation id>_<g.e.t. as HHHMMSS>.svg
function svgName() {
  const H = new Float64Array(buf(), K.hdr.value, 16), t = Math.floor(Math.abs(H[0]));
  return `view1108_${LS.scn}_s${H[6] | 0}_${H[0] < 0 ? "-" : ""}${String(Math.floor(t / 3600)).padStart(3, "0")}${pad2(Math.floor(t / 60) % 60)}${pad2(t % 60)}.svg`;
}
function downloadSvg(paper) {
  if (!drawn) K.view_frame();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([svgFrame(paper)], { type: "image/svg+xml" }));
  a.download = svgName(); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("bsvg").onclick = () => downloadSvg(false);
$("bsvgp").onclick = () => downloadSvg(true);
