// Source browser, data side: the symbol table (build/symbols.json, tools/gen_symbols.py), name lookups and the
// fixed-form highlighter. The UI is srcview.js.
"use strict";
const SX = (() => {
  let sym = { files: [], units: [], common: {}, parameters: {} };
  try { const el = $("fsym"); if (el) sym = JSON.parse(el.textContent); } catch (e) { console.error("symbols:", e); }
  const src = {};   // path -> text, from the listing's elements (listing.js)
  for (const e of ELEMENTS) if (e.file) src[e.file] = e.src.replace(/\t/g, "        ");
  if (!sym.files.length) for (const p in src) sym.files.push({ path: p, kind: p.endsWith(".inc") ? "Include" : "Core", lines: src[p].split("\n").length, doc: "", units: [] });
  const unit = {}, fileOf = {}, unitsIn = {}, member = {}, paramUsers = {};
  for (const f of sym.files) { fileOf[f.path] = f; unitsIn[f.path] = []; }
  for (const u of sym.units) {
    if (!unit[u.name]) unit[u.name] = u;
    (unitsIn[u.file] = unitsIn[u.file] || []).push(u);
    for (const p of u.parameters || []) (paramUsers[p] = paramUsers[p] || []).push(u.name);
  }
  for (const p in unitsIn) unitsIn[p].sort((a, b) => a.start - b.start);
  for (const b in sym.common) for (const m of sym.common[b].members) member[m] = b;
  const base = p => p.replace(/^.*\//, "");
  const pathOf = name => { const n = name.replace(/^src\//, ""); return sym.files.find(f => base(f.path) === n)?.path; };
  // The unit holding a line (an ENTRY lies inside its parent; the parent is the one we want).
  const unitAt = (path, line) => (unitsIn[path] || []).find(u => u.kind !== "entry" && line >= u.start && line <= u.end) || null;
  const varOf = (u, n) => u && (u.vars || []).find(v => v.name === n);
  const paramOf = (u, n) => (u && u.local_parameters && u.local_parameters[n]) || sym.parameters[n] || null;
  const memberUsers = (blk, m) => sym.units.filter(u => (u.common?.[blk] || []).includes(m)).map(u => u.name);
  const typeStr = t => !t ? "" : (t.type || "untyped") + (t.dims ? "(" + t.dims.join(",") + ")" : "");
  // What a name means inside a unit, in the order FORTRAN resolves it: a local or argument, a COMMON member, a
  // PARAMETER, a kernel routine, an intrinsic.
  function resolve(name, u) {
    const v = varOf(u, name);
    if (v && v.common) return { k: "member", name, blk: v.common, t: v };
    if (v) return { k: "var", name, t: v, u };
    if (member[name] && (!u || u.includes?.length || u.common?.[member[name]])) return { k: "member", name, blk: member[name], t: sym.common[member[name]].types?.[name] };
    const p = paramOf(u, name); if (p) return { k: "param", name, p };
    if (unit[name]) return { k: "unit", name, u: unit[name] };
    if ((u?.intrinsics || []).includes(name) || INTR.has(name)) return { k: "intr", name };
    return null;
  }
  const INTR = new Set("DSIN DCOS DTAN DASIN DACOS DATAN DATAN2 DSQRT DEXP DLOG DLOG10 DABS DMOD DSIGN DMAX1 DMIN1 DINT DNINT DBLE DFLOAT IDINT IDNINT MAX MIN MAX0 MIN0 MOD IABS INT NINT ABS SQRT ISIGN IFIX FLOAT".split(" "));
  const KW = new Set(`IF THEN ELSE ELSEIF END ENDIF DO CONTINUE GO TO GOTO RETURN CALL STOP PAUSE DATA PARAMETER COMMON
    INCLUDE DIMENSION EXTERNAL INTRINSIC IMPLICIT DOUBLE PRECISION INTEGER REAL LOGICAL CHARACTER COMPLEX FUNCTION
    SUBROUTINE ENTRY BLOCK SAVE EQUIVALENCE WRITE READ FORMAT PRINT`.split(/\s+/));
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // One token pass over columns 7-72: strings, dot operators, identifiers, numbers.
  const TOK = /('(?:[^']|'')*'?)|(\.(?:EQ|NE|LT|LE|GT|GE|AND|OR|NOT|EQV|NEQV|TRUE|FALSE)\.)|([A-Za-z][A-Za-z0-9_]*)|(\d+(?:\.(?![A-Za-z]{2,4}\.)\d*)?(?:[DEde][+-]?\d+)?|\.\d+(?:[DEde][+-]?\d+)?)/g;
  function code(body, u) {
    let out = "", at = 0, m, gl = 0;   // gl: the numbers after GO TO (or DO's label) are statement labels
    TOK.lastIndex = 0;
    while ((m = TOK.exec(body))) {
      out += esc(body.slice(at, m.index)); at = TOK.lastIndex;
      const t = m[0];
      if (m[1]) out += `<span class="sx-s">${esc(t)}</span>`;
      else if (m[2]) out += `<span class="sx-o">${t}</span>`;
      else if (m[3]) {
        const up = t.toUpperCase();
        if (KW.has(up) && !varOf(u, up)) {
          out += `<span class="sx-k">${t}</span>`;
          if (up === "TO" || up === "GOTO") gl = 2; else if (up === "DO" && !gl) gl = 1;
        } else {
          const r = resolve(up, u);
          out += `<span class="sx-id${r ? " sx-" + r.k : ""}">${t}</span>`;
          if (gl === 1) gl = 0;
        }
      } else if (gl && /^\d+$/.test(t)) { out += `<span class="sx-gl" title="Go to label ${t}">${t}</span>`; if (gl === 1) gl = 0; }
      else out += `<span class="sx-nm">${t}</span>`;
    }
    return out + esc(body.slice(at));
  }
  // The file as HTML lines: line number, gutter, then the card image (label, continuation, statement, columns 73+).
  function render(path) {
    const lines = (src[path] || "").split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    const us = unitsIn[path] || [];
    let ui = 0, html = "";
    for (let i = 0; i < lines.length; i++) {
      const n = i + 1, L = lines[i];
      while (ui < us.length && (us[ui].kind === "entry" || us[ui].end < n)) ui++;
      const u = ui < us.length && n >= us[ui].start ? us[ui] : null;
      let c;
      if (!L.trim() || /^[Cc*!]/.test(L)) c = `<span class="sx-cm">${esc(L)}</span>`;
      else {
        const lab = L.slice(0, 5), ct = L.charAt(5), body = L.slice(6, 72), seq = L.slice(72);
        c = `<span class="sx-lb">${esc(lab.padEnd(5))}</span>` + (ct && ct !== " " && ct !== "0" ? `<span class="sx-ct">${esc(ct)}</span>` : esc(ct.padEnd(1)))
          + code(body, u) + (seq ? `<span class="sx-sq">${esc(seq)}</span>` : "");
      }
      html += `<div class="sx-l"><span class="sx-n">${n}</span><span class="sx-g"></span><span class="sx-c">${c}</span></div>`;
    }
    return { html, count: lines.length };
  }
  // The declaration statement of a name in a unit: the first type, DIMENSION or COMMON statement (with its
  // continuation lines) that names it.
  function declLine(u, name) {
    const lines = (src[u.file] || "").split("\n"), re = new RegExp("\\b" + name + "\\b");
    let inDecl = false;
    for (let n = u.start + 1; n <= u.end; n++) {
      const L = lines[n - 1] || "";
      if (!L.trim() || /^[Cc*!]/.test(L)) continue;
      const cont = L.charAt(5) !== " " && L.charAt(5) !== "0" && L.length > 5;
      if (!cont) inDecl = /^\s*(DOUBLE\s*PRECISION|INTEGER|REAL|LOGICAL|CHARACTER|DIMENSION|COMMON|PARAMETER)\b/i.test(L.slice(6, 72));
      if (inDecl && re.test(L.slice(6, 72).toUpperCase())) return n;
    }
    return null;
  }
  return { sym, src, unit, fileOf, unitsIn, member, paramUsers, base, pathOf, unitAt, varOf, paramOf, memberUsers, typeStr, resolve, render, declLine, esc };
})();
