// A UNISERVO VIII-C magnetic tape unit (UP-4046 rev. 3 sec. 8.4.2: 120 in/s, rewind 240 in/s, 2400 ft reels). The
// look is from the 1108 II brochure (p. 7, colour) and the MSC photograph of 15 July 1969: a light frame, two reels
// side by side behind glass in the upper third, a number and indicator strip on top, an orange head plate under the
// reels carrying the unit's number (60, 61, ... at MSC), a plain lower door. Size 0.75 x 1.8 x 0.75 m is read off the
// photographs (inferred); the vacuum columns are behind the lower door (inferred) and not modelled.
//
// Motion: an idle unit is mostly still, with an occasional short shuttle; a `tape` event (the engine ran) sets some
// units running bursts of reads, sometimes ending in a rewind. The reels turn at the tape speed over the pack radius,
// so the emptier reel spins faster; the packs trade radius as tape moves, at 12 times the real rate so a burst shows.
//
// The drive (`drive: true`, the station table's "drive", ours): the unit with the mounted reel. A paper label across
// the window's lower edge names the reel (DEMO while the demo plays, else the situation's title; LabState.reel) and a
// RUN and a STOP lamp beside it say whether its playback clock runs (LabState.playing). Using it (a click, E) is the
// page's STOP/START (lab.ts gives it its `use`). While it runs its reels read in bursts; stopped, they hold still. In
// Beam, which paces its own clock, it shows no state: both lamps dark, the reels still.
//
// Dressing (#87, ours): the file reel (the left one) carries a hub label naming its tape and a flange in that tape's
// colour. The drive's names the mounted reel (blue for a scenario reel, red for a playlist, as their cases on the rack).
// While a scenario reel is mounted, the other six units carry the site's system tapes (systapes.ts), each with a paper
// label across its window like the drive's, and run their own bursts of reads (start, run, stop, now and then a rewind)
// at times of their own, staggered unit by unit, so the row never moves in unison; a `tape` event sets them going one
// after another. Otherwise (the demo, the tour) they stand undressed, as before. `BuildContext.still` (`?labmotion=0`)
// holds every reel where it was built, for repeatable screenshots.
import * as THREE from "three";
import type { BuildContext, Equipment, LabEvent, LabState } from "../types";
import { tapeOnUnit } from "./systapes";
import { PAL, Parts, at, canvasTex, grid, lampMat, lensGeo, paint, plateFontReady, plateText, rng, satinMetal, sharedGeo, smoked, chrome, plastic, poseFrom } from "./kit";

export interface UniservoOptions { number?: number; index?: number; drive?: boolean }

const IPS = 0.0254;
const SPEED = 120 * IPS, REWIND = 240 * IPS;    // m/s
const LENGTH = 2400 * 0.3048;                    // m of tape on a full reel
const FLANGE = 10.5 / 2 * IPS;                   // a 10.5 in reel (inferred from the 2400 ft length)
const HUB = 0.057;                               // hub radius, ours
// Full pack radius from the tape's area: 2400 ft of 1.5 mil tape (thickness inferred).
const FULL = Math.sqrt(HUB * HUB + LENGTH * 1.5e-3 * IPS / Math.PI);
const COMPRESS = 12;                             // pack radius change, times real
const ACCEL = 9;                                 // m/s^2 at the reels (ours; the columns hide the real start)

/** The reel's front flange: three windows, so turning shows. */
const flangeTex = () => sharedTex ??= canvasTex(256, 256, (g, w) => {
  const c = w / 2;
  g.fillStyle = "#fff"; g.beginPath(); g.arc(c, c, c - 1, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = "destination-out";
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3;
    g.beginPath(); g.arc(c, c, c * 0.9, a + 0.25, a + 1.75); g.arc(c, c, c * 0.5, a + 1.75, a + 0.25, true); g.closePath(); g.fill();
  }
  g.beginPath(); g.arc(c, c, c * 0.12, 0, Math.PI * 2); g.fill();
});
let sharedTex: THREE.CanvasTexture | undefined;
let flangeMat: THREE.MeshStandardMaterial | undefined;
const reelFront = () => flangeMat ??= new THREE.MeshStandardMaterial({ color: 0xb8c0c6, metalness: 0.3, roughness: 0.35, alphaMap: flangeTex(), alphaTest: 0.5, side: THREE.DoubleSide });
const discGeo = () => sharedGeo("reelDisc", () => new THREE.CylinderGeometry(FLANGE, FLANGE, 0.0015, 32).rotateX(Math.PI / 2));
const backGeo = () => sharedGeo("reelBack", () => {
  const P = new Parts(), m = satinMetal();
  P.cyl(FLANGE, FLANGE, 0.0015, m, 0, 0, -0.0075, 32, true).cyl(HUB, HUB, 0.016, m, 0, 0, 0, 16, true);
  const g = new THREE.Group(); const [mesh] = P.bake(g); return mesh.geometry;
});
const packGeo = () => sharedGeo("reelPack", () => new THREE.CylinderGeometry(1, 1, 0.0127, 32).rotateX(Math.PI / 2));

