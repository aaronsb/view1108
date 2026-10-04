// Main loop, status line and the 16 fps film rate.
"use strict";
// ---- main loop ----
function step(now) {
  const dt = last ? Math.min(0.25, (now - last) / 1000) : 0; last = now;
  if (mode === "attract" || mode === "tour") autoStep(dt);
  else if (mode === "live") { if (playing) get = Math.max(LIVE_MIN, Math.min(LIVE_MAX, get + dt * LIVE_RATES[liveIdx])); liveSync(); }
  else if (mode === "beam") {   // time advances one frame per completed trace, by the real time it took x the rate
    beamNew = now >= beamNextStart;
    // the clock never runs ahead of the drawing: each frame steps mission time by the real time the previous frame took
    // (trace plus any 1108 pause) at 1x, whatever the free-look rate is; it changes only when a new frame starts
    if (beamNew) { if (beamPrevCompute) get += (now - beamPrevCompute) / 1000; beamPrevCompute = now; beamFrameNo++; }
  }
  else if (playing) get += dt * SPEEDS[speedIdx];
  wr("in_get", get); wr("in_yaw", yaw); wr("in_pitch", pitch); wr("in_roll", roll); wr("in_fov", fov);
  wi("in_flags", 1 | (frame ? 2 : 0) | (hidden ? 4 : 0) | simFlags() | cabinFlag() | wallsFlag()); featInputs();   // labels always requested: the NAV catalog needs the 37 named stars
  if (mode !== "beam" || beamNew) K.view_frame();
  draw(now); beamNew = false; updateStatus(); simTick(); featTick();
  const sc = document.getElementById("scrub"), gi = document.getElementById("geti");
  if (mode === "live") { sc.min = LIVE_MIN; sc.max = LIVE_MAX; } else { sc.min = -7200; sc.max = 7200; }
  if (document.activeElement !== sc) sc.value = mode === "live" ? get : Math.max(-7200, Math.min(7200, get - get0));
  if (document.activeElement !== gi) gi.value = getStr(get);
  document.getElementById("utc").textContent = "UTC " + utcStr(get);
}
let lastStatus = "", flashMsg = "", flashUntil = 0;
const flash = m => { flashMsg = m; flashUntil = performance.now() + 1800; };
function updateStatus() {
  const rate = mode === "beam" ? `${BEAM_SPEEDS[beamIdx].name} ${BEAM_SPEEDS[beamIdx].vps ? BEAM_SPEEDS[beamIdx].vps + " VEC/S" : "1/15 S FRAME"}` : mode === "live" ? LIVE_RATES[liveIdx] + "X" : mode === "free" ? (playing ? SPEEDS[speedIdx] + "X" : "HOLD") : "AUTO";
  const t = (performance.now() < flashUntil ? flashMsg + "  " : "") + `${epoch ? (SCENE_MISSION[scene] || "OTHER MISSION") + "  " : ""}MODE ${mode}  G.E.T. ${getStr(get)}  UTC ${utcStr(get)}  ${mode === "beam" ? "FRAME " + beamFrameNo + "  " : ""}${rate}  BLOOM ${effBloom() ? "ON" : "OFF"}  JITTER ${effJit() ? "ON" : "OFF"}  DUST ${effDust() ? "ON" : "OFF"}  STARS ${effCatalog().toUpperCase()}${effFps() ? "  16 FPS" : ""}`;
  if (t !== lastStatus) { lastStatus = t; document.getElementById("status").textContent = t; }
}
// Film rate: with the toggle on, the kernel is stepped and a frame presented only every 1/16 s and held in between
// (time keeps running in real time because step() works from the elapsed time).
let lastPresent = 0;
function tick(now) {
  if (!canvasTab()) { last = now; requestAnimationFrame(tick); return; }   // Source: no kernel frames, time holds
  if (effFps()) {
    if (now - lastPresent < 1000 / 16 - 2) { requestAnimationFrame(tick); return; }
    lastPresent = now - lastPresent > 125 ? now : lastPresent + 1000 / 16;
  }
  step(now); requestAnimationFrame(tick);
}
