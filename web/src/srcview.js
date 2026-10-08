// Source tab: the kernel's FORTRAN as a browser. Tree (files, units, their statement outline, COMMON blocks,
// PARAMETERs) | listing | inspector, with history, quick-open and deep links (?code=). Data from srcindex.js.
"use strict";
const SV = { built: false, path: null, unit: null, sel: null, hl: null, folds: new Set(), hidden: [], hist: [], hi: -1, qo: [], qi: 0 };
const SX_GROUPS = ["Driver", "Dispatcher", "Core", ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => "Layer " + n), "Data", "Include"];
const sxEsc = s => SX.esc(String(s ?? ""));
const sxBadge = k => ({ subroutine: "S", function: "F", "block data": "B", entry: "E" })[k] || "?";
const sxFirst = d => (d || "").split("\n")[0];
// A doc comment reflowed for the inspector's width: a line runs on into the next unless it is short (a paragraph's
// end) or the next is indented (a table or list row).
const sxDoc = d => `<div class="sx-doc">${sxEsc(d.split("\n").reduce((a, l, i, L) => a + (i && L[i - 1].trim() && l.trim() && L[i - 1].length >= 40 && !/^\s/.test(l) ? " " : i ? "\n" : "") + l, ""))}</div>`;
const sxSig = u => (u.type ? u.type + " " : "") + (u.kind === "block data" ? "BLOCK DATA " + u.name : u.kind.toUpperCase() + " " + u.name + "(" + u.args.join(", ") + ")");

// ---- building the workspace (on first entry to the tab) ----
function srcBuild() {
  const ws = $("srcws"), bsrc = $("bsrc"), blib = $("blib");
  bsrc.remove(); blib.remove(); bsrc.textContent = "Print listing"; bsrc.title = "The kernel as a period compile listing (dark terminal or greenbar paper)";
  ws.innerHTML = `<div id="sxbar">
    <button id="sxfiles" title="Files and units" aria-controls="sxtree">Files</button>
    <button id="sxback" title="Back (Alt+Left)" aria-label="Back">&larr;</button><button id="sxfwd" title="Forward (Alt+Right)" aria-label="Forward">&rarr;</button>
    <button id="sxgo" title="Go to a unit, COMMON block, member, PARAMETER or file (Ctrl+P or /)">Go to&hellip; <kbd>/</kbd></button>
    <span id="sxcrumb"></span><span class="sp"></span></div>
  <nav id="sxtree" aria-label="Kernel files and units"><input id="sxfilter" type="search" placeholder="Filter: units, COMMON, PARAMETERs, files" aria-label="Filter the tree" autocomplete="off" spellcheck="false"><div id="sxtl"></div></nav>
  <div id="sxlist" aria-label="Listing"><div id="sxlines"></div></div>
  <aside id="sxinsp" aria-label="Inspector"></aside>
  <div id="sxqo" hidden role="dialog" aria-label="Go to"><input id="sxqi" type="search" placeholder="Unit, /COMMON/, member, PARAMETER, file or file:line" autocomplete="off" spellcheck="false"><div id="sxql" role="listbox"></div></div>
  <div id="sxtip" hidden role="tooltip"></div>`;
  $("sxbar").append(bsrc, blib);
  $("sxtl").innerHTML = sxTree();
  ws.addEventListener("click", sxClick);
  ws.addEventListener("toggle", e => { const d = e.target; if (d.matches?.("details.sx-tu") && d.open && !d.dataset.done) { d.dataset.done = "1"; d.insertAdjacentHTML("beforeend", sxOutline(SX.unit[d.dataset.u])); } }, true);
  $("sxlist").addEventListener("mouseover", sxTip); $("sxlist").addEventListener("mouseleave", () => { $("sxtip").hidden = true; });
  $("sxfilter").addEventListener("input", sxFilter);
  $("sxqi").addEventListener("input", sxQuickList);
  $("sxqi").addEventListener("keydown", sxQuickKey);
  $("sxback").onclick = () => sxHist(-1); $("sxfwd").onclick = () => sxHist(1);
  $("sxgo").onclick = sxQuickOpen;
  $("sxfiles").onclick = () => $("sxtree").classList.toggle("open");
}
function srcShow() {
  if (SV.built) return;
  SV.built = true; srcBuild();
  sxGo(sxParse(UP.get("code")) || sxParse("VFRAME") || { path: SX.sym.files.find(f => SX.src[f.path])?.path });
}

