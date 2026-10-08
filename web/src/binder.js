// The notebook's binder (#29 slice g; the operator, 2026-10-07; ours): the reading view of the library's notebook viewer
// (library.js libShowNb). LIGHT, the default, is typed pages in an open three-ring binder on a desk, one page or a
// two-page spread; page.css lays the pages out as CSS columns of a fixed height, scrolled sideways a view at a time,
// and this module is the paging (the plate's buttons, the keys, the page count) and the remembered toggle. DARK is the
// viewer as it was before. Two classes on #libmd. ?notebook=light|dark holds one for the visit; the viewer's toggle
// drops that and keeps its choice (prefs.notebook), as the listing's does.
"use strict";
let nbTheme = ["light", "dark"].includes(UP.get("notebook")) ? UP.get("notebook") : prefs.notebook === "dark" ? "dark" : "light";
let nbShown = 0;   // the first page (column) of the view shown, kept across a reflow
const nbLight = () => nbTheme === "light";
const nbPages = () => $("libmd").querySelector(".nbpages");
// The notebook `kids` (its run sheet and its text) put into `md` (#libmd) in the binder's wrappers (#libmd > .nbbinder
// > .nbpages, the end marker .nbend last), with the paging plate after it, opened at its first page.
function nbBind(md, kids) {
  const binder = document.createElement("div"), pages = document.createElement("div"), end = document.createElement("div");
  binder.className = "nbbinder"; pages.className = "nbpages"; end.className = "nbend";
  pages.append(...kids, end);
  pages.addEventListener("scroll", () => nbPageSync());
  pages.addEventListener("scrollend", nbSettle);
  pages.addEventListener("load", nbRecount, true);   // a figure decoded: the columns may have moved on
  binder.appendChild(pages);
  md.replaceChildren(binder, nbNav());
  nbShown = 0;
  nbApplyTheme();
}
// The view's class on #libmd and the toggle's label; back in LIGHT the binder opens on the page it showed (nbShown is
// kept while DARK shows the notebook as a column).
function nbApplyTheme() {
  $("libmd").classList.toggle("light", nbLight()); $("libmd").classList.toggle("dark", !nbLight());
  $("blibtheme").textContent = nbLight() ? "Dark" : "Light";
  $("libmd").scrollTop = 0;
  nbRecount();
}
$("blibtheme").onclick = () => { nbTheme = nbLight() ? "dark" : "light"; prefs.notebook = nbTheme; savePrefs(); nbApplyTheme(); };
// Measurable only while the binder is laid out: in LIGHT, shown, and with a width (on a narrow screen the library's
// list can hide the viewer while #libmd keeps its place).
const nbReady = pg => !!pg && nbLight() && !$("libmd").hidden && pg.clientWidth > 0;
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
  if (!nbReady(pg)) return;
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
  if (!at || !nbReady(pg)) return;
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
  if (!nbReady(pg)) return;
  const g = nbGeom(pg), v = Math.max(0, Math.min(Math.round(pg.scrollLeft / g.step) + d, nbLastView(g)));
  pg.scrollTo({ left: v * g.step, behavior: "instant" });
  nbPageSync();
}
// A swipe or a wheel that stopped between views (a spread has no snap points of its own), or past the last, is put on
// the nearest view.
function nbSettle() {
  const pg = nbPages();
  if (!nbReady(pg)) return;
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
