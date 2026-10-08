// The tape library rack (ours, #19): one upright steel unit of three bays about 0.9 m wide and five wire shelves,
// 2.8 x 1.85 x 0.45 m, filling the library zone on the north wall (room.ts LIBRARY). Its form is the operator's, from a
// period photograph of a tape library (#19, 2026-10-07; a stock image, not held): reels standing on edge in their
// cases along each shelf, as books stand, and a small number plate on each bay and level, A-1 to C-5 (bays A to C west
// to east, levels 1 to 5 top to bottom). No source says VIEW's tapes were kept this way at MSC: the rack, its size and
// colours, the wire shelves, the numbering, the cases and the labels are ours.
//
// One reel per entry of the site reel index (BuildContext.reels, the page's REEL_LIB), each its own pickable piece
// (`anchors.reels`, placed by the room as "reel:<id>"), its case label typed with its manifest title. The levels are
// grouped (ours): one per mission, earliest range zero first, its scenario reels in index order, then one for the
// playlists. Each group's reels stand at the left of the middle bay, each followed by an empty slot kept for that
// reel's scenario notebook binder (#29, slice d; `anchors.notebooks`). Anonymous reels in cases of varied colours (one
// instanced mesh) fill the rest, with a few gaps, so the rack reads as a library. Each grouped level has a strip of
// masking tape on its front edge with the group hand-lettered (the mission, and the month and year of its range zero
// from the reel's page.json; the playlists' titles), and the east bay, nearest the bookcase, an arrow strip toward the
// operator's manuals (kit.ts tapeStrip; the operator's signage form, 2026-10-07: tape on the shelves, no wall signs).
//
// Pulling (pullable.ts): a click at the close-up brings a reel 13 cm out of its row, and a click on another swaps them.
// A pulled reel stays out when the camera leaves (`carried`): the viewer carries it to a tape unit, which mounts it
// (lab.ts, LabHooks.mount) and puts it back; Esc puts it back too.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BuildContext, Equipment, LabState, ReelInfo } from "../types";
import { Parts, canvasTex, fontTex, nameplate, paint, plastic, plateText, rng, satinMetal, sharedGeo, tapeStrip } from "./kit";
import { Shelf } from "./pullable";

const W = 2.8, H = 1.85, D = 0.45;
const POST = 0.03, BAYS = 3, PITCH = (W - POST) / BAYS;   // angle posts, and their spacing centre to centre
const postX = (k: number) => -W / 2 + POST / 2 + k * PITCH;
const bayX0 = (b: number) => postX(b) + POST / 2, bayX1 = (b: number) => postX(b + 1) - POST / 2;
const BAY_W = bayX1(0) - bayX0(0);
/** Each level's deck top, m, levels 1 to 5 from the top. */
const LEVELS = [1.47, 1.12, 0.77, 0.42, 0.07];
const LIP = 0.035, LIP_Z = D / 2 - 0.004;               // the shelf's front channel: its height and its face
const R = 0.135, T = 0.04, GAP = 0.004;                  // a reel case's radius and thickness (on edge), the gap between
const REEL_Z = D / 2 - 0.03 - R;                         // the cases' centres: their fronts 3 cm behind the lip
const NB = 0.05;                                         // a notebook slot's width
const PULL = new THREE.Vector3(0, 0.012, 0.13);
// Case colours (ours): the slate and grey of tape-seal belts, a few in red, green, mustard and buff.
const TINTS = [0x2f4a6b, 0x5b6f86, 0x5b6f86, 0x7d8287, 0x7d8287, 0x2b2d30, 0x8a2b22, 0x3f5a3a, 0xb8963a, 0xd8d0b4];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const TYPED = '"Courier Prime", "Courier New", Courier, monospace';

/** A reel on the rack: its piece, and the reel of the index it stands for. */
export interface ReelPiece extends Equipment { reel: ReelInfo }

/** The empty place beside a reel for its notebook binder (slice d), in the rack's frame: `position` is the middle of
 *  the slot's front edge on the deck (a bookcase binder's origin: bottom of the spine), `w` its width, `h` the clear
 *  height above the deck, `d` the depth behind the front line. */
