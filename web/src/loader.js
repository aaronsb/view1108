// The one loader (#16; docs/systems-model.md, section 4, rules 1 and 2). loadReel(params) is the only code that
// changes the situation, and with it the scenario, mission and epoch, or that jumps the time or the look by command.
// Every way in builds params and calls it: the URL (openLink, link.js), the event list's entries and quick-view keys (timeline.js tlPick), the mode
// buttons, Live's phases and jump buttons, Following and the timeline's events, the playlist player (Attract, Tour),
// the Fusion photo pick, the view and target buttons and the look's reset. Continuous changes inside the loaded
// situation (the clock running, a drag, a key or the wheel on the look, the scrubber) go through track() (state.js).
// Tabs, the room and its terminals only read LS: choosing what is shown never loads anything.
//
// params: a URLSearchParams, or anything with get(k) and has(k); P() makes one from an object. The keys are the URL's
// (docs/modes.md, urlkeys.js): reel, mode, mission, scn, sit, scene, get, utc, fov, yaw, pitch, roll, rate, bspeed,
// labels, view, target, cabin, walls, frame, hidden, photo. reel names a playlist reel (config.js REELS); mode=attract
// and mode=tour, the demo and tour reels' ALIASes, still mount them for old links (#22). mission, scn and sit name a
// situation (a mission's first scenario reel, a scenario reel, a situation id or name) and only a link reads them
// (reelpkg.js sceneOfLink); everywhere else scene is the page's handle for a situation (config.js sitOf), which a
// link's scene=N still is for old links (#22). labels is a level by name (views.js LAB_LEVELS). One more, `by`, names the page's own callers whose rule
// differs from a viewer's pick; openLink sets it to "url" and never passes the URL's own:
//   url     a link: the reel or mode (default the demo reel, Attract), its situation, time, look, labels and display flags (loadLink)
//   phase   Live's phase changed: the phase's situation, the time and look kept, the field its own, aimed at the body
//   shot    the playlist player's shot changed: its situation at its defaults, with its view, labels and frame, and
//           its target where it names one
//   follow  Following's span changed, or a timeline event lies outside the view on screen: the span's situation,
//           view, target and field, at a time
//   event   a timeline event inside the view on screen: its time, re-centring the scrubber
//   reset   the look and field back to the situation's own, the time kept
//   source  the state source changed (sim.js): the situation set up again in the kernel, time and look kept
//   mount   a scenario reel mounted (reels.js reelMount: the rack, a drive, the notebook modal, Tabbed's reel list,
//           Load this reel): a fresh run, as if EXEC loaded the program anew (the operator, 2026-10-07): the reel's
//           first situation (scene) at its defaults, Free-look, no Live pin, Beam, Following, view or target override,
//           and the clock stopped; the tab, the Room/Tabbed choice and the speed setting are kept
// Without `by` the keys are a viewer's pick: reel or mode (a mode button; the player's handover to the NEXT reel), then scene (a situation entry or its quick-view key: Live pins it if
// it can, else Free-look; Beam stays), get (a typed time), fov, view, target. mode=live with a scene is a jump button:
// as a link with those keys.
"use strict";
const P = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
const modes = () => [...Object.values(REELS).map(r => r.alias), "live", "free", "beam"];   // the playlist reels' ALIASes, then the others
const pNum = (p, k) => { if (!p.has(k) || p.get(k).trim() === "") return null; const n = Number(p.get(k)); return isFinite(n) ? n : null; };
const pFlag = (p, k) => p.get(k) === "1" ? true : p.get(k) === "0" ? false : null;
// The mode params ask for: a playlist reel's (reel=, by id) or mode=; null for neither.
const pMode = p => { const r = REELS[(p.get("reel") || "").toLowerCase()]; return r ? r.alias : modes().includes(p.get("mode")) ? p.get("mode") : null; };
const pLabels = p => { const i = LAB_LEVELS.indexOf((p.get("labels") || "").toLowerCase()); return i >= 0 ? i : null; };
// A link's mission (mission=apollo8, or its name, APOLLO 8, in any case and spacing): its first scenario reel in load order.
const missionReel = m => { const n = v => String(v).toLowerCase().replace(/[^a-z0-9]/g, ""); return m === null ? null : Object.keys(SCNS).find(id => n(SCNS[id].mission) === n(m)) ?? null; };
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
    case "reset": { const g = LS.get, t = LS.target; mount(LS.situation); LS.get = g; LS.target = t; break; }
    case "source": { const keep = { ...LS }; mount(LS.situation); Object.assign(LS, { get: keep.get, get0: keep.get0, yaw: keep.yaw, pitch: keep.pitch, roll: keep.roll, fov: keep.fov, target: keep.target }); break; }
    case "mount": loadMount(+p.get("scene")); break;
    default: loadPick(p);
  }
  if (p.has("photo")) loadPhoto(p);
}

