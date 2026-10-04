// The room's shell: raised floor, walls, dropped ceiling with fluorescent troffers, a door and a wall clock.
// The look follows the MSC photograph of 15 July 1969 (docs/media/UNIVAC1108-NASA.png: white raised-floor tiles
// about 60 cm, a dropped ceiling with long rows of troffers); the size, wall colour, door and clock are ours.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ceilingMap, clockFace, floorMaps } from "./surfaces";

/** Room size, metres: x across (west -, east +), z deep (north wall at -D/2), y up. */
export const ROOM = { w: 8, d: 6, h: 2.75 };
/** Raised-floor and ceiling tile, metres. */
export const TILE = 0.6;
/** Troffer rows: z of each row, the fixtures' x centres and their size (metres). */
export const TROFFERS = {
  rows: [-2.1, -0.7, 0.7, 2.1],
  xs: [-3.0, -1.5, 0, 1.5, 3.0],
  len: 1.22, wid: 0.3,
};
const DOOR = { z: 2.2, w: 0.92, h: 2.13 };   // on the west wall
const CLOCK = { x: 0, y: 2.32, r: 0.16 };    // on the north wall, above the tape drives

export interface Shell {
  object: THREE.Group;
  update(): void;
  dispose(): void;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

export function buildShell(aniso: number): Shell {
  const object = new THREE.Group(), { w: W, d: D, h: H } = ROOM;
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texs: THREE.Texture[] = [];
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, shadow = { cast: false, receive: true }) => {
    geos.push(g); if (!mats.includes(m)) mats.push(m);
    const o = new THREE.Mesh(g, m); o.castShadow = shadow.cast; o.receiveShadow = shadow.receive; object.add(o); return o;
  };

