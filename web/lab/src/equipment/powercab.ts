// The 1108's power cabinet, HYPOTHETICAL: a three-phase distribution cabinet at the end of the processor row, on the
// same cabinet as the CPU row (cpu.ts). UP-4046 says only that each storage bank has "an adjacent cabinet" of dc power
// supplies (sec. 3.4) and lists a Power Loss Interrupt (Table 4-7); how the 1108 was fed is not in our sources, so
// the cabinet, its 208 V three-phase 60-cycle feed and every reading and legend on it are ours (docs/lab.md).
//
// The meter panel: three round ammeters (phase A, B, C), a line-to-line voltmeter with its phase selector, a
// frequency meter in cycles, an elapsed-hours meter, a key switch and a guarded emergency-off button; a status row
// lit (power on, phases, main breaker closed) and an alarm row dark; the main and branch breakers below, all on. The
// dial faces, scales and legends are one canvas texture in the plate face; the needles are one instanced mesh,
// turned each frame. The loads wander slowly, rise and flicker while the page is busy or the tape units run. Using
// the cabinet (E, or a click) turns the voltmeter's selector to the next pair of phases.
import * as THREE from "three";
import type { BuildContext, Equipment, LabEvent, LabState } from "../types";
import { cabinet } from "./cpu";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PAL, Parts, at, fitDist, fontTex, lampMat, paint, plastic, plateText, poseFrom, rng, chrome, tileGeo } from "./kit";

// The panel, in the cabinet's front plane (metres): x across, y up. The canvas maps it at PX pixels a metre.
const X0 = -0.38, X1 = 0.38, Y0 = 0.72, Y1 = 1.84, PX = 1400, Z = 0.4142;
const CW = Math.round((X1 - X0) * PX), CH = Math.round((Y1 - Y0) * PX);
const cx = (x: number) => (x - X0) * PX, cy = (y: number) => (Y1 - y) * PX;

