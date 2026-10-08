// The playlist player (#18; docs/systems-model.md, section 3, Reel): plays the mounted playlist reel, LS.reel, from
// its SHOT cards (data/reels/<id>/run.scn, the playlist reel's page.json; config.js REELS). Each shot names a
// situation (its scenario reel and id there, and the page's scene for it; a playlist may cross reels, and mounting
// the shot's scene loads its reel's decks, loader.js mount), an absolute g.e.t. law and its look; the player holds no
// shot list, situation or time of its own.
// Attract is the demo reel and Tour another playlist reel: the page's modes "attract" and "tour" are their ALIASes.
"use strict";
const QP = k => { const m = new RegExp("[?&]" + k + "=([^&]+)").exec(location.search); return m ? m[1] : null; };
// ?film=N: the demo reel held at its second N (screenshots against the film); with it, ?p=from,to (absolute g.e.t. s) replaces
// the shot's time law and ?fov= ?yaw= ?pitch= ?roll= its look, for tuning a shot against the film.
const filmQ = /[?&]film=([\d.]+)/.exec(location.search);
let autoCap = false;   // caption an unframed shot of the demo reel (its CAPTION=YES shots, the added, non-film ones)
let autoT = filmQ ? +filmQ[1] : 0, autoShot = -1, fadeA = 0, shotBase = 0;
const reelOfMode = m => Object.values(REELS).find(r => r.alias === m) || null;
// The mounted reel and its card's flags: FILM (replays the film: unframed shots uncaptioned, the film look on the
// room's AUTO screen) and TAG (text before each caption). Captions and the display read these, never the mode name.
const reelOn = () => REELS[LS.reel] || null;
const filmReel = () => !!(reelOn() && reelOn().film);
const reelTag = () => (reelOn() && reelOn().tag) || "";
const reelLen = r => r.shots.reduce((a, s) => a + s.dur, 0);

// A look law in the shot fraction u (gen_data.py LOOK_LAWS): a number, or [law, a, b].
const LOOK_LAW = {
  LIN: (a, b, u) => a + (b - a) * u,
  SIN: (a, b, u) => a + b * Math.sin(2 * Math.PI * u),
  HAV: (a, b, u) => a + (b - a) * (1 - Math.cos(2 * Math.PI * u)) / 2
};
const lookAt = (x, u) => Array.isArray(x) ? LOOK_LAW[x[0]](x[1], x[2], u) : x;
function lerpTab(t, u) { for (let i = 1; i < t.length; i++) if (u <= t[i][0]) return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * (u - t[i - 1][0]) / (t[i][0] - t[i - 1][0]); return t[t.length - 1][1]; }
// The shot's g.e.t. at fraction u: linear from get[0] to get[1], or (TTE) at less the seconds to go, log-interpolated.
// An ERISE shot's get is offsets from ERFIND's Earthrise, which the kernel exports (out_terise) when the shot's
// situation is set up: shotBase, read at the shot's load. The situation's default g.e.t. is never used.
function shotGet(sh, u) {
  if (sh.tte) return sh.at - Math.exp(lerpTab(sh.tte.map(q => [q[0], Math.log(q[1])]), u));
  const ov = QP("p") && filmQ, g = ov ? QP("p").split(",").map(Number) : sh.get;
  return (ov ? g[0] : shotBase + g[0]) + (g[1] - g[0]) * u;
}
const RE_NMI = 3443.9;
// LIMB: aim the camera at the Earth. Probe the kernel with no look offset and read hdr(11,12), the body centre's plot
// X,Y (deg, valid off-frame); the Earth's angular radius comes from the range. Yaw/pitch then put the limb top at
// plot elevation L, worked out in view angles. Returns that look.
function steerToEarth(L) {
  wr("in_get", LS.get); wr("in_yaw", 0); wr("in_pitch", 0); wr("in_roll", 0); wr("in_fov", 60); wi("in_flags", 0);
  K.view_frame();
  const H = new Float64Array(buf(), K.hdr.value, 16);
  const rho = Math.asin(Math.min(1, RE_NMI / Math.max(RE_NMI, H[2]))) * 180 / Math.PI;
  return { yaw: plotToAngle(H[10], 60), pitch: plotToAngle(H[11], 60) - (plotToAngle(L, 60) - rho) };
}
// Each frame while a playlist reel is mounted: the shot on screen drives the time and look (track); a new shot's
// situation is loaded (loader.js, by="shot"). The reel's clock runs while LS.playing: the drive's STOP holds it where
// it is (drivePlay, below). When the last shot ends the reel's NEXT is mounted, or the reel loops.
function reelStep(dt) {
  const r = REELS[LS.reel], L = r.shots, len = reelLen(r);
  if (!filmQ && LS.playing) autoT += dt;
  if (r.next && !filmQ && autoT >= len) { loadReel(P({ reel: r.next })); return; }
  let t = autoT % len, i = 0;
  while (i < L.length - 1 && t >= L[i].dur) { t -= L[i].dur; i++; }
  const sh = L[i], u = t / sh.dur;
  if (i !== autoShot) {
    autoShot = i; loadReel(P({ by: "shot", scene: sh.scene, labels: LAB_LEVELS[sh.lab], view: sh.view, target: sh.target, frame: sh.frame ? 1 : 0 }));
    shotBase = sh.rule === "ERISE" ? (K.out_terise ? rd("out_terise") : NaN) : 0;   // NaN: a kernel without the export
    capName = sh.name; autoCap = !!sh.cap; syncUI();
  }
  const look = {};
  if (sh.fov) look.fov = sh.fov;
  for (const k of ["yaw", "pitch", "roll"]) if (sh[k] !== undefined) look[k] = lookAt(sh[k], u);
  if (filmQ) for (const k of ["fov", "yaw", "pitch", "roll"]) if (QP(k) !== null) look[k] = +QP(k);
  look.get = shotGet(sh, u);
  track(look);
  if (sh.limb && QP("nosteer") === null) track(steerToEarth(lerpTab(sh.limb, u)));
  fadeA = r.fade ? Math.max(0, 1 - t / r.fade, 1 - (sh.dur - t) / r.fade) : 0;
}

const leaveAttract = () => { if (auto()) loadReel(P({ mode: "free" })); };   // the viewer takes control
// The mounted reel (docs/systems-model.md, section 1: the UNISERVO drive; #20): the playlist reel's TITLE while one
// plays (DEMO, TOUR), else the situation on screen, by its title.
const reelLabel = () => auto() ? REELS[LS.reel].title : sitOf(LS.situation).title || "";
// The drive's STOP/START: the playback clock stops or runs again, through the clock setter (track); the mode, the
// situation and the shot stay. In the room it is the drive (room.js); on the page, Play/Pause, which starts a demo the
// drive stopped (demoHeld) and otherwise, as before, takes control out of it.
// Beam paces its own clock (loop.js), so there the drive has nothing to stop until Beam honours LS.playing.
function drivePlay() { if (LS.mode === "beam") return; track({ playing: !LS.playing }); syncUI(); }
const demoHeld = () => auto() && !LS.playing;
