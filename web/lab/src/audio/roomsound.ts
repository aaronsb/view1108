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
const WHINE_ROLLOFF = 4;       // the 1558's whine: -22 dB at the overview (4.1 m), -10 dB at 1.5 m

// The drums (UP-4046 rev. 3): FH-432 7,200 rev/min (p. 8-5), FH-1782 1,800 rev/min (p. 8-6), FASTRAND II 880 rev/min
// (p. 8-10), its 64 heads moved together in 30 to 86 ms (p. 8-8). The minimum 1108 system has three FH-432 drums (or
// one FH-1782) and one FASTRAND (sec. 5, p. 5-3); we give the room that: three FH-432 and a FASTRAND II, heard from
// inside the compute row, the FH-432s in its second cabinet and the FASTRAND in its fourth (our placement: no source
// places MSC's drums, and we cannot find them in the MSC photograph).
const FH432_HZ = 7200 / 60, FASTRAND_HZ = 880 / 60;
const SEEK_MS: [number, number] = [30, 86];

const TAPE_SPEED = 120 * 0.0254;   // m/s (UP-4046 sec. 8.4.2)

// The microfilm recorder, all ours (no source names MSC's recorder or describes its sound): a film-transport motor
// (1,800 rev/min, a 4-pole synchronous motor on 60 Hz, with a 12-tooth gear) that spins up and down over about a
// second, its own small plot-tape transport reading a block before each frame, and per frame a shutter tick, the
// claw's pull-down clatter and the transport's stop.
const REC_MOTOR_HZ = 1800 / 60, REC_GEAR_TEETH = 12, REC_SELF_S: [number, number] = [1.2, 1.8], REC_MIN_S = 0.35;
type Whine = { scope: AudioNode; recorder: AudioNode };
interface Recorder { src: Src; motor: OscillatorNode; gear: OscillatorNode; motorG: GainNode; reels: [OscillatorNode, OscillatorNode]; reelG: GainNode; active: boolean; last: number; next: number }

/** A positioned source: its input (the dry level) feeds the panner and a send to the room response. */
interface Src { name: string; input: GainNode; panner: PannerNode; pos: THREE.Vector3 }
interface Tape { src: Src; eq: Equipment; motion: { v: number; w0: number; w1: number }; motor: [OscillatorNode, OscillatorNode]; motorG: GainNode; air: BiquadFilterNode; airG: GainNode; hiss: GainNode; moving: boolean; lastShot: number }
interface Graph {
  ctx: BaseAudioContext; dest: AudioNode; master: GainNode; wet: GainNode; analyser: AnalyserNode;
  srcs: Src[]; tapes: Tape[]; rows: { src: Src; hum: GainNode; buzz: GainNode }[]; fastrand: Src;
  rec: Recorder | null; nodes: AudioScheduledSourceNode[]; lit: boolean; nextSeek: number; whine: Whine | null; printerIn: AudioNode | null;
  panel: { src: Src; state: { open: boolean; sel: number }; open: boolean; sel: number } | null;
}

export class RoomSound {
  private g: Graph | null = null;
  private timer = 0;
  private last = 0;
  private shots = 0;
  private r = rng(1108);
  private bedOff: ((on: boolean) => void) | null = null;
  private printerRoute: ((node: AudioNode | null) => void) | null = null;
  private v = new THREE.Vector3();
  private foot = 1;
  private steps = 0;              // footsteps played, for tests

  /** `auto` runs the live loop (STEP_S) against the page's context; without it the caller attaches and steps. */
  constructor(private room: Room, private camera: THREE.Camera, private state: () => LabState, private shown: () => boolean, auto = true) {
    if (auto) this.timer = window.setInterval(this.live, STEP_S * 1000);
  }

  /** Live loop: build on the page's context once sound is on, then step. */
  private live = () => {
    const s = this.state(), ctx = s.sound.ctx, out = s.sound.out;
    if (!ctx || !out || !s.sound.on) return;
    if (!this.g || this.g.ctx !== ctx) {
      this.attach(ctx, out, s.sound.whine ?? null);
      this.bedOff = s.sound.bed ?? null; this.bedOff?.(false);
      this.printerRoute = s.sound.printer ?? null; this.printerRoute?.(this.g!.printerIn);
    }
    if (ctx.state !== "running") { this.last = 0; return; }
    const now = performance.now(), dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : STEP_S;
    this.last = now;
    if (!this.shown()) for (const t of this.g!.tapes) t.eq.update?.(dt, s);   // the lab's frame loop is stopped
    this.step(dt);
  };

