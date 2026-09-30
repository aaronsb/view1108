// Shared view state.
"use strict";

// ---- state ----
let scene = 1, playing = true, speedIdx = 3, labLv = 3, frame = true;   // labLv: label level 0 off, 1 primary, 2 secondary, 3 all (views.js)
let get = 0, get0 = 0, yaw = 0, pitch = 0, roll = 0, fov = 12, fov0 = 12;
let hidden = false;
let last = 0, dpr = 1, W = 300, Hh = 340;
