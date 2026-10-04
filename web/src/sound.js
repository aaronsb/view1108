// Sound: a machine-room ambience and the recorder's, tape drive's and keyboard's noises, synthesized with WebAudio
// (no samples). All of it is our invention, not a recording or a description of the 1108 installation or the film
// recorder: neither report says what they sounded like. Off by default; the choice is remembered.
"use strict";
// One AudioContext and one master gain for the page, created on the first gesture that needs them; other modules may
// connect to sndOut once sndStart() has run.
let sndCtx = null, sndOut = null, sndOn = false, sndNoiseBuf = null;
try { sndOn = localStorage.getItem("view1108.sound") === "1"; } catch (e) { /* storage unavailable */ }
const SND_OK = !!(window.AudioContext || window.webkitAudioContext);
const sndLive = () => sndOn && sndCtx && sndCtx.state === "running";

// Looping noise, lowpassed by a leaky integrator; the first 0.1 s is crossfaded with the samples past the end, so
// the loop has no seam.
function sndNoise(ctx) {
  if (sndNoiseBuf && sndNoiseBuf.sampleRate === ctx.sampleRate) return sndNoiseBuf;
  const sr = ctx.sampleRate, L = sr * 4, N = sr / 10 | 0, x = new Float32Array(L + N);
  let v = 0; for (let i = 0; i < x.length; i++) x[i] = v = v * 0.97 + (Math.random() * 2 - 1) * 0.12;
  const b = ctx.createBuffer(1, L, sr), d = b.getChannelData(0);
  for (let i = 0; i < L; i++) d[i] = i < N ? x[i] * (i / N) + x[L + i] * (1 - i / N) : x[i];
  return sndNoiseBuf = b;
}
// The bed into dest: air handling (low noise whose cutoff wanders) and a cooling fan's blade tone, two detuned
// partials that beat slowly and drift in pitch. Takes any BaseAudioContext, so it can be rendered offline.
function sndBed(ctx, dest) {
  const lfo = (hz, depth, param) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g).connect(param); o.start(); };
  const air = ctx.createBufferSource(); air.buffer = sndNoise(ctx); air.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320; lp.Q.value = 0.4;
  const ag = ctx.createGain(); ag.gain.value = 0.55;
  air.connect(lp).connect(ag).connect(dest); air.start();
  lfo(0.043, 70, lp.frequency); lfo(0.071, 0.12, ag.gain);
  const fan = ctx.createGain(); fan.gain.value = 0.018;
  const flp = ctx.createBiquadFilter(); flp.type = "lowpass"; flp.frequency.value = 600;
  fan.connect(flp).connect(dest);
  for (const [f, a] of [[118, 1], [118.6, 0.6], [236.4, 0.25]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.frequency.value = f; g.gain.value = a;
    o.connect(g).connect(fan); o.start(); lfo(0.021, f * 0.008, o.frequency);
  }
  // fan hiss: a little noise around 1.4 kHz
  const hs = ctx.createBufferSource(); hs.buffer = sndNoise(ctx); hs.loop = true; hs.playbackRate.value = 3.1;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 0.7;
  const hg = ctx.createGain(); hg.gain.value = 0.05;
  hs.connect(bp).connect(hg).connect(dest); hs.start();
}
function sndStart() {
  if (!SND_OK) return;
  if (!sndCtx) {
    sndCtx = new (window.AudioContext || window.webkitAudioContext)();
    sndOut = sndCtx.createGain(); sndOut.gain.value = 0; sndOut.connect(sndCtx.destination);
    const bed = sndCtx.createGain(); bed.gain.value = 0.5; bed.connect(sndOut); sndBed(sndCtx, bed);
  }
  if (!document.hidden) sndCtx.resume();
  sndOut.gain.setTargetAtTime(sndOn ? 0.6 : 0, sndCtx.currentTime, 0.15);
}

