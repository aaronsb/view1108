// The lab: renderer, quality tier, camera (walking the room from the overview, walk.ts; flights to the terminals),
// hover and picking, and the handover to the page. It renders only while shown; the page decides when that is
// (web/src/room.js). While it is shown the keys are the walk's: a capture listener keeps them from the page.
//
// Looking, as in a first-person game (ours): a mouse click on the room away from a machine locks the pointer; the
// mouse then turns the view, a crosshair marks the centre, what is under it is the hover target, and a click, E or
// Enter uses it. Esc (taken by the browser) only releases the lock. A click on a machine while unlocked uses it as
// before, so the room still works point-and-click; touch, pen, and a browser that refuses the lock drag to look.
//
// Arrival: a flight into a terminal (a click, E, or the walk's dwell) ends at its arrival pose (a console's
// anchors.view, its screen and keyboard as its operator sees them; else the handover pose below) and stays in the
// room, live, with a line on how to go on; a click on the machine (at the bookcase, on a binder: the first pulls it
// out, the second opens its document), E or Enter opens it; a click on anything else, Esc, the Room button or a
// walking key steps back.
//
// Handover: opening a terminal that opens a tab eases (OPEN_S) to where its screen covers, on the lab canvas, the
// rect the page's element will occupy (hooks.screenRect: #cv for the workbench, the Source workspace for source),
// with the camera square to the screen. The page then crossfades from the lab to itself. Back out, the lab starts at
// that pose under the page, fades in, holds, then flies back to stand in front of the terminal.
import * as THREE from "three";
import { build as buildRoom } from "./room/room";
import { Lighting } from "./room/lighting";
import { Dust } from "./room/dust";
import { Post, markScreens } from "./post";
import { RoomSound } from "./audio/roomsound";
import { ROOM } from "./room/shell";
import { PLATE_FONT } from "./equipment/kit";
import { replayUTC } from "./equipment/console4009";
import { Walk, type Terminal } from "./walk";
import type { CameraPose, LabEvent, LabHooks, Opens, Placed, Quality, Room } from "./types";

const FLY_S = 1.0;
const OPEN_S = 0.5;                 // the ease from a console's arrival pose to its handover pose, s
const ARC_M = 0.12;                 // the flight's rise at its middle, metres per 2 m flown (at most one unit)
const CLICK_PX = 5;
const LOOK_DEG = 0.12;              // turn per mouse count while the pointer is locked, deg
const ESC_MS = 250;                 // an Esc this soon after the lock went is the one that released it
const WHEEL_M = 0.0018;             // metres stepped per wheel pixel
/** Keys the walk leaves to the page while the room is shown (modifier chords pass too). */
const PASS = /^(Escape|Tab|F\d+|m|M)$/;
// Auto quality. A software rasteriser starts low; a GPU starts high and is checked twice each time the room is shown:
// the probe, the median frame time over the first frames (after `skip`; `frames` of them, or as many as fit in
// `budget` ms) above `ms`, then the watch, the mean over the next `span` ms of frames above `ms`. Either drops to
// low for good (the indicator says "slow"). ?labprobe=<ms> starts high on any renderer and makes every frame take
// <ms> to the checks: the test hook for the decision path.
const PROBE = { skip: 4, frames: 24, budget: 1500, ms: 24 };
const WATCH = { span: 2000, ms: 22 };
const QKEY = "view1108.labq", LKEY = "view1108.lights";
/** The line at a terminal's close-up, by what it opens. */
const AT_HINT: Record<Opens, string> = {
  workbench: "Click the screen to open", source: "Click the screen to open", print: "Click the viewing port to open",
  listing: "Click the paper to open", library: "Click a binder to pull it out · click again to open",
};
const ease = (t: number) => t * t * (3 - 2 * t);
const D2R = Math.PI / 180;

