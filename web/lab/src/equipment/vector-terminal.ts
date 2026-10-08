// The vector terminal: a UNIVAC 1558 Graphic Display Console (UP-7789, 1970), whose 12 in tube shows the plot (#cv).
// Its use at MSC is not documented (our choice; see docs/lab.md). Size 35 x 60 x 50 in (UP-7789 p. 27, read as
// W x H x D): 0.89 m across the head, 1.5 m tall, 1.25 m deep. Proportions are read off the manual's photographs:
// - Figure 2-5 (p. 11), the console square on: scaled by the head's width (1000 px of the 300 dpi scan = 0.89 m),
//   the face's outline (top edge 0.67 m wide, its corners chamfered 0.11 m in over 0.35 m down, 0.58 m from the top
//   to the shelf), the bezel (0.40 x 0.41 m, centred, its centre 0.33 m below the top), the light pen and its cord at
//   the upper right, the shelf (0.78 m wide) and the keyboard's span and place on it (0.62 m, centred).
// - Figure 2-7 (p. 14), the keyboard alone: every key group's position, read in its pixels and scaled to the 0.62 m
//   of Figure 2-5 (so the key pitch comes out at 21 mm, a little over a typewriter's 19).
// - Figure 1-1 (p. 1), three-quarter view: the light hood sweeping back from the face with a sloped top, its sides
//   curving under the shelf, the pedestal set back under the head with three light panels a side, the black plinth.
// The depth split (head 0.98 m, shelf 0.24 m, pedestal 0.65 m) is our reading of Figure 1-1's perspective.
// Key colours follow Figure 2-5 (letters a shade greyer than the white groups at both ends and the function keys);
// the typewriter and control keys' legends are Figure 2-9's (p. 15); the function keys' are Figure 2-7's where
// legible and ours elsewhere (the overlays are per application, p. 16). The power lamp is HYPOTHETICAL (which fitting on the strip is power is not stated).
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";
import { Parts, at, fitDist, fontTex, glowMat, grid, keyLegends, lensGeo, sharedGeo, own, paint, plastic, plateText, roundRect, rubber, satinMetal, tubeGlass, viewPose } from "./kit";

const FOV = 40;
// The plot canvas is 1.10 times as tall as it is wide (web/src/render.js HGT).
const SH = 0.28, SW = SH / 1.1;
const SX = 0, SY = 1.173, SZ = 0.388;   // the plot's centre, on the tube face
const FACE = 0.372;                     // the dark face's front plane
const TW = 0.36, TH = 0.372, TN = 3.6;  // the tube's visible glass (Figure 2-5) and its superellipse exponent

