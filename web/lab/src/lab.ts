// The lab: renderer, quality tier, camera (free look at the overview, flights to the terminals), hover and picking,
// and the handover to the page. It renders only while shown; the page decides when that is (web/src/room.js).
//
// Handover: a flight into a terminal that opens a tab ends where the terminal's screen covers, on the lab canvas,
// the rect the page's element will occupy (hooks.screenRect: #cv for the workbench, the Source workspace for
// source), with the camera square to the screen. The page then crossfades from the lab to itself. Back out, the
// lab starts at that pose under the page, fades in, holds, then flies to the overview.
import * as THREE from "three";
import { build as buildRoom } from "./room/room";
import { Lighting } from "./room/lighting";
import { Dust } from "./room/dust";
import { EXPOSURE, Post, markScreens } from "./post";
import type { CameraPose, LabEvent, LabHooks, Placed, Quality, Room } from "./types";

const FLY_S = 1.0;
const ARC_M = 0.12;                 // the flight's rise at its middle, metres per 2 m flown (at most one unit)
const YAW_MAX = 60, PITCH_MAX = 20; // free look about the overview, deg
const DOLLY_IN = 2.2, DOLLY_OUT = 0.4;
const PARALLAX = { x: 0.06, y: 0.035 };
const CLICK_PX = 5;
// Auto quality: the median frame time over the first frames shown (after `skip`; `frames` of them, or as many as
// fit in `budget` ms on a slow machine) above `ms` drops to low. A software rasteriser starts low.
const PROBE = { skip: 4, frames: 24, budget: 1500, ms: 24 };
const QKEY = "view1108.labq";
const ease = (t: number) => t * t * (3 - 2 * t);
const D2R = Math.PI / 180;

/** A camera state: position, orientation, vertical field of view (deg), and how much bloom it wants (0..1). */
interface Shot { position: THREE.Vector3; quaternion: THREE.Quaternion; fov: number; glow: number }
interface Flight { from: Shot; to: Shot; t0: number; delay: number; done?: () => void }
type Mode = "free" | "flight" | "hold";

function shotOf(p: CameraPose, glow = 1): Shot {
  const m = new THREE.Matrix4().lookAt(p.position, p.target, new THREE.Vector3(0, 1, 0));
  return { position: p.position.clone(), quaternion: new THREE.Quaternion().setFromRotationMatrix(m), fov: p.fov, glow };
}

