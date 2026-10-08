// The reference library (ours): the documents in web/library/ (library.json, inlined by tools/assemble.py as #flib),
// listed beside the browser's own PDF viewer in an iframe, and after them the reels' scenario notebooks (#29: each
// REEL_LIB reel that carries notebook/notebook.md), shown by the notebook viewer (notebook.js) in place of the iframe,
// with "Load this reel". Opened from Source's [ LIBRARY ], from Tabbed's reel list's "Read the notebook" (reels.js) or, in
// the room, from the bookcase, one of its binders, or a mission notebook there through its modal (room.js). On a narrow screen
// the list carries only the documents' links, since built-in PDF viewers in iframes are unreliable on phones, and a
// notebook takes the overlay with a List button back. Where the PDFs are not beside the page (opened from file://, or
// a 404), the viewer gives way to the document's source URL. An id "nb-<reel id>" names a notebook.
"use strict";
let LIB = [];
try { LIB = JSON.parse($("flib").textContent); } catch (e) { /* the dev page: fetched below */ }
if (!LIB.length) fetch("library/library.json").then(r => r.ok ? r.json() : []).then(d => { LIB = d; libList(); }).catch(() => {});
let libCur = null;   // what is shown: a document of LIB, or a notebook { id: "nb-<reel id>", reel }
const libHere = new Map();   // file -> Promise<boolean>: is the PDF served beside the page
const libPath = d => "library/" + d.file;
function libServed(d) {
  if (location.protocol === "file:") return Promise.resolve(false);
  if (!libHere.has(d.file)) libHere.set(d.file, fetch(libPath(d), { method: "HEAD" }).then(r => r.ok && /pdf/.test(r.headers.get("content-type") || ""), () => false));
  return libHere.get(d.file);
}
const libNarrow = () => !matchMedia("(min-width:1000px)").matches;
// The reels that carry a notebook, in load order: id "nb-<reel id>", the reel, its notebook's title.
const libNotebooks = () => REEL_LIB.filter(r => r.notebook).map(r => ({ id: "nb-" + r.manifest.id, reel: r, title: nbTitle(r.notebook.text) || r.manifest.title }));
function libRow(id, num, title, meta) {
  const li = document.createElement("li"), b = document.createElement("button");
  b.type = "button"; b.dataset.id = id; b.className = "librow";
  for (const [cls, t] of [["libnum", num], ["libt", title], ["libm", meta]]) {
    const s = document.createElement("span"); s.className = cls; s.textContent = t; b.appendChild(s);
  }
  b.onclick = () => libShow(id);
  li.appendChild(b);
  return li;
}
function libSection(name) { const li = document.createElement("li"); li.className = "libsec"; li.textContent = name; return li; }
function libList() {
  const ul = $("liblist"), nbs = libNotebooks(); ul.textContent = "";
  if (nbs.length) ul.appendChild(libSection("DOCUMENTS"));
  for (const d of LIB) {
    const li = libRow(d.id, d.num, d.title, `${d.year} · ${d.publisher} · ${d.pages} pp.`);
    const links = document.createElement("span"); links.className = "liblinks";
    const open = document.createElement("a"), src = document.createElement("a");
    for (const [a, t] of [[open, "Open"], [src, "Source"]]) { a.target = "_blank"; a.rel = "noopener"; a.textContent = t; }
    open.href = libPath(d); src.href = d.source;
    libServed(d).then(ok => { if (!ok) open.href = d.source; });
    links.append(open, " ", src); li.appendChild(links); ul.appendChild(li);
  }
  if (nbs.length) ul.appendChild(libSection("MISSION NOTEBOOKS"));
  for (const n of nbs) ul.appendChild(libRow(n.id, n.reel.manifest.title, n.title, `${n.reel.notebook.figures.size} figures · our notes, rendered by this kernel`));
  if (libCur) libShow(libCur.id);
}
// The notebook viewer emptied.
function libMdClear() { $("libmd").textContent = ""; }
// A figure's image URL: data:image/svg+xml;base64 of its SVG (a data: document has an opaque origin, so a figure opened
// as a page cannot reach the site's storage; review of PR #69). reelpkg.js has already refused a figure with script.
function libFigUrl(svg) {
  const b = new TextEncoder().encode(svg);
  let bin = "";
  for (let k = 0; k < b.length; k += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(k, k + 0x8000));
  return "data:image/svg+xml;base64," + btoa(bin);
}
// The viewer as a document's (PDF) or a notebook's: which of the iframe and the article shows, and the buttons.
function libMode(md) {
  $("libr").classList.toggle("md", md);
  $("libmd").hidden = !md; $("blibload").hidden = !md; $("bliblist").hidden = !md; $("blibtheme").hidden = !md;
  $("libnew").hidden = $("libsrc").hidden = md;
  if (md) { $("libframe").hidden = true; $("libframe").removeAttribute("src"); $("libnote").hidden = true; }
  else libMdClear();
}
function libShow(id) {
  if (id && id.startsWith("nb-")) { libShowNb(id); return; }
  const d = LIB.find(x => x.id === id) || LIB[0];
  if (!d) return;
  libCur = d; libMode(false);
  document.querySelectorAll("#liblist .librow").forEach(b => b.classList.toggle("on", b.dataset.id === d.id));
  document.querySelector("#liblist .librow.on")?.scrollIntoView({ block: "nearest" });
  $("libnew").href = libPath(d); $("libsrc").href = d.source;
  $("libtitle").textContent = `${d.num} — ${d.title} (${d.publisher}, ${d.year})`;
  const f = $("libframe"), note = $("libnote");
  if (libNarrow()) { f.removeAttribute("src"); return; }
  libServed(d).then(ok => {
    if (libCur !== d) return;
    if (ok) { note.hidden = true; f.hidden = false; f.src = libPath(d) + "#view=FitH"; return; }
    $("libnew").href = d.source;
    f.hidden = true; f.removeAttribute("src"); note.hidden = false;
    note.textContent = "This copy of the page has no library beside it. The document is at its source: ";
    const a = document.createElement("a"); a.href = d.source; a.target = "_blank"; a.rel = "noopener"; a.textContent = d.source;
    note.appendChild(a);
  });
}
// A reel's notebook in the viewer: its text built by notebook.js, each figure an <img> from a data: URL of the reel's
// own SVG (never inlined), with the run sheet in front, in the binder's wrappers (#libmd > .nbbinder > .nbpages, then
// the paging plate .nbnav; below). A text the renderer refuses (too long) or fails on is shown as plain text.
function libShowNb(id) {
  const n = libNotebooks().find(x => x.id === id);
  if (!n) { libShow(LIB[0]?.id); return; }
  if (libCur?.id === id && $("libmd").childNodes.length) { libMode(true); return; }
  libMdClear(); libMode(true);
  libCur = { id, reel: n.reel };
  document.querySelectorAll("#liblist .librow").forEach(b => b.classList.toggle("on", b.dataset.id === id));
  document.querySelector("#liblist .librow.on")?.scrollIntoView({ block: "nearest" });
  $("libtitle").textContent = `${n.reel.manifest.title} — scenario notebook (ours), carried in the reel`;
  const figs = n.reel.notebook.figures, fig = name => figs.has(name) ? libFigUrl(figs.get(name)) : null;
  const binder = document.createElement("div"), pages = document.createElement("div"), end = document.createElement("div");
  binder.className = "nbbinder"; pages.className = "nbpages"; end.className = "nbend";
  try { pages.appendChild(nbBuild(nbParse(n.reel.notebook.text), document, fig)); }
  catch (e) {
    const pre = document.createElement("pre");
    pre.textContent = n.reel.notebook.text;
    pages.replaceChildren(pre);
    console.warn(`notebook ${id}: shown as text (${e.message})`);
  }
  const sheet = libRunSheet(n.reel.manifest.id);
  if (sheet) pages.prepend(sheet);
  pages.appendChild(end);
  pages.addEventListener("scroll", () => nbPageSync());
  pages.addEventListener("scrollend", nbSettle);
  pages.addEventListener("load", nbRecount, true);   // a figure decoded: the columns may have moved on
  binder.appendChild(pages);
  $("libmd").replaceChildren(binder, nbNav());
  nbShown = 0;
  nbApplyTheme();
}
// The notebook's reading view (#29 slice g; the operator, 2026-10-07; ours): LIGHT, the default, typed pages in an open
// three-ring binder on a desk, one page or a two-page spread (page.css: the pages are CSS columns of a fixed height,
// scrolled sideways a view at a time); DARK, the viewer as it was before. Two classes on #libmd. ?notebook=light|dark
// holds one for the visit; the viewer's toggle drops that and keeps its choice (prefs.notebook), as the listing's does.
let nbTheme = ["light", "dark"].includes(UP.get("notebook")) ? UP.get("notebook") : prefs.notebook === "dark" ? "dark" : "light";
let nbShown = 0;   // the first page (column) of the view shown, kept across a reflow
const nbLight = () => nbTheme === "light";
const nbPages = () => $("libmd").querySelector(".nbpages");
function nbApplyTheme() {
  $("libmd").classList.toggle("light", nbLight()); $("libmd").classList.toggle("dark", !nbLight());
  $("blibtheme").textContent = nbLight() ? "Dark" : "Light";
  $("libmd").scrollTop = 0;
  const pg = nbPages();
  if (pg) { pg.scrollLeft = 0; nbShown = 0; nbRecount(); }
}
$("blibtheme").onclick = () => { nbTheme = nbLight() ? "dark" : "light"; prefs.notebook = nbTheme; savePrefs(); nbApplyTheme(); };
// The paging plate under the binder: back, the page or pages shown, forward.
function nbNav() {
  const nav = document.createElement("div"), prev = document.createElement("button"), at = document.createElement("span"), next = document.createElement("button");
  nav.className = "nbnav"; prev.className = "nbprev"; at.className = "nbpage"; next.className = "nbnext";
  prev.type = next.type = "button"; prev.textContent = "Back"; next.textContent = "Next";
  prev.title = "The page before (PgUp, Left; Home: the first)"; next.title = "The next page (PgDn, Right; End: the last)";
  prev.onclick = () => nbTurn(-1); next.onclick = () => nbTurn(1);
  nav.append(prev, at, next);
  return nav;
}
// The layout's paging, read back from the columns page.css set: `per` pages a view (1 or 2), `col` one column and its
// gap, `step` the scroll from one view to the next, `pad` the inset of the first column.
function nbGeom(pg) {
  const cs = getComputedStyle(pg), per = parseInt(cs.columnCount, 10) || 1, gap = parseFloat(cs.columnGap) || 0;
  const pad = parseFloat(cs.paddingLeft), col = (pg.clientWidth - pad - parseFloat(cs.paddingRight) + gap) / per;
  return { per, col, step: col * per, pad };
}
let nbCount = 1;   // the notebook's pages, counted when its layout changes (nbRecount)
// Count the pages from the column the end marker (.nbend, the last child) falls in, not from the scroll width, which
// grows with anything wider than its column. A spread needs an even count to end on a whole view: the marker then
// becomes a blank last page (.blank, a column of its own), which is not counted. Then the view is put back on the page
// it showed (nbShown).
function nbRecount() {
  const pg = nbPages();
  if (!pg || !nbLight() || $("libmd").hidden) return;
  const end = pg.querySelector(".nbend"), g = nbGeom(pg);
  const colOf = el => Math.floor((el.getBoundingClientRect().left - pg.getBoundingClientRect().left + pg.scrollLeft - g.pad) / g.col + 0.01);
  end.classList.remove("blank");
  nbCount = colOf(end) + 1;
  if (g.per === 2 && nbCount % 2) end.classList.add("blank");
  pg.scrollLeft = Math.min(Math.floor(nbShown / g.per), nbLastView(g)) * g.step;
  nbPageSync();
}
const nbLastView = g => Math.ceil(nbCount / g.per) - 1;
// The label and the buttons, for the view the scroll is at.
function nbPageSync() {
  const pg = nbPages(), at = $("libmd").querySelector(".nbpage");
  if (!pg || !at || !nbLight() || $("libmd").hidden) return;
  const g = nbGeom(pg), v = Math.max(0, Math.min(Math.round(pg.scrollLeft / g.step), nbLastView(g)));
  const first = v * g.per + 1, last = Math.min(nbCount, first + g.per - 1);
  nbShown = first - 1;
  at.textContent = first === last ? `PAGE ${first} OF ${nbCount}` : `PAGES ${first}-${last} OF ${nbCount}`;
  $("libmd").querySelector(".nbprev").disabled = v <= 0;
  $("libmd").querySelector(".nbnext").disabled = v >= nbLastView(g);
}
// Turn `d` views (Infinity, -Infinity: to the last, the first): a jump, no animation.
function nbTurn(d) {
  const pg = nbPages();
  if (!pg || !nbLight()) return;
  const g = nbGeom(pg), v = Math.max(0, Math.min(Math.round(pg.scrollLeft / g.step) + d, nbLastView(g)));
  pg.scrollTo({ left: v * g.step, behavior: "instant" });
  nbPageSync();
}
// A swipe or a wheel that stopped between views (a spread has no snap points of its own), or past the last, is put on
// the nearest view.
function nbSettle() {
  const pg = nbPages();
  if (!pg || !nbLight()) return;
  const g = nbGeom(pg), x = Math.max(0, Math.min(Math.round(pg.scrollLeft / g.step), nbLastView(g))) * g.step;
  if (Math.abs(pg.scrollLeft - x) > 1) pg.scrollTo({ left: x, behavior: "instant" });
}
// The typewriter face arriving, or the window resized, reflows the columns: the label follows, the view stays put.
window.addEventListener("resize", nbRecount);
document.fonts?.addEventListener("loadingdone", nbRecount);
// The binder's keys while a notebook is shown in LIGHT: PgDn, Right forward; PgUp, Left back; Home, End the ends. They
// are the viewer's alone (the plot's keys stand down while the library is open; Fusion's would nudge its photograph).
window.addEventListener("keydown", e => {
  if (!libraryIsOpen() || !$("libr").classList.contains("md") || $("libmd").hidden || !nbLight() || e.ctrlKey || e.metaKey || e.altKey || typingIn()) return;
  const d = { PageDown: 1, ArrowRight: 1, PageUp: -1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[e.key];
  if (d === undefined) return;
  e.preventDefault(); e.stopImmediatePropagation(); nbTurn(d);
}, { capture: true });
// The run sheet at the front of a mission notebook (#29 slice f; the operator, 2026-10-07: the notebook is the tape's
// operator's manual and opens with every event on the tape): the reel's event listing, generated when it was packed
// (tools/pack.py; config.js SCNS[id].listing), so the notebook restates no run-deck data. It opens on the situations
// and the milestones, with a line that shows every entry (libRunSheet). One row per entry: its
// quick-view key, g.e.t., kind, name and, for a situation, its default camera (view, target, field). Picking one loads
// the reel as a fresh run (reels.js reelParams, by=mount: its situation defaults, the clock stopped) and then goes to
// the entry as the event list does (timeline.js tlPick), on a plot tab: in the room the viewer closes onto the
// workbench's page (Esc goes back to the room), in Tabbed onto the page. Built from DOM nodes and text only. Ours.
function libRunSheet(rid) {
  const sc = SCNS[rid];
  if (!sc || !sc.listing.length) return null;
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const keyOf = id => Object.keys(sc.quick).find(k => sc.quick[k] === id) || "";
  const sec = mk("section", "runsheet"), tbl = mk("table"), head = mk("tr"), body = mk("tbody");
  // Shown at first (the operator, 2026-10-08): the situations, the timeline's Noteworthy milestones (timeline.js
  // tlNoteworthy) and any event on a quick-view key; a typed line below the table shows every entry in place, and
  // hides the rest again.
  const brief = e => e.kind === "situation" || keyOf(e.id) || tlNoteworthy([e.get, e.tl, e.name]);
  const nBrief = sc.listing.filter(brief).length, nAll = sc.listing.length;
  sec.append(mk("h2", "", `RUN SHEET - ${(REEL_LIB.find(r => r.manifest.id === rid)?.manifest.title || rid).toUpperCase()}`),
    mk("p", "", "Every entry on the tape, generated from the reel's situations and timeline when it was packed (ours); " +
      "shown first, the situations and the mission's milestones. " +
      "Pick one to load the reel as a fresh run, clock stopped, and go there: a situation applies its view, an event sets the time. " +
      "KEY is the entry's quick-view key in the simulation."));
  for (const h of ["KEY", "G.E.T.", "KIND", "ENTRY", "DEFAULT CAMERA"]) head.appendChild(mk("th", "", h));
  for (const e of sc.listing) {
    const sit = e.kind === "situation", tr = mk("tr", sit ? "rssit" : brief(e) ? "" : "rsmore"), b = mk("button", "", e.name);
    b.type = "button"; b.dataset.id = e.id;
    b.title = sit ? `Load the reel fresh and apply ${e.name}` : `Load the reel fresh and go to ${getStr(e.get)}`;
    b.onclick = () => libRunGo(rid, e.id);
    const name = mk("td", "rsn"); name.appendChild(b);
    tr.append(mk("td", "", keyOf(e.id)), mk("td", "", tlGetStr(e.get)), mk("td", "", sit ? "SITUATION" : e.tl), name,
      mk("td", "", sit ? `${e.view} ${e.target} ${e.fov === null ? "-" : e.fov + "°"}` : ""));
    body.appendChild(tr);
  }
  const thead = mk("thead"); thead.appendChild(head); tbl.append(thead, body); sec.appendChild(tbl);
  if (nBrief < nAll) {
    const more = mk("button", "rsall"), line = mk("p", "rsline");
    const label = () => { more.textContent = sec.classList.contains("full") ? `SHOW ONLY THE ${nBrief} SITUATIONS AND MILESTONES` : `SHOW ALL ${nAll} ENTRIES`; };
    more.type = "button"; label();
    more.onclick = () => { sec.classList.toggle("full"); label(); nbRecount(); };
    line.appendChild(more); sec.appendChild(line);
  }
  return sec;
}
// A run-sheet entry picked: the viewer closes onto a plot tab with the event list (Review unless Simulate or Print is
// showing), the reel mounts fresh, and the entry is picked.
function libRunGo(rid, eid) {
  const p = reelParams(rid), e = (SCNS[rid]?.listing || []).find(x => x.id === eid);
  if (!p || !e) return;
  if (roomIn) roomLibraryClose(); else libraryClose();
  if (!["review", "simulate", "print"].includes(tab)) setTab(roomIn && roomCanvasTab !== "fusion" ? roomCanvasTab : "review");
  loadReel(p);
  tlPick(e);
  syncUI();
}
/** Open the library, with document `id` or notebook "nb-<reel id>" (else the last one shown, else the first). Open, it
 *  is on the Esc stack (esc.js): Esc closes it (opened from the bookcase or the rack, room.js makes it go back there). */
function libraryOpen(id) {
  if (!$("liblist").children.length) libList();
  $("libr").classList.add("open");
  escPush("library", libraryClose);
  libShow(id || libCur?.id);
}
function libraryClose() { $("libr").classList.remove("open"); escDrop("library"); libMdClear(); }
const libraryIsOpen = () => $("libr").classList.contains("open");
// "Load this reel": in the room the viewer closes and the reel is out at the rack, carried to a drive (room.js
// roomCarry); in Tabbed it is mounted at once (reels.js reelMount) and the library closes over the loaded reel.
function libLoad() {
  const id = libCur?.reel?.manifest.id;
  if (!id) return;
  if (roomIn) { roomCarry(id); return; }
  roomLibraryClose(); reelMount(id);   // roomLibraryClose: the library closed, and no room origin left behind
}
$("blib").onclick = () => libraryOpen();
$("blibclose").onclick = libraryClose;
$("blibload").onclick = libLoad;
$("bliblist").onclick = () => { $("libr").classList.remove("md"); $("bliblist").hidden = true; };
