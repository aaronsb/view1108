// The vector terminal: a UNIVAC 1558 Graphic Display Console (UP-7789, 1970, Figure 1-1 on p. 1), whose 12 in
// square tube shows the plot (#cv). Its use at MSC is not documented (our choice; see docs/lab.md). Size 35 x 60 x 50
// in (UP-7789 p. 27, read as W x H x D): 0.9 x 1.5 x 1.25 m here. The shape follows Figure 1-1: a pedestal with three
// light side panels, a hooded head with a dark front, a rounded-square tube in a light bezel, the light pen in a holder
// at the right (p. 15), and a keyboard shelf with the typewriter keys, six function keys at the top left and 35
// function keys under a plastic overlay at the right (p. 16). Proportions are read off the figure; the lit function
// keys and the power lamp are HYPOTHETICAL.
import * as THREE from "three";
import type { BuildContext, Equipment } from "../types";
import { PAL, Parts, at, fitDist, glowMat, grid, keyGeo, lampMat, lensGeo, own, paint, plastic, rng, roundRect, rubber, satinMetal, tubeGlass, canvasTex } from "./kit";

const FOV = 40;
// The plot canvas is 1.10 times as tall as it is wide (web/src/render.js HGT); it fills the 12 in tube's height.
const SH = 0.28, SW = SH / 1.1;
const SX = -0.06, SY = 1.22, SZ = 0.322;   // the plot's centre

