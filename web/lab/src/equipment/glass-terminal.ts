// Placeholder glass terminal (phase A): a cabinet whose screen carries a few lines of green text. Clicking it opens
// the Source tab. Phase C replaces it.
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";

const SW = 0.34, SH = SW * 0.75, CAB = { w: 0.5, h: 0.42, d: 0.5 };
const FOV = 40;

function face(ctx: BuildContext): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 384;
  const g = c.getContext("2d")!;
  g.fillStyle = "#020a04"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#a8f5b8"; g.font = "28px monospace";
  ["VIEW KERNEL SOURCE", "", "      SUBROUTINE VFRAME", "C     ONE FRAME", "      CALL LAYERS(...)", "      RETURN", "      END"]
    .forEach((s, i) => g.fillText(s, 24, 52 + i * 40));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ctx.maxAnisotropy;
  return t;
}

export function build(ctx: BuildContext): Equipment {
  const object = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(CAB.w, CAB.h, CAB.d), new THREE.MeshStandardMaterial({ color: 0xc9c2ae, roughness: 0.7 }));
  cab.position.y = CAB.h / 2;
  object.add(cab);
  const tex = face(ctx);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const sy = CAB.h / 2 + 0.02, sz = CAB.d / 2 + 0.001;
  screen.position.set(0, sy, sz);
  object.add(screen);
  const dist = SH / 2 / Math.tan(FOV / 2 * Math.PI / 180) * 1.04;
  return {
    object,
    opens: "source",
    anchors: {
      screen: { mesh: screen, uvRect: [0, 0, 1, 1] },
      camera: { position: new THREE.Vector3(0, sy, sz + dist), target: new THREE.Vector3(0, sy, sz), fov: FOV },
    },
    dispose() { tex.dispose(); cab.geometry.dispose(); (cab.material as THREE.Material).dispose(); screen.geometry.dispose(); (screen.material as THREE.Material).dispose(); },
  };
}
