// The shot list for tools/shoot.mjs (`make shots`; #77). Each shot is a named screenshot, build/shots/<name>.png, and
// the checks it must pass; the format is in shoot.mjs's header. Add a shot for any new visible behaviour, and use
// `make shots ONLY=<name>` rather than a throwaway driver. Every shot also checks: the WebAssembly kernel runs, no
// console error or uncaught exception, and #err empty. The page's test hooks (?debug, which shoot.mjs always sets):
// VIEW_TL, VIEW_FUSION, VIEW_LAB (the room), VIEW_KERNEL, VIEW_CPU, VIEW_ESC, VIEW_MODE, VIEW_STEP.

// Steps and checks used by several shots.
const HOLD = g => ({ js: `VIEW_TL.hold(${g === undefined ? "" : JSON.stringify(g)})` });   // pause the clock (at g.e.t. g)
const TL = k => `VIEW_TL.state().${k}`;
// The link's get= tested, then held exactly: freeze the clock where it is, check it is within 5 min after g.e.t. s (the
// clock ran from the link until now), then hold it at s for a picture that repeats.
const LINKED = s => [HOLD(), { expect: [`(d => d >= 0 && d < 300)(VIEW_TL.state().get - ${s})`] }, HOLD(s)];
const LAB = "VIEW_LAB.info()";
const ROOM_UP = { wait: `VIEW_LAB.running && ${LAB} && document.body.classList.contains("room")` };
const ROOM_STILL = { wait: `${LAB}.mode !== "flight" && !document.getElementById("labhost").classList.contains("fading") && ${LAB}.lit >= 0.999` };

// A click on a placed piece of the room (VIEW_LAB.project: its screen, else its origin, client px; a binder's origin is
// at its foot, so 0.16 m up its spine), as the pointer
// events the room's input reads; the capture is the browser's for a real pointer only, so it is a no-op here.
const ROOM_CLICK = name => ({ js: `(() => {
  const c = document.querySelector("#labhost canvas"), p = VIEW_LAB.project(${JSON.stringify(name)}, ${name.startsWith("binder:") ? 0.16 : 0});
  c.setPointerCapture = () => {};
  const o = { clientX: p.x, clientY: p.y, button: 0, pointerId: 1, pointerType: "mouse", bubbles: true };
  c.dispatchEvent(new PointerEvent("pointerdown", o)); c.dispatchEvent(new PointerEvent("pointerup", o));
})()` });
const AT = (name, mode = "hold") => ({ wait: `${LAB}.at === ${JSON.stringify(name)} && ${LAB}.mode === ${JSON.stringify(mode)}`, timeout: 20000 });
const LIB_UP = { wait: `document.getElementById("libr").classList.contains("open") && !document.body.classList.contains("room") && !document.getElementById("labhost").classList.contains("fading")`, timeout: 20000 };
// #85: a book opened in the room, by each route, and back with ← Room or Esc: the room again at the close-up of the
// station it was opened from (systems-model.md section 6), not the overview; the library closed and the Esc stack
// back to the room and that close-up, nothing left out.
const ROOM_URL = scn => `space=room&mode=free&scn=${scn}&sit=1`;
const BOOK_OPEN = {
  binder: [AT_ST("library"), ROOM_CLICK("binder:up7701"), { wait: `${LAB}.out["binder:up7701"] === 1` }, ROOM_CLICK("binder:up7701")],
  read: [AT_ST("library"), ROOM_CLICK("binder:nb-apollo11-asflown"), { wait: `${LAB}.out["binder:nb-apollo11-asflown"] === 1` }, ROOM_CLICK("binder:nb-apollo11-asflown"),
    { wait: `!document.getElementById("ask").hidden` }, { click: "#askbtns button:nth-child(2)" }],
  loadread: [AT_ST("library"), ROOM_CLICK("binder:nb-apollo11-asflown"), { wait: `${LAB}.out["binder:nb-apollo11-asflown"] === 1` }, ROOM_CLICK("binder:nb-apollo11-asflown"),
    { wait: `!document.getElementById("ask").hidden` }, { click: "#askbtns button.primary" }],
  rack: [AT_ST("rack"), ROOM_CLICK("reel:apollo11-asflown"), { wait: `${LAB}.out["binder:nb-apollo11-asflown"] > 0 && ${LAB}.out["binder:nb-apollo11-asflown"] < 1` },
    ROOM_CLICK("binder:nb-apollo11-asflown"), { wait: `${LAB}.out["binder:nb-apollo11-asflown"] === 1` }, ROOM_CLICK("binder:nb-apollo11-asflown"),
    { wait: `!document.getElementById("ask").hidden` }, { click: "#askbtns button:nth-child(2)" }],
};
function AT_ST(name) { return [{ js: `VIEW_LAB.setTarget(${JSON.stringify(name)})` }, AT(name)]; }
const bookShots = (route, scn, from, doc, extra = []) => ["room", "esc"].map(how => ({
  name: `room-book-${route}-${how}`, url: ROOM_URL(scn),
  steps: [ROOM_UP, HOLD(), ROOM_STILL, ...BOOK_OPEN[route].flat(), LIB_UP,
    { expect: [`VIEW_ESC().at(-1)`, "library"] }, { expect: [`document.querySelector("#liblist .librow.on")?.dataset.id`, doc] },
    how === "room" ? { click: "#blibroom" } : { key: "Escape" },
    { wait: `document.body.classList.contains("room")`, timeout: 5000 }, ROOM_STILL, { frames: 10 }, ROOM_STILL, { frames: 3 }],
  expect: [[`${LAB}.at`, from], [`${LAB}.mode`, "hold"], [`document.body.classList.contains("room")`, true],
    [`document.getElementById("libr").classList.contains("open")`, false], [`document.getElementById("blibroom").hidden`, true],
    [`VIEW_ESC()`, ["room", "closeup"]], [`Object.keys(${LAB}.out)`, []], ...extra] }));

