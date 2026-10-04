// Placeholder desk (phase A): a top on four legs, 2.4 m by 0.8 m, 0.75 m high. Its anchor `top` is where the
// room stands things on it.
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";

const W = 2.4, D = 0.8, H = 0.75, T = 0.04;

export function build(_ctx: BuildContext): Equipment {
  const object = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5b5f63, roughness: 0.6, metalness: 0.2 });
  const geo: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d); geo.push(g);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); object.add(m);
  };
  box(W, T, D, 0, H - T / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, H - T, 0.05, sx * (W / 2 - 0.06), (H - T) / 2, sz * (D / 2 - 0.06));
  return {
    object,
    anchors: { top: new THREE.Vector3(0, H, 0) },
    dispose() { geo.forEach(g => g.dispose()); mat.dispose(); },
  };
}