  /** Build the whole graph on ctx into dest; `whine` is the deflection whine's outputs (web/src/whine.js), if any. */
  attach(ctx: BaseAudioContext, dest: AudioNode, whine: Whine | null = null): void {
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
    /** A source at pos; `rolloff` for the inverse distance law (refDistance 1 m), `through` a wall's low-pass, `send`
     *  into the room response. */
    const source = (name: string, pos: THREE.Vector3, rolloff: number, level = 1, through = 0, send = true): Src => {
      const input = gain(level), panner = ctx.createPanner();
      Object.assign(panner, { panningModel: "equalpower", distanceModel: "inverse", refDistance: 1, maxDistance: 20, rolloffFactor: rolloff });
      panner.positionX.value = pos.x; panner.positionY.value = pos.y; panner.positionZ.value = pos.z;
      let head: AudioNode = input;
      if (through) { const lp = filt("lowpass", through); input.connect(lp); head = lp; }
      head.connect(panner).connect(master); if (send) head.connect(wet);
      const s = { name, input, panner, pos }; srcs.push(s); return s;
    };
    /** A bank of slow drifts, shared: a few very low oscillators that sources tap for amplitude wander. */
    const drift = [0.031, 0.053, 0.089, 0.137].map(hz => osc("sine", hz));
    const wander = (param: AudioParam, depth: number, k: number) => { const d = gain(depth); drift[k % drift.length].connect(d).connect(param); };

    // Air handling, ours: conditioned air into the room through ceiling diffusers and the raised floor's perforated
    // tiles. Pink noise low-passed for the plenum's rumble (most of it under 120 Hz) and band-passed for the
    // diffusers' hiss; levels wander slowly.
    const air: [string, THREE.Vector3, number, number, number][] = [
      ["diffuser-nw", new THREE.Vector3(-3.2, ROOM.h, -2.0), 900, 0.8, 0.55],
      ["diffuser-ne", new THREE.Vector3(3.2, ROOM.h, -2.0), 1000, 0.8, 0.55],
      ["diffuser-s", new THREE.Vector3(0, ROOM.h, 2.3), 850, 0.8, 0.55],
      ["floor-tapes", new THREE.Vector3(-3.4, 0.05, -3.4), 500, 1.0, 0.4],
      ["floor-cpu", new THREE.Vector3(-5.0, 0.05, 1.2), 450, 1.0, 0.4],
    ];
    air.forEach(([name, pos, hiss, rumble, hissLvl], k) => {
      const s = source(name, pos, 0.5, 0.55), n = noise(N.pink, 0.8);
      const lp = filt("lowpass", 130, 0.5), rg = gain(rumble); n.connect(lp).connect(rg).connect(s.input); wander(rg.gain, 0.18 * rumble, k);
      const bp = filt("bandpass", hiss, 0.6), hg = gain(hissLvl); n.connect(bp).connect(hg).connect(s.input); wander(hg.gain, 0.06, k + 1);
      wander(lp.frequency, 25, k + 2);
    });

    // Cabinet fans and transformers, ours: each cabinet's fan a blade-pass tone (shaft 3,420-3,480 rev/min, a 2-pole
    // induction motor's 60 Hz less slip; 5 blades, 285-290 Hz, so neighbours beat) over band-limited noise, and a
    // faint mains hum (60 Hz and its harmonics, 120 Hz strongest) from one shared generator, louder at the power
    // cabinet, whose transformers hum; its doors latch and creak when they open and shut, its voltmeter selector clicks
    // into each detent.
    const blade = wave(ctx, [1, 0.35, 0.12, 0.05]);
    const hum = osc(wave(ctx, [0.6, 1, 0.3, 0.25, 0.1, 0.08]), MAINS), humBus = gain(1); hum.connect(humBus);
    let panel: Graph["panel"] = null;
    const cabinets = this.room.placed.filter(p => /^(cpu|power|controller1557|filmrecorder)(-|$)/.test(p.name));
    cabinets.forEach((p, k) => {
      const pos = this.at(p.equipment, p.name === "power" ? 0.8 : 1.5), s = source(p.name, pos, 1.0, 1.0);
      const rpm = 3420 + this.r() * 60, t = osc(blade, rpm / 60 * 5), tg = gain(0.035); t.connect(tg).connect(s.input);
      wander(t.frequency, 0.4, k);
      const n = noise(N.pink, 1.2), bp = filt("bandpass", 1100 + this.r() * 400, 0.5), ng = gain(0.22); n.connect(bp).connect(ng).connect(s.input);
      const hp = filt("lowpass", 800); const hg = gain(p.name === "power" ? 0.13 : 0.05); humBus.connect(hp).connect(hg).connect(s.input);
      const state = p.equipment.anchors.panel as { open: boolean; sel: number } | undefined;
      if (state) panel = { src: s, state, open: state.open, sel: state.sel };
    });

    // Drums in the compute row (the cpu cabinets, north to south), at cabinet height just inside the front, heard
    // through the door panel (a mild low-pass, ours). FH-432: three drums at 120 Hz (slip, ours, detunes them a little)
    // with windage from the heads flying over the surface. FASTRAND: its two big drums at 14.7 Hz, a rumble the
    // rotation modulates, low harmonics, and the head carriage's seeks.
    const row = this.room.placed.filter(p => /^cpu-\d+$/.test(p.name))
      .map(p => (p.equipment.object.updateMatrixWorld(), p.equipment.object.localToWorld(new THREE.Vector3(0, 1.0, 0.3))))
      .sort((a, b) => a.z - b.z);
    const inRow = (k: number, dflt: THREE.Vector3) => row[Math.min(k, row.length - 1)] ?? dflt;
    const PANEL = 4500;
    const fh = source("fh432", inRow(1, new THREE.Vector3(-5.8, 1.0, 0.4)), 1.0, 0.55, PANEL);
    const drumWave = wave(ctx, [1, 0.4, 0.25, 0.1]);
    for (const hz of [FH432_HZ * 0.9996, FH432_HZ, FH432_HZ * 1.0005]) { const o = osc(drumWave, hz), og = gain(0.03); o.connect(og).connect(fh.input); }
    { const n = noise(N.pink, 1.5), bp = filt("bandpass", 2200, 0.8), ng = gain(0.16); n.connect(bp).connect(ng).connect(fh.input); }
    const fastrand = source("fastrand", inRow(3, new THREE.Vector3(-5.8, 1.0, 2.1)), 1.0, 0.6, PANEL);
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

    // The 1558's deflection whine (made by the page from each kernel frame; ours, deliberately faint): at its screen,
    // with a steep distance law and no room response, so it is heard only within about 1.5 m of it.
    const vec = this.room.placed.find(p => p.name === "vector")?.equipment;
    const wh = whine && whine.scope.context === ctx ? whine : null;
    if (wh && vec) {
      const m = vec.anchors.screen?.mesh ?? vec.object, pos = new THREE.Vector3();
      m.updateWorldMatrix(true, false); m.getWorldPosition(pos);
      wh.scope.connect(source("whine-1558", pos, WHINE_ROLLOFF, 1, 0, false).input);
    }

    // The microfilm recorder, when the room has one. Idle, only its cabinet fan (with the cabinets above); running,
    // the parts below. Its CRT's whine comes gated from the page (whine.recorder).
    let rec: Recorder | null = null;
    const fr = this.room.placed.find(p => /^filmrecorder(-|$)/.test(p.name));
    if (fr) {
      const s = source(fr.name + "-transport", this.at(fr.equipment, 1.0), 1.0, 1);
      const motor = osc(wave(ctx, [0.3, 0.6, 0.5, 0.3, 0.15]), REC_MOTOR_HZ * 0.05), gear = osc(wave(ctx, [1, 0.3, 0.1]), REC_MOTOR_HZ * REC_GEAR_TEETH * 0.05);
      const flutter = osc("sine", 5.3), fm = gain(0.12), fg = gain(0.12 * REC_GEAR_TEETH);
      flutter.connect(fm).connect(motor.frequency); flutter.connect(fg).connect(gear.frequency);
      const motorG = gain(0), gg = gain(0.25), mlp = filt("lowpass", 900);
      motor.connect(motorG); gear.connect(gg).connect(motorG); motorG.connect(mlp).connect(s.input);
      const reelG = gain(0), rlp = filt("lowpass", 1000, 1.1);
      const reels: [OscillatorNode, OscillatorNode] = [osc("sawtooth", 60), osc("sawtooth", 60)];
      reels.forEach(o => o.connect(rlp)); rlp.connect(reelG).connect(s.input);
      if (wh) wh.recorder.connect(source(fr.name + "-crt", this.at(fr.equipment, 1.2), WHINE_ROLLOFF, 1, 0, false).input);
      rec = { src: s, motor, gear, motorG, reels, reelG, active: false, last: 0, next: 0 };
    }

    // The line printer: the page makes its sounds (web/src/sound.js, printing the listing); while the room runs they
    // come from here, at the printer, with the room's distance law and response.
    const pr = this.room.placed.find(p => /^printer(-|$)/.test(p.name));
    const printerIn = pr ? source(pr.name + "-print", this.at(pr.equipment, 1.1), 1.0, 1).input : null;

    this.g = { ctx, dest, master, wet, analyser, srcs, tapes, rows, fastrand, rec, nodes, lit, nextSeek: ctx.currentTime + 3, whine: wh, printerIn, panel };
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

    const d = g.panel;   // the power cabinet (ours): its doors' latch and a short low creak of the hinges; the selector's detent
    if (d && d.state.open !== d.open) {
      d.open = d.state.open;
      this.shot(() => click(ctx, d.src.input, t, d.open ? 1900 : 1500, 3, 0.03, 0.25, this.r()));
      this.shot(() => click(ctx, d.src.input, t + 0.05, 420, 6, 0.35, 0.06, this.r()));
      if (!d.open) this.shot(() => knock(ctx, d.src.input, t + 0.85, 140, 70, 0.06, 0.2));
    }
    if (d && d.state.sel !== d.sel) { d.sel = d.state.sel; this.shot(() => click(ctx, d.src.input, t, 3200, 4, 0.012, 0.15, this.r())); }

    const rec = g.rec;
    if (rec) {
      const s = this.state(), on = s.tab === "print" || s.mode === "beam";
      if (on !== rec.active) {   // spin up or down over about a second
        rec.active = on;
        set(rec.motor.frequency, REC_MOTOR_HZ * (on ? 1 : 0.05), on ? 0.3 : 0.4); set(rec.gear.frequency, REC_MOTOR_HZ * REC_GEAR_TEETH * (on ? 1 : 0.05), on ? 0.3 : 0.4);
        set(rec.motorG.gain, on ? 0.15 : 0, on ? 0.25 : 0.35);
        rec.next = t + REC_SELF_S[0];
      }
      // Without Beam's frames (the Print tab), the recorder exposes a frame now and then (ours).
      if (on && s.mode !== "beam" && t >= rec.next) { this.recFrame(t + 0.45); rec.next = t + REC_SELF_S[0] + this.r() * (REC_SELF_S[1] - REC_SELF_S[0]); }
    }

    if (t >= g.nextSeek) { this.seeks(1 + Math.floor(this.r() * 3)); g.nextSeek = t + 4 + this.r() * 11; }   // the executive's traffic, ours
  }

