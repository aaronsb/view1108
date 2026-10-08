// The reference library (ours): a steel bookcase, 1.0 x 1.85 x 0.36 m, as tall as the tape rack beside it. Its upper
// manuals shelf holds one ring binder per document of web/library/ (library.json), upright between a pair of L-shaped
// steel bookends; above it two more shelves hold the mission notebooks (#29; the operator's revision after PR #69):
// one three-ring binder per reel of the site reel index that carries a scenario notebook (BuildContext.reels,
// ReelInfo.notebook), each mission's on a shelf of its own while there are shelves, its spine card hand-lettered with
// the notebook's title, under a tape label MISSION NOTEBOOKS. No source shows a bookcase or binders in MSC's machine
// room; the bookcase, the binders, their colours (grey and blue for the UNIVAC manuals, black and oxblood for
// Stromberg-Carlson's, buff for the NASA reports, black for the notebooks) and the bookends are ours. Each binder is its
// own pickable piece: a document's is `anchors.binders`, placed by the room as "binder:<id>", a notebook's
// `anchors.notebooks`, placed as "binder:nb-<reel id>"; the bookcase and every binder open "library". After the
// documents, for looks only (`anchors.props`, placed as "prop:<id>", inert: named on hover, nothing to open): a 1969
// Houston telephone directory, two paperbacks, and an index card of places to eat leaning on the back panel
// (docs/lab.md); a strip of masking tape on each shelf's edge names it. Everything on the shelves pulls out
// (pullable.ts): a click at the close-up brings one out and puts the last back, a second click on a document's binder
// opens it, on a notebook asks the page for the notebook modal (lab.ts, LabHooks.ask), and leaving puts all back. Each
// notebook is paired with its reel on the tape rack (room.ts links the two units' shelves): while one is out the other
// stands half out (#19's half-pull, ours).
import * as THREE from "three";
import type { BuildContext, Equipment, ReelInfo } from "../types";
import { HAND } from "./opnotebook";
import { Parts, canvasTex, fontTex, marker, markerWidth, nameplate, paint, plastic, plateText, rng, tapeStrip } from "./kit";
import { Shelf, type Pullable } from "./pullable";
import LIBRARY from "../../../library/library.json";

export interface LibraryDoc { id: string; num: string; spine: string; title: string; year: number; publisher: string; pages: number; colour: string; file: string; source: string }
export const DOCS = LIBRARY as LibraryDoc[];

const W = 1.0, H = 1.85, D = 0.36, T = 0.018;
const SHELF = 0.55;                        // the manuals shelf's top
const NB_SHELVES = [1.4, 0.96];            // the notebook shelves' tops, the upper first
const NB_T = 0.045, NB_COLOUR = 0x26292c;  // a notebook binder: a 1 3/4 in ring, black vinyl (ours)
export const BH = 0.295, BD = 0.26;             // a binder's height and depth (letter-size sheets, 11 x 8 1/2 in, in their covers)
const FRONT = D / 2 - 0.035;               // the spines' line
const PULL = 0.09, TIP = 0.05;              // how far a pulled book comes out, m, and its top tipped toward you, rad

/** Thickness by page count: a 1 in ring for a thin document up to a 2 1/2 in one for 330 pages (ours). */
const thick = (pages: number) => 0.028 + 0.036 * Math.min(1, pages / 330);

export interface Binder extends Equipment { doc: LibraryDoc }

/** A three-ring binder standing upright (ours; the bookcase's, and the tape rack's scenario notebooks, #29): vinyl
 *  covers `t` m apart and a rounded spine in `colour`, letter-size sheets inside, and a spine card `card` draws on
 *  (its canvas `CW` px across, the card's long side vertical). Its origin is the bottom of the spine's middle, the
 *  spine facing +z, the binder `BD` deep behind it. */