export interface NotebookSlot { position: THREE.Vector3; w: number; h: number; d: number }

/** One grouped level: the tape strip's words and its reels. */
interface Group { label: string; reels: ReelInfo[] }

/** The reel index grouped by level (ours): each mission's scenario reels, missions by range zero, then the playlists.
 *  More groups than levels would leave the last unshelved (four reels and three groups today). */
function groups(reels: readonly ReelInfo[]): Group[] {
  const missions = new Map<string, ReelInfo[]>();
  for (const r of reels) if (r.kind === "scenario") {
    const k = r.mission || r.title;
    missions.set(k, [...missions.get(k) ?? [], r]);
  }
  const when = (rs: ReelInfo[]) => rs[0].zero ?? Number.MAX_VALUE;
  const out: Group[] = [...missions].sort((a, b) => when(a[1]) - when(b[1])).map(([m, rs]) => {
    const z = rs[0].zero, d = z === null ? null : new Date(z);
    return { label: d ? `${m} · ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` : m, reels: rs };
  });
  const lists = reels.filter(r => r.kind === "playlist");
  if (lists.length) out.push({ label: `${lists.map(r => r.title).join(" / ")} REELS`, reels: lists });
  return out.slice(0, LEVELS.length);
}

/** A reel case on edge, its axis across the shelf (x): the rim faces the viewer; groups 0 rim, 1 and 2 the faces. */
const caseGeo = () => sharedGeo("rackCase", () => new THREE.CylinderGeometry(R, R, T, 28).rotateZ(Math.PI / 2));
/** A label curved onto the rim's front: `arc` m along the rim, `w` m across it; its texture's u runs up the rim and
 *  its v across, the texture's top row at the case's west face. */
const rimLabelGeo = (arc: number, w: number) => new THREE.CylinderGeometry(R + 0.0008, R + 0.0008, w, 10, 1, true, -arc / R / 2, arc / R).rotateZ(Math.PI / 2);
const LABEL_ARC = 0.19, LABEL_W = T - 0.008;

/** A grouped reel's case and its typed label, the title read top to bottom; the piece's origin is on the deck under
 *  the case's centre. */
