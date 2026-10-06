// Shared view state.
"use strict";

// ---- the loaded state (docs/systems-model.md, section 3) ----
// One record of what is loaded and where in it the viewer is. Every module and the room (room.js labState) read it.
const LS = {
  situation: 1,   // the situation (scene) shown: its ID in VIEW_NAMES.SITUATIONS
  epoch: 0,       // its scenario's epoch offset from Apollo 11's range zero, s (hdr(16), kernel.js viewInit)
  get: 0, get0: 0,                                     // g.e.t., s; get0 the reference the time scrubber centres on
  yaw: 0, pitch: 0, roll: 0, fov: 12, fov0: 12,        // the look; fov0 the situation's own field
  view: 0, target: 0,                                  // in_view, in_target (views.js)
  labLv: 3,                                            // label level: 0 off, 1 primary, 2 secondary, 3 all (views.js)
  mode: "attract", playing: true                       // playback: the mode (modes.js) and whether the clock runs
};

// ---- the rest of the view state ----
let speedIdx = 3, frame = true;
let hidden = false;
let last = 0, dpr = 1, W = 300, Hh = 340;