export function ringBinder(t: number, colour: number, card: (g: CanvasRenderingContext2D, w: number, h: number) => void, aniso: number, CW = 96): { object: THREE.Group; anchors: Equipment["anchors"]; dispose(): void } {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const vinyl = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0 });
  mine.push(vinyl);
  const P = new Parts();
  for (const s of [-1, 1]) P.box(0.003, BH, BD, vinyl, s * (t / 2 - 0.0015), BH / 2, -BD / 2);   // the covers
  P.rbox(t, BH, 0.012, 0.004, vinyl, 0, BH / 2, -0.006);                                           // the spine
  P.box(t - 0.012, BH - 0.02, BD - 0.03, plastic(0xeee8d6, 0.8), 0, BH / 2 - 0.004, -BD / 2 - 0.006);   // the sheets
  mine.push(...P.bake(object).map(m => m.geometry));
  const cw = t * 0.72, ch = 0.2, CH = Math.round(CW * ch / cw);
  const tex = fontTex(CW, CH, card, aniso);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  face.position.set(0, BH * 0.54, 0.0004);
  object.add(face); mine.push(face.geometry, face.material as THREE.Material, tex);
  return {
    object,
    anchors: { camera: { position: new THREE.Vector3(0, 0.36, 0.42), target: new THREE.Vector3(0, BH * 0.5, 0), fov: 34 } },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}

/** A reference binder: thick as its page count, its spine card lettered top to bottom in the nameplate face with the
 *  number, then the short title, shrunk to fit. */
function binder(doc: LibraryDoc, aniso: number): Binder {
  return { ...ringBinder(thick(doc.pages), new THREE.Color(doc.colour).getHex(), (g, w, h) => {
    g.fillStyle = "#ece6d2"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#8d8672"; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 2);
    g.fillStyle = "#1d1d1b";
    const line = (s: string, y: number, px: number) => {
      const fit = Math.min(px, px * h * 0.88 / Math.max(1, plateText(g, s, -1e5, -1e5, px, 0.1)));
      plateText(g, s, 0, y, fit, 0.1, "center");
    };
    line(doc.num, -w * 0.2, w * 0.3); line(doc.spine, w * 0.2, w * 0.24);
    g.restore();
  }, aniso), doc };
}

/** A reel's mission notebook binder: its piece, and the reel it goes with. */
export interface NotebookBinder extends Equipment { reel: ReelInfo }

/** A mission notebook (ringBinder), its spine card hand-lettered top to bottom with the notebook's title, split at its
 *  colon into two lines (APOLLO 11 AS FLOWN / SCENARIO NOTEBOOK). */
function notebookBinder(reel: ReelInfo, title: string, aniso: number): NotebookBinder {
  const r = rng(title.length * 31 + 5), lines = title.split(/:\s*/).filter(Boolean).slice(0, 2);
  const b = ringBinder(NB_T, NB_COLOUR, (g, w, h) => {
    g.fillStyle = "#f2eee0"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#9a9380"; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    g.translate(w / 2, h / 2); g.rotate(Math.PI / 2);   // along the spine, top to bottom: h long, w across
    const n = lines.length, px0 = w * (n > 1 ? 0.42 : 0.6);
    lines.forEach((l, i) => {
      const px = px0 * Math.min(1, h * 0.86 / markerWidth(l, px0));
      marker(g, l, -markerWidth(l, px) / 2, w * ((i + 0.5) / n - 0.5), px, r);
    });
  }, aniso, 160);
  return { ...b, reel };
}

/** A prop: one of the shelf's things for looks, picked as "prop:<id>", named `label` on hover. */
export interface Prop extends Equipment { id: string; label: string; dispose(): void }

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/** A book standing on the shelf, its spine at local z = 0 facing +z: a block of `cover` with a lettered spine face. */
function book(id: string, label: string, t: number, h: number, d: number, cover: THREE.Material, spine: Draw, aniso: number): Prop {
  const object = new THREE.Group();
  const block = new THREE.BoxGeometry(t, h, d).translate(0, h / 2, -d / 2);
  object.add(new THREE.Mesh(block, cover));
  const tex = canvasTex(Math.max(32, Math.round(2400 * t)), Math.round(2400 * h), spine, aniso);   // 2.4 px per mm
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(t, h).translate(0, h / 2, 0.0003), mat);
  object.add(face);
  return { object, id, label, anchors: {}, inert: true, dispose() { block.dispose(); face.geometry.dispose(); mat.dispose(); tex.dispose(); } };
}

