// The UNIVAC 1557 Display Controller that drives the 1558 (UP-7789, 1970): 48 x 24 x 64 in, 1000 lb (p. 27, read as
// W x D x H): 1.2 x 1.6 x 0.6 m here. No figure shows it; its look is the 1108 cabinets' (HYPOTHETICAL): light
// grey, three doors, a dark plinth, a badge and a strip of status lamps.
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";
import { PAL, Parts, at, badgeTex, chrome, grid, lampMat, lensGeo, own, paint, poseFrom, rng } from "./kit";

export function build(_ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts(), grey = paint(PAL.cabinet);
  P.box(1.18, 0.07, 0.56, paint(PAL.dark, 0.9), 0, 0.035, 0);
  P.box(1.2, 1.5, 0.6, grey, 0, 0.82, 0);
  P.rbox(1.2, 0.03, 0.6, 0.006, paint(0xd4d6d2), 0, 1.585, 0);
  P.box(1.16, 0.1, 0.01, paint(PAL.charcoal, 0.9), 0, 1.5, 0.302);
  for (const x of [-0.4, 0, 0.4]) {
    P.box(0.39, 1.36, 0.01, grey, x, 0.76, 0.303);
    P.box(0.012, 0.16, 0.02, chrome(), x + 0.16, 0.85, 0.312);
  }
  P.bake(object).forEach(m => mine.push(m.geometry));
  const badge = own(new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.045), new THREE.MeshStandardMaterial({ map: badgeTex("1557"), roughness: 0.4, metalness: 0.3 })), mine);
  mine.push((badge.material as THREE.MeshStandardMaterial).map!);
  badge.position.set(-0.4, 1.5, 0.309); object.add(badge);
  const r = rng(1557), on = [0x6cf08a, 0xfff2dc, 0xffb040];
  const lamps = grid(lensGeo(), lampMat(), 10, 1, c => at(0.1 + c * 0.04, 1.5, 0.308, 0, 0, 0, 0.014), () => (r() < 0.5 ? on[Math.floor(r() * 3)] : 0x2a2a26));
  object.add(lamps); mine.push(lamps);
  return {
    object,
    anchors: { camera: poseFrom(new THREE.Vector3(0, 1.0, 0.3), [0.2, 0.1, 1], 2.6, 40) },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
