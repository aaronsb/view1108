// A desk: a white laminate slab on chrome T-legs, as the 1108 II brochure shows them (p. 7, colour). 1.5 x 0.73 x
// 0.75 m (ours). Its anchor `top` is where the room stands things on it.
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";
import { PAL, Parts, chrome, laminate, paint } from "./kit";

const W = 1.5, D = 0.75, H = 0.73, T = 0.035;

export function build(_ctx: BuildContext): Equipment {
  const object = new THREE.Group();
  const P = new Parts();
  P.rbox(W, T, D, 0.01, laminate(PAL.white), 0, H - T / 2, 0);
  P.box(W - 0.2, 0.06, 0.02, paint(PAL.charcoal, 0.8), 0, H - T - 0.03, -D / 2 + 0.06);   // a modesty rail
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - 0.12);
    P.box(0.07, H - T - 0.03, 0.035, chrome(), x, (H - T) / 2, 0);      // the upright
    P.box(0.06, 0.03, D - 0.06, chrome(), x, 0.015, 0);                  // the foot
    P.box(0.05, 0.03, D - 0.12, chrome(), x, H - T - 0.015, 0);          // the arm under the top
  }
  const made = P.bake(object).map(m => m.geometry);
  return {
    object,
    anchors: { top: new THREE.Vector3(0, H, 0) },
    dispose() { made.forEach(g => g.dispose()); },
  };
}