// A round switchboard meter: face radius R, the needle's pivot below the centre, a 100-degree scale.
const R = 0.066, PIV = -0.028, ARC = 0.062, NEEDLE = 0.072, SWEEP = 50 * Math.PI / 180, DIALZ = 0.012;
interface Meter { x: number; y: number; min: number; max: number; major: number; minor: number; nums: number[]; unit: string; red?: number }
const AMPS = { min: 0, max: 150, major: 25, minor: 5, nums: [0, 50, 100, 150], unit: "AC AMPERES" };
const METERS: Meter[] = [
  { x: -0.25, y: 1.64, ...AMPS }, { x: 0, y: 1.64, ...AMPS }, { x: 0.25, y: 1.64, ...AMPS },
  { x: -0.25, y: 1.44, min: 0, max: 300, major: 50, minor: 10, nums: [0, 100, 200, 300], unit: "AC VOLTS", red: 208 },
  { x: 0, y: 1.44, min: 55, max: 65, major: 1, minor: 0.5, nums: [55, 60, 65], unit: "CYCLES", red: 60 },
];
const SEL = { x: 0.25, y: 1.45 }, PAIRS = ["A-B", "B-C", "C-A"], PAIR_ANGLE = [-45, 0, 45].map(d => d * Math.PI / 180);
const KEY = { x: -0.25, y: 1.25 }, HOURS = { x: 0, y: 1.25 }, EPO = { x: 0.25, y: 1.26 };
const LAMPX = [-0.28, -0.14, 0, 0.14, 0.28], STATUS_Y = 1.075, ALARM_Y = 0.965, LW = 0.1, LH = 0.046;
const STATUS = [["POWER", "ON"], ["PHASE A", ""], ["PHASE B", ""], ["PHASE C", ""], ["MAIN BKR", "CLOSED"]];
const ALARMS = [["OVER", "TEMP"], ["OVER", "CURRENT"], ["PHASE", "LOSS"], ["GROUND", "FAULT"], ["UNDER", "VOLTAGE"]];
const BKR_Y = 0.795, BRANCH = ["CPU", "STOR 1", "STOR 2", "DRUMS", "TAPES", "CONSOLE", "PRINTER", "SPARE"];
const branchX = (k: number) => -0.17 + k * 0.0714;
// The loads, ours: phase currents a little unbalanced, about half scale; the line voltage per selector position.
const BASE_A = [78, 84, 71], VOLTS = [207.5, 209, 208.2];

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
  box(-0.365, 1.715, 0.365, 1.83); box(-0.365, 0.915, 0.365, 1.135); box(-0.365, 0.735, 0.365, 0.9);
  engraved(g, "POWER DISTRIBUTION", 0, 1.795, 0.022);
  engraved(g, "208 V   3 PHASE   4 WIRE   60 CYCLES", 0, 1.74, 0.011);

  for (const [k, m] of METERS.entries()) {
    const fx = cx(m.x), fy = cy(m.y), px = cx(m.x), py = cy(m.y + PIV);
    g.fillStyle = "#eeebe1"; g.beginPath(); g.arc(fx, fy, R * PX, 0, 2 * Math.PI); g.fill();
    g.strokeStyle = "#111"; g.lineWidth = 3;
    g.beginPath(); g.arc(px, py, ARC * PX, -Math.PI / 2 - SWEEP, -Math.PI / 2 + SWEEP); g.stroke();
    for (let v = m.min, i = 0; v <= m.max + 1e-9; v = m.min + ++i * m.minor) {
      const major = Math.abs((v - m.min) / m.major - Math.round((v - m.min) / m.major)) < 1e-6;
      const [x0, y0] = scalePt(m, v, ARC), [x1, y1] = scalePt(m, v, ARC - (major ? 0.009 : 0.005));
      g.lineWidth = major ? 3 : 1.6; g.beginPath(); g.moveTo(cx(x0), cy(y0)); g.lineTo(cx(x1), cy(y1)); g.stroke();
    }
    if (m.red !== undefined) {
      const [x0, y0] = scalePt(m, m.red, ARC + 0.002), [x1, y1] = scalePt(m, m.red, ARC - 0.012);
      g.strokeStyle = "#b3261e"; g.lineWidth = 4; g.beginPath(); g.moveTo(cx(x0), cy(y0)); g.lineTo(cx(x1), cy(y1)); g.stroke();
    }
    g.fillStyle = "#111"; g.font = `${0.011 * PX}px Helvetica, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    for (const v of m.nums) { const [x, y] = scalePt(m, v, ARC - 0.019); g.fillText(String(v), cx(x), cy(y)); }
    g.font = `${0.0078 * PX}px Helvetica, Arial, sans-serif`;
    g.fillText(m.unit, fx, cy(m.y - 0.008));
    g.font = `${0.0048 * PX}px Helvetica, Arial, sans-serif`;
    g.fillText("SWITCHBOARD INSTRUMENT  ·  ACCURACY 1%", fx, cy(m.y - 0.05));
    g.beginPath(); g.arc(px, py, 0.0045 * PX, 0, 2 * Math.PI); g.fill();
    const legend = ["PHASE A", "PHASE B", "PHASE C", "LINE VOLTS", "FREQUENCY"][k];
    engraved(g, legend, m.x, m.y - 0.087, 0.011);
  }

  // The voltmeter's selector: its positions around the knob.
  engraved(g, "VOLTMETER", SEL.x, SEL.y - 0.087, 0.011);
  PAIRS.forEach((p, i) => engraved(g, p, SEL.x + 0.048 * Math.sin(PAIR_ANGLE[i]), SEL.y + 0.048 * Math.cos(PAIR_ANGLE[i]), 0.009));
  engraved(g, "OFF", SEL.x - 0.05, SEL.y - 0.012, 0.008);
  // The key switch, OFF and ON.
  engraved(g, "OFF", KEY.x - 0.032, KEY.y + 0.03, 0.009); engraved(g, "ON", KEY.x + 0.032, KEY.y + 0.03, 0.009);
  engraved(g, "CONTROL POWER", KEY.x, KEY.y - 0.05, 0.011);
  // The elapsed-hours meter: a drum counter in a black window.
  g.fillStyle = "#121314"; g.fillRect(cx(HOURS.x - 0.05), cy(HOURS.y + 0.018), 0.1 * PX, 0.036 * PX);
  g.strokeStyle = "#9a9d9f"; g.lineWidth = 3; g.strokeRect(cx(HOURS.x - 0.05), cy(HOURS.y + 0.018), 0.1 * PX, 0.036 * PX);
  [..."047126"].forEach((d, i) => {
    const x = HOURS.x - 0.04 + i * 0.016;
    g.fillStyle = i === 5 ? "#e8e4da" : "#2a2b2c"; g.fillRect(cx(x - 0.0065), cy(HOURS.y + 0.013), 0.013 * PX, 0.026 * PX);
    g.fillStyle = i === 5 ? "#111" : "#eeeae0"; g.font = `bold ${0.018 * PX}px Helvetica, Arial, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(d, cx(x), cy(HOURS.y));
  });
  engraved(g, "ELAPSED HOURS", HOURS.x, HOURS.y - 0.05, 0.011);
  // The emergency-off button's plate, red, under its guard.
  g.fillStyle = "#a82a1f"; g.fillRect(cx(EPO.x - 0.062), cy(EPO.y - 0.058), 0.124 * PX, 0.024 * PX);
  g.fillStyle = "#f2efe6"; plateText(g, "EMERGENCY OFF", cx(EPO.x), cy(EPO.y - 0.07), 0.0095 * PX, 0.08, "center", 0.04);

  engraved(g, "STATUS", -0.355, STATUS_Y + 0.037, 0.008, "left");
  engraved(g, "ALARM", -0.355, ALARM_Y + 0.037, 0.008, "left");
  engraved(g, "MAIN 225 A", -0.28, 0.875, 0.0085);
  BRANCH.forEach((b, k) => engraved(g, b, branchX(k), 0.875, 0.0075));
}

