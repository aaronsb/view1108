// The lab: renderer, quality tier, camera (walking the room from the overview, walk.ts; flights to the terminals),
// the handover to the page (hover and picking in picking.ts, input in input.ts, a carried reel in carry.ts). It
// renders only while shown; the page decides when that is (web/src/room.js). While it is shown the keys are the
// walk's: a capture listener keeps them from the page.
//
// Looking, as in a first-person game (ours): a mouse click on the room away from a machine locks the pointer; the
// mouse then turns the view, a crosshair marks the centre, what is under it is the hover target, and a click, E or
// Enter uses it. Esc (taken by the browser) only releases the lock. A click on a machine while unlocked uses it as
// before, so the room still works point-and-click; touch, pen, and a browser that refuses the lock drag to look.
// What each machine is and does comes from the station table (stations.ts). A line at the room's top left says what
// the mounted reel is and whether it runs, and until the first look, step or click how to take control; the drive
// (a "control" station) is the page's STOP/START (hooks.drive), used in place.
//
// Arrival: a flight into a terminal (a click, E, or, when the viewer has turned walk-up on, the walk's dwell) ends at
// its arrival pose (a console's anchors.view, its screen and keyboard as its operator sees them; else the handover
// pose below) and stays in the room, live, with a line on how to go on; a click on the machine (at the bookcase, on a
// binder: the first pulls it out, the second opens its document), E or Enter opens it; a click on anything else, Esc,
// the Room button or a walking key steps back. The tape rack is a shelf station (stations.ts): its close-up opens
// nothing; a reel pulled there stays out when the camera leaves, carried, and a click (or E) on any tape unit mounts
// it (hooks.mount, the page's loadReel) and puts it back on the rack (#19).
//
// Esc is the page's one stack (web/src/esc.js, through hooks.esc): the lab pushes its close-up ("closeup": step back)
// and a binder or reel pulled out there ("pulled": put it back; a carried reel's stays after the close-up); the page's
// bottom entry walks back to the overview (home()).
// An Esc the pointer lock took is swallowed (escLock()).
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
import { isShelf, stationNamed, stationOpening } from "./stations";
import { Carry } from "./carry";
import { Input } from "./input";
import { Picking } from "./picking";
import { QualityCheck } from "./quality";
import { anchorShot, matchShot, shotOf, type Mismatch, type Shot } from "./shot";
import type { LabEvent, LabHooks, Opens, Placed, Quality, Room } from "./types";

/** A flight's time, s, by the distance flown (m): 1 s up to 2.5 m, then slower per metre, at most 1.8 s (an 11 m
 *  flight across the room takes 1.7 s). */
const flyS = (d: number) => THREE.MathUtils.clamp(0.8 + 0.08 * d, 1.0, 1.8);
const DUST_PER_M3 = 4;              // the dust motes' density
const OPEN_S = 0.5;                 // the ease from a console's arrival pose to its handover pose, s
const ARC_M = 0.12;                 // the flight's rise at its middle, metres per 2 m flown (at most one unit)
// The room's preferences, remembered: the quality tier, the lights, walk-up auto-entry ("1" on; off by default, #20).
const QKEY = "view1108.labq", LKEY = "view1108.lights", WKEY = "view1108.walkup";
const ease = (t: number) => t * t * (3 - 2 * t);
const D2R = Math.PI / 180;

