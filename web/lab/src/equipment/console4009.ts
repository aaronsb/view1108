// The UNIVAC 1108 Display Console, type 4009 (4009-99 at 60 Hz, UP-7604 Table 2-3, p. 2-3). UP-7604 (1968) gives its
// parts (sec. 2.1, p. 2-1): a four-bank keyboard, a CRT of 16 lines of 64 characters in a 10 x 5 in viewing area
// (Table 2-1, p. 2-2), a PAGEWRITER printing 80-character lines at 25 characters a second on a pedestal cabinet that
// houses its circuits (sec. 2.3.2, p. 2-5), a Day Clock, and the Operator's Control and Indicator Panel (sec. 2.3.4,
// Fig. 4-1). Read off its figures: Fig. 2-1 (p. 2-1) a long desk top with the indicator panel standing at the back of
// its left part, header strip across the top, three rows of switch-indicators over the Day Clock and a row of system
// switches; the display unit set into a notch at the right, its keyboard shelf proud of the desk's front, a short
// desk wing beyond it. Fig. 2-3 (p. 2-4) the display unit: a deep light shell whose top falls toward the back, a face
// leaning back with the screen at the left and a grille at the right, a recessed keyboard deck in a light rim with a
// curved lip. Fig. 2-4 (p. 2-5) the PAGEWRITER: a low wedge, its platen under the top, a control strip on the sloping
// front. The 1108 II brochure's colour plates (CHM 102646105, pp. 6, 7): white desk top, orange band under it, dark
// panel face, light grey display shell. UP-4046 rev. 3 Fig. 1-1 shows lit Day Clock digits reading HH:MM.hh.
//
// A photograph of a UNIVAC room (provenance unknown; reference only, docs/lab.md) shows the same console from the
// front left: the desk's dark legs (a slab at the left end, T-legs on long feet) and the panel housing's light sides.
// The display unit has the UNISCOPE 300's shape and screen (UP-7619, 1968: 10 x 5 in, 64 x 16, the same character
// size as UP-7604's; 25 x 17 x 24 in, App. A); its cover gives the trapezoidal housing, the dark face with the
// nameplate strip, the slatted grille and the UNIVAC plate. Its keyboard is the 4009's (UP-7604 sec. 2.3.1).
//
// Sizes other than the screen's and the display unit's are ours, scaled from the figures. The back (panels, louvres,
// the cable cut-out, the plates) is not shown anywhere and is ours.
//
// The Day Clock shows hours, minutes and hundredths of a minute (sec. 2.3.3, p. 2-5), here the replay's UTC: Apollo
// 11's range zero, 1969-07-16 13:32:00 UTC, plus the g.e.t., less 17,887,260 s in scene 9 (Apollo 8; hdr(16), see
// CLAUDE.md). Its orange digits are HYPOTHETICAL. The CRT's console log, the PAGEWRITER's copy of it and the lamp
// patterns are ours.
import * as THREE from "three";
import type { BuildContext, Equipment, LabState } from "../types";
import { PAL, Parts, at, badgeTex, canvasTex, fitDist, fontTex, grid, keyGeo, lampMat, laminate, nameplate, own, paint, plastic, plateText, rng, tileGeo, tubeGlass } from "./kit";

const A11_RANGE_ZERO = Date.UTC(1969, 6, 16, 13, 32, 0);   // ms
const A8_OFFSET = -17887260;                                // s, scene 9's epoch from Apollo 11's (CLAUDE.md, hdr(16))

// ---- proportions (metres; x across, y up, z toward the operator; origin on the floor under the centre) ----
/** The desk: its top's x span, depth span, height and thickness; the display unit stands in a notch from `notch` to
 *  the wing. */
const DESK = { x0: -0.82, x1: 1.40, z0: -0.45, z1: 0.36, top: 0.75, t: 0.05, notch: 0.31 };
/** The display unit, 25 x 17 x 24 in (UNISCOPE 300, UP-7619 App. A): x span, back, bottom and top, the face (top and
 *  bottom, z and y), the keyboard deck (back and front), the lip's front, and how much narrower the top is than the
 *  bottom (the cover's trapezoid). */
