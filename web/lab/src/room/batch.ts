// Draw-call batching across the whole room, after placement. Each machine already merges its own static parts per
// material (kit.ts Parts); the 7 tape units and 5 CPU cabinets share those materials, so the room merges them again:
//   1. static: the baked parts (userData.static) of each kind of machine merge into one mesh per material (one for
//      the tape row, one for the CPU row, ...; kept per kind so the renderer can still draw near things first);
//   2. repeats: a geometry and material used by 3 or more loose meshes (the 14 reels, the tape units' glass and
//      number-plate frames) becomes one InstancedMesh, its matrices copied from the originals each frame, so the
//      parts the machines move (reels turning, packs growing) keep moving;
//   3. instanced grids that share geometry and material (the lamp strips of every tape unit, the CPU lamps) become
//      one InstancedMesh, matrices and colours copied when a source changes.
// The originals stay in the scene graph, hidden: their modules keep animating them and the lab's picking still
// hits them; the batches are not pickable. The stations (stations.ts: what opens a tab or overlay, and the drive), the
// tape units (any of them mounts a carried reel, so hover lifts them) and the inert props are left alone (hover lifts
// their materials; the drive's reels and lamps are its own).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Placed } from "../types";
import { stationNamed } from "../stations";

interface Copy { from: THREE.Mesh; to: THREE.InstancedMesh; at: number; n: number; ver: number; cver: number }

export interface Batches {
  object: THREE.Group;
  /** Copy moved or recoloured sources into their batches; call after the equipment's update, before rendering. */
  update(): void;
  dispose(): void;
}

const noRay = () => {};

export function batch(root: THREE.Object3D, placed: Placed[]): Batches {
  const object = new THREE.Group();
  object.name = "batches";
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const statics = new Map<string, { mat: THREE.Material; g: THREE.BufferGeometry[]; cast: boolean }>();
  const loose = new Map<string, THREE.Mesh[]>(), grids = new Map<string, THREE.InstancedMesh[]>();
  const made: THREE.BufferGeometry[] = [];

  for (const p of placed) {
    if (p.equipment.opens || p.equipment.inert || stationNamed(p.name) || p.equipment.anchors.tapeUnit !== undefined) continue;
    const kind = p.name.replace(/-\d+$/, "");
    p.equipment.object.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible || Array.isArray(m.material)) return;
      if ((m as THREE.InstancedMesh).isInstancedMesh) {
        const key = `${m.geometry.uuid}|${m.material.uuid}|${!!(m as THREE.InstancedMesh).instanceColor}`;
        (grids.get(key) ?? grids.set(key, []).get(key)!).push(m as THREE.InstancedMesh);
      } else if (m.userData.static) {
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld.clone().premultiply(rootInv));
        const key = `${kind}|${m.material.uuid}`;
        const e = statics.get(key) ?? statics.set(key, { mat: m.material, g: [], cast: false }).get(key)!;
        e.g.push(g); e.cast ||= m.castShadow;
        m.visible = false;
      } else {
        const key = `${m.geometry.uuid}|${m.material.uuid}`;
        (loose.get(key) ?? loose.set(key, []).get(key)!).push(m);
      }
    });
  }

  for (const { mat, ...e } of statics.values()) {
    const g = mergeGeometries(e.g, false);
    e.g.forEach(x => x.dispose());
    if (!g) continue;
    made.push(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = e.cast; mesh.receiveShadow = true; mesh.raycast = noRay; mesh.matrixAutoUpdate = false;
    object.add(mesh);
  }

  const copies: Copy[] = [];
  const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, color: boolean, src: THREE.Mesh) => {
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.castShadow = src.castShadow; im.receiveShadow = src.receiveShadow; im.renderOrder = src.renderOrder;
    im.raycast = noRay; im.frustumCulled = false; im.matrixAutoUpdate = false;
    if (color) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    object.add(im);
    return im;
  };
  for (const list of loose.values()) {
    if (list.length < 3) continue;
    const im = instanced(list[0].geometry, list[0].material as THREE.Material, list.length, false, list[0]);
    list.forEach((m, i) => { copies.push({ from: m, to: im, at: i, n: 1, ver: -1, cver: -1 }); m.visible = false; });
  }
  for (const list of grids.values()) {
    if (list.length < 2) continue;
    const n = list.reduce((a, m) => a + m.count, 0);
    const im = instanced(list[0].geometry, list[0].material as THREE.Material, n, !!list[0].instanceColor, list[0]);
    let at = 0;
    for (const m of list) { copies.push({ from: m, to: im, at, n: m.count, ver: -1, cver: -1 }); at += m.count; m.visible = false; }
  }

  const world = new THREE.Matrix4(), inst = new THREE.Matrix4(), last = new Map<THREE.Mesh, THREE.Matrix4>();
  const update = () => {
    root.updateMatrixWorld();
    const dirty = new Set<THREE.InstancedMesh>(), cdirty = new Set<THREE.InstancedMesh>();
    for (const c of copies) {
      world.multiplyMatrices(rootInv, c.from.matrixWorld);
      const prev = last.get(c.from), src = c.from as THREE.InstancedMesh;
      const moved = !prev || !prev.equals(world);
      if (moved) last.set(c.from, (prev ?? new THREE.Matrix4()).copy(world));
      if (!src.isInstancedMesh) {
        if (moved) { c.to.setMatrixAt(c.at, world); dirty.add(c.to); }
        continue;
      }
      if (moved || src.instanceMatrix.version !== c.ver) {
        c.ver = src.instanceMatrix.version;
        for (let i = 0; i < c.n; i++) { src.getMatrixAt(i, inst); c.to.setMatrixAt(c.at + i, inst.premultiply(world)); }
        dirty.add(c.to);
      }
      if (src.instanceColor && c.to.instanceColor && src.instanceColor.version !== c.cver) {
        c.cver = src.instanceColor.version;
        (c.to.instanceColor.array as Float32Array).set(src.instanceColor.array as Float32Array, c.at * 3);
        cdirty.add(c.to);
      }
    }
    for (const im of dirty) im.instanceMatrix.needsUpdate = true;
    for (const im of cdirty) im.instanceColor!.needsUpdate = true;
  };
  update();

  return {
    object,
    update,
    dispose() {
      made.forEach(g => g.dispose());
      object.traverse(o => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); });
    },
  };
}
