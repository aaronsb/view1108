// Time strings and the recorder's stroke font.
"use strict";
const pad2 = n => String(n).padStart(2, "0");
// UTC of a g.e.t. of the loaded scenario, from its range zero (LS.zero: its MISSION's EPOCH card, its reel's page.json).
const utcStr = g => new Date(LS.zero + g * 1000).toISOString().slice(0, 19).replace("T", " ");
function getStr(s) { const t = Math.floor(Math.abs(s)); return (s < 0 ? "-" : "") + Math.floor(t / 3600) + ":" + pad2(Math.floor(t / 60) % 60) + ":" + pad2(t % 60); }

// ---- stroke font: the recorder's character generator ----
// Our own single-stroke uppercase font (not Hershey data), ASCII 32..95, on a grid 4 wide by 6 tall
// (y up). Each glyph is strokes separated by "/", points as two digits "xy". Characters advance
// 0.7 x height, the width the kernel assumes when it centres tick numbers.
const GLYPH_SRC = [
  "", "26 22/20 20", "16 15/36 35", "10 16/30 36/02 42/04 44", "01 10 30 41 42 33 13 04 05 16 36 45/26 20",
  "00 46/04 14 05 04/32 42 41 32", "40 03 05 16 26 35 24 00 ... ", "26 25", "36 14 12 30", "16 34 32 10",
  "12 34/14 32/23 25", "03 43/21 25", "22 21 10", "03 43", "20 20", "00 46",
  "10 30 41 45 36 16 05 01 10", "12 26 20/10 30", "05 16 36 45 44 00 40", "05 16 36 45 44 33 23/33 42 41 30 10 01", "36 02 42/36 30",
  "46 06 04 34 43 41 30 10 01", "45 36 16 05 01 10 30 41 43 34 04", "06 46 20", "34 45 36 16 05 14 34 43 41 30 10 01 03 14", "01 10 30 41 45 36 16 05 03 14 44",
  "21 21/25 25", "21 10/25 25", "45 03 41", "04 44/02 42", "05 43 01", "05 16 36 45 44 23 22/20 20",
  "41 30 10 01 05 16 36 45 43 32 22 13 14 25 35", "00 26 40/12 32", "00 06 36 45 44 33 03/33 42 41 30 00", "45 36 16 05 01 10 30 41", "00 06 26 45 41 20 00",
  "46 06 00 40/03 33", "46 06 00/03 33", "45 36 16 05 01 10 30 41 43 23", "00 06/40 46/03 43", "10 30/20 26/16 36",
  "46 41 30 10 01", "00 06/46 03/13 40", "06 00 40", "00 06 24 46 40", "00 06 40 46",
  "10 01 05 16 36 45 41 30 10", "00 06 36 45 44 33 03", "10 01 05 16 36 45 41 30 10/23 40", "00 06 36 45 44 33 03/23 40", "01 10 30 41 42 33 13 04 05 16 36 45",
  "06 46/26 20", "06 01 10 30 41 46", "06 20 46", "06 10 22 30 46", "00 46/06 40",
  "06 23 46/23 20", "06 46 00 40", "36 26 20 30", "06 40", "16 26 20 10", "03 26 43", "00 40"
];
GLYPH_SRC[6] = "40 03 05 16 26 35 24 00 ";   // '&'
const GLYPHS = GLYPH_SRC.map(g => g.split("/").map(st => st.trim().split(/\s+/).filter(Boolean).map(pt => [+pt[0], +pt[1]])).filter(st => st.length));
// Add a string, lower-left at (px, py) in canvas px, character height hpx, to a Path2D.
function strokeText(path, str, px, py, hpx) {
  const u = hpx / 6;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i) - 32, g = GLYPHS[c];
    if (g) for (const st of g) st.forEach((q, j) => { const X = px + q[0] * 0.9 * u, Y = py - q[1] * u; if (j) path.lineTo(X, Y); else path.moveTo(X, Y); });
    px += 4.2 * u;
  }
}