  /** Page events: an engine run sets the FASTRAND seeking (the tape units take it from their own models); a Beam frame
   *  is a frame on the recorder's film. */
  event(e: LabEvent): void {
    if (e.type === "tape") this.seeks(6 + Math.floor(this.r() * 9));
    if (e.type === "beamFrame" && this.g?.rec?.active) this.recFrame(this.g.ctx.currentTime + Math.max(0.3, (e.at - performance.now()) / 1000));
  }

  /** One recorded frame ending at audio time t: the plot tape reads a block before it, then the shutter ticks and the
   *  claw pulls the film down and the transport stops. At most one every REC_MIN_S; timings vary a little (ours). */
  private recFrame(t: number): void {
    const g = this.g, rec = g?.rec;
    if (!g || !rec || t - rec.last < REC_MIN_S) return;
    rec.last = t;
    const ctx = g.ctx, r = this.r, at = rec.src.input;
    const read = 0.12 + r() * 0.15, tb = Math.max(ctx.currentTime, t - read - 0.08);
    rec.reels.forEach((o, i) => { o.frequency.setTargetAtTime(110 + i * 17 + r() * 20, tb, 0.03); });
    rec.reelG.gain.setTargetAtTime(0.02, tb, 0.03); rec.reelG.gain.setTargetAtTime(0, tb + read, 0.03);
    this.shot(() => knock(ctx, at, tb, 75, 45, 0.05, 0.06));
    this.shot(() => click(ctx, at, t, 4200 + r() * 600, 3, 0.008, 0.12, r()));                     // shutter
    for (let k = 0; k < 3; k++) this.shot(() => click(ctx, at, t + 0.03 + k * (0.011 + r() * 0.006), 1300 + r() * 1200, 2.5, 0.012, 0.1, r()));   // claw
    this.shot(() => knock(ctx, at, t + 0.085 + r() * 0.02, 95, 50, 0.06, 0.18));                    // transport stop
  }

