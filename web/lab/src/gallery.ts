// Development only: the equipment gallery (web/lab/gallery.html, `npm run gallery`), every registry item in two rows
// on a plain floor under three-point lighting, for checking models against their references. Not part of the page.
// URL flags: ?piece=<name> (?view=, its old name, still read: the page's view is another key, #22) flies to that item's close-up (`&q`: a three-quarter view instead; `&cam=px,py,pz,tx,ty,tz,fov`:
// a camera at p looking at t, in the item's own frame), &play runs the fake page clock, &tape sends a `tape` event at
// load. window.__gallery reports the renderer's counts.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EQUIPMENT, FOOTPRINT, type EquipmentOptions } from "./equipment";
import type { CameraPose, Equipment, LabState } from "./types";

const UP = new URLSearchParams(location.search);

/** A stand-in for the plot (#cv): white strokes on black, 1:1.1, an Earth with its night side hatched. */
function fakePlot(): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = 500; c.height = 550;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, 500, 550);
  g.strokeStyle = "#fff"; g.lineWidth = 2; g.strokeRect(40, 60, 420, 420);
  for (let k = 0; k <= 8; k++) { const x = 40 + k * 52.5; g.beginPath(); g.moveTo(x, 480); g.lineTo(x, 470); g.stroke(); g.beginPath(); g.moveTo(40, 60 + k * 52.5); g.lineTo(50, 60 + k * 52.5); g.stroke(); }
  g.beginPath(); g.arc(250, 270, 80, 0, Math.PI * 2); g.stroke();
  g.save(); g.beginPath(); g.arc(250, 270, 80, 0, Math.PI * 2); g.clip();
  for (let y = 190; y < 350; y += 8) { g.beginPath(); g.moveTo(270, y); g.lineTo(330, y); g.stroke(); }
  g.restore();
  g.fillStyle = "#fff";
  for (let k = 0; k < 60; k++) { const x = 45 + (k * 137) % 410, y = 65 + (k * 251) % 410; g.fillRect(x, y, 2, 2); }
  g.font = "16px monospace"; g.fillText("GET 195:03:06", 40, 40); g.fillText("FOV 15 DEG", 360, 40);
  return c;
}

/** Tiles of the MSC floor (about 60 cm, docs/media/UNIVAC1108-NASA.png) with grey seams. */
function floorTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e6e8e6"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#a9aca9"; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

