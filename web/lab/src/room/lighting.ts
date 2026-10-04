// The room's light: cool-white fluorescent troffers overhead, a soft fill from the white floor and ceiling, and a
// warm glow near the lamp panels. Our choices throughout; the photograph shows only that the troffers light the room
// evenly. High quality: one area light per troffer row, a soft shadow from overhead, image-based fill. Low: a
// hemisphere and one unshadowed overhead light, nothing per-fragment heavy.
//
// The light switch (ours): off, the troffers go dark and the room is lit only by what stays on, the equipment's lamps
// and screens and the EXIT sign: a few dim lights (`glows`, from the room) stand for their light on the floor and the
// cabinets, the ambient drops to a faint blue, and the exposure rises so the room is dark but legible. Back on, the
// tubes strike unevenly, flickering a moment each, a couple of them late, then warm up. The glows are lights only
// while the troffers are not all lit, so the lit room pays nothing for them.
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Glow, Quality } from "../types";
import { ROOM, TROFFERS } from "./shell";

const COOL = 0xeef3ff, WARM = 0xffb36a, NIGHT = 0x9aa8c8;
/** Haze: the far wall fades a little toward the troffers' grey-white. */
export const FOG = { color: 0x9a9d98, near: 7, far: 26 };
/** Exposure with the troffers lit and dark. */
const EXPOSE = { lit: 1.0, dark: 2.1 };
let ltcReady = false;

const TUBES = TROFFERS.rows.length * TROFFERS.xs.length;
interface Strike { at: number; len: number; slot: number; v: number }