/** Lettering along a spine, read top to bottom (ours): `body` letters across a canvas turned a quarter turn, its
 *  origin at the centre, `len` along the spine and `wid` across it. */
function along(g: CanvasRenderingContext2D, w: number, h: number, body: (len: number, wid: number) => void): void {
  g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 2); body(h, w); g.restore();
}
/** Fill `s` centred at (x, y), shrunk to at most `max` wide. */
function fitText(g: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, max: number, face: string): void {
  g.font = `${px}px ${face}`;
  const k = Math.min(1, max / Math.max(1, g.measureText(s).width));
  g.font = `${px * k}px ${face}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s, x, y);
}
const SERIF = '"VIEW Serif", serif', SANS = '"VIEW Sans", sans-serif';

/** The Houston telephone directory for 1969, 6.5 cm thick, 11 x 9 in; its wording, colours and bell are ours. */
const directory = (aniso: number) => book("directory", "Telephone directory, 1969", 0.065, 0.28, 0.225, plastic(0xe9e1c6, 0.85), (g, w, h) => {
  const ink = "#1f3f6e";
  g.fillStyle = "#ece4c8"; g.fillRect(0, 0, w, h);
  g.fillStyle = ink; g.fillRect(0, h * 0.05, w, h * 0.01); g.fillRect(0, h * 0.94, w, h * 0.01);
  // A plain bell outline (drawn simply, no logo artwork): a dome flaring to its lip, and the clapper.
  const cx = w / 2, cy = h * 0.12, r = w * 0.25;
  g.strokeStyle = ink; g.lineWidth = w * 0.035;
  g.beginPath(); g.moveTo(cx - r, cy + r * 0.75);
  g.quadraticCurveTo(cx - r * 0.7, cy + r * 0.2, cx - r * 0.6, cy - r * 0.35);
  g.quadraticCurveTo(cx, cy - r * 1.3, cx + r * 0.6, cy - r * 0.35);
  g.quadraticCurveTo(cx + r * 0.7, cy + r * 0.2, cx + r, cy + r * 0.75); g.closePath(); g.stroke();
  g.fillStyle = ink; g.beginPath(); g.arc(cx, cy + r * 0.95, r * 0.17, 0, 2 * Math.PI); g.fill();
  g.fillStyle = "#1a1a1a";
  along(g, w, h, (len, wid) => {
    fitText(g, "HOUSTON", -len * 0.1, -wid * 0.13, wid * 0.42, len * 0.4, `bold ${SANS}`);
    fitText(g, "TELEPHONE DIRECTORY", -len * 0.1, wid * 0.23, wid * 0.2, len * 0.42, SANS);
    fitText(g, "1969", len * 0.27, 0, wid * 0.4, len * 0.2, `bold ${SANS}`);
  });
  g.fillStyle = ink;
  fitText(g, "SOUTHWESTERN", w / 2, h * 0.872, w * 0.13, w * 0.86, `bold ${SANS}`);
  fitText(g, "BELL", w / 2, h * 0.905, w * 0.18, w * 0.86, `bold ${SANS}`);
}, aniso);

/** A mass-market paperback, 4 1/4 x 7 in: title and author along the spine, the imprint across its foot. */
const paperback = (id: string, label: string, t: number, bg: number, fg: string, title: string, author: string, imprint: string, aniso: number) =>
  book(id, label, t, 0.178, 0.108, plastic(bg, 0.5), (g, w, h) => {
    g.fillStyle = `#${bg.toString(16).padStart(6, "0")}`; g.fillRect(0, 0, w, h); g.fillStyle = fg;
    along(g, w, h, (len, wid) => {
      fitText(g, title, -len * 0.1, 0, wid * 0.52, len * 0.6, `bold ${SERIF}`);
      fitText(g, author, len * 0.32, 0, wid * 0.44, len * 0.24, SERIF);
    });
    fitText(g, imprint, w / 2, h * 0.96, w * 0.22, w * 0.86, `bold ${SANS}`);
  }, aniso);

