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
  $("libmd").hidden = !md; $("blibload").hidden = !md; $("bliblist").hidden = !md;
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
// own SVG (never inlined). A text the renderer refuses (too long) or fails on is shown as plain text.
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
  try { $("libmd").replaceChildren(nbBuild(nbParse(n.reel.notebook.text), document, fig)); }
  catch (e) {
    const pre = document.createElement("pre");
    pre.textContent = n.reel.notebook.text;
    $("libmd").replaceChildren(pre);
    console.warn(`notebook ${id}: shown as text (${e.message})`);
  }
  const sheet = libRunSheet(n.reel.manifest.id);
  if (sheet) $("libmd").prepend(sheet);
  $("libmd").scrollTop = 0;
}
// The run sheet at the front of a mission notebook (#29 slice f; the operator, 2026-10-07: the notebook is the tape's
// operator's manual and opens with every event on the tape): the reel's event listing, generated when it was packed
// (tools/pack.py; config.js SCNS[id].listing), so the notebook restates no run-deck data. One row per entry: its
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
  sec.append(mk("h2", "", `RUN SHEET - ${(REEL_LIB.find(r => r.manifest.id === rid)?.manifest.title || rid).toUpperCase()}`),
    mk("p", "", "Every entry on the tape, generated from the reel's situations and timeline when it was packed (ours). " +
      "Pick one to load the reel as a fresh run, clock stopped, and go there: a situation applies its view, an event sets the time. " +
      "KEY is the entry's quick-view key in the simulation."));
  for (const h of ["KEY", "G.E.T.", "KIND", "ENTRY", "DEFAULT CAMERA"]) head.appendChild(mk("th", "", h));
  for (const e of sc.listing) {
    const sit = e.kind === "situation", tr = mk("tr", sit ? "rssit" : ""), b = mk("button", "", e.name);
    b.type = "button"; b.dataset.id = e.id;
    b.title = sit ? `Load the reel fresh and apply ${e.name}` : `Load the reel fresh and go to ${getStr(e.get)}`;
    b.onclick = () => libRunGo(rid, e.id);
    const name = mk("td", "rsn"); name.appendChild(b);
    tr.append(mk("td", "", keyOf(e.id)), mk("td", "", tlGetStr(e.get)), mk("td", "", sit ? "SITUATION" : e.tl), name,
      mk("td", "", sit ? `${e.view} ${e.target} ${e.fov === null ? "-" : e.fov + "°"}` : ""));
    body.appendChild(tr);
  }
  const thead = mk("thead"); thead.appendChild(head); tbl.append(thead, body); sec.appendChild(tbl);
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
  libraryClose(); reelMount(id);
}
$("blib").onclick = () => libraryOpen();
$("blibclose").onclick = libraryClose;
$("blibload").onclick = libLoad;
$("bliblist").onclick = () => { $("libr").classList.remove("md"); $("bliblist").hidden = true; };
