// Main loop, status line and the 16 fps film rate.
"use strict";
// ---- main loop ----
function step(now) {
  const dt = last ? Math.min(0.25, (now - last) / 1000) : 0; last = now;
  if (LS.mode === "attract" || LS.mode === "tour") autoStep(dt);
  else if (LS.mode === "live") { if (LS.playing) track({ get: Math.max(LIVE_MIN, Math.min(LIVE_MAX, LS.get + dt * LIVE_RATES[liveIdx])) }); liveSync(); }
  else if (LS.mode === "beam") {   // time advances one frame per completed trace, by the real time it took x the rate
    beamNew = now >= beamNextStart;
    // the clock never runs ahead of the drawing: each frame steps mission time by the real time the previous frame took
    // (trace plus any 1108 pause) at 1x, whatever the free-look rate is; it changes only when a new frame starts
    if (beamNew) { if (beamPrevCompute) track({ get: LS.get + (now - beamPrevCompute) / 1000 }); beamPrevCompute = now; beamFrameNo++; }
  }
  else if (LS.playing) track({ get: LS.get + dt * SPEEDS[speedIdx] });
  wr("in_get", LS.get); wr("in_yaw", LS.yaw); wr("in_pitch", LS.pitch); wr("in_roll", LS.roll); wr("in_fov", LS.fov);
  wi("in_flags", 1 | (frame ? 2 : 0) | (hidden ? 4 : 0) | simFlags() | cabinFlag() | wallsFlag()); featInputs();   // labels always requested: the NAV catalog needs the 37 named stars
  if (LS.mode !== "beam" || beamNew) { K.view_frame(); whineFrame(); }
  draw(now); beamNew = false; updateStatus(); simTick(); featTick();
  const sc = document.getElementById("scrub"), gi = document.getElementById("geti");
  if (LS.mode === "live") { sc.min = LIVE_MIN; sc.max = LIVE_MAX; } else { sc.min = -7200; sc.max = 7200; }
  if (document.activeElement !== sc) sc.value = LS.mode === "live" ? LS.get : Math.max(-7200, Math.min(7200, LS.get - LS.get0));
  if (document.activeElement !== gi) gi.value = getStr(LS.get);
  document.getElementById("utc").textContent = "UTC " + utcStr(LS.get);
}
let lastStatus = "", flashMsg = "", flashUntil = 0;
const flash = m => { flashMsg = m; flashUntil = performance.now() + 1800; };
function updateStatus() {
  const rate = LS.mode === "beam" ? `${BEAM_SPEEDS[beamIdx].name} ${BEAM_SPEEDS[beamIdx].vps ? BEAM_SPEEDS[beamIdx].vps + " VEC/S" : "1/15 S FRAME"}` : LS.mode === "live" ? LIVE_RATES[liveIdx] + "X" : LS.mode === "free" ? (LS.playing ? SPEEDS[speedIdx] + "X" : "HOLD") : "AUTO";
  const t = (performance.now() < flashUntil ? flashMsg + "  " : "") + `${LS.epoch ? (LS.mission || "OTHER MISSION") + "  " : ""}MODE ${LS.mode}  G.E.T. ${getStr(LS.get)}  UTC ${utcStr(LS.get)}  ${LS.mode === "beam" ? "FRAME " + beamFrameNo + "  " : ""}${rate}  ${isFilm() ? `BLOOM ${effBloom() ? "ON" : "OFF"}  JITTER ${effJit() ? "ON" : "OFF"}  DUST ${effDust() ? "ON" : "OFF"}` : `SCOPE ${scopeHz() === "16" ? "16 HZ" : "STEADY"}`}  STARS ${effCatalog().toUpperCase()}${effFps() ? "  16 FPS" : ""}`;
  if (t !== lastStatus) { lastStatus = t; document.getElementById("status").textContent = t; }
}
// Film rate: with the toggle on, the kernel is stepped and a frame presented only every 1/16 s and held in between
// (time keeps running in real time because step() works from the elapsed time). While the room is shown (room.js)
// the plot is the vector terminal's screen: kernel frames run at the film rate on every tab, Source included, and on a
// SCOPE at 16 Hz the latest is redrawn at the display's rate in between (beam.js scopeRender; the room's texture
// follows each draw). Elsewhere a SCOPE has no film rate, so every tick is a kernel frame and a draw.
let lastPresent = 0;
function tick(now) {
  if (!canvasTab() && !roomShown) { last = now; requestAnimationFrame(tick); return; }   // Source: no kernel frames, time holds
  if (effFps() || roomShown) {
    if (now - lastPresent < 1000 / 16 - 2) { if (drawn && scopeLive()) draw(now); requestAnimationFrame(tick); return; }
    lastPresent = now - lastPresent > 125 ? now : lastPresent + 1000 / 16;
  }
  step(now); requestAnimationFrame(tick);
}
