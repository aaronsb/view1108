// A UNIVAC FASTRAND II mass storage unit (#89): the 1108's drum file (UP-4046 rev. 3 sec. 8.3.1, p. 8-8: "two large
// magnetic drums", "64 read/write heads per unit, gang-mounted on a common positioning mechanism" that "move laterally
// over 192 recording tracks", positioned in 30 to 86 ms, 57 ms on average; 880 rev/min, p. 8-10; the type 6010-00
// "Fastrand II Storage Unit; 132 million characters", Datapro 70C-877-11, Sep 1970, price list). At MSC the RTACF's
// common data base was "located on a FASTRAND drum (as were most of the programs themselves)" (C. E. Allday, NASA
// TN D-6855, printed p. 8); that concerns the RTACF, not the view program.
//
// The look is from two photographs held locally as references only (not published; rights in
// reference/cache/notes/film-sources.md): a FASTRAND unit (Hagley Museum & Library, © UNISYS) and a FASTRAND II beside
// a person for scale. Read off them: grey-blue end cabinets, a cream centre section, a long window in a grey frame
// with a pale yellow liner, two horizontal drums behind it and the head carriage between them, a dark header on the
// right cabinet with a row of red lamps and two small buttons, a small plate at the left cabinet's top, and a dark
// louvred plinth. The size, 3.5 x 1.6 x 0.9 m, is our estimate from the person in the second photograph (about her
// shoulder height, about twice her height long): we found no manual or brochure on bitsavers (univac/) that gives the
// dimensions. The proportions of the parts, the colours, the lamps' meaning and the motion's pace are ours.
//
// Motion (ours, `BuildContext.still` holds it): the drums turn behind the window, contra to each other, slowly (the real 880 rev/min would
// strobe at the display's frame rate), their streaked surface catching the light; the head carriage, a moving
// carriage per UP-4046, steps along the drums on a seek, now and then when idle and often while busy (its travel shown
// larger than the real track pitch, so it reads); the red lamps flicker with that activity, brighter and busier after
// the engine runs (`tape`) or a reel is mounted.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BuildContext, Equipment, LabEvent, LabState } from "../types";
import { PAL, Parts, at, canvasTex, grid, lampMat, lensGeo, nameplate, paint, poseFrom, rng, satinMetal, smoked } from "./kit";

export const W = 3.5, H = 1.6, D = 0.9;
const PLINTH = 0.16, FZ = D / 2;                          // the plinth's height; the front face
const LEFT = 0.58, RIGHT = 0.8, CENTRE = W - LEFT - RIGHT; // the three sections' widths, west to east
const XL = -W / 2 + LEFT, XR = W / 2 - RIGHT, XC = (XL + XR) / 2;
const WIN = { w: CENTRE - 0.1, y0: 0.6, y1: 1.3 };       // the window's frame
const GLASS = { w: WIN.w - 0.36, y0: 0.66, y1: 1.24 };    // its opening inside the yellow liner
const DRUM = { r: 0.115, len: GLASS.w + 0.12, z: FZ - 0.2, y: [1.04, 0.74] };
const HEAD_Y = 0.89;
const BLUE = 0xa3b6bb, CREAM = 0xe9e4cf, LINER = 0xe6da8e, FRAME = 0x7d7a86;
const LAMPS = 5, LAMP_ON = 0xff3a24, LAMP_OFF = 0x3a1612;
const SPIN = 0.5 * Math.PI * 2;                           // the drums' shown turn, rad/s (ours)

/** The drums' surface: dark blue-grey oxide with light streaks running along the axis, so turning shows. */
function drumTex(): THREE.CanvasTexture {
  const r = rng(6010);
  return canvasTex(512, 64, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#2a3140"); grad.addColorStop(0.5, "#3b4558"); grad.addColorStop(1, "#2a3140");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 26; k++) {
      g.fillStyle = `rgba(${170 + r() * 60},${185 + r() * 50},${230},${0.08 + r() * 0.25})`;
      g.fillRect(r() * w, 0, 1 + r() * 6, h);
    }
  });
}

