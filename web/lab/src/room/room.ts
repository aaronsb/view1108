// The machine room: the shell (shell.ts) and the equipment placed in it by registry name.
//
// The layout is ours. The MSC photograph of 15 July 1969 shows tape drives in a row, a work table with stacked
// reels, a card reader and printers, but no floor plan survives; period photographs of 1108 installations show long
// cabinet runs on an open raised floor (#21). This arrangement puts the same kinds of machine in a 13.2 m by 10.2 m
// room, in zones on one open floor (#19, #21); the standing view from the south-east takes in the tapes, the
// cabinets and the terminals, with the output wall behind the viewer's right:
// - Tape area, the north wall's west part: the UNISERVO row, and the reel table in front of its west end.
// - Machine floor, the west: the 1108's five cabinets along the west wall (the lamp-panel cabinet at the centre),
//   facing east across open floor; the low power distribution cabinet on the south wall.
// - Operator consoles, the middle: the 4009 facing the tapes, its chair between; east of it the 1558 graphic
//   console turned toward the viewer, its stool at its left, with its 1557 controller behind it, and the desk with
//   the UNISCOPE 100.
// - Output, the east wall and the south-east: the microfilm recorder, downstream of the computer as the film was,
//   then the printer; the card reader on the south wall.
// - Library, the north wall east of the drives: the tape rack and the reference bookcase side by side (LIBRARY
//   below), a few steps from the drives.
// The door is in the south wall, west of centre, with nothing in its swing and a clear aisle from it into the room,
// and the light switch on its latch side; every front has an aisle of at least 0.9 m and the zones at least 1.2 m
// between them (the plan's check, `footprints`, is what the walk collides with).
//
// A name the registry lacks is placed as a neutral grey box of its FOOTPRINT, so the room composes before every
// module exists. What a station opens and its hover label come from the station table (stations.ts), by placed name;
// the drive is the middle tape unit, the one the overview sees best (ours). The tape units are placed as
// "uniservo-<its number>": any of them mounts a reel carried from the rack (lab.ts).
import * as THREE from "three";
import { EQUIPMENT, FOOTPRINT } from "../equipment";
import type { BuildContext, Equipment, Footprint, Glow, Placed, Room } from "../types";
import { STATIONS, stationNamed } from "../stations";
import { DOOR, DRIVES, ROOM, buildShell } from "./shell";
import { batch } from "./batch";
import type { Binder, NotebookBinder, Prop } from "../equipment/bookcase";
import type { ReelPiece } from "../equipment/taperack";
import type { Pullable, Shelf } from "../equipment/pullable";

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

/** The library zone on the north wall (#19; ours), facing south with `stand` metres of standing room in front: the
 *  tape rack (equipment/taperack.ts, which fills it exactly; build() refuses a layout that puts anything else on it
 *  or its standing room), a few steps east of the drive row; and east of it the bookcase (equipment/bookcase.ts): the
 *  reels' mission notebooks on its upper shelves, each paired with its reel, and the operator's manuals and documents. Centre x, the wall's z, width and depth (out
 *  from the wall), metres. */
export const LIBRARY = {
  z0: -ROOM.d / 2,
  stand: 1.2,
  rack: { x: 2.0, w: FOOTPRINT.taperack[0], d: FOOTPRINT.taperack[2] },
  bookcase: { x: 4.1, w: FOOTPRINT.bookcase[0], d: FOOTPRINT.bookcase[2] },
};

