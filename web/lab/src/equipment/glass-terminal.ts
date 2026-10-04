// The glass terminal: a UNISCOPE 100 Display Terminal (UP-7701 rev. 2, 1973, Figure 1-1 on p. 1), standing on a desk;
// clicking it opens the Source tab. 18 W x 13 H x 27 D in (p. 30), 0.46 x 0.33 x 0.69 m here; viewing area 10 x 5 in,
// green characters on a dark background, 16 lines of 64 or 12 of 80 (p. 1). Its shape follows the figure: a dark
// hood over the screen on a light keyboard base, a small control panel with round buttons. The UNISCOPE 100 was
// delivered from 1970, a year after the film (Wikipedia, "Uniscope"): an anachronism we keep for the Source tab.
// The origin is on the desk top under the terminal's centre.
//
// The screen shows the kernel's FORTRAN, 16 lines of 64 columns: where the Source tab stands (its marked line or
// current unit), else VFRAME in vdrive.f from the page's embedded listing. It is redrawn only when that text changes;
// the cursor is its own small mesh, blinking.
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";
import { Parts, at, canvasTex, fitDist, glowMat, grid, keyGeo, lensGeo, own, paint, plastic, satinMetal, tubeGlass } from "./kit";

const FOV = 40, COLS = 64, ROWS = 16;
const SW = 0.254, SH = 0.127;              // 10 x 5 in
const TILT = Math.atan2(0.045, 0.255);     // the face leans back

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
  const base = paint(0xc6c7c2), hood = paint(0x2c2f32, 0.8);

  // Keyboard base (light) and hood (dark), as side profiles (z, y) across the width.
  P.profile([[0.345, 0], [0.345, 0.022], [0.12, 0.076], [-0.34, 0.076], [-0.34, 0]], -0.23, 0.23, base, 0.006);
  P.profile([[0.15, 0.074], [0.105, 0.33], [-0.335, 0.318], [-0.345, 0.074]], -0.23, 0.23, hood, 0.008);
  // The face: dark glass over the tube, a light name strip under it.
  const face = (t: number, n: number) => new THREE.Vector3(0, 0.074 + 0.256 * t, 0.15 - 0.045 * t + 0.011).addScaledVector(new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT)), n);
  const fc = face(0.56, 0.0015);
  P.add(new THREE.PlaneGeometry(0.4, 0.2), tubeGlass(0x0a110c), at(0, fc.y, fc.z, -TILT));
  const st = face(0.08, 0.002);
  P.add(new THREE.BoxGeometry(0.4, 0.022, 0.004), paint(0xb9bab4, 0.7), at(0, st.y, st.z, -TILT));
  // Control panel: two round buttons at the right of the keyboard.
  const KB = at(0, 0.052, 0.23, Math.atan2(0.054, 0.225));
  for (const x of [0.15, 0.185]) P.add(new THREE.CylinderGeometry(0.008, 0.009, 0.01, 16), satinMetal(0xd0d0cc), KB.clone().multiply(at(x, 0.005, -0.075)));
  P.bake(object).forEach(m => mine.push(m.geometry));

  // Keys: five rows on the slope, a space bar (instanced).
  const flat = -Math.PI / 2, KP = 0.019, KS = 0.0155, kh = 0.011 / 0.55;
  const places: THREE.Matrix4[] = [], cols: number[] = [];
  [12, 12, 11, 11, 10].forEach((n, r) => { for (let c = 0; c < n; c++) { places.push(KB.clone().multiply(at(-0.13 + r * 0.005 + c * KP, 0.002, -0.07 + r * KP, flat, 0, 0, KS, KS, kh))); cols.push(c === 0 || c === n - 1 ? 0x8f908c : 0xc9c8c0); } });
  places.push(KB.clone().multiply(at(-0.03, 0.002, 0.03, flat, 0, 0, KS * 7, KS, kh))); cols.push(0xc9c8c0);
  const keys = grid(keyGeo(), plastic(0xffffff, 0.55), places.length, 1, i => places[i], i => cols[i]);
  object.add(keys); mine.push(keys);
  // Two status lamps on the strip (HYPOTHETICAL placement).
  for (const [x, c] of [[0.15, 0x7dff9a], [0.17, 0xffb040]] as const) {
    const l = new THREE.Mesh(lensGeo(), glowMat(c)); l.position.copy(face(0.08, 0.004)); l.position.x = x; l.rotation.x = -TILT; l.scale.setScalar(0.007); object.add(l);
  }

  // The screen: a canvas of 64 x 16 cells (16 x 32 px), green on dark.
  let lines: string[] = [], key = "";
  const tex = canvasTex(1024, 512, () => {}, ctx.maxAnisotropy); mine.push(tex);
  const cv = tex.image as HTMLCanvasElement, g = cv.getContext("2d")!;
  const FONT = '28px "IBM 3270", "Courier New", monospace';
  const draw = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#030a05"; g.fillRect(0, 0, cv.width, cv.height);
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
  screen.position.copy(face(0.56, 0.003)); screen.rotation.x = -TILT;
  object.add(screen);
  const cursor = own(new THREE.Mesh(new THREE.PlaneGeometry(SW / COLS * 0.9, SH / ROWS * 0.12), new THREE.MeshBasicMaterial({ color: 0x9dffb4, toneMapped: false })), mine);
  screen.add(cursor);
  refresh();
  document.fonts?.load?.(FONT).then(() => { if (lines.length) draw(); }, () => {});

  let t = 0, poll = 0;
  const normal = new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT));
  const target = screen.position.clone();
  return {
    object,
    opens: "source",
    anchors: {
      screen: { mesh: screen, uvRect: [0, 0, 1, 1] },
      camera: { position: target.clone().addScaledVector(normal, fitDist(SH * 1.5, FOV)), target, fov: FOV },
    },
    update(dt) {
      t += dt; poll += dt;
      cursor.visible = t % 1.06 < 0.53;   // a slow blink (ours)
      if (poll > 1) { poll = 0; refresh(); }
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}

