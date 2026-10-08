// The 1108's power distribution unit, HYPOTHETICAL (docs/lab.md, "The power cabinet"): a low floor-standing cabinet,
// 1.0 x 1.13 x 0.7 m, with an instrument panel sloped up toward a standing viewer over a pair of side-hinged doors.
//
// The sloped panel: three round ammeters (phase A, B, C), a line-to-line voltmeter with its phase selector, a frequency meter in cycles, an elapsed-hours counter, a key switch and a guarded emergency-off button, a
// status row lit and an alarm row dark. The dial faces, scales and legends are one canvas texture in the panel; the
// needles are one instanced mesh, turned each frame; the loads wander slowly, rise and flicker while the page is busy
// or the tape units run. Behind the doors: copper bus bars on standoffs, the main and branch breakers with their
// directory strip, a dry transformer, a terminal strip, cable bundles and a ground bar. Using the cabinet (E, or a
// click) swings the doors open, and again shut. The selector knob is a piece of its own (`anchors.selector`, which the
// room places under its own name): using it steps it OFF, A-B, B-C, C-A, and the voltmeter follows.
import * as THREE from "three";
import type { BuildContext, Equipment, LabEvent, LabState } from "../types";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PAL, Parts, at, fitDist, fontTex, lampMat, paint, plastic, plateText, poseFrom, rng, chrome, satinMetal, tileGeo } from "./kit";

// The body (metres, the front toward +Z): the vertical front from the plinth to FRONT_TOP, then the panel sloped back
// TILT from vertical for SLANT, then a flat top to the back.
const HW = 0.5, HD = 0.35, FRONT_TOP = 0.68, TILT = 40 * Math.PI / 180, SLANT = 0.58;
const TOP = FRONT_TOP + SLANT * Math.cos(TILT), TOP_Z = HD - SLANT * Math.sin(TILT);
const DOOR_Y0 = 0.1, DOOR_Y1 = FRONT_TOP - 0.025, DOOR_W = 0.475, OPEN = 100 * Math.PI / 180, SWING_S = 0.9;

// The panel in its own plane (u across, v up the slope from its front edge, metres); the canvas maps it at PX a metre.
const X0 = -0.46, X1 = 0.46, Y0 = 0.02, Y1 = 0.56, PX = 1400;
const CW = Math.round((X1 - X0) * PX), CH = Math.round((Y1 - Y0) * PX);
const cx = (x: number) => (x - X0) * PX, cy = (y: number) => (Y1 - y) * PX;

