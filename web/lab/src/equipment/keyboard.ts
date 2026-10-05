// The UNISCOPE 100's keyboard as counted on the Commons photograph (docs/lab.md, The UNISCOPE 100): its layout,
// cream caps on dark skirts (cream on cream at the keypad, a red TRANSMIT, a dark RETURN) and the printed legends.
// Used by the glass terminal and, our choice, by the 4009 console's display unit.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { at, keyLegends, own, plastic, sharedGeo } from "./kit";

interface Key { x: number; r: number; w: number; h: number; t: string; cap: number; skirt: number; ink: string }
const CREAM = 0xd8d1bc, SKIRT = 0x3a3d40, PADSKIRT = 0xb9b29e, RED = 0xd42a1e, DARK = 0x4b4e50;
const INK = "#3a3833";

/** Keys in units of one key pitch: x across from the left cluster's edge, r rows from the back (the function row
 *  is r 0). Legends as photographed; the keypad's column of TAB and its three zero keys are as seen, not explained. */
function layout(): Key[] {
  const K: Key[] = [];
  const key = (x: number, r: number, t: string, w = 1, o: Partial<Key> = {}) => K.push({ x, r, w, h: 1, t, cap: CREAM, skirt: SKIRT, ink: INK, ...o });
  // Left: the edit cluster, two columns of three, and the cursor arrows under it.
  [["ERASE\nTO END\nOF DISPL", "ERASE\nTO END\nOF LINE"], ["IN DISPL\nDELETE\nIN LINE", "IN DISPL\nINSERT\nIN LINE"], ["CURSOR\nTO\nHOME", "CYCLE"]]
    .forEach((p, i) => p.forEach((t, c) => key(c * 1.6, 0.75 + i * 1.1, t, 1.5)));
  key(1.05, 4.1, "↑"); key(0, 4.75, "←"); key(2.1, 4.75, "→"); key(1.05, 5.4, "↓");
  // The main block.
  const M = 3.5;
  ["SOE ▷", "TAB\nSET", "F1", "F2", "F3", "F4", "PRINT", "MESSAGE\nWAITING", "TRANSMIT"].forEach((t, i) =>
    key(M + 0.25 + i * 1.55, 0, t, 1.3, t === "TRANSMIT" ? { cap: RED, skirt: 0xa01c14, ink: "#f4efe6" } : {}));
  key(M, 1.25, "CHAR\nERASE", 1.5);
  ["!\n1", "\"\n2", "#\n3", "$\n4", "%\n5", "&\n6", "'\n7", "(\n8", ")\n9", "Ø", "=\n−", "^", "\\"].forEach((t, i) => key(M + 1.5 + i, 1.25, t));
  key(M, 2.25, "⟵", 1.75);
  [..."QWERTYUIOP@[", "]"].forEach((t, i) => key(M + 1.75 + i, 2.25, t));
  K.push({ x: M + 14.95, r: 2.25, w: 1.5, h: 1.9, t: "RETURN", cap: DARK, skirt: 0x3a3c3e, ink: "#d8d4c8" });
  key(M, 3.25, "SHIFT\nLOCK", 1.75);
  [..."ASDFGHJKL", "+\n;", "*\n:", "}\n]"].forEach((t, i) => key(M + 1.75 + i, 3.25, t));
  key(M, 4.25, "SHIFT", 2.25);
  [..."ZXCVBNM", "<\n,", ">\n.", "?\n/"].forEach((t, i) => key(M + 2.25 + i, 4.25, t));
  key(M + 12.35, 4.25, "SHIFT", 1.75);
  key(M + 3.5, 5.25, "→", 8);
  key(M + 12.5, 5.25, "→", 1.5);
  // The numeric keypad: cream caps on cream skirts.
  const P = M + 16.95, pad = { skirt: PADSKIRT };
  [["+", "−", "·"], ["7", "8", "9"], ["4", "5", "6"], ["1", "2", "3"], ["Ø", "Ø", "Ø"]].forEach((row, i) =>
    row.forEach((t, c) => key(P + 1.1 + c * 1.05, 1.25 + i, t, 1, pad)));
  key(P, 5.25, "TAB", 1, pad);
  return K;
}
const U = 0.0178, WIDE = 3.5 + 16.95 + 1.1 + 3 * 1.05, DEEP = 5.4 + 1;   // key pitch (m); the layout's extent in units

/** The keyboard's footprint, metres: across and front to back. */
export const UNISCOPE_KEYBOARD = { w: WIDE * U, d: DEEP * U };

/** The keys at `m`: a frame whose origin is the keyboard's back edge at its centre on the surface the skirts stand on,
 *  x across, y up, z toward the typist. Two instanced meshes (skirts, caps) and one of legends (kit.ts keyLegends), in
 *  a group; geometries, materials and textures it owns are pushed to `mine`. */
export function uniscopeKeyboard(m: THREE.Matrix4, aniso: number, mine: { dispose(): void }[]): { group: THREE.Group; caps: THREE.InstancedMesh } {
  const keys = layout(), gap = 0.0026, skH = 0.011, capH = 0.0052, step = 0.0028;   // the cap's top is `step` narrower than its skirt
  const X0 = -WIDE * U / 2;
  const dims = (k: Key): [number, number] => [k.w * U - gap, k.h * U - gap];
  const capDims = (k: Key): [number, number] => [k.w * U - gap - step, k.h * U - gap - step];
  const centre = (k: Key) => m.clone().multiply(at(X0 + (k.x + k.w / 2) * U, 0, (k.r + k.h / 2) * U));
  const skirtGeo = own(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), mine).geometry;
  const capGeo = sharedGeo("uniscope-cap", () => new RoundedBoxGeometry(1, 1, 0.55, 1, 0.14).translate(0, 0, 0.275));
  const skirts = new THREE.InstancedMesh(skirtGeo, plastic(0xffffff, 0.6), keys.length);
  const caps = new THREE.InstancedMesh(capGeo, plastic(0xffffff, 0.42), keys.length);
  const col = new THREE.Color();
  keys.forEach((k, i) => {
    const [w, d] = dims(k), [cw, cd] = capDims(k), c = centre(k);
    skirts.setMatrixAt(i, c.clone().multiply(at(0, 0, 0, 0, 0, 0, w, skH, d))); skirts.setColorAt(i, col.set(k.skirt));
    caps.setMatrixAt(i, c.clone().multiply(at(0, skH - 0.0005, 0, -Math.PI / 2, 0, 0, cw, cd, capH / 0.55))); caps.setColorAt(i, col.set(k.cap));
  });
  mine.push(skirts, caps);
  const legends = keyLegends(keys.map(k => {
    const [w, d] = capDims(k);
    return { t: k.t, ink: k.ink, w: w * 0.88, d: d * 0.88, m: centre(k).multiply(at(0, skH + capH - 0.0004, 0, -Math.PI / 2)) };
  }), aniso, mine);
  const group = new THREE.Group();
  group.add(skirts, caps, legends);
  return { group, caps };
}
