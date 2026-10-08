// Shared view state.
"use strict";

// ---- the loaded state (docs/systems-model.md, section 3) ----
// One record of what is loaded and where in it the viewer is. Every module and the room (room.js labState) read it;
// only loadReel (loader.js) changes the situation, scenario, mission and epoch or jumps the time or look by command.
// Continuous changes inside the situation (the clock running, a drag or key of the look, the scrubber) go through
// track(), below; so do the Labels button and Play/Pause.
const LS = {
  situation: 0,                    // the situation shown, as its scene (config.js sitOf); 0 until the first mount
  scn: "",                         // its scenario reel's id (the URL's scn=)
  deck: "",                        // the scenario reel whose decks the kernel holds (kernel.js loadDecks; mount)
  scenario: 0,                     // its scenario's number in the kernel, from its SCENARIO card (1: #26 slice 7e)
  mission: "",                     // that scenario's mission (its MISSION card's name)
  epoch: 0, zero: 0,               // the scenario's range zero: s from Apollo 11's (the kernel's hdr(16)), and UTC ms (loader.js mount)
  get: 0, get0: 0,                                     // g.e.t., s; get0 the reference the time scrubber centres on
  yaw: 0, pitch: 0, roll: 0, fov: 12, fov0: 12,        // the look; fov0 the situation's own field
  view: 0, target: 0,                                  // in_view, in_target (views.js)
  labLv: 3,                                            // label level: 0 off, 1 primary, 2 secondary, 3 all (views.js)
  reel: DEFAULT_REEL,                                  // the mounted playlist reel (player.js), "" when none plays
  mode: "", playing: true                              // playback: the mode (its alias while a reel plays; the demo reel's from boot, kernel.js) and whether the clock runs
};
// The one setter for continuous changes: the fields given, nothing reloaded.
const track = patch => { Object.assign(LS, patch); };

// ---- the rest of the view state ----
let speedIdx = 3, frame = true;
let hidden = false;
let last = 0, dpr = 1, W = 300, Hh = 340;
