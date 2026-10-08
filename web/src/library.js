// The reference library (ours): the documents in web/library/ (library.json, inlined by tools/assemble.py as #flib),
// listed beside the browser's own PDF viewer in an iframe, and after them the reels' scenario notebooks (#29: each
// REEL_LIB reel that carries notebook/notebook.md), shown by the notebook viewer (notebook.js) in place of the iframe,
// with "Load this reel". Opened from Source's [ LIBRARY ], from the Reels group's "Read the notebook" (reels.js) or, in
// the room, from the bookcase or one of its binders, or a notebook binder on the tape rack (room.js). On a narrow screen
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
let libBlobs = [];   // the shown notebook's figure URLs, revoked when it goes
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
  if (nbs.length) ul.appendChild(libSection("SCENARIO NOTEBOOKS"));
  for (const n of nbs) ul.appendChild(libRow(n.id, n.reel.manifest.title, n.title, `${n.reel.notebook.figures.size} figures · our notes, rendered by this kernel`));
  if (libCur) libShow(libCur.id);
}
// The shown notebook's figure URLs go (and the viewer is emptied).
function libFigFree() { for (const u of libBlobs) URL.revokeObjectURL(u); libBlobs = []; $("libmd").textContent = ""; }
// The viewer as a document's (PDF) or a notebook's: which of the iframe and the article shows, and the buttons.
function libMode(md) {
  $("libr").classList.toggle("md", md);
  $("libmd").hidden = !md; $("blibload").hidden = !md; $("bliblist").hidden = !md;
  $("libnew").hidden = $("libsrc").hidden = md;
  if (md) { $("libframe").hidden = true; $("libframe").removeAttribute("src"); $("libnote").hidden = true; }
  else libFigFree();
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
// A reel's notebook in the viewer: its text built by notebook.js, each figure an <img> from a blob: URL of the reel's
// own SVG bytes (never inlined: an <img> runs no SVG script), revoked when another is shown or the library closes.
function libShowNb(id) {
  const n = libNotebooks().find(x => x.id === id);
  if (!n) { libShow(LIB[0]?.id); return; }
  if (libCur?.id === id && $("libmd").childNodes.length) { libMode(true); return; }
  libFigFree(); libMode(true);
  libCur = { id, reel: n.reel };
  document.querySelectorAll("#liblist .librow").forEach(b => b.classList.toggle("on", b.dataset.id === id));
  document.querySelector("#liblist .librow.on")?.scrollIntoView({ block: "nearest" });
  $("libtitle").textContent = `${n.reel.manifest.title} — scenario notebook (ours), carried in the reel`;
  const figs = n.reel.notebook.figures, urls = new Map();
  const fig = name => {
    if (!figs.has(name)) return null;
    if (!urls.has(name)) { const u = URL.createObjectURL(new Blob([figs.get(name)], { type: "image/svg+xml" })); urls.set(name, u); libBlobs.push(u); }
    return urls.get(name);
  };
  $("libmd").replaceChildren(nbBuild(nbParse(n.reel.notebook.text), document, fig));
  $("libmd").scrollTop = 0;
}
/** Open the library, with document `id` or notebook "nb-<reel id>" (else the last one shown, else the first). Open, it
 *  is on the Esc stack (esc.js): Esc closes it (opened from the bookcase or the rack, room.js makes it go back there). */
function libraryOpen(id) {
  if (!$("liblist").children.length) libList();
  $("libr").classList.add("open");
  escPush("library", libraryClose);
  libShow(id || libCur?.id);
}
function libraryClose() { $("libr").classList.remove("open"); escDrop("library"); libFigFree(); }
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
