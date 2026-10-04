// The microfilm recorder: a Stromberg-Carlson S-C 4020 Computer Recorder. HYPOTHETICAL as to MSC's machine: VIEW's
// frames came from "a camera that photographs an image constructed on the surface of a cathode-ray tube" (TN D-6853,
// printed p. 3), which names no model. Our choice of the 4020 rests on MSC IN 66-FM-79 (printed p. 2: its figures
// "were plotted by an SC 4020 microfilm plotter" from IBM 7094 tapes) and on HEPCAT (TRW for MSC, June 1970, printed
// pp. 40 and 45: a UNIVAC 1108 EXEC II program writing "4020 plots" and microfilm tapes); docs/lab.md has the rest.
//
// The shape follows the 4020 brochure (Apr 1965, p. 1 photograph and p. 4 layout) and Information Manual (Aug 1964,
// Figure 1, p. 1; Figure 5, p. 7): a row of tall flat-doored cabinets with recessed handles, split doors, two small
// lamp panels at eye height. Basic unit 66 x 37 x 74 in plus the 22 in tape adapter (brochure p. 4): four 22 in
// sections, 2.24 x 1.88 x 0.94 m. Left to right: the camera section (the CHARACTRON tube stands upright with the 35 mm
// camera and its two magazines above it, Figure 5), the electronics, the operator panel, the tape adapter (the F-53-5
// reads UNIVAC tape, Information Manual p. 25). Ours (HYPOTHETICAL): the window onto the camera, the viewing port
// that repeats the tube's picture, the frame counter, the panels' layout and the lamps' meanings, the colours.
//
// A finished beam frame (`beamFrame`) exposes a frame: the shutter lamp and the lamp at the lens flash, then the
// advance lamp lights for the pull-down (about 100 ms, S-C 4060 Description 9500209, Apr 1967, p. 20) and the frame
// counter steps on. The other lamps hold steady.
import * as THREE from "three";
import type { BuildContext, Equipment, LabEvent, Opens } from "../types";
import { PAL, Parts, at, canvasTex, chrome, glowMat, grid, lampMat, lensGeo, own, paint, plastic, rng, roundRect, satinMetal, smoked, tileGeo } from "./kit";

const IN = 0.0254;
const SEC = 22 * IN, W = 4 * SEC, H = 74 * IN, D = 37 * IN, ZF = D / 2;   // 0.559 section, 2.24 x 1.88 x 0.94 m
const XS = [-1.5, -0.5, 0.5, 1.5].map(k => k * SEC);                     // section centres: camera, electronics, panel, adapter
const BEIGE = 0xcfcabb;                                                    // the brochure photograph's warm light grey (approximate)
// The viewing port: the plot (1:1.1) at the operator panel's top.
const PH = 0.15, PW = PH / 1.1, PX = XS[2], PY = 1.5, PZ = ZF + 0.012;
const OFF = 0x2a2a26;

