// Shared view state.
"use strict";

// ---- the loaded state (docs/systems-model.md, section 3) ----
// One record of what is loaded and where in it the viewer is. Every module and the room (room.js labState) read it;
// only loadReel (loader.js) changes the situation, scenario, mission and epoch or jumps the time or look by command.
// Continuous changes inside the situation (the clock running, a drag or key of the look, the scrubber) go through
// track(), below.
const LS = {
  situation: SITS[0].id,           // the situation (scene) shown: its ID in VIEW_NAMES.SITUATIONS
  scenario: SITS[0].scenario,      // its scenario, from its SITUATION card
  mission: SITS[0].mission,        // that scenario's mission (its MISSION card's name)
  epoch: 0, zero: 0,               // the scenario's range zero: s from scenario 1's (hdr(16)), and UTC ms (loader.js mount)
  get: 0, get0: 0,                                     // g.e.t., s; get0 the reference the time scrubber centres on
  yaw: 0, pitch: 0, roll: 0, fov: 12, fov0: 12,        // the look; fov0 the situation's own field
  view: 0, target: 0,                                  // in_view, in_target (views.js)
  labLv: 3,                                            // label level: 0 off, 1 primary, 2 secondary, 3 all (views.js)
  mode: "attract", playing: true                       // playback: the mode (modes.js) and whether the clock runs
};
// The one setter for continuous changes: the fields given, nothing reloaded.
const track = patch => { Object.assign(LS, patch); };

// ---- the rest of the view state ----
let speedIdx = 3, frame = true;
let hidden = false;
let last = 0, dpr = 1, W = 300, Hh = 340;
