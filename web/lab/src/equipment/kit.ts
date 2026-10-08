// The equipment's shared workshop: the brochure palette, procedural surface maps, materials, a geometry collector
// that merges static parts into one mesh per material, and the small parts many machines share (lamp grids, keys,
// text plates, CRT glass). Surface maps, materials and part geometries are made once, on first use, and shared by
// every machine; an equipment's dispose() frees only what it made for itself. Swept-case ideas, the noise and the
// height-to-normal maps are ported from ../progression (MIT, same author: src/render/display/housing.ts,
// src/eras/teletype/realism/textures.ts).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Colours read off the UNIVAC 1108 II brochure's colour plates (CHM 102646105, pp. 3, 6, 7); approximate. */
export const PAL = {
  cabinet: 0xc9ccc8,   // light grey frames and doors
  warm: 0xcfcbc0,      // the CPU row's warmer grey
  charcoal: 0x3a3f44,  // lamp and indicator panels, reel-window surrounds
  dark: 0x232629,      // plinths, recesses
  orange: 0xc8642a,    // badges, the tape units' head plates, the console's drawer
  white: 0xeeeeea,     // desk tops
  black: 0x111213,
  tape: 0x3a2a20,      // oxide brown
};

// ---- procedural maps ----

/** Deterministic PRNG (xorshift32), so every run makes the same surfaces. */
export function rng(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

function valueNoise(size: number, cells: number, seed: number): Float32Array {
  const r = rng(seed), lat = new Float32Array(cells * cells).map(() => r()), out = new Float32Array(size * size);
  const sm = (t: number) => t * t * (3 - 2 * t);
  const at = (i: number, j: number) => lat[((j + cells) % cells) * cells + ((i + cells) % cells)];
  for (let y = 0; y < size; y++) {
    const fy = y / size * cells, y0 = Math.floor(fy), ty = sm(fy - y0);
    for (let x = 0; x < size; x++) {
      const fx = x / size * cells, x0 = Math.floor(fx), tx = sm(fx - x0);
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      out[y * size + x] = a + (b - a) * ty;
    }
  }
  return out;
}

function fbm(size: number, cells: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, cells << o, seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function dataTex(d: Uint8Array, size: number): THREE.DataTexture {
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}

function normalFromHeight(h: Float32Array, size: number, k: number): THREE.DataTexture {
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = h[y * size + (x - 1 + size) % size], r = h[y * size + (x + 1) % size];
    const u = h[((y - 1 + size) % size) * size + x], b = h[((y + 1) % size) * size + x];
    const nx = (l - r) * k, ny = (b - u) * k, len = Math.hypot(nx, ny, 1), i = (y * size + x) * 4;
    d[i] = (nx / len * 0.5 + 0.5) * 255; d[i + 1] = (ny / len * 0.5 + 0.5) * 255; d[i + 2] = (1 / len * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  return dataTex(d, size);
}

function greyTex(v: Float32Array, size: number): THREE.DataTexture {
  const d = new Uint8Array(size * size * 4);
  for (let i = 0; i < v.length; i++) { const g = Math.max(0, Math.min(255, v[i] * 255)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g; d[i * 4 + 3] = 255; }
  return dataTex(d, size);
}

interface Maps { normal: THREE.Texture; rough: THREE.Texture }
const mapCache = new Map<string, Maps>();
/** Painted steel: a faint orange peel and a roughness that drifts across a panel. Tile: 0.5 m. */
function paintMaps(): Maps {
  let m = mapCache.get("paint");
  if (!m) {
    const N = 128, h = fbm(N, 64, 2, 7), drift = valueNoise(N, 3, 57), r = new Float32Array(N * N);
    for (let i = 0; i < r.length; i++) r[i] = 0.52 + drift[i] * 0.07 + h[i] * 0.04;
    mapCache.set("paint", m = { normal: normalFromHeight(h, N, 1), rough: greyTex(r, N) });
  }
  return m;
}
/** Laminate: smoother, with a fine stipple. */
function laminateMaps(): Maps {
  let m = mapCache.get("lam");
  if (!m) {
    const N = 128, h = fbm(N, 32, 2, 19), r = new Float32Array(N * N);
    for (let i = 0; i < r.length; i++) r[i] = 0.3 + h[i] * 0.15;
    mapCache.set("lam", m = { normal: normalFromHeight(h, N, 1.2), rough: greyTex(r, N) });
  }
  return m;
}

// ---- materials (shared, keyed) ----

const matCache = new Map<string, THREE.Material>();
function cached<M extends THREE.Material>(key: string, make: () => M): M {
  let m = matCache.get(key) as M | undefined;
  if (!m) matCache.set(key, m = make());
  return m;
}

/** Painted sheet steel (the default for cabinets). `rough` scales the drifting roughness map. */
export const paint = (color: number, rough = 1): THREE.MeshStandardMaterial => cached(`paint${color}|${rough}`, () => {
  const p = paintMaps();
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, normalMap: p.normal, roughnessMap: p.rough });
  m.normalScale.setScalar(0.04);
  return m;
});
/** Plastic laminate (desk tops). */
export const laminate = (color: number): THREE.MeshStandardMaterial => cached(`lam${color}`, () => {
  const p = laminateMaps();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, normalMap: p.normal, roughnessMap: p.rough });
  m.normalScale.setScalar(0.03);
  return m;
});
/** Chrome and polished steel. Reads best with a scene environment map; without one it keeps a pale base colour. */
export const chrome = (): THREE.MeshStandardMaterial => cached("chrome", () => new THREE.MeshStandardMaterial({ color: 0xd9dcdf, metalness: 0.85, roughness: 0.2 }));
export const satinMetal = (color = 0xa9adb1): THREE.MeshStandardMaterial => cached(`satin${color}`, () => new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.38 }));
export const rubber = (color = 0x1a1a1a): THREE.MeshStandardMaterial => cached(`rub${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 }));
export const plastic = (color: number, roughness = 0.45): THREE.MeshStandardMaterial => cached(`pl${color}|${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }));
/** Smoked glass or acrylic: a dark, glossy, mostly transparent sheet. */
export const smoked = (opacity = 0.35, color = 0x1b2023): THREE.MeshPhysicalMaterial => cached(`smk${opacity}|${color}`, () => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.06, metalness: 0, transparent: true, opacity, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide,
}));
/** A CRT's face, switched off or between strokes: near-black glossy glass. */
export const tubeGlass = (color = 0x0b0e0d): THREE.MeshPhysicalMaterial => cached(`tube${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 }));
/** Lamps: unlit, outside tone mapping, coloured per instance (instanceColor) for lamp grids. */
export const lampMat = (): THREE.MeshBasicMaterial => cached("lamp", () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
export const glowMat = (color: number): THREE.MeshBasicMaterial => cached(`glow${color}`, () => new THREE.MeshBasicMaterial({ color, toneMapped: false }));

// ---- part geometries (shared) ----

const geoCache = new Map<string, THREE.BufferGeometry>();
export function sharedGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, g = make());
  return g;
}

// ---- the collector ----

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
/** A placement matrix: position, then rotation (radians, XYZ order), then an optional scale. */
export function at(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/**
 * Collects static parts and merges them into one mesh per material, so a machine costs a handful of draw calls.
 * Every part gets box-projected UVs in metres (0.5 m tiles), so the paint maps keep one scale across a cabinet.
 */
export class Parts {
  private by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  readonly made: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4 = _m.identity()): this {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (geo !== g) geo.dispose();
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    boxUV(g);
    const l = this.by.get(mat);
    if (l) l.push(g); else this.by.set(mat, [g]);
    return this;
  }
  box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): this {
    return this.add(new THREE.BoxGeometry(w, h, d), mat, at(x, y, z, rx, ry, rz));
  }
  /** A box with rounded edges; `r` its edge radius. */
  rbox(w: number, h: number, d: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): this {
    return this.add(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), mat, at(x, y, z, rx, ry, rz));
  }
  /** A cylinder along Y, or along Z with `alongZ`. */
  cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 20, alongZ = false): this {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (alongZ) g.rotateX(Math.PI / 2);
    return this.add(g, mat, at(x, y, z));
  }
  /** A side profile, points (z, y), extruded across x from x0 to x1. */
  profile(pts: [number, number][], x0: number, x1: number, mat: THREE.Material, bevel = 0): this {
    // The shape is drawn as (-z, y) and extruded along its +Z; a quarter turn about Y then puts the extrusion along
    // +x and the shape's -x along +z (a rotation, so the faces keep their winding).
    const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0 - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
    g.rotateY(Math.PI / 2);
    return this.add(g, mat, at(x0 + bevel, 0, 0));
  }
  /** A front outline, points (x, y), extruded along z from z0 to z1. */
  outline(pts: [number, number][], z0: number, z1: number, mat: THREE.Material, bevel = 0, holes: [number, number][][] = []): this {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0 - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
    return this.add(g, mat, at(0, 0, z0 + bevel));
  }

  /** Merge into meshes under `into`, which must not move once placed (the meshes are marked static); the collector
   *  is spent. */
  bake(into: THREE.Object3D): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [mat, list] of this.by) {
      const g = mergeGeometries(list, false)!;
      list.forEach(x => x.dispose());
      this.made.push(g);
      const mesh = new THREE.Mesh(g, mat);
      mesh.userData.static = true;   // never moved after placement: the room may merge it (room/batch.ts)
      into.add(mesh); out.push(mesh);
    }
    this.by.clear();
    return out;
  }
}

/** Box-projected UVs in metres / 0.5 (one paint tile per half metre). */
function boxUV(g: THREE.BufferGeometry): void {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * 2; uv[i * 2 + 1] = v * 2;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

// ---- small shared parts ----

/** Rounded-rectangle points (x, y) about a centre, counter-clockwise. */
export function roundRect(cx: number, cy: number, w: number, h: number, r: number, k = 6): [number, number][] {
  const out: [number, number][] = [], hw = w / 2 - r, hh = h / 2 - r;
  const cs = [[hw, hh], [-hw, hh], [-hw, -hh], [hw, -hh]];
  for (let c = 0; c < 4; c++) for (let i = 0; i <= k; i++) {
    const a = (c + i / k) * Math.PI / 2;
    out.push([cx + cs[c][0] + Math.cos(a) * r, cy + cs[c][1] + Math.sin(a) * r]);
  }
  return out;
}

/** A grid of instanced lamps or keys; `colors` sets each instance's colour. */
export function grid(geo: THREE.BufferGeometry, mat: THREE.Material, cols: number, rows: number, place: (c: number, r: number) => THREE.Matrix4, color?: (c: number, r: number) => number): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, mat, cols * rows);
  const col = new THREE.Color();
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    im.setMatrixAt(i, place(c, r));
    if (color) im.setColorAt(i, col.set(color(c, r)));
    i++;
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}

/** A small round lamp lens facing +Z, 1 unit across (scale it with the instance matrix). */
export const lensGeo = () => sharedGeo("lens", () => new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8).rotateX(Math.PI / 2).translate(0, 0, 0.2));
/** A square lamp tile facing +Z, 1 unit across. */
export const tileGeo = () => sharedGeo("tile", () => new THREE.BoxGeometry(1, 1, 0.3).translate(0, 0, 0.15));
/** A keycap: a rounded slab 1 unit square, its base on z = 0 (lay it on a tray with the instance matrix). */
export const keyGeo = () => sharedGeo("key", () => new RoundedBoxGeometry(1, 1, 0.55, 1, 0.12).translate(0, 0, 0.275));

/** A canvas-backed texture the caller owns. */
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, aniso = 4): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}

/** A key's printed legend: text (lines split on "\n"), ink, the printed area w x d in metres, and a matrix placing
 *  that area centred in its XY plane, the text's top along +Y, facing +Z. */
export interface Legend { t: string; ink: string; w: number; d: number; m: THREE.Matrix4 }
const LEGEND_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/** Every legend of a keyboard as one mesh: the texts drawn on one canvas atlas (cells packed on shelves), a quad per
 *  key. Its geometry, material and texture are pushed to `mine`. */
export function keyLegends(keys: Legend[], aniso: number, mine: { dispose(): void }[]): THREE.Mesh {
  keys = keys.filter(k => k.t);
  const AW = 2048, AH = 1024, CH = 88;
  const cells: [number, number, number, number][] = [];
  let x = 0, y = 0;
  for (const k of keys) {
    const cw = Math.min(AW, Math.ceil(CH * k.w / k.d));
    if (x + cw > AW) { x = 0; y += CH; }
    cells.push([x, y, cw, CH]); x += cw + 2;
  }
  const tex = canvasTex(AW, AH, g => {
    keys.forEach((k, i) => {
      const [cx, cy, cw, ch] = cells[i], lines = k.t.split("\n");
      const single = lines.length === 1 && [...lines[0]].length <= 2;
      let fs = single ? ch * 0.44 : lines.length === 1 ? ch * 0.3 : lines.length === 2 && lines.every(l => [...l].length <= 2) ? ch * 0.34 : ch * 0.82 / lines.length * 0.9;
      g.font = `600 ${fs}px ${LEGEND_FONT}`;
      const wid = Math.max(...lines.map(l => g.measureText(l).width));
      if (wid > cw * 0.86) { fs *= cw * 0.86 / wid; g.font = `600 ${fs}px ${LEGEND_FONT}`; }
      g.fillStyle = k.ink; g.textAlign = "center"; g.textBaseline = "middle";
      lines.forEach((l, j) => g.fillText(l, cx + cw / 2, cy + ch / 2 + (j - (lines.length - 1) / 2) * fs * 1.08));
    });
  }, aniso);
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], idx: number[] = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  keys.forEach((k, i) => {
    const [cx, cy, cw, ch] = cells[i], u0 = cx / AW, u1 = (cx + cw) / AW, v0 = 1 - (cy + ch) / AH, v1 = 1 - cy / AH, b = pos.length / 3;
    nm.getNormalMatrix(k.m); n.set(0, 0, 1).applyMatrix3(nm).normalize();
    for (const [qx, qy, uu, vv] of [[-1, 1, u0, v1], [1, 1, u1, v1], [1, -1, u1, v0], [-1, -1, u0, v0]]) {
      v.set(qx * k.w / 2, qy * k.d / 2, 0).applyMatrix4(k.m); pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); uvs.push(uu, vv);
    }
    idx.push(b, b + 3, b + 2, b, b + 2, b + 1);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  mine.push(geo, mat, tex);
  return new THREE.Mesh(geo, mat);
}

/** A flat plate (badge, number plate, label) facing +Z with its own texture; returns the mesh (caller disposes). */
export function plate(tex: THREE.Texture, w: number, h: number, emissive = false): THREE.Mesh {
  const m = emissive ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}

// ---- nameplate lettering ----

/**
 * The machines' nameplate face. UNIVAC's manuals and badges letter in Microgramma, which is commercial; Michroma
 * (Vernon Adams, SIL OFL 1.1, web/fonts/) is an extended face in its spirit. The page declares "Michroma VIEW" in
 * page.css (gallery.html for the gallery); the fallbacks are wide sans faces.
 */
export const PLATE_FONT = '"Michroma VIEW", Eurostile, "Arial Black", Helvetica, Arial, sans-serif';

let fontOK = false;
let fontWait: Promise<boolean> | null = null;
/**
 * Resolves true once "Michroma VIEW" is loaded, false if it is not declared or does not arrive within `ms`. Canvas
 * text drawn before then falls back silently, hence fontTex.
 */
export function plateFontReady(ms = 4000): Promise<boolean> {
  if (fontWait) return fontWait;
  if (typeof document === "undefined" || !document.fonts) return fontWait = Promise.resolve(false);
  const load = document.fonts.load('32px "Michroma VIEW"').then(f => (fontOK = f.length > 0), () => false);
  const late = new Promise<boolean>(r => setTimeout(() => r(false), ms));
  return fontWait = Promise.race([load, late]);
}

/**
 * A canvasTex whose drawing uses PLATE_FONT: drawn now, and drawn again (canvas cleared) when the font arrives if it
 * had not yet, unless the texture has been disposed by then.
 */
export function fontTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, aniso = 4): THREE.CanvasTexture {
  const t = canvasTex(w, h, draw, aniso);
  if (!fontOK) {
    let gone = false;
    t.addEventListener("dispose", () => { gone = true; });
    void plateFontReady().then(ok => {
      if (!ok || gone) return;
      const g = (t.image as HTMLCanvasElement).getContext("2d")!;
      g.clearRect(0, 0, w, h);
      draw(g, w, h); t.needsUpdate = true;
    });
  }
  return t;
}

/**
 * Letters `text` in capitals at (x, y) (textBaseline "middle"), `px` high, tracked `track` em between letters, aligned
 * left, centre or right of x, in the current fillStyle. Michroma has one weight, lighter than the bold extended capitals
 * of the badges, so the letters are thickened by a stroke `bold` em wide in the same colour. Returns the width drawn.
 */
export function plateText(g: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, track = 0.12, align: "left" | "center" | "right" = "left", bold = 0.045): number {
  const s = [...text.toUpperCase()];
  g.font = `${px}px ${PLATE_FONT}`; g.textBaseline = "middle"; g.textAlign = "left";
  g.strokeStyle = g.fillStyle; g.lineWidth = bold * px; g.lineJoin = "round";
  const ws = s.map(c => g.measureText(c).width), gap = track * px;
  const wid = ws.reduce((a, b) => a + b, 0) + gap * Math.max(0, ws.length - 1);
  let cx = align === "left" ? x : align === "center" ? x - wid / 2 : x - wid;
  s.forEach((c, i) => { g.fillText(c, cx, y); if (bold > 0) g.strokeText(c, cx, y); cx += ws[i] + gap; });
  return wid;
}

export interface NameplateOpts {
  /** Plate height in metres (default 0.02); the width follows the text. */
  height?: number;
  fg?: string; bg?: string;
  /** Letter height as a fraction of the plate height (0.5), tracking in em (0.12), side margin in plate heights (0.5). */
  cap?: number; track?: number; margin?: number;
  /** A fine rule just inside the edge, in fg (default off). */
  rule?: boolean;
  /** Unlit and outside tone mapping (a light strip or a lamp legend). */
  emissive?: boolean;
}

/**
 * A nameplate mesh facing +Z, centred on its origin: `text` in PLATE_FONT on a plain field. The mesh owns its
 * geometry, material and texture; pass `mine` to have all three pushed for disposal.
 */
export function nameplate(text: string, o: NameplateOpts = {}, mine?: { dispose(): void }[]): THREE.Mesh {
  const H = o.height ?? 0.02, cap = o.cap ?? 0.5, track = o.track ?? 0.12, margin = o.margin ?? 0.5;
  const ph = 64, px = ph * cap, n = text.length;
  // Canvas room: Michroma's capitals and digits average 1.0 em wide (W 1.6 em; our reading of its advance widths).
  const cw = Math.min(2048, 1 << Math.ceil(Math.log2(n * px * 1.3 + (n - 1) * track * px + 2 * margin * ph)));
  const geo = new THREE.PlaneGeometry(1, H);
  // The plate's width follows the text as drawn, so it is set again if the font arrives after the first drawing.
  let pw = cw, tex: THREE.CanvasTexture | null = null;
  const fit = () => {
    tex!.repeat.set(pw / cw, 1); tex!.offset.set((cw - pw) / 2 / cw, 0);
    const p = geo.attributes.position, half = H * pw / ph / 2;
    for (let i = 0; i < p.count; i++) p.setX(i, Math.sign(p.getX(i)) * half);
    p.needsUpdate = true; geo.computeBoundingBox(); geo.computeBoundingSphere();
  };
  tex = fontTex(cw, ph, (g, w, h) => {
    g.font = `${px}px ${PLATE_FONT}`;
    pw = Math.min(w, Math.ceil(plateText(g, text, -1e4, 0, px, track) + 2 * margin * ph));
    const x0 = (w - pw) / 2;
    g.clearRect(0, 0, w, h);
    g.fillStyle = o.bg ?? "#151617"; g.fillRect(x0, 0, pw, h);
    if (o.rule) { g.strokeStyle = o.fg ?? "#eeeeea"; g.lineWidth = 2; g.strokeRect(x0 + 4, 4, pw - 8, h - 8); }
    g.fillStyle = o.fg ?? "#eeeeea";
    plateText(g, text, w / 2, h / 2 + px * 0.04, px, track, "center");
    if (tex) fit();
  });
  fit();
  const mat = o.emissive ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.15 });
  if (mine) mine.push(geo, mat, tex);
  return new THREE.Mesh(geo, mat);
}

/**
 * The UNIVAC badge, as on the 1108 II brochure's cabinet (CHM 102646105, p. 3): "UNIVAC" in extended white capitals
 * on black, the model number on an orange panel at its right. An empty `model` gives the black UNIVAC plate alone.
 * 512 x 96, so a plate about 5.3:1.
 */
export function badgeTex(model: string): THREE.CanvasTexture {
  return fontTex(512, 96, (g, w, h) => {
    g.fillStyle = "#16181a"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#efeee8";
    const x = model ? 318 : w;
    plateText(g, "UNIVAC", model ? 20 : w / 2, h / 2 + 2, 44, 0.1, model ? "left" : "center");
    if (model) {
      g.fillStyle = "#c8642a"; g.fillRect(x, 8, w - x - 8, h - 16);
      g.fillStyle = "#4a2410"; plateText(g, model, (x + w - 8) / 2, h / 2 + 2, 34, 0.08, "center");
    }
  });
}

/** Felt-marker lettering (ours): a plain condensed sans, every letter a little off its line and turned, so it reads as
 *  written by hand rather than printed. No web font: whichever of these the browser has. */
const MARKER_FONT = '"Arial Narrow", "Liberation Sans Narrow", "Helvetica Neue", Arial, sans-serif';

export interface TapeStripOpts {
  /** A drawn arrow after the text pointing right, or before it pointing left. */
  arrow?: "left" | "right";
  /** Seed for the hand's wobble and the torn ends. */
  seed?: number;
}

/**
 * A strip of masking tape with writing on it (ours, #19: the shelves' labels, the operator's signage form of
 * 2026-10-07): `text` in black marker on buff paper tape with torn ends, `h` metres tall and as wide as its writing,
 * with a drawn arrow where `arrow` says. A plane facing +Z, centred on its origin, to stick on a shelf's front edge;
 * its geometry, material and texture are pushed to `mine`.
 */
export function tapeStrip(text: string, h: number, mine: { dispose(): void }[], o: TapeStripOpts = {}): THREE.Mesh {
  const CH = 64, px = 40, r = rng(o.seed ?? text.length * 131 + 7), chars = [...text.toUpperCase()];
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `bold ${px}px ${MARKER_FONT}`;
  const ws = chars.map(c => measure.measureText(c).width), gap = 0.06 * px;
  const textW = ws.reduce((a, b) => a + b, 0) + gap * Math.max(0, chars.length - 1);
  const arrowW = o.arrow ? 1.7 * px : 0, pad = 0.45 * CH, W = Math.ceil(textW + arrowW + 2 * pad);
  const tex = canvasTex(W, CH, g => {
    // The tape: torn ends (a ragged edge every few pixels), a faint crepe of darker streaks along it.
    g.beginPath(); g.moveTo(6, 3);
    for (let x = 6; x < W - 6; x += 24) g.lineTo(x, 3 + r() * 1.5);
    for (let y = 3; y < CH - 3; y += 5) g.lineTo(W - 4 - r() * 6, y);
    for (let x = W - 6; x > 6; x -= 24) g.lineTo(x, CH - 3 - r() * 1.5);
    for (let y = CH - 3; y > 3; y -= 5) g.lineTo(2 + r() * 6, y);
    g.closePath(); g.fillStyle = "#d9cb9a"; g.fill();
    g.save(); g.clip();
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(120,100,60,${0.04 + r() * 0.05})`; g.fillRect(0, r() * CH, W, 1 + r() * 2); }
    g.restore();
    // The writing: each letter on its own slightly wandering line, a little turned.
    g.fillStyle = g.strokeStyle = "#17171a"; g.lineWidth = 1.6; g.lineJoin = g.lineCap = "round";
    g.font = `bold ${px}px ${MARKER_FONT}`; g.textBaseline = "middle"; g.textAlign = "left";
    let x = pad + (o.arrow === "left" ? arrowW : 0);
    chars.forEach((c, i) => {
      g.save(); g.translate(x, CH / 2 + 2 + (r() - 0.5) * 3); g.rotate((r() - 0.5) * 0.09);
      g.fillText(c, 0, 0); g.strokeText(c, 0, 0); g.restore();
      x += ws[i] + gap;
    });
    if (o.arrow) {   // a shaft and a two-stroke head, drawn as quickly as by hand
      const right = o.arrow === "right", x0 = right ? x + 0.3 * px : pad + 1.3 * px, x1 = right ? x0 + 1.2 * px : pad + 0.1 * px;
      const y = CH / 2 + 1, d = right ? -1 : 1;
      g.lineWidth = 0.13 * px;
      g.beginPath(); g.moveTo(x0, y + 1); g.lineTo(x1, y - 1); g.stroke();
      g.beginPath(); g.moveTo(x1 + d * 0.42 * px, y - 0.36 * px); g.lineTo(x1, y - 1); g.lineTo(x1 + d * 0.4 * px, y + 0.38 * px); g.stroke();
    }
  });
  const geo = new THREE.PlaneGeometry(h * W / CH, h);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, alphaTest: 0.5 });
  mine.push(geo, mat, tex);
  return new THREE.Mesh(geo, mat);
}

