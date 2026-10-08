// The tape librarian's table from the MSC photograph of 15 July 1969: stacks of 10.5 in reels lying flat, a rack of
// reels on edge, and a square desk clock. 1.6 x 0.75 x 0.8 m and the details are inferred from the photograph.
// The clock keeps Houston time for the replay's moment: Central time, daylight time from the last Sunday in April to
// the last Sunday in October (the Uniform Time Act of 1966, 15 U.S.C. 260a).
import * as THREE from "three";
import type { BuildContext, Equipment, LabState } from "../types";
import { Parts, at, canvasTex, chrome, fontTex, laminate, own, paint, plastic, poseFrom, rng, sharedGeo } from "./kit";
import { replayUTC } from "./console4009";

const R = 10.5 / 2 * 0.0254, T = 0.022;

/** A reel seen from above: flange with windows, the tape pack, the hub. */
let faceMat: THREE.MeshStandardMaterial | undefined;
const reelFace = () => faceMat ??= new THREE.MeshStandardMaterial({
  roughness: 0.5, metalness: 0.2,
  map: canvasTex(128, 128, (g, w) => {
    const c = w / 2;
    g.fillStyle = "#dfe2e4"; g.fillRect(0, 0, w, w);
    g.fillStyle = "#3a2a20"; g.beginPath(); g.arc(c, c, c * 0.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#dfe2e4";
    for (let k = 0; k < 3; k++) { const a = k * 2.094; g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, a - 0.3, a + 0.3); g.fill(); }
    g.fillStyle = "#c8ccd0"; g.beginPath(); g.arc(c, c, c * 0.42, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#222"; g.beginPath(); g.arc(c, c, c * 0.12, 0, Math.PI * 2); g.fill();
  }),
});
const reelGeo = () => sharedGeo("tableReel", () => new THREE.CylinderGeometry(R, R, T, 40, 1));

/** Is a Houston instant (UTC ms) in daylight time? Last Sunday of April 02:00 to last Sunday of October 02:00. */
function cdt(ms: number): boolean {
  const y = new Date(ms).getUTCFullYear();
  const lastSun = (m: number) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
  const start = Date.UTC(y, 3, lastSun(3), 8), end = Date.UTC(y, 9, lastSun(9), 7);   // 02:00 CST = 08:00 UTC; 02:00 CDT = 07:00 UTC
  return ms >= start && ms < end;
}

export function build(_ctx: BuildContext): Equipment {
  const object = new THREE.Group(), mine: { dispose(): void }[] = [];
  const P = new Parts(), legs = paint(0x3b3e41, 0.7);
  P.rbox(1.6, 0.03, 0.8, 0.006, laminate(0x8f928e), 0, 0.735, 0);
  P.box(1.5, 0.08, 0.02, legs, 0, 0.68, 0.37).box(1.5, 0.08, 0.02, legs, 0, 0.68, -0.37);
  for (const x of [-0.76, 0.76]) for (const z of [-0.36, 0.36]) P.box(0.04, 0.72, 0.04, legs, x, 0.36, z);
  // The rack: two chrome rails with dividers.
  const rx = 0.42;
  for (const z of [-0.06, 0.06]) P.box(0.34, 0.012, 0.012, chrome(), rx, 0.756, z);
  for (let k = 0; k <= 8; k++) P.box(0.004, 0.06, 0.14, chrome(), rx - 0.16 + k * 0.04, 0.78, 0);
  // The clock's case.
  P.rbox(0.17, 0.17, 0.08, 0.01, paint(0x5a4a3c, 0.6), 0.65, 0.835, 0.22);
  P.bake(object).forEach(m => mine.push(m.geometry));

  // Reels (instanced): three stacks flat, eight on edge in the rack.
  const r = rng(2400), mats: THREE.Matrix4[] = [], cols: number[] = [];
  const tints = [0xffffff, 0xf4f0e0, 0xbfc6cc, 0x8a9096, 0xe8e2c8];
  for (const [x, z, n] of [[-0.55, 0.06, 8], [-0.25, -0.14, 5], [-0.08, 0.2, 3]] as const)
    for (let k = 0; k < n; k++) { mats.push(at(x + (r() - 0.5) * 0.01, 0.75 + T / 2 + k * T, z + (r() - 0.5) * 0.01, 0, r() * 6, 0)); cols.push(tints[Math.floor(r() * tints.length)]); }
  for (let k = 0; k < 8; k++) { mats.push(at(rx - 0.14 + k * 0.04, 0.75 + R + 0.01, 0, 0, 0, Math.PI / 2 + (r() - 0.5) * 0.06)); cols.push(tints[Math.floor(r() * tints.length)]); }
  const reels = new THREE.InstancedMesh(reelGeo(), [plastic(0xf2f2ee, 0.6), reelFace(), reelFace()], mats.length);
  const c = new THREE.Color();
  mats.forEach((m, i) => { reels.setMatrixAt(i, m); reels.setColorAt(i, c.set(cols[i])); });
  object.add(reels); mine.push(reels);

  // Clock face and hands.
  const faceTex = fontTex(256, 256, (g, w) => {
    const cc = w / 2;
    g.fillStyle = "#f6f4ec"; g.fillRect(0, 0, w, w);
    g.fillStyle = "#1a1a1a"; g.font = 'bold 30px "IBM Plex Sans VIEW", sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
    for (let h = 1; h <= 12; h++) { const a = h / 12 * Math.PI * 2; g.fillText(String(h), cc + Math.sin(a) * 96, cc - Math.cos(a) * 96); }
    for (let m = 0; m < 60; m++) { const a = m / 60 * Math.PI * 2, l = m % 5 ? 6 : 12; g.fillRect(cc + Math.sin(a) * (122 - l) - 1, cc - Math.cos(a) * (122 - l) - 1, 2, 2); }
  });
  mine.push(faceTex);
  const face = own(new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.4 })), mine);
  face.position.set(0.65, 0.835, 0.261); object.add(face);
  const hand = (len: number, w: number, color: number, z: number) => {
    const g = new THREE.PlaneGeometry(w, len).translate(0, len / 2 - 0.006, 0);
    const m = own(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.5 })), mine);
    m.position.set(0.65, 0.835, 0.262 + z); object.add(m); return m;
  };
  const hh = hand(0.038, 0.006, 0x151515, 0.001), mh = hand(0.056, 0.004, 0x151515, 0.002), sh = hand(0.06, 0.0015, 0xb02a20, 0.003);

  return {
    object,
    anchors: { camera: poseFrom(new THREE.Vector3(0.1, 0.8, 0), [0.3, 0.8, 1], 1.6, 40) },
    update(_dt, s: LabState) {
      const u = replayUTC(s), local = u - (cdt(u) ? 5 : 6) * 3600e3, d = new Date(local);
      const sec = d.getUTCSeconds(), min = d.getUTCMinutes() + sec / 60, hr = d.getUTCHours() % 12 + min / 60;
      hh.rotation.z = -hr / 12 * Math.PI * 2; mh.rotation.z = -min / 60 * Math.PI * 2; sh.rotation.z = -sec / 60 * Math.PI * 2;
    },
    dispose() { mine.forEach(d => d.dispose()); },
  };
}

