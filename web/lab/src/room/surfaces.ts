// Procedural surface maps for the room shell, drawn once on 2D canvases: the raised floor's tiles, the acoustic
// ceiling and the wall clock's face. A deterministic PRNG keeps them the same on every load.
import * as THREE from "three";

/** xorshift32, 0..1. */
export function rng(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}

function tex(c: HTMLCanvasElement, srgb: boolean, aniso: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Speckle: n random dots of one colour, for the matte grain of vinyl tile and mineral board. */
function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, style: string, r: () => number, size = 1.5) {
  g.fillStyle = style;
  for (let i = 0; i < n; i++) g.fillRect(r() * w, r() * h, size * (0.5 + r()), size * (0.5 + r()));
}

/** Raised-floor tiles: off-white vinyl, each tile a shade apart, grey seams. The roughness map makes the tops
 *  slightly glossy and the seams matte. `px` pixels per metre, `tile` the tile size in metres. */
export function floorMaps(wM: number, dM: number, tile: number, px: number, aniso: number) {
  const W = Math.round(wM * px), H = Math.round(dM * px), r = rng(7);
  const [c, g] = canvas(W, H), [cr, gr] = canvas(W, H);
  gr.fillStyle = "#5a5a5a"; gr.fillRect(0, 0, W, H);   // roughness ~0.35 on the tops
  const t = tile * px, nx = Math.ceil(wM / tile), ny = Math.ceil(dM / tile);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = 226 + Math.round((r() - 0.5) * 10), b = v + Math.round((r() - 0.5) * 3);
    g.fillStyle = `rgb(${v},${v + 1},${b})`;
    g.fillRect(i * t, j * t, t, t);
    // a faint scuff now and then, where chairs roll
    if (r() < 0.25) { g.fillStyle = "rgba(120,118,110,0.05)"; g.beginPath(); g.ellipse(i * t + r() * t, j * t + r() * t, t * (0.1 + r() * 0.3), t * 0.05, r() * 3, 0, 7); g.fill(); }
  }
  speckle(g, W, H, W * H / 90, "rgba(150,150,140,0.18)", r);
  speckle(gr, W, H, W * H / 120, "rgba(140,140,140,0.5)", r);
  g.strokeStyle = "#8f918c"; g.lineWidth = Math.max(2, px * 0.006);
  gr.strokeStyle = "#e6e6e6"; gr.lineWidth = g.lineWidth * 1.5;
  for (const q of [g, gr]) {
    q.beginPath();
    for (let i = 0; i <= nx; i++) { q.moveTo(i * t, 0); q.lineTo(i * t, H); }
    for (let j = 0; j <= ny; j++) { q.moveTo(0, j * t); q.lineTo(W, j * t); }
    q.stroke();
  }
  return { map: tex(c, true, aniso), roughnessMap: tex(cr, false, aniso) };
}

/** Dropped ceiling: fissured mineral-fibre tiles in a white T-bar grid. One texture per tile, repeated. */
export function ceilingMap(aniso: number) {
  const S = 256, r = rng(11), [c, g] = canvas(S, S);
  g.fillStyle = "#e9e8e2"; g.fillRect(0, 0, S, S);
  speckle(g, S, S, 1400, "rgba(110,108,100,0.28)", r, 1.2);
  g.strokeStyle = "rgba(120,118,110,0.18)"; g.lineWidth = 1;
  for (let i = 0; i < 70; i++) { const x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 18, y + (r() - 0.5) * 18); g.stroke(); }
  g.strokeStyle = "#f6f6f2"; g.lineWidth = 6; g.strokeRect(0, 0, S, S);
  g.strokeStyle = "#b9b8b0"; g.lineWidth = 1; g.strokeRect(3.5, 3.5, S - 7, S - 7);
  const t = tex(c, true, aniso);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A plain office wall clock's face: twelve bars, minute ticks, no maker's name (generic, ours). */
export function clockFace(aniso: number) {
  const S = 256, [c, g] = canvas(S, S), m = S / 2;
  g.fillStyle = "#f4f3ee"; g.fillRect(0, 0, S, S);
  g.translate(m, m); g.fillStyle = "#1b1b1b";
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    g.fillRect(-(big ? 4 : 1.2), -m * 0.92, big ? 8 : 2.4, big ? 22 : 9);
    g.rotate(Math.PI / 30);
  }
  return tex(c, true, aniso);
}

/** The EXIT sign's face: red letters on a dark ground, as lit from inside. */
export function exitSign(aniso: number) {
  const [c, g] = canvas(256, 108);
  g.fillStyle = "#1a0605"; g.fillRect(0, 0, 256, 108);
  g.fillStyle = "#ff3a22"; g.font = "bold 74px Helvetica, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("EXIT", 128, 58);
  return tex(c, true, aniso);
}