// A round switchboard meter: face radius R, the needle's pivot below the centre, a 100-degree scale.
const R = 0.054, PIV = -0.023, ARC = 0.051, NEEDLE = 0.059, SWEEP = 50 * Math.PI / 180, DIALZ = 0.01;
interface Meter { x: number; y: number; min: number; max: number; major: number; minor: number; nums: number[]; unit: string; red?: number }
const MY = 0.385, AMPS = { min: 0, max: 150, major: 25, minor: 5, nums: [0, 50, 100, 150], unit: "AC AMPERES" };
const METERS: Meter[] = [
  { x: -0.375, y: MY, ...AMPS }, { x: -0.225, y: MY, ...AMPS }, { x: -0.075, y: MY, ...AMPS },
  { x: 0.075, y: MY, min: 0, max: 300, major: 50, minor: 10, nums: [0, 100, 200, 300], unit: "AC VOLTS", red: 208 },
  { x: 0.375, y: MY, min: 55, max: 65, major: 1, minor: 0.5, nums: [55, 60, 65], unit: "CYCLES", red: 60 },
];
// The selector's positions: OFF, then the three pairs; its angle from straight up (positive clockwise) and the line
// voltage it reads there (ours: a little unbalanced).
const SEL = { x: 0.225, y: MY + 0.005 }, PAIRS = ["A-B", "B-C", "C-A"], PAIR_ANGLE = [-45, 0, 45].map(d => d * Math.PI / 180);
const SEL_ANGLE = [-103 * Math.PI / 180, ...PAIR_ANGLE], SEL_VOLTS = [0, 207.5, 209, 208.2];
const KEY = { x: -0.3, y: 0.215 }, HOURS = { x: 0, y: 0.215 }, EPO = { x: 0.3, y: 0.22 };
const LAMPX = [-0.24, -0.12, 0, 0.12, 0.24], STATUS_Y = 0.1, ALARM_Y = 0.05, LW = 0.09, LH = 0.038, LTOP = 0.13;
const STATUS = [["POWER", "ON"], ["PHASE A", ""], ["PHASE B", ""], ["PHASE C", ""], ["MAIN BKR", "CLOSED"]];
const ALARMS = [["OVER", "TEMP"], ["OVER", "CURRENT"], ["PHASE", "LOSS"], ["GROUND", "FAULT"], ["UNDER", "VOLTAGE"]];
// Behind the doors: the breakers on the mounting plate, their directory strip under them.
const BAY = 0.28, BKR_Y = 0.43, BRANCH = ["CPU", "STOR 1", "STOR 2", "DRUMS", "TAPES", "CONSOLE", "PRINTER", "SPARE"];
const branchX = (k: number) => -0.19 + k * 0.077;
const DIR = { x0: -0.44, x1: 0.44, y: 0.31, h: 0.03 }, DPX = 1400;
// The loads, ours: phase currents a little unbalanced, about half scale.
const BASE_A = [78, 84, 71];

/** A point on a meter's scale circle `r` from its pivot at value `v`, in metres. */
function scalePt(m: Meter, v: number, r: number): [number, number] {
  const a = -SWEEP + 2 * SWEEP * (v - m.min) / (m.max - m.min);
  return [m.x + r * Math.sin(a), m.y + PIV + r * Math.cos(a)];
}

function engraved(g: CanvasRenderingContext2D, text: string, x: number, y: number, h: number, align: "left" | "center" | "right" = "center"): void {
  g.fillStyle = "#e6e2d6"; plateText(g, text, cx(x), cy(y), h * PX, 0.1, align, 0.03);
}