/** A camera state: position, orientation, vertical field of view (deg), and how much bloom it wants (0..1). */
interface Shot { position: THREE.Vector3; quaternion: THREE.Quaternion; fov: number; glow: number }
interface Flight { from: Shot; to: Shot; t0: number; delay: number; dur: number; free: boolean; done?: () => void }
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
  private sound: RoomSound;
  private vectorTex: THREE.CanvasTexture;
  private quality: Quality = "high";
  private qForced: Quality | null = null;
  private probe: number[] | null = null;
  private watch: { n: number; sum: number } | null = null;
  private slow = false;            // an auto check found this machine too slow for high
  private fakeMs: number | null = null;
  private home: Shot;
  private mode: Mode = "free";
  private flight: Flight | null = null;
  private glow = 1;
  private walk: Walk;
  private drag: { id: number; x: number; y: number; yaw: number; pitch: number; t: number; moved: boolean } | null = null;
  private pinch = new Map<number, { x: number; y: number }>();
  private pinchD = 0;
  private hover: Placed | null = null;
  private pointer: { x: number; y: number } | null = null;
  private lifted = new Map<THREE.Mesh, [THREE.Material, THREE.Material]>();
  private labelEl: HTMLDivElement;
  private crossEl: HTMLDivElement;
  private lockHintEl: HTMLDivElement;
  private atEl: HTMLDivElement;
  /** The terminal the camera has arrived at and holds, not yet opened. */
  private at: { name: string; opens: Opens } | null = null;
  /** What the page laid out for a flight (screenRect) and has not been told to leave: set at take-off, so a flight
   *  replaced or ended before it lands still undoes it. */
  private laid: Opens | null = null;
  private locked = false;
  private everLocked = false;
  private lockFailed = false;
  private unlockT = -Infinity;
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
    this.sound = new RoomSound(this.room, this.camera, hooks.state, () => this.shown);
    const terminals: Terminal[] = this.room.placed.filter(p => (p.equipment.opens || p.equipment.use || p.name === "switch") && p.equipment.anchors.screen).map(p => {
      // A screen lying flat (the printer's sheet) faces the way its machine does.
      const m = p.equipment.anchors.screen!.mesh, n = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
      if (Math.abs(n.y) > 0.7) n.set(0, 0, 1).transformDirection(p.equipment.object.matrixWorld);
      return { name: p.name, screen: new THREE.Vector3().setFromMatrixPosition(m.matrixWorld), normal: new THREE.Vector2(n.x, n.z).normalize(), use: !p.equipment.opens };
    });
    this.walk = new Walk(this.room.footprints ?? [], { x: ROOM.w / 2, z: ROOM.d / 2 }, terminals, {
      step: fast => this.sound.footstep(fast),
      enter: name => { this.setTarget(name); },
      use: name => { const p = this.room.placed.find(q => q.name === name); if (p) this.use(p); },
    });
    this.walk.setFrom(this.home.position, this.home.quaternion);

    const qs = new URLSearchParams(location.search), q = qs.get("labq"), fake = parseFloat(qs.get("labprobe") ?? "");
    if (fake > 0) this.fakeMs = fake;
    let stored: string | null = null;
    try { stored = localStorage.getItem(QKEY); } catch { /* storage unavailable */ }
    this.qForced = q === "low" || q === "high" ? q : stored === "low" || stored === "high" ? stored : null;
    const gl = this.renderer.getContext(), dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const soft = /swiftshader|llvmpipe|software/i.test(String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
    this.quality = this.qForced ?? (soft && this.fakeMs === null ? "low" : "high");
    let lights: string | null = null;
    try { lights = localStorage.getItem(LKEY); } catch { /* storage unavailable */ }
    this.lighting = new Lighting(this.renderer, this.scene, this.quality, k => this.room.tubes?.(k), this.room.glows ?? [], lights !== "0");
    this.room.setLights?.(this.lighting.on);
    const sw = this.room.placed.find(p => p.name === "switch");
    if (sw) sw.equipment.use = () => this.lights(!this.lighting.on);
    this.dust?.light(this.lighting.lit, this.room.glows ?? []);

    this.labelEl = document.createElement("div");
    // Hover and hint labels in the equipment's nameplate face, capitals (kit.ts PLATE_FONT).
    this.labelEl.style.cssText = `position:absolute;pointer-events:none;display:none;padding:3px 8px 2px;font:10px/1.5 ${PLATE_FONT};letter-spacing:.12em;text-transform:uppercase;color:#d6f5dc;background:rgba(4,10,6,.82);border:1px solid #3d5c45;border-radius:3px;white-space:nowrap;z-index:2`;
    this.qualEl = document.createElement("button");
    this.qualEl.style.cssText = "position:absolute;right:10px;bottom:10px;z-index:2;padding:2px 8px;font:11px ui-monospace,monospace;color:#9fb8a5;background:rgba(4,10,6,.7);border:1px solid #2e4434;border-radius:3px;cursor:pointer";
    this.qualEl.onclick = () => this.setQuality(this.quality === "high" ? "low" : "high", true);
    this.crossEl = document.createElement("div");
    this.crossEl.style.cssText = "position:absolute;left:50%;top:50%;width:15px;height:15px;margin:-7px 0 0 -7px;pointer-events:none;display:none;z-index:2";
    this.crossEl.innerHTML = '<svg width="15" height="15" viewBox="0 0 15 15"><path d="M7.5 1.5v4M7.5 9.5v4M1.5 7.5h4M9.5 7.5h4" stroke="rgba(214,245,220,.65)" stroke-width="1" fill="none"/></svg>';
    this.lockHintEl = document.createElement("div");
    this.lockHintEl.style.cssText = `position:absolute;left:50%;bottom:14px;transform:translateX(-50%);pointer-events:none;display:none;padding:3px 10px 2px;font:10px/1.5 ${PLATE_FONT};letter-spacing:.12em;text-transform:uppercase;color:#9fb8a5;background:rgba(4,10,6,.6);border-radius:3px;white-space:nowrap;z-index:2;transition:opacity .8s`;
    this.atEl = document.createElement("div");
    this.atEl.style.cssText = `position:absolute;left:50%;bottom:14px;transform:translateX(-50%);pointer-events:none;display:none;padding:3px 10px 2px;font:10px/1.5 ${PLATE_FONT};letter-spacing:.12em;text-transform:uppercase;color:#d6f5dc;background:rgba(4,10,6,.82);border:1px solid #3d5c45;border-radius:3px;white-space:nowrap;z-index:2`;
    host.append(this.labelEl, this.qualEl, this.crossEl, this.lockHintEl, this.atEl);
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
    window.addEventListener("keydown", this.onKeyCapture, true);
    window.addEventListener("keyup", this.onKeyCapture, true);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("pointerlockerror", this.onLockError);
    document.addEventListener("mousemove", this.onLook);
  }

  /** Show the room. With `from`, the camera starts at that terminal: with `rect` (the page element's client rect)
   *  at the pose where the screen covers it, held `holdMs` while the page fades the lab in; then it flies back to
   *  stand in front of it, outside its zone (walk.ts), so the walk does not pull straight back in. */
  show(from?: string, rect?: DOMRect | null, holdMs = 0): void {
    this.shown = true; this.at = null;
    this.resize();
    this.flight = null; this.clearHover();
    for (const p of this.room.placed) p.equipment.select?.(false);
    this.renderer.shadowMap.needsUpdate = true;   // the static shadow map (lighting.ts)
    const s = from ? (rect && this.matchShot(from, rect)) || this.anchorShot(from) : null;
    if (s) {
      this.setShot(s); this.mode = "hold";
      this.fly(this.standBack(from!) ?? this.home, holdMs, true);
    } else { this.walk.setFrom(this.home.position, this.home.quaternion); this.setShot(this.home); this.mode = "free"; }
    this.draw();
    this.probe = this.qForced || this.slow || this.quality === "low" ? null : []; this.watch = null;
    if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tick); }
    this.lockUI();
  }

  /** Stop rendering; the canvas keeps its last picture. */
  hide(): void {
    this.drop(true);
    this.shown = false; this.flight = null; this.clearHover(); this.walk.clearKeys();
    this.unlock(); this.lockUI();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Fly to a placed equipment (null: the overview). A terminal ends at its arrival pose and holds there until it is
   *  opened (open()); with `open` (a tab picked on the page) it flies straight to the handover pose and opens. */
  setTarget(name: string | null, open = false): boolean {
    this.clearHover();
    if (open && this.at?.name === name) { this.open(); return true; }
    if (name === null) { this.drop(true); this.fly(this.home, 0, true); return true; }
    const p = this.room.placed.find(q => q.name === name);
    if (!p) return false;
    const opens = p.equipment.opens;
    const prev = this.laid, lay = opens && this.hooks.screenRect ? opens : null;
    const rect = lay ? this.hooks.screenRect!(lay) : null;
    const s = (!open && this.anchorShot(name, "view")) || (rect && this.matchShot(name, rect)) || this.anchorShot(name);
    // Leave the last layout unless this flight laid out the same one again.
    this.laid = lay;
    if (prev && prev !== lay) this.hooks.leave?.(prev);
    if (!s) return false;
    if (this.at) { this.at = null; this.lockUI(); }
    this.unlock();
    this.walk.disarm(name); this.walk.clearKeys();
    for (const q of this.room.placed) q.equipment.select?.(q === p);
    this.fly(s, 0, false, () => {
      this.mode = "hold";
      if (!opens) return;
      this.at = { name, opens };
      if (open) this.open(); else this.lockUI();
    });
    return true;
  }

  /** At a terminal's close-up: step back to stand in front of it, walking (it re-arms once you are out of its zone). */
  back(): boolean {
    const a = this.at;
    if (!a || this.mode !== "hold") return false;
    this.drop(true); this.clearHover();
    for (const p of this.room.placed) p.equipment.select?.(false);
    this.fly(this.standBack(a.name) ?? this.home, 0, true);
    return true;
  }

  /** At a terminal's close-up: hand over to the page (a binder's name: that document, from the bookcase). The
   *  handover pose is matched now, in case the page moved since the flight, and eased to from the arrival pose. */
  private open(binder?: string): void {
    const a = this.at;
    if (!a || this.mode !== "hold") return;
    binder ??= this.room.placed.find(q => q.equipment.pulled?.())?.name;   // E or Enter: what is pulled out, if anything
    const laid = this.laid;   // still the lab's to undo until the page takes it over at the end of the handover
    const go = () => { this.laid = null; this.hooks.arrive(a.opens, binder ?? a.name); };
    let s: Shot | null = null;
    if (binder) for (const q of this.room.placed) q.equipment.select?.(q.name === binder);
    else { const rect = this.hooks.screenRect?.(a.opens) ?? null; s = rect && this.matchShot(a.name, rect); }
    this.drop(false); this.clearHover(); this.laid = laid;
    if (s && (s.position.distanceTo(this.camera.position) > 1e-3 || s.quaternion.angleTo(this.camera.quaternion) > 1e-3)) this.fly(s, 0, false, go, OPEN_S);
    else { if (s) { this.setShot(s); this.draw(); } go(); }
  }

  /** No longer at a close-up or flying to one; `leave`: tell the page, which undoes what screenRect laid out for it
   *  (without: the page has taken it over). */
  private drop(leave: boolean): void {
    const a = this.at, l = this.laid;
    this.at = null; this.laid = null;
    if (a) this.lockUI();
    if (leave && l) this.hooks.leave?.(l);
  }

  /** The light switch: the troffers on (striking one by one) or off; remembered. Returns the state. */
  lights(on?: boolean): boolean {
    if (on !== undefined && on !== this.lighting.on) {
      this.lighting.switch(on);
      this.room.setLights?.(on);
      try { localStorage.setItem(LKEY, on ? "1" : "0"); } catch { /* ignore */ }
      this.lit();
    }
    return this.lighting.on;
  }

  /** The exposure and the dust for the light there is now. */
  private lit(): void {
    const e = this.lighting.exposure, L = this.lighting.lit;
    this.renderer.toneMappingExposure = e;
    if (this.post) this.post.exposure = e;
    this.dust?.light(L, L < 1 ? (this.room.glows ?? []).map(g => ({ ...g, intensity: g.intensity * (1 - L) })) : []);
  }

  event(e: LabEvent): void {
    const s = this.hooks.state();
    for (const p of this.room.placed) p.equipment.event?.(e, s);
    this.sound.event(e);
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

  /** The room from above (orthographic, the ceiling left out), `px` pixels per metre, as a PNG data URL: for tests. */
  plan(px = 100): string {
    const box = new THREE.Box3().setFromObject(this.room.object), s = box.getSize(new THREE.Vector3());
    const cam = new THREE.OrthographicCamera(box.min.x, box.max.x, -box.min.z, -box.max.z, 0.1, 20);
    cam.position.set(0, 10, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
    Object.assign(cam, { left: box.min.x, right: box.max.x, top: -box.min.z, bottom: -box.max.z });
    cam.updateProjectionMatrix();
    const hidden: THREE.Object3D[] = [], b = new THREE.Box3();
    this.scene.traverse(o => { if ((o as THREE.Mesh).isMesh && o.visible && b.setFromObject(o).min.y > 2.3) { o.visible = false; hidden.push(o); } });
    const size = this.renderer.getSize(new THREE.Vector2()), pr = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1); this.renderer.setSize(Math.round(s.x * px), Math.round(s.z * px), false);
    this.renderer.render(this.scene, cam);
    const url = this.renderer.domElement.toDataURL("image/png");
    hidden.forEach(o => { o.visible = true; });
    this.renderer.setPixelRatio(pr); this.renderer.setSize(size.x, size.y, false); this.post?.setSize(size.x, size.y);
    if (this.shown) this.draw();
    return url;
  }

  /** The floor plan: each piece's footprint and the door (for tests and the walk). */
  get layout() {
    const terminals = this.walk.terminals.map(t => ({ name: t.name, x: t.screen.x, y: t.screen.y, z: t.screen.z, nx: t.normal.x, nz: t.normal.y }));
    return { footprints: this.room.footprints ?? [], door: this.room.door ?? null, terminals };
  }

  /** Stand at (x, z) looking `yaw` degrees left of north and `pitch` up, walking: for tests. */
  stand(x: number, z: number, yaw: number, pitch = 0): void {
    this.flight = null; this.mode = "free";
    this.walk.setFrom(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * D2R, yaw * D2R, 0, "YXZ")));
    this.walk.pos.copy(this.walk.collide(this.walk.pos.clone()));
    this.applyWalk();
  }

  get info() {
    const w = this.walk, s = this.hooks.state();
    return { locked: this.locked, at: this.at?.name ?? null, hover: this.hover?.name ?? null, lights: this.lighting.on, lit: this.lighting.lit, quality: this.quality, forced: this.qForced, slow: this.slow, checking: this.probe ? "probe" : this.watch ? "watch" : null, mode: this.mode, ...this.stats, mismatch: this.mismatch, sound: this.sound.info,
      walk: { x: w.pos.x, z: w.pos.y, yaw: w.yaw / D2R, pitch: w.pitch / D2R, near: w.near?.name ?? null },
      // what the lab reads of the page's loaded state, and the UTC its clocks show (console4009.ts replayUTC)
      loaded: { mode: s.mode, situation: s.situation, scenario: s.scenario, mission: s.mission, get: s.get, tab: s.tab }, clock: new Date(replayUTC(s)).toISOString() };
  }

  dispose(): void {
    this.hide();
    this.sound.dispose();
    this.ro.disconnect();
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keydown", this.onKeyCapture, true);
    window.removeEventListener("keyup", this.onKeyCapture, true);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("pointerlockerror", this.onLockError);
    document.removeEventListener("mousemove", this.onLook);
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
    this.labelEl.remove(); this.qualEl.remove(); this.crossEl.remove(); this.lockHintEl.remove(); this.atEl.remove();
  }

  // ---- frame ----

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const raw = this.last ? (now - this.last) / 1000 : 0, dt = Math.min(0.1, raw);
    if ((this.probe || this.watch) && this.last) this.sample(now - this.last);
    this.last = now;
    const s = this.hooks.state();
    if (s.frameNo !== this.frameNo) { this.frameNo = s.frameNo; this.vectorTex.needsUpdate = true; }
    for (const p of this.room.placed) p.equipment.update?.(dt, s);
    this.room.update?.(dt, s);
    this.dust?.update(dt);
    const was = this.lighting.lit; this.lighting.update(dt);
    if (this.lighting.lit < 1 || this.lighting.lit !== was) this.lit();
    let landed: (() => void) | undefined;
    if (this.flight) landed = this.stepFlight(now);
    else if (this.mode === "free") { this.walk.update(Math.min(0.25, raw)); if (this.mode === "free") this.applyWalk(); }
    if ((this.mode === "free" || this.at) && !this.drag) {
      if (this.locked) { const r = this.renderer.domElement.getBoundingClientRect(); this.pick(r.left + r.width / 2, r.top + r.height / 2); }
      else if (this.pointer) this.pick(this.pointer.x, this.pointer.y);
    }
    this.hint();
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
    ms = this.fakeMs ?? ms;
    const p = this.probe, w = this.watch;
    if (p) {
      p.push(ms);
      const s = p.slice(PROBE.skip);
      if (s.length < PROBE.frames && s.reduce((a, b) => a + b, 0) < PROBE.budget) return;
      this.probe = null;
      if (s.sort((a, b) => a - b)[s.length >> 1] > PROBE.ms) this.tooSlow();
      else this.watch = { n: 0, sum: 0 };
    } else if (w) {
      w.n++; w.sum += ms;
      if (w.sum < WATCH.span) return;
      this.watch = null;
      if (w.sum / w.n > WATCH.ms) this.tooSlow();
    }
  }

  private tooSlow(): void {
    if (this.quality !== "high" || this.qForced) return;
    this.slow = true;
    this.setQuality("low", false);
  }

  private setQuality(q: Quality, remember: boolean): void {
    if (remember) { this.qForced = q; this.probe = this.watch = null; try { localStorage.setItem(QKEY, q); } catch { /* ignore */ } }
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
    this.post?.dispose(); this.post = null;
    r.setSize(this.size.w, this.size.h, false);
    if (high) this.post = new Post(r, this.scene, this.camera);
    this.lit();
    this.qualEl.textContent = `${high ? "HIGH" : "LOW"}${this.qForced ? "" : this.slow ? " (auto: slow)" : " (auto)"}`;
    this.qualEl.title = (this.slow && !this.qForced ? "Switched to low: frames took too long at high. " : "") +
      "Rendering quality: click to switch (remembered; ?labq=low|high for one visit)";
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

  /** Fly to `to` over `dur` s; `free`: land walking there, else hold (at a terminal). */
  private fly(to: Shot, delay = 0, free = false, done?: () => void, dur = FLY_S): void {
    this.mode = "flight";
    this.flight = { from: this.current(), to, t0: performance.now(), delay, dur, free, done };
  }

  /** One step of the flight (wall clock: a slow GPU skips, never drags). Returns the arrival action when it lands. */
  private stepFlight(now: number): (() => void) | undefined {
    const f = this.flight!, t = Math.min(1, Math.max(0, (now - f.t0 - f.delay) / 1000 / f.dur)), k = ease(t);
    const d = f.from.position.distanceTo(f.to.position);
    this.camera.position.lerpVectors(f.from.position, f.to.position, k);
    this.camera.position.y += Math.sin(Math.PI * k) * ARC_M * Math.min(1, d / 2);
    this.camera.quaternion.slerpQuaternions(f.from.quaternion, f.to.quaternion, k);
    this.camera.fov = f.from.fov + (f.to.fov - f.from.fov) * k;
    this.glow = f.from.glow + (f.to.glow - f.from.glow) * k;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    if (t < 1) return undefined;
    this.flight = null;
    this.mode = f.free ? "free" : "hold";
    if (f.free) this.walk.setFrom(this.camera.position, this.camera.quaternion);
    return f.done ?? (() => {});
  }

  /** The camera where the walk stands, at the overview's eye height and field. */
  private applyWalk(): void {
    this.camera.position.set(this.walk.pos.x, this.home.position.y, this.walk.pos.y);
    this.walk.quaternion(this.camera.quaternion);
    this.camera.fov = this.home.fov; this.glow = 1;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }

  /** Standing in front of a terminal, outside its zone, looking at its screen. */
  private standBack(name: string): Shot | null {
    const t = this.walk.terminals.find(q => q.name === name);
    if (!t) return null;
    this.walk.disarm(name);
    const p = this.walk.standBack(t);
    return shotOf({ position: new THREE.Vector3(p.x, this.home.position.y, p.y), target: t.screen, fov: this.home.fov });
  }

  /** In a terminal's zone: its name and how to go in, by its screen. */
  private hint(): void {
    const t = this.mode === "free" ? this.walk.near : null;
    if (!t) { if (this.labelEl.dataset.hint) { this.labelEl.style.display = "none"; delete this.labelEl.dataset.hint; } return; }
    if (this.hover) return;
    const v = t.screen.clone().project(this.camera), r = this.renderer.domElement.getBoundingClientRect(), hr = this.host.getBoundingClientRect();
    this.labelEl.textContent = `${this.room.labels?.[t.name] ?? t.name} · ${t.name === "switch" ? "press E or L" : t.use ? "press E" : "approach or press E"}`;
    this.labelEl.style.left = `${r.left - hr.left + (v.x + 1) / 2 * r.width}px`;
    this.labelEl.style.top = `${r.top - hr.top + (1 - v.y) / 2 * r.height + 24}px`;
    this.labelEl.style.display = "block"; this.labelEl.dataset.hint = t.name;
  }

  /** A placed equipment's own pose (anchors.camera, the zoom-in; or anchors.view, a console's arrival) in room
   *  coordinates. */
  private anchorShot(name: string, which: "camera" | "view" = "camera"): Shot | null {
    const p = this.room.placed.find(q => q.name === name), c = p?.equipment.anchors[which];
    if (!p || !c) return null;
    const m = p.equipment.object.matrixWorld;
    return shotOf({ position: c.position.clone().applyMatrix4(m), target: c.target.clone().applyMatrix4(m), fov: c.fov }, 0);
  }

  /** The pose square to the equipment's screen at which the picture's part of it (uvRect; the screen mesh a plane
   *  in its local XY facing +Z, UVs running across its bounds) spans `rect`'s height (its width, with `fit`) on the
   *  lab canvas, centred on it. Where the rect is wider than the screen the page widens from the screen's rect
   *  (`mismatch`; room.js). */
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
    const d = sc.fit === "width" ? w * cr.height / (2 * tn * rect.width) : h * cr.height / (2 * tn * rect.height);
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
    if (this.locked) { if (e.button === 0 && this.hover) this.use(this.hover); return; }   // the crosshair's target
    if (e.pointerType === "touch") {
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) { const [a, b] = [...this.pinch.values()]; this.pinchD = Math.hypot(a.x - b.x, a.y - b.y); this.drag = null; return; }
    }
    if (e.button !== 0) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: this.walk.yaw, pitch: this.walk.pitch, t: performance.now(), moved: false };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    if (this.locked) return;   // onLook turns
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer = { x: e.clientX, y: e.clientY };
    if (this.pinch.has(e.pointerId)) {
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) {
        const [a, b] = [...this.pinch.values()], dd = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.mode === "free") this.walk.nudge((dd - this.pinchD) * 0.006);
        this.pinchD = dd;
        return;
      }
    }
    const g = this.drag;
    if (!g || g.id !== e.pointerId || this.mode !== "free") return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < CLICK_PX) return;
    if (!g.moved) { g.moved = true; this.clearHover(); }
    const radPx = this.camera.fov * D2R / r.height;   // mouselook as in a first-person game: drag right looks right, drag down looks down
    this.walk.turn(g.yaw - dx * radPx - this.walk.yaw, g.pitch - dy * radPx - this.walk.pitch);
  };

  private onUp = (e: PointerEvent) => {
    this.pinch.delete(e.pointerId);
    const g = this.drag;
    if (!g || g.id !== e.pointerId) return;
    this.drag = null;
    if (g.moved || e.type !== "pointerup") return;
    // At a close-up a click on the machine opens it; on a shelf a click on a book pulls it out, again opens it. A click
    // on anything else (the bookcase's own frame, the room, another machine) steps back into the room.
    if (this.at) {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) >= CLICK_PX) return;
      const p = this.hit(e.clientX, e.clientY);
      if (p?.equipment.pull) { if (p.equipment.pull()) this.open(p.name); else this.lockUI(); }
      else if (p && p.name === this.at.name && this.at.opens !== "library") this.open();
      else this.back();
      return;
    }
    if (this.mode !== "free") return;
    const p = this.hit(e.clientX, e.clientY);
    if (p) this.use(p);
    else if (e.pointerType === "mouse") this.lock();
  };

  // ---- pointer lock ----

  private lock(): void {
    const c = this.renderer.domElement;
    if (this.locked || !c.requestPointerLock) return;
    const fail = () => { this.lockFailed = true; this.lockUI(); };
    // Raw counts where the browser has them (no OS acceleration), else the plain lock; either may refuse.
    const plain = () => { try { Promise.resolve(c.requestPointerLock()).catch(fail); } catch { fail(); } };
    try { Promise.resolve(c.requestPointerLock({ unadjustedMovement: true })).catch(plain); } catch { plain(); }
  }

  private unlock(): void {
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
  }

  private onLockChange = () => {
    const on = document.pointerLockElement === this.renderer.domElement;
    // A lock granted after a flight took off (asked for just before it) would leave the camera locked at a close-up.
    if (on && this.mode !== "free") { this.unlock(); return; }
    if (on === this.locked) return;
    this.locked = on; this.drag = null; this.pointer = null; this.clearHover();
    if (on) { this.everLocked = true; this.lockFailed = false; } else this.unlockT = performance.now();
    this.lockUI();
  };

  private onLockError = () => { if (!this.locked) { this.lockFailed = true; this.lockUI(); } };

  /** Locked: mouse right looks right, mouse down looks down. */
  private onLook = (e: MouseEvent) => {
    if (!this.locked || this.mode !== "free") return;
    const k = LOOK_DEG * D2R;
    this.walk.turn(-e.movementX * k, -e.movementY * k);
  };

  /** The crosshair while locked; unlocked, until the first lock, a line on how to look (dragging, when refused). */
  private lockUI(): void {
    this.crossEl.style.display = this.shown && this.locked ? "block" : "none";
    const fine = matchMedia("(any-pointer: fine)").matches, h = this.lockHintEl;
    h.textContent = this.lockFailed ? "Drag to look around · WASD to walk" : "Click to look around · WASD to walk · Esc to release";
    if (!this.shown || !fine || this.at || (this.everLocked && !this.lockFailed)) h.style.opacity = "0";
    else { h.style.display = "block"; h.style.opacity = this.locked ? "0" : "1"; }
    if (!this.shown) h.style.display = "none";
    this.atEl.style.display = this.shown && this.at ? "block" : "none";
    const at = this.at && this.room.placed.find(q => q.name === this.at!.name);
    if (this.at) this.atEl.textContent = `${at?.equipment.hint?.() ?? AT_HINT[this.at.opens]} · Esc to step back`;
  }

  private onLeave = () => { this.pointer = null; this.clearHover(); };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.mode === "free") this.walk.nudge(-e.deltaY * (e.deltaMode === 1 ? 28 : 1) * WHEEL_M);
  };

  /** Esc, walked or turned away from the overview: back to it (the Esc that releases the lock is taken earlier). */
  private onKey = (e: KeyboardEvent) => {
    if (!this.shown || e.key !== "Escape" || this.mode !== "free" || this.locked || performance.now() - this.unlockT < ESC_MS) return;
    const h = this.home.position;
    if (this.walk.pos.distanceTo(new THREE.Vector2(h.x, h.z)) > 0.05 || this.camera.quaternion.angleTo(this.home.quaternion) > 0.01) {
      e.preventDefault(); this.setTarget(null);
    }
  };

  /** While the room is shown its keys are the walk's (and E/Enter for a terminal in range); the page gets none but
   *  PASS and modifier chords, so its plot keys cannot act behind the room. */
  private onKeyCapture = (e: KeyboardEvent) => {
    if (!this.shown) return;
    if (e.type === "keyup") { this.walk.key(e.key, false, e.shiftKey); return; }
    if (this.at && this.mode === "hold" && !e.ctrlKey && !e.metaKey && !e.altKey) {   // at a close-up
      const k = e.key;
      if (k === "Escape" || this.walk.key(k, true, e.shiftKey)) { e.stopImmediatePropagation(); e.preventDefault(); this.back(); return; }
      if (k === "e" || k === "E" || k === "Enter") { e.stopImmediatePropagation(); e.preventDefault(); this.open(); return; }
    }
    if (e.key === "Escape" && (this.locked || performance.now() - this.unlockT < ESC_MS)) {
      e.stopImmediatePropagation(); e.preventDefault(); this.unlock(); return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || PASS.test(e.key)) return;
    e.stopPropagation();
    if (this.mode !== "free") return;
    if (this.walk.key(e.key, true, e.shiftKey)) e.preventDefault();
    else if ((e.key === "e" || e.key === "E" || e.key === "Enter") && (this.locked && this.hover ? this.use(this.hover) : this.walk.enter())) e.preventDefault();
    else if (e.key === "l" || e.key === "L") { e.preventDefault(); this.lights(!this.lighting.on); }
    else if (e.key === " ") e.preventDefault();
  };

  private onBlur = () => this.walk.clearKeys();

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
      return p && (p.equipment.opens || p.equipment.use || p.equipment.inert) ? p : null;
    }
    return null;
  }

  /** Hover: lift and name the machine under (x, y). */
  private pick(x: number, y: number): void {
    if (this.mode !== "free" && !this.at) return;
    let p = this.hit(x, y);
    if (this.at && !p?.equipment.pull) p = null;   // at a close-up only what pulls out
    this.renderer.domElement.style.cursor = p || this.at ? "pointer" : "";
    if (p !== this.hover) { this.clearHover(); if (p) this.lift(p, true); this.hover = p; }
    const label = p && this.room.labels?.[p.name];
    if (label) {
      const hr = this.host.getBoundingClientRect();
      this.labelEl.textContent = label;
      this.labelEl.style.left = `${x - hr.left + 14}px`; this.labelEl.style.top = `${y - hr.top + 16}px`;
      this.labelEl.style.display = "block";
    } else this.labelEl.style.display = "none";
  }

  /** Use a machine: flip it in place (the switch), follow its link (the door; out of pointer lock first, so the new
   *  tab is not opened under a captured mouse), or fly into it. */
  private use(p: Placed): true {
    if (p.equipment.inert) return true;   // a prop: named on hover, nothing to do
    if (p.equipment.anchors.href) this.unlock();
    if (p.equipment.use) p.equipment.use(); else this.setTarget(p.name);
    return true;
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

