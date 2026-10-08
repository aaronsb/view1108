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
//   Links: only absolute http: and https: URLs become links (a new tab, rel noopener noreferrer); any other href
//   (javascript:, data:, //host, a relative path, a #fragment: the viewer gives its headings no ids) is dropped and
//   its text kept. Images: only figures/<name>.svg, which the viewer shows as <img> from a data: URL of the reel's own
//   SVG (a data: document has an opaque origin, so even a figure opened as a page cannot reach the site; reelpkg.js
//   also refuses a figure holding script, handlers, foreignObject or outside links); any other image is its alt text.
//   Limits (review of PR #69): a text over NB_MAX characters is refused (nbParse throws; the viewer shows it as plain
//   text), quotes and lists nest at most NB_DEPTH deep and emphasis at most NB_IDEPTH (deeper is text), and every
//   pattern is bounded or memoised so a hostile text parses in time linear in its length.
"use strict";
/** The elements the builder may make. */
const NB_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "em", "strong", "code", "pre", "ul", "ol", "li", "a",
  "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr", "img", "figure", "figcaption", "section"]);
const NB_FIG = /^figures\/([a-z0-9][a-z0-9-]*)\.svg$/;
const NB_MAX = 262144, NB_DEPTH = 8, NB_IDEPTH = 12;
/** A link's target if it may be one: an absolute http(s) URL; else null. */
function nbHref(h) {
  const s = String(h || "");
  if (!/^https?:\/\/[^/\s]/i.test(s) || /[\s<>"'`\\\u0000-\u001f]/.test(s)) return null;
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:" ? u.href : null; } catch (e) { return null; }
}
// Sticky patterns, tried at a position without copying the rest of the line; each bounded so an unclosed one fails fast.
const NB_RX = {
  code: /(`{1,8})([^`\n]{1,4000}?)\1(?!`)/y,
  img: /!\[([^\]\n]{0,1000})\]\(([^()\s]{0,2000})(?:\s+"[^"\n]{0,500}")?\)/y,
  link: /\[((?:[^\]\\\n]|\\.){0,1000})\]\(([^()\s]{0,2000})(?:\s+"[^"\n]{0,500}")?\)/y,
  auto: /<(https?:\/\/[^\s<>]{1,2000})>/iy,
  bare: /https?:\/\/[^\s<>"]{0,2000}[^\s<>".,;:!?)\]'*_]/iy,
};
const nbAt = (rx, s, i) => { rx.lastIndex = i; return rx.exec(s); };
/** Inline Markdown to a list of strings and nodes (`depth`: how deep in emphasis). */
function nbInline(s, depth = 0) {
  const out = [], none = new Set();   // `none`: delimiters with no closer anywhere after where one was last sought
  // The next "]" at or after i (Infinity: none), kept as i moves on, so an opener with no "]" within reach fails at
  // once rather than scanning its bound again.
  let close = -1;
  const nextClose = i => { if (close < i) { const k = s.indexOf("]", i); close = k < 0 ? Infinity : k; } return close; };
  let buf = "";
  const text = t => { buf += t; }, flush = () => { if (buf) out.push(buf); buf = ""; };
  const push = n => { flush(); out.push(n); };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    let m;
    if (c === "\\" && i + 1 < s.length && /[\\`*_{}[\]()#+\-.!|<>~]/.test(s[i + 1])) { text(s[i + 1]); i += 2; continue; }
    if (c === "`" && (m = nbAt(NB_RX.code, s, i))) { push({ t: "code", c: [m[2].replace(/^ (.*) $/, "$1")] }); i += m[0].length; continue; }
    if (c === "!" && s[i + 1] === "[" && nextClose(i) - i <= 1002 && (m = nbAt(NB_RX.img, s, i))) {
      const f = NB_FIG.exec(m[2]);
      push(f ? { t: "img", fig: f[1], alt: m[1] } : m[1]);
      i += m[0].length; continue;
    }
    if (c === "[" && nextClose(i) - i <= 2001 && (m = nbAt(NB_RX.link, s, i))) {
      const href = nbHref(m[2]), kids = depth < NB_IDEPTH ? nbInline(m[1], depth + 1) : [m[1]];
      if (href) push({ t: "a", href, c: kids }); else { flush(); out.push(...kids); }
      i += m[0].length; continue;
    }
    if (c === "<" && (m = nbAt(NB_RX.auto, s, i))) {
      const href = nbHref(m[1]);
      push(href ? { t: "a", href, c: [m[1]] } : m[0]); i += m[0].length; continue;
    }
    if ((c === "h" || c === "H") && !/\w/.test(s[i - 1] || "") && (m = nbAt(NB_RX.bare, s, i))) {
      const href = nbHref(m[0]);
      push(href ? { t: "a", href, c: [m[0]] } : m[0]); i += m[0].length; continue;
    }
    if ((c === "*" || c === "_") && depth < NB_IDEPTH && !/\s/.test(s[i + (s[i + 1] === c ? 2 : 1)] || " ")) {
      // Emphasis: ** or * (or __, _ at a word's edge), closed by the same run not after a space. Whether a place closes
      // depends on that place only, so once a search finds no closer, none is sought again for that delimiter.
      const two = s[i + 1] === c, d = two ? c + c : c, from = i + d.length;
      if (c === "_" && /\w/.test(s[i - 1] || "")) { text(c); i++; continue; }
      let end = -1;
      if (!none.has(d)) {
        for (let j = from; (j = s.indexOf(d, j)) >= 0; j += d.length)
          if (j > from && !/\s/.test(s[j - 1]) && (two || s[j + 1] !== c) && (c !== "_" || !/\w/.test(s[j + d.length] || ""))) { end = j; break; }
        if (end < 0) none.add(d);
      }
      if (end > 0) { push({ t: two ? "strong" : "em", c: nbInline(s.slice(from, end), depth + 1) }); i = end + d.length; continue; }
    }
    text(c); i++;
  }
  flush();
  return out;
}
const NB_LI = /^( *)([-*+]|\d{1,9}[.)]) +(.*)$/;
const NB_TROW = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const nbCells = ln => ln.trim().replace(/^\|/, "").replace(/(^|[^\\])\|$/, "$1").split(/(?<!\\)\|/).map(x => x.trim());
/** An ATX heading line: [level, text], or null. Linear: no pattern backtracks over the trailing spaces. */
function nbHeading(ln) {
  const m = /^ {0,3}(#{1,6})(?: |$)/.exec(ln);
  if (!m) return null;
  let t = ln.slice(m[0].length).trim();
  const k = t.search(/(?:^| )#+$/);
  if (k >= 0) t = t.slice(0, k).trim();
  return [m[1].length, t];
}
/** A thematic break: three or more of one of - * _, with spaces between. */
const nbHr = ln => { const t = ln.replace(/ /g, ""); return /^ {0,3}\S/.test(ln) && t.length >= 3 && /^([-*_])\1+$/.test(t); };
/** Block Markdown to a list of nodes; `figs` collects the figures fence's rows (the top level passes one); `depth`:
 *  how deep in quotes and lists (at NB_DEPTH a quote or list is read as a paragraph). */
function nbBlocks(lines, figs, depth = 0) {
  const out = [];
  let i = 0;
  const blank = l => !l.trim();
  const starts = l => /^ {0,3}(#{1,6}( |$)|```|>)/.test(l) || nbHr(l) || NB_LI.test(l);
  const deep = depth >= NB_DEPTH;
  while (i < lines.length) {
    const ln = lines[i];
    let m;
    if (blank(ln)) { i++; continue; }
    if ((m = /^ {0,3}```\s*([\w-]*)/.exec(ln))) {
      const body = [];
      for (i++; i < lines.length && !/^ {0,3}```\s*$/.test(lines[i]); i++) body.push(lines[i]);
      i++;
      if (m[1] === "figures" && figs) figs.push(...body.filter(l => l.trim()).map(l => l.replace(/^#\s*/, "").split("|").map(x => x.trim())));
      else out.push({ t: "pre", c: [{ t: "code", c: [body.join("\n")] }] });
      continue;
    }
    const h = nbHeading(ln);
    if (h) { out.push({ t: "h" + h[0], c: nbInline(h[1]) }); i++; continue; }
    if (nbHr(ln)) { out.push({ t: "hr" }); i++; continue; }
    if (!deep && /^ {0,3}>/.test(ln)) {
      const body = [];
      for (; i < lines.length && !blank(lines[i]) && (/^ {0,3}>/.test(lines[i]) || body.length); i++) {
        if (!/^ {0,3}>/.test(lines[i]) && starts(lines[i])) break;
        body.push(lines[i].replace(/^ {0,3}> ?/, ""));
      }
      out.push({ t: "blockquote", c: nbBlocks(body, null, depth + 1) });
      continue;
    }
    if (!deep && (m = NB_LI.exec(ln))) {
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
        const kids = nbBlocks(body, null, depth + 1);
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
/** A notebook's text as a tree: its blocks, then the figures fence's cases as a section, if it has one. Throws for a
 *  text over NB_MAX characters. */
function nbParse(md) {
  const s = String(md);
  if (s.length > NB_MAX) throw new Error(`notebook: ${s.length} characters, more than ${NB_MAX}`);
  const figs = [], out = nbBlocks(s.replace(/\r\n?/g, "\n").split("\n"), figs);
  if (figs.length > 1) out.push({ t: "section", c: [
    { t: "h2", c: ["Figures, as rendered"] },
    { t: "p", c: ["The case each figure was drawn at by the native driver (tools/notebook.py; ours): its name, environment, reel and viewsvg arguments, or golden=<case> for a figure that is that golden case's render (tools/golden.sh)."] },
    { t: "table", c: [
      { t: "thead", c: [{ t: "tr", c: figs[0].map(x => ({ t: "th", c: [x] })) }] },
      { t: "tbody", c: figs.slice(1).map(r => ({ t: "tr", c: figs[0].map((_, k) => ({ t: "td", c: [{ t: "code", c: [r[k] || ""] }] })) })) },
    ] },
  ] });
  return out;
}
/** A notebook's title: its first heading's text (within its first NB_MAX characters). */
function nbTitle(md) {
  const flat = n => typeof n === "string" ? n : (n.c || []).map(flat).join("");
  for (const ln of String(md).slice(0, NB_MAX).split("\n")) {
    const h = nbHeading(ln);
    if (h) return nbInline(h[1]).map(flat).join("");
  }
  return "";
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
    if (href) { el.setAttribute("href", href); el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
    if (n.t === "section") el.setAttribute("class", "nbcases");
    for (const k of n.c || []) add(el, k);
    parent.appendChild(el);
  };
  for (const n of nodes) add(frag, n);
  return frag;
}
