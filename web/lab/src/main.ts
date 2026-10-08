// Entry: the one global the page sees, VIEW_LAB. Loading this bundle only defines it; nothing runs, no WebGL context
// exists and no animation frame is requested until start().
import { Lab } from "./lab";
import type { LabEvent, LabHooks } from "./types";
import { STATIONS } from "./stations";

let lab: Lab | null = null;

const VIEW_LAB = {
  /** A cheap guess that WebGL may work, without creating a context. start() is the real test. */
  supported(): boolean { return typeof WebGLRenderingContext !== "undefined"; },
  /** Build the room into host. False (and nothing left behind) when WebGL fails. */
  start(host: HTMLElement, hooks: LabHooks): boolean {
    if (lab) return true;
    try { lab = new Lab(host, hooks); return true; }
    catch (e) { console.warn("lab: no WebGL", e); host.replaceChildren(); return false; }
  },
  /** Dispose of everything, the WebGL context included. */
  stop(): void { lab?.dispose(); lab = null; },
  /** Show the room; with a terminal name and the page element's rect, start where its screen covers that rect. */
  show(from?: string, rect?: DOMRect | null, holdMs?: number): void { lab?.show(from, rect, holdMs); },
  hide(): void { lab?.hide(); },
  /** Reel `id` out at the tape rack and carried to a tape unit (the notebook viewer's "Load this reel"; call after
   *  show()). False when the room is not running or the reel is not on the rack. */
  carry(id: string): boolean { return lab ? lab.carryReel(id) : false; },
  /** The page's answer to its modal (LabHooks.ask) for what was pulled: back, load, read, or loadread. */
  answer(choice: "back" | "load" | "read" | "loadread"): void { lab?.answer(choice); },
  /** Fly to a placed equipment (null: the overview); a terminal holds at its close-up, or with `open` opens at once. */
  setTarget(name: string | null, open?: boolean): boolean { return lab ? lab.setTarget(name, open) : false; },
  /** At a terminal's close-up: step back out in front of it (false when not at one). */
  back(): boolean { return lab ? lab.back() : false; },
  /** The station table (stations.ts), which the page's room.js reads: what each terminal opens, and the tabs it is. */
  stations: STATIONS,
  /** An Esc that reached the page while the room is shown: true when it was the pointer lock's (web/src/esc.js). */
  escLock(): boolean { return lab ? lab.escLock() : false; },
  /** The room's bottom Esc: walk back to the overview (false when already there, or not walking). */
  home(): boolean { return lab ? lab.home() : false; },
  /** Walk-up auto-entry on or off (remembered); off by default. */
  walkup(on: boolean): void { lab?.setWalkup(on); },
  event(e: LabEvent): void { lab?.event(e); },
  get running(): boolean { return !!lab; },
  /** Quality tier, draw calls and triangles of the last frame, the last handover's mismatch (px), the page's loaded
   *  state as the lab reads it and the UTC its clocks show: for tests. */
  info() { return lab?.info ?? null; },
  /** Client px of a placed equipment's screen (else its origin), `lift` metres above it: for tests. */
  project(name: string, lift?: number) { return lab?.project(name, lift) ?? null; },
  /** The room from above, ceiling left out, `px` pixels per metre, as a PNG data URL: for tests. */
  plan(px?: number) { return lab?.plan(px) ?? null; },
  /** Footprints of the pieces on the floor and the door: for tests. */
  layout() { return lab?.layout ?? null; },
  /** The light switch: set the troffers on or off (omitted: leave them), and say which. */
  lights(on?: boolean): boolean { return lab ? lab.lights(on) : false; },
  /** Stand at (x, z), looking yaw degrees left of north, pitch up: for tests. */
  stand(x: number, z: number, yaw: number, pitch?: number) { lab?.stand(x, z, yaw, pitch); },
};

(window as unknown as { VIEW_LAB: typeof VIEW_LAB }).VIEW_LAB = VIEW_LAB;