/** Dispose a list of geometries, materials and textures made by one build. */
export function disposer(...lists: { dispose(): void }[][]): () => void {
  return () => { for (const l of lists) for (const d of l) d.dispose(); };
}

/** The mesh's own material(s) and geometry, for meshes not built from shared resources. */
export function own(m: THREE.Mesh, list: { dispose(): void }[]): THREE.Mesh {
  list.push(m.geometry);
  (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => list.push(x));
  return m;
}

/** A close-up camera pose looking at `target` from `dist` along the direction (dx, dy, dz). */
export function poseFrom(target: THREE.Vector3, dir: [number, number, number], dist: number, fov = 40) {
  const d = new THREE.Vector3(...dir).normalize().multiplyScalar(dist);
  return { position: target.clone().add(d), target: target.clone(), fov };
}

/** Distance at which a height `h` fills a vertical field `fov` (deg), with a margin. */
export const fitDist = (h: number, fov: number, margin = 1.04) => h / 2 / Math.tan(fov / 2 * Math.PI / 180) * margin;

/** An operator's view of a console (ours): from in front (+Z), looking `down` degrees below level, centred on and
 *  just containing every corner of `boxes` (the screen and the keyboard, in the equipment's frame) in a vertical
 *  field `fov` (deg) and a horizontal one at `aspect`, with a margin. */
