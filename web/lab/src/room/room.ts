// The machine room: the shell (shell.ts) and the equipment placed in it by registry name.
//
// The layout is ours. The MSC photograph of 15 July 1969 shows tape drives in a row, a work table with stacked
// reels, a card reader and printers, but no floor plan survives; this arrangement puts the same kinds of machine
// in a 9 m by 7 m room so that one standing view from the south-east takes in the terminals and the tapes:
// UNISERVO drives along the north wall, the 1108's five cabinets along the west wall (the lamp-panel cabinet at the
// centre), the 4009 operator console facing the tapes, the reel table at the centre, and in the east half a desk
// with the UNISCOPE 100 beside the 1558 graphic console, turned toward the viewer, with its 1557 controller behind
// them. Along the east wall the microfilm recorder, downstream of the computer as the film was, then the printer;
// the card reader in the south-west corner and the low power distribution cabinet east of it on the south wall; behind the UNISCOPE's desk, against the east wall between the 1557 and the
// film recorder, the reference library's bookcase, facing the room across the desk's back aisle. The door is in the south wall, west of centre, with nothing in its
// swing and a clear aisle from it into the room, and the light switch on its latch side; every front has an aisle of
// at least 0.9 m (the plan's check, `footprints`, is what the walk collides with).
//
// A name the registry lacks is placed as a neutral grey box of its FOOTPRINT, so the room composes before every
// module exists.
import * as THREE from "three";
import { EQUIPMENT, FOOTPRINT } from "../equipment";
import type { BuildContext, Equipment, Footprint, Glow, Placed, Room } from "../types";
import { DOOR, ROOM, buildShell } from "./shell";
import { batch } from "./batch";
import type { Binder, Prop } from "../equipment/bookcase";

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
  place("printer", [wW - 0.4, 0, 2.75], W, "printer");
  place("cardreader", [-wW + 0.37, 0, nW - 0.65], E);
  place("powercab", [-2.3, 0, nW - 0.37], N, "power");   // clear of the card reader's front aisle and the door's swing
  // The bookcase; each of its binders is placed under its own name, so it is picked, labelled and flown to alone.
  const library = place("bookcase", [wW - 0.19, 0, -2.2], W, "library");
  const binders = library.anchors.binders as Binder[];
  for (const b of binders) { b.object.userData.placed = `binder:${b.doc.id}`; placed.push({ name: b.object.userData.placed, equipment: b }); }
  const props = library.anchors.props as Prop[];   // for looks: named on hover, inert
  for (const p of props) { p.object.userData.placed = `prop:${p.id}`; placed.push({ name: p.object.userData.placed, equipment: p }); }

  // The light switch (ours): a period toggle plate on the door's latch side; Lab gives it its `use`.
  const sw = lightSwitch();
  sw.object.position.set(DOOR.x + DOOR.w / 2 + 0.22, 1.2, nW - 0.004); sw.object.rotation.y = Math.PI;
  sw.object.userData.placed = "switch"; object.add(sw.object);
  placed.push({ name: "switch", equipment: sw });
  // The door's lever handle on its latch (east) side, 1.02 m up on the leaf's face: the way out, to the repository.
  const handle = doorHandle();
  handle.object.position.set(DOOR.x + DOOR.w / 2 - 0.09, 1.02, nW - 0.0125); handle.object.rotation.y = Math.PI;
  handle.object.userData.placed = "door"; object.add(handle.object);
  placed.push({ name: "door", equipment: handle });

  // What glows, as dim soft lights: with the troffers off the screens, the tape units' lamp row and the EXIT sign;
  // always the lamp panels (the CPU's and the console's). Each is a face the size of what glows: a screen's own face
  // made half as large again, as a CRT's light spreads off its glass and bezel (ours).
  object.updateMatrixWorld(true);
  const glows: Glow[] = [];
  const glow = (name: string, color: number, intensity: number, distance: number) => {
    const m = placed.find(p => p.name === name)?.equipment.anchors.screen?.mesh;
    if (!m) return;
    const b = (m.geometry.computeBoundingBox(), m.geometry.boundingBox!), s = new THREE.Vector3().setFromMatrixScale(m.matrixWorld);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
    glows.push({ pos: b.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld), color, intensity, distance,
      face: { normal, w: 1.5 * (b.max.x - b.min.x) * s.x, h: 1.5 * (b.max.y - b.min.y) * s.y } });
  };
  glow("vector", 0xcfe2ff, 0.7, 4);
  glow("glass", 0x7dff9a, 0.35, 3);
  glow("filmrecorder", 0xbcd4ff, 0.2, 3);
  for (const p of placed) {
    const L = p.equipment.anchors.lamps, mw = p.equipment.object.matrixWorld;
    if (L) glows.push({ pos: L.center.clone().applyMatrix4(mw), color: 0xffb36a, intensity: 0.3, distance: 3, always: true,
      face: { normal: L.normal.clone().transformDirection(mw), w: L.w, h: L.h } });
  }
  // The tape units' lamps along the row's top strip (uniservo.ts: 1.71 m up, 0.356 m out), facing into the room.
  glows.push({ pos: new THREE.Vector3(-0.24, 1.71, -nW + 0.45 + 0.356), color: 0xffe6c0, intensity: 0.25, distance: 5,
    face: { normal: new THREE.Vector3(0, 0, 1), w: 5.6, h: 0.1 } });
  glows.push({ pos: shell.exit.clone(), color: 0xff2a1a, intensity: 0.4, distance: 3, face: { normal: new THREE.Vector3(0, 0, -1), w: 0.36, h: 0.17 } });

  const batches = batch(object, placed);
  object.add(batches.object);

  const room: Room = {
    object,
    placed,
    footprints,
    door: { x: DOOR.x, z: nW, w: DOOR.w },
    overview: { position: new THREE.Vector3(2.4, 1.62, 3.15), target: new THREE.Vector3(0.1, 1.0, -1.6), fov: 55 },
    labels: { vector: "UNIVAC 1558 — workbench", glass: "UNISCOPE 100 — source", filmrecorder: "Microfilm recorder (S-C 4020, hypothetical) — print",
      printer: "Line printer — listing", switch: "Lights", power: "Power distribution — click to open/close the doors", door: "Exit — github.com/aaronsb/view1108", library: "Reference library",
      ...Object.fromEntries(binders.map(b => [`binder:${b.doc.id}`, `${b.doc.num} — ${b.doc.title}`])),
      ...Object.fromEntries(props.map(p => [`prop:${p.id}`, p.label])) },
    lightsOn: true,
    setLights(on) { room.lightsOn = on; sw.set(on); },
    tubes: level => shell.tubes(level),
    glows,
    air: new THREE.Box3(new THREE.Vector3(-4, 0.3, -2.9), new THREE.Vector3(4, 2.5, 3.1)),
    update() { shell.update(); batches.update(); },
    dispose() { shell.dispose(); batches.dispose(); sw.dispose?.(); handle.dispose?.(); STANDIN.dispose(); },
  };
  return room;
}