function drawPanel(g: CanvasRenderingContext2D): void {
  g.fillStyle = "#363b40"; g.fillRect(0, 0, CW, CH);
  // Fine engraved rules framing the groups.
  g.strokeStyle = "rgba(230,226,214,0.55)"; g.lineWidth = 2;
  const box = (x0: number, y0: number, x1: number, y1: number) => g.strokeRect(cx(x0), cy(y1), (x1 - x0) * PX, (y1 - y0) * PX);
  box(-0.45, 0.49, 0.45, 0.553); box(-0.45, 0.027, 0.45, 0.127);
  engraved(g, "POWER DISTRIBUTION", 0, 0.53, 0.02);
  engraved(g, "208 V   3 PHASE   4 WIRE   60 CYCLES", 0, 0.503, 0.0095);

  const LEG = ["PHASE A", "PHASE B", "PHASE C", "LINE VOLTS", "FREQUENCY"];
  for (const [k, m] of METERS.entries()) {
    const fx = cx(m.x), fy = cy(m.y), px = cx(m.x), py = cy(m.y + PIV);
    g.fillStyle = "#eeebe1"; g.beginPath(); g.arc(fx, fy, R * PX, 0, 2 * Math.PI); g.fill();
    g.strokeStyle = "#111"; g.lineWidth = 3;
    g.beginPath(); g.arc(px, py, ARC * PX, -Math.PI / 2 - SWEEP, -Math.PI / 2 + SWEEP); g.stroke();
    for (let v = m.min, i = 0; v <= m.max + 1e-9; v = m.min + ++i * m.minor) {
      const major = Math.abs((v - m.min) / m.major - Math.round((v - m.min) / m.major)) < 1e-6;
      const [x0, y0] = scalePt(m, v, ARC), [x1, y1] = scalePt(m, v, ARC - (major ? 0.0075 : 0.0042));
      g.lineWidth = major ? 3 : 1.6; g.beginPath(); g.moveTo(cx(x0), cy(y0)); g.lineTo(cx(x1), cy(y1)); g.stroke();
    }
    if (m.red !== undefined) {
      const [x0, y0] = scalePt(m, m.red, ARC + 0.002), [x1, y1] = scalePt(m, m.red, ARC - 0.01);
      g.strokeStyle = "#b3261e"; g.lineWidth = 4; g.beginPath(); g.moveTo(cx(x0), cy(y0)); g.lineTo(cx(x1), cy(y1)); g.stroke();
    }
    g.fillStyle = "#111"; g.font = `${0.0092 * PX}px Helvetica, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    for (const v of m.nums) { const [x, y] = scalePt(m, v, ARC - 0.016); g.fillText(String(v), cx(x), cy(y)); }
    g.font = `${0.0066 * PX}px Helvetica, Arial, sans-serif`;
    g.fillText(m.unit, fx, cy(m.y - 0.007));
    g.font = `${0.004 * PX}px Helvetica, Arial, sans-serif`;
    g.fillText("SWITCHBOARD INSTRUMENT  ·  ACCURACY 1%", fx, cy(m.y - 0.041));
    g.beginPath(); g.arc(px, py, 0.0038 * PX, 0, 2 * Math.PI); g.fill();
    engraved(g, LEG[k], m.x, m.y - 0.077, 0.0095);
  }

  // The voltmeter's selector: its positions around the knob.
  engraved(g, "VOLTMETER", SEL.x, MY - 0.077, 0.0095);
  PAIRS.forEach((p, i) => engraved(g, p, SEL.x + 0.042 * Math.sin(PAIR_ANGLE[i]), SEL.y + 0.042 * Math.cos(PAIR_ANGLE[i]), 0.0085));
  engraved(g, "OFF", SEL.x - 0.045, SEL.y - 0.01, 0.0075);
  // The key switch, OFF and ON.
  engraved(g, "OFF", KEY.x - 0.03, KEY.y + 0.028, 0.0085); engraved(g, "ON", KEY.x + 0.03, KEY.y + 0.028, 0.0085);
  engraved(g, "CONTROL POWER", KEY.x, KEY.y - 0.045, 0.0095);
  // The elapsed-hours meter: a drum counter in a black window.
  g.fillStyle = "#121314"; g.fillRect(cx(HOURS.x - 0.05), cy(HOURS.y + 0.018), 0.1 * PX, 0.036 * PX);
  g.strokeStyle = "#9a9d9f"; g.lineWidth = 3; g.strokeRect(cx(HOURS.x - 0.05), cy(HOURS.y + 0.018), 0.1 * PX, 0.036 * PX);
  [..."047126"].forEach((d, i) => {
    const x = HOURS.x - 0.04 + i * 0.016;
    g.fillStyle = i === 5 ? "#e8e4da" : "#2a2b2c"; g.fillRect(cx(x - 0.0065), cy(HOURS.y + 0.013), 0.013 * PX, 0.026 * PX);
    g.fillStyle = i === 5 ? "#111" : "#eeeae0"; g.font = `bold ${0.018 * PX}px Helvetica, Arial, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(d, cx(x), cy(HOURS.y));
  });
  engraved(g, "ELAPSED HOURS", HOURS.x, HOURS.y - 0.045, 0.0095);
  // The emergency-off button's plate, red, under its guard.
  g.fillStyle = "#a82a1f"; g.fillRect(cx(EPO.x - 0.06), cy(EPO.y - 0.046), 0.12 * PX, 0.022 * PX);
  g.fillStyle = "#f2efe6"; plateText(g, "EMERGENCY OFF", cx(EPO.x), cy(EPO.y - 0.057), 0.0085 * PX, 0.08, "center", 0.04);

  engraved(g, "STATUS", -0.44, STATUS_Y, 0.0075, "left");
  engraved(g, "ALARM", -0.44, ALARM_Y, 0.0075, "left");
}