const DU = { x0: 0.31, x1: 0.945, back: -0.2, bottom: 0.66, top: 1.09, faceTop: [0.035, 1.06], faceBot: [0.085, 0.83], deckBack: [0.11, 0.80], deckFront: [0.33, 0.775], lip: 0.41, taper: 0.1 };
/** The picture: 10 x 5 in (UP-7604 Table 2-1, UP-7619 sec. 3), centred `u` across the face and `v` up it. */
const CRT = { w: 0.254, h: 0.127, u: -0.09, v: 0.112 };
/** The keyboard: four banks (47 keys, the space bar), 8 interrupt keys and 2 function keys (UP-7604 sec. 2.3.1). */
const KEYS = { banks: [11, 12, 12, 12], pitch: 0.019, cap: 0.0155, interrupt: 8 };
/** The Operator's Control and Indicator Panel: centre x, width, the face's bottom (z, y), height up its lean, back. */
const PANEL = { x: -0.27, w: 0.94, z: -0.12, y: 0.755, h: 0.36, lean: 8 * Math.PI / 180, back: -0.43 };
/** The PAGEWRITER's pedestal (x span, depth, height) and the machine on it (depth, height). */
const PW = { x0: -1.40, x1: -0.86, d: 0.56, h: 0.66, depth: 0.48, height: 0.15 };

/** The replay's UTC, ms, for the page's state. */
export function replayUTC(s: LabState): number {
  return A11_RANGE_ZERO + ((s.get || 0) + (s.scene === 9 ? A8_OFFSET : 0)) * 1000;
}

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");
const fmtGet = (g: number) => `${pad(g / 3600, 3)}:${pad(g / 60 % 60)}:${pad(g % 60)}`;
const hhmm = (ms: number) => { const d = new Date(ms); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };

/** A frame on a leaning face: origin at the face's bottom edge (x, y, z), `u` across, `v` up the face, `n` out of it,
 *  from `n0` out (the bevel the extruded profile adds to its surface). */
function faceFrame(x: number, y: number, z: number, lean: number, n0 = 0) {
  const c = Math.cos(lean), s = Math.sin(lean);
  return (u: number, v: number, n = 0, sx = 1, sy = sx, sz = sx) => at(x + u, y + v * c + (n + n0) * s, z - v * s + (n + n0) * c, -lean, 0, 0, sx, sy, sz);
}

/** The console log (ours): EXEC run-stream traffic in the style of docs/batch-pipeline.md's sample run. */
function prologue(run: string, t: number): string[] {
  const at = (min: number) => hhmm(t - min * 60e3);
  return [
    `${at(14)} ${run}*APOLLO START`,
    `${at(14)} ${run} @ASG,T EPHTAP,T,A201`,
    `${at(13)} MOUNT A201 ON T60 FOR ${run}`,
    `${at(12)} T60 A201 READY`,
    `${at(12)} ${run} @ASG,T PLTTAP,T,A202`,
    `${at(11)} MOUNT A202 RING-IN ON T61 FOR ${run}`,
    `${at(10)} T61 A202 READY`,
    `${at(9)} ${run} @XQT VIEWPGM.INTEG`,
    `${at(4)} ${run} @XQT VIEWPGM.DISPLAY`,
  ];
}