export function viewPose(boxes: THREE.Box3[], fov = 40, down = 25, aspect = 4 / 3, margin = 1.3) {
  const a = down * Math.PI / 180, tv = Math.tan(fov / 2 * Math.PI / 180) / margin, th = tv * aspect;
  const r = new THREE.Vector3(1, 0, 0), u = new THREE.Vector3(0, Math.cos(a), -Math.sin(a)), n = new THREE.Vector3(0, Math.sin(a), Math.cos(a));
  const all = new THREE.Box3(), corners: THREE.Vector3[] = [];
  for (const b of boxes) {
    all.union(b);
    for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
  }
  const target = all.getCenter(new THREE.Vector3());
  let d = 0;
  // Fit, then re-aim at the middle of what is seen (the nearer keyboard looks larger than the screen); a few rounds.
  for (let k = 0; k < 4; k++) {
    const rel = corners.map(c => c.clone().sub(target));
    d = Math.max(...rel.map(c => c.dot(n) + Math.max(Math.abs(c.dot(u)) / tv, Math.abs(c.dot(r)) / th)));
    const ys = rel.map(c => c.dot(u) / (d - c.dot(n))), xs = rel.map(c => c.dot(r) / (d - c.dot(n)));
    target.addScaledVector(u, (Math.max(...ys) + Math.min(...ys)) / 2 * d).addScaledVector(r, (Math.max(...xs) + Math.min(...xs)) / 2 * d);
  }
  return { position: target.clone().addScaledVector(n, d), target, fov };
}