// ---- tree ----
function sxTree() {
  let h = "";
  for (const g of SX_GROUPS) {
    const fs = SX.sym.files.filter(f => f.kind === g); if (!fs.length) continue;
    h += `<details class="sx-tg" open><summary>${g}</summary>`;
    for (const f of fs) {
      h += `<details class="sx-tf" data-f="${f.path}"><summary data-go="f:${f.path}" title="${sxEsc(sxFirst(f.doc))}">${SX.base(f.path)}<small>${f.lines}</small></summary>`;
      for (const u of SX.unitsIn[f.path] || []) h += u.outline?.length
        ? `<details class="sx-tu" data-u="${u.name}"><summary data-go="u:${u.name}"><i class="sx-b">${sxBadge(u.kind)}</i>${u.name}</summary></details>`
        : `<div class="sx-tu sx-leaf" data-u="${u.name}" data-go="u:${u.name}"><i class="sx-b">${sxBadge(u.kind)}</i>${u.name}</div>`;
      h += "</details>";
    }
    h += "</details>";
  }
  h += `<details class="sx-tg"><summary>COMMON blocks</summary>`;
  for (const b of Object.keys(SX.sym.common).sort()) h += `<details class="sx-tc"><summary data-go="c:${b}">/${b}/<small>${SX.sym.common[b].members.length}</small></summary>`
    + SX.sym.common[b].members.map(m => `<div class="sx-leaf" data-go="m:${m}">${m}<small>${sxEsc(SX.typeStr(SX.sym.common[b].types?.[m]))}</small></div>`).join("") + "</details>";
  h += `</details><details class="sx-tg"><summary>PARAMETERs</summary>`;
  for (const p of Object.keys(SX.sym.parameters).sort()) h += `<div class="sx-leaf" data-go="p:${p}">${p}<small>= ${sxEsc(SX.sym.parameters[p].expr)}</small></div>`;
  return h + "</details>";
}
// Outline of a unit: DO and block IF nesting, GO TO (with every target), CALL, RETURN/STOP, labels.
function sxOutline(u) {
  const at = n => `data-go="l:${u.file}:${n.line}" style="--d:${n.depth}"`, rng = n => `<small>${n.line}&ndash;${n.end}</small>`;
  const lab = l => `<a class="sx-ol" data-go="g:${u.name}:${l}" title="Go to label ${l}">${l}</a>`;
  return `<div class="sx-ot">` + (u.outline || []).map(n => {
    const c = n.cond ? `<span class="sx-oc">IF&rarr;</span> ` : "";
    switch (n.k) {
      case "do": return `<div class="sx-on" ${at(n)}><b>DO</b> ${n.label ? lab(n.label) + " " : ""}${sxEsc(n.t)} ${rng(n)}</div>`;
      case "if": return `<div class="sx-on" ${at(n)}><b>IF</b> ${sxEsc(n.t.replace(/^IF\s*/, ""))} ${rng(n)}</div>`;
      case "goto": return `<div class="sx-on" ${at(n)}>${c}<b>${n.arith ? "IF" : "GO TO"}</b> ${n.to.length > 1 && !n.arith ? "(" + n.to.map(lab).join(" ") + "), " + sxEsc(n.on) : n.to.map(lab).join(" ")}</div>`;
      case "call": return `<div class="sx-on" ${at(n)}>${c}<b>CALL</b> <a data-go="u:${n.name}">${n.name}</a></div>`;
      case "label": return `<div class="sx-on sx-olab" ${at(n)}><span class="sx-lab">${n.label}</span> ${n.stmt === "CONTINUE" ? "CONTINUE" : sxEsc(n.stmt)}</div>`;
      default: return `<div class="sx-on" ${at(n)}>${c}<b>${n.k.toUpperCase()}</b></div>`;
    }
  }).join("") + "</div>";
}
function sxFilter() {
  const q = $("sxfilter").value.trim().toUpperCase(), tl = $("sxtl");
  if (!q) { tl.innerHTML = sxTree(); sxTreeMark(); return; }
  const hit = s => s.toUpperCase().includes(q), row = (go, t, small) => `<div class="sx-leaf" data-go="${go}">${t}<small>${sxEsc(small)}</small></div>`;
  const parts = [
    ["Units", SX.sym.units.filter(u => hit(u.name)).map(u => row("u:" + u.name, `<i class="sx-b">${sxBadge(u.kind)}</i>${u.name}`, SX.base(u.file)))],
    ["Files", SX.sym.files.filter(f => hit(f.path)).map(f => row("f:" + f.path, SX.base(f.path), f.kind))],
    ["COMMON", Object.keys(SX.sym.common).flatMap(b => [...(hit(b) ? [row("c:" + b, "/" + b + "/", SX.sym.common[b].members.length + " members")] : []),
      ...SX.sym.common[b].members.filter(hit).map(m => row("m:" + m, m, "/" + b + "/"))])],
    ["PARAMETERs", Object.keys(SX.sym.parameters).filter(hit).map(p => row("p:" + p, p, "= " + SX.sym.parameters[p].expr))]];
  tl.innerHTML = parts.filter(p => p[1].length).map(([h, r]) => `<div class="sx-fh2">${h} <small>${r.length}</small></div>` + r.slice(0, 150).join("")).join("") || `<p class="sx-none">No match.</p>`;
}
function sxTreeMark() {
  const tl = $("sxtl");
  tl.querySelectorAll(".on").forEach(e => e.classList.remove("on"));
  const u = SV.unit, f = tl.querySelector(`details.sx-tf[data-f="${SV.path}"]`);
  if (f) { f.open = true; f.closest(".sx-tg").open = true; }
  const el = u ? tl.querySelector(`.sx-tu[data-u="${u.name}"]`) : f;
  const lab = el && (el.tagName === "DETAILS" ? el.firstElementChild : el);
  if (lab) { lab.classList.add("on"); if (innerWidth >= 1000 || $("sxtree").classList.contains("open")) lab.scrollIntoView({ block: "nearest" }); }
}

