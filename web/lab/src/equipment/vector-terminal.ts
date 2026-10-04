// Placeholder vector terminal (phase A): a cabinet whose screen shows the plot (#cv). Phase C replaces the cabinet;
// the screen anchor, the zoom-in pose and `opens` are what the lab relies on.
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";

// The plot canvas is 1.10 times as tall as it is wide (web/src/render.js HGT).
const SW = 0.36, SH = SW * 1.1, CAB = { w: 0.56, h: 0.62, d: 0.6 };
const FOV = 40;

export function build(ctx: BuildContext): Equipment {
  const object = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(CAB.w, CAB.h, CAB.d), new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.8 }));
  cab.position.y = CAB.h / 2;
  object.add(cab);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: ctx.vectorScreen, toneMapped: false }));
  const sy = CAB.h / 2 + 0.02, sz = CAB.d / 2 + 0.001;
  screen.position.set(0, sy, sz);
  object.add(screen);
  // The eye in front of the screen at the distance where its height fills the field.
  const dist = SH / 2 / Math.tan(FOV / 2 * Math.PI / 180) * 1.04;
  return {
    object,
    opens: "workbench",
    anchors: {
      screen: { mesh: screen, uvRect: [0, 0, 1, 1] },
      camera: { position: new THREE.Vector3(0, sy, sz + dist), target: new THREE.Vector3(0, sy, sz), fov: FOV },
    },
    dispose() { cab.geometry.dispose(); (cab.material as THREE.Material).dispose(); screen.geometry.dispose(); (screen.material as THREE.Material).dispose(); },
  };
}
