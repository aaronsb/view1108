// The glass terminal: a UNISCOPE 100 Display Terminal, standing on a desk; clicking it opens the Source tab.
// 18 W x 13 H x 27 D in (UP-7701 rev. 2, 1973, p. 30), 0.46 x 0.33 x 0.69 m here; viewing area 10 x 5 in, green
// characters on a dark background, 16 lines of 64 or 12 of 80 (p. 1). The UNISCOPE 100 was delivered from 1970, a
// year after the film (Wikipedia, "Uniscope"): an anachronism we keep for the Source tab.
//
// Shape, colours, the face's layout and the keyboard (keyboard.ts) follow the Commons photograph (docs/lab.md, The
// UNISCOPE 100); face positions are its pixels at 2000 px wide (fx, fy below), scaled to the face.
// The origin is on the desk top under the terminal's centre.
//
// The screen shows the kernel's FORTRAN, 16 lines of 64 columns: where the Source tab stands (its marked line or
// current unit), else VFRAME in vdrive.f from the page's embedded listing. It is redrawn only when that text changes;
// the cursor is its own small mesh, blinking.
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";
import { Parts, at, canvasTex, chrome, fitDist, fontTex, glowMat, own, paint, plastic, plateText, rng, roundRect, satinMetal, sharedGeo, tubeGlass, viewPose } from "./kit";
import { uniscopeKeyboard } from "./keyboard";

const FOV = 40, COLS = 64, ROWS = 16;
const SW = 0.254, SH = 0.127;              // the picture: 10 x 5 in

// The face: its foot on the keyboard base at (FZ, FY0), leaning back TILT (ours), its top at the hood's 0.33 m.
const FZ = 0.14, FY0 = 0.072, TILT = 8 * Math.PI / 180, FH = (0.33 - FY0) / Math.cos(TILT), FW = 0.456;
/** Face coordinates (x right, y up the face from its foot) from the photograph's pixels: the face spans x 290-1555
 *  and y 85 (top) to 790 (its foot at the right). */
const fx = (px: number) => -FW / 2 + (px - 290) / 1265 * FW;
const fy = (py: number) => FH * (790 - py) / 705;

const SCRIPT = 'italic 400 64px "VIEW Serif", serif';

/** Up to 16 lines for the screen: where the Source tab is, else VFRAME from the embedded listing. */
function sourceText(): string[] {
  const box = document.getElementById("sxlines");
  const from = box?.querySelector(".sx-l.sx-tgt") || box?.querySelector(".sx-l.sx-cu");
  if (from) {
    const out: string[] = [];
    const crumb = document.getElementById("sxcrumb")?.textContent?.trim() || "";
    const n = from.querySelector(".sx-n")?.textContent || "";
    out.push(`${crumb.toUpperCase().replace(/\s+/g, " ").slice(0, 52)}  LINE ${n}`);
    for (let el: Element | null = from; el && out.length < ROWS; el = el.nextElementSibling) out.push(el.querySelector(".sx-c")?.textContent ?? "");
    return out;
  }
  const src = document.getElementById("fsrc")?.textContent || "";
  for (const part of src.split(/^\f/m)) {
    const nl = part.indexOf("\n");
    if (!part.slice(0, nl).endsWith("vdrive.f")) continue;
    const lines = part.slice(nl + 1).split("\n"), i = lines.findIndex(l => /^\s+SUBROUTINE VFRAME\b/.test(l));
    if (i >= 0) return [`SRC/VDRIVE.F  LINE ${i + 1}`, ...lines.slice(i, i + ROWS - 1)];
  }
  return ["SRC/VDRIVE.F", "      SUBROUTINE VFRAME", "C     ONE FRAME: GEOMETRY AT THE CURRENT INPUTS", "      RETURN", "      END"];
}