// ---- the listing ----
function sxLoad(path) {
  const t0 = performance.now(), box = $("sxlines");
  SV.path = path; SV.folds.clear(); SV.hidden = []; SV.unit = null;
  if (!SX.src[path]) {
    const f = SX.fileOf[path];
    box.innerHTML = `<p class="sx-none">${sxEsc(SX.base(path))}: ${f?.kind === "Data" ? `the generated BLOCK DATA tables (${f.lines} lines, tools/gen_data.py), not embedded in the page.` : "source not embedded."}</p>`;
    return;
  }
  const r = SX.render(path); box.innerHTML = r.html;
  const L = box.children;
  for (const u of SX.unitsIn[path] || []) {
    for (const fm of u.restomod || []) for (let n = fm.from; n <= Math.min(fm.to, L.length); n++) { L[n - 1].classList.add("sx-rm"); L[n - 1].dataset.why = fm.why; }
    for (const n of u.outline || []) {
      const g = L[n.line - 1]?.children[1]; if (!g) continue;
      if ((n.k === "do" || n.k === "if") && n.end > n.line && !g.dataset.fold) { g.dataset.fold = n.end; g.textContent = "▾"; g.title = "Fold lines " + n.line + "–" + n.end; }
      else if (n.k === "goto" && !g.textContent) { g.dataset.go = `g:${u.name}:${n.to[0]}`; g.textContent = "↳"; g.title = "Go to label " + n.to[0]; }
    }
  }
  for (const fm of SX.fileOf[path]?.restomod || []) for (let n = fm.from; n <= Math.min(fm.to, L.length); n++) { L[n - 1].classList.add("sx-rm"); L[n - 1].dataset.why = fm.why; }
  SV.renderMs = performance.now() - t0;
}
function sxFold(line) {
  if (SV.folds.has(line)) SV.folds.delete(line); else SV.folds.add(line);
  const L = $("sxlines").children;
  for (const el of SV.hidden) el.classList.remove("sx-fh");
  SV.hidden = [];
  for (const el of $("sxlines").querySelectorAll(".sx-fd")) el.classList.remove("sx-fd");
  for (const l of SV.folds) {
    const g = L[l - 1].children[1], end = +g.dataset.fold;
    L[l - 1].classList.add("sx-fd"); L[l - 1].dataset.n = end - l;
    for (let n = l + 1; n <= end; n++) { L[n - 1].classList.add("sx-fh"); SV.hidden.push(L[n - 1]); }
  }
  for (const l of SV.folds) if (!L[l - 1].classList.contains("sx-fh")) L[l - 1].children[1].textContent = "▸";
  for (const g of $("sxlines").querySelectorAll(".sx-g[data-fold]")) if (!SV.folds.has(+g.parentNode.firstChild.textContent)) g.textContent = "▾";
}
function sxUnfoldTo(line) {   // a jump into a folded range opens it
  for (const l of [...SV.folds]) if (line > l && line <= +$("sxlines").children[l - 1].children[1].dataset.fold) sxFold(l);
}
function sxMarkUnit() {
  const box = $("sxlines"), L = box.children, u = SV.unit;
  for (const el of box.querySelectorAll(".sx-cu")) el.classList.remove("sx-cu");
  box.classList.toggle("has-cu", !!u);
  if (u) for (let n = u.start; n <= Math.min(u.end, L.length); n++) L[n - 1].classList.add("sx-cu");
}
function sxMarkUses(name) {
  const box = $("sxlines"), L = box.children, u = SV.unit;
  for (const el of box.querySelectorAll(".sx-hl")) el.classList.remove("sx-hl");
  if (!name) return 0;
  let k = 0;
  const lo = u ? u.start : 1, hi = u ? Math.min(u.end, L.length) : L.length;
  for (let n = lo; n <= hi; n++) for (const s of L[n - 1].querySelectorAll(".sx-id")) if (s.textContent.toUpperCase() === name) { s.classList.add("sx-hl"); k++; }
  return k;
}
function sxScroll(line, flash) {
  const el = $("sxlines").children[line - 1], box = $("sxlist"); if (!el) return;
  box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight * 0.2);
  if (flash) { el.classList.remove("sx-tgt"); void el.offsetWidth; el.classList.add("sx-tgt"); }
}