function reelPiece(reel: ReelInfo, tint: number, mine: { dispose(): void }[]): ReelPiece {
  const object = new THREE.Group();
  const rim = plastic(tint, 0.5), face = plastic(new THREE.Color(tint).multiplyScalar(0.8).getHex(), 0.55);
  const body = new THREE.Mesh(caseGeo(), [rim, face, face]); body.position.y = R + 0.001;
  const CW = 512, CH = Math.round(CW * LABEL_W / LABEL_ARC);
  const tex = canvasTex(CW, CH, (g, w, h) => {
    g.fillStyle = "#f1ecdc"; g.fillRect(0, 0, w, h);
    g.translate(w, h); g.rotate(Math.PI);   // u runs up the rim: turned, the title reads top to bottom
    g.fillStyle = "#18181a"; g.textAlign = "center"; g.textBaseline = "middle";
    let px = h * 0.62;
    g.font = `bold ${px}px ${TYPED}`;
    px *= Math.min(1, w * 0.92 / g.measureText(reel.title).width);
    g.font = `bold ${px}px ${TYPED}`; g.fillText(reel.title, w / 2, h / 2 + 1);
  }, 8);
  const label = new THREE.Mesh(rimLabelGeo(LABEL_ARC, LABEL_W), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  label.position.y = R + 0.001;
  object.add(body, label);
  mine.push(label.geometry, label.material as THREE.Material, tex);
  return { object, reel, anchors: { camera: { position: new THREE.Vector3(0, R + 0.2, 0.85), target: new THREE.Vector3(0, R, 0), fov: 34 } } };
}

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

export function build(ctx: BuildContext): Equipment & { anchors: { reels: ReelPiece[]; notebooks: Record<string, NotebookSlot> } } {
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

  // The reels: the grouped levels from the top, each group's reels at the left of the middle bay with a notebook slot
  // after each; anonymous reels everywhere else.
  const r = rng(1919), grouped = groups(ctx.reels ?? []), reels: ReelPiece[] = [], notebooks: Record<string, NotebookSlot> = {};
  const anon: { x: number; y: number; yaw: number; tint: number; label: boolean }[] = [];
  LEVELS.forEach((y, l) => {
    const g = grouped[l];
    for (let b = 0; b < BAYS; b++) {
      let x = bayX0(b) + 0.012;
      if (g && b === 1) for (const reel of g.reels) {
        const p = reelPiece(reel, reel.kind === "playlist" ? 0x8a2b22 : 0x2f4a6b, mine);
        p.object.position.set(x + T / 2, y, REEL_Z);
        object.add(p.object); reels.push(p);
        notebooks[reel.id] = { position: new THREE.Vector3(x + T + GAP + NB / 2, y, REEL_Z + R), w: NB, h: (l ? LEVELS[l - 1] - LIP : H - 0.025) - y - 0.01, d: 2 * R };
        x += T + GAP + NB + GAP;
      }
      for (; x + T <= bayX1(b) - 0.008; x += T + GAP)
        if (r() > 0.1) anon.push({ x: x + T / 2, y, yaw: (r() - 0.5) * 0.05, tint: TINTS[Math.floor(r() * TINTS.length)], label: r() > 0.45 });
    }
  });
  const cases = new THREE.InstancedMesh(caseGeo(), [plastic(0xffffff, 0.5), plastic(0xcccccc, 0.55), plastic(0xcccccc, 0.55)], anon.length);
  const labGeo = rimLabelGeo(0.07, LABEL_W), tags = anon.filter(a => a.label);
  const labels = new THREE.InstancedMesh(labGeo, plastic(0xffffff, 0.8), tags.length);
  const c = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const place = (a: typeof anon[number]) => m.compose(new THREE.Vector3(a.x, a.y + R + 0.001, REEL_Z), q.setFromEuler(e.set(0, a.yaw, 0)), one);
  anon.forEach((a, i) => { cases.setMatrixAt(i, place(a)); cases.setColorAt(i, c.set(a.tint)); });
  tags.forEach((a, i) => { labels.setMatrixAt(i, place(a)); labels.setColorAt(i, c.set(0xe4dcc4).multiplyScalar(0.7 + r() * 0.2)); });
  object.add(cases, labels); mine.push(cases, labels, labGeo);

  // The plates and the tape: each grouped level's strip on the middle bay's channel, under its reels; the arrow toward
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
  grouped.forEach((g, l) => strip(g.label, (bayX0(1) + bayX1(1)) / 2, l));
  strip("OPERATORS MANUALS", null, 1, "right");

  // A nameplate on the top rail (ours), which is also the rack's screen anchor: what the walk's zone faces.
  const plate = nameplate("TAPE LIBRARY", { height: 0.024, fg: "#e8e4d6", bg: "#2a2c2e" }, mine);
  plate.position.set(0, H - 0.0125, D / 2 - 0.0014);
  object.add(plate);

  // Pulling: a reel comes straight out, a little raised off the wire; flying elsewhere leaves it out (carried).
  const shelf = new Shelf({
    idle: "Click a reel to pull it out",
    open: "",
    out: "Carry the reel to a tape unit and click the unit to mount it · another reel to swap",
  });
  let mounted = "";
  for (const p of reels) {
    const item = shelf.add(p.object, { offset: PULL });
    Object.assign(p, shelf.member(item), {
      select: (on: boolean) => { if (on) shelf.set(item); },
      carried: () => shelf.isOut(item),
      putBack: () => { const was = shelf.isOut(item); shelf.back(item); return was; },
      status: () => mounted === p.reel.id ? "mounted" : "",
    });
  }
  const target = new THREE.Vector3(0, 1.27, 0.12);
  return {
    object,
    anchors: {
      screen: { mesh: plate, uvRect: [0, 0, 1, 1] },
      camera: { position: new THREE.Vector3(0, 1.42, 0.12 + 1.65), target, fov: 40 },
      reels,
      notebooks,
    },
    hint: () => shelf.hint(),
    putBack: () => shelf.putBack(),
    update: (dt, s: LabState) => { shelf.update(dt); mounted = s.mounted; },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
