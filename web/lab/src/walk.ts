// Walking the room (ours): the viewer stands at eye height and moves with WASD or the arrow keys (Shift walks
// faster), turns (lab.ts: the locked mouse or a drag), steps with the wheel, and collides with the walls and every floor-standing machine's
// footprint (a circle against rectangles: pushed out along the shallower side, so it slides along them). Near a
// terminal that opens a tab, in front of its screen and facing it, E/Enter flies in, and so does a short dwell when
// walk-up (`auto`) is on: an option, off by default and remembered with the room's preferences (lab.ts; #20). A
// terminal re-arms only once the viewer has stepped back out of a slightly larger zone, so leaving one does not pull
// back in. Something used in place (the light switch, the drive) has the same zone but no dwell: E uses it.
import * as THREE from "three";
import type { Footprint } from "./types";

const SPEED = 1.4, FAST = 2.6;        // m/s
const EASE_S = 0.18;                  // time constant of the walk's acceleration
export const RADIUS = 0.25;                  // the viewer's body on the floor, m
const PITCH_MAX = 35;                 // deg
const STRIDE = 0.77;                  // m per step: a step every 0.55 s at walking speed
const ZONE = { r: 1.3, rearm: 1.7, face: 35, dwell: 0.4 };   // m, m, deg, s
const D2R = Math.PI / 180;
const MOVE: Record<string, [number, number]> = {
  w: [1, 0], arrowup: [1, 0], s: [-1, 0], arrowdown: [-1, 0], a: [0, -1], arrowleft: [0, -1], d: [0, 1], arrowright: [0, 1],
};

/** A terminal the walk can enter (or, with `use`, use in place): its screen's centre and its facing (horizontal unit
 *  normal) in the room. */
export interface Terminal { name: string; screen: THREE.Vector3; normal: THREE.Vector2; use?: boolean }

export class Walk {
  readonly pos = new THREE.Vector2();
  yaw = 0;
  pitch = 0;
  /** The terminal in range (in front, facing it, armed), else null. */
  near: Terminal | null = null;
  private vel = new THREE.Vector2();
  private keys = new Set<string>();
  private fast = false;
  private stride = STRIDE * 0.6;
  private dwell = 0;
  private armed = new Map<string, boolean>();

  /** Walk-up auto-entry: the dwell in a terminal's zone flies in. */
  auto: boolean;

  constructor(private footprints: Footprint[], private half: { x: number; z: number }, readonly terminals: Terminal[], auto: boolean,
    private on: { step(fast: boolean): void; enter(name: string): void; use(name: string): void }) { this.auto = auto; }

  /** Stand where the camera is, looking where it looks. */
  setFrom(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    const e = new THREE.Euler().setFromQuaternion(quaternion, "YXZ");
    this.pos.set(position.x, position.z); this.yaw = e.y; this.pitch = THREE.MathUtils.clamp(e.x, -PITCH_MAX * D2R, PITCH_MAX * D2R);
    this.vel.set(0, 0); this.dwell = 0;
  }

  /** The camera's orientation for the walk's yaw and pitch. */
  quaternion(q: THREE.Quaternion): THREE.Quaternion { return q.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ")); }

  /** Turn by a drag: yaw free, pitch held to +-PITCH_MAX. Radians. */
  turn(dyaw: number, dpitch: number): void {
    this.yaw += dyaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dpitch, -PITCH_MAX * D2R, PITCH_MAX * D2R);
  }

  /** A key down or up; true when it is one of the walk's. */
  key(key: string, down: boolean, shift: boolean): boolean {
    const k = key.toLowerCase();
    this.fast = shift;
    if (!MOVE[k]) return false;
    if (down) this.keys.add(k); else this.keys.delete(k);
    return true;
  }

  clearKeys(): void { this.keys.clear(); this.vel.set(0, 0); }

  get moving(): boolean { return this.keys.size > 0 || this.vel.lengthSq() > 1e-4; }