// ---- locations and history: {path, line, sel ("u:NAME", "f:PATH", "c:BLK", "m:NAME", "p:NAME", "v:NAME"), hl} ----
function sxParse(q) {
  if (!q) return null;
  q = q.trim();
  let m = /^\/(\w+)\/$/.exec(q);
  if (m) return sxLoc("c:" + m[1].toUpperCase());
  m = /^([\w.]+\.(?:f|inc))(?::(\d+))?$/i.exec(q);
  if (m) { const p = SX.pathOf(m[1].toLowerCase()); return p ? { path: p, line: m[2] ? +m[2] : null, sel: m[2] ? null : "f:" + p } : null; }
  const n = q.toUpperCase();
  if (SX.unit[n]) return sxLoc("u:" + n);
  if (SX.sym.parameters[n]) return sxLoc("p:" + n);
  if (SX.sym.common[n]) return sxLoc("c:" + n);
  if (SX.member[n]) return sxLoc("m:" + n);
  return null;
}
// Where a selection lives: a unit at its header, a COMMON block, member or PARAMETER at its definition.
function sxLoc(sel) {
  const [k, n] = [sel[0], sel.slice(2)];
  if (k === "u") { const u = SX.unit[n]; return u && { path: u.file, line: u.start, sel }; }
  if (k === "f") return { path: n, line: 1, sel };
  const def = k === "p" ? SX.sym.parameters[n] : SX.sym.common[k === "m" ? SX.member[n] : n];
  return def && { path: SX.pathOf(def.file), line: def.line, sel, hl: k === "c" ? null : n };
}
function sxGo(e, push = true) {
  if (!e || !e.path) return;
  if (push) { SV.hist = SV.hist.slice(0, SV.hi + 1); SV.hist.push(e); SV.hi = SV.hist.length - 1; }
  sxApply(e);
}
function sxHist(d) {
  const i = SV.hi + d; if (i < 0 || i >= SV.hist.length) return;
  SV.hi = i; sxApply(SV.hist[i]);
}
function sxApply(e) {
  if (e.path !== SV.path) sxLoad(e.path);
  const line = e.line || (e.sel?.startsWith("u:") ? SX.unit[e.sel.slice(2)].start : null);
  SV.unit = e.sel?.startsWith("u:") ? SX.unit[e.sel.slice(2)] : line ? SX.unitAt(e.path, line) : null;
  if (SV.unit?.kind === "entry") SV.unit = SX.unitAt(e.path, SV.unit.start);
  SV.sel = e.sel || (SV.unit ? "u:" + SV.unit.name : "f:" + e.path); SV.hl = e.hl || null;
  sxMarkUnit(); const uses = sxMarkUses(SV.hl);
  if (line) { sxUnfoldTo(line); sxScroll(line, !!e.line); } else $("sxlist").scrollTop = 0;
  $("sxinsp").innerHTML = sxCard(SV.sel, uses) + (SV.unit && SV.sel !== "u:" + SV.unit.name ? sxUnitCard(SV.unit) : "") + (!SV.unit && !SV.sel.startsWith("f:") ? sxFileCard(SX.fileOf[e.path]) : "");
  $("sxinsp").scrollTop = 0;
  $("sxcrumb").innerHTML = `${sxEsc(SX.fileOf[e.path]?.kind || "")} &rsaquo; <a data-go="f:${e.path}">${SX.base(e.path)}</a>` + (SV.unit ? ` &rsaquo; <a data-go="u:${SV.unit.name}">${SV.unit.name}</a> <small>${SV.unit.start}&ndash;${SV.unit.end}</small>` : "") + (line ? ` <small>line ${line}</small>` : "");
  $("sxback").disabled = SV.hi <= 0; $("sxfwd").disabled = SV.hi >= SV.hist.length - 1;
  if (!$("sxfilter").value) sxTreeMark();
}
// The link parameter for this place (link.js): a unit, /BLOCK/, a PARAMETER, else file:line.
function srcLinkParam() {
  const e = SV.hist[SV.hi]; if (!e) return null;
  const k = e.sel?.[0], n = e.sel?.slice(2);
  if (k === "u" && (!e.line || e.line === SX.unit[n]?.start)) return n;
  if (k === "c") return "/" + n + "/";
  if (k === "p" || k === "m") return n;
  return SX.base(e.path) + (e.line ? ":" + e.line : "");
}

