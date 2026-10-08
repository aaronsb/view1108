// The tape library rack (ours, #19): one upright steel unit of three bays about 0.9 m wide and five wire shelves,
// 2.8 x 1.85 x 0.45 m, filling the library zone on the north wall (room.ts LIBRARY). Its form is the operator's, from a
// period photograph of a tape library (#19, 2026-10-07; a stock image, not held): reels standing on edge in their
// cases along each shelf, as books stand, and a small number plate on each bay and level, A-1 to C-5 (bays A to C west
// to east, levels 1 to 5 top to bottom). No source says VIEW's tapes were kept this way at MSC: the rack, its size and
// colours, the wire shelves, the numbering, the cases and the labels are ours.
//
// One reel per entry of the site reel index (BuildContext.reels, the page's REEL_LIB), each its own pickable piece
// (`anchors.reels`, placed by the room as "reel:<id>"): on its rim, which faces the viewer, a paper label hand-lettered
// in marker with the mission and the rest of its title (APOLLO 11 / AS FLOWN; a playlist's title), and above it the
// manifest title typed small. Where each stands is racklayout.ts's plan (ours): one group per mission, earliest range
// zero first, then one for the playlists, each on a level of its own while there are levels enough, from the left of
// the middle bay, spilling into the west and east bays and the levels below; a reel with no room left is not shelved
// and the build warns. A reel that carries a scenario notebook (#29) has it on the bookcase beside the rack, the two
// paired across the units (bookcase.ts; the operator's revision after PR #69). Anonymous reels in cases of varied colours
// (one instanced mesh, not picked) stand only on the levels with none of the index's reels, about half to two-thirds
// full with irregular gaps (racklayout.ts filler; the operator's look of 2026-10-07). Each group has a strip of masking
// tape on the front edge under its first reel with the group hand-lettered (the mission, and the month and year of its
// range zero from the reel's page.json; the playlists' titles), and the east bay, nearest the bookcase, an arrow strip
// toward the operator's manuals (kit.ts tapeStrip; the operator's signage form, 2026-10-07: tape on the shelves, no wall
// signs). The labels and their wording are ours.
//
// Below the playlists, the system tapes (#87, #104; systapes.ts, all ours): props, not reels of the index. The site's own
// (EXEC 8 SYSTEM (COPY), VIEW KERNEL) stand under a SYSTEM TAPES strip, then a set for each reel of the index under a
// strip naming it (SYSTEM · APOLLO 11), each in a bay of its own, over the levels the reels leave. A set's cases are in
// its reel's colours, each with its name and the reel hand-lettered on the rim; the site's, each its own colour. One
// pulls out like a reel, and a second click asks the page for its modal, which only says it is a system tape and puts it
// back (LabHooks.ask "system").
//
// Pulling (pullable.ts): a click at the close-up brings a reel 13 cm out of its row, and a click on another swaps
// them. A second click on the pulled reel asks the page for the reel modal, LOAD NEW SIMULATION SCENARIO? (LabHooks.ask;
// the operator, 2026-10-07: the primary way to swap reels; LOAD ... AND EXEC mounts it, PUT TAPE BACK puts it back).
// A pulled reel also stays out when the camera leaves (`carried`): carried to a tape unit, it is mounted there
// (carry.ts, LabHooks.mount), the second way. Its notebook on the bookcase stands half out while it is out (#19's
// half-pull, ours: the rack's shelf is linked to the bookcase's, room.ts), and Esc puts both back.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BuildContext, Equipment, LabState, ReelInfo } from "../types";
import { Parts, canvasTex, fontTex, marker, markerWidth, nameplate, paint, plastic, plateText, rng, satinMetal, sharedGeo, tapeStrip } from "./kit";
import { Shelf, type Pullable } from "./pullable";
import { REEL_COLOURS, systemTapes, type SystemTape } from "./systapes";

import { BAYS, D, H, LEVELS, POST, T, W, bayX0, bayX1, BAY_W, filler, postX, rackLayout } from "./racklayout";

