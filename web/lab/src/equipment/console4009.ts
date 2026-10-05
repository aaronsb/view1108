// The UNIVAC 1108 Display Console, type 4009 (UP-7604, 1968; Figure 2-1 on p. 2-1; UP-4046 rev. 3 Figure 1-1): a desk
// carrying the Operator's Control and Indicator Panel with the Day Clock, a CRT of 16 lines of 64 characters in a
// 10 x 5 in viewing area (Table 2-1, p. 2-2) over a four-bank keyboard, and a PAGEWRITER on a pedestal cabinet that
// logs the CRT's traffic (sec. 2.3.2, p. 2-5). Colours from the 1108 II brochure (pp. 6, 7): white desk top, orange
// drawer front, charcoal panel, light grey CRT housing. No dimensions are given; ours: a 2.2 m desk, 0.73 m high,
// with the PAGEWRITER pedestal at its left end, 2.8 x 1.25 x 0.95 m in all.
//
// The Day Clock shows hours, minutes and hundredths of a minute (sec. 2.3.3, p. 2-5), here the replay's UTC: Apollo
// 11's range zero, 1969-07-16 13:32:00 UTC, plus the g.e.t., less 17,887,260 s in scene 9 (Apollo 8; hdr(16), see
// CLAUDE.md). Its neon-orange digits are HYPOTHETICAL. The CRT's operator messages are ours.
import * as THREE from "three";
import type { BuildContext, Equipment, LabState } from "../types";
import { PAL, Parts, at, canvasTex, chrome, fitDist, grid, keyGeo, lampMat, laminate, lensGeo, own, paint, plastic, rng, tileGeo, tubeGlass, badgeTex } from "./kit";

const A11_RANGE_ZERO = Date.UTC(1969, 6, 16, 13, 32, 0);   // ms
const A8_OFFSET = -17887260;                                // s, scene 9's epoch from Apollo 11's (CLAUDE.md, hdr(16))
const CRT = { x: 0.71, y: 1.085, z: 0.19, w: 0.254, h: 0.127 };

/** The replay's UTC, ms, for the page's state. */
export function replayUTC(s: LabState): number {
  return A11_RANGE_ZERO + ((s.get || 0) + (s.scene === 9 ? A8_OFFSET : 0)) * 1000;
}

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");
const fmtGet = (g: number) => `${pad(g / 3600, 3)}:${pad(g / 60 % 60)}:${pad(g % 60)}`;

