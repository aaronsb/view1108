// The one loader (#16; docs/systems-model.md, section 4, rules 1 and 2). loadReel(params) is the only code that
// changes the situation, and with it the scenario, mission and epoch, or that jumps the time or the look by command.
// Every way in builds params and calls it: the URL (openLink, link.js), the scene buttons and number keys, the mode
// buttons, Live's phases and jump buttons, Following and the timeline's events, the Attract and Tour shot player,
// the Fusion photo pick, the view and target buttons and the look's reset. Continuous changes inside the loaded
// situation (the clock running, a drag, a key or the wheel on the look, the scrubber) go through track() (state.js).
// Tabs, the room and its terminals only read LS: choosing what is shown never loads anything.
//
// params: a URLSearchParams, or anything with get(k) and has(k); P() makes one from an object. The keys are the URL's
// (docs/modes.md): mode, scene, get, utc, fov, yaw, pitch, roll, rate, bspeed, labels, lab, view, target, cabin,
// walls, frame, hidden, photo. One more, `by`, names the page's own callers whose rule differs from a viewer's pick;
// openLink sets it to "url" and never passes the URL's own:
//   url     a link: the mode (default Attract), its situation, time, look, labels and display flags (applyParams)
//   phase   Live's phase changed: the phase's situation, the time and look kept, the field its own, aimed at the body
//   shot    the Attract or Tour shot changed: its situation at its defaults, with its view, labels and frame
//   follow  Following's span changed, or a timeline event lies outside the view on screen: the span's situation,
//           view, target and field, at a time
//   event   a timeline event inside the view on screen: its time, re-centring the scrubber
//   reset   the look and field back to the situation's own, the time kept
//   source  the state source changed (sim.js): the situation set up again in the kernel, time and look kept
// Without `by` the keys are a viewer's pick: mode (a mode button), then scene (a scene button or key: Live pins it if
// it can, else Free-look; Beam stays), get (a typed time), fov, view, target. mode=live with a scene is a jump button:
// as a link with those keys.
"use strict";
const P = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
const MODES = ["attract", "tour", "live", "free", "beam"];
const pNum = (p, k) => { if (!p.has(k) || p.get(k).trim() === "") return null; const n = Number(p.get(k)); return isFinite(n) ? n : null; };
const pFlag = (p, k) => p.get(k) === "1" ? true : p.get(k) === "0" ? false : null;
const pPick = (p, k, names) => { const v = p.get(k); if (v === null) return null; const i = names.indexOf(v.toLowerCase()); return i >= 0 ? i : /^\d$/.test(v) && +v < names.length ? +v : null; };
// get or utc, read after the situation is mounted: a utc is converted with its scenario's range zero.
const pGet = (p, keys = ["get", "utc"]) => { let g = null; for (const k of keys) if (p.has(k)) { const v = parseGet(p.get(k)); if (v !== null && isFinite(v)) g = v; } return g; };
const clampLive = g => Math.max(LIVE_MIN, Math.min(LIVE_MAX, g));

function loadReel(p) {
  switch (p.get("by")) {
    case "url": loadLink(p); break;
    case "phase": loadPhase(+p.get("scene")); break;
    case "shot": loadShot(p); break;
    case "follow": loadFollow(p); break;
    case "event": loadEvent(pNum(p, "get")); break;
    case "reset": { const g = LS.get; mount(LS.situation); LS.get = g; break; }
    case "source": { const keep = { ...LS }; mount(LS.situation); Object.assign(LS, { get: keep.get, get0: keep.get0, yaw: keep.yaw, pitch: keep.pitch, roll: keep.roll, fov: keep.fov }); break; }
    default: loadPick(p);
  }
  if (p.has("photo")) loadPhoto(p);
}