export function build(ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [], still = !!ctx.still;
  const r = rng(880);
  const P = new Parts();
  // Few materials, so the unit costs few draw calls: one per material of its baked parts.
  const blue = paint(BLUE, 0.7), cream = paint(CREAM, 0.6), dark = paint(PAL.dark, 0.9), charcoal = paint(PAL.charcoal, 0.8);
  const frame = satinMetal(FRAME), liner = paint(LINER, 0.7);
  // The plinth, set back a little, with its louvres.
  P.box(W - 0.04, PLINTH, D - 0.06, dark, 0, PLINTH / 2, -0.01);
  for (let k = 0; k < 6; k++) P.box(W - 0.08, 0.008, 0.012, charcoal, 0, 0.025 + k * 0.022, FZ - 0.035);
  // The body: two grey-blue end cabinets and the cream centre, dark seams between them.
  const bodyH = H - PLINTH, by = PLINTH + bodyH / 2;
  P.box(LEFT, bodyH, D, blue, -W / 2 + LEFT / 2, by, 0);
  P.box(RIGHT, bodyH, D, blue, W / 2 - RIGHT / 2, by, 0);
  // The centre section around the window's cavity (CAV deep behind the front): below, above, either side, behind.
  const CAV = 0.45, wy = (WIN.y0 + WIN.y1) / 2, wh = WIN.y1 - WIN.y0, sw = (CENTRE - WIN.w) / 2;
  P.box(CENTRE, WIN.y0 - PLINTH, D, cream, XC, (PLINTH + WIN.y0) / 2, 0);
  P.box(CENTRE, H - WIN.y1, D, cream, XC, (WIN.y1 + H) / 2, 0);
  for (const s of [-1, 1]) P.box(sw, wh, D, cream, XC + s * (WIN.w / 2 + sw / 2), wy, 0);
  P.box(WIN.w, wh, D - CAV, cream, XC, wy, -CAV / 2);
  // The cavity's lining, dark (the photographs show the drums against a dark interior).
  const lining = dark;
  P.box(WIN.w, 0.01, CAV, lining, XC, WIN.y0 + 0.005, FZ - CAV / 2).box(WIN.w, 0.01, CAV, lining, XC, WIN.y1 - 0.005, FZ - CAV / 2);
  for (const s of [-1, 1]) P.box(0.01, wh, CAV, lining, XC + s * (WIN.w / 2 - 0.005), wy, FZ - CAV / 2);
  for (const x of [XL, XR]) P.box(0.012, bodyH, 0.01, charcoal, x, by, FZ + 0.002);
  P.box(0.01, bodyH - 0.06, 0.006, charcoal, W / 2 - RIGHT + 0.06, by, FZ + 0.002);   // the right door's edge
  // The right cabinet's dark header, carrying the lamps and the buttons.
  P.box(RIGHT - 0.08, 0.1, 0.012, charcoal, W / 2 - RIGHT / 2, H - 0.1, FZ + 0.003);
  // The window: the grey frame, the yellow liner, a dark cavity behind, the drums' bearings at its ends.
  const fy = (WIN.y0 + WIN.y1) / 2, fh = WIN.y1 - WIN.y0, gy = (GLASS.y0 + GLASS.y1) / 2, gh = GLASS.y1 - GLASS.y0;
  P.box(WIN.w, 0.03, 0.03, frame, XC, WIN.y1 - 0.015, FZ + 0.012).box(WIN.w, 0.03, 0.03, frame, XC, WIN.y0 + 0.015, FZ + 0.012);
  for (const s of [-1, 1]) P.box(0.03, fh, 0.03, frame, XC + s * (WIN.w / 2 - 0.015), fy, FZ + 0.012);
  const lw = (WIN.w - 0.06 - GLASS.w) / 2;
  for (const s of [-1, 1]) P.box(lw, fh - 0.06, 0.012, liner, XC + s * (GLASS.w / 2 + lw / 2), fy, FZ + 0.004);
  P.box(GLASS.w, WIN.y1 - 0.03 - GLASS.y1, 0.012, liner, XC, (GLASS.y1 + WIN.y1 - 0.03) / 2, FZ + 0.004);
  P.box(GLASS.w, GLASS.y0 - WIN.y0 - 0.03, 0.012, liner, XC, (GLASS.y0 + WIN.y0 + 0.03) / 2, FZ + 0.004);
  P.box(WIN.w, wh, 0.01, lining, XC, wy, FZ - CAV + 0.005);   // the cavity's back
  for (const s of [-1, 1]) for (const y of DRUM.y) P.box(0.05, 0.12, 0.12, liner, XC + s * (DRUM.len / 2 + 0.025), y, DRUM.z);   // bearing housings
  P.bake(object).forEach(m => mine.push(m.geometry));

  // The drums, streaked cylinders along x, as one mesh: they turn by their texture sliding round them (one draw call).
  const tex = drumTex(); tex.wrapS = THREE.RepeatWrapping;
  const drumMat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.75, roughness: 0.22 });
  // The two drums turn contra to each other (ours, the operator's call; no source we hold gives their directions): the
  // second's u runs the other way round, so the one sliding texture turns it backwards.
  const parts = DRUM.y.map((y, i) => {
    const g = new THREE.CylinderGeometry(DRUM.r, DRUM.r, DRUM.len, 40).rotateZ(Math.PI / 2).rotateX(i * 1.3).translate(XC, y, DRUM.z);
    if (i % 2) { const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, 1 - uv.getX(k)); }
    return g;
  });
  const drumGeo = mergeGeometries(parts)!;
  parts.forEach(g => g.dispose());
  const drums = new THREE.Mesh(drumGeo, drumMat); drums.userData.noShadow = true; object.add(drums);
  mine.push(tex, drumMat, drumGeo);

  // The head carriage: a bar along the drums with the heads in a row, on a positioning mechanism that slides it.
  const carriage = new THREE.Group();
  const C = new Parts();
  // The 64 heads (UP-4046 p. 8-8), in a row along the bar; the bar and its rail in two materials.
  C.box(DRUM.len - 0.1, 0.028, 0.03, frame, 0, 0, 0).box(DRUM.len - 0.1, 0.012, 0.05, charcoal, 0, -0.02, -0.01);
  for (let k = 0; k < 64; k++) C.box(0.008, 0.02, 0.016, charcoal, -(DRUM.len - 0.16) / 2 + k * (DRUM.len - 0.16) / 63, 0.004, 0.022);
  C.bake(carriage).forEach(m => { m.userData.noShadow = true; mine.push(m.geometry); });
  carriage.position.set(XC, HEAD_Y, DRUM.z + 0.07);
  object.add(carriage);

  // The glass, over all of it.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(GLASS.w, gh), smoked(0.12, 0x2a3036));
  glass.position.set(XC, gy, FZ + 0.006); glass.renderOrder = 1; object.add(glass);
  mine.push(glass.geometry);

  // The red lamps on the right header, and two small buttons (green, white) at its right end: one instanced mesh.
  const lamps = grid(lensGeo(), lampMat(), LAMPS + 2, 1, c => c < LAMPS ? at(XR + 0.09 + c * 0.04, H - 0.1, FZ + 0.009, 0, 0, 0, 0.026) : at(W / 2 - 0.16 + (c - LAMPS) * 0.04, H - 0.1, FZ + 0.009, 0, 0, 0, 0.024),
    c => c < LAMPS ? LAMP_OFF : c === LAMPS ? 0x3fa060 : 0xd8d8cc);
  object.add(lamps); mine.push(lamps);
  for (const m of [glass, lamps]) m.userData.noShadow = true;
  // The plate at the left cabinet's top (ours: its word).
  const plate = nameplate("UNIVAC", { height: 0.03, fg: "#2a2a2a", bg: "#e6e0c8" }, mine);
  plate.position.set(-W / 2 + 0.16, H - 0.12, FZ + 0.002); object.add(plate);

  // State: activity (0 idle .. 1 busy), the lamps, the carriage's seek.
  let act = 0.15, mounted: string | null = null, seekIn = 2 + r() * 6, from = 0, to = 0, seekT = 1;
  const on = Array.from({ length: LAMPS }, () => r() < 0.4), col = new THREE.Color();
  const setLamps = () => {
    const k = 0.45 + 0.55 * act;
    on.forEach((o, i) => lamps.setColorAt(i, o ? col.set(LAMP_ON).multiplyScalar(k) : col.set(LAMP_OFF)));
    lamps.instanceColor!.needsUpdate = true;
  };
  setLamps();
  // A seek's step and the whole travel, m, ours: the heads cover 192 tracks (UP-4046 p. 8-8); at an assumed 106 tracks
  // an inch (our guess, not sourced) that is about 46 mm, close to the 50 mm drawn; the steps are drawn coarser.
  const STEP = 0.012, TRAVEL = 0.05;

  return {
    object,
    inert: true,
    anchors: { camera: poseFrom(new THREE.Vector3(XC, 0.95, FZ), [0.2, 0.08, 1], 3.0, 40) },
    update(dt, s: LabState) {
      if (mounted !== s.mounted) { if (mounted !== null) act = 1; mounted = s.mounted; }   // a reel mounted: a run loads
      if (still) return;
      act += (0.15 - act) * (1 - Math.exp(-dt / 4));
      tex.offset.x = (tex.offset.x + SPIN / (Math.PI * 2) * dt) % 1;   // u runs round the drums
      // A seek: the carriage slides to another track position in about 57 ms (shown over 0.15 s).
      if ((seekIn -= dt) < 0) {
        seekIn = act > 0.5 ? 0.3 + r() * 0.9 : 4 + r() * 11;
        from = carriage.position.x - XC; to = Math.max(-TRAVEL / 2, Math.min(TRAVEL / 2, from + (r() < 0.5 ? -1 : 1) * STEP * (1 + Math.floor(r() * 3)))); seekT = 0;
      }
      if (seekT < 1) { seekT = Math.min(1, seekT + dt / 0.15); carriage.position.x = XC + from + (to - from) * seekT * seekT * (3 - 2 * seekT); }
      // The lamps flicker with the activity.
      let changed = false;
      for (let i = 0; i < LAMPS; i++) if (r() < dt * (1 + 18 * act)) { on[i] = r() < 0.3 + 0.5 * act; changed = true; }
      if (changed || act > 0.16) setLamps();
    },
    event(e: LabEvent) { if (e.type === "tape") act = 1; },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