// ---- inspector cards ----
const sxU = n => `<a data-go="u:${n}">${n}</a>`;
const sxChips = (a, f) => a.length ? `<div class="sx-chips">${a.map(f).join(" ")}</div>` : `<div class="sx-none">none</div>`;
const sxAt = (path, line, t) => `<a data-go="l:${path}:${line}">${t || SX.base(path) + ":" + line}</a>`;
function sxCard(sel, uses) {
  const k = sel[0], n = sel.slice(2);
  if (k === "u") return sxUnitCard(SX.unit[n]);
  if (k === "f") return sxFileCard(SX.fileOf[n]);
  if (k === "c") return sxBlockCard(n, null);
  if (k === "m") return sxBlockCard(SX.member[n] || SX.varOf(SV.unit, n)?.common, n);
  if (k === "p") return sxParamCard(n);
  if (k === "v") return sxVarCard(n, uses);
  return "";
}
function sxUnitCard(u) {
  if (!u) return "";
  const vt = n => SX.varOf(u, n), row = v => `<tr><td><a data-go="v:${v.name}">${v.name}</a></td><td title="${sxEsc(v.type)}">${sxEsc((v.type || "").replace("DOUBLE PRECISION", "DOUBLE"))}</td><td>${sxEsc(v.dims ? v.dims.join(", ") : "")}</td><td>${v.arg ? "arg " + (u.args.indexOf(v.name) + 1) : v.common ? `<a data-go="c:${v.common}">/${v.common}/</a>` : ""}</td></tr>`;
  const vars = [...(u.vars || [])].sort((a, b) => (b.arg ? 1 : 0) - (a.arg ? 1 : 0) || (a.arg ? u.args.indexOf(a.name) - u.args.indexOf(b.name) : 0));
  let h = `<section class="sx-card"><h3><i class="sx-b">${sxBadge(u.kind)}</i>${u.name} <small>${u.kind}${u.parent ? " in " + sxU(u.parent) : ""} &middot; ${sxAt(u.file, u.start, SX.base(u.file) + " " + u.start + "&ndash;" + u.end)} &middot; ${u.end - u.start + 1} lines</small></h3>`;
  h += `<pre class="sx-sig">${sxEsc(sxSig(u))}</pre>`;
  if (u.args.length) h += `<div class="sx-args">${u.args.map(a => `<a data-go="v:${a}">${a}</a> <small>${sxEsc(SX.typeStr(vt(a)) || "?")}</small>`).join("<br>")}</div>`;
  if (u.doc) h += sxDoc(u.doc);
  if (u.initialises) h += `<h4>Initialises</h4>` + sxChips(u.initialises, b => `<a data-go="c:${b}">/${b}/</a>`);
  if (vars.length) h += `<h4>Declared</h4><table class="sx-tab"><tr><th>name</th><th>type</th><th>dims</th><th></th></tr>${vars.map(row).join("")}</table>`;
  const cm = Object.entries(u.common || {});
  if (cm.length) h += `<h4>COMMON used</h4>` + cm.map(([b, ms]) => `<div class="sx-cmrow"><a data-go="c:${b}">/${b}/</a> ${ms.map(m => `<a data-go="m:${m}">${m}</a>`).join(" ")}</div>`).join("");
  if (u.parameters?.length || u.local_parameters) h += `<h4>PARAMETERs</h4>` + sxChips([...(u.parameters || []), ...Object.keys(u.local_parameters || {})], p => `<a data-go="p:${p}">${p}</a>`);
  if (u.intrinsics?.length) h += `<h4>Intrinsics</h4><div class="sx-chips sx-dim">${u.intrinsics.join(" ")}</div>`;
  if (u.calls?.length || u.called_by?.length) h += `<h4>Call graph</h4>` + sxGraph(u);
  if (u.kind !== "block data") h += `<h4>Calls</h4>` + sxChips(u.calls || [], c => SX.unit[c] ? sxU(c) : `<span class="sx-dim" title="not a kernel unit">${c}</span>`) + `<h4>Called by</h4>` + sxChips(u.called_by || [], sxU);
  if (u.restomod?.length) h += `<h4>RESTOMOD</h4>` + u.restomod.map(f => `<div class="sx-rmrow">${sxAt(u.file, f.from, f.from + (f.to > f.from ? "&ndash;" + f.to : ""))} ${sxEsc(f.why)}</div>`).join("");
  return h + "</section>";
}
function sxFileCard(f) {
  if (!f) return "";
  let h = `<section class="sx-card"><h3>${SX.base(f.path)} <small>${f.kind} &middot; ${f.lines} lines</small></h3>`;
  if (f.doc) h += sxDoc(f.doc);
  const us = SX.unitsIn[f.path] || [];
  if (us.length) h += `<h4>Units</h4>` + sxChips(us, u => sxU(u.name));
  if (f.kind === "Include") {
    const bs = Object.keys(SX.sym.common).filter(b => SX.pathOf(SX.sym.common[b].file) === f.path), ps = Object.keys(SX.sym.parameters).filter(p => SX.pathOf(SX.sym.parameters[p].file) === f.path);
    if (bs.length) h += `<h4>COMMON blocks</h4>` + sxChips(bs, b => `<a data-go="c:${b}">/${b}/</a>`);
    if (ps.length) h += `<h4>PARAMETERs</h4>` + sxChips(ps, p => `<a data-go="p:${p}">${p}</a>`);
  }
  if (f.restomod?.length) h += `<h4>RESTOMOD</h4>` + f.restomod.map(r => `<div class="sx-rmrow">${sxAt(f.path, r.from, r.from + "&ndash;" + r.to)} ${sxEsc(r.why)}</div>`).join("");
  return h + "</section>";
}
function sxBlockCard(b, m) {
  const c = SX.sym.common[b]; if (!c) return "";
  const path = SX.pathOf(c.file);
  let h = `<section class="sx-card"><h3>/${b}/ <small>COMMON &middot; ${c.members.length} members &middot; ${sxAt(path, c.line)}</small></h3>`;
  if (m) {
    const users = SX.memberUsers(b, m);
    h += `<div class="sx-sym"><b>${m}</b> ${sxEsc(SX.typeStr(c.types?.[m]))}<h4>${m} referenced by</h4>${sxChips(users, sxU)}</div>`;
  }
  h += `<h4>Members</h4><table class="sx-tab"><tr><th>name</th><th>type</th><th>dims</th></tr>` + c.members.map(n => { const t = c.types?.[n]; return `<tr${n === m ? ' class="on"' : ""}><td><a data-go="m:${n}">${n}</a></td><td>${sxEsc((t?.type || "").replace("DOUBLE PRECISION", "DOUBLE"))}</td><td>${sxEsc(t?.dims ? t.dims.join(", ") : "")}</td></tr>`; }).join("") + "</table>";
  if (c.initialised_by?.length) h += `<h4>Initialised by</h4>` + sxChips(c.initialised_by, sxU);
  h += `<h4>Referenced by</h4>` + sxChips(c.referenced_by || [], sxU);
  return h + "</section>";
}
function sxParamCard(n) {
  const lp = SV.unit?.local_parameters?.[n], p = lp || SX.sym.parameters[n]; if (!p) return "";
  const path = lp ? SV.unit.file : SX.pathOf(p.file);
  let h = `<section class="sx-card"><h3>${n} <small>PARAMETER &middot; ${lp ? "local to " + sxU(SV.unit.name) : p.line ? sxAt(path, p.line) : SX.base(path)}</small></h3>`;
  h += `<pre class="sx-sig">${n} = ${sxEsc(p.expr)}${p.value !== null && String(p.value) !== p.expr ? "\n   = " + p.value : ""}</pre>`;
  if (!lp) h += `<h4>Used by</h4>` + sxChips(SX.paramUsers[n] || [], sxU);
  return h + "</section>";
}
function sxVarCard(n, uses) {
  const u = SV.unit, v = SX.varOf(u, n); if (!u) return "";
  const d = SX.declLine(u, n);
  return `<section class="sx-card"><h3>${n} <small>${v?.arg ? "argument " + (u.args.indexOf(n) + 1) + " of " : "local to "}${sxU(u.name)}</small></h3>`
    + `<pre class="sx-sig">${sxEsc(v ? SX.typeStr(v) : "undeclared")}</pre><div class="sx-dim">${d ? "declared at " + sxAt(u.file, d) + "; " : ""}${uses} use${uses === 1 ? "" : "s"} in ${u.name}, highlighted</div></section>`;
}
// Callers -> unit -> callees, one level each side.
function sxGraph(u) {
  const MAX = 12, cut = a => a.length > MAX ? [...a.slice(0, MAX - 1), "+" + (a.length - MAX + 1) + " more"] : a;
  const l = cut(u.called_by || []), r = cut(u.calls || []), RH = 20, rows = Math.max(l.length, r.length, 1), H = rows * RH + 8, W = 300, cy = H / 2;
  const y = (i, n) => 4 + (rows - n) * RH / 2 + i * RH + RH / 2;
  const box = (x, yy, n, cls) => n.startsWith("+") ? `<text x="${x + 36}" y="${yy + 4}" class="sx-gm" text-anchor="middle">${n}</text>`
    : `<g class="sx-gn ${cls}" data-go="u:${n}"><rect x="${x}" y="${yy - 8}" width="72" height="16" rx="3"/><text x="${x + 36}" y="${yy + 4}" text-anchor="middle">${n}</text></g>`;
  let s = `<svg class="sx-graph" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${u.name}: ${l.length} callers, ${r.length} callees">`;
  l.forEach((n, i) => { const yy = y(i, l.length); s += `<path d="M76 ${yy} C100 ${yy} 92 ${cy} 114 ${cy}"/>` + box(4, yy, n, ""); });
  r.forEach((n, i) => { const yy = y(i, r.length); s += `<path d="M186 ${cy} C208 ${cy} 200 ${yy} 224 ${yy}"/>` + box(224, yy, n, SX.unit[n] ? "" : "sx-gx"); });
  return s + `<g class="sx-gn sx-gc"><rect x="114" y="${cy - 9}" width="72" height="18" rx="3"/><text x="150" y="${cy + 4}" text-anchor="middle">${u.name}</text></g></svg>`;
}

