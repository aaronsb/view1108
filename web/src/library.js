// The reference library (ours): the documents in web/library/ (library.json, inlined by tools/assemble.py as #flib),
// listed beside the browser's own PDF viewer in an iframe. Opened from Source's [ LIBRARY ] or, in the room, from the
// bookcase or one of its binders (room.js). On a narrow screen the list carries only the links, since built-in PDF
// viewers in iframes are unreliable on phones. Where the PDFs are not beside the page (opened from file://, or a 404),
// the viewer gives way to the document's source URL.
"use strict";
let LIB = [];
try { LIB = JSON.parse($("flib").textContent); } catch (e) { /* the dev page: fetched below */ }
if (!LIB.length) fetch("library/library.json").then(r => r.ok ? r.json() : []).then(d => { LIB = d; libList(); }).catch(() => {});
let libCur = null;   // the document shown
const libHere = new Map();   // file -> Promise<boolean>: is the PDF served beside the page
const libPath = d => "library/" + d.file;
function libServed(d) {
  if (location.protocol === "file:") return Promise.resolve(false);
  if (!libHere.has(d.file)) libHere.set(d.file, fetch(libPath(d), { method: "HEAD" }).then(r => r.ok && /pdf/.test(r.headers.get("content-type") || ""), () => false));
  return libHere.get(d.file);
}
const libNarrow = () => !matchMedia("(min-width:1000px)").matches;
function libList() {
  const ul = $("liblist"); ul.textContent = "";
  for (const d of LIB) {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.dataset.id = d.id; b.className = "librow";
    b.innerHTML = `<span class="libnum"></span><span class="libt"></span><span class="libm"></span>`;
    b.querySelector(".libnum").textContent = d.num;
    b.querySelector(".libt").textContent = d.title;
    b.querySelector(".libm").textContent = `${d.year} · ${d.publisher} · ${d.pages} pp.`;
    b.onclick = () => libShow(d.id);
    const links = document.createElement("span"); links.className = "liblinks";
    links.innerHTML = `<a target="_blank" rel="noopener">Open</a> <a target="_blank" rel="noopener">Source</a>`;
    const [open, src] = links.querySelectorAll("a");
    open.href = libPath(d); src.href = d.source;
    libServed(d).then(ok => { if (!ok) open.href = d.source; });
    li.append(b, links); ul.appendChild(li);
  }
  if (libCur) libShow(libCur.id);
}
function libShow(id) {
  const d = LIB.find(x => x.id === id) || LIB[0];
  if (!d) return;
  libCur = d;
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
/** Open the library, with document `id` (else the last one shown, else the first). */
function libraryOpen(id) {
  if (!$("liblist").children.length) libList();
  $("libr").classList.add("open");
  libShow(id || libCur?.id);
}
function libraryClose() { $("libr").classList.remove("open"); }
const libraryIsOpen = () => $("libr").classList.contains("open");
$("blib").onclick = () => libraryOpen();
$("blibclose").onclick = libraryClose;
// Esc closes it (in the room, room.js takes Esc first and goes back to the bookcase).
window.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.defaultPrevented || !libraryIsOpen()) return;
  e.preventDefault(); libraryClose();
});