// ---- steps ----
// Mount scene s: the kernel holds its scenario reel's decks (kernel.js useDeck reloads them when another reel's are
// loaded; each reel numbers its own situations, #26 slice 7e), sets its situation up (view_init, by the situation's id
// in that reel) and its defaults become the look and time, with its own target (in_target 0), so a playlist shot's
// TARGET does not carry into the next shot or Free-look. Its reel, scenario, mission and range zero come from the
// reels' page.json (config.js SITS, SCNS); the scenario's offset from Apollo 11's range zero is the kernel's, hdr(16),
// from the frame view_init draws (#26 slice 7d).
function mount(s) {
  const sit = sitOf(s), scn = SCNS[sit.reel] || {};
  useDeck(sit.reel);
  Object.assign(LS, { situation: s, scn: sit.reel || "", scenario: sit.scenario, mission: scn.mission || "", zero: scn.zero || 0, target: 0 });
  viewInit(sit.id);
  LS.epoch = new Float64Array(buf(), K.hdr.value, 16)[15];
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
  if (LS.mode !== "beam") { LS.mode = "free"; LS.reel = ""; } else beamNextStart = 0; capName = ""; mount(s); syncUI();
}
// The mode setter: a playlist reel's alias (attract, the demo reel, then tour, which loops; player.js), live, free,
// beam. A reel's alias mounts that reel; Live mounts the phase of the current time.
function enterMode(m) {
  const r = reelOfMode(m); LS.reel = r ? r.id : "";
  LS.mode = m; follow = false; autoT = (r && r.id === DEFAULT_REEL && filmQ) ? +filmQ[1] : 0; autoShot = -1; fadeA = 0; LS.playing = true;
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
// A link (loadLink, which replaced applyParams): everything it names, over the situation mounted at start-up.
function loadLink(p) {
  const md = pMode(p) || REELS[DEFAULT_REEL].alias;
  if (reelOfMode(md)) { enterMode(md); return; }
  const sc = pNum(p, "scene"), reel = p.get("scn") ?? missionReel(p.get("mission"));
  const scn = sceneOfLink(SITS, reel, p.get("sit"), sc === null ? null : Math.round(sc)) ?? 1;
  const other = sitOf(scn).reel !== LIVE_SCN;   // another scenario's situation: Live follows its own, so it opens in Free-look
  if (md === "free" || md === "beam" || other) {
    pickSituation(scn); const g = pGet(p); if (g !== null) LS.get = g;
    if (md === "beam") { const b = Math.round(pNum(p, "bspeed") ?? 0); if (b >= 1 && b <= BEAM_SPEEDS.length) beamIdx = b - 1; enterMode("beam"); }
  } else loadLive(p, scn);
  const r = pNum(p, "rate"); if (r !== null) { if (md === "live" && !other && LIVE_RATES.includes(r)) liveIdx = LIVE_RATES.indexOf(r); else if ((md === "free" || other) && SPEEDS.includes(r) && r > 0) speedIdx = SPEEDS.indexOf(r); }
  const f = pNum(p, "fov"); if (f !== null) LS.fov = clampFov(f);
  const y = pNum(p, "yaw"); if (y !== null) LS.yaw = y;
  const pt = pNum(p, "pitch"); if (pt !== null) LS.pitch = Math.max(-90, Math.min(90, pt));
  const rl = pNum(p, "roll"); if (rl !== null) LS.roll = rl;
  const lb = pLabels(p); if (lb !== null) LS.labLv = FEAT.lablv ? lb : lb ? 3 : 0;
  const v = pPick(p, "view", VIEWS), t = pPick(p, "target", TARGETS);
  if (FEAT.view && v !== null) LS.view = v;
  if (FEAT.target && t !== null) LS.target = t;
  if (FEAT.cabin && pFlag(p, "cabin") !== null) cabin = pFlag(p, "cabin");
  if (FEAT.walls && pFlag(p, "walls") !== null) walls = pFlag(p, "walls");
  if (pFlag(p, "frame") !== null) frame = pFlag(p, "frame");
  if (pFlag(p, "hidden") !== null) hidden = pFlag(p, "hidden");
}
// A viewer's pick: a mode button, a situation entry or quick-view key, a jump button, a typed time, the view and target buttons.
function loadPick(p) {
  const m = pMode(p), sc = pNum(p, "scene");
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
// A scenario reel mounted: a fresh run (by=mount, above). Nothing of the last run carries over but the presentation.
function loadMount(s) {
  livePin = null; follow = false; capName = "";
  LS.mode = "free"; LS.reel = ""; beamNextStart = 0;
  LS.view = 0; liveIdx = 0;
  mount(s);
  LS.playing = false;
  syncUI();
}
// Live's phase changed: keep the viewer's look and the time across it; the field returns to the situation's own,
// and the look is aimed once at the reference body if it is in front.
function loadPhase(s) {
  const g = LS.get, y = LS.yaw, pt = LS.pitch, r = LS.roll, t = LS.target;
  mount(s); LS.get = g; LS.yaw = y; LS.pitch = pt; LS.roll = r; LS.target = t; LS.get0 = g; Object.assign(LS, aimAtBody()); syncUI();
}
// The playlist player's next shot: its situation at its defaults, its view, labels and frame, its target where it
// names one; the shot then drives the time and look through track() (player.js reelStep).
function loadShot(p) {
  mount(+p.get("scene"));
  LS.labLv = pLabels(p); LS.view = pNum(p, "view"); frame = pFlag(p, "frame");
  if (p.has("target")) LS.target = pNum(p, "target");
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
  const i = PHOTOS.findIndex(x => x.frame === p.get("photo") && x.img && photoScene(x));
  if (i < 0) return;
  if (auto() || LS.mode === "beam") enterMode("free");
  const ph = PHOTOS[i];
  LS.view = 0; LS.target = 0;
  pickSituation(photoScene(ph));
  const cam0 = [LS.yaw, LS.pitch, LS.roll], c = fFit(ph).cam;
  LS.yaw += c[0]; LS.pitch += c[1]; LS.roll += c[2];
  LS.get = LS.get0 = photoGet(ph); LS.playing = false;
  LS.fov = lensFov(ph) || LS.fov0;
  const g = p.has("get") ? parseGet(p.get("get")) : null; if (g !== null && isFinite(g)) LS.get = g;
  const f = pNum(p, "fov"); if (f !== null) LS.fov = clampFov(f);
  for (const k of ["yaw", "pitch", "roll"]) { const v = pNum(p, k); if (v !== null) LS[k] = v; }
  fusionShow(i, cam0, g !== null && isFinite(g));
}