/** The lamp lenses' legends: engraved letters, dark on the lit status lenses, faint on the dark alarm lenses. */
function drawLegends(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.clearRect(0, 0, w, h);
  const row = (labels: string[][], y: number, fill: string) => labels.forEach(([a, b], i) => {
    g.fillStyle = fill;
    const x = (LAMPX[i] - X0) * PX, yy = (LTOP - y) * PX;
    if (b) { plateText(g, a, x, yy - 0.0075 * PX, 0.0075 * PX, 0.08, "center", 0.05); plateText(g, b, x, yy + 0.0075 * PX, 0.0075 * PX, 0.08, "center", 0.05); }
    else plateText(g, a, x, yy, 0.0085 * PX, 0.08, "center", 0.05);
  });
  row(STATUS, STATUS_Y, "rgba(20,20,18,0.85)");
  row(ALARMS, ALARM_Y, "rgba(200,180,170,0.35)");
}

/** The breakers' directory strip: the main's rating and each branch's name, typed on a card. */
function drawDirectory(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = "#e9e3cf"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#1c1c1a"; g.font = `${0.012 * DPX}px "Courier New", Courier, monospace`; g.textAlign = "center"; g.textBaseline = "middle";
  const x = (u: number) => (u - DIR.x0) * DPX;
  g.fillText("MAIN 225 A", x(-0.36), h / 2);
  BRANCH.forEach((b, k) => g.fillText(b, x(branchX(k)), h / 2));
}

/** UVs sampling the panel canvas at each vertex's (u, v). */
function panelUV(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[2 * i] = (p.getX(i) - X0) / (X1 - X0); uv[2 * i + 1] = (p.getY(i) - Y0) / (Y1 - Y0); }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

const circle = (x: number, y: number, r: number, n = 40): [number, number][] =>
  Array.from({ length: n }, (_, i) => [x + r * Math.cos(2 * Math.PI * i / n), y + r * Math.sin(2 * Math.PI * i / n)]);

