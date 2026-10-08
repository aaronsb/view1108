// The operator's notebook at the 1108 display console (#68; all ours, a semi-easter egg): a spiral pad lying open on the
// desk beside the display unit, its page a hand-printed cheat sheet of operator keyins in the manual's own forms
// (UP-4144 Rev. 1, pp. 11-3 to 11-8; the list is exec8.ts KEYINS). Each note is a piece of its own (placed by the room
// as "note:<id>"): at the console's close-up a click on it types its keyin into the console, a character at a time, and
// the console answers (Exec8.keyin); nothing the page holds changes. The pad, its size, the pencil printing and the
// wording beside each keyin are ours.
//
// The writing is Courier Prime (Alan Dague-Greene for Quote-Unquote Apps, SIL OFL 1.1, web/fonts/; the page declares it
// as "Courier Prime VIEW"), bold, each letter a little off its line and turned so it reads as printed by hand in
// pencil.
import * as THREE from "three";
import type { Equipment } from "../types";
import { at, canvasTex, paint, rng } from "./kit";
import { KEYINS, type Exec8 } from "./exec8";

export const HAND = '"Courier Prime VIEW", monospace';
/** The page lying on the desk: width (x) and depth (z), metres; the header's depth; each note's depth. */
const PAGE = { w: 0.17, d: 0.25, head: 0.034, note: 0.0265 };
const PX = 3600;   // texture px a metre
const PAPER = "#efe9d4", RULE = "rgba(70,110,170,0.32)", MARGIN = "rgba(190,60,60,0.38)", LEAD = "#3b3d44";

/** A note's piece: its keyin's id; press() keys it in. */
export interface NotePiece extends Equipment { keyin: string }

/** Hand-print `text` at (x, y) (its middle), `px` tall, in pencil: each letter turned and lifted a little (from `r`). */
function pencil(g: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, r: () => number, weight = "bold"): number {
  g.save();
  g.fillStyle = LEAD; g.font = `${weight} ${px}px ${HAND}`; g.textBaseline = "middle"; g.textAlign = "left";
  for (const c of text) {
    const w = g.measureText(c).width;
    g.save(); g.translate(x, y + (r() - 0.5) * 0.08 * px); g.rotate((r() - 0.5) * 0.1);
    g.globalAlpha = 0.78 + r() * 0.2; g.fillText(c, 0, 0); g.restore();
    x += w * (0.96 + r() * 0.06);
  }
  g.restore();
  return x;
}

/** The pad: its group (origin at the page's centre on the desk, +z toward the operator, the rings along the far edge),
 *  the note pieces and a redraw for when the face arrives. Geometries, materials and textures go to `mine`. */
export function operatorNotebook(exec: Exec8, aniso: number, mine: { dispose(): void }[]): { group: THREE.Group; notes: NotePiece[]; redraw(): void } {
  const group = new THREE.Group();
  const W = Math.round(PAGE.w * PX), H = Math.round(PAGE.d * PX), lineH = PAGE.note * PX;
  const drawPage = (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
    g.strokeStyle = RULE; g.lineWidth = 0.0004 * PX;
    for (let y = PAGE.head * PX; y < h - 4; y += lineH / 2) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = MARGIN; g.beginPath(); g.moveTo(0.022 * PX, 0); g.lineTo(0.022 * PX, h); g.stroke();
    for (let k = 0; k < 9; k++) { g.fillStyle = "#2a2a2a"; g.beginPath(); g.arc(w * (0.1 + k * 0.1), 0.004 * PX, 0.0018 * PX, 0, 2 * Math.PI); g.fill(); }   // the ring holes
    const r = rng(68);
    pencil(g, "OPERATOR KEYINS", 0.027 * PX, 0.021 * PX, 0.0105 * PX, r);
    pencil(g, "UP-4144 CH 11", 0.118 * PX, 0.022 * PX, 0.0058 * PX, r, "normal");
  };
  const pageTex = canvasTex(W, H, drawPage, aniso);
  const pageMat = new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.92 });
  const pageGeo = new THREE.PlaneGeometry(PAGE.w, PAGE.d).rotateX(-Math.PI / 2);
  const page = new THREE.Mesh(pageGeo, pageMat); page.position.y = 0.0064;   // clear of the pad's top (0.006)
  // The pad under the page: the sheets' edge and the card back, and the wire rings along the far edge (ours).
  const padGeo = new THREE.BoxGeometry(PAGE.w + 0.004, 0.006, PAGE.d + 0.004).translate(0, 0.003, 0);
  const pad = new THREE.Mesh(padGeo, paint(0xd9d2bb, 0.95));
  const ringGeo = new THREE.TorusGeometry(0.0055, 0.0009, 5, 10).rotateY(Math.PI / 2);
  const rings = new THREE.InstancedMesh(ringGeo, paint(0x9a9ea2, 0.4), 9);
  for (let k = 0; k < 9; k++) rings.setMatrixAt(k, at(PAGE.w * (-0.4 + k * 0.1), 0.007, -PAGE.d / 2 + 0.002));
  group.add(pad, page, rings);
  mine.push(pageTex, pageMat, pageGeo, padGeo, ringGeo, rings);

  // The notes, each a strip of the page with its writing, slightly above it: the keyin's form large, what it is for
  // beside it smaller, on two lines.
  const notes: NotePiece[] = [];
  const draws: (() => void)[] = [];
  KEYINS.forEach((k, i) => {
    const sw = W, sh = Math.round(lineH);
    const draw = (g: CanvasRenderingContext2D, w: number, h: number) => {
      g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
      g.strokeStyle = RULE; g.lineWidth = 0.0004 * PX;
      for (const y of [h / 2, h]) { g.beginPath(); g.moveTo(0, y - 0.0002 * PX); g.lineTo(w, y - 0.0002 * PX); g.stroke(); }
      g.strokeStyle = MARGIN; g.beginPath(); g.moveTo(0.022 * PX, 0); g.lineTo(0.022 * PX, h); g.stroke();
      const r = rng(100 + i * 17);
      pencil(g, k.form, 0.026 * PX, h * 0.27, h * 0.46, r);
      pencil(g, "- " + k.note, 0.034 * PX, h * 0.75, h * 0.32, r);
    };
    const tex = canvasTex(sw, sh, draw, aniso);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
    const geo = new THREE.PlaneGeometry(PAGE.w, PAGE.note).rotateX(-Math.PI / 2);
    // The piece's origin is the strip's middle (the lab projects it there, VIEW_LAB.project).
    const object = new THREE.Group(); object.add(new THREE.Mesh(geo, mat)); group.add(object);
    object.position.set(0, 0.0068, -PAGE.d / 2 + PAGE.head + (i + 0.5) * PAGE.note);
    mine.push(tex, mat, geo);
    draws.push(() => { const g = (tex.image as HTMLCanvasElement).getContext("2d")!; draw(g, sw, sh); tex.needsUpdate = true; });
    notes.push({ keyin: k.id, object, anchors: {}, opens: undefined, press: () => { exec.keyin(k.id); } });
  });
  const redraw = () => {
    const g = (pageTex.image as HTMLCanvasElement).getContext("2d")!; drawPage(g, W, H); pageTex.needsUpdate = true;
    draws.forEach(d => d());
  };
  return { group, notes, redraw };
}