export class Lab {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.05, 40);
  private room: Room;
  private lighting: Lighting;
  private post: Post | null = null;
  private dust: Dust | null = null;
  private vectorTex: THREE.CanvasTexture;
  private quality: Quality = "high";
  private qForced: Quality | null = null;
  private probe: number[] | null = null;
  private home: Shot;
  private mode: Mode = "free";
  private flight: Flight | null = null;
  private glow = 1;
  private look = { yaw: 0, pitch: 0, dolly: 0, px: 0, py: 0, tx: 0, ty: 0 };
  private drag: { id: number; x: number; y: number; yaw: number; pitch: number; t: number; moved: boolean } | null = null;
  private pinch = new Map<number, { x: number; y: number }>();
  private pinchD = 0;
  private hover: Placed | null = null;
  private pointer: { x: number; y: number } | null = null;
  private lifted = new Map<THREE.Mesh, [THREE.Material, THREE.Material]>();
  private labelEl: HTMLDivElement;
  private qualEl: HTMLButtonElement;
  private raf = 0;
  private last = 0;
  private frameNo = -1;
  private shown = false;
  private ro: ResizeObserver;
  private ray = new THREE.Raycaster();
  private size = { w: 1, h: 1 };
  /** The last handover: the screen's projected rect against the page's, CSS px. */
  mismatch: { name: string; dx0: number; dy0: number; dx1: number; dy1: number } | null = null;
  stats = { calls: 0, triangles: 0 };

  constructor(private host: HTMLElement, private hooks: LabHooks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });   // throws without WebGL; start() reports that
    this.renderer.info.autoReset = false;
    const c = this.renderer.domElement;
    c.style.display = "block"; c.style.touchAction = "none";
    host.appendChild(c);
    this.scene.background = new THREE.Color(0x0b0c0b);
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    this.vectorTex = new THREE.CanvasTexture(hooks.screens.vector);
    this.vectorTex.colorSpace = THREE.SRGBColorSpace;
    this.vectorTex.anisotropy = aniso;
    this.room = buildRoom({ vectorScreen: this.vectorTex, maxAnisotropy: aniso });
    this.scene.add(this.room.object);
    markScreens(this.room.object);
    this.room.object.updateMatrixWorld(true);
    if (this.room.air) { this.dust = new Dust({ box: this.room.air, count: 420, size: 0.006, opacity: 0.22 }); this.scene.add(this.dust.object); }
    this.home = shotOf(this.room.overview);

    const q = new URLSearchParams(location.search).get("labq");
    let stored: string | null = null;
    try { stored = localStorage.getItem(QKEY); } catch { /* storage unavailable */ }
    this.qForced = q === "low" || q === "high" ? q : stored === "low" || stored === "high" ? stored : null;
    const gl = this.renderer.getContext(), dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const soft = /swiftshader|llvmpipe|software/i.test(String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
    this.quality = this.qForced ?? (soft ? "low" : "high");
    this.lighting = new Lighting(this.renderer, this.scene, this.quality);

    this.labelEl = document.createElement("div");
    this.labelEl.style.cssText = "position:absolute;pointer-events:none;display:none;padding:2px 7px;font:12px/1.4 ui-monospace,monospace;color:#d6f5dc;background:rgba(4,10,6,.82);border:1px solid #3d5c45;border-radius:3px;white-space:nowrap;z-index:2";
    this.qualEl = document.createElement("button");
    this.qualEl.style.cssText = "position:absolute;right:10px;bottom:10px;z-index:2;padding:2px 8px;font:11px ui-monospace,monospace;color:#9fb8a5;background:rgba(4,10,6,.7);border:1px solid #2e4434;border-radius:3px;cursor:pointer";
    this.qualEl.onclick = () => this.setQuality(this.quality === "high" ? "low" : "high", true);
    host.append(this.labelEl, this.qualEl);
    this.applyQuality();

    this.setShot(this.home);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onUp);
    c.addEventListener("pointerleave", this.onLeave);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKey);
  }

  /** Show the room. With `from`, the camera starts at that terminal: with `rect` (the page element's client rect)
   *  at the pose where the screen covers it, held `holdMs` while the page fades the lab in; then it flies out. */
  show(from?: string, rect?: DOMRect | null, holdMs = 0): void {
    this.shown = true;
    this.resize();
    this.flight = null; this.clearHover();
    const s = from ? (rect && this.matchShot(from, rect)) || this.anchorShot(from) : null;
    if (s) {
      this.setShot(s); this.mode = "hold";
      this.fly(this.home, holdMs);
    } else { this.resetLook(); this.setShot(this.home); this.mode = "free"; }
    this.draw();
    this.probe = this.qForced ? null : [];
    if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tick); }
  }

  /** Stop rendering; the canvas keeps its last picture. */
  hide(): void {
    this.shown = false; this.flight = null; this.clearHover();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Fly to a placed equipment (null: the overview). A terminal that opens a tab ends at the handover pose and
   *  calls hooks.arrive. */
  setTarget(name: string | null): boolean {
    this.clearHover();
    if (name === null) { this.resetLook(); this.fly(this.home); return true; }
    const p = this.room.placed.find(q => q.name === name);
    if (!p) return false;
    const opens = p.equipment.opens;
    const rect = opens ? this.hooks.screenRect?.(opens) ?? null : null;
    const s = (rect && this.matchShot(name, rect)) || this.anchorShot(name);
    if (!s) return false;
    this.fly(s, 0, () => {
      this.mode = "hold";
      if (opens) this.hooks.arrive(opens);
    });
    return true;
  }

  event(e: LabEvent): void {
    const s = this.hooks.state();
    for (const p of this.room.placed) p.equipment.event?.(e, s);
  }

  /** Where a placed equipment's screen (else its origin) is on the page, client px; for tests. */
  project(name: string): { x: number; y: number } | null {
    const p = this.room.placed.find(q => q.name === name);
    if (!p) return null;
    const o = p.equipment.anchors.screen?.mesh ?? p.equipment.object;
    const v = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  get info() { return { quality: this.quality, forced: this.qForced, mode: this.mode, ...this.stats, mismatch: this.mismatch }; }

  dispose(): void {
    this.hide();
    this.ro.disconnect();
    window.removeEventListener("keydown", this.onKey);
    for (const p of this.room.placed) p.equipment.dispose?.();
    this.room.dispose?.();
    for (const [, [, lift]] of this.lifted) lift.dispose();
    this.dust?.dispose();
    this.post?.dispose();
    this.lighting.dispose();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()); } });
    this.vectorTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.labelEl.remove(); this.qualEl.remove();
  }

  // ---- frame ----

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    if (this.probe && this.last) this.sample(now - this.last);
    this.last = now;
    const s = this.hooks.state();
    if (s.frameNo !== this.frameNo) { this.frameNo = s.frameNo; this.vectorTex.needsUpdate = true; }
    for (const p of this.room.placed) p.equipment.update?.(dt, s);
    this.room.update?.(dt, s);
    this.dust?.update(dt);
    let landed: (() => void) | undefined;
    if (this.flight) landed = this.stepFlight(now);
    else if (this.mode === "free") this.freeLook(dt);
    if (this.pointer && this.mode === "free" && !this.drag) this.pick(this.pointer.x, this.pointer.y, false);
    if (this.shown) this.draw();
    landed?.();   // after the final frame is drawn: the page crossfades from it
  };

  private draw(): void {
    this.renderer.info.reset();
    if (this.post) { this.post.glow = this.glow; this.post.render(); }
    else this.renderer.render(this.scene, this.camera);
    this.stats.calls = this.renderer.info.render.calls;
    this.stats.triangles = this.renderer.info.render.triangles;
  }

  // ---- quality ----

  private sample(ms: number): void {
    const p = this.probe!;
    p.push(ms);
    const s = p.slice(PROBE.skip);
    if (s.length < PROBE.frames && s.reduce((a, b) => a + b, 0) < PROBE.budget) return;
    const m = s.sort((a, b) => a - b)[s.length >> 1];
    this.probe = null;
    if (m > PROBE.ms && this.quality === "high") this.setQuality("low", false);
  }

  private setQuality(q: Quality, remember: boolean): void {
    if (remember) { this.qForced = q; this.probe = null; try { localStorage.setItem(QKEY, q); } catch { /* ignore */ } }
    if (q === this.quality) { this.applyQuality(); return; }
    this.quality = q;
    this.lighting.set(q);
    this.applyQuality();
    if (this.shown) this.draw();
  }

  private applyQuality(): void {
    const high = this.quality === "high", r = this.renderer;
    r.setPixelRatio(Math.min(high ? 2 : 1.25, window.devicePixelRatio || 1));
    r.toneMapping = high ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;   // high: the post chain's tone pass
    r.toneMappingExposure = EXPOSURE;
    this.post?.dispose(); this.post = null;
    r.setSize(this.size.w, this.size.h, false);
    if (high) this.post = new Post(r, this.scene, this.camera);
    this.qualEl.textContent = `${high ? "HIGH" : "LOW"}${this.qForced ? "" : " (auto)"}`;
    this.qualEl.title = "Rendering quality: click to switch (remembered; ?labq=low|high for one visit)";
  }

  // ---- camera ----

  private setShot(s: Shot): void {
    this.camera.position.copy(s.position); this.camera.quaternion.copy(s.quaternion);
    this.camera.fov = s.fov; this.glow = s.glow;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }

  private current(): Shot {
    return { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(), fov: this.camera.fov, glow: this.glow };
  }

  private fly(to: Shot, delay = 0, done?: () => void): void {
    this.mode = "flight";
    this.flight = { from: this.current(), to, t0: performance.now(), delay, done };
  }

  /** One step of the flight (wall clock: a slow GPU skips, never drags). Returns the arrival action when it lands. */
  private stepFlight(now: number): (() => void) | undefined {
    const f = this.flight!, t = Math.min(1, Math.max(0, (now - f.t0 - f.delay) / 1000 / FLY_S)), k = ease(t);
    const d = f.from.position.distanceTo(f.to.position);
    this.camera.position.lerpVectors(f.from.position, f.to.position, k);
    this.camera.position.y += Math.sin(Math.PI * k) * ARC_M * Math.min(1, d / 2);
    this.camera.quaternion.slerpQuaternions(f.from.quaternion, f.to.quaternion, k);
    this.camera.fov = f.from.fov + (f.to.fov - f.from.fov) * k;
    this.glow = f.from.glow + (f.to.glow - f.from.glow) * k;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    if (t < 1) return undefined;
    this.flight = null;
    this.mode = f.to === this.home ? "free" : "hold";
    if (this.mode === "free") { this.look.px = this.look.py = 0; }
    return f.done ?? (() => {});
  }

  private resetLook(): void { Object.assign(this.look, { yaw: 0, pitch: 0, dolly: 0, px: 0, py: 0 }); }

  /** The overview turned by the viewer's yaw and pitch, dollied, and shifted a little after the pointer. */
  private freeLook(dt: number): void {
    const L = this.look, k = 1 - Math.exp(-dt * 4);
    L.px += (L.tx - L.px) * k; L.py += (L.ty - L.py) * k;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), L.yaw * D2R).multiply(this.home.quaternion)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), L.pitch * D2R));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    this.camera.quaternion.copy(q);
    this.camera.position.copy(this.home.position).addScaledVector(fwd, L.dolly).addScaledVector(right, L.px * PARALLAX.x);
    this.camera.position.y += L.py * PARALLAX.y;
    this.camera.fov = this.home.fov;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }

  /** A placed equipment's own zoom-in pose (anchors.camera) in room coordinates. */
  private anchorShot(name: string): Shot | null {
    const p = this.room.placed.find(q => q.name === name), c = p?.equipment.anchors.camera;
    if (!p || !c) return null;
    const m = p.equipment.object.matrixWorld;
    return shotOf({ position: c.position.clone().applyMatrix4(m), target: c.target.clone().applyMatrix4(m), fov: c.fov }, 0);
  }

  /** The pose square to the equipment's screen at which the picture's part of it (uvRect; the screen mesh a plane
   *  in its local XY facing +Z, UVs running across its bounds) covers `rect` on the lab canvas. Matched on height,
   *  or on width where that is the larger, so the screen covers the rect; centred on it. */
  private matchShot(name: string, rect: DOMRect): Shot | null {
    const p = this.room.placed.find(q => q.name === name), sc = p?.equipment.anchors.screen;
    if (!p || !sc || rect.width < 2 || rect.height < 2) return null;
    const cr = this.renderer.domElement.getBoundingClientRect();
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
    const d = Math.min(h * cr.height / (2 * tn * rect.height), w * cr.height / (2 * tn * rect.width));
    const k = 2 * d * tn / cr.height;   // metres per CSS px at the screen
    const ox = rect.left + rect.width / 2 - (cr.left + cr.width / 2), oy = (cr.top + cr.height / 2) - (rect.top + rect.height / 2);
    const position = C.clone().addScaledVector(Nn, d).addScaledVector(R, -ox * k).addScaledVector(U, -oy * k);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, U, Nn));
    // Check: project the picture's corners from there.
    const cam = this.camera.clone(); cam.position.copy(position); cam.quaternion.copy(quaternion); cam.fov = fov;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const px = (v: THREE.Vector3) => { const s = v.clone().project(cam); return { x: cr.left + (s.x + 1) / 2 * cr.width, y: cr.top + (1 - s.y) / 2 * cr.height }; };
    const a = px(p01), c = px(p10);
    this.mismatch = { name, dx0: a.x - rect.left, dy0: a.y - rect.top, dx1: c.x - rect.right, dy1: c.y - rect.bottom };
    return { position, quaternion, fov, glow: 0 };
  }

  // ---- input ----

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) { const [a, b] = [...this.pinch.values()]; this.pinchD = Math.hypot(a.x - b.x, a.y - b.y); this.drag = null; return; }
    }
    if (e.button !== 0) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: this.look.yaw, pitch: this.look.pitch, t: performance.now(), moved: false };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.look.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.look.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
    this.pointer = { x: e.clientX, y: e.clientY };
    if (this.pinch.has(e.pointerId)) {
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) {
        const [a, b] = [...this.pinch.values()], dd = Math.hypot(a.x - b.x, a.y - b.y);
        this.dollyBy((dd - this.pinchD) * 0.006); this.pinchD = dd;
        return;
      }
    }
    const g = this.drag;
    if (!g || g.id !== e.pointerId || this.mode !== "free") return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < CLICK_PX) return;
    if (!g.moved) { g.moved = true; this.clearHover(); }
    const degPx = this.camera.fov / r.height;   // the scene follows the pointer
    this.look.yaw = THREE.MathUtils.clamp(g.yaw + dx * degPx, -YAW_MAX, YAW_MAX);
    this.look.pitch = THREE.MathUtils.clamp(g.pitch + dy * degPx, -PITCH_MAX, PITCH_MAX);
  };

  private onUp = (e: PointerEvent) => {
    this.pinch.delete(e.pointerId);
    const g = this.drag;
    if (!g || g.id !== e.pointerId) return;
    this.drag = null;
    if (!g.moved && e.type === "pointerup") this.pick(e.clientX, e.clientY, true);
  };

  private onLeave = () => { this.pointer = null; this.look.tx = this.look.ty = 0; this.clearHover(); };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.mode === "free") this.dollyBy(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
  };

  private onKey = (e: KeyboardEvent) => {
    if (!this.shown || e.key !== "Escape" || this.mode !== "free") return;
    const L = this.look;
    if (L.yaw || L.pitch || L.dolly) { e.preventDefault(); this.setTarget(null); }
  };

  private dollyBy(m: number): void { this.look.dolly = THREE.MathUtils.clamp(this.look.dolly + m, -DOLLY_OUT, DOLLY_IN); }

  // ---- hover and picking ----

  /** The placed equipment under (x, y) that opens something, if any. */
  private hit(x: number, y: number): Placed | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
    for (const h of this.ray.intersectObject(this.room.object, true)) {
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.placed === undefined) o = o.parent;
      if (!o) continue;   // the shell
      const p = this.room.placed.find(q => q.name === o!.userData.placed);
      return p && p.equipment.opens ? p : null;
    }
    return null;
  }

  private pick(x: number, y: number, click: boolean): void {
    if (this.mode !== "free") return;
    const p = this.hit(x, y);
    this.renderer.domElement.style.cursor = p ? "pointer" : "";
    if (click) { if (p) this.setTarget(p.name); return; }
    if (p !== this.hover) { this.clearHover(); if (p) this.lift(p, true); this.hover = p; }
    const label = p && this.room.labels?.[p.name];
    if (label) {
      const hr = this.host.getBoundingClientRect();
      this.labelEl.textContent = label;
      this.labelEl.style.left = `${x - hr.left + 14}px`; this.labelEl.style.top = `${y - hr.top + 16}px`;
      this.labelEl.style.display = "block";
    } else this.labelEl.style.display = "none";
  }

  private clearHover(): void {
    if (this.hover) this.lift(this.hover, false);
    this.hover = null; this.labelEl.style.display = "none";
    this.renderer.domElement.style.cursor = "";
  }

  /** Hover highlight: a slight emissive lift on the equipment's lit surfaces (clones, so shared materials stay). */
  private lift(p: Placed, on: boolean): void {
    p.equipment.object.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      let pair = this.lifted.get(m);
      if (!pair) {
        const base = m.material as THREE.Material;
        if (Array.isArray(m.material) || !(base as THREE.MeshStandardMaterial).isMeshStandardMaterial) return;
        const up = base.clone() as THREE.MeshStandardMaterial;
        up.emissive = (base as THREE.MeshStandardMaterial).emissive.clone().add(new THREE.Color(0x1c2a20));
        pair = [base, up]; this.lifted.set(m, pair);
      }
      m.material = on ? pair[1] : pair[0];
    });
  }

  private resize(): void {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.post?.setSize(w, h);
    this.renderer.domElement.style.width = w + "px"; this.renderer.domElement.style.height = h + "px";
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.shown && !this.raf) this.draw();
  }
}