export function build(ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const warm = paint(PAL.warm), dark = paint(PAL.dark, 0.9), black = plastic(0x161718, 0.5);

  // ---- The body: plinth, the closed head under the sloped panel, sides, back and floor of the door bay. ----
  const P = new Parts();
  P.box(2 * HW - 0.04, 0.08, 2 * HD - 0.04, dark, 0, 0.04, 0);
  P.profile([[HD, DOOR_Y1], [HD, FRONT_TOP], [TOP_Z, TOP], [-HD, TOP], [-HD, DOOR_Y1]], -HW, HW, warm);
  for (const x of [-HW + 0.01, HW - 0.01]) P.box(0.02, DOOR_Y1 - 0.08, 2 * HD, warm, x, (DOOR_Y1 + 0.08) / 2, 0);
  P.box(2 * HW - 0.04, DOOR_Y1 - 0.08, 0.02, warm, 0, (DOOR_Y1 + 0.08) / 2, -HD + 0.01);
  P.box(2 * HW - 0.04, 0.02, 2 * HD - 0.02, warm, 0, 0.09, 0);
  P.box(2 * HW, 0.012, 0.012, dark, 0, DOOR_Y1 + 0.006, HD + 0.002);   // the reveal over the doors
  P.box(2 * HW, 0.014, TOP_Z + HD + 0.01, paint(0xd8d5cc), 0, TOP + 0.007, (TOP_Z - HD + 0.01) / 2);

  P.bake(object).forEach(m => mine.push(m.geometry));

  // ---- Inside the door bay (ours): a galvanised mounting pan and what is on it, built against the back wall and
  //      brought forward BAY so that a standing viewer sees it through the open doors. ----
  const bay = new THREE.Group(); bay.position.z = BAY; object.add(bay);
  const I = new Parts();
  const galv = satinMetal(0x9c9e9a), copper = new THREE.MeshStandardMaterial({ color: 0xb8734a, metalness: 0.8, roughness: 0.32 });
  const tinned = satinMetal(0xc4c6c2), phenolic = plastic(0x6b3a22, 0.5), cable = plastic(0x1a1a1a, 0.7), cream = plastic(0xe6dfcc, 0.55);
  mine.push(copper);
  I.box(2 * HW - 0.08, DOOR_Y1 - 0.13, 0.008, galv, 0, (DOOR_Y1 + 0.11) / 2, -HD + 0.025);
  // Bus bars: phases A, B, C and the tinned neutral, on brown phenolic standoffs.
  [0.6, 0.575, 0.55, 0.525].forEach((y, i) => {
    I.box(0.78, 0.012, 0.006, i < 3 ? copper : tinned, 0.03, y, -0.27);
    for (const x of [-0.32, 0.38]) I.cyl(0.007, 0.007, 0.05, phenolic, x, y, -0.295, 10, true);
  });
  // Main breaker, larger, and the branches; every handle up (on). Taps from the bars down to each.
  const bkr = (x: number, w: number, h: number, d: number) => {
    I.box(w, h, d, black, x, BKR_Y, -HD + 0.03 + d / 2);
    I.box(w * 0.3, h * 0.22, 0.026, black, x, BKR_Y + h * 0.16, -HD + 0.03 + d + 0.008, -0.35);
    I.box(0.008, 0.52 - BKR_Y - h / 2 + 0.06, 0.004, copper, x, (0.58 + BKR_Y + h / 2) / 2, -0.268);
  };
  bkr(-0.36, 0.12, 0.17, 0.12);
  BRANCH.forEach((_b, k) => bkr(branchX(k), 0.05, 0.1, 0.09));
  I.box(DIR.x1 - DIR.x0 + 0.01, DIR.h + 0.01, 0.01, galv, 0, DIR.y, -0.25);
  // The feed: three heavy cables up from the floor into the main breaker.
  for (const [k, x] of [-0.4, -0.36, -0.32].entries()) I.cyl(0.016, 0.016, BKR_Y - 0.17 / 2 - 0.1, cable, x, (BKR_Y - 0.085 + 0.1) / 2, -0.26 + k * 0.012);
  // A dry transformer (control power): its core and three varnished coils.
  I.box(0.3, 0.025, 0.12, dark, 0.27, 0.115, -0.22).box(0.3, 0.025, 0.12, dark, 0.27, 0.285, -0.22);
  for (const x of [0.17, 0.27, 0.37]) I.cyl(0.042, 0.042, 0.145, copper, x, 0.2, -0.22, 20);
  // A terminal strip on its rail, the branch cables dressed down to it in a bundle, and the ground bar.
  I.box(0.4, 0.012, 0.012, tinned, -0.15, 0.23, -0.31);
  for (let k = 0; k < 14; k++) I.box(0.022, 0.05, 0.035, cream, -0.33 + k * 0.0275, 0.23, -0.29);
  for (const k of [0, 2, 4, 6]) I.cyl(0.011, 0.011, BKR_Y - 0.05 - 0.27, cable, branchX(k) + 0.012, (BKR_Y - 0.05 + 0.27) / 2, -0.27);
  I.cyl(0.03, 0.03, 0.24, cable, 0.04, 0.27 - 0.12, -0.27);   // the bundle down to the floor
  I.box(0.3, 0.012, 0.008, tinned, -0.15, 0.13, -0.3);
  I.bake(bay).forEach(m => mine.push(m.geometry));

  const dir = new THREE.Mesh(new THREE.PlaneGeometry(DIR.x1 - DIR.x0, DIR.h), new THREE.MeshStandardMaterial({ roughness: 0.8 }));
  const dirTex = fontTex(Math.round((DIR.x1 - DIR.x0) * DPX), Math.round(DIR.h * DPX), drawDirectory, 4);
  (dir.material as THREE.MeshStandardMaterial).map = dirTex;
  dir.position.set(0, DIR.y, -0.244); bay.add(dir);
  mine.push(dir.geometry, dir.material as THREE.Material, dirTex);

  // ---- The doors: a pair on side hinges, each with louvres and a handle. They move, so they are not baked. ----
  const doors: THREE.Group[] = [];
  const louvre = mergeGeometries(Array.from({ length: 6 }, (_, k) => new THREE.BoxGeometry(0.28, 0.008, 0.006).translate(0, 0.17 + k * 0.022, 0.012)))!;
  const leaf = new THREE.BoxGeometry(DOOR_W - 0.006, DOOR_Y1 - DOOR_Y0 - 0.006, 0.016), grip = new THREE.BoxGeometry(0.012, 0.14, 0.02);
  mine.push(louvre, leaf, grip);
  for (const side of [-1, 1]) {
    const d = new THREE.Group(); d.position.set(side * (HW - 0.005), 0, HD + 0.008);
    const inward = -side;   // the leaf runs from its hinge toward the middle
    const m = new THREE.Mesh(leaf, warm); m.position.set(inward * DOOR_W / 2, (DOOR_Y0 + DOOR_Y1) / 2, 0); d.add(m);
    const l = new THREE.Mesh(louvre, dark); l.position.set(inward * DOOR_W / 2, DOOR_Y0, 0); d.add(l);
    const h = new THREE.Mesh(grip, chrome()); h.position.set(inward * (DOOR_W - 0.045), 0.44, 0.016); d.add(h);
    object.add(d); doors.push(d);
  }

  // ---- The sloped panel: its own frame (u, v, out of the plate), tilted back TILT from the vertical front's top. ----
  const slope = new THREE.Group(); slope.position.set(0, FRONT_TOP, HD); slope.rotation.x = -TILT; object.add(slope);
  const Z = 0.008;
  const Q = new Parts();
  Q.box(X1 - X0 + 0.02, Y1 - Y0 + 0.02, 0.008, paint(PAL.charcoal, 0.9), 0, (Y0 + Y1) / 2, 0.004);
  for (const m of METERS) Q.outline(circle(m.x, m.y, R + 0.008), Z, Z + DIALZ + 0.004, black, 0, [circle(m.x, m.y, R)]);
  Q.cyl(0.023, 0.023, 0.006, chrome(), SEL.x, SEL.y, Z + 0.003, 32, true);
  Q.cyl(0.016, 0.017, 0.016, chrome(), KEY.x, KEY.y, Z + 0.008, 24, true);
  Q.box(0.003, 0.018, 0.004, black, KEY.x, KEY.y, Z + 0.017, 0, 0, -40 * Math.PI / 180);
  // Emergency off: a yellow guard collar and a red mushroom head on its stem.
  Q.outline(circle(EPO.x, EPO.y, 0.04), Z, Z + 0.028, plastic(0xd9b21c, 0.4), 0, [circle(EPO.x, EPO.y, 0.032)]);
  Q.cyl(0.011, 0.011, 0.02, black, EPO.x, EPO.y, Z + 0.01, 16, true);
  Q.cyl(0.027, 0.028, 0.015, plastic(0xc0231a, 0.35), EPO.x, EPO.y, Z + 0.024, 28, true);
  Q.bake(slope).forEach(m => mine.push(m.geometry));

  // The selector's pointer knob, with an unseen disc around it that is easier to point at; it starts on A-B.
  const knobGeo = mergeGeometries([new THREE.CylinderGeometry(0.014, 0.016, 0.016, 24).rotateX(Math.PI / 2), new THREE.BoxGeometry(0.008, 0.044, 0.012).translate(0, 0.007, 0.002)])!;
  const pickGeo = new THREE.CircleGeometry(0.05, 24).translate(0, 0, 0.02), pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const knob = new THREE.Group(); knob.position.set(SEL.x, SEL.y, Z + 0.014); slope.add(knob);
  knob.add(new THREE.Mesh(knobGeo, black), new THREE.Mesh(pickGeo, pickMat));
  mine.push(knobGeo, pickGeo, pickMat);
  const panel = { open: false, sel: 1 };   // the doors' goal and the selector's position; the soundscape listens to both
  knob.rotation.z = -SEL_ANGLE[panel.sel];
  const selector: Equipment = {
    object: knob, anchors: {},
    use() { panel.sel = (panel.sel + 1) % SEL_ANGLE.length; knob.rotation.z = -SEL_ANGLE[panel.sel]; },
  };

  // The plate face: the panel and the dial faces raised in their bezels, one texture.
  const tex = fontTex(CW, CH, drawPanel, 8);
  const faces = [panelUV(new THREE.PlaneGeometry(X1 - X0, Y1 - Y0).translate(0, (Y0 + Y1) / 2, Z)),
    ...METERS.map(m => panelUV(new THREE.CircleGeometry(R, 48).translate(m.x, m.y, Z + DIALZ)))];
  const faceGeo = mergeGeometries(faces)!; faces.forEach(g => g.dispose());
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.05 });
  const face = new THREE.Mesh(faceGeo, faceMat); slope.add(face);
  mine.push(faceGeo, faceMat, tex);

  // Lamps: square legend lenses, one instanced mesh; and their legends over them.
  const lamps = new THREE.InstancedMesh(tileGeo(), lampMat(), 10);
  const lit = [0xfff3dc, 0x7dff9a, 0x7dff9a, 0x7dff9a, 0xfff3dc].map(c => new THREE.Color(c).multiplyScalar(0.85));
  const unlit = new THREE.Color(0.085, 0.024, 0.02);
  LAMPX.forEach((x, i) => {
    lamps.setMatrixAt(i, at(x, STATUS_Y, Z, 0, 0, 0, LW, LH, 0.04)); lamps.setColorAt(i, lit[i]);
    lamps.setMatrixAt(5 + i, at(x, ALARM_Y, Z, 0, 0, 0, LW, LH, 0.04)); lamps.setColorAt(5 + i, unlit);
  });
  slope.add(lamps); mine.push(lamps);
  const LGH = LTOP - Y0;
  const legTex = fontTex(CW, Math.round(LGH * PX), drawLegends, 4);
  const legGeo = new THREE.PlaneGeometry(X1 - X0, LGH).translate(0, LTOP - LGH / 2, Z + 0.0125);
  const legMat = new THREE.MeshBasicMaterial({ map: legTex, transparent: true, depthWrite: false });
  slope.add(new THREE.Mesh(legGeo, legMat));
  mine.push(legGeo, legMat, legTex);

  // Needles: black pointers pivoting below each dial's centre.
  const needleGeo = new THREE.BoxGeometry(0.002, NEEDLE + 0.008, 0.0012).translate(0, (NEEDLE + 0.008) / 2 - 0.008, 0);
  const needles = new THREE.InstancedMesh(needleGeo, plastic(0x0d0d0d, 0.6), METERS.length);
  needles.frustumCulled = false;
  slope.add(needles); mine.push(needleGeo, needles);

  // Needle motion: each a damped spring toward its reading (0.65 s period, damping 0.6 of critical: ours).
  const W2 = 9.7 ** 2, DAMP = 2 * 0.6 * 9.7, r = rng(208), pos = METERS.map(m => (m.min + m.max) / 2), vel = METERS.map(() => 0);
  let t = r() * 100, settled = false, busy = 0, tape = 0, lastFrame = -1, jitterT = 0;
  const jitter = [0, 0, 0, 0, 0];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), one = new THREE.Vector3(1, 1, 1);
  const place = () => {
    METERS.forEach((m, i) => {
      const v = Math.min(m.max + (m.max - m.min) * 0.03, Math.max(m.min - (m.max - m.min) * 0.03, pos[i]));
      const a = -SWEEP + 2 * SWEEP * (v - m.min) / (m.max - m.min);
      needles.setMatrixAt(i, m4.compose(new THREE.Vector3(m.x, m.y + PIV, Z + DIALZ + 0.003), q.setFromAxisAngle(zAxis, -a), one));
    });
    needles.instanceMatrix.needsUpdate = true;
  };
  const target = (i: number, load: number) => {
    if (i < 3) return BASE_A[i] + 2.2 * Math.sin(t * 0.11 * (i + 1) + i * 2.1) + 1.1 * Math.sin(t * 0.37 + i) + 10 * load + jitter[i];
    if (i === 3) return panel.sel ? SEL_VOLTS[panel.sel] + 0.6 * Math.sin(t * 0.07) - 2.5 * load + jitter[3] : 0;
    return 60 + 0.04 * Math.sin(t * 0.05) + 0.1 * jitter[4];
  };
  METERS.forEach((_m, i) => { pos[i] = target(i, 0); });
  place();

  // The doors' swing toward `panel.open`: 0 (shut) to 1 (open), eased.
  let swing = 0;
  const hang = () => {
    const e = swing * swing * (3 - 2 * swing);
    doors[0].rotation.y = -OPEN * e; doors[1].rotation.y = OPEN * e;
  };

  // The panel's centre and normal in the cabinet's frame, for the close-up.
  const mid = new THREE.Vector3(0, FRONT_TOP + 0.27 * Math.cos(TILT), HD - 0.27 * Math.sin(TILT));
  return {
    object,
    anchors: {
      camera: poseFrom(mid, [0.06, Math.sin(TILT), Math.cos(TILT)], fitDist(Y1 - Y0, 40, 1.25), 40),
      screen: { mesh: face, uvRect: [0, 0, 1, 1] },
      selector,
      panel,   // audio/roomsound.ts: the doors' latch and the selector's detent
    },
    use() { panel.open = !panel.open; },
    event(e: LabEvent) { if (e.type === "tape") tape = 6; else if (e.type === "beamFrame") busy = Math.max(busy, 0.4); },
    update(dt: number, s: LabState) {
      dt = Math.min(dt, 0.1);
      const goal = panel.open ? 1 : 0;
      if (swing !== goal) { swing = goal > swing ? Math.min(1, swing + dt / SWING_S) : Math.max(0, swing - dt / SWING_S); hang(); }
      // ?labmotion=0: the needles stand at their idle readings, still (the doors still swing when used).
      if (ctx.still) { if (!settled) { settled = true; METERS.forEach((_m, i) => { pos[i] = target(i, 0); vel[i] = 0; }); place(); } return; }
      t += dt;
      if (s.frameNo !== lastFrame) { lastFrame = s.frameNo; busy = Math.max(busy, 0.5); }
      busy = Math.max(0, busy - dt); tape = Math.max(0, tape - dt);
      const active = s.playing || busy > 0 || tape > 0, load = active ? (tape > 0 ? 1 : 0.6) : 0;
      // A flicker: new small random offsets a dozen times a second while busy, decaying when idle.
      if ((jitterT -= dt) <= 0) {
        jitterT = 0.06 + r() * 0.05;
        for (let i = 0; i < 5; i++) jitter[i] = active ? (r() - 0.5) * (i < 3 ? 5 : 1.2) : jitter[i] * 0.5;
      }
      const n = Math.ceil(dt / 0.01), h = dt / n;
      for (let k = 0; k < n; k++) METERS.forEach((_m, i) => {
        vel[i] += (W2 * (target(i, load) - pos[i]) - DAMP * vel[i]) * h;
        pos[i] += vel[i] * h;
      });
      place();
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