export class Lighting {
  private group = new THREE.Group();
  private env: THREE.WebGLRenderTarget | null = null;
  private q: Quality;
  private hemi!: THREE.HemisphereLight;
  private key!: THREE.DirectionalLight;
  private rows: THREE.RectAreaLight[] = [];
  private glowLights = false;
  private level = new Float32Array(TUBES);   // each tube now, 0..1
  private strikes: Strike[] | null = null;   // the tubes coming on
  private t = 0;
  on: boolean;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, quality: Quality,
    private tubes: (level: (k: number) => number) => void, private glows: Glow[], on = true) {
    scene.add(this.group);
    scene.fog = new THREE.Fog(FOG.color, FOG.near, FOG.far);
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04);
    room.dispose(); pmrem.dispose();
    scene.environment = this.env.texture;
    this.q = quality;
    this.on = on;
    this.level.fill(on ? 1 : 0);
    this.set(quality);
  }

  /** The mean of the tubes' light, 0..1. */
  get lit(): number { let s = 0; for (const v of this.level) s += v; return s / TUBES; }
  /** The exposure for the light there is now. */
  get exposure(): number { return EXPOSE.dark + (EXPOSE.lit - EXPOSE.dark) * this.lit; }

  set(q: Quality): void {
    this.q = q;
    for (const c of [...this.group.children]) { this.group.remove(c); (c as THREE.Light).dispose?.(); }
    const r = this.renderer, add = <T extends THREE.Object3D>(l: T) => { this.group.add(l); return l; };
    r.shadowMap.enabled = q === "high";
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    // Static: the light and nearly everything that casts stand still, so the map is drawn once (here and when the
    // lab is shown) instead of every frame; the reels' and clock hands' own shadows are too small to miss.
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    this.hemi = add(new THREE.HemisphereLight(0xf4f6ff, 0x8d8a80, 1));
    // Overhead key: soft-shadowed at high, from a little south so the machine fronts catch it.
    const key = this.key = add(new THREE.DirectionalLight(COOL, 1));
    key.position.set(0.6, ROOM.h + 3, 2.2); key.target.position.set(0, 0, -0.4);
    if (q === "high") {
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      Object.assign(key.shadow.camera, { left: -ROOM.w / 2 - 0.5, right: ROOM.w / 2 + 0.5, top: ROOM.d / 2 + 1, bottom: -ROOM.d / 2 - 1, near: 0.5, far: 12 });
      key.shadow.camera.updateProjectionMatrix();
      key.shadow.radius = 5; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    }
    add(key.target);
    this.rows = [];
    if (q === "high") {
      if (!ltcReady) { RectAreaLightUniformsLib.init(); ltcReady = true; }
      const len = TROFFERS.xs[TROFFERS.xs.length - 1] - TROFFERS.xs[0] + TROFFERS.len;
      for (const z of TROFFERS.rows) {
        const a = add(new THREE.RectAreaLight(COOL, 1, len, TROFFERS.wid));
        a.position.set(0, ROOM.h - 0.03, z); a.lookAt(0, 0, z);
        this.rows.push(a);
      }
    }
    // Warm accents by the CPU lamp panel and the operator console (the modules' lamps glow; this lets them colour
    // the floor and the cabinets near them).
    for (const [x, y, z, i] of [[-3.0, 1.5, 0, 0.45], [-1.2, 1.1, -0.45, 0.35]]) {
      const p = new THREE.PointLight(WARM, i, 2.6, 2); p.position.set(x, y, z); add(p);
    }
    this.glowLights = this.lit < 0.999;
    if (this.glowLights) for (const g of this.glows) { const p = add(new THREE.PointLight(g.color, g.intensity, g.distance, 2)); p.position.copy(g.pos); }
    this.apply();
    this.scene.traverse(o => { const m = (o as THREE.Mesh).material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.needsUpdate = true; }); });
  }

  /** Switch the troffers. Off is at once; on strikes each tube in turn, unless `instant`. */
  switch(on: boolean, instant = false): void {
    this.on = on;
    if (!on || instant) {
      this.strikes = null; this.level.fill(on ? 1 : 0);
      if ((this.lit < 0.999) !== this.glowLights) this.set(this.q); else this.apply();
      return;
    }
    // Each tube strikes after a short delay, two of them late; it flickers for a moment, then warms up over a second.
    const r = Math.random, late = new Set([r() * TUBES | 0, r() * TUBES | 0]);
    this.t = 0;
    this.strikes = Array.from({ length: TUBES }, (_, k) => ({ at: 0.05 + r() * 0.5 + (late.has(k) ? 1 + r() * 0.8 : 0), len: 0.25 + r() * 0.35, slot: -1, v: 0 }));
  }

  /** Step the strike; true while it runs. */
  update(dt: number): boolean {
    const S = this.strikes;
    if (!S) return false;
    this.t += dt;
    let done = true;
    S.forEach((s, k) => {
      const u = this.t - s.at;
      if (u < 0) { this.level[k] = 0; done = false; return; }
      if (u < s.len) {   // flicker: a new level every 50 ms or so
        const slot = Math.floor(u / 0.05);
        if (slot !== s.slot) { s.slot = slot; s.v = [0, 0.15, 0.9, 0.5][Math.random() * 4 | 0]; }
        this.level[k] = s.v; done = false; return;
      }
      const w = Math.min(1, (u - s.len) / 1.2);
      this.level[k] = 0.75 + 0.25 * w;
      if (w < 1) done = false;
    });
    if (done) { this.strikes = null; this.level.fill(1); this.set(this.q); return false; }
    this.apply();
    return true;
  }

  /** The lights for the tubes' levels: the diffusers, the rows' area lights, the key and the fill. */
  private apply(): void {
    const L = this.lit, high = this.q === "high", lv = this.level;
    this.tubes(k => lv[k]);
    const nx = TROFFERS.xs.length;
    this.rows.forEach((a, i) => { let s = 0; for (let j = 0; j < nx; j++) s += lv[i * nx + j]; a.intensity = 5.5 * s / nx; });
    this.key.intensity = (high ? 0.7 : 1.4) * L;
    this.hemi.intensity = high ? 0.04 + 0.51 * L : 0.1 + 1.15 * L;
    this.hemi.color.set(NIGHT).lerp(new THREE.Color(0xf4f6ff), L);
    this.scene.environmentIntensity = (high ? 0.22 : 0.35) * (0.12 + 0.88 * L);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.scene.environment = null; this.scene.fog = null;
    this.env?.dispose(); this.env = null;
  }
}