  /** For tests: what is built, the master's RMS (dBFS) and each source's gain at the listener (inverse law). */
  get info() {
    const g = this.g;
    if (!g) return { built: false };
    const d = new Float32Array(g.analyser.fftSize); g.analyser.getFloatTimeDomainData(d);
    let e = 0; for (const x of d) e += x * x;
    const p = this.v.setFromMatrixPosition(this.camera.matrixWorld);
    const at = (s: Src) => { const r = Math.max(1, p.distanceTo(s.pos)); return 1 / (1 + s.panner.rolloffFactor * (r - 1)); };
    return {
      built: true, sources: g.nodes.length, panners: g.srcs.length, shots: this.shots, steps: this.steps, master: g.master.gain.value,
      rmsDb: 10 * Math.log10(e / d.length + 1e-12), lit: g.lit,
      tapes: g.tapes.map(u => ({ name: u.src.name, v: u.motion.v, motor: u.motorG.gain.value, hiss: u.hiss.gain.value, atListener: at(u.src) })),
      at: Object.fromEntries(g.srcs.map(s => [s.name, at(s)])),
    };
  }

  dispose(): void {
    clearInterval(this.timer); this.timer = 0;
    this.detach();
    this.bedOff?.(true); this.bedOff = null;
    this.printerRoute?.(null); this.printerRoute = null;
  }

