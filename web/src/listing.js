// The FORTRAN listing overlay, dark terminal or LIGHT greenbar.
"use strict";
// Listing overlay: DARK terminal or LIGHT greenbar; the light sheets are built on first use.
const fieldata = t => t.toUpperCase().replace(/"/g, "'").replace(/[^A-Z0-9 @\[\]#)\-+<=>&$*(%:?!,\\';\/.]/g, "?");   // FIELDATA printable set per fourmilab.ch/documents/univac/fieldata.html (octal 00-77, ASCII-representable characters); it has no double quote, so " prints as '
// The kernel arrives as its elements, each after a line of a form feed and its source path (tools/assemble.py).
// Text before the first such line (all of it on the dev page) is one element with no name.
const ELEMENTS = $("fsrc").textContent.split(/^\f/m).map((p, i) => {
  const nl = p.indexOf("\n"), file = i ? p.slice(0, nl) : "";
  return { file, name: file.replace(/^.*\//, "").replace(/\.f$/, "").toUpperCase(), src: i ? p.slice(nl + 1) : p, inc: file.endsWith(".inc") };
}).filter(e => e.file || e.src);
// DARK: each element under a banner naming it, as a compile listing heads each element.
const RULE = "=".repeat(72);
$("lst").textContent = ELEMENTS.map(e => e.file ? `${RULE}\n ${e.inc ? "INCLUDE" : "ELEMENT"} ${e.name}   (${e.file})\n${RULE}\n${e.src}` : e.src).join("\n");
// LIGHT: each element starts a new sheet and numbers its own lines; the sheet header names the element. A sheet is
// 66 lines: the header, a blank and 64 lines of text. The sheets' lines are shared with the fresh copy and the PDF
// (printout.js).
const SHEET_TEXT = 64;
let listingSheets = null;
function listingPages() {
  if (listingSheets) return listingSheets;
  listingSheets = [];
  for (const e of ELEMENTS) {
    const lines = e.src.replace(/\t/g, "        ").split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    for (let first = 0; first < lines.length; first += SHEET_TEXT) {
      const head = "VIEW-1108 KERNEL LISTING (OUR RECONSTRUCTION)   " + (e.name ? (e.inc ? "INCLUDE " : "ELEMENT ") + fieldata(e.name) + "   " : "") + "PAGE " + (listingSheets.length + 1);
      const text = [];
      for (let i = first; i < Math.min(lines.length, first + SHEET_TEXT); i++) text.push(String(i + 1).padStart(5, " ") + "  " + fieldata(lines[i]));
      listingSheets.push({ lines: [head, "", ...text] });
    }
  }
  return listingSheets;
}
function buildPaper() {
  const paper = $("paper"); if (paper.dataset.built) return; paper.dataset.built = "1";
  for (const s of listingPages()) {
    const el = document.createElement("div"), pre = document.createElement("pre"); el.className = "pg";
    pre.textContent = s.lines.join("\n") + "\n"; el.appendChild(pre); paper.appendChild(el);
  }
}
let listingLight = UP.get("listing") ? UP.get("listing") === "light" : prefs.listing === "light";   // ?listing=dark|light
function applyListing() {
  const light = listingLight;
  $("list").classList.toggle("light", light); $("blist").textContent = light ? "Dark" : "Light";
  if (light) buildPaper();
}
$("blist").onclick = () => { listingLight = !listingLight; prefs.listing = listingLight ? "light" : "dark"; savePrefs(); applyListing(); };
$("bsrc").onclick = () => { applyListing(); $("list").classList.add("open"); };
$("bclose").onclick = () => $("list").classList.remove("open");
