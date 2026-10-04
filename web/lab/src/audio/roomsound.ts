// The machine room's sound: a positional soundscape synthesized with WebAudio (oscillators, noise made in code,
// filters, panners, one convolver with a made-up small-room response; no recordings). docs/lab.md (Sound) lists every
// source, what of it is sourced and what is ours. In short: the drum speeds and the FASTRAND's head motion are from
// UP-4046; the rest (levels, fan speeds, blade counts, the HVAC, motor and ballast models) is our guess at a room
// that was "not quiet but tolerable".
//
// The graph hangs off the page's master gain (LabState.sound.out, web/src/sound.js), so the page's Sound toggle mutes
// and suspends it with everything else. While the room runs it replaces the page's own ambience bed
// (LabState.sound.bed); stopping the room hands the bed back. The listener follows the lab's camera. When the page is
// shown over the room (zoomed into a terminal) the room ducks DUCK_DB and keeps the tape units turning, so an engine
// run on the page is still heard from the tape row.
//
// Every continuous source is built once; per step only AudioParams move. One-shot knocks and clicks (a capstan
// starting, a FASTRAND seek, a tube striking) are capped at MAX_SHOTS at a time.
import * as THREE from "three";
import type { Equipment, LabEvent, LabState, Room } from "../types";
import { click, knock, noises, rng, roomIR, wave } from "./synth";
import { TROFFERS, ROOM } from "../room/shell";

const STEP_S = 0.05;           // the live loop's step
const DUCK_DB = -8;            // the room under a terminal's page
const WET = 0.35;              // send into the room response
const MAX_SHOTS = 12;
const MAINS = 60;              // Hz, US mains

// The drums (UP-4046 rev. 3): FH-432 7,200 rev/min (p. 8-5), FH-1782 1,800 rev/min (p. 8-6), FASTRAND II 880 rev/min
// (p. 8-10), its 64 heads moved together in 30 to 86 ms (p. 8-8). The minimum 1108 system has three FH-432 drums (or
// one FH-1782) and one FASTRAND (sec. 5, p. 5-3); we give the room that: three FH-432 and a FASTRAND II, behind the
// west wall (no source places MSC's drums; we cannot find them in the MSC photograph).
const FH432_HZ = 7200 / 60, FASTRAND_HZ = 880 / 60;
const SEEK_MS: [number, number] = [30, 86];

const TAPE_SPEED = 120 * 0.0254;   // m/s (UP-4046 sec. 8.4.2)

/** A positioned source: its input (the dry level) feeds the panner and a send to the room response. */
interface Src { name: string; input: GainNode; panner: PannerNode; pos: THREE.Vector3 }
interface Tape { src: Src; eq: Equipment; motion: { v: number; w0: number; w1: number }; motor: [OscillatorNode, OscillatorNode]; motorG: GainNode; air: BiquadFilterNode; airG: GainNode; hiss: GainNode; moving: boolean; lastShot: number }
interface Graph {
  ctx: BaseAudioContext; dest: AudioNode; master: GainNode; wet: GainNode; analyser: AnalyserNode;
  srcs: Src[]; tapes: Tape[]; rows: { src: Src; hum: GainNode; buzz: GainNode }[]; fastrand: Src;
  nodes: AudioScheduledSourceNode[]; lit: boolean; nextSeek: number;
}

export class RoomSound {
  private g: Graph | null = null;
  private timer = 0;
  private last = 0;
  private shots = 0;
  private r = rng(1108);
  private bedOff: ((on: boolean) => void) | null = null;
  private v = new THREE.Vector3();

  /** `auto` runs the live loop (STEP_S) against the page's context; without it the caller attaches and steps. */
  constructor(private room: Room, private camera: THREE.Camera, private state: () => LabState, private shown: () => boolean, auto = true) {
    if (auto) this.timer = window.setInterval(this.live, STEP_S * 1000);
  }

  /** Live loop: build on the page's context once sound is on, then step. */
  private live = () => {
    const s = this.state(), ctx = s.sound.ctx, out = s.sound.out;
    if (!ctx || !out || !s.sound.on) return;
    if (!this.g || this.g.ctx !== ctx) {
      this.attach(ctx, out);
      this.bedOff = s.sound.bed ?? null; this.bedOff?.(false);
    }
    if (ctx.state !== "running") { this.last = 0; return; }
    const now = performance.now(), dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : STEP_S;
    this.last = now;
    if (!this.shown()) for (const t of this.g!.tapes) t.eq.update?.(dt, s);   // the lab's frame loop is stopped
    this.step(dt);
  };