  /** Step `m` metres along the view (the wheel, a pinch), colliding. */
  nudge(m: number): void {
    const p = this.pos.clone().add(new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw)).multiplyScalar(m));
    this.pos.copy(this.collide(p));
  }

  /** Not re-entered until the viewer leaves its re-arm zone. */
  disarm(name: string): void { this.armed.set(name, false); this.dwell = 0; this.near = null; }

  /** E or Enter: fly into the terminal in range, or use it. */
  enter(): boolean {
    const t = this.near;
    if (!t) return false;
    if (t.use) { this.on.use(t.name); return true; }
    this.disarm(t.name); this.on.enter(t.name);
    return true;
  }

  update(dt: number): void {
    let f = 0, s = 0;
    for (const k of this.keys) { f += MOVE[k][0]; s += MOVE[k][1]; }
    const fwd = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw)), right = new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw));
    const want = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(this.fast ? FAST : SPEED);
    this.vel.lerp(want, 1 - Math.exp(-dt / EASE_S));
    if (want.lengthSq() === 0 && this.vel.lengthSq() < 1e-4) this.vel.set(0, 0);
    if (this.vel.lengthSq() > 0) {
      const to = this.collide(this.pos.clone().addScaledVector(this.vel, dt)), d = to.distanceTo(this.pos);
      this.pos.copy(to);
      if (dt > 0 && d / dt > 0.3) {   // footsteps only while actually getting somewhere
        this.stride += d;
        if (this.stride >= STRIDE) { this.stride -= STRIDE; this.on.step(this.fast); }
      } else this.stride = STRIDE * 0.6;   // from a standstill the first step comes soon
    }
    this.proximity(dt);
  }

  /** Inside the room and outside every footprint, sliding along what it meets. */
  collide(p: THREE.Vector2): THREE.Vector2 {
    for (let it = 0; it < 3; it++) {
      for (const f of this.footprints) {
        const c = Math.cos(f.turn), s = Math.sin(f.turn), dx = p.x - f.x, dz = p.y - f.z;
        const u = dx * c - dz * s, v = dx * s + dz * c, eu = f.hw + RADIUS - Math.abs(u), ev = f.hd + RADIUS - Math.abs(v);
        if (eu <= 0 || ev <= 0) continue;
        let nu = u, nv = v;
        if (eu < ev) nu = Math.sign(u || 1) * (f.hw + RADIUS); else nv = Math.sign(v || 1) * (f.hd + RADIUS);
        p.set(f.x + nu * c + nv * s, f.z - nu * s + nv * c);
      }
      p.x = THREE.MathUtils.clamp(p.x, -this.half.x + RADIUS, this.half.x - RADIUS);
      p.y = THREE.MathUtils.clamp(p.y, -this.half.z + RADIUS, this.half.z - RADIUS);
    }
    return p;
  }

  private proximity(dt: number): void {
    const look = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    let near: Terminal | null = null;
    for (const t of this.terminals) {
      const to = new THREE.Vector2(t.screen.x - this.pos.x, t.screen.z - this.pos.y), d = to.length();
      if (d > ZONE.rearm) this.armed.set(t.name, true);
      if (this.armed.get(t.name) === false || d > ZONE.r || -to.dot(t.normal) <= 0) continue;
      if (look.dot(to.normalize()) < Math.cos(ZONE.face * D2R)) continue;
      near = t;
    }
    if (near !== this.near) this.dwell = 0;
    this.near = near;
    if (near && !near.use && this.auto && (this.dwell += dt) >= ZONE.dwell) this.enter();
  }

  /** Where to stand after leaving a terminal: `back` metres out from its screen, outside its re-arm zone. */
  standBack(t: Terminal, back = ZONE.rearm + 0.3): THREE.Vector2 {
    return this.collide(this.standBackRaw(t, back));
  }

  /** The same spot before collide() moves it out of anything it landed in: the layout should leave it free (#117). */
  standBackRaw(t: Terminal, back = ZONE.rearm + 0.3): THREE.Vector2 {
    return new THREE.Vector2(t.screen.x, t.screen.z).addScaledVector(t.normal, back);
  }
}