const LIP = 0.035, LIP_Z = D / 2 - 0.004;               // the shelf's front channel: its height and its face
const R = 0.135;                                         // a reel case's radius
const REEL_Z = D / 2 - 0.03 - R;                         // the cases' centres: their fronts 3 cm behind the lip
const PULL = new THREE.Vector3(0, 0.012, 0.13);
// Case colours (ours): the slate and grey of tape-seal belts, a few in red, green, mustard and buff.
const TINTS = [0x2f4a6b, 0x5b6f86, 0x5b6f86, 0x7d8287, 0x7d8287, 0x2b2d30, 0x8a2b22, 0x3f5a3a, 0xb8963a, 0xd8d0b4];
const TYPED = '"Courier Prime", "Courier New", Courier, monospace';

/** A reel on the rack: its piece, and the reel of the index it stands for. */
export interface ReelPiece extends Equipment { reel: ReelInfo }
/** A system tape on the rack (#87): a prop, its piece and the tape it stands for. */
export interface SysTapePiece extends Equipment { tape: SystemTape }
/** A reel case on edge, its axis across the shelf (x): the rim faces the viewer; groups 0 rim, 1 and 2 the faces.
 *  `seg` sides: 28 for the index's reels, 16 for the anonymous ones (instanced, many). */
const caseGeo = (seg = 28) => sharedGeo(`rackCase${seg}`, () => new THREE.CylinderGeometry(R, R, T, seg).rotateZ(Math.PI / 2));
/** A label curved onto the rim: `arc` m along the rim, `w` m across it, its middle `at` rad up from the front; its
 *  texture's u runs up the rim and its v across, the texture's top row at the case's west face. */
const rimLabelGeo = (arc: number, w: number, at = 0) => new THREE.CylinderGeometry(R + 0.0008, R + 0.0008, w, 10, 1, true, at - arc / R / 2, arc / R).rotateZ(Math.PI / 2);
const LABEL_W = T - 0.008;
/** The front label (hand-lettered, on the rim's front, a little below the middle) and the typed title above it: their
 *  lengths along the rim, m, and their middles, rad up from the front. */
const FRONT_ARC = 0.15, FRONT_AT = -0.14, TYPED_ARC = 0.11, TYPED_AT = 0.95;

/** The lines of a reel's front label: a scenario reel's mission and the rest of its title (APOLLO 11 / AS FLOWN); a
 *  playlist's title. */
export function frontLines(reel: ReelInfo): string[] {
  const t = reel.title.toUpperCase(), m = reel.mission.toUpperCase();
  return reel.kind === "scenario" && m && t.startsWith(m + " ") ? [m, t.slice(m.length + 1)] : [t];
}

/** A label on the rim, `arc` m long, its middle `at` rad up from the front; `draw` letters its canvas (`w` along the
 *  rim, `h` across), which is turned so that the writing reads top to bottom. */
function rimLabel(arc: number, at: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, mine: { dispose(): void }[], rough = 0.8): THREE.Mesh {
  const CW = 512, CH = Math.round(CW * LABEL_W / arc);
  const tex = canvasTex(CW, CH, (g, w, h) => { g.translate(w, h); g.rotate(Math.PI); draw(g, w, h); }, 8);
  const m = new THREE.Mesh(rimLabelGeo(arc, LABEL_W, at), new THREE.MeshStandardMaterial({ map: tex, roughness: rough }));
  m.position.y = R + 0.001;
  mine.push(m.geometry, m.material as THREE.Material, tex);
  return m;
}

/** A labelled case: its hand-lettered front label (`lines`) and its typed title; the object's origin is on the deck
 *  under the case's centre. */
