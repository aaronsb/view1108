// URL switches, scene names and speed tables.
"use strict";
const STILL = /[?&]still=earthrise\b/.test(location.search);   // frozen Earthrise, chrome hidden, for screenshots
const BARE = STILL || /[?&]bare\b/.test(location.search);       // chrome hidden (combine with ?film= for screenshots)
const DEBUG = /[?&]debug\b/.test(location.search);
const UP = canonUrl(new URLSearchParams(location.search));   // the link's keys, old ones made canonical (urlkeys.js; docs/modes.md)
const NAMES = (typeof VIEW_NAMES !== "undefined") ? VIEW_NAMES : (window.MOCK_NAMES || { NAV: [], CRATER: [] });
// Situations (scenes), each scenario reel's spans and timeline, and the playlist reels: the reels' page.json (#26
// slices 7d, 7e; reelpkg.js reelPages), set once at boot (kernel.js) before anything reads them; the page holds no
// list of its own. A scene is a situation's place among all the scenario reels' situations, 1..N (sitOf); SCNS and TL
// are by reel id. The mock kernel (?mock) on a page without reels gets one stand-in reel, STANDIN_PAGE, and a one-shot
// demo and tour on it. PHOTOS: every scenario reel's photo events (#75; reelpkg.js reelPages), Fusion's photographs,
// each with `img`, an object URL of its photograph's bytes (a raster the reel carries; drawn on the canvas, never a page).
let SITS = [], SCNS = {}, TL = {}, SCENES = [], LIVE_SCN, PHOTOS = [];
const STANDIN_PAGE = { scenario: { id: 1, mission: "", zero: 0, spans: { follow: [[null, 1, 0, 0, null]], live: [[null, 1, ""]], jump: [], pin: [] } },
  situations: [{ id: 1, name: "MOCK", title: "Mock", scenario: 1, mission: "", recipe: "", stations: {} }], timeline: { name: "", events: [] } };
function setPageData(reels) {
  let lists, photos;
  ({ sits: SITS, scns: SCNS, tl: TL, lists, photos } = reelPages(reels));
  PHOTOS = photos.filter(p => p.pic).map(p => ({ ...p, img: URL.createObjectURL(new Blob([p.pic.bytes], { type: p.pic.type })) }));
  SCENES = SITS.map(s => s.title);
  LIVE_SCN = Object.keys(SCNS).find(k => spansOf(k).live.length);   // Live follows the one scenario with LIVE spans
  if (!Object.keys(lists).length) lists = Object.fromEntries([["demo", "attract"], ["tour", "tour"]].map(([id, alias]) => [id,
    { id, title: id.toUpperCase(), alias, next: null, fade: 0, film: id === "demo", tag: id === "tour" ? "TOUR" : "",
      shots: [{ name: SITS[0].title, reel: SITS[0].reel, sit: SITS[0].id, scene: 1, dur: 60, get: [0, 60], lab: 0, frame: true, view: 0 }] }]));
  Object.assign(REELS, lists);
  if (!REELS[DEFAULT_REEL]) throw new Error(`no ${DEFAULT_REEL} reel`);
}
// Playlist reels (#18): the REEL and SHOT cards of data/reels/*/run.scn, by id, from the playlist reels' page.json
// (#26 slice 7e; setPageData), each shot naming its scenario reel and situation, and its scene; the demo reel is
// mounted when none is chosen.
const REELS = {};
const DEFAULT_REEL = "demo";
const hasScene = s => !!SITS[s - 1];
const sitOf = s => SITS[s - 1] || {};
// The scene of a frame the kernel drew: hdr(7) is the situation's id in the scenario reel whose decks the kernel holds
// (LS.deck), not a scene: each reel numbers its own situations (#26 slice 7e).
const frameScene = H => (SITS.find(s => s.reel === LS.deck && s.id === (H[6] | 0)) || {}).scene;
const sitCaption = s => sitOf(s).caption;   // caption text where a situation needs more than its title
const spansOf = scn => (SCNS[scn] || { spans: { follow: [], live: [], jump: [], pin: [] } }).spans;   // scn: a reel id
// Scenario reel scn's FOLLOW span at g.e.t. g, [until, scene, in_view, in_target, field] and its CAPTION= where it
// has one: the first whose until (null: END) is after g.
const followAt = (scn, g) => { const t = spansOf(scn).follow; return t.find(s => s[0] === null || g < s[0]) || t[t.length - 1]; };
// The caption a FOLLOW span gives scene s at g.e.t. g, where the span is s's (#35: a situation that spans several
// phases, Apollo 8's scene 9).
const spanCaption = (s, g) => { const sp = followAt(sitOf(s).reel, g); return sp && sp[1] === s ? sp[5] : undefined; };
const SPEEDS = [0, 1, 2, 4, 10, 30, 100, 300, 1000];
