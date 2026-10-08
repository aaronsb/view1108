// Camera shots: a pose with its field and bloom, and the shots a placed equipment gives (its own anchors, and the
// pose that fits its screen to the page's element). lab.ts flies between them.
import * as THREE from "three";
import type { CameraPose, Placed } from "./types";

const D2R = Math.PI / 180;

/** A camera state: position, orientation, vertical field of view (deg), and how much bloom it wants (0..1). */
export interface Shot { position: THREE.Vector3; quaternion: THREE.Quaternion; fov: number; glow: number }
/** The screen's projected rect against the page's, CSS px. */
export interface Mismatch { name: string; dx0: number; dy0: number; dx1: number; dy1: number }

export function shotOf(p: CameraPose, glow = 1): Shot {
  const m = new THREE.Matrix4().lookAt(p.position, p.target, new THREE.Vector3(0, 1, 0));
  return { position: p.position.clone(), quaternion: new THREE.Quaternion().setFromRotationMatrix(m), fov: p.fov, glow };
}

/** A placed equipment's own pose (anchors.camera, the zoom-in; or anchors.view, a console's arrival) in room
 *  coordinates. */
export function anchorShot(p: Placed | undefined, which: "camera" | "view" = "camera"): Shot | null {
  const c = p?.equipment.anchors[which];
  if (!p || !c) return null;
  const m = p.equipment.object.matrixWorld;
  return shotOf({ position: c.position.clone().applyMatrix4(m), target: c.target.clone().applyMatrix4(m), fov: c.fov }, 0);
}

/** The pose square to the equipment's screen at which the picture's part of it (uvRect; the screen mesh a plane
 *  in its local XY facing +Z, UVs running across its bounds) spans `rect`'s height (its width, with `fit`) on the
 *  lab canvas (`cr`, seen by `camera`), centred on it. Where the rect is wider than the screen the page widens from
 *  the screen's rect (`mismatch`; room.js). */
export function matchShot(p: Placed | undefined, rect: DOMRect, cr: DOMRect, camera: THREE.PerspectiveCamera): { shot: Shot; mismatch: Mismatch } | null {
  const sc = p?.equipment.anchors.screen;
  if (!p || !sc || rect.width < 2 || rect.height < 2) return null;
  if (cr.width < 2 || cr.height < 2) return null;
  const g = sc.mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const b = g.boundingBox!, [u0, v0, u1, v1] = sc.uvRect, z = b.max.z;
  const at = (u: number, v: number) => new THREE.Vector3(b.min.x + u * (b.max.x - b.min.x), b.min.y + v * (b.max.y - b.min.y), z).applyMatrix4(sc.mesh.matrixWorld);
  const p00 = at(u0, v0), p10 = at(u1, v0), p01 = at(u0, v1), p11 = at(u1, v1);
  const R = p10.clone().sub(p00), U = p01.clone().sub(p00);
  const w = R.length(), h = U.length();
  R.normalize(); U.normalize();
  const Nn = new THREE.Vector3().crossVectors(R, U).normalize();
  U.crossVectors(Nn, R);   // square the frame if the mesh is sheared
  const C = p00.clone().add(p10).add(p01).add(p11).multiplyScalar(0.25);
  const fov = p.equipment.anchors.camera?.fov ?? 35, tn = Math.tan(fov / 2 * D2R);
  const d = sc.fit === "width" ? w * cr.height / (2 * tn * rect.width) : h * cr.height / (2 * tn * rect.height);
  const k = 2 * d * tn / cr.height;   // metres per CSS px at the screen
  const ox = rect.left + rect.width / 2 - (cr.left + cr.width / 2), oy = (cr.top + cr.height / 2) - (rect.top + rect.height / 2);
  const position = C.clone().addScaledVector(Nn, d).addScaledVector(R, -ox * k).addScaledVector(U, -oy * k);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, U, Nn));
  // Check: project the picture's corners from there.
  const cam = camera.clone(); cam.position.copy(position); cam.quaternion.copy(quaternion); cam.fov = fov;
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const px = (v: THREE.Vector3) => { const s = v.clone().project(cam); return { x: cr.left + (s.x + 1) / 2 * cr.width, y: cr.top + (1 - s.y) / 2 * cr.height }; };
  const a = px(p01), c = px(p10);
  return { shot: { position, quaternion, fov, glow: 0 }, mismatch: { name: p.name, dx0: a.x - rect.left, dy0: a.y - rect.top, dx1: c.x - rect.right, dy1: c.y - rect.bottom } };
}
