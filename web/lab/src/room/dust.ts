// Airborne dust: soft motes drifting slowly through a box, catching the light. Additive and depth-tested.
// Ported from progression (src/eras/teletype/realism/dust.ts, MIT, same author).
import * as THREE from "three";

export interface DustOptions {
  box: THREE.Box3;   // region the motes drift in, metres
  count?: number;
  size?: number;     // mote size, metres
  color?: THREE.ColorRepresentation;
  opacity?: number;
  seed?: number;
}

export class Dust {
  readonly object: THREE.Points;
  private box: THREE.Box3;
  private velocity: Float32Array;
  private sprite: THREE.CanvasTexture;
  private time = 0;

  constructor(o: DustOptions) {
    const n = o.count ?? 300;
    this.box = o.box.clone();
    let s = o.seed ?? 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pos = new Float32Array(n * 3);
    this.velocity = new Float32Array(n * 3);
    const size = this.box.getSize(new THREE.Vector3());
    for (let i = 0; i < n; i++) {
      pos[i * 3] = this.box.min.x + r() * size.x;
      pos[i * 3 + 1] = this.box.min.y + r() * size.y;
      pos[i * 3 + 2] = this.box.min.z + r() * size.z;
      this.velocity[i * 3] = (r() - 0.5) * 0.012;
      this.velocity[i * 3 + 1] = (r() - 0.6) * 0.008;
      this.velocity[i * 3 + 2] = (r() - 0.5) * 0.012;
    }
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    this.sprite = new THREE.CanvasTexture(c);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.object = new THREE.Points(geo, new THREE.PointsMaterial({
      size: o.size ?? 0.004, map: this.sprite, color: o.color ?? 0xf4f6ff, transparent: true, opacity: o.opacity ?? 0.3,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
    }));
    this.object.frustumCulled = false;
  }

  update(dt: number) {
    const time = (this.time += dt);
    const p = this.object.geometry.getAttribute("position") as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    const { min, max } = this.box;
    for (let i = 0; i < a.length; i += 3) {
      a[i] += (this.velocity[i] + Math.sin(time * 0.3 + i) * 0.004) * dt;
      a[i + 1] += this.velocity[i + 1] * dt;
      a[i + 2] += (this.velocity[i + 2] + Math.cos(time * 0.27 + i) * 0.004) * dt;
      if (a[i + 1] < min.y) a[i + 1] = max.y;
      if (a[i] < min.x) a[i] = max.x;
      if (a[i] > max.x) a[i] = min.x;
      if (a[i + 2] < min.z) a[i + 2] = max.z;
      if (a[i + 2] > max.z) a[i + 2] = min.z;
    }
    p.needsUpdate = true;
  }

  dispose() {
    this.object.geometry.dispose();
    (this.object.material as THREE.Material).dispose();
    this.sprite.dispose();
  }
}