/** The frame counter: five white figures on black wheels. */
function drawCounter(g: CanvasRenderingContext2D, w: number, h: number, n: number) {
  g.fillStyle = "#151515"; g.fillRect(0, 0, w, h);
  const s = String(n % 100000).padStart(5, "0"), cw = w / 5;
  g.font = `bold ${Math.round(h * 0.72)}px Helvetica, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  for (let i = 0; i < 5; i++) {
    g.fillStyle = "#2a2a2a"; g.fillRect(i * cw + 3, 2, cw - 6, h - 4);
    g.fillStyle = "#f2efe6"; g.fillText(s[i], (i + 0.5) * cw, h / 2 + 2);
  }
}

export function build(ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts(), body = paint(BEIGE), door = paint(0xd8d3c5), dark = paint(PAL.charcoal, 0.9), black = paint(PAL.dark, 0.9);

  // Carcass: a dark plinth, a top cap, the sides, and a dark front plate that shows in the gaps between the doors. The
  // body stops short of the front so the camera window has a hollow behind it.
  const DW = SEC - 0.03, SPLIT = 0.97, LOW = [0.1, SPLIT - 0.01], UP = [SPLIT + 0.01, H - 0.05];
  const WIN = { w: 0.4, h: 0.38, y: 1.5 }, RD = 0.32;   // the camera window and its depth (ours)
  const win = () => [roundRect(XS[0], WIN.y, WIN.w, WIN.h, 0.02).reverse()];
  const yb = 0.08, hb = H - 0.11, back = D - RD - 0.02;
  P.box(W - 0.04, 0.08, D - 0.06, black, 0, 0.04, 0);
  P.box(W - 0.02, hb, back, body, 0, yb + hb / 2, -D / 2 + back / 2);
  for (const s of [-1, 1]) P.box(0.01, hb, D, body, s * (W / 2 - 0.005), yb + hb / 2, 0);
  P.outline([[-W / 2, yb], [W / 2, yb], [W / 2, yb + hb], [-W / 2, yb + hb]], ZF - 0.006, ZF, black, 0, win());
  P.rbox(W + 0.01, 0.03, D + 0.01, 0.008, paint(0xcac6ba), 0, H - 0.015, 0);

  // Doors: each section a lower and an upper door with a recessed handle where they meet (brochure p. 1).
  XS.forEach((x, k) => {
    P.box(DW, LOW[1] - LOW[0], 0.014, door, x, (LOW[0] + LOW[1]) / 2, ZF + 0.007);
    if (k === 0) {
      const hw = DW / 2, y0 = UP[0], y1 = UP[1];
      P.outline([[x - hw, y0], [x + hw, y0], [x + hw, y1], [x - hw, y1]], ZF, ZF + 0.014, door, 0, win());
    } else P.box(DW, UP[1] - UP[0], 0.014, door, x, (UP[0] + UP[1]) / 2, ZF + 0.007);
    for (const y of [SPLIT - 0.09, SPLIT + 0.09]) {
      P.box(0.03, 0.11, 0.01, black, x + DW / 2 - 0.08, y, ZF + 0.012);
      P.box(0.022, 0.012, 0.016, chrome(), x + DW / 2 - 0.08, y + (y < SPLIT ? 0.045 : -0.045), ZF + 0.016);
    }
  });

  // The camera behind its window: the recess, the tube's neck rising to the mirror box, the camera body with its lens
  // pointing down, and the supply and take-up magazines side by side on top (Information Manual Figure 5).
  const cx = XS[0], zc = ZF - 0.16;
  const rw = WIN.w + 0.02, rh = WIN.h + 0.02, recess = paint(0x55595d, 0.9);   // an open box: back, sides, top, floor
  P.box(rw, rh, 0.01, recess, cx, WIN.y, ZF - RD);
  for (const s of [-1, 1]) P.box(0.01, rh, RD, recess, cx + s * rw / 2, WIN.y, ZF - RD / 2).box(rw, 0.01, RD, recess, cx, WIN.y + s * rh / 2, ZF - RD / 2);
  P.box(0.16, 0.06, 0.14, satinMetal(0x8d9196), cx, WIN.y - 0.16, zc);            // the mirror box
  P.cyl(0.03, 0.03, 0.08, black, cx, WIN.y - 0.215, zc);                           // the tube's neck, going on down
  P.cyl(0.022, 0.026, 0.05, black, cx, WIN.y - 0.105, zc);                         // lens
  P.rbox(0.2, 0.075, 0.12, 0.008, satinMetal(0x5d6166), cx, WIN.y - 0.045, zc);   // camera body
  for (const s of [-1, 1]) {
    P.cyl(0.085, 0.085, 0.07, paint(0x3b3e42, 0.6), cx + s * 0.088, WIN.y + 0.08, zc, 28, true);
    P.cyl(0.018, 0.018, 0.074, satinMetal(), cx + s * 0.088, WIN.y + 0.08, zc, 16, true);
  }
  P.box(0.03, 0.05, 0.05, paint(0x3b3e42, 0.6), cx, WIN.y + 0.025, zc);           // the magazines' throat

  // The operator panel: charcoal, the viewing port in its bezel, the counter, a lamp row, push buttons.
  P.box(0.46, 0.56, 0.012, dark, PX, 1.36, ZF + 0.02);
  P.outline(roundRect(PX, PY, PW + 0.05, PH + 0.05, 0.015), ZF + 0.026, ZF + 0.04, paint(0xc4c1b7, 0.7), 0.003,
    [roundRect(PX, PY, PW + 0.008, PH + 0.008, 0.008).reverse()]);
  P.box(0.15, 0.045, 0.012, black, PX, 1.31, ZF + 0.03);                           // counter surround
  for (let i = 0; i < 4; i++) P.box(0.032, 0.026, 0.02, plastic(i === 3 ? PAL.orange : 0xe8e4d8, 0.5), PX - 0.12 + i * 0.08, 1.14, ZF + 0.034);
  // The tape adapter's lamp panel, as on the brochure's fourth cabinet.
  P.box(0.4, 0.15, 0.012, dark, XS[3], 1.42, ZF + 0.02);
  // The badge plate on the electronics section.
  P.box(0.24, 0.05, 0.006, satinMetal(0xb9bcbe), XS[1], 1.45, ZF + 0.017);
  P.bake(object).forEach(m => mine.push(m.geometry));

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), smoked(0.3)); mine.push(glass.geometry);
  glass.position.set(cx, WIN.y, ZF + 0.008); object.add(glass);

  const badgeTex = canvasTex(384, 80, (g, w, h) => {
    g.fillStyle = "#b9bcbe"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1a1a1a"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 40px Helvetica, Arial, sans-serif"; g.fillText("S-C 4020", w / 2, h * 0.42);
    g.font = "bold 15px Helvetica, Arial, sans-serif"; g.fillText("STROMBERG-CARLSON", w / 2, h * 0.82);
  }); mine.push(badgeTex);
  const badge = own(new THREE.Mesh(new THREE.PlaneGeometry(0.235, 0.047), new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.4, metalness: 0.3 })), mine);
  badge.position.set(XS[1], 1.45, ZF + 0.021); object.add(badge);

  // The viewing port: the plot, faint, as a monitor of the tube's face would show it between exposures.
  const port = own(new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: ctx.vectorScreen, color: 0x6b6f6c, toneMapped: false })), mine);
  port.position.set(PX, PY, PZ + 0.016); object.add(port);
  const pglass = new THREE.Mesh(new THREE.PlaneGeometry(PW + 0.008, PH + 0.008), smoked(0.12)); mine.push(pglass.geometry);
  pglass.position.set(PX, PY, PZ + 0.02); object.add(pglass);

  // The counter.
  let frames = 0;
  const ctex = canvasTex(320, 64, (g, w, h) => drawCounter(g, w, h, 0), ctx.maxAnisotropy); mine.push(ctex);
  const cg = (ctex.image as HTMLCanvasElement).getContext("2d")!;
  const counter = own(new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.026), new THREE.MeshBasicMaterial({ map: ctex, color: 0xb0b0b0, toneMapped: false })), mine);
  counter.position.set(PX, 1.31, ZF + 0.037); object.add(counter);

  // Lamps (one instanced mesh): the panel row of 8, the adapter's 2 x 10, the lamp at the lens. Meanings ours.
  const r = rng(4020), on = [0x6cf08a, 0xfff2dc, 0xffb040];
  const pos: THREE.Matrix4[] = [], idle: number[] = [];
  const PANEL = ["POWER", "READY", "SHUTTER", "ADVANCE", "FILM", "TAPE", "ALARM", "SPARE"];
  PANEL.forEach((_, i) => { pos.push(at(PX - 0.175 + i * 0.05, 1.235, ZF + 0.026, 0, 0, 0, 0.02)); idle.push([0x6cf08a, 0xfff2dc, OFF, OFF, 0xfff2dc, 0xffb040, OFF, OFF][i]); });
  for (let row = 0; row < 2; row++) for (let c = 0; c < 10; c++) {
    pos.push(at(XS[3] - 0.162 + c * 0.036, 1.445 - row * 0.05, ZF + 0.026, 0, 0, 0, 0.016));
    idle.push(r() < 0.45 ? on[Math.floor(r() * 3)] : OFF);
  }
  const LENS = pos.length;
  pos.push(at(cx + 0.07, WIN.y - 0.045, zc + 0.06, 0, 0, 0, 0.012)); idle.push(OFF);
  const lamps = grid(lensGeo(), lampMat(), pos.length, 1, i => pos[i], i => idle[i]);
  object.add(lamps); mine.push(lamps);
  const SHUTTER = 2, ADVANCE = 3;
  // A dim backlit legend strip over the push buttons (ours).
  const strip = new THREE.Mesh(tileGeo(), glowMat(0x3a3428)); strip.scale.set(0.3, 0.008, 0.01);
  strip.position.set(PX, 1.17, ZF + 0.026); object.add(strip);

  const col = new THREE.Color();
  const setLamp = (i: number, c: number) => { lamps.setColorAt(i, col.set(c)); lamps.instanceColor!.needsUpdate = true; };
  let tShut = 0, tAdv = 0;

  return {
    object,
    // TODO(roomfix): add "print" to the Opens union in types.ts and map it in web/src/room.js arrive() to the Print tab;
    // then drop this cast.
    opens: "print" as unknown as Opens,
    anchors: {
      screen: { mesh: port, uvRect: [0, 0, 1, 1] },
      camera: { position: new THREE.Vector3(PX - 0.12, PY + 0.02, ZF + 0.62), target: new THREE.Vector3(PX, 1.4, ZF), fov: 40 },
      camera2: { position: new THREE.Vector3(cx + 0.1, WIN.y, ZF + 0.6), target: new THREE.Vector3(cx, WIN.y, ZF), fov: 40 },
    },
    update(dt) {
      if (tShut > 0 && (tShut -= dt) <= 0) { setLamp(SHUTTER, OFF); setLamp(LENS, OFF); setLamp(ADVANCE, 0xffb040); tAdv = 0.1; }
      if (tAdv > 0 && (tAdv -= dt) <= 0) setLamp(ADVANCE, OFF);
    },
    event(e: LabEvent) {
      if (e.type !== "beamFrame") return;
      drawCounter(cg, 320, 64, ++frames); ctex.needsUpdate = true;
      setLamp(SHUTTER, 0xfff2dc); setLamp(LENS, 0xdfe8ff); tShut = 0.08;
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