/** The lamp lenses' legends: engraved letters, dark on the lit status lenses, faint on the dark alarm lenses. */
function drawLegends(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.clearRect(0, 0, w, h);
  const row = (labels: string[][], y: number, fill: string) => labels.forEach(([a, b], i) => {
    g.fillStyle = fill;
    const x = (LAMPX[i] - X0) * PX, yy = (1.11 - y) * PX;
    if (b) { plateText(g, a, x, yy - 0.0085 * PX, 0.0085 * PX, 0.08, "center", 0.05); plateText(g, b, x, yy + 0.0085 * PX, 0.0085 * PX, 0.08, "center", 0.05); }
    else plateText(g, a, x, yy, 0.0095 * PX, 0.08, "center", 0.05);
  });
  row(STATUS, STATUS_Y, "rgba(20,20,18,0.85)");
  row(ALARMS, ALARM_Y, "rgba(200,180,170,0.35)");
}

/** A plane at z over the panel rectangle (x0..x1, y0..y1) or a disc, its UVs sampling the panel canvas there. */
function panelUV(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[2 * i] = (p.getX(i) - X0) / (X1 - X0); uv[2 * i + 1] = (p.getY(i) - Y0) / (Y1 - Y0); }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

const circle = (x: number, y: number, r: number, n = 40): [number, number][] =>
  Array.from({ length: n }, (_, i) => [x + r * Math.cos(2 * Math.PI * i / n), y + r * Math.sin(2 * Math.PI * i / n)]);

