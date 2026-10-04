// A card reader, after the one in the foreground of the MSC photograph of 15 July 1969: a light cabinet with a deck
// on top carrying the input hopper (a deck of cards under a weight), the feed housing and the output stacker, and a
// control panel with dials at the right. The model is not identified; 1.0 x 1.1 x 0.7 m and the details are inferred.
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";
import { PAL, Parts, at, grid, lampMat, lensGeo, paint, plastic, poseFrom, satinMetal } from "./kit";

export function build(_ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts(), grey = paint(PAL.cabinet), dark = paint(PAL.charcoal, 0.9), card = plastic(0xe9dfc4, 0.85);
  P.box(0.96, 0.06, 0.66, paint(PAL.dark, 0.9), 0, 0.03, 0);
  P.box(1.0, 0.8, 0.7, grey, 0, 0.46, 0);
  P.rbox(1.02, 0.04, 0.72, 0.01, paint(0xe6e6e1), 0, 0.88, 0);
  P.box(0.006, 0.74, 0.008, paint(PAL.dark), 0, 0.45, 0.352);
  for (let k = 0; k < 10; k++) P.box(0.25, 0.008, 0.006, paint(PAL.dark), -0.3, 0.12 + k * 0.02, 0.352);
  // Input hopper with its deck and weight, the feed housing, the output stacker.
  P.box(0.24, 0.16, 0.14, dark, -0.28, 0.98, -0.12);
  P.box(0.19, 0.09, 0.085, card, -0.28, 0.945, -0.12).box(0.19, 0.03, 0.085, satinMetal(), -0.28, 1.005, -0.12);
  P.rbox(0.3, 0.12, 0.3, 0.02, grey, 0.02, 0.96, -0.1);
  P.box(0.24, 0.1, 0.16, dark, -0.05, 0.95, 0.18);
  P.box(0.19, 0.04, 0.085, card, -0.05, 0.92, 0.18);
  // Control panel, angled toward the operator, with three dials.
  P.add(new THREE.BoxGeometry(0.28, 0.2, 0.05), dark, at(0.33, 1.0, 0.05, -0.5));
  for (const x of [0.25, 0.33, 0.41]) P.add(new THREE.CylinderGeometry(0.022, 0.024, 0.02, 20).rotateX(Math.PI / 2), satinMetal(), at(x, 1.012, 0.083, -0.5));
  P.bake(object).forEach(m => mine.push(m.geometry));
  const lamps = grid(lensGeo(), lampMat(), 3, 1, c => at(0.25 + c * 0.08, 0.955, 0.1, -0.5, 0, 0, 0.014), c => [0x6cf08a, 0xfff2dc, 0x2a2a26][c]);
  object.add(lamps); mine.push(lamps);
  return {
    object,
    anchors: { camera: poseFrom(new THREE.Vector3(0, 0.8, 0.1), [0.4, 0.6, 1], 1.9, 40) },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