export const SHOTS = [
  // The headless boot gate: the page starts (Attract), with no console error and #err empty.
  { name: "boot", url: "",
    expect: [[TL("mode"), "attract"], ["!!VIEW_KERNEL.view_frame"]] },

  // Simulate (Live) on Apollo 11 in mid-mission: lunar orbit, the clock held.
  { name: "tabbed-simulate-apollo11", url: "mode=live&tab=simulate&space=tiled&get=80:00:00",
    steps: [...LINKED(288000), { frames: 3 }],
    expect: [[TL("mode"), "live"],["VIEW_FUSION.state().tab", "simulate"], [TL("mounted"), "apollo11-asflown"]] },

  // The machine room from its overview, quality pinned low, the clock held.
  { name: "room-overview", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, ...LINKED(368044), ROOM_STILL, { frames: 3 }],
    expect: [[`${LAB}.quality`, "low"], [`${LAB}.forced`, "low"], [`${LAB}.at`, null], [`${LAB}.mode`, "free"]] },

  // The tape rack's close-up: flown to as a click on the rack would.
  { name: "room-rack-wall", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, ...LINKED(368044), ROOM_STILL, { js: `VIEW_LAB.setTarget("rack")` }, { wait: `${LAB}.mode === "flight"`, timeout: 2000 }, ROOM_STILL, { frames: 3 }],
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
    steps: [...LINKED(41299), { frames: 3 }],
    expect: [[TL("viewMode"), 2], [TL("mounted"), "apollo11-asflown"], [TL("scene"), 8]] },

  // #85, a book opened in the room and back (← Room, then Esc), by each route: (a) a reference binder, the UNISCOPE
  // 100 manual; (b) a mission notebook through its modal's READ NOTEBOOK ONLY; (c) through LOAD … AND OPEN NOTEBOOK
  // (Apollo 8 mounted, so the Apollo 11 reel mounts as a fresh run); (d) a reel pulled at the rack, its notebook pulled
  // from the half-pull there and read: back to the rack, where it was opened.
  ...bookShots("binder", "apollo11-asflown", "library", "up7701"),
  ...bookShots("read", "apollo11-asflown", "library", "nb-apollo11-asflown"),
  ...bookShots("loadread", "apollo8-asflown", "library", "nb-apollo11-asflown", [[TL("mounted"), "apollo11-asflown"]]),
  ...bookShots("rack", "apollo11-asflown", "rack", "nb-apollo11-asflown"),
];
