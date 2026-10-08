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

  // Tabbed's reel list (#73): [ RETURN TO REELS ] opens it, the mounted reel marked; Apollo 8's button mounts its
  // scenario reel as a fresh run (Free-look, its first situation at its default g.e.t., the clock stopped). The
  // picture is the list.
  { name: "tabbed-reel-mount", url: "mode=free&space=tiled&scn=apollo11-asflown&sit=1",
    steps: [HOLD(), { click: "#breels" }, { frames: 3 },
      { expect: [`!document.getElementById("ask").hidden && document.getElementById("ask").classList.contains("list")`] },
      { expect: [`[...document.querySelectorAll("#askbtns button[data-reel]")].map(b => b.dataset.reel).join()`, "apollo11-asflown,apollo8-asflown,demo,tour"] },
      { expect: [`document.querySelector("#askbtns button.primary").dataset.reel`, "apollo11-asflown"] },
      { js: `VIEW_TL.seek(1000); VIEW_TL.state().playing || document.getElementById("bplay").click()` },
      { js: `document.querySelector('#askbtns button[data-reel="apollo8-asflown"]').click()` }, { frames: 2 }],
    expect: [[TL("mounted"), "apollo8-asflown"], [TL("mode"), "free"], [TL("scene"), 9], [TL("get"), 272919.7], [TL("playing"), false],
      [`document.getElementById("ask").hidden`, true]] },

  // The sim panel (#73): no SCENE group, one [ RETURN TO REELS ] button, and the reel's situations as marked entries of
  // the event list, each with its quick-view key (Apollo 11's quickviews.txt: 1-8 its situations, 9 an event).
  { name: "tabbed-panel", url: "mode=free&space=tiled&scn=apollo11-asflown&sit=3&get=1:30:00",
    steps: [...LINKED(5400), { frames: 3 }],
    expect: [[`!!document.querySelector('[data-shade="scene"], #scenes, #reels')`, false], [`document.getElementById("breels").textContent`, "Return to reels"],
      [`[...document.querySelectorAll("#tllist .tlrow.tlsit")].map(r => r.querySelector(".tlq").textContent + r.dataset.id).sort().join()`,
        "1EARTHRISE,2EARTH APPROACH,3EARTH LIMB,4LM RENDEZVOUS,5LM DESCENT,6MOON VIEW,7TRANSPOSITION AND DOCKING,8DOCKED STACK"],
      [`document.getElementById("hintscenes").textContent`, "1 2 3 4 5 6 7 8 9"]] },

  // A situation entry applies its view: External on the Earth first, then EARTHRISE picked from the list: its scene,
  // its own view and target, its field.
  { name: "tabbed-situation-entry", url: "mode=free&space=tiled&scn=apollo11-asflown&sit=3",
    steps: [HOLD(), { js: `document.querySelectorAll("#viewgrp button")[1].click(); document.querySelectorAll("#targrp button")[1].click()` },
      { expect: [TL("viewMode"), 1] }, { expect: [TL("targetId"), 1] },
      { js: `document.querySelector('#tllist .tlrow[data-id="EARTHRISE"]').click()` }, HOLD(), { frames: 3 }],
    expect: [[TL("scene"), 1], [TL("viewMode"), 0], [TL("targetId"), 0], [TL("fov"), 8], [TL("mode"), "free"]] },

  // A plain event moves the time only: from Earth limb (situation 3), Translunar injection (SP-4029, 10,213.03 s).
  { name: "tabbed-event-entry", url: "mode=free&space=tiled&scn=apollo11-asflown&sit=3",
    steps: [HOLD(), { js: `document.querySelectorAll("#tlkinds button")[1].click()` },
      { js: `document.querySelector('#tllist .tlrow[data-id="translunar-injection"]').click()` }, { frames: 3 }],
    expect: [[TL("scene"), 3], [TL("get"), 10213.03], [TL("fov"), 70], [TL("viewMode"), 0], [TL("playing"), false]] },

  // Keys 1-9 follow the loaded reel's quick views: on Apollo 11, 4 is LM RENDEZVOUS and 9 Translunar injection; on
  // Apollo 8 (no quickviews.txt: its one situation on key 1), 2 is a gap and does nothing.
  { name: "tabbed-quickviews", url: "mode=free&space=tiled&scn=apollo11-asflown&sit=3",
    steps: [HOLD(), { key: "4" }, HOLD(), { expect: [TL("scene"), 4] }, { expect: [TL("fov"), 12] },
      { key: "9" }, { expect: [TL("get"), 10213.03] },
      { click: "#breels" }, { js: `document.querySelector('#askbtns button[data-reel="apollo8-asflown"]').click()` },
      HOLD(100), { key: "2" }, { expect: [TL("get"), 100] }, { key: "1" }, HOLD(), { frames: 3 }],
    expect: [[TL("mounted"), "apollo8-asflown"], [TL("scene"), 9], [TL("get"), 272919.7]] },

  // The run sheet at the front of the Apollo 11 notebook (#29 slice f): the reel's generated listing, situations marked.
  { name: "tabbed-run-sheet", url: "mode=free&space=tiled&scn=apollo8-asflown&sit=1",
    steps: [HOLD(), { js: `document.getElementById("blib").click()` },
      { js: `document.querySelector('#liblist .librow[data-id="nb-apollo11-asflown"]').click()` }, { frames: 3 }],
    expect: [[`document.getElementById("libmd").firstElementChild.className`, "runsheet"],
      [`document.querySelectorAll("#libmd .runsheet tbody tr").length`, 255], [`document.querySelectorAll("#libmd .runsheet tr.rssit").length`, 8],
      [`document.querySelector("#libmd .runsheet h2").textContent`, "RUN SHEET - APOLLO 11 AS FLOWN"]] },

  // A run-sheet entry mounts the reel as a fresh run and goes there: from Apollo 8 with the clock running, Apollo 11's
  // Translunar injection (the time, the clock stopped), then its LM DESCENT (the situation's view).
  { name: "tabbed-run-sheet-go", url: "mode=free&space=tiled&scn=apollo8-asflown&sit=1",
    steps: [{ js: `VIEW_TL.state().playing || document.getElementById("bplay").click()` }, { js: `document.getElementById("blib").click()` },
      { js: `document.querySelector('#liblist .librow[data-id="nb-apollo11-asflown"]').click()` },
      { js: `document.querySelector('#libmd .runsheet button[data-id="translunar-injection"]').click()` },
      { expect: [`document.getElementById("libr").classList.contains("open")`, false] }, { expect: [TL("mounted"), "apollo11-asflown"] },
      { expect: [TL("get"), 10213.03] }, { expect: [TL("playing"), false] },
      { js: `document.getElementById("blib").click()` }, { js: `document.querySelector('#libmd .runsheet button[data-id="LM DESCENT"]').click()` },
      { frames: 3 }],
    expect: [[TL("scene"), 5], [TL("viewMode"), 0], [TL("fov"), 82.4], [TL("get"), 369720], [TL("playing"), false], [TL("mode"), "free"]] },

  // [ RETURN TO REELS ] in the room: from the vector terminal's page, back into the room at the rack's close-up.
  { name: "room-return-to-reels", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, ...LINKED(368044), ROOM_STILL, { js: `VIEW_LAB.setTarget("vector", true)` },
      { wait: `!document.body.classList.contains("room") && !document.getElementById("labhost").classList.contains("fading")` }, { frames: 3 },
      { click: "#breels" }, { wait: `${LAB}.at === "rack" && ${LAB}.mode !== "flight"` }, ROOM_STILL, { frames: 3 }],
    expect: [[`${LAB}.at`, "rack"], [`document.body.classList.contains("room")`, true], [`document.getElementById("ask").hidden`, true], [TL("mounted"), "apollo11-asflown"]] },

  // The run sheet in the room: the Apollo 8 notebook from the bookcase, its Translunar injection picked: the viewer
  // closes onto the workbench's page with the reel mounted fresh at that time; Esc goes back to the room.
  { name: "room-run-sheet", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, ...LINKED(368044), ROOM_STILL, { js: `VIEW_LAB.setTarget("library", true)` },
      { wait: `document.getElementById("libr").classList.contains("open") && !document.body.classList.contains("room")` },
      { js: `document.querySelector('#liblist .librow[data-id="nb-apollo8-asflown"]').click()` },
      { js: `document.querySelector('#libmd .runsheet button[data-id="translunar-injection"]').click()` },
      { expect: [`document.getElementById("libr").classList.contains("open")`, false] }, { expect: [TL("mounted"), "apollo8-asflown"] },
      { expect: [TL("get"), 10565.51] }, { expect: [TL("playing"), false] }, { expect: [`document.body.dataset.tab`, "review"] },
      { frames: 3 }, { key: "Escape" }, { wait: `document.body.classList.contains("room")` }],
    expect: [[`document.body.classList.contains("room")`, true], [TL("mounted"), "apollo8-asflown"]] },

  // The scene= link of #22 still opens what it did: scene=9 is Apollo 8's Earthrise.
  { name: "link-scene-alias", url: "mode=free&space=tiled&scene=9",
    steps: [HOLD(), { frames: 2 }],
    expect: [[TL("mounted"), "apollo8-asflown"], [TL("scene"), 9]] },

  // Fusion: the Earthrise photograph AS08-14-2383 over its fitted view.
  { name: "fusion-as08-14-2383", url: "tab=fusion&photo=AS08-14-2383&space=tiled",
    steps: [HOLD(), { frames: 3 }],
    expect: [["VIEW_FUSION.state().tab", "fusion"], [TL("mounted"), "apollo8-asflown"], ["VIEW_FUSION.state().link", /photo=AS08-14-2383/]] },

  // The CM station of the docked stack (Apollo 11 situation 8), cabin and walls on.
  { name: "cabin-cm", url: "mode=free&space=tiled&scn=apollo11-asflown&sit=8&view=cm&cabin=1&walls=1&get=11:28:19",
    steps: [...LINKED(41299), { frames: 3 }],
    expect: [[TL("viewMode"), 2], [TL("mounted"), "apollo11-asflown"], [TL("scene"), 8]] },
];
