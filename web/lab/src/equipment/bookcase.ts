// The reference library (ours): a low steel bookcase holding one ring binder per document of web/library/
// (library.json), standing upright on its upper shelf between a pair of L-shaped steel bookends. 1.0 x 1.1 x 0.36 m.
// No source shows a bookcase or binders in MSC's machine room; the bookcase, the binders, their colours (grey and blue
// for the UNIVAC manuals, black and oxblood for Stromberg-Carlson's, buff for the NASA reports) and the bookends are
// ours. Each binder is its own pickable piece (`anchors.binders`, placed by the room as "binder:<id>"); the bookcase
// and every binder open "library", and a binder asked for slides out a little (select).
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";
import { Parts, fontTex, nameplate, paint, plastic, plateText } from "./kit";
import LIBRARY from "../../../library/library.json";

export interface LibraryDoc { id: string; num: string; spine: string; title: string; year: number; publisher: string; pages: number; colour: string; file: string; source: string }
export const DOCS = LIBRARY as LibraryDoc[];

const W = 1.0, H = 1.1, D = 0.36, T = 0.018;
const SHELF = 0.55;                        // the upper shelf's top
const BH = 0.295, BD = 0.26;               // a binder's height and depth (letter-size sheets, 11 x 8 1/2 in, in their covers)
const FRONT = D / 2 - 0.035;               // the spines' line
const SLIDE = 0.07, SLIDE_S = 0.35;        // how far a selected binder comes out, m; its time constant, s

/** Thickness by page count: a 1 in ring for a thin document up to a 2 1/2 in one for 330 pages (ours). */
const thick = (pages: number) => 0.028 + 0.036 * Math.min(1, pages / 330);

export interface Binder extends Equipment { doc: LibraryDoc }

function binder(doc: LibraryDoc, aniso: number): Binder {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const t = thick(doc.pages), col = new THREE.Color(doc.colour).getHex();
  const vinyl = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0 });
  mine.push(vinyl);
  const P = new Parts();
  for (const s of [-1, 1]) P.box(0.003, BH, BD, vinyl, s * (t / 2 - 0.0015), BH / 2, -BD / 2);   // the covers
  P.rbox(t, BH, 0.012, 0.004, vinyl, 0, BH / 2, -0.006);                                           // the spine
  P.box(t - 0.012, BH - 0.02, BD - 0.03, plastic(0xeee8d6, 0.8), 0, BH / 2 - 0.004, -BD / 2 - 0.006);   // the sheets
  mine.push(...P.bake(object).map(m => m.geometry));
  // The spine card, lettered top to bottom in the nameplate face: the number, then the short title, shrunk to fit.
  const cw = t * 0.72, ch = 0.2, CW = 96, CH = Math.round(CW * ch / cw);
  const tex = fontTex(CW, CH, (g, w, h) => {
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
  }, aniso);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  card.position.set(0, BH * 0.54, 0.0004);
  object.add(card); mine.push(card.geometry, card.material as THREE.Material, tex);
  let want = 0, at = 0;
  const target = new THREE.Vector3(0, BH * 0.5, 0);
  return {
    object, doc,
    anchors: { camera: { position: new THREE.Vector3(0, 0.36, 0.42), target, fov: 34 } },
    opens: "library",
    select(on) { want = on ? SLIDE : 0; },
    update(dt) {
      if (at === want) return;
      at += (want - at) * (1 - Math.exp(-dt / SLIDE_S));
      if (Math.abs(at - want) < 1e-4) at = want;
      object.position.z = FRONT + at;
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}

/** An L-shaped steel bookend: an upright plate and a foot that slides under the row (toward `side`, -1 or +1). */
function bookend(P: Parts, x: number, side: number, mat: THREE.Material): void {
  P.box(0.004, 0.17, 0.13, mat, x, SHELF + 0.085, FRONT - 0.075);
  P.box(0.11, 0.003, 0.13, mat, x + side * 0.055, SHELF + 0.0015, FRONT - 0.075);
}

export function build(ctx: BuildContext): Equipment & { anchors: { binders: Binder[] } } {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const steel = paint(0x8a8d86, 0.9), dark = paint(0x2e3134, 0.9), olive = paint(0x5c6049, 0.7);
  const P = new Parts();
  for (const s of [-1, 1]) P.box(T, H, D, steel, s * (W / 2 - T / 2), H / 2, 0);   // the sides
  P.box(W, T, D, steel, 0, H - T / 2, 0);                                           // the top
  P.box(W - 2 * T, H - 0.08, 0.006, steel, 0, (H + 0.08) / 2, -D / 2 + 0.003);
  P.box(W - 2 * T, 0.045, 0.012, steel, 0, H - T - 0.0225, D / 2 - 0.006);          // the rail under the top
  P.box(W - 2 * T, T, D - 0.01, steel, 0, SHELF - T / 2, -0.005);                    // the upper shelf
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
  bookend(P, x + 0.002, -1, olive);
  mine.push(...P.bake(object).map(m => m.geometry));

  // A label on the top's front edge (ours); it is also the bookcase's screen anchor, what the walk's zone faces.
  const label = nameplate("REFERENCE LIBRARY", { height: 0.026, fg: "#e8e4d6", bg: "#2a2c2e" }, mine);
  label.position.set(0, H - T - 0.022, D / 2 + 0.001);
  object.add(label);
  const target = new THREE.Vector3(-0.1, SHELF + BH * 0.5, FRONT);
  return {
    object,
    anchors: {
      screen: { mesh: label, uvRect: [0, 0, 1, 1] },
      camera: { position: new THREE.Vector3(-0.1, SHELF + 0.62, FRONT + 0.78), target, fov: 40 },
      binders,
    },
    opens: "library",
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
