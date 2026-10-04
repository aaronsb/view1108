// The lab: renderer, camera, the room, picking and the camera's flights between the overview and the terminals.
// It renders only while shown; the page decides when that is (web/src/room.js).
import * as THREE from "three";
import { build as buildRoom } from "./room/room";
import type { CameraPose, LabEvent, LabHooks, Placed, Room } from "./types";

const FLY_S = 0.8;
const ease = (t: number) => t * t * (3 - 2 * t);

interface Flight { from: CameraPose; to: CameraPose; t0: number; done?: () => void }

export class Lab {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.05, 50);
  private look = new THREE.Vector3();
  private room: Room;
  private vectorTex: THREE.CanvasTexture;
  private flight: Flight | null = null;
  private raf = 0;
  private last = 0;
  private frameNo = -1;
  private shown = false;
  private ro: ResizeObserver;
  private ray = new THREE.Raycaster();
  private onClick = (e: PointerEvent) => this.pick(e, true);
  private onMove = (e: PointerEvent) => this.pick(e, false);

  constructor(private host: HTMLElement, private hooks: LabHooks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });   // throws without WebGL; start() reports that
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.domElement.style.display = "block";
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x0b0c0b);
    this.vectorTex = new THREE.CanvasTexture(hooks.screens.vector);
    this.vectorTex.colorSpace = THREE.SRGBColorSpace;
    this.vectorTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.room = buildRoom({ vectorScreen: this.vectorTex, maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy() });
    this.scene.add(this.room.object);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x302820, 1.2));
    const lamp = new THREE.PointLight(0xfff1d8, 18, 12); lamp.position.set(0.5, 2.8, 0.5);
    this.scene.add(lamp);
    this.room.object.updateMatrixWorld(true);
    this.setPose(this.room.overview);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    const c = this.renderer.domElement;
    c.addEventListener("click", this.onClick as EventListener);
    c.addEventListener("pointermove", this.onMove);
  }

  /** Show the room. With `from`, the camera starts at that terminal and flies back to the overview. */
  show(from?: string): void {
    this.shown = true;
    const p = from ? this.poseOf(from) : null;
    if (p) { this.setPose(p); this.fly(this.room.overview); } else this.setPose(this.room.overview);
    if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tick); }
  }

  /** Stop rendering; the canvas keeps its last picture. */
  hide(): void {
    this.shown = false; this.flight = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Fly to a placed equipment's zoom-in pose (null: the overview); on arrival a terminal opens its tab. */
  setTarget(name: string | null): boolean {
    if (name === null) { this.fly(this.room.overview); return true; }
    const p = this.room.placed.find(q => q.name === name);
    const pose = p && this.poseOf(name);
    if (!p || !pose) return false;
    this.fly(pose, () => { if (p.equipment.opens) this.hooks.arrive(p.equipment.opens); });
    return true;
  }

  event(e: LabEvent): void {
    const s = this.hooks.state();
    for (const p of this.room.placed) p.equipment.event?.(e, s);
  }

  dispose(): void {
    this.hide();
    this.ro.disconnect();
    for (const p of this.room.placed) p.equipment.dispose?.();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()); } });
    this.vectorTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0; this.last = now;
    const s = this.hooks.state();
    if (s.frameNo !== this.frameNo) { this.frameNo = s.frameNo; this.vectorTex.needsUpdate = true; }
    for (const p of this.room.placed) p.equipment.update?.(dt, s);
    if (this.flight) {
      const f = this.flight, t = Math.min(1, (now - f.t0) / 1000 / FLY_S), k = ease(t);   // wall clock: a slow GPU skips, never drags
      this.camera.position.lerpVectors(f.from.position, f.to.position, k);
      this.look.lerpVectors(f.from.target, f.to.target, k);
      this.camera.fov = f.from.fov + (f.to.fov - f.from.fov) * k;
      this.camera.lookAt(this.look); this.camera.updateProjectionMatrix();
      if (t >= 1) { this.flight = null; f.done?.(); }
    }
    if (this.shown) this.renderer.render(this.scene, this.camera);
  };

  private fly(to: CameraPose, done?: () => void): void {
    this.flight = { from: { position: this.camera.position.clone(), target: this.look.clone(), fov: this.camera.fov }, to, t0: performance.now(), done };
  }

  private setPose(p: CameraPose): void {
    this.camera.position.copy(p.position); this.look.copy(p.target); this.camera.fov = p.fov;
    this.camera.lookAt(this.look); this.camera.updateProjectionMatrix();
  }

  /** A placed equipment's zoom-in pose in room coordinates. */
  private poseOf(name: string): CameraPose | null {
    const p = this.room.placed.find(q => q.name === name), c = p?.equipment.anchors.camera;
    if (!p || !c) return null;
    const m = p.equipment.object.matrixWorld;
    return { position: c.position.clone().applyMatrix4(m), target: c.target.clone().applyMatrix4(m), fov: c.fov };
  }

  /** The placed equipment under the pointer that opens something, if any. */
  private hit(e: PointerEvent): Placed | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    for (const h of this.ray.intersectObject(this.room.object, true)) {
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.placed === undefined) o = o.parent;
      const p = o && this.room.placed.find(q => q.name === o!.userData.placed);
      if (p) return p.equipment.opens && p.equipment.anchors.camera ? p : null;
    }
    return null;
  }

  private pick(e: PointerEvent, click: boolean): void {
    if (this.flight) return;
    const p = this.hit(e);
    this.renderer.domElement.style.cursor = p ? "pointer" : "";
    if (click && p) this.setTarget(p.name);
  }

  private resize(): void {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + "px"; this.renderer.domElement.style.height = h + "px";
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.shown && !this.raf) this.renderer.render(this.scene, this.camera);
  }
}
