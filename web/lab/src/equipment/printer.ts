// A high-speed line printer, 132 columns at 1200 lines a minute (UP-4046 rev. 3 sec. 8.5; the model is not named):
// a light cabinet with a raised hood, the print window and a small control panel, fanfold greenbar paper rising from
// it and folding into a stacker behind. The look follows the printers in the MSC photograph of 15 July 1969 (behind
// the tape row and in the foreground); 1.4 x 1.2 x 0.8 m is inferred. The paper path and the stacker are ours.
//
// A finished beam frame (`beamFrame`) advances the paper a few lines, at most twice a second; the stack grows a sheet
// each 11 in and starts again when full.
import * as THREE from "three";
import type { BuildContext, Equipment, LabEvent } from "../types";
import { PAL, Parts, at, canvasTex, chrome, grid, lampMat, lensGeo, paint, plastic, poseFrom, rng, smoked } from "./kit";

const PAGE = 11 * 0.0254, WIDE = 14.875 * 0.0254;   // 14 7/8 x 11 in fanfold (the usual 132-column stock; ours)
const LINE = 0.0254 / 6;                             // six lines to the inch

/** Greenbar: pale green bands three lines deep, sprocket holes down both edges, a little print. */
function greenbar(): THREE.CanvasTexture {
  const t = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = "#f4f2ea"; g.fillRect(0, 0, w, h);
    const lh = h / 66;   // 66 lines to an 11 in page
    g.fillStyle = "#cfe5cf";
    for (let l = 0; l < 66; l += 6) g.fillRect(18, l * lh, w - 36, lh * 3);
    g.fillStyle = "#9a9a94";
    for (let k = 0; k < 22; k++) for (const x of [8, w - 8]) { g.beginPath(); g.arc(x, (k + 0.5) * h / 22, 3, 0, Math.PI * 2); g.fill(); }
    const r = rng(1200); g.fillStyle = "#4a4a4a";
    for (let l = 2; l < 62; l++) if (r() < 0.7) { let x = 24; while (x < w - 30 && r() < 0.93) { const n = 4 + r() * 22; g.fillRect(x, l * lh + 1, n, lh * 0.5); x += n + 4 + r() * 10; } }
    g.strokeStyle = "#c4c2b8"; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(0, h - 1); g.lineTo(w, h - 1); g.stroke();
  });
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function build(_ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts(), grey = paint(PAL.cabinet), dark = paint(PAL.charcoal, 0.9);
  const zc = 0.14, D = 0.52;
  P.box(1.36, 0.06, D - 0.04, paint(PAL.dark, 0.9), 0, 0.03, zc);
  P.box(1.4, 0.82, D, grey, 0, 0.47, zc);
  P.rbox(1.32, 0.26, D - 0.04, 0.04, paint(0xd6d7d3), 0, 0.99, zc);
  P.box(1.0, 0.075, 0.01, dark, -0.1, 1.0, zc + D / 2 - 0.015);
  P.box(0.22, 0.15, 0.012, dark, 0.53, 1.0, zc + D / 2 - 0.012);
  for (let k = 0; k < 8; k++) P.box(0.3, 0.008, 0.006, paint(PAL.dark), 0.45, 0.16 + k * 0.022, zc + D / 2 + 0.002);
  P.box(0.006, 0.78, 0.008, paint(PAL.dark), 0, 0.47, zc + D / 2 + 0.002);
  P.box(0.4, 0.012, 0.03, chrome(), 0, 1.122, -0.07);   // the paper slot's lip
  // The stacker: a chrome wire basket behind the cabinet.
  const bz = -0.26, bw = WIDE + 0.06, bd = PAGE + 0.04;
  for (const x of [-bw / 2, bw / 2]) for (const z of [bz - bd / 2, bz + bd / 2]) P.box(0.012, 0.5, 0.012, chrome(), x, 0.25, z);
  for (const y of [0.02, 0.5]) { for (const x of [-bw / 2, bw / 2]) P.box(0.01, 0.01, bd, chrome(), x, y, bz); for (const z of [bz - bd / 2, bz + bd / 2]) P.box(bw, 0.01, 0.01, chrome(), 0, y, z); }
  P.bake(object).forEach(m => mine.push(m.geometry));

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.1), smoked(0.25)); mine.push(glass.geometry);
  glass.position.set(-0.1, 1.0, zc + D / 2 - 0.004); object.add(glass);
  const lamps = grid(lensGeo(), lampMat(), 3, 2, (c, r) => at(0.47 + c * 0.05, 1.03 - r * 0.05, zc + D / 2 - 0.005, 0, 0, 0, 0.018), (c, r) => [0x6cf08a, 0x2a2a26, 0xfff2dc, 0xffb040, 0x2a2a26, 0x2a2a26][r * 3 + c]);
  object.add(lamps); mine.push(lamps);
  const PRINT = 4;   // the lamp that blinks as a frame prints (index; meaning ours)

  // The paper: a strip from the slot up and over, down into the stacker.
  const tex = greenbar(); mine.push(tex);
  tex.repeat.set(1, 1);
  const paperMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide }); mine.push(paperMat);
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.12, -0.07), new THREE.Vector3(0, 1.2, -0.1), new THREE.Vector3(0, 1.22, -0.18), new THREE.Vector3(0, 1.16, -0.27), new THREE.Vector3(0, 0.9, -0.3), new THREE.Vector3(0, 0.62, -0.28)]);
  const N = 40, len = path.getLength();
  const strip = new THREE.PlaneGeometry(WIDE, 1, 1, N); mine.push(strip);
  const sp = strip.attributes.position, suv = strip.attributes.uv;
  for (let i = 0; i < sp.count; i++) {
    const t = 1 - (sp.getY(i) + 0.5), q = path.getPointAt(t);
    sp.setXYZ(i, sp.getX(i), q.y, q.z);
    suv.setY(i, -t * len / PAGE);
  }
  strip.computeVertexNormals();
  object.add(new THREE.Mesh(strip, paperMat));
  // The stack: a block of folded sheets, its edges the paper's colour.
  const stackMat = plastic(0xeeece2, 0.9);
  const stack = new THREE.Mesh(new THREE.BoxGeometry(WIDE, 1, PAGE), stackMat); mine.push(stack.geometry);
  object.add(stack);
  let sheets = 60, fed = 0, last = -1e9, blink = 0;
  const sizeStack = () => { const h = 0.0004 * sheets; stack.scale.y = h; stack.position.set(0, 0.03 + h / 2, bz); };
  sizeStack();
  const col = new THREE.Color();

  return {
    object,
    anchors: { camera: poseFrom(new THREE.Vector3(0, 0.85, 0.2), [0.5, 0.35, 1], 2.4, 40) },
    update(dt) {
      if (blink > 0 && (blink -= dt) <= 0) { lamps.setColorAt(PRINT, col.set(0x2a2a26)); lamps.instanceColor!.needsUpdate = true; }
    },
    event(e: LabEvent) {
      if (e.type !== "beamFrame" || e.at - last < 500) return;
      last = e.at;
      const d = LINE * 4;   // a frame's worth: four lines (ours)
      tex.offset.y -= d / PAGE;
      if ((fed += d) >= PAGE) { fed -= PAGE; if (++sheets > 600) sheets = 60; sizeStack(); }
      lamps.setColorAt(PRINT, col.set(0xffb040)); lamps.instanceColor!.needsUpdate = true; blink = 0.15;
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