interface Flight { from: Shot; to: Shot; t0: number; delay: number; dur: number; free: boolean; done?: () => void }
type Mode = "free" | "flight" | "hold";

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
  private check: QualityCheck;
  private slow = false;            // an auto check found this machine too slow for high
  private home0: Shot;
  private mode: Mode = "free";
  private flight: Flight | null = null;
  private glow = 1;
  private walk: Walk;
  private carry: Carry;
  private input: Input;
  private picking: Picking;
  private labelEl: HTMLDivElement;
  private crossEl: HTMLDivElement;
  private lineEl: HTMLDivElement;
  private atEl: HTMLDivElement;
  private walkEl: HTMLButtonElement;
  /** The terminal the camera has arrived at and holds, not yet opened. */
  private at: { name: string; opens: Opens } | null = null;
  /** What the page laid out for a flight (screenRect) and has not been told to leave: set at take-off, so a flight
   *  replaced or ended before it lands still undoes it. */
  private laid: Opens | null = null;
  private qualEl: HTMLButtonElement;
  private raf = 0;
  private last = 0;
  private frameNo = -1;
  private shown = false;
  private ro: ResizeObserver;
  private size = { w: 1, h: 1 };
  /** The last handover: the screen's projected rect against the page's, CSS px. */
  mismatch: Mismatch | null = null;
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
    this.room = buildRoom({ vectorScreen: this.vectorTex, maxAnisotropy: aniso, reels: hooks.reels ?? [] });
    this.scene.add(this.room.object);
    markScreens(this.room.object);
    this.room.object.updateMatrixWorld(true);
    // ?labdust=0 leaves the motes out: they drift by the frame's real dt, so no two screenshots match (tools/shoot.mjs)
    if (this.room.air && new URLSearchParams(location.search).get("labdust") !== "0") { this.dust = new Dust({ box: this.room.air, count: Math.round(DUST_PER_M3 * this.room.air.getSize(new THREE.Vector3()).toArray().reduce((a, b) => a * b, 1)), size: 0.006, opacity: 0.22 }); this.scene.add(this.dust.object); }
    this.home0 = shotOf(this.room.overview);
    this.sound = new RoomSound(this.room, this.camera, hooks.state, () => this.shown);
    const terminals: Terminal[] = this.room.placed.filter(p => (p.equipment.opens || p.equipment.use || p.name === "switch" || stationNamed(p.name)) && p.equipment.anchors.screen).map(p => {
      // A screen lying flat (the printer's sheet) faces the way its machine does.
      const m = p.equipment.anchors.screen!.mesh, n = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
      if (Math.abs(n.y) > 0.7) n.set(0, 0, 1).transformDirection(p.equipment.object.matrixWorld);
      return { name: p.name, screen: new THREE.Vector3().setFromMatrixPosition(m.matrixWorld), normal: new THREE.Vector2(n.x, n.z).normalize(), use: !p.equipment.opens };
    });
    let walkup: string | null = null;
    try { walkup = localStorage.getItem(WKEY); } catch { /* storage unavailable */ }
    this.walk = new Walk(this.room.footprints ?? [], { x: ROOM.w / 2, z: ROOM.d / 2 }, terminals, walkup === "1", {
      step: fast => this.sound.footstep(fast),
      enter: name => { this.setTarget(name); },
      use: name => { const p = this.room.placed.find(q => q.name === name); if (p) this.use(p); },
    });
    this.walk.setFrom(this.home0.position, this.home0.quaternion);

    const qs = new URLSearchParams(location.search), q = qs.get("labq"), fake = parseFloat(qs.get("labprobe") ?? "");
    this.check = new QualityCheck(fake > 0 ? fake : null);
    let stored: string | null = null;
    try { stored = localStorage.getItem(QKEY); } catch { /* storage unavailable */ }
    this.qForced = q === "low" || q === "high" ? q : stored === "low" || stored === "high" ? stored : null;
    const gl = this.renderer.getContext(), dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const soft = /swiftshader|llvmpipe|software/i.test(String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
    this.quality = this.qForced ?? (soft && this.check.fakeMs === null ? "low" : "high");
    let lights: string | null = null;
    try { lights = localStorage.getItem(LKEY); } catch { /* storage unavailable */ }
    this.lighting = new Lighting(this.renderer, this.scene, this.quality, k => this.room.tubes?.(k), this.room.glows ?? [], lights !== "0");
    this.room.setLights?.(this.lighting.on);
    const sw = this.room.placed.find(p => p.name === "switch");
    if (sw) sw.equipment.use = () => this.lights(!this.lighting.on);
    for (const p of this.room.placed) if (stationNamed(p.name)?.does === "control") p.equipment.use = () => this.hooks.drive?.();
    this.carry = new Carry(this.room, hooks, { clearHover: () => this.picking.clearHover(), lockUI: () => this.lockUI() });
    this.dust?.light(this.lighting.lit, this.room.glows ?? []);

    this.labelEl = document.createElement("div");
    // Hover and hint labels in the equipment's nameplate face, capitals (kit.ts PLATE_FONT).
    this.labelEl.style.cssText = `position:absolute;pointer-events:none;display:none;padding:3px 8px 2px;font:10px/1.5 ${PLATE_FONT};letter-spacing:.12em;text-transform:uppercase;color:#d6f5dc;background:rgba(4,10,6,.82);border:1px solid #3d5c45;border-radius:3px;white-space:nowrap;z-index:2`;
    // The room's preference buttons, bottom right: walk-up auto-entry and the quality tier.
    const prefsEl = document.createElement("div");
    prefsEl.style.cssText = "position:absolute;right:10px;bottom:10px;z-index:2;display:flex;gap:6px";
    const prefBtn = "padding:2px 8px;font:11px ui-monospace,monospace;color:#9fb8a5;background:rgba(4,10,6,.7);border:1px solid #2e4434;border-radius:3px;cursor:pointer";
    this.walkEl = document.createElement("button");
    this.walkEl.style.cssText = prefBtn;
    this.walkEl.title = "Walk-up: walking up to a terminal and facing it opens its close-up after a moment (remembered)";
    this.walkEl.onclick = () => this.setWalkup(!this.walk.auto);
    this.qualEl = document.createElement("button");
    this.qualEl.style.cssText = prefBtn;
    this.qualEl.onclick = () => this.setQuality(this.quality === "high" ? "low" : "high", true);
    prefsEl.append(this.walkEl, this.qualEl);
    this.walkUI();
    this.crossEl = document.createElement("div");
    this.crossEl.style.cssText = "position:absolute;left:50%;top:50%;width:15px;height:15px;margin:-7px 0 0 -7px;pointer-events:none;display:none;z-index:2";
    this.crossEl.innerHTML = '<svg width="15" height="15" viewBox="0 0 15 15"><path d="M7.5 1.5v4M7.5 9.5v4M1.5 7.5h4M9.5 7.5h4" stroke="rgba(214,245,220,.65)" stroke-width="1" fill="none"/></svg>';
    // The top line: what is mounted and playing, and how to take control (#20), small at the top left, clear of the
    // view's centre.
    this.lineEl = document.createElement("div");
    this.lineEl.style.cssText = `position:absolute;left:10px;top:10px;max-width:calc(100% - 20px);overflow:hidden;text-overflow:ellipsis;pointer-events:none;display:none;padding:3px 10px 2px;font:10px/1.5 ${PLATE_FONT};letter-spacing:.12em;text-transform:uppercase;color:#9fb8a5;background:rgba(4,10,6,.6);border-radius:3px;white-space:nowrap;z-index:2`;
    this.atEl = document.createElement("div");
    this.atEl.style.cssText = `position:absolute;left:50%;bottom:14px;transform:translateX(-50%);pointer-events:none;display:none;padding:3px 10px 2px;font:10px/1.5 ${PLATE_FONT};letter-spacing:.12em;text-transform:uppercase;color:#d6f5dc;background:rgba(4,10,6,.82);border:1px solid #3d5c45;border-radius:3px;white-space:nowrap;z-index:2`;
    host.append(this.labelEl, prefsEl, this.crossEl, this.lineEl, this.atEl);
    this.picking = new Picking({
      renderer: this.renderer, camera: this.camera, host, labelEl: this.labelEl, room: this.room, carry: this.carry,
      active: () => this.mode === "free" || !!this.at, at: () => !!this.at,
    });
    this.applyQuality();

    this.setShot(this.home0);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.input = new Input({
      canvas: c, camera: this.camera, walk: this.walk,
      shown: () => this.shown, mode: () => this.mode, at: () => this.at, hover: () => this.picking.hover,
      hit: (x, y) => this.picking.hit(x, y), use: p => this.use(p), open: b => this.open(b), back: () => this.back(),
      pulledOut: () => this.carry.pulledOut(), clearHover: () => this.picking.clearHover(), lockUI: () => this.lockUI(),
      toggleLights: () => { this.lights(!this.lighting.on); },
    });
  }

  /** Show the room. With `from`, the camera starts at that terminal: with `rect` (the page element's client rect)
   *  at the pose where the screen covers it, held `holdMs` while the page fades the lab in; then it flies back to
   *  stand in front of it, outside its zone (walk.ts), so the walk does not pull straight back in. */
  show(from?: string, rect?: DOMRect | null, holdMs = 0): void {
    this.shown = true; this.setAt(null);
    this.resize();
    this.flight = null; this.picking.clearHover();
    for (const p of this.room.placed) p.equipment.select?.(false);
    this.renderer.shadowMap.needsUpdate = true;   // the static shadow map (lighting.ts)
    const s = from ? (rect && this.matchShot(from, rect)) || this.anchorShot(from) : null;
    if (s) {
      this.setShot(s); this.mode = "hold";
      this.fly(this.standBack(from!) ?? this.home0, holdMs, true);
    } else { this.walk.setFrom(this.home0.position, this.home0.quaternion); this.setShot(this.home0); this.mode = "free"; }
    this.draw();
    this.check.start(!(this.qForced || this.slow || this.quality === "low"));
    if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(this.tick); }
    this.lockUI();
  }

  /** Stop rendering; the canvas keeps its last picture. */
  hide(): void {
    this.drop(true);
    this.shown = false; this.flight = null; this.picking.clearHover(); this.walk.clearKeys();
    this.input.unlock(); this.lockUI(); this.line();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Fly to a placed equipment (null: the overview). A terminal ends at its arrival pose and holds there until it is
   *  opened (open()); with `open` (a tab picked on the page) it flies straight to the handover pose and opens. */
  setTarget(name: string | null, open = false): boolean {
    this.picking.clearHover();
    if (open && this.at?.name === name) { this.open(); return true; }
    if (name === null) { this.drop(true); this.fly(this.home0, 0, true); return true; }
    const p = this.room.placed.find(q => q.name === name);
    if (!p) return false;
    const opens = p.equipment.opens;
    const prev = this.laid, lay = opens && this.hooks.screenRect && !isShelf(opens) ? opens : null;
    const rect = lay ? this.hooks.screenRect!(lay) : null;
    const s = (!open && this.anchorShot(name, "view")) || (rect && this.matchShot(name, rect)) || this.anchorShot(name);
    // Leave the last layout unless this flight laid out the same one again.
    this.laid = lay;
    if (prev && prev !== lay) this.hooks.leave?.(prev);
    if (!s) return false;
    if (this.at) this.setAt(null);
    this.input.unlock();
    this.walk.disarm(name); this.walk.clearKeys();
    for (const q of this.room.placed) q.equipment.select?.(q === p);
    if (this.carry.carried()) this.carry.pulledOut();   // a reel flown to comes out, and one carried stays out: Esc puts it back
    this.fly(s, 0, false, () => {
      this.mode = "hold";
      if (!opens) return;
      this.setAt({ name, opens });
      if (open) this.open();
    });
    return true;
  }

  /** At a terminal's close-up: step back to stand in front of it, walking (it re-arms once you are out of its zone). */
  back(): boolean {
    const a = this.at;
    if (!a || this.mode !== "hold") return false;
    this.drop(true); this.picking.clearHover();
    for (const p of this.room.placed) p.equipment.select?.(false);
    this.fly(this.standBack(a.name) ?? this.home0, 0, true);
    return true;
  }

  /** At a terminal's close-up: hand over to the page (a binder's name: that document, from the bookcase). The
   *  handover pose is matched now, in case the page moved since the flight, and eased to from the arrival pose. */
  private open(binder?: string): void {
    const a = this.at;
    if (!a || this.mode !== "hold") return;
    if (isShelf(a.opens)) { this.back(); return; }   // a shelf opens nothing: E or Enter steps back, carrying what is out
    binder ??= this.room.placed.find(q => q.equipment.pulled?.())?.name;   // E or Enter: what is pulled out, if anything
    const laid = this.laid;   // still the lab's to undo until the page takes it over at the end of the handover
    const go = () => { this.laid = null; this.hooks.arrive(a.opens, binder ?? a.name); };
    let s: Shot | null = null;
    if (binder) for (const q of this.room.placed) q.equipment.select?.(q.name === binder);
    else { const rect = this.hooks.screenRect?.(a.opens) ?? null; s = rect && this.matchShot(a.name, rect); }
    this.drop(false); this.picking.clearHover(); this.laid = laid;
    if (s && (s.position.distanceTo(this.camera.position) > 1e-3 || s.quaternion.angleTo(this.camera.quaternion) > 1e-3)) this.fly(s, 0, false, go, OPEN_S);
    else { if (s) { this.setShot(s); this.draw(); } go(); }
  }

  /** No longer at a close-up or flying to one; `leave`: tell the page, which undoes what screenRect laid out for it
   *  (without: the page has taken it over). */
  private drop(leave: boolean): void {
    const l = this.laid;
    if (this.at) this.setAt(null);
    this.laid = null;
    if (leave && l) this.hooks.leave?.(l);
  }

  /** Arrived at a close-up (or left it: null), on the Esc stack as "closeup"; leaving takes "pulled" off too, unless a
   *  reel is carried. */
  private setAt(a: { name: string; opens: Opens } | null): void {
    this.at = a;
    if (a) this.hooks.esc?.("closeup", () => { this.back(); });
    else { this.hooks.esc?.("closeup", null); if (!this.carry.carried()) this.hooks.esc?.("pulled", null); }
    this.lockUI();
  }

  /** Esc reached the page while the room is shown: the pointer lock's own (the browser released the lock; or it is
   *  still locked, so release it). True when this Esc is the lock's and nothing else should take it. */
  escLock(): boolean {
    if (!this.shown) return false;
    return this.input.escLock();
  }

  /** The room's bottom Esc: walking, and walked or turned away from the overview, go back to it. */
  home(): boolean {
    if (!this.shown || this.mode !== "free") return false;
    const h = this.home0.position;
    if (this.walk.pos.distanceTo(new THREE.Vector2(h.x, h.z)) <= 0.05 && this.camera.quaternion.angleTo(this.home0.quaternion) <= 0.01) return false;
    this.setTarget(null);
    return true;
  }

  /** Walk-up auto-entry on or off; remembered. */
  setWalkup(on: boolean): void {
    this.walk.auto = on;
    try { localStorage.setItem(WKEY, on ? "1" : "0"); } catch { /* ignore */ }
    this.walkUI();
  }

  private walkUI(): void {
    this.walkEl.textContent = `WALK-UP ${this.walk.auto ? "ON" : "OFF"}`;
  }

  /** The top line, from the page's state: the reel and whether it runs; until the viewer engages, how to go on. */
  private line(): void {
    const el = this.lineEl;
    if (!this.shown) { el.style.display = "none"; return; }
    const s = this.hooks.state(), fine = matchMedia("(any-pointer: fine)").matches;
    // In Beam the clock follows the trace, not the drive (until Beam honours LabState.playing): no drive state.
    const beam = s.mode === "beam", parts = [s.reel || "-", beam ? "beam trace" : s.playing ? "running" : "stopped"];
    if (!this.input.engaged) parts.push(fine && !this.input.lockFailed ? "click to look" : "drag to look", "WASD to walk", "click a terminal");
    const r = this.carry.carried();
    if (r) parts.push(`reel out: ${this.carry.reelTitle(r)} · a tape unit mounts it`);
    else if (!beam) parts.push(`drive: ${s.playing ? "stop" : "start"}`);
    const t = parts.join(" · ");
    if (el.textContent !== t) el.textContent = t;
    el.style.display = "block";
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
    return { locked: this.input.locked, at: this.at?.name ?? null, carried: this.carry.carried()?.name ?? null, walkup: this.walk.auto, line: this.lineEl.style.display === "none" ? null : this.lineEl.textContent, hover: this.picking.hover?.name ?? null, lights: this.lighting.on, lit: this.lighting.lit, quality: this.quality, forced: this.qForced, slow: this.slow, checking: this.check.probe ? "probe" : this.check.watch ? "watch" : null, mode: this.mode, ...this.stats, mismatch: this.mismatch, sound: this.sound.info,
      walk: { x: w.pos.x, z: w.pos.y, yaw: w.yaw / D2R, pitch: w.pitch / D2R, near: w.near?.name ?? null },
      // what the lab reads of the page's loaded state, and the UTC its clocks show (console4009.ts replayUTC)
      loaded: { mode: s.mode, situation: s.situation, scenario: s.scenario, mission: s.mission, get: s.get, tab: s.tab, reel: s.reel, mounted: s.mounted, playing: s.playing }, clock: new Date(replayUTC(s)).toISOString() };
  }

  dispose(): void {
    this.hide();
    this.sound.dispose();
    this.ro.disconnect();
    this.input.dispose();
    for (const p of this.room.placed) p.equipment.dispose?.();
    this.room.dispose?.();
    this.picking.dispose();
    this.dust?.dispose();
    this.post?.dispose();
    this.lighting.dispose();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()); } });
    this.vectorTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.labelEl.remove(); this.qualEl.parentElement?.remove(); this.crossEl.remove(); this.lineEl.remove(); this.atEl.remove();
  }

  // ---- frame ----

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const raw = this.last ? (now - this.last) / 1000 : 0, dt = Math.min(0.1, raw);
    if (this.check.running && this.last && this.check.sample(now - this.last)) this.tooSlow();
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
    if ((this.mode === "free" || this.at) && !this.input.drag) {
      if (this.input.locked) { const r = this.renderer.domElement.getBoundingClientRect(); this.picking.pick(r.left + r.width / 2, r.top + r.height / 2); }
      else if (this.input.pointer) this.picking.pick(this.input.pointer.x, this.input.pointer.y);
    }
    this.hint();
    this.line();
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

  private tooSlow(): void {
    if (this.quality !== "high" || this.qForced) return;
    this.slow = true;
    this.setQuality("low", false);
  }

  private setQuality(q: Quality, remember: boolean): void {
    if (remember) { this.qForced = q; this.check.start(false); try { localStorage.setItem(QKEY, q); } catch { /* ignore */ } }
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

  /** Fly to `to` over `dur` s (by default by the distance, flyS); `free`: land walking there, else hold (at a terminal). */
  private fly(to: Shot, delay = 0, free = false, done?: () => void, dur = flyS(this.camera.position.distanceTo(to.position))): void {
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
    this.camera.position.set(this.walk.pos.x, this.home0.position.y, this.walk.pos.y);
    this.walk.quaternion(this.camera.quaternion);
    this.camera.fov = this.home0.fov; this.glow = 1;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }

  /** Standing in front of a terminal, outside its zone, looking at its screen. */
  private standBack(name: string): Shot | null {
    const t = this.walk.terminals.find(q => q.name === name);
    if (!t) return null;
    this.walk.disarm(name);
    const p = this.walk.standBack(t);
    return shotOf({ position: new THREE.Vector3(p.x, this.home0.position.y, p.y), target: t.screen, fov: this.home0.fov });
  }

  /** In a terminal's zone: its name and how to go in, by its screen. */
  private hint(): void {
    const t = this.mode === "free" ? this.walk.near : null;
    if (!t) { if (this.labelEl.dataset.hint) { this.labelEl.style.display = "none"; delete this.labelEl.dataset.hint; } return; }
    if (this.picking.hover) return;
    const v = t.screen.clone().project(this.camera), r = this.renderer.domElement.getBoundingClientRect(), hr = this.host.getBoundingClientRect();
    const p = this.room.placed.find(q => q.name === t.name);
    this.labelEl.textContent = `${p ? this.picking.nameOf(p) : t.name} · ${t.name === "switch" ? "press E or L" : t.use || !this.walk.auto ? "press E" : "approach or press E"}`;
    this.labelEl.style.left = `${r.left - hr.left + (v.x + 1) / 2 * r.width}px`;
    this.labelEl.style.top = `${r.top - hr.top + (1 - v.y) / 2 * r.height + 24}px`;
    this.labelEl.style.display = "block"; this.labelEl.dataset.hint = t.name;
  }

  private anchorShot(name: string, which: "camera" | "view" = "camera"): Shot | null {
    return anchorShot(this.room.placed.find(q => q.name === name), which);
  }

  private matchShot(name: string, rect: DOMRect): Shot | null {
    const m = matchShot(this.room.placed.find(q => q.name === name), rect, this.renderer.domElement.getBoundingClientRect(), this.camera);
    if (m) this.mismatch = m.mismatch;
    return m && m.shot;
  }

  /** The crosshair while locked; at a close-up, the line on how to go on (the station's, or the shelf's own). */
  private lockUI(): void {
    this.crossEl.style.display = this.shown && this.input.locked ? "block" : "none";
    this.atEl.style.display = this.shown && this.at ? "block" : "none";
    const at = this.at && this.room.placed.find(q => q.name === this.at!.name);
    if (this.at) this.atEl.textContent = `${at?.equipment.hint?.() ?? stationOpening(this.at.opens)?.at ?? ""} · Esc to step back`;
  }

  // ---- use ----

  /** Use a machine: flip it in place (the switch), follow its link (the door; out of pointer lock first, so the new
   *  tab is not opened under a captured mouse), or fly into it. */
  private use(p: Placed): true {
    if (p.equipment.inert) return true;   // a prop: named on hover, nothing to do
    if (p.equipment.anchors.href) this.input.unlock();
    if (p.equipment.use) p.equipment.use(); else this.setTarget(p.name);
    return true;
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

