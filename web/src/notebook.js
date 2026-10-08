// Scenario notebooks (#29): the Markdown a reel carries (notebook/notebook.md, reelpkg.js readReel's `notebook`) read
// into a small tree and built into the library viewer's page (library.js). Ours: no Markdown library (the page takes no
// dependency for it), only the subset the notebooks are written in, and nothing in the text becomes markup. The tree is
// plain data ({t, ...} nodes and strings), so the selftest checks it under node (tools/selftest.mjs, `notebook:`), and
// the builder makes every element from NB_TAGS with createElement, every string a text node: no innerHTML anywhere.
//   Blocks: ATX headings (# to ######), paragraphs, "-", "*", "+" and "1." lists (nested by indentation), "> " block
//   quotes, pipe tables (a header row and a --- row), "---" rules, fenced code; a paragraph that is one image is a
//   figure, its alt text the caption. A fence whose info string is `figures` is the figure cases (tools/notebook.py:
//   build metadata, golden.sh's CASES columns) and is shown at the end as a small table, "Figures, as rendered",
//   because the notebooks' own text sends the reader to "the case of its name in the figures block at the end".
//   Inline: `code`, **strong**, *em* and _em_, [text](href), ![alt](figures/<name>.svg), <https://...> and bare
//   http(s) URLs, backslash escapes; anything else (raw HTML among it) stays text.
//   Links: only http: and https: (opened in a new tab, rel noopener noreferrer) and in-page #anchors become links;
//   any other href (javascript:, data:, a relative path) is dropped and its text kept. Images: only figures/<name>.svg,
//   which the viewer shows as <img> from a blob: URL of the reel's own SVG bytes (an <img> runs no SVG script); any
//   other image is its alt text.
"use strict";
/** The elements the builder may make. */
const NB_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "em", "strong", "code", "pre", "ul", "ol", "li", "a",
  "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr", "img", "figure", "figcaption", "section"]);
