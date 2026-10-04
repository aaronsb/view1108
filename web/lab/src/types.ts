// The lab's interfaces: the page <-> lab contract, and the contract between the room and its equipment.
import type * as THREE from "three";

/** What a terminal opens when the camera arrives at it: the plot tabs, or the Source tab. */
export type Opens = "workbench" | "source";

/** The page's state, read by the lab once per rendered frame (web/src/room.js labState()). */
export interface LabState {
  tab: string;            // review | simulate | print | fusion | source
  mode: string;           // attract | tour | live | free | beam
  playing: boolean;
  get: number;            // g.e.t., s
  scene: number;
  frameNo: number;        // kernel frames drawn since boot; the vector screen is stale when this moves
  sound: { ctx: AudioContext | null; out: AudioNode | null; on: boolean };   // web/src/sound.js sndCtx, sndOut, sndOn
}

/** Discrete events the page sends (VIEW_LAB.event): a beam frame finished, the engine ran, a key clicked. */
export interface LabEvent {
  type: "beamFrame" | "tape" | "key";
  at: number;             // performance.now() time it happens
}

/** Hooks the page hands to VIEW_LAB.start. */
export interface LabHooks {
  screens: { vector: HTMLCanvasElement };   // #cv, the plot
  state(): LabState;
  /** The camera reached a terminal: the page shows the tab it opens and asks the lab to hide. */
  arrive(opens: Opens): void;
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
}

/** Named points on a piece of equipment, in its own frame (the room's placement transforms them). */
export interface Anchors {
  screen?: ScreenAnchor;
  camera?: CameraPose;    // the zoom-in pose; with `opens`, clicking the equipment flies here
  [name: string]: unknown;
}

/** What an equipment module's build() returns. */
export interface Equipment {
  object: THREE.Object3D;
  anchors: Anchors;
  opens?: Opens;
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

/** What a room module's build() returns. */
export interface Room {
  object: THREE.Object3D;
  placed: Placed[];
  overview: CameraPose;   // the zoomed-out pose
}