// ---- clicks, hover, keys ----
function sxClick(e) {
  const t = e.target;
  if (t.closest("#sxqo") && !t.closest("[data-go]")) return;
  const g = t.closest(".sx-g[data-fold]");
  if (g) { sxFold(+g.parentNode.firstChild.textContent); return; }
  const go = t.closest("[data-go]");
  if (go) {   // a unit's outline opens with it, and stays open when another unit is chosen
    const d = go.tagName === "SUMMARY" && go.parentNode.classList.contains("sx-tu") ? go.parentNode : null;
    if (d && d.open && SV.unit?.name !== d.dataset.u) e.preventDefault();
    sxGoCode(go.dataset.go); return;
  }
  const ln = t.closest(".sx-l"); if (!ln) return;
  const line = +ln.firstChild.textContent;
  if (t.classList.contains("sx-n")) { sxGo({ path: SV.path, line }); return; }
  if (t.classList.contains("sx-gl")) { sxGoLabel(SX.unitAt(SV.path, line), t.textContent); return; }
  if (!t.classList.contains("sx-id")) return;
  const name = t.textContent.toUpperCase(), u = SX.unitAt(SV.path, line), r = SX.resolve(name, u);
  if (!r || r.k === "intr") return;
  if (r.k === "unit") sxGoCode("u:" + name);
  else sxGo({ path: SV.path, line, sel: (r.k === "member" ? "m:" : r.k === "param" ? "p:" : "v:") + name, hl: name });
}
function sxGoLabel(u, lab) {
  const n = u && (u.outline || []).find(o => o.k === "label" && o.label === lab);
  if (n) sxGo({ path: u.file, line: n.line, sel: "u:" + u.name });
}
function sxGoCode(c) {
  const k = c[0], rest = c.slice(2);
  if (k === "l") { const i = rest.lastIndexOf(":"); sxGo({ path: rest.slice(0, i), line: +rest.slice(i + 1) }); }
  else if (k === "g") { const [u, l] = rest.split(":"); sxGoLabel(SX.unit[u], l); }
  else if (k === "v") sxGo({ path: SV.path, line: SV.hist[SV.hi]?.line || SV.unit?.start, sel: c, hl: rest });
  else if ((k === "m" || k === "p") && SV.unit && SX.resolve(rest, SV.unit)) sxGo({ path: SV.path, line: SV.hist[SV.hi]?.line || SV.unit.start, sel: c, hl: rest });
  else sxGo(sxLoc(c));
  if (k !== "v" && innerWidth < 1000) $("sxtree").classList.remove("open");
  $("sxqo").hidden = true;
}
function sxTip(e) {
  const tip = $("sxtip"), t = e.target, ln = t.closest?.(".sx-l");
  let txt = "";
  if (ln && t.classList.contains("sx-id")) {
    const name = t.textContent.toUpperCase(), u = SX.unitAt(SV.path, +ln.firstChild.textContent), r = SX.resolve(name, u);
    if (r?.k === "var") txt = `${name}  ${SX.typeStr(r.t)}  ${r.t.arg ? "argument " + (u.args.indexOf(name) + 1) + " of" : "local to"} ${u.name}`;
    else if (r?.k === "member") txt = `${name}  ${SX.typeStr(r.t)}  COMMON /${r.blk}/`;
    else if (r?.k === "param") txt = `${name} = ${r.p.expr}${r.p.value !== null && String(r.p.value) !== r.p.expr ? " = " + r.p.value : ""}  PARAMETER`;
    else if (r?.k === "unit") txt = `${sxSig(r.u)}  ${SX.base(r.u.file)}:${r.u.start}\n${sxFirst(r.u.doc)}`;
    else if (r?.k === "intr") txt = `${name}  intrinsic`;
  } else if (ln && t.classList.contains("sx-gl")) txt = "Go to label " + t.textContent;
  else if (ln && ln.dataset.why && !t.closest(".sx-n,.sx-g")) txt = "RESTOMOD: " + ln.dataset.why;
  if (!txt) { tip.hidden = true; return; }
  tip.textContent = txt; tip.hidden = false;
  const r = t.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.left = Math.max(4, Math.min(innerWidth - w - 4, r.left)) + "px";
  tip.style.top = (r.bottom + 4 + tip.offsetHeight > innerHeight ? r.top - tip.offsetHeight - 4 : r.bottom + 4) + "px";
}
// Quick-open: a fuzzy match (the query's characters in order) over units, COMMON blocks and members, PARAMETERs, files.
function sxQuickItems() {
  if (SV.qitems) return SV.qitems;
  const it = [];
  for (const u of SX.sym.units) it.push({ t: u.name, d: `${u.kind} · ${SX.base(u.file)}:${u.start}`, go: "u:" + u.name, w: 4 });
  for (const b in SX.sym.common) { it.push({ t: "/" + b + "/", d: "COMMON · " + SX.sym.common[b].members.length + " members", go: "c:" + b, w: 3 }); for (const m of SX.sym.common[b].members) it.push({ t: m, d: "member of /" + b + "/", go: "m:" + m, w: 1 }); }
  for (const p in SX.sym.parameters) it.push({ t: p, d: "PARAMETER = " + SX.sym.parameters[p].expr, go: "p:" + p, w: 2 });
  for (const f of SX.sym.files) it.push({ t: SX.base(f.path), d: f.kind, go: "f:" + f.path, w: 2 });
  return (SV.qitems = it);
}
function sxFuzzy(q, s) {
  const S = s.toUpperCase(); let i = 0, sc = 0, run = 0;
  for (const ch of q) { const j = S.indexOf(ch, i); if (j < 0) return -1; run = j === i ? run + 1 : 0; sc += 1 + run * 2 - (j - i) * 0.1; i = j + 1; }
  if (S.replace(/\//g, "").startsWith(q)) sc += 10;
  if (S.replace(/\//g, "") === q) sc += 20;
  return sc - S.length * 0.05;
}
function sxQuickOpen() {
  const qo = $("sxqo"); qo.hidden = false; $("sxqi").value = ""; sxQuickList(); $("sxqi").focus();
}
function sxQuickList() {
  const q = $("sxqi").value.trim().toUpperCase(), m = /^([\w.]+\.(?:F|INC)):(\d+)$/.exec(q);
  let r = q ? sxQuickItems().map(x => ({ x, s: sxFuzzy(q.replace(/\//g, ""), x.t) })).filter(o => o.s >= 0).sort((a, b) => b.s - a.s || b.x.w - a.x.w).slice(0, 40).map(o => o.x)
    : sxQuickItems().filter(x => x.w === 4).slice(0, 40);
  if (m && SX.pathOf(m[1].toLowerCase())) r = [{ t: m[1].toLowerCase() + ":" + m[2], d: "line", go: "l:" + SX.pathOf(m[1].toLowerCase()) + ":" + m[2] }, ...r];
  SV.qo = r; SV.qi = 0;
  $("sxql").innerHTML = r.map((x, i) => `<div class="sx-qr${i ? "" : " on"}" role="option" data-go="${x.go}"><b>${sxEsc(x.t)}</b><small>${sxEsc(x.d)}</small></div>`).join("") || `<div class="sx-none">No match.</div>`;
}
function sxQuickKey(e) {
  const rows = $("sxql").children;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); if (!SV.qo.length) return;
    rows[SV.qi].classList.remove("on"); SV.qi = (SV.qi + (e.key === "ArrowDown" ? 1 : -1) + SV.qo.length) % SV.qo.length;
    rows[SV.qi].classList.add("on"); rows[SV.qi].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") { e.preventDefault(); if (SV.qo[SV.qi]) sxGoCode(SV.qo[SV.qi].go); }
  else if (e.key === "Escape") { e.preventDefault(); $("sxqo").hidden = true; }
}
// Source's own keys; the plot tabs' keys (controls.js) stand down while Source is open.
window.addEventListener("keydown", e => {
  if (tab !== "source" || !SV.built || $("list").classList.contains("open")) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
  if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) { e.preventDefault(); sxQuickOpen(); }
  else if (e.key === "/" && !typing) { e.preventDefault(); sxQuickOpen(); }
  else if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); sxHist(e.key === "ArrowLeft" ? -1 : 1); }
  else if (e.key === "Escape") {   // closes Source's overlays; with none open it is left to the room (room.js)
    if (!$("sxqo").hidden || !$("sxtip").hidden || $("sxtree").classList.contains("open")) e.preventDefault();
    $("sxqo").hidden = true; $("sxtip").hidden = true; $("sxtree").classList.remove("open");
  }
});
