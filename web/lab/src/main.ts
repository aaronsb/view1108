// Entry: the one global the page sees, VIEW_LAB. Loading this bundle only defines it; nothing runs, no WebGL context
// exists and no animation frame is requested until start().
import { Lab } from "./lab";
import type { LabEvent, LabHooks } from "./types";

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
  setTarget(name: string | null): boolean { return lab ? lab.setTarget(name) : false; },
  event(e: LabEvent): void { lab?.event(e); },
  get running(): boolean { return !!lab; },
  /** Quality tier, draw calls and triangles of the last frame, the last handover's mismatch (px): for tests. */
  info() { return lab?.info ?? null; },
  /** Client px of a placed equipment's screen: for tests. */
  project(name: string) { return lab?.project(name) ?? null; },
  /** The room from above, ceiling left out, `px` pixels per metre, as a PNG data URL: for tests. */
  plan(px?: number) { return lab?.plan(px) ?? null; },
  /** Footprints of the pieces on the floor and the door: for tests. */
  layout() { return lab?.layout ?? null; },
};

(window as unknown as { VIEW_LAB: typeof VIEW_LAB }).VIEW_LAB = VIEW_LAB;