export function build(ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts();
  const grey = paint(PAL.cabinet), dark = paint(PAL.charcoal, 0.9), black = paint(PAL.dark, 0.9), bezel = paint(0xdcdcd5, 0.7);

  // Pedestal: black plinth, charcoal body, three light panels on each side.
  P.box(0.62, 0.1, 0.68, black, 0, 0.05, -0.14);
  P.box(0.7, 0.7, 0.8, dark, 0, 0.45, -0.14);
  for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) P.rbox(0.012, 0.66, 0.255, 0.004, grey, sx * 0.356, 0.45, -0.14 + k * 0.265);

  // Head: the light shell, its front outline chamfered at the top, and the dark front inset into it.
  const hex = (i: number): [number, number][] => [[-0.45 + i, 0.8 + i], [0.45 - i, 0.8 + i], [0.45 - i, 1.38 - i * 0.6], [0.37 - i * 0.6, 1.5 - i], [-0.37 + i * 0.6, 1.5 - i], [-0.45 + i, 1.38 - i * 0.6]];
  P.outline(hex(0), -0.58, 0.3, grey, 0.015);
  P.outline(hex(0.035), 0.29, 0.31, dark);
  // Tube: a light bezel ring, the dark glass recessed in it.
  P.outline(roundRect(SX, SY, 0.4, 0.4, 0.06), 0.305, 0.335, bezel, 0.006, [roundRect(SX, SY, 0.318, 0.318, 0.045).reverse()]);
  P.add(new THREE.ShapeGeometry(new THREE.Shape(roundRect(SX, SY, 0.322, 0.322, 0.046).map(([x, y]) => new THREE.Vector2(x, y)))), tubeGlass(), at(0, 0, SZ - 0.003));

  // Light pen: a holder clip, the pen, and its coiled cord down into the panel.
  P.box(0.03, 0.026, 0.03, black, 0.34, 1.31, 0.325).box(0.03, 0.02, 0.03, black, 0.34, 1.15, 0.325);
  P.cyl(0.009, 0.009, 0.15, plastic(0xd8d6cf), 0.34, 1.24, 0.345).cyl(0.006, 0.002, 0.03, rubber(), 0.34, 1.15, 0.345);
  P.cyl(0.012, 0.012, 0.012, black, 0.34, 1.42, 0.315, 16, true);
  const coil: THREE.Vector3[] = [];
  for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * Math.PI * 22; coil.push(new THREE.Vector3(0.34 + Math.cos(a) * 0.008, 1.14 - t * 0.2, 0.352 + Math.sin(a) * 0.008)); }
  P.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 240, 0.0022, 5), rubber());

  // Keyboard shelf: a dark tray tilted toward the operator, keyboard plate at left, function overlay at right.
  const tray = at(0, 0.975, 0.47, 0.1);
  const onTray = (x: number, y: number, z: number, rx = 0) => tray.clone().multiply(at(x, y, z, rx));
  P.add(new THREE.BoxGeometry(0.82, 0.045, 0.32), dark, onTray(0, 0, 0));
  P.add(new THREE.BoxGeometry(0.5, 0.008, 0.2), paint(0x5c5f62, 0.8), onTray(-0.12, 0.026, 0.02));
  P.add(new THREE.BoxGeometry(0.2, 0.008, 0.19), plastic(0xe9e7df, 0.5), onTray(0.24, 0.026, 0.02));
  // The control strip behind the overlay: two square buttons, two knobs, the power lamp.
  P.add(new THREE.BoxGeometry(0.3, 0.035, 0.04), bezel, onTray(0.19, 0.035, -0.125));
  for (const x of [0.07, 0.11]) P.add(new THREE.BoxGeometry(0.026, 0.012, 0.026), black, onTray(x, 0.056, -0.125));
  for (const x of [0.2, 0.24]) P.add(new THREE.CylinderGeometry(0.009, 0.01, 0.014, 16), satinMetal(), onTray(x, 0.058, -0.125));
  P.bake(object).forEach(m => mine.push(m.geometry));

  // Keys (instanced): typewriter keys, a space bar, the six top-left function keys, the TRANSMIT key.
  const keys = new THREE.Group(); keys.matrixAutoUpdate = false; keys.matrix.copy(tray); object.add(keys);
  const flat = -Math.PI / 2, KP = 0.025, KS = 0.02;
  const rows = [11, 11, 10, 9], places: THREE.Matrix4[] = [], colors: number[] = [];
  rows.forEach((n, r) => { for (let c = 0; c < n; c++) { places.push(at(-0.345 + r * 0.008 + c * KP, 0.03, -0.05 + r * KP, flat, 0, 0, KS, KS, 0.012 / 0.55)); colors.push(0xd6d5ce); } });
  places.push(at(-0.2, 0.03, 0.06 + 0.012, flat, 0, 0, KS, KS, 0.012 / 0.55).multiply(new THREE.Matrix4().makeScale(7, 1, 1))); colors.push(0xd6d5ce);
  for (let c = 0; c < 6; c++) { places.push(at(-0.345 + c * KP, 0.03, -0.08, flat, 0, 0, KS, KS, 0.012 / 0.55)); colors.push(0x3d4044); }
  places.push(at(0.1, 0.03, 0.05, flat, 0, 0, KS, KS, 0.012 / 0.55).multiply(new THREE.Matrix4().makeScale(1.6, 1.6, 1))); colors.push(PAL.orange);
  const typing = grid(keyGeo(), plastic(0xffffff, 0.55), places.length, 1, i => places[i], i => colors[i]);
  keys.add(typing); mine.push(typing);
  // The 35 function keys under the overlay (7 x 5). Lit, as if backlit: HYPOTHETICAL.
  const fk = grid(keyGeo(), lampMat(), 7, 5, (c, r) => at(0.162 + c * 0.0255, 0.031, -0.03 + r * 0.025, flat, 0, 0, 0.019, 0.019, 0.01 / 0.55), (c, r) => {
    const v = 0.55 + 0.25 * rng(c * 7 + r + 3)(); return new THREE.Color(v, v * 0.96, v * 0.86).getHex();
  });
  keys.add(fk); mine.push(fk);
  const legends = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff"; g.font = "bold 13px Helvetica, Arial, sans-serif"; g.textAlign = "center";
    const L = ["LINE", "ARC", "POINT", "ERASE", "MOVE", "COPY", "ZOOM", "ROT", "TEXT", "GRID", "DASH", "SNAP", "PAGE", "HOLD", "NEXT", "BACK", "SAVE", "CALL", "LIST", "PEN", "STEP"];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) g.fillText(L[(r * 7 + c) % L.length], (c + 0.5) * w / 7, (r + 0.6) * h / 5);
  });
  mine.push(legends);
  // Legends printed on the overlay (ours: the overlays are per application, UP-7789 p. 16), over the lit keys.
  const leg = own(new THREE.Mesh(new THREE.PlaneGeometry(7 * 0.0255, 5 * 0.025), new THREE.MeshBasicMaterial({ color: 0x222222, alphaMap: legends, transparent: true, depthWrite: false })), mine);
  leg.rotation.x = flat; leg.position.set(0.162 + 3 * 0.0255, 0.0425, -0.03 + 2 * 0.025); keys.add(leg);
  // Power lamp (HYPOTHETICAL: Figure 1-1 shows small fittings on the strip; which is power is not stated).
  const lamp = new THREE.Mesh(lensGeo(), glowMat(0xffb040));
  lamp.matrixAutoUpdate = false; lamp.matrix.copy(at(0.29, 0.056, -0.125, flat, 0, 0, 0.012)); keys.add(lamp);

  // The plot itself: bright, outside tone mapping.
  const screen = own(new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: ctx.vectorScreen, toneMapped: false })), mine);
  screen.position.set(SX, SY, SZ);
  object.add(screen);

  const target = new THREE.Vector3(SX, SY, SZ);
  return {
    object,
    opens: "workbench",
    anchors: {
      screen: { mesh: screen, uvRect: [0, 0, 1, 1] },
      camera: { position: new THREE.Vector3(SX, SY, SZ + fitDist(SH, FOV)), target, fov: FOV },
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
