// Building blocks for the machine room's sound, made in code (no samples): looping noise buffers, periodic waves,
// a small room's impulse response and short one-shot knocks and clicks. Everything takes a BaseAudioContext, so the
// room can be rendered offline as well as live. The approach follows progression's src/render/sound.ts (MIT, same
// author): filtered noise and oscillators.

export interface Noises { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer }

const cache = new WeakMap<BaseAudioContext, Noises>();

/** A seeded generator (xorshift), so a render is repeatable. */
export function rng(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

/** A looping mono buffer of `sec` seconds from gen(), its first 0.1 s crossfaded with the samples past the end so
 *  the loop has no seam, scaled to an RMS of 0.2. */
function loopBuf(ctx: BaseAudioContext, sec: number, gen: () => number): AudioBuffer {
  const sr = ctx.sampleRate, L = Math.floor(sr * sec), N = Math.floor(sr / 10), x = new Float32Array(L + N);
  for (let i = 0; i < x.length; i++) x[i] = gen();
  const b = ctx.createBuffer(1, L, sr), d = b.getChannelData(0);
  let e = 0;
  for (let i = 0; i < L; i++) { d[i] = i < N ? x[i] * (i / N) + x[L + i] * (1 - i / N) : x[i]; e += d[i] * d[i]; }
  const k = 0.2 / Math.sqrt(e / L || 1);
  for (let i = 0; i < L; i++) d[i] *= k;
  return b;
}

/** White, pink (Paul Kellet's filter) and brown (leaky integrator) noise, 5 s each, made once per context. Sources
 *  start them at different offsets and rates so they do not correlate. */
export function noises(ctx: BaseAudioContext): Noises {
  let n = cache.get(ctx);
  if (n) return n;
  const r = rng(4046);
  const w = () => r() * 2 - 1;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
  const pink = () => {
    const x = w();
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
    const y = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362; b6 = x * 0.115926; return y;
  };
  const brown = () => (br = br * 0.996 + w() * 0.06);
  n = { white: loopBuf(ctx, 5, w), pink: loopBuf(ctx, 5, pink), brown: loopBuf(ctx, 5, brown) };
  cache.set(ctx, n);
  return n;
}

/** A periodic wave from harmonic amplitudes (index 1 the fundamental), sine phase. */
export function wave(ctx: BaseAudioContext, amps: number[]): PeriodicWave {
  const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1);
  amps.forEach((a, i) => { im[i + 1] = a; });
  return ctx.createPeriodicWave(re, im);
}

/** A stereo impulse response for a small, damped room: a few early reflections, then decorrelated noise decaying to
 *  -60 dB in rt60 seconds and darkening as it goes. Ours: an 8 x 6 x 2.75 m room with an acoustic-tile ceiling and
 *  a hard raised floor, guessed at 0.45 s. */
export function roomIR(ctx: BaseAudioContext, rt60 = 0.45): AudioBuffer {
  const sr = ctx.sampleRate, L = Math.floor(sr * rt60 * 1.6), b = ctx.createBuffer(2, L, sr), r = rng(1969);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < L; i++) {
      const t = i / sr, a = 0.35 + 0.55 * Math.min(1, t / rt60);   // the one-pole's pole: darker with time
      lp = lp * a + (r() * 2 - 1) * (1 - a);
      d[i] = lp * Math.exp(-6.91 * t / rt60) * Math.min(1, t / 0.006);
    }
    for (const ms of [4.1, 7.3, 9.8, 13.4, 17.9, 23.5]) d[Math.floor(ms / 1000 * sr) + ch * 7] += (r() < 0.5 ? -1 : 1) * (0.5 - ms / 60);
  }
  return b;
}

/** A pitch-falling sine knock at t into dest (a motor start, a head carriage stopping). */
export function knock(ctx: BaseAudioContext, dest: AudioNode, t: number, f0: number, f1: number, dur: number, gain: number): void {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
}

/** A band-passed noise click at t into dest (a relay, a pinch roller, a tube striking). */
export function click(ctx: BaseAudioContext, dest: AudioNode, t: number, freq: number, q: number, dur: number, gain: number, seed = Math.random()): void {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noises(ctx).white; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest); s.start(t, seed * 4, dur + 0.02);
}