  private detach(): void {
    const g = this.g;
    if (!g) return;
    for (const n of g.nodes) { try { n.stop(); } catch { /* already stopped */ } }
    g.master.disconnect();
    g.whine?.scope.disconnect(); g.whine?.recorder.disconnect();
    this.g = null;
  }

  /** A footstep of the walking viewer (ours): a soft heel-then-toe tap on the raised floor, band-passed noise with a
   *  faint hollow knock (a tile on pedestals, 180-300 Hz), alternating feet with a little variation; quiet, at the
   *  listener, so unpanned. */
  footstep(fast: boolean): void {
    const g = this.g;
    if (!g || g.ctx.state !== "running") return;
    const ctx = g.ctx, t = ctx.currentTime + 0.01, r = this.r, side = (this.foot = -this.foot);
    this.steps++;
    const out = ctx.createGain(), pan = ctx.createStereoPanner();
    out.gain.value = (fast ? 1.25 : 1) * (0.85 + r() * 0.3); pan.pan.value = side * 0.18;
    out.connect(pan).connect(g.master); out.connect(g.wet);
    setTimeout(() => { out.disconnect(); pan.disconnect(); }, 600);
    const heel = 0.022, toe = 0.012, gap = (fast ? 0.055 : 0.075) + r() * 0.02;
    this.shot(() => {
      click(ctx, out, t, 700 + r() * 250, 0.9, 0.06, heel, r());
      knock(ctx, out, t + 0.003, 260 + r() * 40, 180 + r() * 20, 0.09, heel * 0.6);
      click(ctx, out, t + gap, 1500 + r() * 500, 1.1, 0.04, toe, r());
    });
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
