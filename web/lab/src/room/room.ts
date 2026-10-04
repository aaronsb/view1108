// The machine room: the shell (shell.ts) and the equipment placed in it by registry name.
//
// The layout is ours. The MSC photograph of 15 July 1969 shows tape drives in a row, a work table with stacked
// reels, a card reader and printers, but no floor plan survives; this arrangement puts the same kinds of machine
// in an 8 m by 6 m room so that one standing view from the south-east takes in the terminals and the tapes:
// UNISERVO drives along the north wall, the 1108's cabinets along the west wall (the lamp-panel cabinet at the
// centre), the 4009 operator console at centre-west facing the tapes, the reel table at the centre, and in the
// east half a desk with the UNISCOPE 100 beside the 1558 graphic console, turned toward the viewer, with its 1557
// controller behind them. Printer in the south-east, card reader in the south-west.
//
// A name the registry lacks is placed as a neutral grey box of the machine's size, so the room composes before
// every module exists. "vector" and "glass" fall back to the phase-A placeholders while those are registered
// under their old names.
import * as THREE from "three";
import { EQUIPMENT } from "../equipment";
import type { BuildContext, Equipment, Placed, Room } from "../types";
import { ROOM, buildShell } from "./shell";

/** Sizes in metres, W x H x D, for the stand-ins (the modules model the real things). */
const SIZE: Record<string, [number, number, number]> = {
  vector: [0.9, 1.5, 1.25], glass: [0.46, 0.33, 0.69], uniservo: [0.75, 1.8, 0.75], cpu: [0.8, 1.9, 0.8],
  console4009: [1.8, 0.75, 0.9], controller1557: [1.2, 1.6, 0.6], printer: [1.4, 1.2, 0.8], cardreader: [1.0, 1.1, 0.7],
  reeltable: [1.6, 0.75, 0.8], desk: [1.5, 0.73, 0.75], chair: [0.6, 0.85, 0.6], "vector-plinth": [0.9, 0.85, 1.0],
};
const ALIAS: Record<string, string[]> = { vector: ["vector-terminal"], glass: ["glass-terminal"] };
/** A builder with the options some modules take (a tape drive's number, the CPU cabinet with the lamp panel). */
type Builder = (ctx: BuildContext, opts?: Record<string, unknown>) => Equipment;

/** Turns about the vertical: the front (+Z in the module's frame) toward north, east, south, west. */
const N = Math.PI, E = Math.PI / 2, S = 0, W = -Math.PI / 2;

const STANDIN = new THREE.MeshStandardMaterial({ color: 0x8e908c, roughness: 0.8 });

function standIn(kind: string): Equipment {
  const [w, h, d] = SIZE[kind] ?? [0.5, 0.5, 0.5];
  const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, STANDIN); m.castShadow = m.receiveShadow = true;
  const object = new THREE.Group(); object.add(m);
  return { object, anchors: {}, dispose() { g.dispose(); } };
}

export function build(ctx: BuildContext): Room {
  const object = new THREE.Group(), placed: Placed[] = [];
  const shell = buildShell(ctx.maxAnisotropy);
  object.add(shell.object);
  let count = 0;

  /** Place a module by registry name at (x, y, z), turned `turn` about the vertical; `name` is how others find it. */
  const place = (kind: string, at: [number, number, number], turn: number, name = `${kind}-${++count}`, opts?: Record<string, unknown>) => {
    const key = [kind, ...(ALIAS[kind] ?? [])].find(k => EQUIPMENT[k]);
    const equipment = key ? (EQUIPMENT[key] as Builder)(ctx, opts) : standIn(kind);
    const o = equipment.object;
    o.position.set(...at); o.rotation.y = turn;
    o.userData.placed = name;
    o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    object.add(o);
    placed.push({ name, equipment });
    return equipment;
  };
  const top = (e: Equipment, dflt: number) => (e.anchors.top as THREE.Vector3 | undefined)?.y ?? dflt;

  const nW = ROOM.d / 2, wW = ROOM.w / 2;
  for (let i = 0; i < 7; i++) place("uniservo", [-2.7 + i * 0.82, 0, -nW + 0.45], S, undefined, { number: 60 + i, index: i + 1 });
  for (let i = 0; i < 5; i++) place("cpu", [-wW + 0.48, 0, -1.64 + i * 0.82], E, undefined, { lampPanel: i === 2 });
  place("console4009", [-1.55, 0, -0.95], N);
  place("chair", [-1.55, 0, -0.25], N);
  place("reeltable", [-0.25, 0, 0.55], 0.08);
  place("chair", [0.55, 0, 1.15], -2.4);

  const desk = place("desk", [2.7, 0, -1.3], -0.19, "desk");
  const dt = top(desk, SIZE.desk[1]);
  desk.object.updateMatrixWorld();
  const glassAt = desk.object.localToWorld(new THREE.Vector3(0.25, dt, -0.05));
  place("glass", [glassAt.x, glassAt.y, glassAt.z], -0.19, "glass");
  place("chair", [2.65, 0, -0.55], N - 0.19);
  // The 1558 beside the desk, turned toward the overview's eye.
  if (EQUIPMENT.vector) place("vector", [1.05, 0, -1.25], 0.32, "vector");
  else {
    // Phase-A placeholder: a small cabinet; stand it on a grey pedestal at a console's height.
    place("vector-plinth", [1.05, 0, -1.25], 0.32, "vector-plinth");
    const v = place("vector", [1.05, 0, -1.25], 0.32, "vector");
    v.object.position.y = 0.85;
  }
  place("controller1557", [3.25, 0, -nW + 0.38], S);
  place("printer", [ROOM.w / 2 - 0.5, 0, 1.6], W);
  place("cardreader", [-2.4, 0, 2.45], E);

  return {
    object,
    placed,
    overview: { position: new THREE.Vector3(1.9, 1.62, 2.7), target: new THREE.Vector3(0.15, 1.0, -1.5), fov: 55 },
    labels: { vector: "UNIVAC 1558 — workbench", glass: "UNISCOPE 100 — source" },
    air: new THREE.Box3(new THREE.Vector3(-3.5, 0.3, -2.4), new THREE.Vector3(3.5, 2.5, 2.6)),
    update() { shell.update(); },
    dispose() { shell.dispose(); STANDIN.dispose(); },
  };
}
