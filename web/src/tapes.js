// The tape file browser (ours, #74; RESTOMOD, no period source for this screen): a read-only page overlay listing the
// package members of the mounted reel, opened from the operator console's seat in the room (web/lab console4009.ts: E,
// Enter or a click on the console; room.js hands tapesOpen to the lab as hooks.browse). Rows come from the reel's
// manifest (reelpkg.js readReel): manifest.json first, then each member of its contents list with its type and size
// in bytes. A text member shows monospaced, JSON pretty-printed, a run or playlist deck as numbered cards, and a figure
// or photograph as an <img> whose src is a data: URL, as the notebook viewer builds it (library.js libDataUrl,
// libFigUrl; a figure holds no script, reelpkg.js). Everything is built from DOM nodes and textContent, no innerHTML.
// It refreshes when the mounted reel changes. Open, it is on the Esc stack as "tapes" (esc.js); Esc, like its button,
// returns to the console's seat, and no other key reaches the room behind it. The typefaces are the page's bundled ones.
"use strict";
let tapesOn = false, tapesReel = null, tapesRowsOf = [], tapesSel = null, tapesTimer = 0, tapesPrev = null;
const TAPES_KIND = { manifest: "manifest", page: "page.json", scn: "run deck", playlist: "playlist deck", notebook: "notebook", figure: "figure", media: "photograph" };
const tapesEnc = new TextEncoder();
const tapesMounted = () => REEL_LIB.find(r => r.manifest.id === reelMounted()) || null;
// The reel's package members: [{path, type, kind, size, img}], img the data: URL of a figure or photograph.
function tapesRows(r) {
  const media = r.media || new Map();   // the reel's photographs (#75: media members belong to the reel)
  const rows = [{ path: "manifest.json", type: "manifest", kind: TAPES_KIND.manifest, size: tapesEnc.encode(JSON.stringify(r.manifest, null, 2)).length }];
  for (const e of r.manifest.contents) {
    const row = { path: e.path, type: e.type, kind: TAPES_KIND[e.type] || String(e.type), size: 0, img: null };
    if (e.type === "media") {
      const m = media.get(e.path.replace(/^media\//, ""));
      if (m) { row.size = m.bytes.length; row.img = libDataUrl(m.type, m.bytes); }
    } else {
      const t = r.files.get(e.path);
      if (t !== undefined) row.size = tapesEnc.encode(t).length;
      if (e.type === "figure" && t !== undefined) row.img = libFigUrl(t);
    }
    rows.push(row);
  }
  return rows;
}
function tapesText(r, row) {
  if (row.path === "manifest.json") return JSON.stringify(r.manifest, null, 2);
  const t = r.files.get(row.path) ?? "";
  if (/\.json$/.test(row.path)) { try { return JSON.stringify(JSON.parse(t), null, 2); } catch (e) { return t; } }
  return t;
}
const tapesSize = n => n < 1024 ? n + " B" : (n / 1024).toFixed(1) + " KB";
function tapesBuild() {
  const r = tapesReel = tapesMounted(), ul = $("tapeslist");
  ul.textContent = "";
  $("tapestitle").textContent = r ? `TAPE VIEWTP · ${r.manifest.title || r.manifest.id} · ${r.manifest.kind} reel` : "TAPE FILE BROWSER · NO REEL MOUNTED";
  if (!r) { $("tapesname").textContent = ""; $("tapescontent").textContent = "No reel is mounted on the drive."; tapesSel = null; return; }
  const rows = tapesRowsOf = tapesRows(r);
  for (const row of rows) {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.dataset.path = row.path;
    for (const [cls, txt] of [["tpn", row.path], ["tpk", row.kind], ["tps", tapesSize(row.size)]]) {
      const s = document.createElement("span"); s.className = cls; s.textContent = txt; b.appendChild(s);
    }
    b.onclick = () => tapesSelect(row.path);
    li.appendChild(b); ul.appendChild(li);
  }
  tapesSelect(rows.some(x => x.path === tapesSel) ? tapesSel : rows[0].path);
}
function tapesSelect(path) {
  const r = tapesReel, row = r && tapesRowsOf.find(x => x.path === path), box = $("tapescontent");
  if (!row) return;
  tapesSel = path;
  for (const li of $("tapeslist").children) li.firstChild.classList.toggle("on", li.firstChild.dataset.path === path);
  $("tapesname").textContent = `${row.path} · ${row.kind} · ${row.size} bytes`;
  box.textContent = ""; box.className = "";
  if (row.img && row.img.startsWith("data:image/")) {   // a figure or photograph, as a data: URL (a document of its own origin; no markup is inserted)
    const img = document.createElement("img");
    img.alt = row.path; img.src = row.img; box.className = "img"; box.appendChild(img);
    return;
  }
  const text = tapesText(r, row), pre = document.createElement("pre");
  if (row.type === "scn" || row.type === "playlist") {   // a deck: one card per line, numbered, lined up
    box.className = "deck";
    text.replace(/\n$/, "").split("\n").forEach((l, i) => {
      const c = document.createElement("div"), n = document.createElement("span"), t = document.createElement("span");
      c.className = "card"; n.className = "cn"; n.textContent = String(i + 1).padStart(4, "0"); t.textContent = l;
      c.append(n, t); pre.appendChild(c);
    });
  } else pre.textContent = text;
  box.appendChild(pre);
}
function tapesOpen() {
  if (tapesOn) return;
  tapesOn = true; tapesPrev = document.activeElement;
  $("tapes").hidden = false; tapesBuild();
  escPush("tapes", tapesClose);
  clearInterval(tapesTimer); tapesTimer = setInterval(() => { if (tapesMounted() !== tapesReel) tapesBuild(); }, 400);   // the mounted reel changed
  $("tapeslist").querySelector("button.on")?.focus();
}
function tapesClose() {
  if (!tapesOn) return;
  tapesOn = false; $("tapes").hidden = true; escDrop("tapes"); clearInterval(tapesTimer);
  const to = document.body.classList.contains("room") ? $("labhost").querySelector("canvas") : tapesPrev;
  if (to && to.tagName === "CANVAS" && !to.hasAttribute("tabindex")) to.setAttribute("tabindex", "-1");
  if (to && to !== document.body && to.focus) to.focus({ preventScroll: true });
}
$("btapesclose").onclick = tapesClose;
window.addEventListener("keydown", e => {   // a capture listener added before the room's: no key but Esc (esc.js) goes past it
  if (!tapesOn || e.key === "Escape") return;
  e.stopImmediatePropagation();
  const btns = [...$("tapeslist").querySelectorAll("button")], i = btns.indexOf(document.activeElement), d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
  if (d && btns.length && i >= 0) { e.preventDefault(); const b = btns[Math.max(0, Math.min(btns.length - 1, i + d))]; b.focus(); b.click(); }
}, true);
if (DEBUG) window.VIEW_TAPES = {   // test hooks: the browser's state, and picking a member
  state: () => ({ open: tapesOn, reel: tapesReel && tapesReel.manifest.id, title: $("tapestitle").textContent, sel: tapesSel,
    rows: [...$("tapeslist").children].map(li => [...li.firstChild.children].map(s => s.textContent)),
    kind: $("tapescontent").className, text: $("tapescontent").textContent, img: $("tapescontent").querySelector("img")?.getAttribute("src") ?? null,
    cards: $("tapescontent").querySelectorAll(".card").length }),
  select: tapesSelect, open: tapesOpen, close: tapesClose,
};
