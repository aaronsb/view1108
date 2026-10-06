// URL switches, scene names and speed tables.
"use strict";
const STILL = /[?&]still=earthrise\b/.test(location.search);   // frozen Earthrise, chrome hidden, for screenshots
const BARE = STILL || /[?&]bare\b/.test(location.search);       // chrome hidden (combine with ?film= for screenshots)
const DEBUG = /[?&]debug\b/.test(location.search);
const UP = new URLSearchParams(location.search);   // shareable view parameters (documented in the README)
const NAMES = (typeof VIEW_NAMES !== "undefined") ? VIEW_NAMES : (window.MOCK_NAMES || { NAV: [], CRATER: [] });
// Situations (scenes) and each scenario's spans, generated from the SITUATION and SPAN cards (tools/gen_data.py,
// build/names.js); the page holds no list of its own. A scene number is a situation's ID, 1..N. The mock kernel
// (?mock, no names.js) gets one stand-in situation.
const SITS = NAMES.SITUATIONS || [{ id: 1, title: "Mock", scenario: 1, mission: "", recipe: "", stations: {} }];
const SCNS = NAMES.SCENARIOS || { 1: { mission: "", epoch: 0, zero: 0, spans: { follow: [[null, 1, 0, 0, null]], live: [[null, 1, ""]], jump: [], pin: [] } } };
// Playlist reels (#18): the REEL and SHOT cards of data/reels/*/run.scn, by id; the demo reel is mounted when none is
// chosen. The mock kernel gets a one-shot demo and tour on its stand-in situation.
const REELS = NAMES.REELS || Object.fromEntries([["demo", "attract"], ["tour", "tour"]].map(([id, alias]) => [id,
  { id, title: id.toUpperCase(), alias, next: null, fade: 0, film: id === "demo", tag: id === "tour" ? "TOUR" : "", shots: [{ name: SITS[0].title, sit: SITS[0].id, dur: 60, get: [0, 60], lab: 0, frame: true, view: 0 }] }]));
const DEFAULT_REEL = "demo";
const SCENES = SITS.map(s => s.title);
const hasScene = s => !!SITS[s - 1];
const sitOf = s => SITS[s - 1] || {};
const sitCaption = s => sitOf(s).caption;   // caption text where a situation needs more than its title
const spansOf = scn => (SCNS[scn] || { spans: { follow: [], live: [], jump: [], pin: [] } }).spans;
// Live follows the one scenario with LIVE spans; its jumps and pinned situations are that scenario's.
const LIVE_SCN = Object.keys(SCNS).find(k => spansOf(k).live.length);
const SPEEDS = [0, 1, 2, 4, 10, 30, 100, 300, 1000];