export function build(ctx: BuildContext): Room {
  const object = new THREE.Group(), placed: Placed[] = [], footprints: Footprint[] = [];
  const shell = buildShell(ctx.maxAnisotropy);
  object.add(shell.object);
  let count = 0;

  /** Place a module by registry name at (x, y, z), turned `turn` about the vertical; `name` is how others find it.
   *  Standing on the floor, it gets a footprint: its own bounding box seen from above, placed and turned. */
  const place = (kind: string, at: [number, number, number], turn: number, name = `${kind}-${++count}`, opts?: Record<string, unknown>) => {
    const equipment = EQUIPMENT[kind] ? (EQUIPMENT[kind] as Builder)(ctx, opts) : standIn(kind);
    const st = stationNamed(name);
    if (st && st.does !== "control") equipment.opens = st.opens;   // narrowed to a tab or overlay row: an Opens
    const o = equipment.object, b = new THREE.Box3().setFromObject(o);
    o.position.set(...at); o.rotation.y = turn; o.updateMatrixWorld();
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
  for (let i = 0; i < DRIVES.n; i++) place("uniservo", [DRIVES.x0 + i * DRIVES.pitch, 0, -nW + 0.45], S, i === 3 ? "drive" : `uniservo-${60 + i}`, { number: 60 + i, index: i + 1, drive: i === 3 });
  for (let i = 0; i < 5; i++) place("cpu", [-wW + 0.48, 0, -0.4 + i * 0.82], E, undefined, { lampPanel: i === 2 });
  // The operator's chair at the 4009's seat (its keyboard end), facing it; without the anchor, centred in front of it.
  // The console stands far enough south that the chair leaves the tape units' 0.9 m aisle.
  const op = place("console4009", [-1.0, 0, -1.3], N);
  const seat = op.anchors.seat as { position: THREE.Vector3; yaw: number } | undefined;
  const seatAt = op.object.localToWorld(seat?.position.clone() ?? new THREE.Vector3(0, 0, 0.86));
  place("chair", [seatAt.x, 0, seatAt.z], N + (seat?.yaw ?? Math.PI));
  place("reeltable", [-4.8, 0, -2.5], 0.08);
  place("chair", [-4.05, 0, -1.85], -2.4);

  const desk = place("desk", [4.0, 0, -1.25], -0.19, "desk");
  const dt = top(desk, FOOTPRINT.desk[1]);
  desk.object.updateMatrixWorld();
  const glassAt = desk.object.localToWorld(new THREE.Vector3(0.25, dt, -0.05));
  place("glass", [glassAt.x, glassAt.y, glassAt.z], -0.19, "glass");
  place("chair", [3.95, 0, -0.5], N - 0.19);
  const vector = place("vector", [2.6, 0, -1.0], 0.32, "vector");   // beside the desk, turned toward the overview's eye
  // A drafting chair for the 1558's shelf (0.92 m up), off to its left so that the walk-up in front stays clear,
  // turned toward the keyboard (ours).
  const stool = vector.object.localToWorld(new THREE.Vector3(-0.62, 0, 0.92)), keys = vector.object.localToWorld(new THREE.Vector3(0, 0, 0.5));
  place("chair", [stool.x, 0, stool.z], Math.atan2(keys.x - stool.x, keys.z - stool.z), undefined, { tall: true });
  // The 1557 that drives the 1558, behind it, its front to the 1558's back.
  place("controller1557", [2.2, 0, -2.75], S);
  place("filmrecorder", [wW - 0.47, 0, 1.5], W, "filmrecorder");
  place("printer", [wW - FOOTPRINT.printer[2] / 2 - 0.03, 0, 3.6], W, "printer");
  place("cardreader", [2.8, 0, nW - 0.37], N);
  // The power cabinet, on the south wall clear of the cabinet run's front aisle and the door's swing;
  // its voltmeter selector is a piece of its own, picked and turned apart from the cabinet's doors.
  const power = place("powercab", [-4.4, 0, nW - 0.37], N, "power");
  const selector = power.anchors.selector as Equipment;
  selector.object.userData.placed = "power:selector"; placed.push({ name: "power:selector", equipment: selector });
  // The bookcase; each of its binders is placed under its own name, so it is picked, labelled and flown to alone.
  const library = place("bookcase", [LIBRARY.bookcase.x, 0, LIBRARY.z0 + LIBRARY.bookcase.d / 2], S, "library");
  // The tape rack in its zone, its reels each placed under its own name, as the binders are.
  const rack = place("taperack", [LIBRARY.rack.x, 0, LIBRARY.z0 + LIBRARY.rack.d / 2], S, "rack");
  // The rack fills its zone, and nothing else stands on the zone or its standing room: a layout error otherwise.
  {
    const r = LIBRARY.rack, x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = LIBRARY.z0, z1 = LIBRARY.z0 + r.d + LIBRARY.stand;
    for (const f of footprints) {
      const ex = Math.abs(f.hw * Math.cos(f.turn)) + Math.abs(f.hd * Math.sin(f.turn)), ez = Math.abs(f.hw * Math.sin(f.turn)) + Math.abs(f.hd * Math.cos(f.turn));
      if (f.name === "rack") {
        if (Math.abs(f.x - ex - x0) > 1e-3 || Math.abs(f.x + ex - x1) > 1e-3 || Math.abs(f.z - ez - z0) > 1e-3 || Math.abs(f.z + ez - (z0 + r.d)) > 1e-3)
          throw new Error("room: the tape rack does not fill its zone");
      } else if (f.x + ex > x0 && f.x - ex < x1 && f.z + ez > z0 && f.z - ez < z1) throw new Error(`room: ${f.name} stands in the tape rack's zone`);
    }
  }
  const reels = rack.anchors.reels as ReelPiece[];
  for (const p of reels) { p.object.userData.placed = `reel:${p.reel.id}`; p.opens = rack.opens; placed.push({ name: p.object.userData.placed, equipment: p }); }
  // Each reel's mission notebook on the bookcase (#29; the operator's revision after PR #69), opening the library as a
  // bookcase binder does, and paired with its reel across the two units: the rack's shelf and the bookcase's are linked,
  // so one thing is out across both and its partner stands half out (pullable.ts).
  const notebooks = library.anchors.notebooks as NotebookBinder[];
  for (const b of notebooks) { b.object.userData.placed = `binder:nb-${b.reel.id}`; b.opens = library.opens; placed.push({ name: b.object.userData.placed, equipment: b }); }
  {
    const rs = rack.anchors.shelf as Shelf, ls = library.anchors.shelf as Shelf;
    const ri = rack.anchors.items as Map<string, Pullable>, li = library.anchors.items as Map<string, Pullable>;
    rs.link(ls);
    for (const [id, it] of li) { const r = ri.get(id); if (r) rs.pair(r, it); }
  }
  const binders = library.anchors.binders as Binder[];
  for (const b of binders) { b.object.userData.placed = `binder:${b.doc.id}`; b.opens = library.opens; placed.push({ name: b.object.userData.placed, equipment: b }); }
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
  glows.push({ pos: new THREE.Vector3(DRIVES.x0 + 3 * DRIVES.pitch, 1.71, -nW + 0.45 + 0.356), color: 0xffe6c0, intensity: 0.25, distance: 5,
    face: { normal: new THREE.Vector3(0, 0, 1), w: 5.6, h: 0.1 } });
  glows.push({ pos: shell.exit.clone(), color: 0xff2a1a, intensity: 0.4, distance: 3, face: { normal: new THREE.Vector3(0, 0, -1), w: 0.36, h: 0.17 } });

  const batches = batch(object, placed);
  object.add(batches.object);

  const room: Room = {
    object,
    placed,
    footprints,
    door: { x: DOOR.x, z: nW, w: DOOR.w },
    overview: { position: new THREE.Vector3(4.4, 1.62, 4.0), target: new THREE.Vector3(0.2, 1.0, -2.6), fov: 55 },
    labels: { ...Object.fromEntries(STATIONS.map(st => [st.name, st.label])), switch: "Lights", power: "Power distribution — click to open/close the doors", "power:selector": "Voltmeter selector — click to turn", door: "Exit — github.com/aaronsb/view1108",
      ...Object.fromEntries(Array.from({ length: DRIVES.n }, (_, i) => [`uniservo-${60 + i}`, `UNISERVO VIII-C — tape unit ${60 + i}`]).filter((_, i) => i !== 3)),
      ...Object.fromEntries(reels.map(p => [`reel:${p.reel.id}`, `${p.reel.title} — ${p.reel.kind} reel`])),
      ...Object.fromEntries(notebooks.map(b => [`binder:nb-${b.reel.id}`, b.reel.notebook ?? b.reel.title])),
      ...Object.fromEntries(binders.map(b => [`binder:${b.doc.id}`, `${b.doc.num} — ${b.doc.title}`])),
      ...Object.fromEntries(props.map(p => [`prop:${p.id}`, p.label])) },
    lightsOn: true,
    setLights(on) { room.lightsOn = on; sw.set(on); },
    tubes: level => shell.tubes(level),
    glows,
    air: new THREE.Box3(new THREE.Vector3(-wW + 0.4, 0.3, -nW + 0.4), new THREE.Vector3(wW - 0.4, ROOM.h - 0.25, nW - 0.4)),
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