export function build(ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts(), grey = paint(PAL.cabinet), dark = paint(PAL.charcoal, 0.9), black = paint(PAL.dark, 0.9);

  // PAGEWRITER on its pedestal (left end).
  const px = -1.12;
  P.box(0.5, 0.66, 0.5, grey, px, 0.33, 0).box(0.46, 0.04, 0.46, black, px, 0.02, 0);
  P.rbox(0.5, 0.18, 0.44, 0.03, paint(0xd2d3cf), px, 0.75, 0);
  P.box(0.38, 0.05, 0.1, dark, px, 0.84, -0.02);
  P.box(0.32, 0.016, 0.016, paint(PAL.orange, 0.7), px, 0.87, 0.04);
  P.add(new THREE.CylinderGeometry(0.022, 0.022, 0.4, 20).rotateZ(Math.PI / 2), black, at(px, 0.865, -0.06));

  // Desk: white laminate top, charcoal pedestal, orange drawer front, a chrome leg at the open end.
  const dx = 0.29, DW = 2.22;
  P.rbox(DW, 0.04, 0.9, 0.012, laminate(PAL.white), dx, 0.71, 0);
  P.box(1.5, 0.69, 0.45, dark, dx + 0.2, 0.345, -0.2);
  P.box(1.0, 0.12, 0.02, paint(PAL.orange, 0.8), dx + 0.05, 0.62, 0.03);
  P.box(0.06, 0.66, 0.05, chrome(), dx - DW / 2 + 0.1, 0.36, 0.2).box(0.06, 0.03, 0.8, chrome(), dx - DW / 2 + 0.1, 0.015, 0);

  // Operator's Control and Indicator Panel: a wedge on the desk, its face leaning back.
  const ix0 = -0.75, ix1 = 0.38, icx = (ix0 + ix1) / 2, iw = ix1 - ix0;
  P.profile([[0.08, 0.73], [-0.04, 1.18], [-0.4, 1.18], [-0.4, 0.73]], ix0, ix1, dark, 0.006);
  const tilt = Math.atan2(0.12, 0.45);
  const face = (t: number, x: number, n = 0.008) => at(x, 0.73 + 0.45 * t + Math.sin(tilt) * n, 0.08 - 0.12 * t + Math.cos(tilt) * n, -tilt);
  P.add(new THREE.BoxGeometry(iw - 0.04, 0.05, 0.004), paint(0x4a4f55, 0.8), face(0.88, icx));
  P.add(new THREE.BoxGeometry(0.19, 0.06, 0.004), black, face(0.3, ix0 + 0.16));

  // CRT unit: light housing, mid-grey front, the tube and a speaker grille, the keyboard tray below.
  const cx = 0.78;
  P.rbox(0.62, 0.42, 0.55, 0.035, grey, cx, 0.75 + 0.08 + 0.21, -0.1);
  P.box(0.56, 0.3, 0.012, paint(0x8d9093, 0.7), cx, 1.07, 0.178);
  P.add(new THREE.ShapeGeometry(new THREE.Shape([[-0.155, -0.085], [0.155, -0.085], [0.155, 0.085], [-0.155, 0.085]].map(([x, y]) => new THREE.Vector2(x, y)))), tubeGlass(0x1c2420), at(CRT.x, CRT.y, CRT.z - 0.004));
  for (let k = 0; k < 9; k++) P.box(0.11, 0.008, 0.006, black, 0.97, 1.0 + k * 0.018, 0.186);
  P.profile([[0.42, 0.75], [0.42, 0.772], [0.2, 0.835], [0.2, 0.75]], cx - 0.29, cx + 0.29, paint(0x9a9d9f, 0.7), 0.004);
  P.bake(object).forEach(m => mine.push(m.geometry));

  // Indicator lamps: four rows of rectangular lamps, a row of pushbuttons (instanced).
  const r = rng(4009), LC = 40, LR = 4;
  const lit: boolean[] = Array.from({ length: LC * LR }, () => r() < 0.3);
  const lampCol = (i: number) => (i % LC) > 30 ? 0xffa050 : 0xfff2dc;
  const ind = grid(tileGeo(), lampMat(), LC, LR, (c, rr) => face(0.72 - rr * 0.1, ix0 + 0.06 + c * ((iw - 0.12) / (LC - 1)), 0.009).multiply(at(0, 0, 0, 0, 0, 0, 0.021, 0.024, 0.01)), () => 0);
  const col = new THREE.Color();
  const paintInd = () => { lit.forEach((on, i) => ind.setColorAt(i, on ? col.set(lampCol(i)) : col.setRGB(0.09, 0.09, 0.085))); ind.instanceColor!.needsUpdate = true; };
  paintInd(); object.add(ind); mine.push(ind);
  const btn = grid(tileGeo(), plastic(0xffffff, 0.4), 20, 1, c => face(0.14, ix0 + 0.35 + c * 0.034, 0.009).multiply(at(0, 0, 0, 0, 0, 0, 0.026, 0.03, 0.03)), c => c % 5 === 0 ? PAL.orange : 0xe6e2d8);
  object.add(btn); mine.push(btn);

  // The four-bank keyboard on the tray, a red key at the left.
  const slope = Math.atan2(0.063, 0.22), KB = at(cx, 0.8035, 0.31, slope), flat = -Math.PI / 2, KS = 0.0155, kh = 0.011 / 0.55;
  const kp: THREE.Matrix4[] = [], kc: number[] = [];
  [12, 12, 11, 10].forEach((n, rr) => { for (let c = 0; c < n; c++) { kp.push(KB.clone().multiply(at(-0.11 + rr * 0.005 + c * 0.019, 0.006, -0.05 + rr * 0.019, flat, 0, 0, KS, KS, kh))); kc.push(0xeeece4); } });
  kp.push(KB.clone().multiply(at(-0.01, 0.006, 0.03, flat, 0, 0, KS * 6, KS, kh))); kc.push(0xeeece4);
  kp.push(KB.clone().multiply(at(-0.2, 0.006, -0.03, flat, 0, 0, KS, KS, kh))); kc.push(0xb8382a);
  const keys = grid(keyGeo(), plastic(0xffffff, 0.5), kp.length, 1, i => kp[i], i => kc[i]);
  object.add(keys); mine.push(keys);

  // Plates: UNIVAC over the panel and under the tube.
  const hdr = own(new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.04), new THREE.MeshStandardMaterial({ map: badgeTex(""), roughness: 0.4 })), mine);
  mine.push((hdr.material as THREE.MeshStandardMaterial).map!);
  hdr.matrixAutoUpdate = false; hdr.matrix.copy(face(0.88, ix0 + 0.16, 0.011)); object.add(hdr);
  const crtBadge = new THREE.Mesh(hdr.geometry, hdr.material); crtBadge.position.set(CRT.x - 0.08, 0.97, 0.186); crtBadge.scale.setScalar(0.45); object.add(crtBadge);

  // The Day Clock window: neon digits on black (HYPOTHETICAL colour), redrawn every hundredth of a minute.
  const clockTex = canvasTex(256, 64, () => {}); mine.push(clockTex);
  const cg = (clockTex.image as HTMLCanvasElement).getContext("2d")!;
  const clock = own(new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.0425), new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false })), mine);
  clock.matrixAutoUpdate = false; clock.matrix.copy(face(0.3, ix0 + 0.16, 0.011)); object.add(clock);
  let clockKey = "";
  const drawClock = (s: LabState) => {
    const d = new Date(replayUTC(s)), txt = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad((d.getUTCSeconds() + d.getUTCMilliseconds() / 1000) / 0.6)}`;
    if (txt === clockKey) return;
    clockKey = txt;
    cg.fillStyle = "#050302"; cg.fillRect(0, 0, 256, 64);
    cg.font = "bold 46px 'Courier New', monospace"; cg.textAlign = "center"; cg.textBaseline = "middle";
    cg.shadowColor = "rgba(255,110,30,0.9)"; cg.shadowBlur = 10; cg.fillStyle = "#ffa060";
    cg.fillText(txt, 128, 34);
    clockTex.needsUpdate = true;
  };

  // The CRT: operator messages (ours), pale green on the tube's grey-green.
  const crtTex = canvasTex(1024, 512, () => {}, ctx.maxAnisotropy); mine.push(crtTex);
  const tg = (crtTex.image as HTMLCanvasElement).getContext("2d")!;
  const crt = own(new THREE.Mesh(new THREE.PlaneGeometry(CRT.w, CRT.h), new THREE.MeshBasicMaterial({ map: crtTex, toneMapped: false })), mine);
  crt.position.set(CRT.x, CRT.y, CRT.z); object.add(crt);
  let crtKey = "";
  const drawCrt = (s: LabState) => {
    const lines = [
      "VIEW-1108   OPERATOR CONSOLE",
      "",
      `SCENE ${pad(s.scene)}   ${s.scene === 9 ? "APOLLO 8" : "APOLLO 11"}`,
      `GET ${fmtGet(Math.max(0, s.get || 0))}   ${s.playing ? "RUNNING" : "HOLD"}`,
      `FRAMES ${pad(s.frameNo, 7)}`,
      "",
      "T60  TRAJECTORY      ASSIGNED",
      "T61  PLOT TAPE       ASSIGNED",
      "MICROFILM RECORDER   READY",
    ];
    const k = lines.join("\n") + Math.floor(s.frameNo / 8);
    if (k === crtKey) return;
    crtKey = k;
    tg.fillStyle = "#0b120d"; tg.fillRect(0, 0, 1024, 512);
    tg.font = "28px 'Courier New', monospace"; tg.fillStyle = "#b9f5b2"; tg.shadowColor = "rgba(150,255,150,0.6)"; tg.shadowBlur = 6;
    lines.forEach((l, i) => tg.fillText(l, 12, 30 + i * 32));
    crtTex.needsUpdate = true;
  };

  // The PAGEWRITER's paper: a sheet up out of the platen, leaning back, with logged lines (ours).
  const paperTex = canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = "#f3f0e6"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#2a2a2a"; g.font = "11px 'Courier New', monospace";
    const L = ["@RUN VIEW", "@ASG,T TRAJ.,T60", "@ASG,T PLOT.,T61", "@XQT VIEW", "FRAME 1 WRITTEN", "FRAME 2 WRITTEN"];
    for (let i = 0; i < 22; i++) g.fillText(L[i % L.length], 10, 16 + i * 14);
  });
  mine.push(paperTex);
  const paper = own(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.26, 1, 6), new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9, side: THREE.DoubleSide })), mine);
  const pp = paper.geometry.attributes.position;
  for (let i = 0; i < pp.count; i++) { const v = (pp.getY(i) + 0.13) / 0.26; pp.setZ(i, -0.06 * v * v); }
  paper.geometry.computeVertexNormals();
  paper.position.set(px, 0.99, -0.05); paper.rotation.x = -0.25; object.add(paper);

  // A power lamp on the PAGEWRITER (HYPOTHETICAL).
  const pl = new THREE.Mesh(lensGeo(), lampMat()); pl.position.set(px + 0.2, 0.75, 0.22); pl.scale.setScalar(0.012); object.add(pl);

  let tick = 0;
  return {
    object,
    anchors: {
      screen: { mesh: crt, uvRect: [0, 0, 1, 1] },
      camera: { position: new THREE.Vector3(CRT.x, CRT.y + 0.02, CRT.z + fitDist(CRT.h * 2.2, 40)), target: new THREE.Vector3(CRT.x, CRT.y, CRT.z), fov: 40 },
      overview: { position: new THREE.Vector3(-0.2, 1.7, 2.4), target: new THREE.Vector3(0, 0.9, 0), fov: 40 },
      lamps: { center: new THREE.Vector3(icx, 0.955, 0.02), normal: new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt)), w: iw, h: Math.hypot(0.45, 0.12) },
    },
    update(dt, s) {
      drawClock(s); drawCrt(s);
      if ((tick += dt) > 0.7) { tick = 0; for (let k = 0; k < 3; k++) { const i = Math.floor(r() * lit.length); lit[i] = !lit[i]; } paintInd(); }
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
