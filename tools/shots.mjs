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
// The LINK button's URL (link.js linkURL), and no old key in it (docs/modes.md, Link parameters: the old keys, #22).
const LINK = "VIEW_FUSION.state().link";
const NO_OLD = /^(?!.*[?&](?:src|lab|scene)=)(?!.*[?&]labels=[01](&|$))(?!.*space=tiled)(?!.*mode=(?:attract|tour))/;
// The notebook's binder (#29 slice g): Apollo 11's notebook opened from the library, and its paging plate's label.
const NB_OPEN = [{ js: `document.getElementById("blib").click()` },
  { js: `document.querySelector('#liblist .librow[data-id="nb-apollo11-asflown"]').click()` }, { frames: 2 }];
const NB_PAGE = `document.querySelector("#libmd .nbpage").textContent`;
const NB_COLS = `getComputedStyle(document.querySelector("#libmd .nbpages")).columnCount`;
const NO_HSCROLL = `document.documentElement.scrollWidth <= innerWidth && document.getElementById("libr").scrollWidth <= innerWidth`;
// Every shown run-sheet row, in each of its fragments, no wider than one column of the binder's pages.
const RS_FITS = `(pg => { const cs = getComputedStyle(pg), w = pg.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  - (parseInt(cs.columnCount, 10) - 1) * parseFloat(cs.columnGap);
  const rows = [...pg.querySelectorAll(".runsheet tr")].filter(r => r.offsetParent !== null);
  return rows.length > 0 && rows.every(r => [...r.getClientRects()].every(q => q.width <= w / parseInt(cs.columnCount, 10) + 0.5)); })(document.querySelector("#libmd .nbpages"))`;
// Findings and attachments (#29 slice g): the Apollo 8 notebook opened likewise; the binder paged forward (its Next
// button) until the element `sel` has come into view, its photographs and figures decoded; and the check that `sel`
// lies whole inside the binder's view.
const NB8_OPEN = [{ js: `document.getElementById("blib").click()` },
  { js: `document.querySelector('#liblist .librow[data-id="nb-apollo8-asflown"]').click()` }, { frames: 2 }];
const NB_TO = sel => [{ js: `(() => { const pg = document.querySelector("#libmd .nbpages"), el = document.querySelector(${JSON.stringify(sel)}), nx = document.querySelector("#libmd .nbnext");
  for (let k = 0; k < 60 && el.getBoundingClientRect().left >= pg.getBoundingClientRect().right - 1 && !nx.disabled; k++) nx.click(); })()` },
  { wait: `[...document.querySelectorAll("#libmd img")].every(i => i.complete && i.naturalWidth > 0)` }, { frames: 2 }];
// Every attachment no wider than one column of the binder's pages (on a phone, one page).
const NB_ATTACH_FITS = `(pg => { const cs = getComputedStyle(pg), n = parseInt(cs.columnCount, 10), w = (pg.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (n - 1) * parseFloat(cs.columnGap)) / n;
  const fs = [...pg.querySelectorAll("figure.nbattach")]; return fs.length > 0 && fs.every(f => f.getBoundingClientRect().width <= w + 1); })(document.querySelector("#libmd .nbpages"))`;
const NB_SHOWN = sel => `(r => (p => r.width > 0 && r.left >= p.left - 1 && r.right <= p.right + 1)(document.querySelector("#libmd .nbpages").getBoundingClientRect()))(document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect())`;
const VISIBLE_ROWS = `[...document.querySelectorAll("#libmd .runsheet tbody tr")].filter(r => r.offsetParent !== null).length`;   // the run sheet's rows shown
const ROOM_UP = { wait: `VIEW_LAB.running && ${LAB} && document.body.classList.contains("room")` };
const ROOM_STILL = { wait: `${LAB}.mode !== "flight" && !document.getElementById("labhost").classList.contains("fading") && ${LAB}.lit >= 0.999` };

