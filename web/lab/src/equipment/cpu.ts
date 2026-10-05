// A UNIVAC 1108 cabinet: the light warm-grey, full-height-door cabinets of the processor and storage rows (1108 II
// brochure p. 3, colour). With `lampPanel` it is the processor's maintenance panel from the same plate: a charcoal
// panel of dense lamps above a row of pushbuttons, the orange "UNIVAC 1108" badge over it, plain doors below. The
// 0.8 x 1.9 x 0.8 m size is read off the photographs (inferred). The lamp rows are 36 lamps wide in octal groups of
// three, one row per 36-bit word (the 1108's word, UP-4046); what each row shows is ours: the top row counts the kernel
// frames drawn, the second the g.e.t. in seconds, the rest random words that change fast while the page plays and
// slowly when it is idle.
import * as THREE from "three";
import type { BuildContext, Equipment, LabState } from "../types";
import { PAL, Parts, at, badgeTex, chrome, grid, lampMat, lensGeo, own, paint, plastic, poseFrom, rng, satinMetal, tileGeo } from "./kit";

export interface CpuOptions { lampPanel?: boolean }

const COLS = 36, ROWS = 12;

/** The cabinet itself, 0.8 x 1.9 x 0.8: plinth, body, top, the dark reveals at its sides and a pair of doors from
 *  0.1 m up to `doorTop` with their handles at `handleY`. Above the doors the front is left for a panel. The power
 *  cabinet (powercab.ts) is built on it too. */
export function cabinet(P: Parts, doorTop: number, handleY: number): void {
  const warm = paint(PAL.warm), dark = paint(PAL.charcoal, 0.9);
  P.box(0.78, 0.08, 0.76, paint(PAL.dark, 0.9), 0, 0.04, 0);
  P.box(0.8, 1.8, 0.8, warm, 0, 0.98, 0);
  P.rbox(0.8, 0.025, 0.8, 0.006, paint(0xd8d5cc), 0, 1.89, 0);
  for (const x of [-0.39, 0.39]) P.box(0.02, 1.8, 0.012, dark, x, 0.98, 0.401);   // the dark reveals between cabinets
  for (const x of [-0.19, 0.19]) {
    P.box(0.37, doorTop - 0.1, 0.012, warm, x, (doorTop + 0.1) / 2, 0.406);
    P.box(0.012, 0.18, 0.02, chrome(), x + (x < 0 ? 0.15 : -0.15), handleY, 0.418);
  }
  P.box(0.006, doorTop - 0.1, 0.014, paint(PAL.dark), 0, (doorTop + 0.1) / 2, 0.407);
}

export function build(_ctx: BuildContext, opts: CpuOptions = {}): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts(), dark = paint(PAL.charcoal, 0.9);
  cabinet(P, opts.lampPanel ? 1.0 : 1.86, opts.lampPanel ? 0.6 : 1.0);

  let lamps: THREE.InstancedMesh | null = null;
  if (opts.lampPanel) {
    P.box(0.76, 0.8, 0.014, dark, 0, 1.43, 0.407);
    for (let k = 0; k < 3; k++) P.cyl(0.014, 0.016, 0.02, satinMetal(), 0.345, 1.6 - k * 0.1, 0.42, 20, true);
    P.box(0.68, 0.004, 0.004, paint(0x8a8d90), -0.02, 1.225, 0.415);
    const badge = own(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.056), new THREE.MeshStandardMaterial({ map: badgeTex("1108"), roughness: 0.4, metalness: 0.3 })), mine);
    mine.push((badge.material as THREE.MeshStandardMaterial).map!);
    badge.position.set(-0.2, 1.865, 0.416); object.add(badge);
    const lx = (c: number) => -0.33 + c * 0.0165 + Math.floor(c / 3) * 0.004, ly = (r: number) => 1.75 - r * 0.042 - Math.floor(r / 4) * 0.012;
    lamps = grid(lensGeo(), lampMat(), COLS, ROWS, (c, r) => at(lx(c), ly(r), 0.414, 0, 0, 0, 0.0095, 0.0095, 0.008), () => 0);
    object.add(lamps); mine.push(lamps);
    const buttons = grid(tileGeo(), plastic(0xffffff, 0.4), 18, 1, c => at(-0.31 + c * 0.034, 1.16, 0.414, 0, 0, 0, 0.026, 0.022, 0.03), c => c % 6 < 2 ? PAL.orange : 0xe8e4da);
    object.add(buttons); mine.push(buttons);
  }
  P.bake(object).forEach(m => mine.push(m.geometry));

  // Lamp words: bits per row, redrawn at a rate that follows the page's activity.
  const r = rng(1108), words: number[][] = [];
  for (let k = 0; k < ROWS; k++) words.push(Array.from({ length: COLS }, () => (r() < 0.4 ? 1 : 0)));
  const ON = new THREE.Color(1, 0.9, 0.7), OFF = new THREE.Color(0.11, 0.1, 0.085), tmp = new THREE.Color();
  let clock = 0, lastFrame = -1, busy = 0;
  const bits = (n: number, row: number[]) => { n = Math.max(0, Math.floor(n)); for (let c = 0; c < COLS; c++) row[COLS - 1 - c] = Math.floor(n / 2 ** c) % 2; };
  const paintLamps = () => {
    let i = 0;
    for (let rr = 0; rr < ROWS; rr++) for (let c = 0; c < COLS; c++) lamps!.setColorAt(i++, words[rr][c] ? tmp.copy(ON).multiplyScalar(0.8 + r() * 0.2) : OFF);
    lamps!.instanceColor!.needsUpdate = true;
  };
  const step = (s: LabState, n: number) => {
    bits(s.frameNo, words[0]); bits(s.get, words[1]);
    for (let k = 0; k < n; k++) { const row = words[2 + Math.floor(r() * (ROWS - 2))]; row[Math.floor(r() * COLS)] ^= 1; }
    if (busy > 0) for (let rr = 2; rr < ROWS; rr++) if (r() < 0.3) for (let c = 0; c < COLS; c++) words[rr][c] = r() < 0.45 ? 1 : 0;
    paintLamps();
  };
  if (lamps) paintLamps();

  return {
    object,
    anchors: {
      camera: poseFrom(new THREE.Vector3(0, opts.lampPanel ? 1.5 : 1.1, 0.4), [0.1, 0.05, 1], opts.lampPanel ? 1.35 : 2.2, 40),
      ...(opts.lampPanel ? { lamps: { center: new THREE.Vector3(0, 1.43, 0.414), normal: new THREE.Vector3(0, 0, 1), w: 0.76, h: 0.8 } } : {}),
    },
    update(dt, s) {
      if (!lamps) return;
      if (s.frameNo !== lastFrame) { lastFrame = s.frameNo; busy = 0.5; }
      busy -= dt;
      const active = s.playing || busy > 0, rate = active ? 20 : 1.5;
      if ((clock += dt) < 1 / rate) return;
      clock = 0;
      step(s, active ? 30 : 3);
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
