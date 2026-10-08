// The lab's input: pointer (click, drag to look, pinch, wheel), the pointer lock and the keys. lab.ts owns one and
// passes the parts of itself that input acts on (the walk, the camera, the mode, the close-up, using a machine).
import * as THREE from "three";
import type { Walk } from "./walk";
import type { Opens, Placed } from "./types";

const CLICK_PX = 5;
const LOOK_DEG = 0.12;              // turn per mouse count while the pointer is locked, deg
const ESC_MS = 250;                 // an Esc this soon after the lock went is the one that released it
const WHEEL_M = 0.0018;             // metres stepped per wheel pixel
const D2R = Math.PI / 180;
/** Keys the walk leaves to the page while the room is shown (modifier chords pass too). */
const PASS = /^(Escape|Tab|F\d+|m|M)$/;

export interface InputView {
  canvas: HTMLCanvasElement; camera: THREE.PerspectiveCamera; walk: Walk;
  shown(): boolean;
  mode(): "free" | "flight" | "hold";
  at(): { name: string; opens: Opens } | null;
  hover(): Placed | null;
  hit(x: number, y: number): Placed | null;
  use(p: Placed): true;
  open(binder?: string): void;
  back(): boolean;
  pulledOut(): void;
  clearHover(): void;
  lockUI(): void;
  toggleLights(): void;
}

export class Input {
  /** The viewer has looked, stepped or clicked: the top line drops its instructions. */
  engaged = false;
  locked = false;
  lockFailed = false;
  /** Where the pointer is over the canvas (unlocked), for hover. */
  pointer: { x: number; y: number } | null = null;
  drag: { id: number; x: number; y: number; yaw: number; pitch: number; t: number; moved: boolean } | null = null;
  private pinch = new Map<number, { x: number; y: number }>();
  private pinchD = 0;
  private unlockT = -Infinity;

