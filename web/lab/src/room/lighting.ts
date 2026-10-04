// The room's light: cool-white fluorescent troffers overhead, a soft fill from the white floor and ceiling, and a
// warm glow near the lamp panels. Our choices throughout; the photograph shows only that the troffers light the room
// evenly. High quality: one area light per troffer row, a soft shadow from overhead, image-based fill. Low: a
// hemisphere and one unshadowed overhead light, nothing per-fragment heavy.
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Quality } from "../types";
import { ROOM, TROFFERS } from "./shell";

const COOL = 0xeef3ff, WARM = 0xffb36a;
/** Haze: the far wall fades a little toward the troffers' grey-white. */
export const FOG = { color: 0x9a9d98, near: 7, far: 26 };
let ltcReady = false;

export class Lighting {
  private group = new THREE.Group();
  private env: THREE.WebGLRenderTarget | null = null;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, quality: Quality) {
    scene.add(this.group);
    scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04);
    room.dispose(); pmrem.dispose();
    scene.environment = this.env.texture;
    this.set(quality);
  }

  set(q: Quality): void {
    for (const c of [...this.group.children]) { this.group.remove(c); (c as THREE.Light).dispose?.(); }
    const r = this.renderer, add = (l: THREE.Object3D) => { this.group.add(l); return l; };
    r.shadowMap.enabled = q === "high";
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    // Static: the light and nearly everything that casts stand still, so the map is drawn once (here and when the
    // lab is shown) instead of every frame; the reels' and clock hands' own shadows are too small to miss.
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    this.scene.environmentIntensity = q === "high" ? 0.22 : 0.35;
    add(new THREE.HemisphereLight(0xf4f6ff, 0x8d8a80, q === "high" ? 0.55 : 1.25));
    // Overhead key: soft-shadowed at high, from a little south so the machine fronts catch it.
    const key = new THREE.DirectionalLight(COOL, q === "high" ? 0.7 : 1.4);
    key.position.set(0.6, ROOM.h + 3, 2.2); key.target.position.set(0, 0, -0.4);
    if (q === "high") {
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      Object.assign(key.shadow.camera, { left: -ROOM.w / 2 - 0.5, right: ROOM.w / 2 + 0.5, top: ROOM.d / 2 + 1, bottom: -ROOM.d / 2 - 1, near: 0.5, far: 12 });
      key.shadow.camera.updateProjectionMatrix();
      key.shadow.radius = 5; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    }
    add(key); add(key.target);
    if (q === "high") {
      if (!ltcReady) { RectAreaLightUniformsLib.init(); ltcReady = true; }
      const len = TROFFERS.xs[TROFFERS.xs.length - 1] - TROFFERS.xs[0] + TROFFERS.len;
      for (const z of TROFFERS.rows) {
        const a = new THREE.RectAreaLight(COOL, 5.5, len, TROFFERS.wid);
        a.position.set(0, ROOM.h - 0.03, z); a.lookAt(0, 0, z);
        add(a);
      }
    }
    // Warm accents by the CPU lamp panel and the operator console (the modules' lamps glow; this lets them colour
    // the floor and the cabinets near them).
    for (const [x, y, z, i] of [[-3.0, 1.5, 0, 0.45], [-1.2, 1.1, -0.45, 0.35]]) {
      const p = new THREE.PointLight(WARM, i, 2.6, 2); p.position.set(x, y, z); add(p);
    }
    this.scene.traverse(o => { const m = (o as THREE.Mesh).material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.needsUpdate = true; }); });
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.scene.environment = null; this.scene.fog = null;
    this.env?.dispose(); this.env = null;
  }
}
