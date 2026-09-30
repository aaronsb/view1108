// URL switches, scene names and speed tables.
"use strict";
const STILL = /[?&]still=earthrise\b/.test(location.search);   // frozen Earthrise, chrome hidden, for screenshots
const BARE = STILL || /[?&]bare\b/.test(location.search);       // chrome hidden (combine with ?film= for screenshots)
const DEBUG = /[?&]debug\b/.test(location.search);
const UP = new URLSearchParams(location.search);   // shareable view parameters (documented in the README)
const NAMES = (typeof VIEW_NAMES !== "undefined") ? VIEW_NAMES : (window.MOCK_NAMES || { NAV: [], CRATER: [] });
const SCENES = ["Earthrise", "Translunar coast", "Earth limb", "LM rendezvous", "LM descent", "Moon view", "Transposition & docking"];
const SCENE_CAPTION = { 6: "Moon view \u2014 spin to explore" };   // caption text where a scene needs more than its name
const SPEEDS = [0, 1, 2, 4, 10, 30, 100, 300, 1000];