interface Reel { group: THREE.Group; pack: THREE.Mesh }
function reel(front: THREE.Material = reelFront()): Reel {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(backGeo(), satinMetal()));
  const pack = new THREE.Mesh(packGeo(), plastic(PAL.tape, 0.5));
  const face = new THREE.Mesh(discGeo(), front); face.position.z = 0.0075;
  group.add(pack, face);
  return { group, pack };
}

/** A file reel's hub label (#87, ours): a paper disc over the hub with the tape's name across it and a band of its
 *  colour, turning with the reel, so a running reel shows. Drawn again when the name or colour changes. */
const HUB_LABEL_R = 0.062;
function hubLabel(mine: { dispose(): void }[]) {
  const S = 256;
  let drawn = "";
  const tex = canvasTex(S, S, () => {});
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, transparent: true });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(HUB_LABEL_R, 32), mat);
  disc.position.z = 0.0088; disc.visible = false;
  mine.push(disc.geometry, mat, tex);
  const measure = document.createElement("canvas").getContext("2d")!;
  const set = (text: string, tint: number) => {
    disc.visible = !!text;
    const key = `${text}|${tint}`;
    if (!text || key === drawn) return;
    drawn = key;
    const g = (tex.image as HTMLCanvasElement).getContext("2d")!, c = S / 2;
    g.clearRect(0, 0, S, S);
    g.fillStyle = "#efe9d8"; g.beginPath(); g.arc(c, c, c - 1, 0, Math.PI * 2); g.fill();
    g.fillStyle = `#${tint.toString(16).padStart(6, "0")}`; g.fillRect(0, c - 0.62 * c, S, 0.2 * c);
    g.fillStyle = "#1c1c1c"; g.beginPath(); g.arc(c, c, 0.27 * c, 0, Math.PI * 2); g.fill();   // the hub's bore
    g.fillStyle = "#161616";
    let px = 40;
    while (px > 12 && plateText(measure, text, 0, 0, px, 0.06) > S * 0.86) px -= 2;
    plateText(g, text, c, c + 0.58 * c, px, 0.06, "center");
    tex.needsUpdate = true;
  };
  return { disc, set };
}

/** Number plates, in the nameplate face: black digits on white (the head plate's label) or white on black (the top
 *  strip), drawn as 128 x 64 cells of one atlas shared by every unit, so the room draws all the plates at once; drawn
 *  again when the face arrives. */
const CELLS = 8;
let atlas: { tex: THREE.CanvasTexture; mat: THREE.MeshStandardMaterial; slots: Map<string, number> } | undefined;
function drawCell(n: string, light: boolean, k: number): void {
  const g = (atlas!.tex.image as HTMLCanvasElement).getContext("2d")!, x = (k % CELLS) * 128, y = Math.floor(k / CELLS) * 64;
  g.fillStyle = light ? "#f2efe6" : "#151617"; g.fillRect(x, y, 128, 64);
  g.fillStyle = light ? "#141414" : "#eeeeea";
  plateText(g, n, x + 64, y + 34, n.length > 2 ? 26 : 34, 0.06, "center");
  atlas!.tex.needsUpdate = true;
}
function numberPlate(n: string, light: boolean, w: number, h: number): THREE.Mesh {
  if (!atlas) {
    const tex = canvasTex(128 * CELLS, 64 * CELLS, () => {});
    atlas = { tex, mat: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), slots: new Map() };
    void plateFontReady().then(ok => { if (ok && atlas) for (const [key, k] of atlas.slots) { const [t, l] = key.split("|"); drawCell(t, l === "true", k); } });
  }
  const key = `${n}|${light}`;
  let k = atlas.slots.get(key);
  if (k === undefined) { atlas.slots.set(key, k = atlas.slots.size % (CELLS * CELLS)); drawCell(n, light, k); }
  const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv, u0 = (k % CELLS) / CELLS, v0 = 1 - (Math.floor(k / CELLS) + 1) / CELLS;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / CELLS, v0 + uv.getY(i) / CELLS);
  const m = new THREE.Mesh(geo, atlas.mat);
  m.userData.static = true;   // the room merges the plates (room/batch.ts)
  return m;
}