  /** Build the whole graph on ctx into dest. */
  attach(ctx: BaseAudioContext, dest: AudioNode): void {
    this.detach();
    const N = noises(ctx), nodes: AudioScheduledSourceNode[] = [], srcs: Src[] = [];
    const master = ctx.createGain(); master.gain.value = 0;
    master.gain.setTargetAtTime(this.duck(), ctx.currentTime, 0.3);   // fade in
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    master.connect(dest); master.connect(analyser);
    const conv = ctx.createConvolver(); conv.buffer = roomIR(ctx);
    const wet = ctx.createGain(); wet.gain.value = WET; wet.connect(conv).connect(master);

    const start = <T extends AudioScheduledSourceNode>(n: T): T => { n.start(); nodes.push(n); return n; };
    const noise = (buf: AudioBuffer, rate = 1) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate * (0.97 + this.r() * 0.06);
      s.start(0, this.r() * buf.duration); nodes.push(s); return s;
    };
    const osc = (type: OscillatorType | PeriodicWave, hz: number) => {
      const o = ctx.createOscillator();
      if (typeof type === "string") o.type = type as OscillatorType; else o.setPeriodicWave(type as PeriodicWave);
      o.frequency.value = hz; return start(o);
    };
    const filt = (type: BiquadFilterType, hz: number, q = 0.707) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q; return f; };
    const gain = (v: number) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    /** A source at pos; `rolloff` for the inverse distance law (refDistance 1 m), `through` a wall's low-pass. */
    const source = (name: string, pos: THREE.Vector3, rolloff: number, level = 1, through = 0): Src => {
      const input = gain(level), panner = ctx.createPanner();
      Object.assign(panner, { panningModel: "equalpower", distanceModel: "inverse", refDistance: 1, maxDistance: 20, rolloffFactor: rolloff });
      panner.positionX.value = pos.x; panner.positionY.value = pos.y; panner.positionZ.value = pos.z;
      let head: AudioNode = input;
      if (through) { const lp = filt("lowpass", through); input.connect(lp); head = lp; }
      head.connect(panner).connect(master); head.connect(wet);
      const s = { name, input, panner, pos }; srcs.push(s); return s;
    };
    /** A bank of slow drifts, shared: a few very low oscillators that sources tap for amplitude wander. */
    const drift = [0.031, 0.053, 0.089, 0.137].map(hz => osc("sine", hz));
    const wander = (param: AudioParam, depth: number, k: number) => { const d = gain(depth); drift[k % drift.length].connect(d).connect(param); };

    // Air handling, ours: conditioned air into the room through ceiling diffusers and the raised floor's perforated
    // tiles. Pink noise low-passed for the plenum's rumble (most of it under 120 Hz) and band-passed for the
    // diffusers' hiss; levels wander slowly.
    const air: [string, THREE.Vector3, number, number, number][] = [
      ["diffuser-nw", new THREE.Vector3(-2.2, ROOM.h, -1.4), 900, 0.8, 0.55],
      ["diffuser-ne", new THREE.Vector3(2.2, ROOM.h, -1.4), 1000, 0.8, 0.55],
      ["diffuser-s", new THREE.Vector3(0, ROOM.h, 1.6), 850, 0.8, 0.55],
      ["floor-tapes", new THREE.Vector3(0.2, 0.05, -1.9), 500, 1.0, 0.4],
      ["floor-cpu", new THREE.Vector3(-3.0, 0.05, 0.2), 450, 1.0, 0.4],
    ];
    air.forEach(([name, pos, hiss, rumble, hissLvl], k) => {
      const s = source(name, pos, 0.5, 0.55), n = noise(N.pink, 0.8);
      const lp = filt("lowpass", 130, 0.5), rg = gain(rumble); n.connect(lp).connect(rg).connect(s.input); wander(rg.gain, 0.18 * rumble, k);
      const bp = filt("bandpass", hiss, 0.6), hg = gain(hissLvl); n.connect(bp).connect(hg).connect(s.input); wander(hg.gain, 0.06, k + 1);
      wander(lp.frequency, 25, k + 2);
    });

    // Cabinet fans and transformers, ours: each cabinet's fan a blade-pass tone (shaft 3,420-3,480 rev/min, a 2-pole
    // induction motor's 60 Hz less slip; 5 blades, 285-290 Hz, so neighbours beat) over band-limited noise, and a
    // faint mains hum (60 Hz and its harmonics, 120 Hz strongest) from one shared generator.
    const blade = wave(ctx, [1, 0.35, 0.12, 0.05]);
    const hum = osc(wave(ctx, [0.6, 1, 0.3, 0.25, 0.1, 0.08]), MAINS), humBus = gain(1); hum.connect(humBus);
    const cabinets = this.room.placed.filter(p => /^(cpu|controller1557)-/.test(p.name));
    cabinets.forEach((p, k) => {
      const pos = this.at(p.equipment, 1.5), s = source(p.name, pos, 1.0, 1.0);
      const rpm = 3420 + this.r() * 60, t = osc(blade, rpm / 60 * 5), tg = gain(0.035); t.connect(tg).connect(s.input);
      wander(t.frequency, 0.4, k);
      const n = noise(N.pink, 1.2), bp = filt("bandpass", 1100 + this.r() * 400, 0.5), ng = gain(0.22); n.connect(bp).connect(ng).connect(s.input);
      const hp = filt("lowpass", 800); const hg = gain(0.05); humBus.connect(hp).connect(hg).connect(s.input);
    });

    // Drums behind the west wall (heard through it: low-passed). FH-432: three drums at 120 Hz (slip, ours, detunes
    // them a little) with windage from the heads flying over the surface. FASTRAND: its two big drums at 14.7 Hz, a
    // rumble the rotation modulates, low harmonics, and the head carriage's seeks.
    const wallX = -ROOM.w / 2 - 0.6;
    const fh = source("fh432", new THREE.Vector3(wallX, 1.0, -1.6), 0.8, 0.55, 1400);
    const drumWave = wave(ctx, [1, 0.4, 0.25, 0.1]);
    for (const hz of [FH432_HZ * 0.9996, FH432_HZ, FH432_HZ * 1.0005]) { const o = osc(drumWave, hz), og = gain(0.03); o.connect(og).connect(fh.input); }
    { const n = noise(N.pink, 1.5), bp = filt("bandpass", 2200, 0.8), ng = gain(0.35); n.connect(bp).connect(ng).connect(fh.input); }
    const fastrand = source("fastrand", new THREE.Vector3(wallX, 0.8, 1.4), 0.8, 0.6, 1100);
    {
      const n = noise(N.brown, 1), lp = filt("lowpass", 180, 0.6), am = gain(0.7); n.connect(lp).connect(am).connect(fastrand.input);
      const rot = osc("sine", FASTRAND_HZ), depth = gain(0.3); rot.connect(depth).connect(am.gain);
      const h = osc(wave(ctx, [0.3, 0.3, 0.5, 0.6, 0.4, 0.3, 0.2]), FASTRAND_HZ * 3), hg = gain(0.05); h.connect(hg).connect(fastrand.input);
      const n2 = noise(N.pink, 0.7), bp = filt("bandpass", 650, 0.7), ng = gain(0.18); n2.connect(bp).connect(ng).connect(fastrand.input);
    }

    // Tape units: a faint vacuum blower while ready; moving, the reel motors whine at the reels' speed (24
    // commutator bars, ours), the vacuum columns' air churns and the tape hisses past the heads.
    const tapes: Tape[] = [];
    for (const p of this.room.placed) {
      const motion = p.equipment.anchors.motion as Tape["motion"] | undefined;
      if (!motion) continue;
      const s = source(p.name, this.at(p.equipment, 1.0), 1.0, 1);
      const n = noise(N.pink, 1.4);
      const air = filt("bandpass", 480, 0.7), airG = gain(0.05); n.connect(air).connect(airG).connect(s.input);
      const hb = filt("bandpass", 3200, 0.9), hiss = gain(0); n.connect(hb).connect(hiss).connect(s.input);
      const motorG = gain(0), mlp = filt("lowpass", 1200, 1.2); mlp.connect(motorG).connect(s.input);
      const motor: [OscillatorNode, OscillatorNode] = [osc("sawtooth", 40), osc("sawtooth", 40)];
      motor.forEach(o => o.connect(mlp));
      tapes.push({ src: s, eq: p.equipment, motion, motor, motorG, air, airG, hiss, moving: false, lastShot: 0 });
    }

    // Fluorescent ballasts, ours: magnetic ballasts hum at twice the mains frequency (120 Hz) with harmonics, one
    // source per troffer row; a strike flickers and buzzes for a moment.
    const ballast = osc(wave(ctx, [1, 0.5, 0.3, 0.2, 0.12, 0.08]), 2 * MAINS);
    const buzzOsc = osc(wave(ctx, Array.from({ length: 24 }, (_, i) => 0.6 / (i + 1))), 2 * MAINS);
    const lit = this.lightsOn();
    const rows = TROFFERS.rows.map((z, i) => {
      const s = source(`troffers-${i}`, new THREE.Vector3(0, ROOM.h - 0.05, z), 0.8, 1);
      const humG = gain(lit ? 0.012 : 0), buzz = gain(0), lp = filt("lowpass", 2500);
      ballast.connect(humG).connect(s.input); buzzOsc.connect(lp).connect(buzz).connect(s.input);
      return { src: s, hum: humG, buzz };
    });

    this.g = { ctx, dest, master, wet, analyser, srcs, tapes, rows, fastrand, nodes, lit, nextSeek: ctx.currentTime + 3 };
  }

  /** One step: the listener, the duck, the tape units, the lights and the FASTRAND's idle seeks. */
  step(dt: number): void {
    const g = this.g;
    if (!g) return;
    const ctx = g.ctx, t = ctx.currentTime, L = ctx.listener;
    this.camera.updateMatrixWorld();
    const e = this.camera.matrixWorld.elements, p = this.v.setFromMatrixPosition(this.camera.matrixWorld);
    const set = (a: AudioParam, v: number, tc = 0.05) => a.setTargetAtTime(v, t, tc);
    if (L.positionX) {
      set(L.positionX, p.x); set(L.positionY, p.y); set(L.positionZ, p.z);
      set(L.forwardX, -e[8]); set(L.forwardY, -e[9]); set(L.forwardZ, -e[10]);
      set(L.upX, e[4]); set(L.upY, e[5]); set(L.upZ, e[6]);
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]); }
    set(g.master.gain, this.duck(), 0.25);

    for (const u of g.tapes) {
      const m = u.motion, sp = Math.abs(m.v) / TAPE_SPEED;   // 1 reading, 2 rewinding
      const moving = sp > 0.02;
      u.motor.forEach((o, i) => set(o.frequency, Math.max(20, Math.abs(i ? m.w1 : m.w0) / (2 * Math.PI) * 24), 0.03));
      set(u.motorG.gain, 0.05 * Math.pow(Math.min(sp, 2.2), 1.5), 0.04);
      set(u.hiss.gain, 0.12 * Math.min(sp, 2), 0.04);
      set(u.airG.gain, 0.05 + 0.18 * Math.min(sp, 2), 0.08);
      set(u.air.frequency, 480 + 220 * Math.min(sp, 2), 0.1);
      if (moving !== u.moving && t - u.lastShot > 0.12) {   // the capstan's pinch and the reels' brakes
        u.lastShot = t;
        if (moving) { this.shot(() => knock(ctx, u.src.input, t, 85, 45, 0.07, 0.25)); this.shot(() => click(ctx, u.src.input, t, 1600, 2, 0.015, 0.12, this.r())); }
        else this.shot(() => knock(ctx, u.src.input, t, 65, 40, 0.05, 0.12));
      }
      u.moving = moving;
    }

    const lit = this.lightsOn();
    if (lit !== g.lit) {
      g.lit = lit;
      g.rows.forEach((row, i) => {
        const a = row.hum.gain, b = row.buzz.gain;
        a.cancelScheduledValues(t); b.cancelScheduledValues(t);
        if (!lit) { a.setTargetAtTime(0, t, 0.02); this.shot(() => click(ctx, row.src.input, t, 2400, 3, 0.01, 0.04, this.r())); return; }
        // A strike: the starter's tick, a few flickers with a buzz, then the steady hum (timings ours).
        let s = t + 0.08 + i * 0.11 + this.r() * 0.25;
        this.shot(() => click(ctx, row.src.input, s, 2800, 4, 0.012, 0.1, this.r()));
        for (let k = 0; k < 3 + Math.floor(this.r() * 3); k++) {
          a.setValueAtTime(0.012 * (0.2 + this.r() * 0.8), s); b.setValueAtTime(0.02, s);
          s += 0.04 + this.r() * 0.08;
          a.setValueAtTime(0.001, s); b.setValueAtTime(0.004, s);
          s += 0.03 + this.r() * 0.06;
        }
        a.setTargetAtTime(0.012, s, 0.05); b.setTargetAtTime(0, s, 0.1);
      });
    }

    if (t >= g.nextSeek) { this.seeks(1 + Math.floor(this.r() * 3)); g.nextSeek = t + 4 + this.r() * 11; }   // the executive's traffic, ours
  }

  /** Page events: an engine run sets the FASTRAND seeking (the tape units take it from their own models). */
  event(e: LabEvent): void { if (e.type === "tape") this.seeks(6 + Math.floor(this.r() * 9)); }

  /** For tests: what is built, the master's RMS (dBFS) and each source's gain at the listener (inverse law). */
  get info() {
    const g = this.g;
    if (!g) return { built: false };
    const d = new Float32Array(g.analyser.fftSize); g.analyser.getFloatTimeDomainData(d);
    let e = 0; for (const x of d) e += x * x;
    const p = this.v.setFromMatrixPosition(this.camera.matrixWorld);
    const at = (s: Src) => { const r = Math.max(1, p.distanceTo(s.pos)); return 1 / (1 + s.panner.rolloffFactor * (r - 1)); };
    return {
      built: true, sources: g.nodes.length, panners: g.srcs.length, shots: this.shots, master: g.master.gain.value,
      rmsDb: 10 * Math.log10(e / d.length + 1e-12), lit: g.lit,
      tapes: g.tapes.map(u => ({ name: u.src.name, v: u.motion.v, motor: u.motorG.gain.value, hiss: u.hiss.gain.value, atListener: at(u.src) })),
      at: Object.fromEntries(g.srcs.map(s => [s.name, at(s)])),
    };
  }

  dispose(): void {
    clearInterval(this.timer); this.timer = 0;
    this.detach();
    this.bedOff?.(true); this.bedOff = null;
  }

  private detach(): void {
    const g = this.g;
    if (!g) return;
    for (const n of g.nodes) { try { n.stop(); } catch { /* already stopped */ } }
    g.master.disconnect();
    this.g = null;
  }

  /** A burst of FASTRAND head seeks: each a 30-86 ms carriage move ending in a knock and a click. */
  private seeks(n: number): void {
    const g = this.g;
    if (!g) return;
    let t = g.ctx.currentTime + 0.05;
    for (let k = 0; k < n; k++) {
      t += (SEEK_MS[0] + this.r() * (SEEK_MS[1] - SEEK_MS[0])) / 1000 + this.r() * 0.25;
      const at = t;
      this.shot(() => knock(g.ctx, g.fastrand.input, at, 110, 55, 0.06, 0.35));
      this.shot(() => click(g.ctx, g.fastrand.input, at + 0.004, 900, 2, 0.02, 0.15, this.r()));
    }
  }

  /** Play a one-shot unless MAX_SHOTS are sounding (each counted for 0.15 s). */
  private shot(play: () => void): void {
    if (this.shots >= MAX_SHOTS) return;
    this.shots++; play();
    setTimeout(() => { this.shots--; }, 150);
  }

  private duck(): number { return this.shown() ? 1 : Math.pow(10, DUCK_DB / 20); }

  /** The room's light switch (room.lightsOn, when the room has one; on otherwise). */
  private lightsOn(): boolean { return (this.room as { lightsOn?: boolean }).lightsOn ?? true; }

  /** A placed equipment's position in the room at height y. */
  private at(eq: Equipment, y: number): THREE.Vector3 {
    eq.object.updateMatrixWorld();
    const v = new THREE.Vector3().setFromMatrixPosition(eq.object.matrixWorld); v.y = y; return v;
  }
}