export function build(ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts();
  const cream = paint(0xd6d0bd, 0.85), plinth = paint(0xc4bea9, 0.9), sides = paint(0x26282a, 0.75);
  const faceMat = paint(0x3b4043, 0.55), recess = plastic(0x15181a, 0.7);
  const sinT = Math.sin(TILT), cosT = Math.cos(TILT);
  const topZ = FZ - FH * sinT;

  // The keyboard base: a cream slab sloping up to the face, on a slightly darker plinth (the photograph's two bands).
  P.box(0.452, 0.01, 0.682, plinth, 0, 0.005, 0);
  P.profile([[0.345, 0.008], [0.345, 0.03], [0.337, 0.036], [FZ + 0.004, FY0], [FZ - 0.03, FY0], [FZ - 0.03, 0.03], [-0.34, 0.03], [-0.34, 0.008]], -0.23, 0.23, cream, 0.004);
  // The hood: dark sides, top and back, the top falling toward the back as in UP-7701 Fig. 1-1 (its fall, 6 cm, is
  // ours); its front sits 16 mm behind the face plate, the screen's recess.
  const back = 0.016 / cosT, BY = 0.27;
  P.profile([[FZ - back, 0.03], [FZ - back, FY0], [topZ - back, 0.33], [-0.335, BY], [-0.345, BY - 0.01], [-0.345, 0.03]], -0.23, 0.23, sides, 0.004);
  // The thin light trim along the hood's top edge, front and sides.
  P.box(0.462, 0.005, 0.008, cream, 0, 0.3315, topZ - 0.002);
  const run = topZ - back + 0.335, fall = Math.atan2(0.33 - BY, run);
  for (const s of [-1, 1]) P.box(0.005, 0.005, Math.hypot(run, 0.33 - BY), cream, s * 0.2305, (0.33 + BY) / 2 + 0.0015, (topZ - back - 0.335) / 2, -fall);

  // The face, in its own frame F: x right, y up the face, z out of it.
  const F = at(0, FY0, FZ, -TILT);
  const FA = (x = 0, y = 0, z = 0) => F.clone().multiply(at(x, y, z));
  const rx0 = fx(430), rx1 = fx(1455), ry0 = fy(630), ry1 = fy(195);           // the recess around glass and panel
  const gx0 = fx(450), gx1 = fx(1230), gy0 = fy(625), gy1 = fy(225);           // the glass
  // The recess's back, behind the glass and the panel.
  P.add(new THREE.BoxGeometry(rx1 - rx0, ry1 - ry0, 0.002), recess, FA((rx0 + rx1) / 2, (ry0 + ry1) / 2, -0.015));
  // The glass: a rounded rectangle, slightly domed (3 mm, ours), behind a black mask that rounds its corners.
  const gw = gx1 - gx0, gh = gy1 - gy0, gcx = (gx0 + gx1) / 2, gcy = (gy0 + gy1) / 2;
  const glass = new THREE.PlaneGeometry(gw, gh, 24, 12), gp = glass.attributes.position;
  for (let i = 0; i < gp.count; i++) { const u = gp.getX(i) / (gw / 2), v = gp.getY(i) / (gh / 2); gp.setZ(i, 0.003 * (1 - (u * u + v * v) / 2)); }
  glass.computeVertexNormals();
  P.add(glass, tubeGlass(0x1d2722), FA(gcx, gcy, -0.0105));
  const mask = new THREE.Shape(roundRect((rx0 + rx1) / 2, (ry0 + ry1) / 2, rx1 - rx0 + 0.002, ry1 - ry0 + 0.002, 0.006).map(([x, y]) => new THREE.Vector2(x, y)));
  mask.holes.push(new THREE.Path(roundRect(gcx, gcy, gw - 0.002, gh - 0.002, 0.014).map(([x, y]) => new THREE.Vector2(x, y))));
  P.add(new THREE.ShapeGeometry(mask, 8), recess, FA(0, 0, -0.0062));
  // The face plate, 19 mm thick, its hole's walls the recess's.
  const plate = new THREE.Shape([[-FW / 2, 0], [FW / 2, 0], [FW / 2, FH], [-FW / 2, FH]].map(([x, y]) => new THREE.Vector2(x, y)));
  plate.holes.push(new THREE.Path(roundRect((rx0 + rx1) / 2, (ry0 + ry1) / 2, rx1 - rx0, ry1 - ry0, 0.006).map(([x, y]) => new THREE.Vector2(x, y))));
  P.add(new THREE.ExtrudeGeometry(plate, { depth: 0.0174, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 1, curveSegments: 6 }), faceMat, FA(0, 0, -0.0152));
  // Push buttons: chrome bezels with clear lenses; POWER's lens glows (HYPOTHETICAL: the photograph shows it unlit).
  const by = fy(715), bxs = [fx(1280), fx(1370), fx(1460)];
  const zAxis = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2);
  for (const bx of bxs) {
    P.add(zAxis(new THREE.CylinderGeometry(0.0078, 0.0082, 0.006, 20)), chrome(), FA(bx, by, 0.006));
    P.add(new THREE.TorusGeometry(0.0062, 0.0011, 6, 20), satinMetal(0x8c9094), FA(bx, by, 0.009));
  }
  for (const bx of bxs.slice(0, 2)) P.add(zAxis(new THREE.CylinderGeometry(0.0048, 0.0048, 0.007, 16)), plastic(0xe6e3d8, 0.15), FA(bx, by, 0.0095));
  P.bake(object).forEach(m => mine.push(m.geometry));
  // The face's own meshes live in a group carrying F.
  const face = new THREE.Group(); face.matrixAutoUpdate = false; face.matrix.copy(F); object.add(face);
  const powerLens = new THREE.Mesh(sharedGeo("uniscope-lens", () => zAxis(new THREE.CylinderGeometry(0.0048, 0.0048, 0.007, 16))), glowMat(0xd98a34));
  powerLens.position.set(bxs[2], by, 0.0095); face.add(powerLens);

  // The aluminium strip under the screen (one texture, transparent where the face shows through): a band along the
  // foot, raised behind the buttons; the dark label with UNIVAC (Michroma, PLATE_FONT) and the red Sperry Rand mark;
  // a dark window; the buttons' legends.
  const SH_ = 0.05, K = 2048 / FW, X = (x: number) => (x + FW / 2) * K, Y = (y: number) => (SH_ - y) * K;
  const band = fy(735), raised = fy(655), rise = fx(1160);
  const strip = fontTex(2048, Math.round(SH_ * K), g => {
    const r = rng(11);
    g.fillStyle = "#b7babc";
    g.beginPath(); g.moveTo(X(-FW / 2), Y(0)); g.lineTo(X(FW / 2), Y(0)); g.lineTo(X(FW / 2), Y(raised)); g.lineTo(X(rise), Y(raised)); g.lineTo(X(rise - 0.003), Y(band)); g.lineTo(X(-FW / 2), Y(band)); g.closePath(); g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.10)" : "rgba(40,44,48,0.10)"; g.fillRect(r() * 2048, r() * g.canvas.height, 60 + r() * 500, 1); }
    g.restore();
    // The dark label and, at its right, the darker Sperry Rand box.
    g.fillStyle = "#2c2f32"; g.fillRect(X(fx(345)), Y(0.0165), X(fx(770)) - X(fx(345)), Y(0.0015) - Y(0.0165));
    g.fillStyle = "#1c1e20"; g.fillRect(X(fx(600)), Y(0.0165), X(fx(770)) - X(fx(600)), Y(0.0015) - Y(0.0165));
    g.fillStyle = "#c8cacb"; plateText(g, "UNIVAC", X(fx(512)), Y(0.009), 30, 0.12, "center", 0.02);
    g.fillStyle = "#e0321e"; g.strokeStyle = "#e0321e";
    const sx = X(fx(622)), sy = Y(0.0098), s = 9;
    g.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? s * 0.32 : s; g.lineTo(sx + Math.sin(a) * rr, sy - Math.cos(a) * rr); }
    g.closePath(); g.fill();
    g.font = 'italic 700 22px "VIEW Sans", sans-serif'; g.textBaseline = "middle"; g.textAlign = "left";
    g.save(); g.translate(sx + 12, Y(0.0085)); g.scale(0.92, 1); g.fillText("SPERRY RAND", 0, 0); g.restore();
    // The window.
    g.fillStyle = "#0b0c0d"; g.fillRect(X(fx(780)), Y(fy(740)), X(fx(930)) - X(fx(780)), Y(fy(775)) - Y(fy(740)));
    g.fillStyle = "rgba(170,180,185,0.35)"; g.fillRect(X(fx(785)), Y(fy(740)) + 3, X(fx(925)) - X(fx(785)), 2);
    // Button legends.
    g.fillStyle = "#3c3e40"; g.font = '600 15px "VIEW Sans", sans-serif'; g.textAlign = "center";
    ["WAIT", "INTENSITY", "POWER"].forEach((t, i) => g.fillText(t, X(bxs[i]), Y(fy(688))));
  }, ctx.maxAnisotropy);
  const stripMat = new THREE.MeshStandardMaterial({ map: strip, metalness: 0.45, roughness: 0.38, alphaTest: 0.5 });
  const stripMesh = own(new THREE.Mesh(new THREE.PlaneGeometry(FW, SH_), stripMat), mine); mine.push(strip);
  stripMesh.position.set(0, SH_ / 2, 0.0034); face.add(stripMesh);

  // The script panel at the right of the glass.
  const px0 = fx(1245), px1 = fx(1440), py0 = fy(585), py1 = fy(215), pw = px1 - px0, ph = py1 - py0;
  const drawPanel = (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = "#383d40"; g.fillRect(0, 0, w, h);
    g.font = SCRIPT; g.fillStyle = "#79a6c8"; g.textBaseline = "alphabetic"; g.textAlign = "left";
    const k = w * 0.82 / g.measureText("Uniscope 100").width;
    g.save(); g.translate(w * 0.09, h * (fy(215) - fy(272)) / ph + 6); g.scale(k, k); g.fillText("Uniscope 100", 0, 0); g.restore();
  };
  const ptex = canvasTex(256, Math.round(256 * ph / pw), drawPanel, ctx.maxAnisotropy);
  const panel = own(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.55 })), mine); mine.push(ptex);
  panel.position.set((px0 + px1) / 2, (py0 + py1) / 2, -0.0045); face.add(panel);
  // The panel's lettering is an oblique of the bundled serif (ours; the real script face is not bundled); drawn again once it has loaded.
  document.fonts?.load?.(SCRIPT, "Uniscope").then(() => {
    const c = ptex.image as HTMLCanvasElement; drawPanel(c.getContext("2d")!, c.width, c.height); ptex.needsUpdate = true;
  }, () => {});

  // The keyboard (keyboard.ts) lies on the base's slope, its back row 24 mm in front of the face, leaving a palm rest
  // of about 7 cm.
  const slope = Math.atan2(FY0 - 0.036, 0.337 - FZ - 0.004), s0 = 0.024;
  const { group: keyboard, caps } = uniscopeKeyboard(at(0, FY0 - s0 * Math.sin(slope), FZ + 0.004 + s0 * Math.cos(slope), slope), ctx.maxAnisotropy, mine);
  object.add(keyboard);

  // The screen: a canvas of 64 x 16 cells (16 x 32 px), green on dark, flat just in front of the dome's crown.
  let lines: string[] = [], key = "";
  const tex = canvasTex(1024, 512, () => {}, ctx.maxAnisotropy); mine.push(tex);
  const cv = tex.image as HTMLCanvasElement, g = cv.getContext("2d")!;
  const FONT = '28px "IBM 3270", monospace';
  const draw = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#06100a"; g.fillRect(0, 0, cv.width, cv.height);
    g.font = FONT; g.textBaseline = "alphabetic";
    const sx = 16 / (g.measureText("M").width || 16);
    g.setTransform(sx, 0, 0, 1, 0, 0);
    g.shadowColor = "rgba(90,255,140,0.75)"; g.shadowBlur = 7;
    lines.forEach((l, r) => {
      g.fillStyle = r === 0 ? "#b8ffc8" : "#6cf08a";
      g.fillText(l.replace(/\t/g, "        ").slice(0, COLS).toUpperCase(), 0, r * 32 + 25);
    });
    tex.needsUpdate = true;
  };
  const refresh = () => {
    const t = sourceText(), k = t.join("\n");
    if (k === key) return;
    key = k; lines = t; draw();
    const last = lines[lines.length - 1] ?? "";
    cursor.position.set((Math.min(COLS - 1, last.trimEnd().length) + 0.5) / COLS * SW - SW / 2, SH / 2 - (lines.length - 0.5) / ROWS * SH - SH / ROWS * 0.35, 0.0004);
  };
  const screen = own(new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })), mine);
  screen.position.set(gcx, gcy, -0.0105 + 0.0034);
  face.add(screen);
  const cursor = own(new THREE.Mesh(new THREE.PlaneGeometry(SW / COLS * 0.9, SH / ROWS * 0.12), new THREE.MeshBasicMaterial({ color: 0x9dffb4, toneMapped: false })), mine);
  screen.add(cursor);
  refresh();
  document.fonts?.load?.(FONT).then(() => { if (lines.length) draw(); }, () => {});

  object.updateMatrixWorld(true);
  let t = 0, poll = 0;
  const normal = new THREE.Vector3(0, sinT, cosT);
  const target = screen.getWorldPosition(new THREE.Vector3());
  return {
    object,
    anchors: {
      screen: { mesh: screen, uvRect: [0, 0, 1, 1] },
      camera: { position: target.clone().addScaledVector(normal, fitDist(SH * 1.5, FOV)), target, fov: FOV },
      view: viewPose([new THREE.Box3().setFromObject(screen), new THREE.Box3().setFromObject(caps)], FOV),
    },
    update(dt) {
      t += dt; poll += dt;
      cursor.visible = t % 1.06 < 0.53;   // a slow blink (ours)
      if (poll > 1) { poll = 0; refresh(); }
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
