// The FORTRAN listing overlay, dark terminal or LIGHT greenbar.
"use strict";
// Listing overlay: DARK terminal or LIGHT greenbar; the light sheets are built on first use.
const fieldata = t => t.toUpperCase().replace(/[^A-Z0-9 @\[\]#)\-+<=>&$*(%:?!,\\';\/.]/g, "?");   // FIELDATA printable set per fourmilab.ch/documents/univac/fieldata.html (octal 00-77, ASCII-representable characters)
function buildPaper() {
  const paper = $("paper"); if (paper.dataset.built) return; paper.dataset.built = "1";
  const lines = $("fsrc").textContent.replace(/\t/g, "        ").split("\n"), PER = 64;   // 64 text lines + header + blank = 66
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  for (let pg = 0; pg * PER < lines.length; pg++) {
    const el = document.createElement("div"), pre = document.createElement("pre"); el.className = "pg";
    let txt = "VIEW-1108 FORTRAN LISTING (OUR RECONSTRUCTION)   PAGE " + (pg + 1) + "\n\n";
    for (let i = pg * PER; i < Math.min(lines.length, (pg + 1) * PER); i++) txt += String(i + 1).padStart(5, " ") + "  " + fieldata(lines[i]) + "\n";
    pre.textContent = txt; el.appendChild(pre); paper.appendChild(el);
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