export function build(ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts();
  const grey = paint(PAL.cabinet), shell = paint(0xd9d8d1, 0.8), char = paint(PAL.charcoal, 0.9), dark = paint(PAL.dark, 0.9);
  const faceGrey = paint(0x878b8d, 0.7), deckGrey = paint(0x55595c, 0.75), black = paint(PAL.black, 0.8), orange = paint(PAL.orange, 0.8);
  const lam = laminate(PAL.white);
  const lampM: THREE.Matrix4[] = [], btnM: THREE.Matrix4[] = [], btnC: number[] = [];

  // ---- the desk ----
  const { x0, x1, z0, z1, top, t, notch } = DESK, dc = (z0 + z1) / 2, dd = z1 - z0, yt = top - t / 2, under = top - t;
  P.rbox(notch - 0.01 - x0, t, dd, 0.012, lam, (x0 + notch - 0.01) / 2, yt, dc);
  P.rbox(x1 - DU.x1 - 0.01, t, dd, 0.012, lam, (DU.x1 + 0.01 + x1) / 2, yt, dc);
  P.rbox(DU.x1 - notch + 0.02, t, DU.back - 0.01 - z0, 0.012, lam, (notch + DU.x1) / 2, yt, (z0 + DU.back - 0.01) / 2);
  // Legs after the photograph: a dark slab at the left end, dark T-legs (an upright on a foot along the depth) at the
  // main top's right end and the wing's; the band under the main top's front edge orange (brochure p. 7).
  P.box(0.05, under - 0.01, dd - 0.1, char, x0 + 0.06, under / 2, dc);
  for (const lx of [notch - 0.05, x1 - 0.07]) P.box(0.07, under - 0.03, 0.06, char, lx, under / 2 + 0.015, -0.05).box(0.08, 0.035, 0.8, char, lx, 0.0175, -0.02);
  P.box(notch - x0 - 0.08, 0.1, 0.025, orange, (x0 + notch) / 2, under - 0.05, z1 - 0.04);
  // The modesty panel along the back, with the cable cut-out at its foot (ours); the cables drop through it.
  const cut: [number, number][] = [[0.48, 0.07], [0.76, 0.07], [0.76, 0.16], [0.48, 0.16]];
  P.outline([[x0 + 0.02, 0.05], [x1 - 0.04, 0.05], [x1 - 0.04, top - t], [x0 + 0.02, top - t]], z0 + 0.01, z0 + 0.03, char, 0, [cut]);
  P.box(0.28, 0.09, 0.012, black, 0.62, 0.115, z0 + 0.045);
  for (let k = 0; k < 3; k++) {
    const cx = 0.55 + k * 0.07;
    P.cyl(0.014, 0.014, 0.08, black, cx, 0.1, z0 - 0.01, 10, true).cyl(0.014, 0.014, 0.1, black, cx, 0.05, z0 - 0.05, 10);
  }
  // A cradle under the display unit, between the T-legs (ours).
  P.box(DU.x1 - notch + 0.1, 0.04, 0.5, dark, (notch + DU.x1) / 2, DU.bottom - 0.02, -0.05);

  // ---- the Operator's Control and Indicator Panel ----
  const pf = faceFrame(PANEL.x, PANEL.y, PANEL.z, PANEL.lean, 0.006), ptz = PANEL.z - PANEL.h * Math.sin(PANEL.lean), pty = PANEL.y + PANEL.h * Math.cos(PANEL.lean);
  P.profile([[PANEL.z + 0.004, top], [ptz, pty], [ptz - 0.01, pty + 0.015], [PANEL.back + 0.01, pty + 0.015], [PANEL.back, pty - 0.04], [PANEL.back, top]], PANEL.x - PANEL.w / 2 - 0.015, PANEL.x + PANEL.w / 2 + 0.015, grey, 0.006);
  P.add(new THREE.BoxGeometry(PANEL.w, PANEL.h - 0.03, 0.006), dark, pf(0, (PANEL.h - 0.03) / 2, 0.003));
  P.add(new THREE.BoxGeometry(PANEL.w, 0.028, 0.006), black, pf(0, PANEL.h - 0.015, 0.003));
  // Rear louvres (ours).
  for (let r = 0; r < 5; r++) P.box(PANEL.w * 0.8, 0.012, 0.012, dark, PANEL.x, top + 0.1 + r * 0.04, PANEL.back - 0.004);

  // Lamps in Fig. 4-1's sections, positions u (across) and v (up the face). Indices into `lit` follow this order.
  type Sec = { name: string; n: number; u0: number; v: number; pitch: number };
  const LAMPS: Sec[] = [
    { name: "PROGRAM ADDRESS COUNTER", n: 19, u0: -0.44, v: 0.295, pitch: 0.021 },
    { name: "SELECT JUMPS", n: 15, u0: -0.03, v: 0.295, pitch: 0.021 },
    { name: "SELECT STOPS", n: 5, u0: 0.31, v: 0.295, pitch: 0.021 },
    { name: "RELEASE STOPS", n: 5, u0: 0.31, v: 0.25, pitch: 0.021 },
    { name: "FAULTS", n: 9, u0: -0.44, v: 0.185, pitch: 0.024 },
    { name: "DISABLES", n: 3, u0: -0.2, v: 0.185, pitch: 0.024 },
    { name: "MODES", n: 3, u0: -0.1, v: 0.185, pitch: 0.024 },
    { name: "MSR", n: 3, u0: 0.0, v: 0.185, pitch: 0.024 },
  ];
  const secAt: Record<string, number> = {};
  for (const s of LAMPS) { secAt[s.name] = lampM.length; for (let i = 0; i < s.n; i++) lampM.push(pf(s.u0 + i * s.pitch, s.v, 0.006, 0.017, 0.012, 0.012)); }
  // Momentary switches: RELEASE JUMPS under SELECT JUMPS, and the seven SYSTEM CONTROLS along the bottom.
  for (let i = 0; i < 15; i++) { btnM.push(pf(-0.03 + i * 0.021, 0.25, 0.006, 0.017, 0.012, 0.02)); btnC.push(0xd8d6ce); }
  const SYS = ["FAULT RSET", "ALM RSET", "INITL LD", "SUBSYS CLR", "CMPTR CLR", "START", "STOP"];
  SYS.forEach((_, i) => { btnM.push(pf(-0.42 + i * 0.046, 0.035, 0.006, 0.038, 0.02, 0.025)); btnC.push(i === 6 ? 0xb8382a : 0xe8e6de); });
  const U = (u: number) => (u + PANEL.w / 2) / PANEL.w * 1024, V = (v: number) => (PANEL.h - v) / PANEL.h * 392;
  const CLOCK = { u: 0.08, v: 0.085, w: 0.19, h: 0.047 };
  const legend = fontTex(1024, 392, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#c9c6bb"; g.strokeStyle = "#8d8b84"; g.lineWidth = 1.5;
    const label = (s: string, u: number, v: number, px = 9) => plateText(g, s, U(u), V(v), px, 0.1, "left", 0.02);
    for (const s of LAMPS) {
      label(s.name, s.u0 - 0.008, s.v + 0.022);
      g.strokeRect(U(s.u0 - 0.012), V(s.v + 0.03), U(s.u0 + (s.n - 1) * s.pitch + 0.012) - U(s.u0 - 0.012), V(s.v - 0.012) - V(s.v + 0.03));
    }
    label("RELEASE JUMPS", -0.038, 0.272);
    label("SYSTEM CONTROLS", -0.448, 0.066);
    SYS.forEach((s, i) => label(s, -0.437 + i * 0.046, 0.012, 6.5));
    label("HOURS", CLOCK.u - 0.085, CLOCK.v + 0.038); label("MINUTES", CLOCK.u + 0.02, CLOCK.v + 0.038);
    g.fillStyle = "#e9e7e0"; plateText(g, "UNIVAC 1108", U(PANEL.w / 2 - 0.02), V(PANEL.h - 0.015), 13, 0.18, "right", 0.04);
  });
  mine.push(legend);
  const legendMesh = own(new THREE.Mesh(new THREE.PlaneGeometry(PANEL.w, PANEL.h), new THREE.MeshStandardMaterial({ map: legend, transparent: true, roughness: 0.6 })), mine);
  legendMesh.matrixAutoUpdate = false; legendMesh.matrix.copy(pf(0, PANEL.h / 2, 0.0065)); object.add(legendMesh);
  P.add(new THREE.BoxGeometry(CLOCK.w + 0.02, CLOCK.h + 0.016, 0.006), black, pf(CLOCK.u, CLOCK.v, 0.004));

  // ---- the display unit, after UP-7604 Fig. 2-3 and the UNISCOPE 300 cover ----
  const dux = (DU.x0 + DU.x1) / 2, duw = DU.x1 - DU.x0;
  const [ftz, fty] = DU.faceTop, [fbz, fby] = DU.faceBot, [dbz, dby] = DU.deckBack, [dfz, dfy] = DU.deckFront;
  P.profile([[DU.back, DU.bottom], [DU.back, DU.top - 0.06], [ftz - 0.04, DU.top], [ftz + 0.015, DU.top], [ftz + 0.015, fty], [ftz, fty], [fbz, fby], [dbz, dby],
    [dfz, dfy], [dfz + 0.03, dfy + 0.018], [DU.lip, dfy + 0.012], [DU.lip, dfy - 0.025], [DU.lip - 0.04, dfy - 0.045], [0.2, DU.bottom + 0.03], [0.05, DU.bottom]], DU.x0, DU.x1, shell, 0.008);
  const lean = Math.atan2(fbz - ftz, fty - fby), flen = Math.hypot(fbz - ftz, fty - fby), ff = faceFrame(dux, fby, fbz, lean, 0.008);
  P.add(new THREE.BoxGeometry(duw - 0.05, flen, 0.01), black, ff(0, flen / 2, 0.002));
  P.add(new THREE.BoxGeometry(0.33, 0.17, 0.008), black, ff(CRT.u, CRT.v, 0.005));
  P.add(new THREE.BoxGeometry(CRT.w + 0.035, CRT.h + 0.03, 0.004), tubeGlass(0x1c2420), ff(CRT.u, CRT.v, 0.009));
  const gu = 0.17;
  P.add(new THREE.BoxGeometry(0.15, 0.17, 0.006), faceGrey, ff(gu, CRT.v, 0.005));
  for (let k = 0; k < 11; k++) P.add(new THREE.BoxGeometry(0.135, 0.005, 0.006), dark, ff(gu, CRT.v - 0.075 + k * 0.015, 0.008));
  // The keyboard deck, recessed in the shell's rim.
  const slope = Math.atan2(dby - dfy, dfz - dbz), dlen = Math.hypot(dfz - dbz, dby - dfy);
  const KB = at(dux, (dby + dfy) / 2 + 0.012, (dbz + dfz) / 2, slope);
  P.add(new THREE.BoxGeometry(duw - 0.07, 0.008, dlen), dark, KB);
  // The back: louvres and a service panel (ours).
  for (let r = 0; r < 7; r++) P.box(duw * 0.7, 0.012, 0.01, dark, dux, DU.bottom + 0.14 + r * 0.03, DU.back - 0.004);
  P.box(duw * 0.8, 0.09, 0.004, paint(0xc6c5be, 0.8), dux, DU.bottom + 0.06, DU.back - 0.003);

  // ---- the PAGEWRITER on its pedestal ----
  const px = (PW.x0 + PW.x1) / 2, pw = PW.x1 - PW.x0;
  P.box(pw - 0.02, PW.h - 0.06, PW.d - 0.02, grey, px, 0.04 + (PW.h - 0.06) / 2, 0).box(pw - 0.04, 0.04, PW.d - 0.06, dark, px, 0.02, 0);
  P.rbox(pw, 0.025, PW.d, 0.008, lam, px, PW.h - 0.0125, 0);
  P.box(0.004, PW.h - 0.12, 0.004, dark, px, PW.h / 2, PW.d / 2);
  for (let r = 0; r < 6; r++) P.box(pw * 0.6, 0.01, 0.008, dark, px, 0.18 + r * 0.03, -PW.d / 2 - 0.002);
  const py = PW.h, pd = PW.depth, ph = PW.height;
  P.profile([[pd / 2, py], [pd / 2, py + 0.04], [pd / 2 - 0.12, py + ph - 0.04], [pd / 2 - 0.18, py + ph], [-pd / 2 + 0.03, py + ph], [-pd / 2, py + ph - 0.04], [-pd / 2, py]], px - 0.25, px + 0.25, shell, 0.01);
  P.box(0.4, 0.012, 0.12, black, px, py + ph + 0.001, -0.06);
  P.add(new THREE.CylinderGeometry(0.024, 0.024, 0.44, 20).rotateZ(Math.PI / 2), black, at(px, py + ph + 0.004, -0.04));
  const pwf = faceFrame(px, py + 0.04, pd / 2, Math.atan2(0.12, ph - 0.08), 0.01);
  P.add(new THREE.BoxGeometry(0.42, 0.06, 0.006), char, pwf(0, 0.04, 0.002));
  for (let i = 0; i < 4; i++) { btnM.push(pwf(0.06 + i * 0.035, 0.04, 0.005, 0.022, 0.016, 0.02)); btnC.push([0xe8e6de, 0xb8382a, 0xe8e6de, 0xc8642a][i]); }
  lampM.push(pwf(-0.16, 0.04, 0.005, 0.01, 0.01, 0.01));
  // The display unit's two lamps at the deck's back left (Fig. 2-1).
  const kb = (x: number, z: number, sx: number, sz = KEYS.cap, h = 0.011) => KB.clone().multiply(at(x, 0.004, z, -Math.PI / 2, 0, 0, sx, sz, h / 0.55));
  lampM.push(KB.clone().multiply(at(-0.2, 0.006, -0.1, -Math.PI / 2, 0, 0, 0.012, 0.012, 0.01)), KB.clone().multiply(at(-0.175, 0.006, -0.1, -Math.PI / 2, 0, 0, 0.012, 0.012, 0.01)));
  // The display unit narrows toward its top (the UNISCOPE 300 cover): its parts are pulled in toward its centre line
  // in proportion to height, after merging (normals keep their untapered directions, a few degrees off).
  const taper = (y: number) => 1 - DU.taper * Math.max(0, y - DU.bottom) / (DU.top - DU.bottom);
  for (const m of P.bake(object)) {
    mine.push(m.geometry);
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (x > DU.x0 - 0.002 && x < DU.x1 + 0.002 && y >= DU.bottom && z > DU.back - 0.0095) p.setX(i, dux + (x - dux) * taper(y));
    }
    m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere();
  }

  // ---- instanced parts ----
  const lit: boolean[] = lampM.map(() => false);
  const lampCol = (i: number) => i >= secAt.FAULTS && i < secAt.DISABLES ? 0xff7a3a : i >= lampM.length - 3 ? (i === lampM.length - 3 ? 0x9cff9a : 0xffc070) : 0xfff2dc;
  const lamps = grid(tileGeo(), lampMat(), lampM.length, 1, c => lampM[c], () => 0);
  const col = new THREE.Color();
  const paintLamps = () => { lit.forEach((on, i) => lamps.setColorAt(i, on ? col.set(lampCol(i)) : col.setRGB(0.1, 0.1, 0.095))); lamps.instanceColor!.needsUpdate = true; };
  object.add(lamps); mine.push(lamps);
  const btns = grid(tileGeo(), plastic(0xffffff, 0.4), btnM.length, 1, c => btnM[c], c => btnC[c]);
  object.add(btns); mine.push(btns);

  const kp: THREE.Matrix4[] = [], kc: number[] = [];
  const key = (m: THREE.Matrix4, c: number) => { kp.push(m); kc.push(c); };
  for (let i = 0; i < KEYS.interrupt; i++) key(kb(-0.085 + i * 0.024, -0.098, KEYS.cap * 1.1), 0xb4b8b8);
  KEYS.banks.forEach((n, r) => { for (let c = 0; c < n; c++) key(kb(-0.115 + (3 - r) * 0.006 + c * KEYS.pitch + (n === 11 ? KEYS.pitch / 2 : 0), -0.068 + r * KEYS.pitch, KEYS.cap), 0xe8e6de); });
  key(kb(-0.005, 0.014, KEYS.cap * 6.5), 0xe8e6de);
  key(kb(0.13, -0.03, KEYS.cap * 1.6), 0xe8e6de); key(kb(0.13, -0.008, KEYS.cap * 1.6), 0xe8e6de);
  key(kb(-0.2, -0.06, KEYS.cap, KEYS.cap, 0.014), 0xb8382a);
  const keys = grid(keyGeo(), plastic(0xffffff, 0.5), kp.length, 1, i => kp[i], i => kc[i]);
  object.add(keys); mine.push(keys);

  // ---- plates ----
  // The display unit's plates after the UNISCOPE 300 cover: a UNIVAC plate under the screen's left and a brushed strip
  // across the face's top lettered "U N I S C O P E  3 0 0". UP-7604 Fig. 2-1 shows a light strip there too small to
  // read; the lettering is our reading of the unit as a UNISCOPE 300 (docs/lab.md).
  const duBadge = own(new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.014), new THREE.MeshStandardMaterial({ map: badgeTex(""), roughness: 0.4 })), mine);
  mine.push((duBadge.material as THREE.MeshStandardMaterial).map!);
  const ty = (v: number) => taper(fby + v * Math.cos(lean));
  duBadge.matrixAutoUpdate = false; duBadge.matrix.copy(ff((CRT.u - 0.07) * ty(0.02), 0.02, 0.0105)); object.add(duBadge);
  const stripTex = fontTex(1024, 40, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#d9dad6"); gr.addColorStop(0.5, "#b9bbb8"); gr.addColorStop(1, "#cfd0cc");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1e1f20";
    [..."UNISCOPE"].forEach((c, i) => plateText(g, c, 60 + i * 72, h / 2 + 1, 22, 0, "center", 0.05));
    [..."300"].forEach((c, i) => plateText(g, c, 780 + i * 72, h / 2 + 1, 22, 0, "center", 0.05));
  });
  mine.push(stripTex);
  const strip = own(new THREE.Mesh(new THREE.PlaneGeometry((duw - 0.09) * ty(flen - 0.024), 0.016), new THREE.MeshStandardMaterial({ map: stripTex, roughness: 0.35, metalness: 0.5 })), mine);
  strip.matrixAutoUpdate = false; strip.matrix.copy(ff(0, flen - 0.024, 0.0075)); object.add(strip);
  // The back: the UNIVAC badge with the type number on the panel housing, a type plate on the modesty panel (ours).
  const rear = own(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.056), new THREE.MeshStandardMaterial({ map: badgeTex("4009"), roughness: 0.4 })), mine);
  mine.push((rear.material as THREE.MeshStandardMaterial).map!);
  rear.position.set(PANEL.x, top + 0.34, PANEL.back - 0.012); rear.rotation.y = Math.PI; object.add(rear);
  const tp = nameplate("1108 DISPLAY CONSOLE  TYPE 4009-99", { height: 0.045, rule: true }, mine);
  tp.position.set(-0.2, 0.5, z0 + 0.003); tp.rotation.y = Math.PI; object.add(tp);

  // ---- the Day Clock: lit digits on black (orange HYPOTHETICAL), redrawn every hundredth of a minute ----
  const clockTex = canvasTex(256, 64, () => {}); mine.push(clockTex);
  const cg = (clockTex.image as HTMLCanvasElement).getContext("2d")!;
  const clock = own(new THREE.Mesh(new THREE.PlaneGeometry(CLOCK.w, CLOCK.h), new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false })), mine);
  clock.matrixAutoUpdate = false; clock.matrix.copy(pf(CLOCK.u, CLOCK.v, 0.0075)); object.add(clock);
  let clockKey = "";
  const drawClock = (s: LabState) => {
    const d = new Date(replayUTC(s)), txt = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}.${pad((d.getUTCSeconds() + d.getUTCMilliseconds() / 1000) / 0.6)}`;
    if (txt === clockKey) return;
    clockKey = txt;
    cg.fillStyle = "#050302"; cg.fillRect(0, 0, 256, 64);
    cg.font = "bold 46px 'Courier New', monospace"; cg.textAlign = "center"; cg.textBaseline = "middle";
    cg.shadowColor = "rgba(255,110,30,0.9)"; cg.shadowBlur = 10; cg.fillStyle = "#ffa060";
    cg.fillText(txt, 128, 34);
    clockTex.needsUpdate = true;
  };

  // ---- the CRT: 16 lines of 64 characters, the console log (ours) ----
  const crtTex = canvasTex(1024, 512, () => {}, ctx.maxAnisotropy); mine.push(crtTex);
  const tg = (crtTex.image as HTMLCanvasElement).getContext("2d")!;
  const crt = own(new THREE.Mesh(new THREE.PlaneGeometry(CRT.w, CRT.h), new THREE.MeshBasicMaterial({ map: crtTex, toneMapped: false })), mine);
  const fc = Math.cos(lean), fs = Math.sin(lean), cn = 0.0215;
  crt.position.set(dux + CRT.u * ty(CRT.v), fby + CRT.v * fc + cn * fs, fbz - CRT.v * fs + cn * fc); crt.rotation.x = -lean; object.add(crt);
  let crtKey = "";
  const drawCrt = (s: LabState) => {
    const run = s.scene === 9 ? "VIEW08" : "VIEW11", now = replayUTC(s), g = Math.max(0, s.get || 0), blink = Math.floor(performance.now() / 530) % 2;
    const recent: string[] = [];
    for (let k = 4; k >= 0; k--) { const f = Math.floor(s.frameNo / 16) * 16 - k * 16; if (f > 0) recent.push(`${hhmm(now)} ${run} PLTTAP FRAME ${pad(f, 6)} GET ${fmtGet(Math.max(0, g - k))}`); }
    const lines = [
      `UNIVAC 1108 EXEC 8          MSC HOUSTON                ${hhmm(now)}`,
      ...prologue(run, now), ...recent,
      `${hhmm(now)} ${run} ${s.playing ? "RUNNING" : "HOLD   "} SCENE ${pad(s.scene)} FRAMES ${pad(s.frameNo, 7)}`,
      `>${blink ? "_" : " "}`,
    ].slice(0, 16);
    const k = lines.join("\n");
    if (k === crtKey) return;
    crtKey = k;
    tg.fillStyle = "#0b120d"; tg.fillRect(0, 0, 1024, 512);
    tg.font = '25px "IBM 3270", "Courier New", monospace'; tg.fillStyle = "#b9f5b2"; tg.shadowColor = "rgba(150,255,150,0.6)"; tg.shadowBlur = 6;
    lines.forEach((l, i) => tg.fillText(l.slice(0, 64), 10, 26 + i * 31.5));
    crtTex.needsUpdate = true;
  };

  // ---- the PAGEWRITER's paper: the log, up out of the platen and leaning back ----
  const paperTex = canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = "#f3f0e6"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#2a2a2a"; g.font = "9px 'Courier New', monospace";
    const L = prologue("VIEW11", Date.UTC(1969, 6, 20, 20, 30));
    for (let i = 0; i < 26; i++) g.fillText(L[i % L.length], 6, 14 + i * 11.5);
  });
  mine.push(paperTex);
  const paper = own(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26, 1, 6), new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9, side: THREE.DoubleSide })), mine);
  const pp = paper.geometry.attributes.position;
  for (let i = 0; i < pp.count; i++) { const v = (pp.getY(i) + 0.13) / 0.26; pp.setZ(i, -0.07 * v * v); }
  paper.geometry.computeVertexNormals();
  paper.position.set(px, py + ph + 0.13, -0.06); paper.rotation.x = -0.2; object.add(paper);

  // ---- the lamps' activity (ours): the address counter runs with the replay, GUARD mode on, a stop shows on HOLD ----
  const r = rng(4009), PAC = secAt["PROGRAM ADDRESS COUNTER"];
  const setWord = (at0: number, n: number, w: number) => { for (let i = 0; i < n; i++) lit[at0 + i] = ((w >> (n - 1 - i)) & 1) === 1; };
  setWord(secAt["SELECT JUMPS"], 15, 0b000100000010001);
  lit[secAt.MODES] = true; lit[lampM.length - 3] = true; lit[lampM.length - 2] = true;
  let tick = 0, busy = 0;
  const step = (s: LabState) => {
    const running = s.playing || busy > 0;
    setWord(PAC, 18, running ? (0o40000 + Math.floor(r() * 0o7777) + (s.frameNo & 0o777) * 8) & 0o777777 : 0o40000 + (s.frameNo & 0o777));
    lit[PAC + 18] = false;
    lit[secAt["SELECT STOPS"]] = lit[secAt["RELEASE STOPS"]] = !running;
    lit[secAt.MSR + 2] = running && r() < 0.5;
    lit[lampM.length - 1] = running;
    paintLamps();
  };

  return {
    object,
    anchors: {
      screen: { mesh: crt, uvRect: [0, 0, 1, 1] },
      camera: {
        position: crt.position.clone().add(new THREE.Vector3(0, fs, fc).multiplyScalar(fitDist(CRT.h * 2.2, 40))),
        target: crt.position.clone(), fov: 40,
      },
      overview: { position: new THREE.Vector3(-0.2, 1.7, 2.4), target: new THREE.Vector3(0, 0.9, 0), fov: 40 },
      lamps: { center: new THREE.Vector3(icx, 0.955, 0.02), normal: new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt)), w: iw, h: Math.hypot(0.45, 0.12) },
    },
    update(dt, s) {
      drawClock(s); drawCrt(s);
      busy = Math.max(0, busy - dt);
      if ((tick += dt) > (s.playing || busy > 0 ? 0.07 : 0.9)) { tick = 0; step(s); }
    },
    event(e) { if (e.type === "tape") busy = 1.5; },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