/** The index card, 6 x 4 in, ruled, in blue ballpoint: the user's list, from their notes (docs/lab.md). */
const EATS = ["Places to eat \u2014", "The Singing Wheel (Webster)", "U-Joint \u2014 Fort Terry's", "     Universal Joint (BBQ)", "The Flintlock (steaks)", "Monterrey House (Mexican)"];
const CARD_W = 0.152, CARD_H = 0.102;
function card(aniso: number): Prop {
  const object = new THREE.Group(), W = 1024, H = Math.round(W * CARD_H / CARD_W);
  const tex = canvasTex(W, H, (g, w, h) => {
    g.fillStyle = "#f7f4ea"; g.fillRect(0, 0, w, h);
    const head = h * 0.17, step = (h - head) / 5.6;   // the red head rule, then blue rules a line apart
    g.lineWidth = 2; g.strokeStyle = "#c0392b"; g.beginPath(); g.moveTo(0, head); g.lineTo(w, head); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = "#8fb3d9";
    for (let i = 1; i <= 5; i++) { g.beginPath(); g.moveTo(0, head + i * step); g.lineTo(w, head + i * step); g.stroke(); }
    // Each line a little off: its left inset and turn (rad), so it reads as a hand, not a printer (ours).
    const jit = [[0.03, -0.015], [0.06, 0.008], [0.045, -0.006], [0.05, 0.004], [0.065, 0.012], [0.05, -0.005]];
    g.fillStyle = "#1d3a8f"; g.textBaseline = "alphabetic"; g.textAlign = "left";
    EATS.forEach((s, i) => {
      const px = (i === 0 ? 0.8 : 0.66) * step;
      g.font = `${px}px ${HAND}`;
      const k = Math.min(1, w * (0.97 - jit[i][0]) / g.measureText(s).width);
      g.save(); g.translate(w * jit[i][0], head + i * step - step * 0.16); g.rotate(jit[i][1]);
      g.font = `${px * k}px ${HAND}`; g.fillText(s, 0, 0); g.restore();
    });
  }, aniso);
  const geo = new THREE.PlaneGeometry(CARD_W, CARD_H).translate(0, CARD_H / 2, 0);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
  object.add(new THREE.Mesh(geo, mat));
  return { object, id: "eats", label: "Places to eat", anchors: {}, inert: true, dispose() { geo.dispose(); mat.dispose(); tex.dispose(); } };
}

/** An L-shaped steel bookend: an upright plate and a foot that slides under the row (toward `side`, -1 or +1). */
function bookend(P: Parts, x: number, side: number, mat: THREE.Material, y = SHELF): void {
  P.box(0.004, 0.17, 0.13, mat, x, y + 0.085, FRONT - 0.075);
  P.box(0.11, 0.003, 0.13, mat, x + side * 0.055, y + 0.0015, FRONT - 0.075);
}

