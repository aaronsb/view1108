// The shot list for tools/shoot.mjs (`make shots`; #77). Each shot is a named screenshot, build/shots/<name>.png, and
// the checks it must pass; the format is in shoot.mjs's header. Add a shot for any new visible behaviour, and use
// `make shots ONLY=<name>` rather than a throwaway driver. Every shot also checks: no console error or uncaught
// exception, and #err empty. The page's test hooks (?debug, which shoot.mjs always sets): VIEW_TL, VIEW_FUSION,
// VIEW_LAB (the room), VIEW_KERNEL, VIEW_ESC, VIEW_MODE, VIEW_STEP.

// Steps and checks used by several shots.
const HOLD = g => ({ js: `VIEW_TL.hold(${g === undefined ? "" : JSON.stringify(g)})` });   // pause the clock (at g.e.t. g)
const TL = k => `VIEW_TL.state().${k}`;
const LAB = "VIEW_LAB.info()";
const ROOM_UP = { wait: `VIEW_LAB.running && ${LAB} && document.body.classList.contains("room")` };
const ROOM_STILL = { wait: `${LAB}.mode !== "flight" && !document.getElementById("labhost").classList.contains("fading") && ${LAB}.lit >= 0.999` };

export const SHOTS = [
  // The headless boot gate: the page starts (Attract), with no console error and #err empty.
  { name: "boot", url: "",
    expect: [[TL("mode"), "attract"], ["!!VIEW_KERNEL.view_frame"]] },

  // Simulate (Live) on Apollo 11 in mid-mission: lunar orbit, the clock held.
  { name: "tabbed-simulate-apollo11", url: "mode=live&tab=simulate&space=tiled&get=80:00:00",
    steps: [HOLD("80:00:00"), { frames: 3 }],
    expect: [[TL("mode"), "live"], [TL("get"), 288000], ["VIEW_FUSION.state().tab", "simulate"], [TL("mounted"), "apollo11-asflown"]] },

  // The machine room from its overview, quality pinned low, the clock held.
  { name: "room-overview", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, HOLD("102:14:04"), ROOM_STILL, { frames: 3 }],
    expect: [[`${LAB}.quality`, "low"], [`${LAB}.forced`, "low"], [`${LAB}.at`, null], [`${LAB}.mode`, "free"]] },

  // The tape rack's close-up: flown to as a click on the rack would.
  { name: "room-rack-wall", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, HOLD("102:14:04"), ROOM_STILL, { js: `VIEW_LAB.setTarget("rack")` }, { wait: `${LAB}.mode === "flight"`, timeout: 2000 }, ROOM_STILL, { frames: 3 }],
    expect: [[`${LAB}.at`, "rack"], [`${LAB}.mode`, "hold"], [`${LAB}.quality`, "low"]] },

  // Tabbed's Reels group: Apollo 8's button mounts its scenario reel (Free-look, its first situation, at its default
  // g.e.t.: the clock is held before the click, and mounting keeps it held).
  { name: "tabbed-reel-mount", url: "mode=free&space=tiled&scn=apollo11-asflown&sit=1",
    steps: [HOLD(), { click: `#reels button[data-reel="apollo8-asflown"]` }, HOLD(), { frames: 3 }],
    expect: [[TL("mounted"), "apollo8-asflown"], [TL("mode"), "free"], [`document.querySelector("#reels button.on").dataset.reel`, "apollo8-asflown"]] },

  // Fusion: the Earthrise photograph AS08-14-2383 over its fitted view.
  { name: "fusion-as08-14-2383", url: "tab=fusion&photo=AS08-14-2383&space=tiled",
    steps: [HOLD(), { frames: 3 }],
    expect: [["VIEW_FUSION.state().tab", "fusion"], [TL("mounted"), "apollo8-asflown"], ["VIEW_FUSION.state().link", /photo=AS08-14-2383/]] },

  // The CM station of the docked stack (Apollo 11 situation 8), cabin and walls on.
  { name: "cabin-cm", url: "mode=free&space=tiled&scn=apollo11-asflown&sit=8&view=cm&cabin=1&walls=1&get=11:28:19",
    steps: [HOLD("11:28:19"), { frames: 3 }],
    expect: [[TL("viewMode"), 2], [TL("mounted"), "apollo11-asflown"], [TL("scene"), 8], [TL("get"), 41299]] },
];