async function main() {
  // The glass terminal reads the kernel from the page's <pre id="fsrc">; give it vdrive.f.
  try {
    const src = await (await fetch("../../src/vdrive.f")).text();
    const pre = document.createElement("pre"); pre.id = "fsrc"; pre.hidden = true; pre.textContent = "\fsrc/vdrive.f\n" + src;
    document.body.appendChild(pre);
  } catch { /* served without the sources: the terminal shows its fallback */ }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !UP.has("noshadow");
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9a9c9a);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;

  // Three-point lighting.
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2); key.position.set(-6, 9, 8); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -10, right: 10, top: 6, bottom: -6, far: 40 }); key.shadow.bias = -0.0004;
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.8); fill.position.set(8, 4, 6);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(0, 6, -10);
  scene.add(key, fill, rim, new THREE.HemisphereLight(0xffffff, 0x404040, 0.3));

  const ft = floorTex(); ft.repeat.set(40 / 0.6, 30 / 0.6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const vec = new THREE.CanvasTexture(fakePlot()); vec.colorSpace = THREE.SRGBColorSpace;
  const ctx = { vectorScreen: vec, maxAnisotropy: renderer.capabilities.getMaxAnisotropy() };
  const placed: { name: string; kind: string; eq: Equipment }[] = [];
  const place = (name: string, kind: string, x: number, z: number, opts?: EquipmentOptions, y = 0) => {
    const eq = EQUIPMENT[kind](ctx, opts);
    eq.object.position.set(x, y, z);
    eq.object.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(eq.object); placed.push({ name, kind, eq });
    return eq;
  };
  const row = (z: number, items: [string, string, EquipmentOptions?][]) => {
    const gap = 0.5, total = items.reduce((s, [, k]) => s + FOOTPRINT[k][0] + gap, -gap);
    let x = -total / 2;
    for (const [name, kind, opts] of items) { const w = FOOTPRINT[kind][0]; place(name, kind, x + w / 2, z, opts); x += w + gap; }
  };
  row(-2, [["uniservo", "uniservo", { number: 60, index: 1 }], ["uniservo61", "uniservo", { number: 61, index: 2 }], ["uniservo62", "uniservo", { number: 62, index: 3 }],
    ["cpu", "cpu"], ["cpu-lamps", "cpu", { lampPanel: true }], ["powercab", "powercab"], ["controller1557", "controller1557"], ["printer", "printer"]]);
  row(4, [["filmrecorder", "filmrecorder"]]);
  row(1, [["vector", "vector"], ["desk", "desk"], ["console4009", "console4009"], ["cardreader", "cardreader"], ["reeltable", "reeltable"], ["chair", "chair"]]);
  const desk = placed.find(p => p.name === "desk")!.eq;
  place("glass", "glass", desk.object.position.x, desk.object.position.z, undefined, (desk.anchors.top as THREE.Vector3).y);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.03, 80);
  let pose: CameraPose = { position: new THREE.Vector3(0, 6.5, 11), target: new THREE.Vector3(0, 0.6, -0.4), fov: 50 };
  const view = UP.get("piece") ?? UP.get("view"), p = placed.find(q => q.name === view);
  if (p) {
    p.eq.object.updateMatrixWorld(true);
    const m = p.eq.object.matrixWorld, [w, h, d] = FOOTPRINT[p.kind], y0 = p.eq.object.position.y;
    const c = p.eq.anchors.camera;
    const cam = UP.get("cam")?.split(",").map(Number);
    if (cam && cam.length >= 6) pose = { position: new THREE.Vector3(cam[0], cam[1], cam[2]).applyMatrix4(m), target: new THREE.Vector3(cam[3], cam[4], cam[5]).applyMatrix4(m), fov: cam[6] || 20 };
    else if (c && !UP.has("q")) pose = { position: c.position.clone().applyMatrix4(m), target: c.target.clone().applyMatrix4(m), fov: c.fov };
    else {
      const t = new THREE.Vector3(0, h * 0.55, 0).applyMatrix4(m), s = Math.max(w, h, d);
      pose = { position: t.clone().add(new THREE.Vector3(s * 0.75, s * 0.35 + 0.2 * (y0 > 0 ? 1 : 0), s * 1.35)), target: t, fov: 40 };
    }
  }
  camera.position.copy(pose.position); camera.fov = pose.fov; camera.lookAt(pose.target); camera.updateProjectionMatrix();

  // The gallery has no page: a fixed sample of its state, Apollo 11 (range zero 1969-07-16 13:32:00 UTC, its EPOCH card) at touchdown.
  const state: LabState = { tab: "review", mode: "attract", playing: UP.has("play"), reel: "DEMO", mounted: "demo", get: 102 * 3600 + 45 * 60 + 40, situation: 1, scenario: 1, mission: "APOLLO 11", epoch: 0, zero: Date.UTC(1969, 6, 16, 13, 32, 0), frameNo: 0, sound: { ctx: null, out: null, on: false } };
  const fire = (type: "tape" | "beamFrame") => { for (const q of placed) q.eq.event?.({ type, at: performance.now() }, state); };
  if (UP.has("tape")) setTimeout(() => fire("tape"), 300);

  // The budget: one frame without the shadow pass.
  const sh = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false; renderer.render(scene, camera);
  const budget = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  renderer.shadowMap.enabled = sh;
  const g = window as unknown as { __gallery: object };
  g.__gallery = { budget, items: placed.length, ready: false, fire };

  let last = 0, frames = 0, acc = 0;
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    if (state.playing) { acc += dt; state.get += dt; while (acc > 1 / 16) { acc -= 1 / 16; state.frameNo++; if (state.frameNo % 4 === 0) fire("beamFrame"); } }
    for (const q of placed) q.eq.update?.(dt, state);
    renderer.render(scene, camera);
    if (++frames === 30) (g.__gallery as { ready: boolean }).ready = true;
  };
  requestAnimationFrame(tick);
  addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
}

main().catch(e => { document.body.textContent = String(e?.stack || e); (window as unknown as { __galleryError: string }).__galleryError = String(e); });