// Indicator lamps on the top strip, left to right (meanings ours, HYPOTHETICAL): ready, select, write enable,
// busy, rewind, fault.
const OFF = 0x2a2a26, LAMP_ON = [0x6cf08a, 0xf4f1e6, 0xff6a3c, 0xffb040, 0xf4f1e6, 0xff3020];

/** The drive's reel label and RUN/STOP lamps (ours): a paper label 0.4 x 0.085 m across the window's lower band, the
 *  reel's name in the nameplate face, the lamps' captions at its right end, under two lenses that light. */
const LABEL = { w: 0.4, h: 0.085, y: 1.18, z: 0.3855 };
const RUN_ON = 0x6cf08a, STOP_ON = 0xffa030;
function reelLabel(mine: { dispose(): void }[], lamps = true) {
  const W = 512, H = Math.round(W * LABEL.h / LABEL.w);
  let title = "", drawn = "";
  const draw = (g: CanvasRenderingContext2D) => {
    g.fillStyle = "#efe9d8"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#8a8474"; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
    g.fillStyle = "#6a6458"; plateText(g, "REEL", 14, 18, 13, 0.14, "left", 0);
    g.fillStyle = "#161616";
    const t = title || "—", room = W * 0.66;
    let px = 44;
    while (px > 14 && plateText(measure, t, 0, 0, px, 0.06) > room) px -= 2;
    plateText(g, t, 14, H * 0.62, px, 0.06);
    if (!lamps) return;
    g.fillStyle = "#2a2a26";
    plateText(g, "RUN", W * 0.80, H * 0.82, 13, 0.14, "center", 0);
    plateText(g, "STOP", W * 0.92, H * 0.82, 13, 0.14, "center", 0);
  };
  const measure = document.createElement("canvas").getContext("2d")!;
  const tex = canvasTex(W, H, g => draw(g), 4);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(LABEL.w, LABEL.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  card.position.set(0, LABEL.y, LABEL.z);
  const lens = new THREE.CircleGeometry(0.0095, 16);
  const lamp = (x: number) => {
    const m = new THREE.Mesh(lens, new THREE.MeshBasicMaterial({ color: OFF, toneMapped: false }));
    m.position.set(-LABEL.w / 2 + LABEL.w * x, LABEL.y + LABEL.h * 0.12, LABEL.z + 0.0012);
    mine.push(m.material as THREE.Material);
    return m;
  };
  const run = lamp(0.80), stop = lamp(0.92);
  mine.push(card.geometry, card.material as THREE.Material, tex, lens);
  void plateFontReady().then(ok => { if (ok) { drawn = ""; set(title); } });
  const set = (t: string) => {
    if (t === drawn) return;
    title = drawn = t;
    draw((tex.image as HTMLCanvasElement).getContext("2d")!); tex.needsUpdate = true;
  };
  const lit = (playing: boolean | null) => {   // null: neither (Beam)
    (run.material as THREE.MeshBasicMaterial).color.set(playing === true ? RUN_ON : OFF);
    (stop.material as THREE.MeshBasicMaterial).color.set(playing === false ? STOP_ON : OFF);
  };
  return { card, run, stop, set, lit };
}

interface Move { v: number; t: number }

/** The file reel's flange tint for the mounted reel's kind on the drive (the rack's case colours, lightened). */
const MOUNTED_FLANGE = { scenario: 0x5d82b0, playlist: 0xb0453a } as const;

export function build(ctx: BuildContext, opts: UniservoOptions = {}): Equipment {
  const num = opts.number ?? 60, idx = opts.index ?? num - 59, still = !!ctx.still;
  const sys = opts.drive ? undefined : tapeOnUnit(num);
  const r = rng(num * 977 + 13);
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts(), grey = paint(PAL.cabinet), dark = paint(PAL.charcoal, 0.9);

  P.box(0.7, 0.06, 0.7, paint(PAL.dark, 0.9), 0, 0.03, -0.015);
  P.box(0.75, 1.71, 0.72, grey, 0, 0.06 + 0.855, -0.015);
  P.rbox(0.76, 0.03, 0.75, 0.008, paint(0xd4d6d2), 0, 1.785, -0.015);
  P.box(0.72, 0.09, 0.012, dark, 0, 1.71, 0.35);                     // number and indicator strip
  P.box(0.72, 0.52, 0.012, dark, 0, 1.37, 0.35);                     // reel-window surround
  for (const [w, h, x, y] of [[0.72, 0.02, 0, 1.62], [0.72, 0.02, 0, 1.12], [0.02, 0.52, -0.35, 1.37], [0.02, 0.52, 0.35, 1.37]])
    P.box(w, h, 0.03, grey, x, y, 0.37);                              // the window frame
  P.box(0.58, 0.13, 0.014, paint(PAL.orange, 0.8), 0, 1.035, 0.352);  // head plate
  P.box(0.12, 0.05, 0.03, dark, 0, 1.065, 0.37);                      // head cover
  for (const x of [-0.17, 0.17]) P.cyl(0.018, 0.018, 0.03, satinMetal(0x2b2d30), x, 1.06, 0.37, 20, true);
  P.box(0.7, 0.9, 0.01, grey, 0, 0.52, 0.35);                         // lower door
  for (const y of [0.075, 0.965]) P.box(0.7, 0.006, 0.012, paint(PAL.dark), 0, y, 0.35);
  P.box(0.012, 0.16, 0.02, chrome(), 0.3, 0.6, 0.365);                // door handle
  P.bake(object).forEach(m => mine.push(m.geometry));

  const glass = new THREE.Mesh(sharedGeo("uniGlass", () => new THREE.PlaneGeometry(0.68, 0.48)), smoked(0.18, 0x30383c));
  glass.position.set(0, 1.37, 0.383); glass.renderOrder = 1; object.add(glass);

  const plateTop = numberPlate(String(idx), false, 0.07, 0.05);
  plateTop.position.set(-0.3, 1.71, 0.3565); object.add(plateTop);
  const plateHead = numberPlate(String(num), true, 0.09, 0.045);
  plateHead.position.set(0, 1.005, 0.3595); object.add(plateHead);
  mine.push(plateTop.geometry, plateHead.geometry);

  const lamps = grid(lensGeo(), lampMat(), LAMP_ON.length, 1, c => at(-0.08 + c * 0.05, 1.71, 0.356, 0, 0, 0, 0.014), () => OFF);
  object.add(lamps); mine.push(lamps);

  // The file reel's flange: its own material, so its colour can follow the tape it carries.
  const flange = reelFront().clone(); mine.push(flange);
  const reels = [reel(flange), reel()];
  const hub = hubLabel(mine);
  reels[0].group.add(hub.disc);
  reels.forEach((q, i) => { q.group.position.set(i ? 0.17 : -0.17, 1.37, 0.366); q.group.rotation.z = r() * 6; object.add(q.group); });

  const label = opts.drive ? reelLabel(mine) : null;
  if (label) object.add(label.card, label.run, label.stop);
  // A system tape's unit: a paper label like the drive's, without lamps, while it carries the tape.
  const paper = sys ? reelLabel(mine, false) : null;
  if (paper) { paper.card.visible = false; object.add(paper.card); }
  const kindOf = (id: string) => ctx.reels?.find(q => q.id === id)?.kind;
  let dressed = false, mountedId: string | null = null;
  /** The drive's last reading of the page: whether its clock runs, and the reel's name. */
  const mounted = { playing: true, reel: "", beam: false, read: false };

  // State: tape position p (0 all on the file reel, at left), speed v (m/s, + forward), the queue of moves.
  let p = 0.15 + r() * 0.7, v = 0, idle = 4 + r() * 20, runs = 0;
  const queue: Move[] = [];
  /** Read-only for the room's sound: tape speed (m/s, + forward) and the two reels' angular speeds (rad/s). */
  const motion = { v: 0, w0: 0, w1: 0 };
  const lampState: boolean[] = [true, false, r() < 0.5, false, false, false];
  const col = new THREE.Color();
  const setLamps = () => { lampState.forEach((on, i) => lamps.setColorAt(i, col.set(on ? LAMP_ON[i] : OFF))); lamps.instanceColor!.needsUpdate = true; };
  setLamps();
  const radius = (q: number) => Math.sqrt(HUB * HUB + Math.max(0, Math.min(1, q)) * (FULL * FULL - HUB * HUB));
  const sizePacks = () => { reels[0].pack.scale.set(radius(1 - p), radius(1 - p), 1); reels[1].pack.scale.set(radius(p), radius(p), 1); };
  sizePacks();

  const run = () => {
    const n = 4 + Math.floor(r() * 6), dir = p > 0.85 ? -1 : 1;
    for (let k = 0; k < n; k++) queue.push({ v: dir * SPEED, t: 0.25 + r() * 0.8 }, { v: 0, t: 0.1 + r() * 0.35 });
    if (r() < 0.4) queue.push({ v: -REWIND, t: 1 + r() * 1.5 }, { v: 0, t: 0.3 });
  };

  return {
    object,
    // The drive's label is its screen anchor: what the walk's zone faces (E uses it).
    // `tapeUnit`: its number; any tape unit mounts a reel carried from the tape rack (lab.ts).
    // `tapeLabel`: what its paper label names now ("" none), for tests (VIEW_LAB.info().tapes).
    anchors: { camera: poseFrom(new THREE.Vector3(0, 1.3, 0.37), [0.25, 0.1, 1], 1.5, 40), motion, tapeUnit: num,
      tapeLabel: () => label ? mounted.reel : dressed ? sys!.label : "", ...(label ? { screen: { mesh: label.card, uvRect: [0, 0, 1, 1] as [number, number, number, number] } } : {}) },
    ...(label ? { status: () => `${mounted.reel} · ${mounted.beam ? "Beam paces the clock" : mounted.playing ? "running · click to stop" : "stopped · click to start"}` } : {}),
    update(dt, s: LabState) {
      if (s.mounted !== mountedId) {
        mountedId = s.mounted;
        const kind = kindOf(s.mounted), on = !!sys && kind === "scenario";
        if (label) { flange.color.set(kind ? MOUNTED_FLANGE[kind] : 0xb8c0c6); }
        else {
          if (on && !dressed) { idle = 0.6 + idx * 0.9 + r() * 1.2; queue.length = 0; }   // the row starts unit by unit
          dressed = on;
          flange.color.set(on ? sys!.flange : 0xb8c0c6);
          hub.set(on ? sys!.label : "", sys?.flange ?? 0);
          if (paper) { paper.card.visible = on; if (on) paper.set(sys!.label); }
        }
      }
      if (label) hub.set(s.reel, kindOf(s.mounted) === "playlist" ? 0x8a2b22 : 0x2f4a6b);
      dt = still ? 0 : dt;   // ?labmotion=0: the labels above follow the page, the reels hold still
      if (label) {
        // In Beam the drive does not drive the clock (Beam paces itself): both lamps dark, the reels still.
        const beam = s.mode === "beam";
        if (s.playing !== mounted.playing || s.reel !== mounted.reel || beam !== mounted.beam || !mounted.read) {
          mounted.playing = s.playing; mounted.reel = s.reel; mounted.beam = beam; mounted.read = true;
          label.set(s.reel); label.lit(beam ? null : s.playing);
          if (!s.playing || beam) queue.length = 0;
        }
        // Running: bursts of reads, a second or few apart. Stopped: still.
        if (s.playing && !beam && !queue.length && (idle -= dt) < 0) { idle = 1.5 + r() * 3; run(); }
      } else if (dressed) {
        // Carrying a system tape: bursts of reads at this unit's own times.
        if (!queue.length && (idle -= dt) < 0) { idle = 2.5 + r() * 9; run(); }
      } else if (!queue.length && (idle -= dt) < 0) {
        idle = 8 + r() * 25;   // an occasional short shuttle
        const d = r() < 0.5 ? 1 : -1;
        queue.push({ v: d * SPEED, t: 0.2 + r() * 0.5 }, { v: 0, t: 0.15 }, { v: -d * SPEED, t: 0.1 + r() * 0.3 }, { v: 0, t: 0.1 });
      }
      const goal = queue.length ? queue[0].v : 0;
      if (queue.length && (queue[0].t -= dt) < 0) queue.shift();
      const was = v;
      v += Math.max(-ACCEL * dt, Math.min(ACCEL * dt, goal - v));
      if (v > 0 && p >= 1 || v < 0 && p <= 0) { v = 0; queue.length = 0; }
      if (v !== 0) {
        p = Math.max(0, Math.min(1, p + v * dt / LENGTH * COMPRESS));
        const r0 = radius(1 - p), r1 = radius(p);
        reels[0].group.rotation.z -= v / r0 * dt;
        reels[1].group.rotation.z -= v / r1 * dt;
        sizePacks();
      }
      motion.v = v; motion.w0 = v / radius(1 - p); motion.w1 = v / radius(p);
      const busy = Math.abs(v) > 0.05, rew = v < -SPEED * 1.2 || goal < -SPEED * 1.2;
      if (busy !== lampState[3] || rew !== lampState[4] || (queue.length > 0) !== lampState[1] || (was === 0) !== (v === 0)) {
        lampState[1] = queue.length > 0; lampState[3] = busy; lampState[4] = rew; setLamps();
      }
    },
    event(e: LabEvent) {
      if (e.type !== "tape" || (label && (!mounted.playing || mounted.beam))) return;
      runs++;
      // About two in three units take part, each after a pause of its own, so they start one after another.
      if ((num + runs) % 3 !== 0) { queue.length = 0; queue.push({ v: 0, t: 0.1 + ((idx * 0.37 + runs * 0.29) % 1) * 2.4 }); run(); }
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}