function labelledCase(title: string, lines: readonly string[], seed: number, tint: number, mine: { dispose(): void }[], prop = false): THREE.Group {
  const object = new THREE.Group();
  // A darker face reads as a case. A system tape (`prop`) is cheaper, three draw calls fewer: its rim's material all
  // round, and no typed title (`title` unused).
  const rim = plastic(tint, 0.5), face = plastic(new THREE.Color(tint).multiplyScalar(0.8).getHex(), 0.55);
  const body = new THREE.Mesh(caseGeo(), prop ? rim : [rim, face, face]); body.position.y = R + 0.001;
  const typed = prop ? null : rimLabel(TYPED_ARC, TYPED_AT, (g, w, h) => {
    g.fillStyle = "#f1ecdc"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#18181a"; g.textAlign = "center"; g.textBaseline = "middle";
    let px = h * 0.5;
    g.font = `bold ${px}px ${TYPED}`;
    px *= Math.min(1, w * 0.92 / g.measureText(title).width);
    g.font = `bold ${px}px ${TYPED}`; g.fillText(title, w / 2, h / 2 + 1);
  }, mine);
  // The front label: white paper with a faint grain, each line in marker, shrunk to fit the label's length.
  const r = rng(seed);
  const front = rimLabel(FRONT_ARC, FRONT_AT, (g, w, h) => {
    g.fillStyle = "#f4f1e6"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(110,100,70,${0.03 + r() * 0.04})`; g.fillRect(r() * w, 0, 2 + r() * 6, h); }
    const n = lines.length, px0 = h * (n > 2 ? 0.28 : n > 1 ? 0.4 : 0.62);
    lines.forEach((l, i) => {
      const px = px0 * Math.min(1, w * 0.88 / markerWidth(l, px0));
      marker(g, l, (w - markerWidth(l, px)) / 2, h * (i + 0.5) / n + 1, px, r);
    });
  }, mine, 0.9);
  object.add(body, front);
  if (typed) object.add(typed);
  return object;
}
const caseCamera = () => ({ camera: { position: new THREE.Vector3(0, R + 0.2, 0.85), target: new THREE.Vector3(0, R, 0), fov: 34 } });
/** A reel of the index on the rack. */
const reelPiece = (reel: ReelInfo, tint: number, mine: { dispose(): void }[]): ReelPiece =>
  ({ object: labelledCase(reel.title, frontLines(reel), reel.id.length * 977 + reel.title.length, tint, mine), reel, anchors: caseCamera() });
/** A system tape on the rack: its own case colour and its hand-lettered name. */
const sysTapePiece = (tape: SystemTape, mine: { dispose(): void }[]): SysTapePiece =>
  ({ object: labelledCase(`SYSTEM · ${tape.label}`, tape.lines, tape.id.length * 613 + tape.label.length, tape.tint, mine, true), tape, anchors: caseCamera() });

/** The bay and level number plates, A-1 to C-5: white on black in the nameplate face, one atlas, one mesh. */
function numberPlates(mine: { dispose(): void }[]): THREE.Mesh {
  const names: string[] = [];
  for (let l = 0; l < LEVELS.length; l++) for (let b = 0; b < BAYS; b++) names.push(`${"ABC"[b]}-${l + 1}`);
  const C = 4, CW = 128, CH = 64;
  const tex = fontTex(C * CW, C * CH, g => names.forEach((n, k) => {
    const x = (k % C) * CW, y = Math.floor(k / C) * CH;
    g.fillStyle = "#16171a"; g.fillRect(x, y, CW, CH);
    g.fillStyle = "#ecebe4"; plateText(g, n, x + CW / 2, y + CH / 2 + 2, 30, 0.08, "center");
  }), 8);
  const quads = names.map((_, k) => {
    const l = Math.floor(k / BAYS), b = k % BAYS, q = new THREE.PlaneGeometry(0.05, 0.025), uv = q.attributes.uv;
    const u0 = (k % C) / C, v0 = 1 - (Math.floor(k / C) + 1) / C;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / C, v0 + uv.getY(i) / C);
    return q.translate(bayX0(b) + 0.04, LEVELS[l] - LIP / 2, LIP_Z + 0.0005);
  });
  const geo = mergeGeometries(quads)!;
  quads.forEach(q => q.dispose());
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1 });
  mine.push(geo, mat, tex);
  return new THREE.Mesh(geo, mat);
}

export function build(ctx: BuildContext): Equipment & { anchors: { reels: ReelPiece[]; systapes: SysTapePiece[]; shelf: Shelf; items: Map<string, Pullable> } } {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const steel = paint(0x8a8d86, 0.9), wire = satinMetal(0x9da1a4);
  const P = new Parts(), Q = new Parts();
  // The frame: four uprights front and back, an X brace on each end, top rails.
  for (let k = 0; k <= BAYS; k++) for (const s of [-1, 1]) P.box(POST, H, POST, steel, postX(k), H / 2, s * (D / 2 - POST / 2));
  const span = D - 2 * POST, brace = Math.hypot(H - 0.1, span), lean = Math.atan2(span, H - 0.1);
  for (const k of [0, BAYS]) for (const s of [-1, 1]) P.box(0.004, brace, 0.018, steel, postX(k), H / 2, 0, s * lean);
  for (const s of [-1, 1]) P.box(W - 2 * POST, 0.025, 0.02, steel, 0, H - 0.0125, s * (D / 2 - 0.012));
  for (let k = 0; k <= BAYS; k++) P.box(0.02, 0.025, span, steel, postX(k), H - 0.0125, 0);
  // Each level: per bay the front channel and the back rail, per upright a side rail, under the deck two cross wires.
  for (const y of LEVELS) {
    for (let b = 0; b < BAYS; b++) {
      const cx = (bayX0(b) + bayX1(b)) / 2;
      P.box(BAY_W, LIP, 0.012, steel, cx, y - LIP / 2, LIP_Z - 0.006);
      P.box(BAY_W, 0.02, 0.012, steel, cx, y - 0.01, -D / 2 + POST / 2);
      for (const z of [-0.1, 0.1]) Q.box(BAY_W, 0.004, 0.004, wire, cx, y - 0.0055, z);
    }
    for (let k = 0; k <= BAYS; k++) P.box(0.012, 0.02, span, steel, postX(k), y - 0.01, 0);
  }
  mine.push(...P.bake(object).map(m => m.geometry), ...Q.bake(object).map(m => m.geometry));
  // The wire decks: rods front to back every 25 mm, instanced.
  const rods: THREE.Matrix4[] = [], n = Math.floor(BAY_W / 0.025);
  for (const y of LEVELS) for (let b = 0; b < BAYS; b++) for (let i = 0; i < n; i++)
    rods.push(new THREE.Matrix4().makeTranslation(bayX0(b) + (i + 0.5) * BAY_W / n, y - 0.00175, -0.003));
  const rodGeo = new THREE.BoxGeometry(0.0035, 0.0035, D - 0.04);
  const deck = new THREE.InstancedMesh(rodGeo, wire, rods.length);
  rods.forEach((m, i) => deck.setMatrixAt(i, m));
  object.add(deck); mine.push(rodGeo, deck);

  // The reels where the plan puts them (racklayout.ts); the anonymous reels on the levels with none of them (filler).
  const r = rng(1919), plan = rackLayout(ctx.reels ?? [], systemTapes(ctx.reels ?? [])), reels: ReelPiece[] = [], systapes: SysTapePiece[] = [];
  if (plan.unplaced.length) console.warn(`tape rack: no room for ${plan.unplaced.length} reel(s): ${plan.unplaced.map(u => u.id).join(", ")}`);
  if (plan.unplacedTapes.length) console.warn(`tape rack: no room for ${plan.unplacedTapes.length} system tape(s)`);
  for (const { reel, level: l, x } of plan.slots) {
    const p = reelPiece(reel, REEL_COLOURS[reel.kind].tint, mine);
    p.object.position.set(x + T / 2, LEVELS[l], REEL_Z);
    object.add(p.object); reels.push(p);
  }
  for (const { tape, level: l, x } of plan.tapes) {
    const p = sysTapePiece(tape, mine);
    p.object.position.set(x + T / 2, LEVELS[l], REEL_Z);
    object.add(p.object); systapes.push(p);
  }
  const anon = filler(plan, r).map(f => ({ x: f.x, y: LEVELS[f.level], yaw: (r() - 0.5) * 0.05, tint: TINTS[Math.floor(r() * TINTS.length)], label: r() > 0.45 }));
  const cases = new THREE.InstancedMesh(caseGeo(16), [plastic(0xffffff, 0.5), plastic(0xcccccc, 0.55), plastic(0xcccccc, 0.55)], anon.length);
  const labGeo = rimLabelGeo(0.07, LABEL_W), tags = anon.filter(a => a.label);
  const labels = new THREE.InstancedMesh(labGeo, plastic(0xffffff, 0.8), tags.length);
  const c = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const place = (a: typeof anon[number]) => m.compose(new THREE.Vector3(a.x, a.y + R + 0.001, REEL_Z), q.setFromEuler(e.set(0, a.yaw, 0)), one);
  anon.forEach((a, i) => { cases.setMatrixAt(i, place(a)); cases.setColorAt(i, c.set(a.tint)); });
  tags.forEach((a, i) => { labels.setMatrixAt(i, place(a)); labels.setColorAt(i, c.set(0xe4dcc4).multiplyScalar(0.7 + r() * 0.2)); });
  // The anonymous reels and the decks are not picked: a click there is the rack's frame (its own close-up, or back).
  cases.raycast = labels.raycast = deck.raycast = () => {};
  object.add(cases, labels); mine.push(cases, labels, labGeo);

  // The plates and the tape: each group's strip on the channel of the bay where its first reel stands; the arrow toward
  // the bookcase (east) at the right end of the east bay, level 2.
  object.add(numberPlates(mine));
  /** A strip on level `l`'s channel, centred at x, or (`x` null) ending 2 cm short of the east bay's end. */
  const strip = (text: string, x: number | null, l: number, arrow?: "right") => {
    const s = tapeStrip(text, 0.026, mine, { seed: 40 + l + text.length, arrow });
    s.geometry.computeBoundingBox();
    s.position.set(x ?? bayX1(BAYS - 1) - s.geometry.boundingBox!.max.x - 0.02, LEVELS[l] - LIP / 2, LIP_Z + 0.0008);
    s.rotation.z = (r() - 0.5) * 0.03;
    object.add(s);
  };
  for (const st of plan.strips) strip(st.label, (bayX0(st.bay) + bayX1(st.bay)) / 2, st.level);
  strip("OPERATORS MANUALS", null, 1, "right");

  // A nameplate on the top rail (ours), which is also the rack's screen anchor: what the walk's zone faces.
  const plate = nameplate("TAPE LIBRARY", { height: 0.024, fg: "#e8e4d6", bg: "#2a2c2e" }, mine);
  plate.position.set(0, H - 0.0125, D / 2 - 0.0014);
  object.add(plate);

  // Pulling: a reel comes straight out, a little raised off the wire, and a second click on it asks for the reel modal
  // (it "opens"; lab.ts); flying elsewhere leaves it out (carried).
  const shelf = new Shelf({
    idle: "Click a reel to pull it out",
    open: "Click the reel again to load or put back · or carry it to a tape unit · another reel to swap",
    out: "",
  });
  let mounted = "";
  const items = new Map<string, Pullable>();
  for (const p of reels) {
    const item = shelf.add(p.object, { offset: PULL, opens: true });
    items.set(p.reel.id, item);
    Object.assign(p, shelf.member(item), {
      hint: () => hint(),
      select: (on: boolean) => { if (on) shelf.set(item); },
      carried: () => shelf.isOut(item),
      putBack: () => { const was = shelf.isOut(item); shelf.back(item); return was; },
      status: () => mounted === p.reel.id ? "mounted" : "",
    });
  }
  // A system tape comes out as a reel does and a second click asks for its modal (it is not a simulation scenario:
  // PUT TAPE BACK only); it is not carried, so stepping back puts it back, as a binder (#87, ours).
  const sysItems: Pullable[] = [];
  /** The close-up's line: a system tape's own while one is out, else the shelf's. */
  const hint = () => sysItems.some(i => shelf.isOut(i)) ? "System tape · click again · Esc to put it back" : shelf.hint();
  for (const p of systapes) {
    const item = shelf.add(p.object, { offset: PULL, opens: true });
    sysItems.push(item);
    Object.assign(p, shelf.member(item), { hint, putBack: () => { const was = shelf.isOut(item); shelf.back(item); return was; } });
  }
  const target = new THREE.Vector3(0, 1.27, 0.12);
  return {
    object,
    anchors: {
      screen: { mesh: plate, uvRect: [0, 0, 1, 1] },
      camera: { position: new THREE.Vector3(0, 1.42, 0.12 + 1.65), target, fov: 40 },
      reels,
      systapes,
      shelf,
      items,
    },
    hint,
    putBack: () => shelf.putBack(),
    update: (dt, s: LabState) => { shelf.update(dt); mounted = s.mounted; },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
