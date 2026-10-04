// An operator's chair: a chrome swivel on a five-star base with casters, a dark upholstered seat and back, as in the
// 1108 II brochure (p. 7, colour). Proportions ours: seat 0.46 m high, 0.6 x 0.88 x 0.6 m in all.
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";
import { Parts, at, chrome, rubber } from "./kit";

export function build(_ctx: BuildContext): Equipment {
  const object = new THREE.Group();
  const P = new Parts(), cr = chrome(), vinyl = rubber(0x24272a);
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    P.add(new THREE.BoxGeometry(0.26, 0.025, 0.04), cr, at(c * 0.13, 0.065, s * 0.13, 0, -a, 0.12));
    P.add(new THREE.SphereGeometry(0.025, 12, 8), rubber(), at(c * 0.27, 0.025, s * 0.27));
  }
  P.cyl(0.03, 0.03, 0.33, cr, 0, 0.24, 0, 16);
  P.rbox(0.48, 0.07, 0.46, 0.03, vinyl, 0, 0.44, 0);
  P.add(new THREE.BoxGeometry(0.05, 0.36, 0.02), cr, at(0, 0.56, -0.315, -0.12));
  P.rbox(0.44, 0.26, 0.06, 0.025, vinyl, 0, 0.72, -0.27, -0.12);
  const made = P.bake(object).map(m => m.geometry);
  return { object, anchors: {}, dispose() { made.forEach(g => g.dispose()); } };
}
