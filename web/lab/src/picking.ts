// Hover and picking: the placed equipment under the pointer (or the crosshair), its lift and its label. lab.ts owns
// one; it passes the view (renderer, camera, host, label) and what the lab is doing (walking or at a close-up).
import * as THREE from "three";
import type { Carry } from "./carry";
import type { Placed, Room } from "./types";

export interface PickView {
  renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera; host: HTMLElement; labelEl: HTMLElement;
  room: Room; carry: Carry;
  /** Walking (mode "free") or at a close-up: the only times the room is picked. */
  active(): boolean;
  /** At a close-up. */
  at(): boolean;
}

export class Picking {
  hover: Placed | null = null;
  private ray = new THREE.Raycaster();
  private lifted = new Map<THREE.Mesh, [THREE.Material | THREE.Material[], THREE.Material | THREE.Material[]]>();

  constructor(private v: PickView) {}

  /** The placed equipment under (x, y) that opens something, if any. */
  hit(x: number, y: number): Placed | null {
    const r = this.v.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.v.camera);
    const named = (o: THREE.Object3D) => o.userData.placed === undefined ? undefined : this.v.room.placed.find(q => q.name === o.userData.placed);
    for (const h of this.ray.intersectObject(this.v.room.object, true)) {
      // The nearest placed piece above what was hit; a piece pressed only at a close-up stands for its station elsewhere.
      let o: THREE.Object3D | null = h.object, p = named(o);
      while (o && (!p || (p.equipment.press && !this.v.at()))) { o = o.parent; p = o ? named(o) : undefined; }
      if (!o || !p) continue;   // the shell
      return (p.equipment.opens || p.equipment.use || p.equipment.inert || p.equipment.press) && p.equipment.usable?.() !== false ? p : null;
    }
    return null;
  }

  /** Hover: lift and name the machine under (x, y). */
  pick(x: number, y: number): void {
    if (!this.v.active()) return;
    let p = this.hit(x, y);
    if (this.v.at() && !p?.equipment.pull && !p?.equipment.press) p = null;   // at a close-up only what pulls out or is pressed
    this.v.renderer.domElement.style.cursor = p || this.v.at() ? "pointer" : "";
    if (p !== this.hover) { this.clearHover(); if (p) this.lift(p, true); this.hover = p; }
    const label = p && this.nameOf(p);
    if (label) {
      const hr = this.v.host.getBoundingClientRect();
      this.v.labelEl.textContent = label;
      this.v.labelEl.style.left = `${x - hr.left + 14}px`; this.v.labelEl.style.top = `${y - hr.top + 16}px`;
      this.v.labelEl.style.display = "block";
    } else this.v.labelEl.style.display = "none";
  }

  /** A placed piece's name for hover and the walk's line: its label, and its state where it has one (the drive), or
   *  for a tape unit while a reel is carried, what using it does. */
  nameOf(p: Placed): string {
    const r = p.equipment.anchors.tapeUnit !== undefined && this.v.carry.carried();
    return [this.v.room.labels?.[p.name], r ? `click to mount ${this.v.carry.reelTitle(r)}` : p.equipment.status?.()].filter(Boolean).join(" · ");
  }

  clearHover(): void {
    if (this.hover) this.lift(this.hover, false);
    this.hover = null; this.v.labelEl.style.display = "none";
    this.v.renderer.domElement.style.cursor = "";
  }

  /** Hover highlight: a slight emissive lift on the equipment's lit surfaces (clones, so shared materials stay). */
  private lift(p: Placed, on: boolean): void {
    const up = (base: THREE.Material): THREE.Material | null => {
      if (!(base as THREE.MeshStandardMaterial).isMeshStandardMaterial) return null;
      const u = base.clone() as THREE.MeshStandardMaterial;
      u.emissive = (base as THREE.MeshStandardMaterial).emissive.clone().add(new THREE.Color(0x1c2a20));
      return u;
    };
    p.equipment.object.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      let pair = this.lifted.get(m);
      if (!pair) {
        const base = m.material;
        if (Array.isArray(base)) {   // a mesh with groups (a reel's case): each lit material lifted, the rest kept
          const ups = base.map(b => up(b));
          if (ups.every(u => !u)) return;
          pair = [base, ups.map((u, i) => u ?? base[i])];
        } else {
          const u = up(base);
          if (!u) return;
          pair = [base, u];
        }
        this.lifted.set(m, pair);
      }
      m.material = on ? pair[1] : pair[0];
    });
  }

  /** The lifted clones are freed with the lab. */
  dispose(): void {
    for (const [, [base, lift]] of this.lifted) for (const x of [lift].flat()) if (![base].flat().includes(x)) x.dispose();
  }
}