const NB_FIG = /^figures\/([a-z0-9][a-z0-9-]*)\.svg$/;
/** A link's target if it may be one: an absolute http(s) URL, or an in-page #anchor; else null. */
function nbHref(h) {
  const s = String(h || "").trim();
  if (/^#[A-Za-z0-9_-]+$/.test(s)) return s;
  if (!/^https?:\/\//i.test(s) || /[\s<>"'`\\\u0000-\u001f]/.test(s)) return null;
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:" ? u.href : null; } catch (e) { return null; }
}
/** Inline Markdown to a list of strings and nodes. */
function nbInline(s) {
  const out = [];
  let buf = "";
  const text = t => { buf += t; }, flush = () => { if (buf) out.push(buf); buf = ""; };
  const push = n => { flush(); out.push(n); };
  let i = 0;
  while (i < s.length) {
    const c = s[i], rest = s.slice(i);
    let m;
    if (c === "\\" && i + 1 < s.length && /[\\`*_{}[\]()#+\-.!|<>~]/.test(s[i + 1])) { text(s[i + 1]); i += 2; continue; }
    if (c === "`" && (m = /^(`+)([^]*?[^`])\1(?!`)/.exec(rest))) { push({ t: "code", c: [m[2].replace(/^ (.*) $/, "$1")] }); i += m[0].length; continue; }
    if (c === "!" && (m = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(rest))) {
      const f = NB_FIG.exec(m[2]);
      push(f ? { t: "img", fig: f[1], alt: m[1] } : m[1]);
      i += m[0].length; continue;
    }
    if (c === "[" && (m = /^\[((?:[^\]\\]|\\.)*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(rest))) {
      const href = nbHref(m[2]), kids = nbInline(m[1]);
      if (href) push({ t: "a", href, c: kids }); else { flush(); out.push(...kids); }
      i += m[0].length; continue;
    }
    if (c === "<" && (m = /^<(https?:\/\/[^\s<>]+)>/i.exec(rest))) {
      const href = nbHref(m[1]);
      push(href ? { t: "a", href, c: [m[1]] } : m[0]); i += m[0].length; continue;
    }
    if ((c === "h" || c === "H") && !/\w$/.test(s.slice(0, i)) && (m = /^https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]'*_]/i.exec(rest))) {
      const href = nbHref(m[0]);
      push(href ? { t: "a", href, c: [m[0]] } : m[0]); i += m[0].length; continue;
    }
    if ((c === "*" || c === "_") && !/\s/.test(s[i + (s[i + 1] === c ? 2 : 1)] || " ")) {
      // Emphasis: ** or * (or __, _ at a word's edge), closed by the same run not after a space.
      const two = s[i + 1] === c, d = two ? c + c : c, from = i + d.length;
      if (c === "_" && /\w/.test(s[i - 1] || "")) { text(c); i++; continue; }
      let j = from, end = -1;
      while ((j = s.indexOf(d, j)) >= 0) {
        if (j > from && !/\s/.test(s[j - 1]) && (two || s[j + 1] !== c) && (c !== "_" || !/\w/.test(s[j + d.length] || ""))) { end = j; break; }
        j += d.length;
      }
      if (end > 0) { push({ t: two ? "strong" : "em", c: nbInline(s.slice(from, end)) }); i = end + d.length; continue; }
    }
    text(c); i++;
  }
  flush();
  return out;
}
const NB_LI = /^( *)([-*+]|\d{1,9}[.)]) +(.*)$/;
const NB_TROW = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const nbCells = ln => ln.trim().replace(/^\|/, "").replace(/(^|[^\\])\|$/, "$1").split(/(?<!\\)\|/).map(x => x.trim());
/** Block Markdown to a list of nodes; `figs` collects the figures fence's rows (the top level passes one). */
function nbBlocks(lines, figs) {
  const out = [];
  let i = 0;
  const blank = l => !l.trim();
  const starts = l => /^ {0,3}(#{1,6} |```|> ?|([-*_])( *\2){2,} *$)/.test(l) || NB_LI.test(l);
  while (i < lines.length) {
    const ln = lines[i];
    let m;
    if (blank(ln)) { i++; continue; }
    if ((m = /^ {0,3}```\s*([\w-]*).*$/.exec(ln))) {
      const body = [];
      for (i++; i < lines.length && !/^ {0,3}```\s*$/.test(lines[i]); i++) body.push(lines[i]);
      i++;
      if (m[1] === "figures" && figs) figs.push(...body.filter(l => l.trim()).map(l => l.replace(/^#\s*/, "").split("|").map(x => x.trim())));
      else out.push({ t: "pre", c: [{ t: "code", c: [body.join("\n")] }] });
      continue;
    }
    if ((m = /^ {0,3}(#{1,6}) +(.*?)(?: +#+)? *$/.exec(ln))) { out.push({ t: "h" + m[1].length, c: nbInline(m[2]) }); i++; continue; }
    if (/^ {0,3}([-*_])( *\1){2,} *$/.test(ln)) { out.push({ t: "hr" }); i++; continue; }
    if (/^ {0,3}> ?/.test(ln)) {
      const body = [];
      for (; i < lines.length && !blank(lines[i]) && (/^ {0,3}> ?/.test(lines[i]) || body.length); i++) {
        if (!/^ {0,3}> ?/.test(lines[i]) && starts(lines[i])) break;
        body.push(lines[i].replace(/^ {0,3}> ?/, ""));
      }
      out.push({ t: "blockquote", c: nbBlocks(body) });
      continue;
    }
    if ((m = NB_LI.exec(ln))) {
      const base = m[1].length, ordered = /\d/.test(m[2]), items = [];
      while (i < lines.length) {
        const im = NB_LI.exec(lines[i]);
        if (!im || im[1].length !== base || /\d/.test(im[2]) !== ordered) break;
        const body = [im[3]], ind = base + im[2].length + 1;
        for (i++; i < lines.length; i++) {
          const l = lines[i];
          if (blank(l)) { if (i + 1 < lines.length && /^ +\S/.test(lines[i + 1]) && lines[i + 1].search(/\S/) > base) { body.push(""); continue; } break; }
          const lead = l.search(/\S/);
          if (lead > base) body.push(l.slice(Math.min(lead, ind)));
          else if (!starts(l)) body.push(l.trim());
          else break;
        }
        const kids = nbBlocks(body);
        items.push({ t: "li", c: kids.length === 1 && kids[0].t === "p" ? kids[0].c : kids });
      }
      out.push({ t: ordered ? "ol" : "ul", c: items });
      continue;
    }
    if (ln.includes("|") && i + 1 < lines.length && NB_TROW.test(lines[i + 1])) {
      const head = nbCells(ln), rows = [];
      for (i += 2; i < lines.length && !blank(lines[i]) && lines[i].includes("|"); i++) rows.push(nbCells(lines[i]));
      out.push({ t: "table", c: [
        { t: "thead", c: [{ t: "tr", c: head.map(x => ({ t: "th", c: nbInline(x) })) }] },
        { t: "tbody", c: rows.map(r => ({ t: "tr", c: head.map((_, k) => ({ t: "td", c: nbInline(r[k] || "") })) })) },
      ] });
      continue;
    }
    const para = [];
    for (; i < lines.length && !blank(lines[i]) && !(para.length && starts(lines[i])); i++) para.push(lines[i].trim());
    const c = nbInline(para.join(" "));
    if (c.length === 1 && c[0].t === "img") out.push({ t: "figure", c: [c[0], ...(c[0].alt ? [{ t: "figcaption", c: [c[0].alt] }] : [])] });
    else out.push({ t: "p", c });
  }
  return out;
}
/** A notebook's text as a tree: its blocks, then the figures fence's cases as a section, if it has one. */
function nbParse(md) {
  const figs = [], out = nbBlocks(String(md).replace(/\r\n?/g, "\n").split("\n"), figs);
  if (figs.length > 1) out.push({ t: "section", c: [
    { t: "h2", c: ["Figures, as rendered"] },
    { t: "p", c: ["The case each figure was drawn at by the native driver (tools/notebook.py; ours): its name, environment, reel and viewsvg arguments."] },
    { t: "table", c: [
      { t: "thead", c: [{ t: "tr", c: figs[0].map(x => ({ t: "th", c: [x] })) }] },
      { t: "tbody", c: figs.slice(1).map(r => ({ t: "tr", c: figs[0].map((_, k) => ({ t: "td", c: [{ t: "code", c: [r[k] || ""] }] })) })) },
    ] },
  ] });
  return out;
}
/** A notebook's title: its first heading's text. */
function nbTitle(md) {
  const m = /^ {0,3}#{1,6} +(.*?)(?: +#+)? *$/m.exec(String(md));
  const flat = n => typeof n === "string" ? n : (n.c || []).map(flat).join("");
  return m ? nbInline(m[1]).map(flat).join("") : "";
}
/** Build the tree with `doc` (the document) into a fragment. `fig(name)` gives a figure's image URL (null: none, and
 *  the alt text stands in). Elements only from NB_TAGS; strings only as text nodes; attributes only href (checked
 *  again), target, rel, src (from fig), alt and class. */
function nbBuild(nodes, doc, fig) {
  const frag = doc.createDocumentFragment();
  const add = (parent, n) => {
    if (typeof n === "string") { parent.appendChild(doc.createTextNode(n)); return; }
    if (n.t === "img") {
      const src = fig(n.fig);
      if (!src) { parent.appendChild(doc.createTextNode(n.alt || "")); return; }
      const img = doc.createElement("img");
      img.setAttribute("alt", n.alt || ""); img.setAttribute("src", src); img.setAttribute("class", "nbfig");
      parent.appendChild(img); return;
    }
    if (!NB_TAGS.has(n.t)) { for (const k of n.c || []) add(parent, k); return; }
    const href = n.t === "a" ? nbHref(n.href) : null;
    if (n.t === "a" && !href) { for (const k of n.c || []) add(parent, k); return; }
    const el = doc.createElement(n.t);
    if (href) {
      el.setAttribute("href", href);
      if (href[0] !== "#") { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
    }
    if (n.t === "section") el.setAttribute("class", "nbcases");
    for (const k of n.c || []) add(el, k);
    parent.appendChild(el);
  };
  for (const n of nodes) add(frag, n);
  return frag;
}