// ---- event sounds ----
// A filtered noise burst at time t (audio clock).
function sndBurst(t, freq, q, dur, gain) {
  const s = sndCtx.createBufferSource(); s.buffer = sndNoise(sndCtx); s.playbackRate.value = 4;
  const f = sndCtx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
  const g = sndCtx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(sndOut); s.start(t, Math.random() * 3, dur + 0.02);
}
// A tone from f0 to f1 over dur, with an attack a and a decay to zero.
function sndTone(t, type, f0, f1, dur, gain, a = 0.003) {
  const o = sndCtx.createOscillator(), g = sndCtx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sndOut); o.start(t); o.stop(t + dur + 0.02);
}
// Frame advance: the claw's thump and the shutter's two ticks. at: performance.now() time of the frame's end.
// At most one every 0.4 s, so the fast beam speeds (a frame in 1/15 s) never buzz.
let sndLastFrame = 0;
function soundFrame(at) {
  if (!sndLive()) return;
  const t = Math.max(sndCtx.currentTime, sndCtx.currentTime + (at - performance.now()) / 1000);
  if (t - sndLastFrame < 0.4) return; sndLastFrame = t;
  sndTone(t, "sine", 95, 45, 0.09, 0.35);
  sndBurst(t, 1900, 2, 0.018, 0.25); sndBurst(t + 0.045, 2600, 3, 0.012, 0.15);
}
// Tape drive: a relay, the reels spinning up and down, and the tape's hiss; once per 0.8 s (sim_run is synchronous
// and takes milliseconds, so this is a token whir after the run, not its length).
let sndLastTape = -1;
function soundTape() {
  if (!sndLive() || sndCtx.currentTime - sndLastTape < 0.8) return;
  const t = sndLastTape = sndCtx.currentTime;
  sndBurst(t, 1200, 4, 0.02, 0.3);
  const o = sndCtx.createOscillator(), lp = sndCtx.createBiquadFilter(), g = sndCtx.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(30, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.25);
  o.frequency.setValueAtTime(170, t + 0.55); o.frequency.exponentialRampToValueAtTime(40, t + 0.95);
  lp.type = "lowpass"; lp.frequency.value = 700;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.15); g.gain.setValueAtTime(0.08, t + 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
  o.connect(lp).connect(g).connect(sndOut); o.start(t); o.stop(t + 1.05);
  const s = sndCtx.createBufferSource(); s.buffer = sndNoise(sndCtx); s.playbackRate.value = 6;
  const bp = sndCtx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3000; bp.Q.value = 0.8;
  const sg = sndCtx.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.12, t + 0.25); sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
  s.connect(bp).connect(sg).connect(sndOut); s.start(t, 0, 1);
  sndBurst(t + 1, 1000, 4, 0.02, 0.2);
}
// Key click: a short high burst, at most one per 30 ms (120 ms on auto-repeat).
let sndLastKey = 0;
function soundKey(repeat) {
  if (!sndLive()) return;
  const t = sndCtx.currentTime; if (t - sndLastKey < (repeat ? 0.12 : 0.03)) return; sndLastKey = t;
  sndBurst(t, 3200 + Math.random() * 600, 1.5, 0.014, 0.12);
}

// ---- toggle: the button, key M and the stored choice ----
function syncSound() { const b = $("bsound"); b.textContent = sndOn ? "Sound on" : "Sound off"; b.classList.toggle("on", sndOn); }
function toggleSound() {
  sndOn = !sndOn;
  try { localStorage.setItem("view1108.sound", sndOn ? "1" : "0"); } catch (e) { /* ignore */ }
  syncSound();
  if (sndOn) sndStart();
  else if (sndCtx) { sndOut.gain.setTargetAtTime(0, sndCtx.currentTime, 0.05); setTimeout(() => { if (!sndOn) sndCtx.suspend(); }, 300); }
}
$("bsound").onclick = toggleSound;
if (!SND_OK) { $("bsound").disabled = true; $("bsound").title = "This browser has no Web Audio"; }
syncSound();
// Browsers start audio only after a gesture: with sound remembered on, the first click or key starts it (and it
// starts at once where autoplay is allowed). Clicks and keys also make the key click.
if (sndOn && SND_OK) sndStart();
window.addEventListener("pointerdown", e => { if (sndOn && sndCtx && sndCtx.state !== "running") sndStart(); if (e.target.closest("button")) soundKey(false); }, { capture: true });
window.addEventListener("keydown", e => {
  if (sndOn && (!sndCtx || sndCtx.state !== "running")) sndStart();
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  soundKey(e.repeat);
  if ((e.key === "m" || e.key === "M") && canvasTab() && !typingIn() && !$("list").classList.contains("open")) { toggleSound(); e.preventDefault(); e.stopImmediatePropagation(); }   // not a look key: Attract keeps playing
}, { capture: true });
document.addEventListener("visibilitychange", () => { if (!sndCtx || !sndOn) return; if (document.hidden) sndCtx.suspend(); else sndStart(); });