// A click on a placed piece of the room (VIEW_LAB.project: its screen, else its origin, client px; a reel case is
// clicked at its middle, 0.13 m up from its origin on the deck; a binder's origin is
// at its foot, so 0.16 m up its spine), as the pointer
// events the room's input reads; the capture is the browser's for a real pointer only, so it is a no-op here.
const ROOM_CLICK = name => ({ js: `(() => {
  const c = document.querySelector("#labhost canvas"), p = VIEW_LAB.project(${JSON.stringify(name)}, ${name.startsWith("binder:") ? 0.16 : /^(reel|systape):/.test(name) ? 0.13 : 0});
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
    ...(doc.startsWith("nb-") ? [{ expect: [`!!document.querySelector("#libmd .runsheet")`, true] }] : []),   // back from its run sheet
    how === "room" ? { click: "#blibroom" } : { key: "Escape" },
    { wait: `document.body.classList.contains("room")`, timeout: 5000 }, ROOM_STILL, { frames: 10 }, ROOM_STILL, { frames: 3 }],
  expect: [[`${LAB}.at`, from], [`${LAB}.mode`, "hold"], [`document.body.classList.contains("room")`, true],
    [`document.getElementById("libr").classList.contains("open")`, false], [`document.getElementById("blibroom").hidden`, true],
    [`VIEW_ESC()`, ["room", "closeup"]], [`Object.keys(${LAB}.out)`, []], ...extra] }));
// The terminal the walk stands nearest.
const NEAREST = `(w => VIEW_LAB.layout().terminals.map(t => [t.name, Math.hypot(t.x - w.x, t.z - w.z)]).sort((a, b) => a[1] - b[1])[0][0])(${LAB}.walk)`;

export const SHOTS = [
  // The headless boot gate: the page starts (Attract), with no console error and #err empty.
  { name: "boot", url: "",
    expect: [[TL("mode"), "attract"], ["!!VIEW_KERNEL.view_frame"]] },

  // Simulate (Live) on Apollo 11 in mid-mission: lunar orbit, the clock held.
  { name: "tabbed-simulate-apollo11", url: "mode=live&tab=simulate&space=tabbed&get=80:00:00",
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

  // #87: the rack's system tapes, a level of props below the playlists, each pulled like a reel; their labels.
  { name: "room-rack-system", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, ...LINKED(368044), ROOM_STILL, { js: `VIEW_LAB.stand(2.0, -3.25, 0, -35)` }, { frames: 3 }],
    expect: [[`${LAB}.systapes`, ["EXEC 8 SYSTEM (COPY)", "RUN STREAMS", "VIEW KERNEL", "EPHEMERIS", "MODELS", "PLOT TAPE", "MEDIA 1", "MEDIA 2"]],
      [`["exec8", "runstreams", "kernel", "ephemeris", "models", "plot", "media1", "media2"].every(id => (p => p && p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight)(VIEW_LAB.project("systape:" + id)))`, true]] },
  // #87: a pulled system tape asks the page for its modal, which only puts it back; nothing is mounted.
  { name: "room-system-tape-modal", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, ...LINKED(368044), ROOM_STILL, ...AT_ST("rack"), ROOM_STILL, ROOM_CLICK("systape:ephemeris"), { wait: `${LAB}.out["systape:ephemeris"] === 1` },
      { frames: 12 }, { expect: [`[...document.querySelectorAll("#labhost > div")].map(d => d.textContent).join("|")`, /System tape · click again · Esc to put it back/] }, ROOM_CLICK("systape:ephemeris"), { wait: `!document.getElementById("ask").hidden` }, { frames: 3 }],
    expect: [[`document.getElementById("asktitle").textContent`, "EPHEMERIS · SYSTEM TAPE — NOT A SIMULATION SCENARIO"],
      [`[...document.querySelectorAll("#askbtns button")].map(b => b.textContent)`, ["PUT TAPE BACK"]], [`${LAB}.asking`, "systape:ephemeris"], [TL("mounted"), "apollo11-asflown"]] },
  // #87: a system tape pulled at the rack goes back when the camera flies to the overview (setTarget(null), as back()),
  // and nothing is left on the Esc stack for it.
  { name: "room-system-tape-overview", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, ...LINKED(368044), ROOM_STILL, ...AT_ST("rack"), ROOM_STILL, ROOM_CLICK("systape:models"), { wait: `${LAB}.out["systape:models"] === 1` },
      { js: `VIEW_LAB.setTarget(null)` }, { wait: `${LAB}.at === null && ${LAB}.mode === "free"`, timeout: 20000 }, ROOM_STILL, { frames: 3 }],
    expect: [[`Object.keys(${LAB}.out)`, []], [`VIEW_ESC()`, ["room"]], [TL("mounted"), "apollo11-asflown"]] },
  // #87: while the demo plays the six other tape units stand undressed; the drive names the demo.
  { name: "room-drive-row-demo", url: "space=room&mode=attract",
    steps: [ROOM_UP, ROOM_STILL, { frames: 3 }],
    expect: [[`${LAB}.tapes`, ["", "", "", "DEMO", "", "", ""]], [TL("mounted"), "demo"]] },
  // #87: the drive row after Apollo 8 is mounted from its reel modal: the drive names it, the six other units carry the
  // system tapes with their labels; a system tape pulled and put back after changes nothing mounted. Motion held
  // (?labmotion=0).
  { name: "room-drive-row", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, ...LINKED(368044), ROOM_STILL, ...AT_ST("rack"), ROOM_STILL,
      ROOM_CLICK("reel:apollo8-asflown"), { wait: `${LAB}.out["reel:apollo8-asflown"] === 1` }, { frames: 12 }, ROOM_CLICK("reel:apollo8-asflown"),
      { wait: `!document.getElementById("ask").hidden` }, { click: "#askbtns button.primary" }, { wait: `${TL("mounted")} === "apollo8-asflown"` }, { frames: 3 },
      { expect: [`${LAB}.tapes.filter((t, i) => i !== 3)`, ["RUN STREAMS", "VIEW KERNEL", "EPHEMERIS", "MODELS", "PLOT TAPE", "MEDIA 1"]] },
      ROOM_CLICK("systape:media2"), { wait: `${LAB}.out["systape:media2"] === 1` }, { frames: 12 }, ROOM_CLICK("systape:media2"), { wait: `!document.getElementById("ask").hidden` },
      { click: "#askbtns button.primary" }, { wait: `document.getElementById("ask").hidden && !${LAB}.out["systape:media2"]` },
      { js: `VIEW_LAB.setTarget(null)` }, { wait: `${LAB}.at === null && ${LAB}.mode === "free"`, timeout: 20000 }, ROOM_STILL, { js: `VIEW_LAB.stand(1.0, -2.3, 57, 6)` }, { frames: 3 }],
    expect: [[TL("mounted"), "apollo8-asflown"], [`${LAB}.tapes.length`, 7], [`${LAB}.tapes[3]`, /\S/],
      [`${LAB}.tapes.filter((t, i) => i !== 3)`, ["RUN STREAMS", "VIEW KERNEL", "EPHEMERIS", "MODELS", "PLOT TAPE", "MEDIA 1"]], [`${LAB}.asking`, null]] },
  // #89: the FASTRAND II close up, from the walkway south of it, and the machine floor from the south-east: the drum
  // unit before the cabinet run. Motion held (?labmotion=0).
  { name: "room-fastrand", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, ...LINKED(368044), ROOM_STILL, { js: `VIEW_LAB.stand(-1.6, 1.4, 36, -8)` }, { frames: 3 }],
    expect: [[`VIEW_LAB.layout().footprints.some(f => f.name === "fastrand" && Math.abs(f.hw - 1.75) < 0.03 && Math.abs(f.hd - 0.45) < 0.03)`, true],
      [`(p => p && p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight)(VIEW_LAB.project("fastrand", 1))`, true]] },
  { name: "room-machine-floor", url: "space=room&mode=free&scn=apollo11-asflown&sit=1&get=102:14:04",
    steps: [ROOM_UP, ...LINKED(368044), ROOM_STILL, { js: `VIEW_LAB.stand(1.2, 3.2, 50, -6)` }, { frames: 3 }],
    expect: [[`(p => p && p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight)(VIEW_LAB.project("fastrand", 1))`, true]] },

  // Tabbed's reel list (#73): [ RETURN TO REELS ] opens it, the mounted reel marked; Apollo 8's button mounts its
  // scenario reel as a fresh run (Free-look, its first situation at its default g.e.t., the clock stopped). The
  // picture is the list.
  { name: "tabbed-reel-mount", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=1",
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
  { name: "tabbed-panel", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=3&get=1:30:00",
    steps: [...LINKED(5400), { frames: 3 }],
    expect: [[`!!document.querySelector('[data-shade="scene"], #scenes, #reels')`, false], [`document.getElementById("breels").textContent`, "Return to reels"],
      [`[...document.querySelectorAll("#tllist .tlrow.tlsit")].map(r => r.querySelector(".tlq").textContent + r.dataset.id).sort().join()`,
        "1EARTHRISE,2EARTH APPROACH,3EARTH LIMB,4LM RENDEZVOUS,5LM DESCENT,6MOON VIEW,7TRANSPOSITION AND DOCKING,8DOCKED STACK"],
      [`document.getElementById("hintscenes").textContent`, "1 2 3 4 5 6 7 8 9"]] },

  // A situation entry applies its view: External on the Earth first, then EARTHRISE picked from the list: its scene,
  // its own view and target, its field.
  { name: "tabbed-situation-entry", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=3",
    steps: [HOLD(), { js: `document.querySelectorAll("#viewgrp button")[1].click(); document.querySelectorAll("#targrp button")[1].click()` },
      { expect: [TL("viewMode"), 1] }, { expect: [TL("targetId"), 1] },
      { js: `document.querySelector('#tllist .tlrow[data-id="EARTHRISE"]').click()` }, HOLD(), { frames: 3 }],
    expect: [[TL("scene"), 1], [TL("viewMode"), 0], [TL("targetId"), 0], [TL("fov"), 8], [TL("mode"), "free"]] },

  // A plain event moves the time only: from Earth limb (situation 3), Translunar injection (SP-4029, 10,213.03 s).
  { name: "tabbed-event-entry", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=3",
    steps: [HOLD(), { js: `document.querySelectorAll("#tlkinds button")[1].click()` },
      { js: `document.querySelector('#tllist .tlrow[data-id="translunar-injection"]').click()` }, { frames: 3 }],
    expect: [[TL("scene"), 3], [TL("get"), 10213.03], [TL("fov"), 70], [TL("viewMode"), 0], [TL("playing"), false]] },

  // Keys 1-9 follow the loaded reel's quick views: on Apollo 11, 4 is LM RENDEZVOUS and 9 Translunar injection; on
  // Apollo 8 (no quickviews.txt: its one situation on key 1), 2 is a gap and does nothing.
  { name: "tabbed-quickviews", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=3",
    steps: [HOLD(), { key: "4" }, HOLD(), { expect: [TL("scene"), 4] }, { expect: [TL("fov"), 12] },
      { key: "9" }, { expect: [TL("get"), 10213.03] },
      { click: "#breels" }, { js: `document.querySelector('#askbtns button[data-reel="apollo8-asflown"]').click()` },
      HOLD(100), { key: "2" }, { expect: [TL("get"), 100] }, { key: "1" }, HOLD(), { frames: 3 }],
    expect: [[TL("mounted"), "apollo8-asflown"], [TL("scene"), 9], [TL("get"), 272919.7]] },

  // The run sheet at the front of the Apollo 11 notebook (#29 slice f): the reel's generated listing, situations marked.
  // Collapsed, as it opens (the operator, 2026-10-08): the situations, the Noteworthy milestones and the quick-view
  // events, and the typed line that shows every entry.
  { name: "tabbed-run-sheet", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1",
    steps: [HOLD(), { js: `document.getElementById("blib").click()` },
      { js: `document.querySelector('#liblist .librow[data-id="nb-apollo11-asflown"]').click()` }, { frames: 3 }],
    expect: [[`document.querySelector("#libmd .nbpages").firstElementChild.className`, "runsheet"],
      [`document.querySelectorAll("#libmd .runsheet tbody tr").length`, 255], [`document.querySelectorAll("#libmd .runsheet tr.rssit").length`, 8],
      [VISIBLE_ROWS, 21], [`document.querySelector("#libmd .runsheet button.rsall").textContent`, "SHOW ALL 255 ENTRIES"],
      [`document.querySelector("#libmd .runsheet h2").textContent`, "RUN SHEET - APOLLO 11 AS FLOWN"]] },

  // Expanded in place: every entry, the line now offering the short sheet; a second press collapses it again.
  { name: "tabbed-run-sheet-all", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1",
    steps: [HOLD(), { js: `document.getElementById("blib").click()` },
      { js: `document.querySelector('#liblist .librow[data-id="nb-apollo11-asflown"]').click()` },
      { js: `document.querySelector("#libmd .runsheet button.rsall").click()` }, { expect: [VISIBLE_ROWS, 255] },
      { js: `document.querySelector("#libmd .runsheet button.rsall").click()` }, { expect: [VISIBLE_ROWS, 21] },
      { js: `document.querySelector("#libmd .runsheet button.rsall").click()` }, { frames: 3 }],
    expect: [[VISIBLE_ROWS, 255], [`document.querySelector("#libmd .runsheet button.rsall").textContent`, "SHOW ONLY THE 21 SITUATIONS AND MILESTONES"]] },

  // A run-sheet entry mounts the reel as a fresh run and goes there: from Apollo 8 with the clock running, Apollo 11's
  // Translunar injection (the time, the clock stopped), then its LM DESCENT (the situation's view).
  { name: "tabbed-run-sheet-go", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1",
    steps: [{ js: `VIEW_TL.state().playing || document.getElementById("bplay").click()` }, { js: `document.getElementById("blib").click()` },
      { js: `document.querySelector('#liblist .librow[data-id="nb-apollo11-asflown"]').click()` },
      { js: `document.querySelector('#libmd .runsheet button[data-id="translunar-injection"]').click()` },
      { expect: [`document.getElementById("libr").classList.contains("open")`, false] }, { expect: [TL("mounted"), "apollo11-asflown"] },
      { expect: [TL("get"), 10213.03] }, { expect: [TL("playing"), false] },
      { js: `document.getElementById("blib").click()` }, { js: `document.querySelector('#libmd .runsheet button[data-id="LM DESCENT"]').click()` },
      { frames: 3 }],
    expect: [[TL("scene"), 5], [TL("viewMode"), 0], [TL("fov"), 82.4], [TL("get"), 369720], [TL("playing"), false], [TL("mode"), "free"]] },

  // The notebook's reading view (#29 slice g): LIGHT by default, typed pages in an open three-ring binder on a desk.
  // On a phone-sized window one page, the run sheet first, with no sideways scroll of the page itself.
  { name: "notebook-light-page", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1", viewport: [400, 860],
    steps: [HOLD(), ...NB_OPEN],
    expect: [[`document.getElementById("libmd").className`, "light"], [NB_COLS, "1"], [NB_PAGE, /^PAGE 1 OF \d+$/],
      [`document.querySelector("#libmd .nbpages").firstElementChild.className`, "runsheet"], [VISIBLE_ROWS, 21],
      [`document.getElementById("blibtheme").textContent`, "Dark"], [NO_HSCROLL]] },

  // On a narrow screen LIST hides the viewer; a resize while it is hidden, then the same notebook again: counted anew
  // (review of PR #94: the hidden binder measured 0 wide and the count went to -Infinity).
  { name: "notebook-light-relist", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1", viewport: [400, 860],
    steps: [HOLD(), ...NB_OPEN, { click: "#bliblist" }, { vp: [390, 700] }, { frames: 2 },
      { js: `document.querySelector('#liblist .librow[data-id="nb-apollo11-asflown"]').click()` }, { frames: 2 },
      { expect: [NB_PAGE, /^PAGE 1 OF \d+$/] }, { key: "PageDown" }, { frames: 2 }],
    expect: [[NB_PAGE, /^PAGE 2 OF \d+$/], [`document.querySelector("#libmd .nbnext").disabled`, false]] },

  // A small phone (360x640): the run sheet's table fits its page, collapsed and with every entry shown; every row's
  // fragments within the column (review of PR #94: rows were 262 px in a 216 px column).
  { name: "notebook-light-phone", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1", viewport: [360, 640],
    steps: [HOLD(), ...NB_OPEN, { expect: [RS_FITS] }, { js: `document.querySelector("#libmd .runsheet button.rsall").click()` },
      { frames: 2 }, { expect: [RS_FITS] }, { js: `document.querySelector("#libmd .runsheet button.rsall").click()` }, { frames: 2 }],
    expect: [[RS_FITS], [NB_PAGE, /^PAGE 1 OF \d+$/], [NO_HSCROLL]] },

  // On a wide window a two-page spread: the run sheet on the left page, the notebook's first page on the right.
  { name: "notebook-light-spread", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1",
    steps: [HOLD(), { vp: [1600, 1000] }, { frames: 2 }, ...NB_OPEN],
    expect: [[`document.getElementById("libmd").className`, "light"], [NB_COLS, "2"], [NB_PAGE, /^PAGES 1-2 OF \d+$/],
      [`document.querySelector("#libmd .nbprev").disabled`, true], [NO_HSCROLL]] },

  // Paged forward by jumps (PgDn twice, Left, Right): the spread of pages 5 and 6, the scroll two whole views.
  { name: "notebook-light-paged", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1",
    steps: [HOLD(), { vp: [1600, 1000] }, { frames: 2 }, ...NB_OPEN, { key: "PageDown" }, { expect: [NB_PAGE, /^PAGES 3-4 OF /] },
      { key: "PageDown" }, { key: "ArrowLeft" }, { expect: [NB_PAGE, /^PAGES 3-4 OF /] }, { key: "ArrowRight" }, { frames: 2 }],
    expect: [[NB_PAGE, /^PAGES 5-6 OF \d+$/], [`document.querySelector("#libmd .nbprev").disabled`, false],
      [`(p => Math.abs(p.scrollLeft / (p.clientWidth + parseFloat(getComputedStyle(p).columnGap) - 2 * parseFloat(getComputedStyle(p).paddingLeft)) - 2) < 0.01)(document.querySelector("#libmd .nbpages"))`],
      [`VIEW_TL.state().playing`, false]] },

  // End: Apollo 8's notebook at its last spread, the figure cases, on a whole view; its pages are odd here, so the
  // spread ends on a blank page (.nbend.blank), which is not counted. Home goes back to the first spread.
  { name: "notebook-light-end", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1",
    steps: [HOLD(), { vp: [1600, 1000] }, { frames: 2 }, { js: `document.getElementById("blib").click()` },
      { js: `document.querySelector('#liblist .librow[data-id="nb-apollo8-asflown"]').click()` }, { frames: 2 },
      { key: "End" }, { expect: [NB_PAGE, /^PAGE \d+ OF \d+$/] }, { key: "Home" }, { expect: [NB_PAGE, /^PAGES 1-2 OF /] },
      { key: "End" }, { frames: 2 }],
    expect: [[`(m => !!m && m[1] === m[2])(/(\\d+) OF (\\d+)$/.exec(${NB_PAGE}))`], [`document.querySelector("#libmd .nbnext").disabled`, true],
      [`document.querySelector("#libmd .nbend").className`, "nbend blank"],
      [`(p => p.scrollLeft > 0 && Math.abs(p.scrollLeft / (p.clientWidth + parseFloat(getComputedStyle(p).columnGap) - 2 * parseFloat(getComputedStyle(p).paddingLeft)) % 1) < 0.01)(document.querySelector("#libmd .nbpages"))`],
      [`(r => r.left > 0 && r.right < innerWidth)(document.querySelector("#libmd section.nbcases h2").getBoundingClientRect())`]] },

  // DARK, the viewer as it was, by the toggle: remembered (prefs.notebook), so the notebook opens dark again.
  { name: "notebook-dark", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1",
    steps: [HOLD(), ...NB_OPEN, { click: "#blibtheme" }, { expect: [`document.getElementById("libmd").className`, "dark"] },
      { key: "Escape" }, { expect: [`document.getElementById("libr").classList.contains("open")`, false] }, ...NB_OPEN],
    expect: [[`document.getElementById("libmd").className`, "dark"], [`document.getElementById("blibtheme").textContent`, "Light"],
      [`JSON.parse(localStorage.getItem("view1108.prefs")).notebook`, "dark"], [`getComputedStyle(document.querySelector("#libmd .nbnav")).display`, "none"],
      [`document.querySelector("#libmd .nbpages").firstElementChild.className`, "runsheet"]] },

  // Findings and attachments (#29 slice g; the look is ours): a finding, a typed slip pasted beside the text (Apollo 8,
  // TN D-6853 p. 3).
  { name: "notebook-finding", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1",
    steps: [HOLD(), { vp: [1600, 1000] }, { frames: 2 }, ...NB8_OPEN, ...NB_TO("#libmd aside.nbfinding")],
    expect: [[NB_SHOWN("#libmd aside.nbfinding")], [`document.querySelector("#libmd aside.nbfinding .nbslip").textContent`, "FINDING  2026-10-08"],
      [`document.querySelector("#libmd aside.nbfinding .nbcite").textContent`, "Source: TN D-6853, printed p. 3"]] },
  // A plate, printed on the page and numbered: Apollo 8's LOI figure, a glossy photo finish.
  { name: "notebook-attach-plate", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1",
    steps: [HOLD(), { vp: [1600, 1000] }, { frames: 2 }, ...NB8_OPEN, ...NB_TO("#libmd figure.nb-plate")],
    expect: [[NB_SHOWN("#libmd figure.nb-plate")], [`document.querySelector("#libmd figure.nb-plate").className`, "nbattach nb-plate nb-photo"],
      [`document.querySelector("#libmd figure.nb-plate figcaption strong").textContent`, "PLATE 1."]] },
  // Taped in and clipped on: the golden render of the Earthrise as a film-recorder print taped at its corners, and the
  // photograph AS08-14-2383 (a media member, JPEG) as a glossy print under a paper clip beside it.
  { name: "notebook-attach-tape-clip", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1",
    steps: [HOLD(), { vp: [1600, 1000] }, { frames: 2 }, ...NB8_OPEN, ...NB_TO("#libmd figure.nb-tape")],
    expect: [[NB_SHOWN("#libmd figure.nb-tape")], [NB_SHOWN("#libmd figure.nb-clip")],
      [`document.querySelector("#libmd figure.nb-tape").className`, "nbattach nb-tape nb-film"], [`document.querySelectorAll("#libmd figure.nb-tape .nbtape").length`, 4],
      [`document.querySelector("#libmd figure.nb-clip").className`, "nbattach nb-clip nb-photo"],
      [`(i => i.naturalWidth + "x" + i.naturalHeight + " " + i.src.slice(0, 23))(document.querySelector("#libmd figure.nb-clip img.nbmedia"))`, "800x800 data:image/jpeg;base64,"]] },
  // An insert, a sheet of its own tipped in: a figure of MSC IN 69-FM-197 (a media member, PNG) with the copy finish, in
  // Apollo 11's notebook; on the facing page the descent section's first figure.
  { name: "notebook-attach-insert", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=1",
    steps: [HOLD(), { vp: [1600, 1000] }, { frames: 2 }, ...NB_OPEN, ...NB_TO("#libmd figure.nb-insert")],
    expect: [[NB_SHOWN("#libmd figure.nb-insert")], [`document.querySelector("#libmd figure.nb-insert").className`, "nbattach nb-insert nb-copy"],
      [`(i => i.naturalWidth + " " + i.src.slice(0, 22))(document.querySelector("#libmd figure.nb-insert img.nbmedia"))`, "1100 data:image/png;base64,"],
      [`(f => Math.abs(f.getBoundingClientRect().height - (f.parentElement.clientHeight - parseFloat(getComputedStyle(f.parentElement).paddingTop) - parseFloat(getComputedStyle(f.parentElement).paddingBottom))) < 2)(document.querySelector("#libmd figure.nb-insert"))`]] },
  // The late-descent render as a plate with the film finish (Apollo 11).
  { name: "notebook-attach-plate-film", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=1",
    steps: [HOLD(), { vp: [1600, 1000] }, { frames: 2 }, ...NB_OPEN, ...NB_TO("#libmd figure.nb-film")],
    expect: [[NB_SHOWN("#libmd figure.nb-film")], [`document.querySelector("#libmd figure.nb-film").className`, "nbattach nb-plate nb-film"],
      [`document.querySelector("#libmd figure.nb-film figcaption strong").textContent`, "PLATE 1."]] },
  // On a phone (390x844, one page) the attachments take the column: the clipped photograph and the taped render each the
  // column's width (most of it), every attachment within it; and Apollo 11's insert, whole on its page.
  { name: "notebook-attach-phone", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1", viewport: [390, 844],
    steps: [HOLD(), ...NB8_OPEN, ...NB_TO("#libmd figure.nb-clip")],
    expect: [[NB_COLS, "1"], [NB_SHOWN("#libmd figure.nb-clip")], [NB_ATTACH_FITS], [NO_HSCROLL],
      [`(i => (pg => i.getBoundingClientRect().width >= 0.7 * (pg.clientWidth - parseFloat(getComputedStyle(pg).paddingLeft) - parseFloat(getComputedStyle(pg).paddingRight)))(document.querySelector("#libmd .nbpages")))(document.querySelector("#libmd figure.nb-clip img.nbmedia"))`]] },
  { name: "notebook-attach-phone-insert", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=1", viewport: [390, 844],
    steps: [HOLD(), ...NB_OPEN, ...NB_TO("#libmd figure.nb-insert")],
    expect: [[NB_COLS, "1"], [NB_SHOWN("#libmd figure.nb-insert")], [NB_ATTACH_FITS], [NO_HSCROLL]] },
  // DARK shows attachments plainly: the photograph and its credit, no clip, tape or finish.
  { name: "notebook-dark-attach", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1&notebook=dark",
    steps: [HOLD(), ...NB8_OPEN, { js: `document.querySelector("#libmd figure.nb-clip").scrollIntoView({ block: "center" })` },
      { wait: `[...document.querySelectorAll("#libmd img")].every(i => i.complete && i.naturalWidth > 0)` }, { frames: 2 }],
    expect: [[`document.getElementById("libmd").className`, "dark"], [`getComputedStyle(document.querySelector("#libmd .nbclip")).display`, "none"],
      [`document.querySelector("#libmd figure.nb-clip .nbcredit").textContent.startsWith("Credit: NASA. Source: ")`, true]] },

  // ?notebook=dark holds DARK for the visit without touching the remembered choice.
  { name: "notebook-dark-url", url: "mode=free&space=tabbed&scn=apollo8-asflown&sit=1&notebook=dark",
    steps: [HOLD(), ...NB_OPEN],
    expect: [[`document.getElementById("libmd").className`, "dark"], [`localStorage.getItem("view1108.prefs")`, null]] },

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
      { frames: 3 }, { key: "Escape" }, { wait: `document.body.classList.contains("room")` }, ROOM_STILL, { frames: 10 }, ROOM_STILL],
    expect: [[`document.body.classList.contains("room")`, true], [TL("mounted"), "apollo8-asflown"],
      [`${LAB}.at`, null], [`${LAB}.mode`, "free"], [`VIEW_ESC()`, ["room"]]] },

  // #22, the link's keys (docs/modes.md, Link parameters). Each old key or value still lands where it did, and the
  // LINK button (VIEW_FUSION.state().link) writes it back in the canonical key: scene=9 is Apollo 8's Earthrise;
  // space=tiled the plain page (Tabbed); src=sim the engine's trajectory (traj), src=<unit> a code location (code);
  // lab=N a label level and labels=0|1 off or all (labels by name); mode=attract and mode=tour their playlist reels.
  { name: "link-scene-alias", url: "mode=free&space=tabbed&scene=9",
    steps: [HOLD(), { frames: 2 }],
    expect: [[TL("mounted"), "apollo8-asflown"], [TL("scene"), 9], [LINK, /scn=apollo8-asflown&sit=APOLLO%208%20EARTHRISE/], [LINK, NO_OLD]] },
  { name: "link-alias-space-tiled", url: "mode=free&space=tiled&scn=apollo11-asflown&sit=1",
    steps: [HOLD(), { frames: 2 }],
    expect: [[`document.body.classList.contains("room")`, false], ["!!window.VIEW_LAB && VIEW_LAB.running", false],
      [`document.getElementById("btiled").classList.contains("on")`, true], [`document.getElementById("btiled").textContent`, "Tabbed"],
      [LINK, /&space=tabbed(&|$)/], [LINK, NO_OLD]] },
  { name: "link-alias-src-sim", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=3&get=1:30:00&src=sim&svu=0",
    steps: [...LINKED(5400), { frames: 2 }],
    expect: [[`document.getElementById("ssrc-sim").classList.contains("on")`, true], [LINK, /&traj=sim&svu=0(&|$)/], [LINK, NO_OLD]] },
  { name: "link-alias-src-code", url: "tab=source&space=tabbed&src=PROJ",
    steps: [{ wait: `document.body.dataset.tab === "source"` }, { frames: 2 }],
    expect: [[`document.body.dataset.tab`, "source"], [LINK, /^[^?]*\?reel=demo&tab=source&.*code=PROJ(&|$)/], [LINK, NO_OLD]] },
  { name: "link-alias-lab", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=1&lab=1",
    steps: [HOLD(), { frames: 2 }],
    expect: [[`document.getElementById("blab").textContent`, /primary/i], [LINK, /&labels=primary(&|$)/], [LINK, NO_OLD]] },
  { name: "link-alias-labels-0", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=1&labels=0",
    steps: [HOLD(), { frames: 2 }],
    expect: [[`document.getElementById("blab").classList.contains("on")`, false], [LINK, /&labels=off(&|$)/], [LINK, NO_OLD]] },
  { name: "link-alias-labels-1", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=1&labels=1",
    steps: [HOLD(), { frames: 2 }],
    expect: [[`document.getElementById("blab").textContent`, /all/i], [LINK, /^(?!.*labels=)/]] },
  { name: "link-alias-mode-attract", url: "mode=attract&space=tabbed",
    steps: [{ frames: 2 }],
    expect: [[TL("mode"), "attract"], [TL("mounted"), "demo"], [LINK, /^[^?]*\?reel=demo(&|$)/], [LINK, NO_OLD]] },
  { name: "link-alias-mode-tour", url: "mode=tour&space=tabbed",
    steps: [{ frames: 2 }],
    expect: [[TL("mode"), "tour"], [TL("mounted"), "tour"], [LINK, /^[^?]*\?reel=tour(&|$)/], [LINK, NO_OLD]] },
  // The canonical keys #22 adds: mission (its first scenario reel), and a reel with a tab (the reel, not the tab's mode).
  { name: "link-mission", url: "mode=free&space=tabbed&mission=apollo8",
    steps: [HOLD(), { frames: 2 }],
    expect: [[TL("mounted"), "apollo8-asflown"], [TL("scene"), 9], [LINK, /scn=apollo8-asflown/]] },
  { name: "link-reel-tab", url: "reel=tour&tab=simulate&space=tabbed",
    steps: [{ frames: 2 }],
    expect: [[TL("mode"), "tour"], [TL("mounted"), "tour"], [`document.body.dataset.tab`, "simulate"], [LINK, /^[^?]*\?reel=tour&tab=simulate(&|$)/]] },

  // Fusion: the Earthrise photograph AS08-14-2383 over its fitted view.
  { name: "fusion-as08-14-2383", url: "tab=fusion&photo=AS08-14-2383&space=tabbed",
    steps: [HOLD(), { frames: 3 }],
    expect: [["VIEW_FUSION.state().tab", "fusion"], [TL("mounted"), "apollo8-asflown"], ["VIEW_FUSION.state().link", /photo=AS08-14-2383/]] },

  // The CM station of the docked stack (Apollo 11 situation 8), cabin and walls on.
  { name: "cabin-cm", url: "mode=free&space=tabbed&scn=apollo11-asflown&sit=8&view=cm&cabin=1&walls=1&get=11:28:19",
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
  // A run-sheet entry picked in that notebook (Apollo 8 mounted): the viewer closes onto the workbench's page with the
  // Apollo 11 reel mounted fresh, and the library is off the Esc stack. Esc is then the page's own (systems-model.md
  // section 6, terminal): back to the room in front of the vector terminal, walking, not to the bookcase.
  { name: "room-book-runsheet-pick-esc", url: ROOM_URL("apollo8-asflown"),
    steps: [ROOM_UP, HOLD(), ROOM_STILL, ...BOOK_OPEN.read.flat(), LIB_UP, { expect: [`!!document.querySelector("#libmd .runsheet")`, true] },
      { click: "#libmd .runsheet tr.rssit button" },
      { wait: `!document.getElementById("libr").classList.contains("open") && !document.body.classList.contains("room")`, timeout: 5000 },
      { expect: [`VIEW_ESC()`, ["room", "terminal"]] }, { expect: [TL("mounted"), "apollo11-asflown"] }, { expect: ["VIEW_FUSION.state().tab", "review"] },
      { key: "Escape" },
      { wait: `document.body.classList.contains("room")`, timeout: 5000 }, ROOM_STILL, { frames: 10 }, ROOM_STILL, { frames: 3 }],
    expect: [[`${LAB}.at`, null], [`${LAB}.mode`, "free"], [NEAREST, "vector"], [`VIEW_ESC()`, ["room"]],
      [`document.getElementById("libr").classList.contains("open")`, false], [TL("mounted"), "apollo11-asflown"]] },
  // A notebook opened at the rack, the window narrowed out of the room, Tabbed's Load this reel, widened back, the
  // workbench opened: the tab bar's Room goes back in front of the workbench, not to the rack (PR #88 review: no
  // stale library origin once the room was left).
  { name: "room-book-left-room", url: ROOM_URL("apollo8-asflown"),
    steps: [ROOM_UP, HOLD(), ROOM_STILL, ...BOOK_OPEN.rack.flat(), LIB_UP,
      { vp: [900, 800] }, { wait: `!VIEW_LAB.running` }, { click: "#blibload" },
      { wait: `!document.getElementById("libr").classList.contains("open") && VIEW_TL.state().mounted === "apollo11-asflown"`, timeout: 5000 },
      { vp: [1280, 800] }, ROOM_UP, ROOM_STILL,
      { js: `VIEW_LAB.setTarget("vector", true)` },
      { wait: `!document.body.classList.contains("room") && !document.getElementById("labhost").classList.contains("fading")`, timeout: 20000 },
      { click: "#bspace" },
      { wait: `document.body.classList.contains("room")`, timeout: 5000 }, ROOM_STILL, { frames: 10 }, ROOM_STILL, { frames: 3 }],
    expect: [[`${LAB}.at`, null], [`${LAB}.mode`, "free"], [NEAREST, "vector"], [`VIEW_ESC()`, ["room"]],
      [`document.getElementById("blibroom").hidden`, true]] },

  // #82, the film recorder's prints: the Print tab's NEGATIVE, POSITIVE and CLEAR buttons, each download caught at
  // its link (printShot, below) and checked: the file name, the background, and every colour drawn.
  printShot("print-svg-apollo11-descent", "scn=apollo11-asflown&sit=5&get=102:45:40", 369940, "apollo11-asflown-s5-lm-descent-102-45-40"),
  printShot("print-svg-apollo8-earthrise", "scn=apollo8-asflown&sit=1&get=75:48:39", 272919, "apollo8-asflown-s1-apollo-8-earthrise-75-48-39"),
];

// A print shot: the Print tab open at a situation and g.e.t., the clock held there, and the three print buttons
// pressed with each download link's click caught (its file name and the SVG at its blob URL, read before the page
// revokes it). Each print is summed up as { name, bg: the #film rect's fill (null: none), ink: every stroke and fill
// colour but "none" }: the negative white on black (its captions #aaa), the positive true black on white, the clear
// positive true black on nothing.
function printShot(name, link, get, stem) {
  const PRINTS = `(async () => {
    const got = [], click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) got.push({ name: this.download, href: this.href }); else click.call(this); };
    try { for (const id of ["bneg", "bpos", "bposc"]) document.getElementById(id).click(); }
    finally { HTMLAnchorElement.prototype.click = click; }
    for (const g of got) g.svg = await (await fetch(g.href)).text();
    window.__prints = got.map(g => { const d = new DOMParser().parseFromString(g.svg, "image/svg+xml"), r = d.getElementById("film");
      const ink = new Set([...d.querySelectorAll("[stroke],[fill]")].filter(e => e !== r).flatMap(e => [e.getAttribute("stroke"), e.getAttribute("fill")]));
      ink.delete(null); ink.delete("none");
      return { name: g.name, bg: r ? r.getAttribute("fill") : null, ink: [...ink].sort(), ok: !d.querySelector("parsererror") && d.querySelectorAll("path").length > 2 }; });
  })()`;
  return { name, url: `mode=free&space=tabbed&tab=print&${link}`,
    steps: [...LINKED(get), { frames: 3 }, { js: PRINTS }],
    expect: [[TL("get"), get], [`["bneg", "bpos", "bposc"].map(id => document.getElementById(id).innerText).join("/")`, "NEGATIVE/POSITIVE/CLEAR"],
      [`window.__prints`, [
        { name: `${stem}-negative.svg`, bg: "#000", ink: ["#aaa", "#fff"], ok: true },
        { name: `${stem}-positive.svg`, bg: "#fff", ink: ["#000"], ok: true },
        { name: `${stem}-positive-clear.svg`, bg: null, ink: ["#000"], ok: true }]]] };
}
