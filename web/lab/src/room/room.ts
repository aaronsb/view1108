// The machine room: the shell (shell.ts) and the equipment placed in it by registry name.
//
// The layout is ours. The MSC photograph of 15 July 1969 shows tape drives in a row, a work table with stacked
// reels, a card reader and printers, but no floor plan survives; this arrangement puts the same kinds of machine
// in a 9 m by 7 m room so that one standing view from the south-east takes in the terminals and the tapes:
// UNISERVO drives along the north wall, the 1108's cabinets along the west wall (the lamp-panel cabinet at the
// centre), the 4009 operator console facing the tapes, the reel table at the centre, and in the east half a desk
// with the UNISCOPE 100 beside the 1558 graphic console, turned toward the viewer, with its 1557 controller behind
// them. Along the east wall the microfilm recorder, downstream of the computer as the film was, then the printer;
// the card reader in the south-west corner. The door is in the south wall, west of centre, with nothing in its
// swing and a clear aisle from it into the room; every front has an aisle of at least 0.9 m (the plan's check,
// `footprints`, is what the walk collides with).
//
// A name the registry lacks is placed as a neutral grey box of its FOOTPRINT, so the room composes before every
// module exists.
import * as THREE from "three";
import { EQUIPMENT, FOOTPRINT } from "../equipment";
import type { BuildContext, Equipment, Footprint, Placed, Room } from "../types";
import { DOOR, ROOM, buildShell } from "./shell";
import { batch } from "./batch";

/** A builder with the options some modules take (a tape drive's number, the CPU cabinet with the lamp panel). */
type Builder = (ctx: BuildContext, opts?: Record<string, unknown>) => Equipment;

/** Turns about the vertical: the front (+Z in the module's frame) toward north, east, south, west. */
const N = Math.PI, E = Math.PI / 2, S = 0, W = -Math.PI / 2;

const STANDIN = new THREE.MeshStandardMaterial({ color: 0x8e908c, roughness: 0.8 });

function standIn(kind: string): Equipment {
  const [w, h, d] = FOOTPRINT[kind] ?? [0.5, 0.5, 0.5];
  const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, STANDIN); m.castShadow = m.receiveShadow = true;
  const object = new THREE.Group(); object.add(m);
  return { object, anchors: {}, dispose() { g.dispose(); } };
}

export function build(ctx: BuildContext): Room {
  const object = new THREE.Group(), placed: Placed[] = [], footprints: Footprint[] = [];
  const shell = buildShell(ctx.maxAnisotropy);
  object.add(shell.object);
  let count = 0;

  /** Place a module by registry name at (x, y, z), turned `turn` about the vertical; `name` is how others find it.
   *  Standing on the floor, it gets a footprint: its own bounding box seen from above, placed and turned. */
  const place = (kind: string, at: [number, number, number], turn: number, name = `${kind}-${++count}`, opts?: Record<string, unknown>) => {
    const equipment = EQUIPMENT[kind] ? (EQUIPMENT[kind] as Builder)(ctx, opts) : standIn(kind);
    const o = equipment.object, b = new THREE.Box3().setFromObject(o);
    o.position.set(...at); o.rotation.y = turn;
    o.userData.placed = name;
    o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    object.add(o);
    placed.push({ name, equipment });
    if (at[1] === 0 && !b.isEmpty()) {
      const c = new THREE.Vector3((b.min.x + b.max.x) / 2, 0, (b.min.z + b.max.z) / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
      footprints.push({ name, x: at[0] + c.x, z: at[2] + c.z, hw: (b.max.x - b.min.x) / 2, hd: (b.max.z - b.min.z) / 2, turn });
    }
    return equipment;
  };
  const top = (e: Equipment, dflt: number) => (e.anchors.top as THREE.Vector3 | undefined)?.y ?? dflt;

  const nW = ROOM.d / 2, wW = ROOM.w / 2;
  for (let i = 0; i < 7; i++) place("uniservo", [-2.7 + i * 0.82, 0, -nW + 0.45], S, undefined, { number: 60 + i, index: i + 1 });
  for (let i = 0; i < 5; i++) place("cpu", [-wW + 0.48, 0, -1.64 + i * 0.82], E, undefined, { lampPanel: i === 2 });
  place("console4009", [-1.2, 0, -1.0], N);
  place("chair", [-1.2, 0, -0.3], N);
  place("reeltable", [0.75, 0, 1.2], 0.08);
  place("chair", [1.5, 0, 1.85], -2.4);

  const desk = place("desk", [2.6, 0, -1.25], -0.19, "desk");
  const dt = top(desk, FOOTPRINT.desk[1]);
  desk.object.updateMatrixWorld();
  const glassAt = desk.object.localToWorld(new THREE.Vector3(0.25, dt, -0.05));
  place("glass", [glassAt.x, glassAt.y, glassAt.z], -0.19, "glass");
  place("chair", [2.55, 0, -0.5], N - 0.19);
  place("vector", [1.2, 0, -1.0], 0.32, "vector");   // beside the desk, turned toward the overview's eye
  place("controller1557", [3.4, 0, -nW + 0.38], S);
  place("filmrecorder", [wW - 0.47, 0, 0.85], W, "filmrecorder");
  place("printer", [wW - 0.4, 0, 2.75], W);
  place("cardreader", [-wW + 0.37, 0, nW - 0.65], E);
  const batches = batch(object, placed);
  object.add(batches.object);

  return {
    object,
    placed,
    footprints,
    door: { x: DOOR.x, z: nW, w: DOOR.w },
    overview: { position: new THREE.Vector3(2.4, 1.62, 3.15), target: new THREE.Vector3(0.1, 1.0, -1.6), fov: 55 },
    labels: { vector: "UNIVAC 1558 — workbench", glass: "UNISCOPE 100 — source", filmrecorder: "Microfilm recorder (S-C 4020, hypothetical) — print" },
    air: new THREE.Box3(new THREE.Vector3(-4, 0.3, -2.9), new THREE.Vector3(4, 2.5, 3.1)),
    update() { shell.update(); batches.update(); },
    dispose() { shell.dispose(); batches.dispose(); STANDIN.dispose(); },
  };
}