export function build(ctx: BuildContext): Equipment & { anchors: { binders: Binder[]; notebooks: NotebookBinder[]; props: Prop[]; shelf: Shelf; items: Map<string, Pullable> } } {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const steel = paint(0x8a8d86, 0.9), dark = paint(0x2e3134, 0.9), olive = paint(0x5c6049, 0.7);
  const P = new Parts();
  for (const s of [-1, 1]) P.box(T, H, D, steel, s * (W / 2 - T / 2), H / 2, 0);   // the sides
  P.box(W, T, D, steel, 0, H - T / 2, 0);                                           // the top
  P.box(W - 2 * T, H - 0.08, 0.006, steel, 0, (H + 0.08) / 2, -D / 2 + 0.003);
  P.box(W - 2 * T, 0.045, 0.012, steel, 0, H - T - 0.0225, D / 2 - 0.006);          // the rail under the top
  P.box(W - 2 * T, T, D - 0.01, steel, 0, SHELF - T / 2, -0.005);                    // the manuals shelf
  for (const y of NB_SHELVES) P.box(W - 2 * T, T, D - 0.01, steel, 0, y - T / 2, -0.005);   // the notebook shelves
  P.box(W - 2 * T, T, D - 0.01, steel, 0, 0.08 + T / 2, -0.005);                     // the bottom shelf
  P.box(W - 2 * T, 0.08, 0.012, dark, 0, 0.04, D / 2 - 0.03);                         // the toe kick
  // The lower shelf: a few binders lying flat (unlabelled, ours).
  for (let i = 0; i < 3; i++) P.box(0.3, 0.045, 0.27, paint([0x5b6f86, 0x7d8287, 0x2b2d30][i], 0.7), -0.22 + i * 0.012, 0.098 + 0.0225 + i * 0.046, -0.02);

  const docs = DOCS, widths = docs.map(d => thick(d.pages));
  let x = -W / 2 + T + 0.04 + 0.004;
  bookend(P, x - 0.002, 1, olive);
  const binders: Binder[] = [];
  docs.forEach((d, i) => {
    const b = binder(d, ctx.maxAnisotropy);
    b.object.position.set(x + widths[i] / 2, SHELF, FRONT);
    object.add(b.object); binders.push(b);
    x += widths[i] + 0.0015;
  });
  // The mission notebooks on their shelves: one mission a shelf while there are shelves left (the index's reels with a
  // notebook, missions in range-zero order), from the left, each shelf with a bookend at its left.
  const notebooks: NotebookBinder[] = [];
  {
    const withNb = (ctx.reels ?? []).filter(r => r.notebook);
    const groups = new Map<string, ReelInfo[]>();
    for (const r of [...withNb].sort((a, b) => (a.zero ?? Infinity) - (b.zero ?? Infinity))) groups.set(r.mission || r.id, [...groups.get(r.mission || r.id) ?? [], r]);
    let k = 0, nx = -W / 2 + T + 0.044, used = false;
    const x1 = W / 2 - T - 0.02;
    for (const g of groups.values()) {
      if (used && k + 1 < NB_SHELVES.length) { k++; nx = -W / 2 + T + 0.044; used = false; }
      for (const r of g) {
        if (nx + NB_T > x1) {
          if (k + 1 >= NB_SHELVES.length) { console.warn(`bookcase: no room for ${r.id}'s notebook`); continue; }
          k++; nx = -W / 2 + T + 0.044; used = false;
        }
        if (!used) bookend(P, nx - 0.002, 1, olive, NB_SHELVES[k]);
        const b = notebookBinder(r, r.notebook!, ctx.maxAnisotropy);
        b.object.position.set(nx + NB_T / 2, NB_SHELVES[k], FRONT);
        object.add(b.object); notebooks.push(b);
        nx += NB_T + 0.0015; used = true;
      }
    }
  }
  // The props after the binders, their spines a little behind the binders' line: the directory, then the paperbacks.
  const props: Prop[] = [];
  const stand = (p: Prop, t: number) => {
    p.object.position.set(x + 0.004 + t / 2, SHELF, FRONT - 0.012);
    object.add(p.object); props.push(p);
    x += t + 0.004;
  };
  const aniso = ctx.maxAnisotropy;
  stand(directory(aniso), 0.065);
  stand(paperback("clarke", "Arthur C. Clarke, 2001: A Space Odyssey (Signet, 1968)", 0.017, 0x161616, "#ece5d0",
    "2001: A SPACE ODYSSEY", "ARTHUR C. CLARKE", "SIGNET", aniso), 0.017);
  stand(paperback("heinlein", "Robert A. Heinlein, The Moon Is a Harsh Mistress (Berkley Medallion, 1968)", 0.021, 0x9b2a1c, "#f2e3b8",
    "THE MOON IS A HARSH MISTRESS", "HEINLEIN", "BERKLEY", aniso), 0.021);
  bookend(P, x + 0.004, -1, olive);
  // The index card stands beyond the bookend, leaning on the back panel, its top 18 deg back.
  const note = card(aniso), lean = 18 * Math.PI / 180;
  note.object.position.set(0.3, SHELF, -D / 2 + 0.006 + CARD_H * Math.sin(lean));
  note.object.rotation.set(-lean, -0.08, 0, "YXZ");
  object.add(note.object); props.push(note);
  mine.push(...props);

  // Pulling: every book comes 9 cm out with its top tipped toward you; a binder opens on a second click. The card comes
  // up off the back and forward, turned to face the close-up's eye, so it can be read.
  const shelf = new Shelf({
    idle: "Click a binder to pull it out · click again to open",
    open: "Click the binder again to open · another to pull that one out",
    out: "Click a binder to pull it out",
  });
  const book = { offset: new THREE.Vector3(0, 0, PULL), turn: new THREE.Euler(TIP, 0, 0) };
  for (const b of binders) Object.assign(b, shelf.member(shelf.add(b.object, { ...book, opens: true })));
  const items = new Map<string, Pullable>();
  for (const b of notebooks) { const it = shelf.add(b.object, { ...book, opens: true }); items.set(b.reel.id, it); Object.assign(b, shelf.member(it)); }
  for (const p of props) Object.assign(p, shelf.member(shelf.add(p.object, p === note
    ? { offset: new THREE.Vector3(-0.15, 0.25, 0.44), turn: new THREE.Euler(-0.2, -0.25, 0) } : book)));
  mine.push(...P.bake(object).map(m => m.geometry));

  // A label on the top's front edge (ours); it is also the bookcase's screen anchor, what the walk's zone faces.
  const label = nameplate("REFERENCE LIBRARY", { height: 0.026, fg: "#e8e4d6", bg: "#2a2c2e" }, mine);
  label.position.set(0, H - T - 0.022, D / 2 + 0.001);
  object.add(label);
  // A strip of masking tape on each shelf's front edge, hand-lettered with what stands there (ours, #19; library.json
  // has no groups): the mission notebooks on the shelves that hold them, the manuals, reference binders lying lowest.
  const strips: [string, number][] = [["MANUALS", SHELF - T / 2], ["REFERENCE", 0.08 + T / 2]];
  NB_SHELVES.forEach((y, i) => { if (notebooks.some(b => b.object.position.y === y) || (i === 0 && notebooks.length)) strips.push(["MISSION NOTEBOOKS", y - T / 2]); });
  for (const [text, y] of strips) {
    const s = tapeStrip(text, T, mine, { seed: text.length });
    s.position.set(-0.2, y, D / 2 - 0.01 + 0.0008); s.rotation.z = text.length % 2 ? 0.01 : -0.008;
    object.add(s);
  }
  const target = new THREE.Vector3(-0.1, (SHELF + NB_SHELVES[0] + BH) / 2, FRONT);   // the manuals up to the top notebooks
  return {
    object,
    anchors: {
      screen: { mesh: label, uvRect: [0, 0, 1, 1] },
      camera: { position: new THREE.Vector3(-0.1, target.y + 0.12, FRONT + 1.7), target, fov: 40 },
      binders,
      notebooks,
      props,
      shelf,
      items,
    },
    hint: () => shelf.hint(),
    putBack: () => shelf.putBack(),
    update: dt => shelf.update(dt),
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