/** A wall toggle switch on a cream plate, its lever up for on. The plate is its screen anchor (walking up to it). */
function lightSwitch(): Equipment & { set(on: boolean): void } {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.45 }), leverMat = new THREE.MeshStandardMaterial({ color: 0xf2eee2, roughness: 0.3 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.115, 0.006), plateMat); plate.position.z = 0.003;
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.028, 0.009).translate(0, 0.014, 0.0045), leverMat);
  lever.position.z = 0.007; lever.rotation.x = -0.45;
  for (const m of [plate, lever]) { mine.push(m.geometry); object.add(m); }
  mine.push(plateMat, leverMat);
  return {
    object,
    anchors: { screen: { mesh: plate, uvRect: [0, 0, 1, 1] } },
    set(on) { lever.rotation.x = on ? -0.45 : -Math.PI + 0.45; },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}

/** The door's lever handle on a steel rose plate (ours). Using it presses the lever and opens the repository in a new
 *  tab (`anchors.href`; lab.ts releases the pointer lock first). The plate is its screen anchor (walking up to it); an
 *  unseen box around it makes it easier to point at. */
function doorHandle(): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [], href = "https://github.com/aaronsb/view1108";
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8c8c4, roughness: 0.25, metalness: 0.9 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.17, 0.006), steel); plate.position.set(0, -0.03, 0.003);
  const spindle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.04), steel); spindle.position.z = 0.026;
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.02).translate(0.05, 0, 0), steel); lever.position.z = 0.05;
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const pick = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.08), pickMat); pick.position.set(0.04, -0.03, 0.04);
  for (const m of [plate, spindle, lever, pick]) { mine.push(m.geometry); object.add(m); }
  mine.push(steel, pickMat);
  let t = -1;   // seconds into a press
  return {
    object,
    anchors: { screen: { mesh: plate, uvRect: [0, 0, 1, 1] }, href },
    use() { t = 0; window.open(href, "_blank", "noopener"); },
    update(dt) {
      if (t < 0) return;
      t += dt;
      lever.rotation.z = t < 0.5 ? -0.6 * Math.sin(Math.PI * t / 0.5) : 0;
      if (t >= 0.5) t = -1;
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