  // Floor: one plane carrying every tile (one draw call, no instancing needed).
  const fm = floorMaps(W, D, TILE, 160, aniso); texs.push(fm.map, fm.roughnessMap);
  const floorMat = new THREE.MeshStandardMaterial({ map: fm.map, roughnessMap: fm.roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 0.6 });
  mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);

  // Ceiling: one tile texture repeated across a plane.
  const cm = ceilingMap(aniso); cm.repeat.set(W / TILE, D / TILE); texs.push(cm);
  mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2).translate(0, H, 0), new THREE.MeshStandardMaterial({ map: cm, roughness: 0.95 }));

  // Walls in a pale institutional green-grey, with a dark vinyl base strip.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc3c7b6, roughness: 0.9 });
  const doorHole = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(D / 2, H), new THREE.Vector2(-D / 2, H)]);
  // The west wall's shape x runs along -z once turned to face the room.
  const a = -DOOR.z - DOOR.w / 2, b = -DOOR.z + DOOR.w / 2;
  doorHole.holes.push(new THREE.Path([new THREE.Vector2(a, 0.001), new THREE.Vector2(b, 0.001), new THREE.Vector2(b, DOOR.h), new THREE.Vector2(a, DOOR.h)]));
  mesh(mergeGeometries([
    new THREE.PlaneGeometry(W, H).translate(0, H / 2, -D / 2),                                  // north
    new THREE.PlaneGeometry(W, H).rotateY(Math.PI).translate(0, H / 2, D / 2),                  // south
    new THREE.ShapeGeometry(doorHole).rotateY(Math.PI / 2).translate(-W / 2, 0, 0),             // west, with the door
    new THREE.PlaneGeometry(D, H).rotateY(-Math.PI / 2).translate(W / 2, H / 2, 0),             // east
  ].map(g => g.toNonIndexed()))!, wallMat);
  const base = 0.1, bt = 0.012;
  mesh(mergeGeometries([
    box(W, base, bt, 0, base / 2, -D / 2 + bt / 2), box(W, base, bt, 0, base / 2, D / 2 - bt / 2),
    box(bt, base, D / 2 + DOOR.z - DOOR.w / 2, -W / 2 + bt / 2, base / 2, (-D / 2 + DOOR.z - DOOR.w / 2) / 2),
    box(bt, base, D / 2 - DOOR.z - DOOR.w / 2, -W / 2 + bt / 2, base / 2, (D / 2 + DOOR.z + DOOR.w / 2) / 2),
    box(bt, base, D, W / 2 - bt / 2, base / 2, 0),
  ])!, new THREE.MeshStandardMaterial({ color: 0x2c2b29, roughness: 0.6 }));

  // Door: a painted steel leaf in a frame, with a kick plate and a lever (ours).
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8c9088, roughness: 0.5, metalness: 0.3 });
  const fw = 0.05, x0 = -W / 2;
  mesh(mergeGeometries([
    box(0.03, DOOR.h + fw, fw, x0 + 0.015, (DOOR.h + fw) / 2, DOOR.z - DOOR.w / 2 - fw / 2),
    box(0.03, DOOR.h + fw, fw, x0 + 0.015, (DOOR.h + fw) / 2, DOOR.z + DOOR.w / 2 + fw / 2),
    box(0.03, fw, DOOR.w + 2 * fw, x0 + 0.015, DOOR.h + fw / 2, DOOR.z),
  ])!, frameMat);
  mesh(box(0.045, DOOR.h - 0.01, DOOR.w - 0.01, x0 - 0.01, DOOR.h / 2, DOOR.z), new THREE.MeshStandardMaterial({ color: 0x6f7a72, roughness: 0.55, metalness: 0.15 }));
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8c8c4, roughness: 0.25, metalness: 0.9 });
  mesh(mergeGeometries([
    box(0.004, 0.25, DOOR.w - 0.08, x0 + 0.014, 0.14, DOOR.z),
    box(0.05, 0.02, 0.02, x0 + 0.04, 1.02, DOOR.z - DOOR.w / 2 + 0.09),
    box(0.02, 0.02, 0.13, x0 + 0.06, 1.02, DOOR.z - DOOR.w / 2 + 0.14),
  ])!, steel);

  // Troffers: steel housings and glowing diffusers, instanced (two draw calls for all of them).
  const n = TROFFERS.rows.length * TROFFERS.xs.length, m4 = new THREE.Matrix4();
  const housing = new THREE.InstancedMesh(new THREE.BoxGeometry(TROFFERS.len + 0.04, 0.03, TROFFERS.wid + 0.04), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4, metalness: 0.2 }), n);
  const diffuser = new THREE.InstancedMesh(new THREE.PlaneGeometry(TROFFERS.len, TROFFERS.wid).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeef4ff, emissiveIntensity: 2.6, roughness: 1 }), n);
  let k = 0;
  for (const z of TROFFERS.rows) for (const x of TROFFERS.xs) {
    housing.setMatrixAt(k, m4.makeTranslation(x, H - 0.01, z));
    diffuser.setMatrixAt(k++, m4.makeTranslation(x, H - 0.026, z));
  }
  for (const im of [housing, diffuser]) { geos.push(im.geometry); mats.push(im.material as THREE.Material); object.add(im); }

  // Wall clock (generic, ours): a face, a black rim and three hands that keep the viewer's time.
  const face = clockFace(aniso); texs.push(face);
  const clock = new THREE.Group(); clock.position.set(CLOCK.x, CLOCK.y, -D / 2 + 0.03); object.add(clock);
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const o = new THREE.Mesh(g, m); parent.add(o); return o; };
  add(new THREE.CircleGeometry(CLOCK.r, 48), new THREE.MeshStandardMaterial({ map: face, roughness: 0.4 }), clock);
  add(new THREE.TorusGeometry(CLOCK.r + 0.008, 0.012, 8, 48), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.35, metalness: 0.4 }), clock);
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  const hand = (len: number, wid: number, z: number, m: THREE.Material) => {
    const h = add(new THREE.PlaneGeometry(wid, len).translate(0, len / 2 - 0.02, 0), m, clock); h.position.z = z; return h;
  };
  const hh = hand(CLOCK.r * 0.55, 0.014, 0.004, black), mh = hand(CLOCK.r * 0.82, 0.009, 0.006, black);
  const sh = hand(CLOCK.r * 0.86, 0.003, 0.008, new THREE.MeshStandardMaterial({ color: 0xb02a1a, roughness: 0.5 }));

  return {
    object,
    update() {
      const t = new Date(), s = t.getSeconds() + t.getMilliseconds() / 1000, m = t.getMinutes() + s / 60, h = (t.getHours() % 12) + m / 60;
      sh.rotation.z = -s / 60 * 2 * Math.PI;
      mh.rotation.z = -m / 60 * 2 * Math.PI;
      hh.rotation.z = -h / 12 * 2 * Math.PI;
    },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose()); },
  };
}