export function build(_ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts(), black = plastic(0x161718, 0.5);
  cabinet(P, Y0 - 0.02, 0.45);
  P.box(X1 - X0, Y1 - Y0, 0.014, paint(PAL.charcoal, 0.9), 0, (Y0 + Y1) / 2, 0.407);
  // Meter cases: a black bezel ring standing proud of the panel around each dial.
  for (const m of METERS) P.outline(circle(m.x, m.y, R + 0.009), Z, Z + DIALZ + 0.004, black, 0, [circle(m.x, m.y, R)]);
  // Selector knob's skirt and the key switch's chrome cylinder with its slot turned to ON.
  P.cyl(0.026, 0.026, 0.006, chrome(), SEL.x, SEL.y, Z + 0.003, 32, true);
  P.cyl(0.017, 0.018, 0.016, chrome(), KEY.x, KEY.y, Z + 0.008, 24, true);
  P.box(0.003, 0.02, 0.004, black, KEY.x, KEY.y, Z + 0.017, 0, 0, -40 * Math.PI / 180);
  // Emergency off: a yellow guard collar and a red mushroom head on its stem.
  P.outline(circle(EPO.x, EPO.y, 0.045), Z, Z + 0.03, plastic(0xd9b21c, 0.4), 0, [circle(EPO.x, EPO.y, 0.036)]);
  P.cyl(0.012, 0.012, 0.02, black, EPO.x, EPO.y, Z + 0.01, 16, true);
  P.cyl(0.03, 0.031, 0.016, plastic(0xc0231a, 0.35), EPO.x, EPO.y, Z + 0.026, 28, true);
  // Breakers: the main, larger, and the branches; every handle up (on).
  const bkr = (x: number, w: number, h: number) => {
    P.box(w, h, 0.03, black, x, BKR_Y, Z + 0.015);
    P.box(w * 0.32, h * 0.22, 0.026, black, x, BKR_Y + h * 0.16, Z + 0.035, -0.35);
  };
  bkr(-0.28, 0.1, 0.11);
  BRANCH.forEach((_b, k) => bkr(branchX(k), 0.034, 0.075));
  P.bake(object).forEach(m => mine.push(m.geometry));

  // The plate face: the panel and the dial faces raised in their bezels, one texture.
  const tex = fontTex(CW, CH, drawPanel, 8);
  const faces = [panelUV(new THREE.PlaneGeometry(X1 - X0, Y1 - Y0).translate(0, (Y0 + Y1) / 2, Z)),
    ...METERS.map(m => panelUV(new THREE.CircleGeometry(R, 48).translate(m.x, m.y, Z + DIALZ)))];
  const faceGeo = mergeGeometries(faces)!; faces.forEach(g => g.dispose());
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.05 });
  const face = new THREE.Mesh(faceGeo, faceMat); object.add(face);
  mine.push(faceGeo, faceMat, tex);

  // Lamps: square legend lenses, one instanced mesh; and their legends over them.
  const lamps = new THREE.InstancedMesh(tileGeo(), lampMat(), 10);
  const lit = [0xfff3dc, 0x7dff9a, 0x7dff9a, 0x7dff9a, 0xfff3dc].map(c => new THREE.Color(c).multiplyScalar(0.85));
  const dark = new THREE.Color(0.085, 0.024, 0.02);
  LAMPX.forEach((x, i) => {
    lamps.setMatrixAt(i, at(x, STATUS_Y, Z, 0, 0, 0, LW, LH, 0.04)); lamps.setColorAt(i, lit[i]);
    lamps.setMatrixAt(5 + i, at(x, ALARM_Y, Z, 0, 0, 0, LW, LH, 0.04)); lamps.setColorAt(5 + i, dark);
  });
  object.add(lamps); mine.push(lamps);
  const LGW = X1 - X0, LGH = 0.2;
  const legTex = fontTex(Math.round(LGW * PX), Math.round(LGH * PX), drawLegends, 4);
  const legGeo = new THREE.PlaneGeometry(LGW, LGH).translate(0, 1.11 - LGH / 2, Z + 0.0125);
  const legMat = new THREE.MeshBasicMaterial({ map: legTex, transparent: true, depthWrite: false });
  const legends = new THREE.Mesh(legGeo, legMat); object.add(legends);
  mine.push(legGeo, legMat, legTex);

  // Needles: black pointers pivoting below each dial's centre.
  const needleGeo = new THREE.BoxGeometry(0.0022, NEEDLE + 0.01, 0.0012).translate(0, (NEEDLE + 0.01) / 2 - 0.01, 0);
  const needleMat = plastic(0x0d0d0d, 0.6);
  const needles = new THREE.InstancedMesh(needleGeo, needleMat, METERS.length);
  needles.frustumCulled = false;
  object.add(needles); mine.push(needleGeo, needles);

  // The selector's pointer knob.
  const knobParts = [new THREE.CylinderGeometry(0.016, 0.018, 0.018, 24).rotateX(Math.PI / 2), new THREE.BoxGeometry(0.009, 0.05, 0.014).translate(0, 0.008, 0.002)];
  const knobGeo = mergeGeometries(knobParts)!; knobParts.forEach(g => g.dispose());
  const knob = new THREE.Mesh(knobGeo, black); knob.position.set(SEL.x, SEL.y, Z + 0.015); object.add(knob);
  mine.push(knobGeo);

  // Needle motion: each a damped spring toward its reading (0.65 s period, damping 0.6 of critical: ours).
  const W2 = 9.7 ** 2, DAMP = 2 * 0.6 * 9.7, r = rng(208), pos = METERS.map(m => (m.min + m.max) / 2), vel = METERS.map(() => 0);
  let t = r() * 100, sel = 0, busy = 0, tape = 0, lastFrame = -1, jitterT = 0;
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
    if (i === 3) return VOLTS[sel] + 0.6 * Math.sin(t * 0.07) - 2.5 * load + jitter[3];
    return 60 + 0.04 * Math.sin(t * 0.05) + 0.1 * jitter[4];
  };
  METERS.forEach((_m, i) => { pos[i] = target(i, 0); });
  place();
  knob.rotation.z = -PAIR_ANGLE[sel];

  return {
    object,
    anchors: {
      camera: poseFrom(new THREE.Vector3(0, 1.3, Z), [0.06, 0.08, 1], fitDist(Y1 - Y0, 40, 1.08), 40),
      screen: { mesh: face, uvRect: [0, 0, 1, 1] },
    },
    use() { sel = (sel + 1) % PAIRS.length; knob.rotation.z = -PAIR_ANGLE[sel]; },
    event(e: LabEvent) { if (e.type === "tape") tape = 6; else if (e.type === "beamFrame") busy = Math.max(busy, 0.4); },
    update(dt: number, s: LabState) {
      dt = Math.min(dt, 0.1);
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