// ---- steps ----
// Mount situation s: the kernel sets it up (view_init) and its defaults become the look and time. Its scenario,
// mission and epoch come from the generated tables (config.js SITS, SCNS).
function mount(s) {
  const sit = sitOf(s), scn = SCNS[sit.scenario] || {};
  Object.assign(LS, { situation: s, scenario: sit.scenario, mission: scn.mission || "", epoch: scn.epoch || 0, zero: scn.zero || 0 });
  viewInit(s);
  LS.get = LS.get0 = rd("in_get"); LS.yaw = rd("in_yaw"); LS.pitch = rd("in_pitch"); LS.roll = rd("in_roll"); LS.fov = LS.fov0 = rd("in_fov");
}
// A viewer picks situation s. In Live a situation that is no mission phase (a PIN span, the Moon view) is pinned at
// the current time until the viewer scrubs or types a time; elsewhere it opens in Free-look, or stays in Beam.
function pickSituation(s) {
  follow = false;
  if (LS.mode === "live" && LIVE_PINS.includes(s)) {
    const g = LS.get, name = sitCaption(s) || SCENES[s - 1]; livePin = { scene: s, from: -Infinity, until: Infinity, name };
    mount(s); LS.get = g; LS.get0 = g; capName = name; syncUI(); return;
  }
  if (LS.mode !== "beam") LS.mode = "free"; else beamNextStart = 0; capName = ""; mount(s); syncUI();
}
// The mode setter: attract -> tour (loops), live, free, beam. Live mounts the phase of the current time.
function enterMode(m) {
  LS.mode = m; follow = false; autoT = (m === "attract" && filmQ) ? +filmQ[1] : 0; autoShot = -1; fadeA = 0; LS.playing = true;
  if (m === "live") {
    LS.get = clampLive(LS.get); livePin = null;
    const g = LS.get; mount(livePhase(g).scene); LS.get = g; LS.get0 = g; frame = true; LS.labLv = 3; liveSync(); Object.assign(LS, aimAtBody());
  } else if (m === "beam") {
    beamFrames = []; beamNextStart = 0; beamPrevCompute = 0; beamFrameNo = 0; capName = "";
  } else if (m === "free") capName = "";   // from Attract or Tour: the current view and time are kept
  syncUI();
}
// Live at a jump: its situation pinned for the jump's span, from its time.
function jumpLive(j) {
  enterMode("live");
  livePin = { scene: j.scene, from: j.get, until: j.get + j.len, name: j.name };
  mount(j.scene); LS.get = j.get; LS.get0 = LS.get; liveSync(); syncUI();
}
// Live from a link or a jump button: the time, then the phase, except the situations with a pin or a jump.
function loadLive(p, scn) {
  const g = pGet(p); if (g !== null) LS.get = g;
  enterMode("live");
  const j = JUMPS.find(x => x.scene === scn);
  if (LIVE_PINS.includes(scn)) pickSituation(scn);
  else if (j) jumpLive({ ...j, get: g ?? j.get });
}

