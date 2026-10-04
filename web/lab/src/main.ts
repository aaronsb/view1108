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
  show(from?: string): void { lab?.show(from); },
  hide(): void { lab?.hide(); },
  setTarget(name: string | null): boolean { return lab ? lab.setTarget(name) : false; },
  event(e: LabEvent): void { lab?.event(e); },
  get running(): boolean { return !!lab; },
};

(window as unknown as { VIEW_LAB: typeof VIEW_LAB }).VIEW_LAB = VIEW_LAB;
