// Film effects applied when a frame is presented: grain, jitter, bloom, dust (FILM only; SCOPE presents the frame plain).
"use strict";
// ---- film grain tile ----
const grain = document.createElement("canvas"); grain.width = grain.height = 128;
{ const g = grain.getContext("2d"), d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); }

// Whole-frame film jitter at about 24 fps (offset 0.2-0.5% of width, sometimes 0.1 deg of rotation,
// slight brightness flicker), and bloom: blurred downsampled copies added back on top.
let hairline = 1;   // line width (css px) of the frame just drawn
let jx = 0, jy = 0, jr = 0, jb = 1, lastJ = 0;
function present(now, bloomOn) {
  const w = cv.width, h = cv.height;
  if (effJit()) {
    if (effFps() || now - lastJ >= 1000 / 24) {
      lastJ = now; const a = Math.random() * 6.2832, m = 0.0005 + 0.00075 * Math.random();
      jx = Math.cos(a) * m; jy = Math.sin(a) * m;
      jr = Math.random() < 0.2 ? (Math.random() * 2 - 1) * 0.025 * Math.PI / 180 : 0;
      jb = 0.94 + 0.06 * Math.random();
    }
  } else { jx = jy = jr = 0; jb = 1; }
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.globalCompositeOperation = "source-over"; mctx.globalAlpha = 1;
  mctx.fillStyle = "#000"; mctx.fillRect(0, 0, w, h);
  mctx.save();
  mctx.translate(w / 2 + jx * w, h / 2 + jy * w); mctx.rotate(jr); mctx.translate(-w / 2, -h / 2);
  mctx.globalAlpha = jb; mctx.drawImage(off, 0, 0);
  if (bloomOn) {
    // Multi-scale glow. All sizes are fractions of the canvas width, so the look is the same at any size or dpr:
    // gaussian sigmas 0.12%, 0.3% and 0.7% of the width (about 1.2, 3 and 7 px at 1000 px) with weights 0.5, 0.27
    // and 0.12 of the normalised peak. The blurs run on 1/2, 1/4 and 1/8 size copies, the levels are summed, a
    // contrast curve pulls the faint tail back to black (no haze over empty areas, hatching stays separate), and the
    // result is added with 'lighter' (which clamps: overlaps saturate to white) under the sharp hairline.
    const Wd = cv.width, s1 = 0.0012 * Wd, s2 = 0.003 * Wd, s3 = 0.007 * Wd, wd = Math.max(1, hairline * dpr);
    const bl = (c, src, sw, sigma, gain) => { c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.filter = `blur(${sigma}px)`; c.imageSmoothingQuality = "high"; c.drawImage(src, 0, 0, c.canvas.width, c.canvas.height); };
    bl(b1c, off, 2, s1 / 2); bl(b2c, bl1, 4, Math.sqrt(s2 * s2 - s1 * s1) / 4); bl(b3c, bl2, 8, Math.sqrt(s3 * s3 - s2 * s2) / 8);
    // gain = weight * sigma * sqrt(2 pi) / line width restores each level's normalised peak
    const gain = (wt, sg_) => (wt * sg_ * 2.507 / wd).toFixed(2);
    a1c.clearRect(0, 0, am1.width, am1.height); a1c.filter = `brightness(${gain(0.5, s1)})`; a1c.drawImage(bl1, 0, 0);
    a2c.clearRect(0, 0, am2.width, am2.height); a2c.filter = `brightness(${gain(0.27, s2)})`; a2c.drawImage(bl2, 0, 0);
    a3c.clearRect(0, 0, am3.width, am3.height); a3c.filter = `brightness(${gain(0.12, s3)})`; a3c.drawImage(bl3, 0, 0);
    a1c.filter = "none"; a1c.globalCompositeOperation = "lighter"; a1c.imageSmoothingQuality = "high";
    a1c.drawImage(am2, 0, 0, am1.width, am1.height); a1c.drawImage(am3, 0, 0, am1.width, am1.height); a1c.globalCompositeOperation = "source-over";
    aSc.clearRect(0, 0, amS.width, amS.height); aSc.filter = "contrast(1.4)"; aSc.drawImage(am1, 0, 0);
    mctx.globalCompositeOperation = "lighter"; mctx.imageSmoothingQuality = "high"; mctx.globalAlpha = jb;
    mctx.drawImage(amS, 0, 0, w, h);
  }
  // film grain, after the glow so the blur gains do not amplify it; none on the SCOPE (prefs.js effDisp)
  if (isFilm()) {
    mctx.globalCompositeOperation = "lighter"; mctx.globalAlpha = 0.018; mctx.filter = "none";
    mctx.fillStyle = mctx.createPattern(grain, "repeat");
    mctx.save(); mctx.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0);
    mctx.fillRect(-128, -128, w + 256, h + 256); mctx.restore();
  }
  mctx.globalAlpha = 1; mctx.globalCompositeOperation = "source-over";
  if (effDust()) drawDust(now, w, h);
  mctx.restore();
}

// Film dirt, in film-frame coordinates (it moves with the jitter): a few tiny dark specks or off-white
// hairs per film frame (24 fps), and now and then a faint vertical scratch that lasts a few frames.
let lastD = 0, specks = [], scratchX = 0, scratchLeft = 0, nextScratch = 0;
function drawDust(now, w, h) {
  if (effFps() || now - lastD >= 1000 / 24) {
    lastD = now; specks = [];
    const n = Math.floor(Math.pow(Math.random(), 2.2) * 4);          // 0-3, mostly 0 or 1
    for (let i = 0; i < n; i++) specks.push({ x: Math.random() * w, y: Math.random() * h, dark: Math.random() < 0.6, len: 3 + Math.random() * 6, a: Math.random() * 3.1416, r: 1 + Math.random() * 2 });
    if (scratchLeft > 0) { scratchLeft--; scratchX += (Math.random() - 0.5) * 3 * dpr; }
    else if (now > nextScratch) { scratchLeft = 3 + Math.floor(Math.random() * 4); scratchX = Math.random() * w; nextScratch = now + 5000 + Math.random() * 10000; }
  }
  mctx.globalCompositeOperation = "source-over"; mctx.globalAlpha = 1; mctx.lineCap = "round";
  for (const sp of specks) {
    if (sp.dark) { mctx.fillStyle = "rgba(0,0,0,0.8)"; mctx.beginPath(); mctx.arc(sp.x, sp.y, sp.r * dpr, 0, 6.2832); mctx.fill(); }
    else { mctx.strokeStyle = "rgba(220,220,210,0.4)"; mctx.lineWidth = dpr; mctx.beginPath(); mctx.moveTo(sp.x, sp.y); mctx.lineTo(sp.x + Math.cos(sp.a) * sp.len * dpr, sp.y + Math.sin(sp.a) * sp.len * dpr); mctx.stroke(); }
  }
  if (scratchLeft > 0) { mctx.strokeStyle = "rgba(230,230,220,0.13)"; mctx.lineWidth = dpr; mctx.beginPath(); mctx.moveTo(scratchX, 0); mctx.lineTo(scratchX + 1.5 * dpr, h); mctx.stroke(); }
}
