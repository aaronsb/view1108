// The lab's interfaces: the page <-> lab contract, and the contract between the room and its equipment.
import type * as THREE from "three";

/** What a terminal opens when the camera arrives at it: the plot tabs, the Source tab, the Print tab, the kernel
 *  listing on greenbar (the line printer), or the reference library (the bookcase and its binders). */
export type Opens = "workbench" | "source" | "print" | "listing" | "library";

/** The page's state, read by the lab once per rendered frame (web/src/room.js labState()). */
export interface LabState {
  tab: string;            // review | simulate | print | fusion | source
  mode: string;           // attract | tour | live | free | beam
  playing: boolean;
  get: number;            // g.e.t., s
  scene: number;
  frameNo: number;        // kernel frames drawn since boot; the vector screen is stale when this moves
  /** web/src/sound.js sndCtx, sndOut, sndOn, and soundBed (the page's ambience bed on or off; the room's sound
   *  replaces it while the room runs), and whineNode (the deflection whine at the 1558 and the film recorder,
   *  web/src/whine.js). */
  sound: { ctx: AudioContext | null; out: AudioNode | null; on: boolean; bed?(on: boolean): void; whine?: { scope: AudioNode; recorder: AudioNode } | null; printer?(node: AudioNode | null): void };
}

/** Discrete events the page sends (VIEW_LAB.event): a beam frame finished, the engine ran, a key clicked, the
 *  listing printed `lines` lines (a fresh copy, or a page fed on arrival). */
export interface LabEvent {
  type: "beamFrame" | "tape" | "key" | "print";
  at: number;             // performance.now() time it happens
  lines?: number;
}

/** Hooks the page hands to VIEW_LAB.start. */
export interface LabHooks {
  screens: { vector: HTMLCanvasElement };   // #cv, the plot
  state(): LabState;
  /** The terminal was opened at its close-up: the page shows the tab it opens, fades the lab out and asks it to hide. `name` is
   *  the placed name flown to ("binder:<id>" picks that document in the library). */
  arrive(opens: Opens, name: string): void;
  /** Lay the page out for `opens` behind the room, without showing it, and give the client rect of the element the
   *  terminal's screen becomes (#cv for the workbench, the Source workspace for source). The lab ends its flight
   *  where the screen covers that rect, so the crossfade lines up. */
  screenRect?(opens: Opens): DOMRect | null;
  /** The camera stepped back from a terminal's close-up without opening it: undo what screenRect laid out. */
  leave?(opens: Opens): void;
}

/** A camera pose: where the eye is, what it looks at, its vertical field of view (deg). */
export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

/** A screen face on a piece of equipment: the mesh carrying the picture and the part of its UV square in use. */
export interface ScreenAnchor {
  mesh: THREE.Mesh;
  uvRect: [number, number, number, number];   // u0, v0, u1, v1
  /** What the handover matches to the page's rect: the height (the default) or the width. */
  fit?: "height" | "width";
}

/** Named points on a piece of equipment, in its own frame (the room's placement transforms them). */
export interface Anchors {
  screen?: ScreenAnchor;
  camera?: CameraPose;    // the zoom-in pose; with `opens`, clicking the equipment flies here (or to `view`)
  view?: CameraPose;      // the arrival pose of a console: its screen and keyboard together, as its operator sees them
  lamps?: Face & { center: THREE.Vector3 };   // a lamp panel's face, for its glow
  [name: string]: unknown;
}

/** What an equipment module's build() returns. */
export interface Equipment {
  object: THREE.Object3D;
  anchors: Anchors;
  opens?: Opens;
  /** Something done in place when clicked or used on foot (E), instead of opening a tab: the light switch. */
  use?(): void;
  /** For looks only (the props on the bookcase): named on hover, and a click on it does nothing. */
  inert?: boolean;
  /** The camera is flying to this piece (true) or the room is shown again (false): a binder slides out and back. */
  select?(on: boolean): void;
  update?(dt: number, state: LabState): void;
  event?(e: LabEvent, state: LabState): void;
  dispose?(): void;
}

/** Shared resources an equipment builder may use. */
export interface BuildContext {
  /** The plot (#cv) as a texture; the lab marks it dirty when the page draws a frame. */
  vectorScreen: THREE.Texture;
  /** Anisotropy the renderer supports, for screen textures seen at an angle. */
  maxAnisotropy: number;
}

export type EquipmentBuilder = (ctx: BuildContext) => Equipment;

/** A piece of equipment placed in the room, under a name the page and other modules can find it by. */
export interface Placed {
  name: string;
  equipment: Equipment;
}

/** What a placed equipment covers on the floor: a rectangle centred at (x, z), half-sizes `hw` across its front and
 *  `hd` deep, turned `turn` about the vertical (as the equipment is). Metres. */
export interface Footprint { name: string; x: number; z: number; hw: number; hd: number; turn: number }

/** What a room module's build() returns. */
export interface Room {
  object: THREE.Object3D;
  placed: Placed[];
  overview: CameraPose;   // the zoomed-out pose
  /** Every piece standing on the floor, for walking and the plan's checks. */
  footprints?: Footprint[];
  /** The door: its centre's x on the wall at z, its width. */
  door?: { x: number; z: number; w: number };
  /** Hover labels by placed name, for the equipment that opens something and the inert props. */
  labels?: Record<string, string>;
  /** Region the dust drifts in. */
  air?: THREE.Box3;
  /** The light switch: whether the troffers are on (the soundscape's ballasts follow it), setting it (the switch's
   *  lever), each tube's light, and the dim lights that stand for the equipment's glow when they are off. */
  lightsOn?: boolean;
  setLights?(on: boolean): void;
  tubes?(level: (k: number) => number): void;
  glows?: Glow[];
  update?(dt: number, state: LabState): void;
  dispose?(): void;
}

/** A flat lit face: its outward normal and its size, metres. */
export interface Face { normal: THREE.Vector3; w: number; h: number }

/** A dim light standing for an equipment's glow (a screen, a lamp row or panel, the EXIT sign): `pos` is the glowing
 *  face's centre, `face` its facing and size where it has one (an area light at high quality). `always`: it shines
 *  with the troffers on too (the lamp panels); the others only with them off. */
export interface Glow { pos: THREE.Vector3; color: number; intensity: number; distance: number; face?: Face; always?: boolean }

/** Rendering tier: "high" (shadows, ambient occlusion, bloom) or "low" (direct render, no post). */
export type Quality = "high" | "low";