/** A superellipse |x/a|^n + |y/b|^n = 1 (the tube's bowed rounded square), counter-clockwise. */
function squircle(cx: number, cy: number, w: number, h: number, n = TN, k = 64): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < k; i++) {
    const t = i / k * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    out.push([cx + w / 2 * Math.sign(c) * Math.abs(c) ** (2 / n), cy + h / 2 * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return out;
}

/** A prism lofted from a front outline at z1 to a back outline at z0 (same point count, counter-clockwise), capped. */
function loft(front: [number, number][], back: [number, number][], z0: number, z1: number): THREE.BufferGeometry {
  const p: number[] = [], n = front.length;
  const tri = (a: number[], b: number[], c: number[]) => p.push(...a, ...b, ...c);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a1 = [...front[i], z1], b1 = [...front[j], z1], a0 = [...back[i], z0], b0 = [...back[j], z0];
    tri(a1, b0, b1); tri(a1, a0, b0);
  }
  for (const f of THREE.ShapeUtils.triangulateShape(front.map(([x, y]) => new THREE.Vector2(x, y)), [])) tri([...front[f[0]], z1], [...front[f[1]], z1], [...front[f[2]], z1]);
  for (const f of THREE.ShapeUtils.triangulateShape(back.map(([x, y]) => new THREE.Vector2(x, y)), [])) tri([...back[f[0]], z0], [...back[f[2]], z0], [...back[f[1]], z0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

/** Points on a circular arc, centre (cx, cy), radius r, from angle a0 to a1 (radians). */
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, k = 8): [number, number][] =>
  Array.from({ length: k + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / k; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as [number, number]; });

/** A keycap, a square frustum 1 unit across and high on z = 0 (16 triangles: the 140 keys stay cheap). */
const capGeo = () => sharedGeo("cap1558", () => {
  const g = new THREE.CylinderGeometry(0.6, Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).translate(0, 0, 0.5).toNonIndexed();
  g.computeVertexNormals();   // flat faces
  return g;
});

export function build(ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts();
  const hood = paint(0xd6d5d0, 0.6), face = plastic(0x2c2927, 0.6), dark = paint(0x34373a, 0.9), black = paint(0x161718, 0.9);
  const bezel = plastic(0xe6e3da, 0.4), panel = plastic(0xe2e0d8, 0.5);

  // Pedestal: set back under the head; charcoal body, three light panels a side, black plinth.
  P.box(0.8, 0.12, 0.58, black, 0, 0.06, -0.22);
  P.box(0.86, 0.655, 0.65, dark, 0, 0.4475, -0.225);
  for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) P.rbox(0.012, 0.58, 0.2, 0.004, panel, sx * 0.432, 0.445, -0.225 + k * 0.212);

  // Head: the light hood, a hexagon (Figure 2-5) whose lower corners curve under the shelf (Figure 1-1), lofted back
  // to a smaller, lower outline: the visor's sloped top and tapered sides.
  const hex: [number, number][] = [
    ...arc(-0.345, 0.88, 0.1, -Math.PI, -Math.PI / 2).slice(1), ...arc(0.345, 0.88, 0.1, -Math.PI / 2, 0),
    [0.445, 1.15], [0.335, 1.5], [-0.335, 1.5], [-0.445, 1.15], [-0.445, 0.88]];
  P.add(loft(hex, hex.map(([x, y]) => [x * 0.93, 0.78 + (y - 0.78) * 0.82]), -0.62, FACE - 0.012), hood);
  // The dark face: flush with the hood at the top, a light margin showing beside it below the chamfers.
  P.outline([[-0.386, 0.9], [0.386, 0.9], [0.433, 1.15], [0.329, 1.494], [-0.329, 1.494], [-0.433, 1.15]], FACE - 0.014, FACE, face);

  // Tube: a thick off-white bezel with large rounded corners and a soft inner edge, the dark glass behind it.
  // The bevel grows the outline and closes the hole by its size on each side.
  P.outline(roundRect(SX, SY, 0.39, 0.4, 0.075), FACE, FACE + 0.024, bezel, 0.008, [squircle(SX, SY, TW + 0.016, TH + 0.016).reverse()]);
  P.add(new THREE.ShapeGeometry(new THREE.Shape(squircle(SX, SY, TW, TH).map(([x, y]) => new THREE.Vector2(x, y)))), tubeGlass(), at(0, 0, SZ - 0.002));

  // Light pen (p. 15), clipped upright at the upper right, its cord looping down the face to the shelf's corner.
  P.cyl(0.011, 0.011, 0.01, black, 0.283, 1.387, FACE + 0.005, 16, true);
  P.box(0.026, 0.02, 0.022, black, 0.29, 1.335, FACE + 0.011);
  P.cyl(0.0075, 0.0075, 0.045, black, 0.29, 1.33, FACE + 0.022).cyl(0.007, 0.007, 0.115, satinMetal(), 0.292, 1.25, FACE + 0.022);
  P.cyl(0.0035, 0.0015, 0.018, black, 0.292, 1.184, FACE + 0.022);
  const cord = [[0.29, 1.355, 0.022], [0.305, 1.33, 0.02], [0.345, 1.235, 0.012], [0.4, 1.145, 0.008], [0.415, 1.1, 0.006], [0.385, 1.08, 0.006],
    [0.31, 1.075, 0.006], [0.282, 1.04, 0.006], [0.282, 0.97, 0.008], [0.3, 0.925, 0.012], [0.33, 0.912, 0.02]];
  P.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cord.map(([x, y, z]) => new THREE.Vector3(x, y, FACE + z))), 64, 0.0025, 5), rubber());

  // Shelf: the dark tray across the face's foot, its front edge rounded, on the hood's light underside (Figure 1-1).
  P.profile([[FACE - 0.01, 0.845], [0.565, 0.845], ...arc(0.565, 0.875, 0.03, -Math.PI / 2, 0, 16), ...arc(0.57, 0.89, 0.025, 0, Math.PI / 2, 16), [FACE - 0.01, 0.918]], -0.392, 0.392, face, 0.004);
  P.profile([[FACE - 0.014, 0.78], [0.5, 0.81], ...arc(0.55, 0.83, 0.022, -Math.PI / 2, 0, 4), [0.572, 0.846], [FACE - 0.014, 0.846]], -0.405, 0.405, hood);

  // Keyboard (Figure 2-7), laid on the tray: (px, py) in the figure's pixels, centred on the face (Figure 2-5).
  const S = 0.62 / 1060, KS = 26 * S, flat = -Math.PI / 2;
  const kb = at(0, 0.9145, 0.462, 0.04);
  const onKb = (px: number, py: number, y: number) => kb.clone().multiply(at((px - 620) * S, y, (py - 552) * S));
  P.add(new THREE.BoxGeometry(1060 * S, 0.008, 220 * S), paint(0x5c5f62, 0.8), onKb(620, 580, 0.004));
  P.add(new THREE.BoxGeometry(1050 * S, 0.014, 50 * S), panel, onKb(620, 443, 0.007));                // the control strip
  P.add(new THREE.BoxGeometry(400 * S, 0.003, 196 * S), plastic(0xc9c7bf, 0.5), onKb(945, 570, 0.0095)); // the function overlay
  for (const px of [740, 810]) P.add(new THREE.BoxGeometry(34 * S, 0.008, 34 * S), black, onKb(px, 443, 0.018));
  for (const px of [930, 970, 1005]) P.add(new THREE.CylinderGeometry(0.0065, 0.0075, 0.012, 16), satinMetal(), onKb(px, 443, 0.02));
  P.bake(object).forEach(m => mine.push(m.geometry));

  // Keys, one instanced mesh: [px, py, width, depth (in keys), colour, legend]. Legends as Figure 2-9 (p. 15, the
  // typewriter, cursor and control keys close up) prints them; the rows' key centres are measured on Figure 2-7.
  const GREY = 0xc4c3bc, WHITE = 0xe8e6de, DARK = 0x262728;
  const keys: [number, number, number, number, number, string][] = [];
  ([[165, 492, "ERASE\nTO END\nOF DISPL"], [213, 492, "ERASE\nTO END\nOF LINE"], [165, 532, "IN DISPL\nDELETE\nIN LINE"],
    [213, 532, "IN DISPL\nINSERT\nIN LINE"], [165, 565, "CURSOR\nTO\nHOME"], [180, 600, "↑"], [140, 622, "←"], [212, 622, "→"], [180, 644, "↓"]] as const)
    .forEach(([px, py, t]) => keys.push([px, py, 1, 1, WHITE, t]));
  keys.push([278, 492, 1.3, 1, GREY, "SOM ▽"]);
  ["'\n<", "□\n>", "{\n[", "}\n]", "△\n@"].forEach((t, i) => keys.push([[332, 386, 438, 493, 546][i], 492, 1, 1, GREY, t]));
  for (const px of [600, 650]) keys.push([px, 492, 1.3, 1, DARK, ""]);
  keys.push([712, 482, 1.3, 1.1, DARK, "TRANSMIT"], [712, 565, 1, 1, DARK, ""], [714, 630, 1.3, 1.2, WHITE, "RETURN"]);
  const rows: [number, number, number, string, number, number, string[]][] = [
    [528, 269, 1.4, "TAB", 310, 35.0, ["!\n1", "\"\n2", "#\n3", "$\n4", "%\n5", "&\n6", "'\n7", "(\n8", ")\n9", "0", "=\n—"]],
    [562, 277, 1.6, "⟵", 325, 35.3, [..."QWERTYUIØP", "*\n:"]],
    [597, 286, 1.6, "CHAR\nERASE", 330, 35.8, [..."ASDFGHJKL;", "\\\n≠"]],
    [630, 293, 1.6, "", 344, 36.4, [..."ZXCVBNM,.", "?\n/"]]];
  for (const [py, lx, lw, lt, x0, pitch, row] of rows) {
    keys.push([lx, py, lw, 1, WHITE, lt]);
    row.forEach((t, c) => keys.push([x0 + c * pitch, py, 1, 1, GREY, t]));
  }
  keys.push([500, 663, 11, 0.7, WHITE, "→"]);                                                         // the space bar
  const FX = [770, 818, 880, 925, 970, 1030, 1075], FY = [490, 524, 558, 592, 628];
  for (const py of FY) for (const px of FX) keys.push([px, py, 1, 1, WHITE, ""]);
  const keyMesh = grid(capGeo(), plastic(0xffffff, 0.5), keys.length, 1,
    i => onKb(keys[i][0], keys[i][1], 0.008).multiply(at(0, 0, 0, flat, 0, 0, KS * keys[i][2], KS * keys[i][3], 0.008)), i => keys[i][4]);
  object.add(keyMesh); mine.push(keyMesh);
  // Their legends, one mesh on the caps' tops (0.85 of the base across): dark ink, light on the dark keys.
  object.add(keyLegends(keys.map(([px, py, w, d, c, t]) => ({ t, ink: c === DARK ? "#e8e6de" : "#1a1a19",
    w: KS * w * 0.82, d: KS * d * 0.82, m: onKb(px, py, 0.0162).multiply(at(0, 0, 0, flat)) })), ctx.maxAnisotropy, mine));

  // Legends printed on the 35 function keys (Figure 2-7's Greek letters and digits; the rest ours).
  const L = ["α β 1 2 3 = ≠", "γ δ 4 5 6 < >", "ε λ 7 8 9 + −", "π σ × ÷ 0 ↑ ↓", "χ Ω • ° / ← →"].map(r => r.split(" "));
  const W0 = FX[0] - 24, W1 = FX[6] + 24, H0 = FY[0] - 17, H1 = FY[4] + 17;
  // Digits and signs in the nameplate face; the Greek letters (which it would turn to capitals) in a plain one.
  const legends = fontTex(512, 256, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    FY.forEach((py, r) => FX.forEach((px, c) => {
      const x = (px - W0) / (W1 - W0) * w, y = (py - H0) / (H1 - H0) * h, t = L[r][c];
      if (/[α-ω]/i.test(t)) { g.font = 'bold 22px "IBM Plex Sans VIEW", sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, x, y); }
      else plateText(g, t, x, y, 18, 0, "center", 0.06);
    }));
  });
  mine.push(legends);
  const leg = own(new THREE.Mesh(new THREE.PlaneGeometry((W1 - W0) * S, (H1 - H0) * S), new THREE.MeshBasicMaterial({ color: 0x2a2a2a, alphaMap: legends, transparent: true, depthWrite: false })), mine);
  leg.matrixAutoUpdate = false; leg.matrix.copy(onKb((W0 + W1) / 2, (H0 + H1) / 2, 0.0162).multiply(at(0, 0, 0, flat))); object.add(leg);

  // The power lamp, a round lens at the strip's right end.
  const lamp = new THREE.Mesh(lensGeo(), glowMat(0xffb040));
  lamp.matrixAutoUpdate = false; lamp.matrix.copy(onKb(1045, 443, 0.014).multiply(at(0, 0, 0, flat, 0, 0, 0.014))); object.add(lamp);

  // The plot itself: bright, outside tone mapping, on a flat plane facing +Z.
  const screen = own(new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: ctx.vectorScreen, toneMapped: false })), mine);
  screen.position.set(SX, SY, SZ);
  object.add(screen);
  // The faceplate's dome: a faint glossy shell over the plot, for the reflections (cosmetic; the plot stays flat).
  const dome = new THREE.PlaneGeometry(1, 1, 12, 12), pos = dome.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i), v = pos.getY(i), s = Math.max(Math.abs(u), Math.abs(v)) * 2, f = Math.atan2(v, u);
    const rb = ((Math.abs(Math.cos(f)) / (TW / 2)) ** TN + (Math.abs(Math.sin(f)) / (TH / 2)) ** TN) ** (-1 / TN);
    pos.setXYZ(i, SX + s * rb * Math.cos(f), SY + s * rb * Math.sin(f), SZ + 0.001 + 0.009 * (1 - s * s));
  }
  dome.computeVertexNormals();
  object.add(own(new THREE.Mesh(dome, new THREE.MeshPhysicalMaterial({ color: 0x0a0c0c, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.08, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.03 })), mine));

  const target = new THREE.Vector3(SX, SY, SZ);
  object.updateMatrixWorld(true);
  return {
    object,
    anchors: {
      screen: { mesh: screen, uvRect: [0, 0, 1, 1] },
      camera: { position: new THREE.Vector3(SX, SY, SZ + fitDist(SH, FOV)), target, fov: FOV },
      view: viewPose([new THREE.Box3().setFromObject(screen), new THREE.Box3().setFromObject(keyMesh)], FOV),
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