  constructor(private v: InputView) {
    const c = v.canvas;
    c.addEventListener("pointerdown", this.onDown);
    c.addEventListener("pointermove", this.onMove);
    c.addEventListener("pointerup", this.onUp);
    c.addEventListener("pointercancel", this.onUp);
    c.addEventListener("pointerleave", this.onLeave);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyCapture, true);
    window.addEventListener("keyup", this.onKeyCapture, true);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("pointerlockerror", this.onLockError);
    document.addEventListener("mousemove", this.onLook);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyCapture, true);
    window.removeEventListener("keyup", this.onKeyCapture, true);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("pointerlockerror", this.onLockError);
    document.removeEventListener("mousemove", this.onLook);
  }

  // ---- pointer ----

  private onDown = (e: PointerEvent) => {
    const v = this.v;
    if (this.locked) { if (e.button === 0 && v.hover()) v.use(v.hover()!); return; }   // the crosshair's target
    if (e.pointerType === "touch") {
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) { const [a, b] = [...this.pinch.values()]; this.pinchD = Math.hypot(a.x - b.x, a.y - b.y); this.drag = null; return; }
    }
    if (e.button !== 0) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: v.walk.yaw, pitch: v.walk.pitch, t: performance.now(), moved: false };
    v.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    const v = this.v;
    if (this.locked) return;   // onLook turns
    const r = v.canvas.getBoundingClientRect();
    this.pointer = { x: e.clientX, y: e.clientY };
    if (this.pinch.has(e.pointerId)) {
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) {
        const [a, b] = [...this.pinch.values()], dd = Math.hypot(a.x - b.x, a.y - b.y);
        if (v.mode() === "free") v.walk.nudge((dd - this.pinchD) * 0.006);
        this.pinchD = dd;
        return;
      }
    }
    const g = this.drag;
    if (!g || g.id !== e.pointerId || v.mode() !== "free") return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < CLICK_PX) return;
    if (!g.moved) { g.moved = true; this.engaged = true; v.clearHover(); }
    const radPx = v.camera.fov * D2R / r.height;   // mouselook as in a first-person game: drag right looks right, drag down looks down
    v.walk.turn(g.yaw - dx * radPx - v.walk.yaw, g.pitch - dy * radPx - v.walk.pitch);
  };

  private onUp = (e: PointerEvent) => {
    const v = this.v;
    this.pinch.delete(e.pointerId);
    const g = this.drag;
    if (!g || g.id !== e.pointerId) return;
    this.drag = null;
    if (g.moved || e.type !== "pointerup") return;
    // At a close-up a click on the machine opens it; on a shelf a click on a book pulls it out, again opens it; a note
    // in the console's notebook is keyed in. A click on anything else (the bookcase's own frame, the room, another
    // machine) steps back into the room.
    const at = v.at();
    if (at) {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) >= CLICK_PX) return;
      const p = v.hit(e.clientX, e.clientY);
      if (p?.equipment.press) p.equipment.press();
      else if (p?.equipment.pull) { if (p.equipment.pull()) v.open(p.name); else v.pulledOut(); }
      else if (p && p.name === at.name && at.opens !== "library") v.open();
      else v.back();
      return;
    }
    if (v.mode() !== "free") return;
    const p = v.hit(e.clientX, e.clientY);
    if (p) v.use(p);
    else if (e.pointerType === "mouse") this.lock();
    this.engaged = true;
  };

  // ---- pointer lock ----

  private lock(): void {
    const c = this.v.canvas;
    if (this.locked || !c.requestPointerLock) return;
    const fail = () => { this.lockFailed = true; this.v.lockUI(); };
    // Raw counts where the browser has them (no OS acceleration), else the plain lock; either may refuse.
    const plain = () => { try { Promise.resolve(c.requestPointerLock()).catch(fail); } catch { fail(); } };
    try { Promise.resolve(c.requestPointerLock({ unadjustedMovement: true })).catch(plain); } catch { plain(); }
  }

  unlock(): void {
    if (document.pointerLockElement === this.v.canvas) document.exitPointerLock();
  }

  /** Esc reached the page while the room is shown: the lock's own if it is still held (released now) or went just
   *  now. */
  escLock(): boolean {
    if (this.locked) { this.unlock(); return true; }
    return performance.now() - this.unlockT < ESC_MS;
  }

  private onLockChange = () => {
    const v = this.v, on = document.pointerLockElement === v.canvas;
    // A lock granted after a flight took off (asked for just before it) would leave the camera locked at a close-up.
    if (on && v.mode() !== "free") { this.unlock(); return; }
    if (on === this.locked) return;
    this.locked = on; this.drag = null; this.pointer = null; v.clearHover();
    if (on) { this.engaged = true; this.lockFailed = false; } else this.unlockT = performance.now();
    v.lockUI();
  };

  private onLockError = () => { if (!this.locked) { this.lockFailed = true; this.v.lockUI(); } };

  /** Locked: mouse right looks right, mouse down looks down. */
  private onLook = (e: MouseEvent) => {
    if (!this.locked || this.v.mode() !== "free") return;
    const k = LOOK_DEG * D2R;
    this.v.walk.turn(-e.movementX * k, -e.movementY * k);
  };

  private onLeave = () => { this.pointer = null; this.v.clearHover(); };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.v.mode() === "free") this.v.walk.nudge(-e.deltaY * (e.deltaMode === 1 ? 28 : 1) * WHEEL_M);
  };

  // ---- keys ----

  /** While the room is shown its keys are the walk's (and E/Enter for a terminal in range); the page gets none but
   *  PASS and modifier chords, so its plot keys cannot act behind the room. Esc is PASS: the page's stack has it. */
  private onKeyCapture = (e: KeyboardEvent) => {
    const v = this.v;
    if (!v.shown()) return;
    if (e.type === "keyup") { v.walk.key(e.key, false, e.shiftKey); return; }
    if (v.at() && v.mode() === "hold" && !e.ctrlKey && !e.metaKey && !e.altKey) {   // at a close-up
      const k = e.key;
      if (v.walk.key(k, true, e.shiftKey)) { e.stopImmediatePropagation(); e.preventDefault(); v.back(); return; }
      if (k === "e" || k === "E" || k === "Enter") { e.stopImmediatePropagation(); e.preventDefault(); v.open(); return; }
    }
    if (e.ctrlKey || e.metaKey || e.altKey || PASS.test(e.key)) return;
    e.stopPropagation();
    if (v.mode() !== "free") return;
    if (v.walk.key(e.key, true, e.shiftKey)) { e.preventDefault(); this.engaged = true; }
    else if ((e.key === "e" || e.key === "E" || e.key === "Enter") && (this.locked && v.hover() ? v.use(v.hover()!) : v.walk.enter())) e.preventDefault();
    else if (e.key === "l" || e.key === "L") { e.preventDefault(); v.toggleLights(); }
    else if (e.key === " ") e.preventDefault();
  };

  private onBlur = () => this.v.walk.clearKeys();
}