// ---- by caller ----
// A link (applyParams): everything it names, over the situation mounted at start-up.
function loadLink(p) {
  const md = MODES.includes(p.get("mode")) ? p.get("mode") : "attract";
  if (md === "attract" || md === "tour") { enterMode(md); return; }
  const sc = pNum(p, "scene") === null ? SITS[0].id : Math.round(pNum(p, "scene")), scn = hasScene(sc) ? sc : SITS[0].id;
  const other = String(sitOf(scn).scenario) !== LIVE_SCN;   // another scenario's situation: Live follows its own, so it opens in Free-look
  if (md === "free" || md === "beam" || other) {
    pickSituation(scn); const g = pGet(p); if (g !== null) LS.get = g;
    if (md === "beam") { const b = Math.round(pNum(p, "bspeed") ?? 0); if (b >= 1 && b <= BEAM_SPEEDS.length) beamIdx = b - 1; enterMode("beam"); }
  } else loadLive(p, scn);
  const r = pNum(p, "rate"); if (r !== null) { if (md === "live" && !other && LIVE_RATES.includes(r)) liveIdx = LIVE_RATES.indexOf(r); else if ((md === "free" || other) && SPEEDS.includes(r) && r > 0) speedIdx = SPEEDS.indexOf(r); }
  const f = pNum(p, "fov"); if (f !== null) LS.fov = clampFov(f);
  const y = pNum(p, "yaw"); if (y !== null) LS.yaw = y;
  const pt = pNum(p, "pitch"); if (pt !== null) LS.pitch = Math.max(-90, Math.min(90, pt));
  const rl = pNum(p, "roll"); if (rl !== null) LS.roll = rl;
  if (pFlag(p, "labels") !== null) LS.labLv = pFlag(p, "labels") ? 3 : 0;
  const lb = pNum(p, "lab"); if (lb !== null && lb >= 0 && lb <= 3) LS.labLv = FEAT.lablv ? Math.round(lb) : lb ? 3 : 0;
  const v = pPick(p, "view", VIEWS), t = pPick(p, "target", TARGETS);
  if (FEAT.view && v !== null) LS.view = v;
  if (FEAT.target && t !== null) LS.target = t;
  if (FEAT.cabin && pFlag(p, "cabin") !== null) cabin = pFlag(p, "cabin");
  if (FEAT.walls && pFlag(p, "walls") !== null) walls = pFlag(p, "walls");
  if (pFlag(p, "frame") !== null) frame = pFlag(p, "frame");
  if (pFlag(p, "hidden") !== null) hidden = pFlag(p, "hidden");
}
// A viewer's pick: a mode button, a scene button or key, a jump button, a typed time, the view and target buttons.
function loadPick(p) {
  const m = MODES.includes(p.get("mode")) ? p.get("mode") : null, sc = pNum(p, "scene");
  if (m === "live" && sc !== null) loadLive(p, sc);
  else {
    if (m) enterMode(m);
    if (sc !== null && hasScene(sc)) pickSituation(sc);
    const g = pGet(p);
    if (g !== null) { livePin = null; LS.get = LS.mode === "live" ? clampLive(g) : g; }
  }
  const f = pNum(p, "fov"); if (f !== null) LS.fov = clampFov(f);
  const v = pPick(p, "view", VIEWS), t = pPick(p, "target", TARGETS);
  if (FEAT.view && v !== null) LS.view = v;
  if (FEAT.target && t !== null) LS.target = t;
  syncUI();
}
// Live's phase changed: keep the viewer's look and the time across it; the field returns to the situation's own,
// and the look is aimed once at the reference body if it is in front.
function loadPhase(s) {
  const g = LS.get, y = LS.yaw, pt = LS.pitch, r = LS.roll;
  mount(s); LS.get = g; LS.yaw = y; LS.pitch = pt; LS.roll = r; LS.get0 = g; Object.assign(LS, aimAtBody()); syncUI();
}
// The shot player's next shot: its situation at its defaults, its view, labels and frame; the shot then drives the
// time and look through track() (modes.js autoStep).
function loadShot(p) {
  mount(+p.get("scene"));
  LS.labLv = pNum(p, "lab"); LS.view = pNum(p, "view"); frame = pFlag(p, "frame");
}
// Following: the span's situation with the span's view and target where the kernel has them, and its field where it
// names one, at the time.
function loadFollow(p) {
  const s = +p.get("scene"), v = pNum(p, "view") ?? 0, t = pNum(p, "target") ?? 0, w = pNum(p, "fov"), f = follow;
  pickSituation(s); follow = f;
  const named = FEAT.view && (v || t);
  LS.view = named ? v : 0; LS.target = named ? t : 0;
  if (w !== null && (named || (!v && !t))) LS.fov = LS.fov0 = w;
  LS.get = LS.get0 = pNum(p, "get"); syncUI();
}
// A timeline event at g whose span's situation and view already suit it (else timeline.js loads it by="follow"): the
// time, the scrubber re-centred on it; in Live only the time.
function loadEvent(g) {
  livePin = null;
  if (LS.mode === "live") LS.get = clampLive(g); else LS.get = LS.get0 = g;
}
// A crew photograph (Fusion): its situation in the window view, its g.e.t. held, the fitted pointing, the lens's
// field, in Free-look; a link's own get, fov, yaw, pitch and roll then apply.
function loadPhoto(p) {
  const i = PHOTOS.findIndex(x => x.frame === p.get("photo") && x.img);
  if (i < 0) return;
  if (auto() || LS.mode === "beam") enterMode("free");
  const ph = PHOTOS[i];
  LS.view = 0; LS.target = 0;
  pickSituation(+ph.scene);
  const cam0 = [LS.yaw, LS.pitch, LS.roll], c = fFit(ph).cam;
  LS.yaw += c[0]; LS.pitch += c[1]; LS.roll += c[2];
  LS.get = LS.get0 = photoGet(ph); LS.playing = false;
  LS.fov = lensFov(ph) || LS.fov0;
  const g = p.has("get") ? parseGet(p.get("get")) : null; if (g !== null && isFinite(g)) LS.get = g;
  const f = pNum(p, "fov"); if (f !== null) LS.fov = clampFov(f);
  for (const k of ["yaw", "pitch", "roll"]) { const v = pNum(p, k); if (v !== null) LS[k] = v; }
  fusionShow(i, cam0, g !== null && isFinite(g));
}
