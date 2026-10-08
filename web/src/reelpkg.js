// Reel packages (#26 slice 7): a reel is one .tar.gz (tools/pack.py), manifest.json first, then the files it lists.
// The page unpacks each with the browser's own gzip (DecompressionStream) and this USTAR reader; nothing in a reel
// is code. Its manifest names the kernel build it is for (kernel.sha256, of build/view.opt.wasm), and a reel for
// another build is refused. A scenario reel carries run decks for the kernel (its mission.scn and scenario file),
// numbering its own scenario and situations, and the kernel holds one scenario reel at a time (#26 slice 7e); a
// playlist reel carries its run.scn, which the kernel never reads, and the scenario reels it uses.
"use strict";
const REEL_FORMAT = "view1108-reel/1";
const reelBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
async function gunzip(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
// A USTAR archive's regular files, in order: [[name, bytes]]. Each header's checksum must hold; names are the 100-byte
// field with the 155-byte prefix; sizes plain octal; types '0', NUL and '7' are files and '5' a directory (skipped),
// any other (pax, GNU long names) is refused rather than read wrong. A zero block ends it.
function untar(t) {
  const out = [], dec = new TextDecoder(), str = (o, n) => dec.decode(t.subarray(o, o + n)).replace(/\0.*$/s, "");
  for (let o = 0; ; ) {
    if (o + 512 > t.length) throw new Error("the archive has no end block");
    const h = t.subarray(o, o + 512);
    if (h.every(b => b === 0)) return out;
    let sum = 0;
    for (let k = 0; k < 512; k++) sum += k >= 148 && k < 156 ? 32 : h[k];
    if (!/^[0-7]{1,8}$/.test(str(o + 148, 8).trim()) || parseInt(str(o + 148, 8).trim(), 8) !== sum)
      throw new Error("a tar header's checksum is wrong");
    if (str(o + 257, 5) !== "ustar") throw new Error("not a USTAR archive");
    const name = [str(o + 345, 155), str(o + 0, 100)].filter(Boolean).join("/");
    const sf = str(o + 124, 12).trim(), type = str(o + 156, 1);
    if (!/^[0-7]{1,11}$/.test(sf)) throw new Error(`${name}: bad size`);
    const size = parseInt(sf, 8);
    if (o + 512 + size > t.length) throw new Error(`${name}: bad size`);
    if (type === "0" || type === "" || type === "7") out.push([name, t.slice(o + 512, o + 512 + size)]);
    else if (type !== "5") throw new Error(`${name}: tar entry type ${type} is not read`);
    o += 512 + Math.ceil(size / 512) * 512;
  }
}
// One package (base64; `id` the name it is shipped under) -> {manifest, files: Map(name -> text), page}. Refused, with
// the reel's id in the message, unless it unpacks, its manifest is first, in this format, under that id, names kernel
// build `sha`, is a scenario reel listing at least one run deck (type "scn") or a playlist reel listing its run.scn
// (type "playlist") and the scenario reels it uses, its other members are exactly the files it lists, once each, and
// it lists one page.json (type "page") that parses. page is that page.json's object.
// A reel may carry a scenario notebook (#29; tools/notebook.py, tools/pack.py): at most one member of type "notebook",
// at notebook/notebook.md, and members of type "figure", each notebook/figures/<name>.svg, an SVG document. A figure
// needs the notebook, every figure the notebook's text names (a Markdown image figures/<name>.svg outside fenced
// blocks, reelFigureRefs) must be in the reel and every figure in the reel must be named, and no other member is
// under notebook/; otherwise the reel is refused. The result then carries notebook: {text, figures: Map(name -> SVG text)} in the manifest's order, else
// notebook is null. Readers before these types load such a reel and ignore the notebook (no format change; ours).
const REEL_FIGURE = /^notebook\/figures\/([a-z0-9][a-z0-9-]*)\.svg$/;
// What a figure may hold (ours; reviews of PR #69): an ALLOWLIST, the same as tools/notebook.py svg_unsafe (render and
// pack): the elements and attributes tools/viewsvg.f90 writes. Refused: a <! anywhere (doctype, entity, comment,
// CDATA), a <? but a leading XML declaration (after at most a byte order mark), an element or attribute not on the
// list (prefixed names among them), a namespace not SVG's, an href but to #..., url( or javascript:, an entity but
// the XML five and numeric references, and a tag the scanner cannot read whole. Whitespace is XML's: space, tab, CR,
// LF. The scan is linear (#79): each tag is read once, left to right, by anchored (sticky) patterns whose parts cannot
// trade characters, so a tag of 200K spaces costs what its length costs. The viewer shows figures as <img> from
// data: URLs; this keeps a figure inert even when a reader opens it as a page.
const REEL_SVG_ELEMENTS = new Set(["svg", "g", "line", "circle", "rect", "text"]);
const REEL_SVG_ATTRS = new Set(["xmlns", "xmlns:xlink", "width", "height", "viewBox", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r",
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-dasharray", "font-family", "font-size", "href", "xlink:href"]);
const REEL_SVG_NS = { "xmlns": "http://www.w3.org/2000/svg", "xmlns:xlink": "http://www.w3.org/1999/xlink" };
// A tag's body (between < and >): its head (a / for a closing tag, then the element's name), its attributes, one at a
// time, and its end (whitespace, and in an opening tag one /).
const REEL_SVG_HEAD = /[ \t\r\n]*(?:(\/)[ \t\r\n]*)?([^ \t\r\n/<>]+)/y;
const REEL_SVG_ATTR = /[ \t\r\n]+([^ \t\r\n=/<>"']+)[ \t\r\n]*=[ \t\r\n]*(?:"([^"<>]*)"|'([^'<>]*)')/y;
const REEL_SVG_END = /[ \t\r\n]*(?:\/[ \t\r\n]*)?$/y, REEL_SVG_WS = /[ \t\r\n]*$/y;
/** Why SVG text `text` may not be a figure, or null. */
function reelSvgUnsafe(text) {
  const s = String(text).replace(/^\uFEFF?[ \t\r\n]*<\?xml[^<>?]*\?>/, ""), TAG = /<([^<>]*)>/g;
  const at = (re, body, k) => { re.lastIndex = k; return re.exec(body); };
  if (s.includes("<!")) return "a <! declaration (doctype, entity, comment or CDATA)";
  if (s.includes("<?")) return "a <? processing instruction";
  for (const bad of ["javascript:", "url("]) if (s.toLowerCase().includes(bad)) return `'${bad}'`;
  if (/&(?!(?:amp|lt|gt|quot|apos|#[0-9]{1,7}|#x[0-9a-fA-F]{1,6});)/.test(s)) return "an entity other than the XML ones";
  const rest = s.replace(TAG, "");
  if (rest.includes("<") || rest.includes(">")) return "a tag the scanner cannot read whole";
  for (const m of s.matchAll(TAG)) {
    const body = m[1], t = at(REEL_SVG_HEAD, body, 0);
    if (!t || !REEL_SVG_ELEMENTS.has(t[2])) return `an element not on the list ('${(t ? t[2] : body).slice(0, 40)}')`;
    let k = t[0].length;
    if (t[1]) { if (!at(REEL_SVG_WS, body, k)) return "a closing tag with attributes"; continue; }
    for (let a; (a = at(REEL_SVG_ATTR, body, k)); k += a[0].length) {
      const name = a[1], val = a[2] ?? a[3];
      if (!REEL_SVG_ATTRS.has(name)) return `an attribute not on the list ('${name}')`;
      if (name in REEL_SVG_NS && val !== REEL_SVG_NS[name]) return `a namespace not SVG's ('${val.slice(0, 40)}')`;
      if ((name === "href" || name === "xlink:href") && !val.startsWith("#")) return "an href to anything but #...";
    }
    if (!at(REEL_SVG_END, body, k)) return `a tag the scanner cannot read whole ('${body.slice(k).replace(/^[ \t\r\n]+/, "").slice(0, 40)}')`;
  }
  return null;
}
// The figure names a notebook's text names, in order of first use: its Markdown images outside fenced blocks. The
// text names no other image: every "![" opens an inline image ![alt](figures/<name>.svg), alt text without "]", and
// an HTML <img> or a reference definition ("[r]: ...", which reference-style images need) is refused (thrown). The
// same rules as tools/notebook.py refs, which applies them when it packs.
function reelFigureRefs(md) {
  const out = [], img = /!\[[^\]]*\]\(([^)\s]*)[^)]*\)/g;
  let fence = false;
  for (const ln of md.split("\n")) {
    if (ln.startsWith("```")) { fence = !fence; continue; }
    if (fence) continue;
    const what = JSON.stringify(ln.trim().slice(0, 60)), ms = [...ln.matchAll(img)];
    if (/<img\b/i.test(ln)) throw new Error(`its notebook has an HTML <img> (${what}); its images are ![alt](figures/<name>.svg)`);
    if (/^ {0,3}\[[^\]]+\]:/.test(ln)) throw new Error(`its notebook has a reference definition (${what}); its images are inline, ![alt](figures/<name>.svg)`);
    if (ln.split("![").length - 1 !== ms.length)
      throw new Error(`its notebook has an image not written ![alt](figures/<name>.svg) (${what}): no "]" in alt text, no reference-style images`);
    for (const m of ms) {
      const f = /^figures\/([a-z0-9][a-z0-9-]*)\.svg$/.exec(m[1]);
      if (!f) throw new Error(`its notebook has an image ${JSON.stringify(m[1])}; its images are figures/<name>.svg`);
      if (!out.includes(f[1])) out.push(f[1]);
    }
  }
  return out;
}
// A scenario reel's event listing and quick views (#29 slice f, #73; ours): page.json's `listing` and `quickviews`,
// which tools/pack.py generates from the reel's own situations and TIMELINE rows (its header gives the format). Why
// they may not be the reel's, or null. The listing must hold each situation of page.json once (kind "situation", id
// its NAME, sit its id) and each timeline row once, in the timeline's order (kind "event"), every entry with a unique
// id, a name and a g.e.t., in g.e.t. order; a situation entry carries its title and default view, target and field,
// each as its page.json row has it. #75 adds
// the kind "photo". quickviews maps keys "1" to "9" to ids the listing holds.
const REEL_LIST_KINDS = ["situation", "event"];
function reelListingWrong(pg) {
  const L = pg.listing, Q = pg.quickviews, ids = new Set(), sits = pg.situations || [], evs = (pg.timeline || {}).events || [];
  if (!Array.isArray(L)) return "page.json has no listing";
  let lastGet = -Infinity, ev = 0;
  const seenSit = new Set();
  for (const [k, e] of L.entries()) {
    const at = `listing entry ${k + 1}`;
    if (!e || typeof e !== "object") return `${at} is not an object`;
    if (!REEL_LIST_KINDS.includes(e.kind)) return `${at} is of kind ${e.kind}, not ${REEL_LIST_KINDS.join(" or ")}`;
    if (typeof e.id !== "string" || !e.id || ids.has(e.id)) return `${at}: id ${JSON.stringify(e.id)} is empty or not unique`;
    ids.add(e.id);
    if (typeof e.name !== "string" || typeof e.get !== "number" || !isFinite(e.get)) return `${at} (${e.id}) has no name or g.e.t.`;
    if (e.get < lastGet) return `${at} (${e.id}) is out of g.e.t. order`;
    lastGet = e.get;
    if (e.kind === "situation") {
      const s = sits.find(x => x.name === e.id);
      if (!s || s.id !== e.sit || seenSit.has(e.id)) return `${at}: situation ${e.id} is not one of the reel's, once`;
      if (e.name !== s.title || e.view !== s.view || e.target !== s.target || e.fov !== s.fov)
        return `${at}: situation ${e.id}'s name, view, target or field is not its card's`;
      seenSit.add(e.id);
    } else {
      const t = evs[ev++];
      if (!t || t[0] !== e.get || t[1] !== e.tl || t[2] !== e.name) return `${at} (${e.id}) is not the timeline's row ${ev}`;
    }
  }
  if (seenSit.size !== sits.length) return `the listing holds ${seenSit.size} of the reel's ${sits.length} situations`;
  if (ev !== evs.length) return `the listing holds ${ev} of the timeline's ${evs.length} rows`;
  if (!Q || typeof Q !== "object" || Array.isArray(Q)) return "page.json has no quickviews";
  for (const [key, v] of Object.entries(Q)) {
    if (!/^[1-9]$/.test(key)) return `quickviews key ${JSON.stringify(key)} is not 1 to 9`;
    if (!ids.has(v)) return `quick view ${key} names ${JSON.stringify(v)}, which the reel's listing does not hold`;
  }
  return null;
}
async function readReel(b64, sha, id) {
  const no = why => new Error(`REEL ${id}: ${why}`);
  let bytes, files;
  try { bytes = await gunzip(reelBytes(b64)); } catch (e) { throw no(`does not unpack: not a gzip stream (${e.message || e.name})`); }
  try { files = untar(bytes); } catch (e) { throw no(`does not unpack: ${e.message}`); }
  if (!files.length || files[0][0] !== "manifest.json") throw no("manifest.json is not first");
  const dec = new TextDecoder("utf-8", { fatal: true }), text = new Map();
  let manifest;
  try {
    manifest = JSON.parse(dec.decode(files[0][1]));
    for (const [n, b] of files.slice(1)) {
      if (text.has(n) || n === "manifest.json") throw new Error(`${n} is in it twice`);
      text.set(n, dec.decode(b));
    }
  } catch (e) { throw no(e.message); }
  if (!manifest || typeof manifest !== "object") throw no("its manifest is not an object");
  if (manifest.id !== id) throw no(`its manifest says ${manifest.id}`);
  if (manifest.format !== REEL_FORMAT) throw no(`format ${manifest.format}, not ${REEL_FORMAT}`);
  const k = manifest.kernel || {};
  if (k.sha256 !== sha)
    throw new Error(`REEL ${id} NAMES KERNEL ${k.id} ${String(k.sha256).slice(0, 8)}; THIS PAGE RUNS ${String(sha).slice(0, 8)}`);
  const c = manifest.contents;
  if (!Array.isArray(c)) throw no("its manifest lists no contents");
  if (manifest.kind === "scenario") { if (!c.some(e => e && e.type === "scn")) throw no("its manifest lists no run deck"); }
  else if (manifest.kind === "playlist") {
    if (!c.some(e => e && e.type === "playlist")) throw no("its manifest lists no playlist deck");
    if (!Array.isArray(manifest.uses) || !manifest.uses.every(u => typeof u === "string")) throw no("its manifest lists no reels it uses");
  } else throw no(`kind ${manifest.kind}, not scenario or playlist`);
  const listed = new Set(c.map(e => e && e.path));
  for (const e of c) if (!text.has(e && e.path)) throw no(`${e && e.path} is listed but missing`);
  for (const n of text.keys()) if (!listed.has(n)) throw no(`${n} is in it but not listed`);
  const pages = c.filter(e => e.type === "page");
  if (pages.length !== 1) throw no(`it lists ${pages.length} page.json, not one`);
  let page;
  try { page = JSON.parse(text.get(pages[0].path)); } catch (e) { throw no(`${pages[0].path}: ${e.message}`); }
  if (manifest.kind === "scenario") { const why = reelListingWrong(page || {}); if (why) throw no(why); }
  const books = c.filter(e => e.type === "notebook"), figs = c.filter(e => e.type === "figure");
  for (const e of c) if (String(e.path).startsWith("notebook/") && e.type !== "notebook" && e.type !== "figure")
    throw no(`${e.path} is under notebook/ as type ${e.type}, not notebook or figure`);
  if (books.length > 1) throw no(`it lists ${books.length} notebooks, not one`);
  if (books.length && books[0].path !== "notebook/notebook.md") throw no(`its notebook is ${books[0].path}, not notebook/notebook.md`);
  if (figs.length && !books.length) throw no(`${figs[0].path} is a figure, and it holds no notebook`);
  let notebook = null;
  if (books.length) {
    const figures = new Map();
    for (const e of figs) {
      const m = REEL_FIGURE.exec(e.path), svg = text.get(e.path);
      if (!m) throw no(`${e.path} is a figure, not notebook/figures/<name>.svg`);
      if (!/^\s*(<\?xml[^>]*\?>\s*)?<svg[\s>]/.test(svg) || !/<\/svg>\s*$/.test(svg)) throw no(`${e.path} is not an SVG document`);
      const bad = reelSvgUnsafe(svg);
      if (bad) throw no(`${e.path} holds ${bad}, which a figure may not (the allowlist)`);
      figures.set(m[1], svg);
    }
    const md = text.get(books[0].path);
    let refs;
    try { refs = reelFigureRefs(md); } catch (e) { throw no(e.message); }
    for (const n of refs) if (!figures.has(n)) throw no(`its notebook names figures/${n}.svg, which it does not hold`);
    for (const n of figures.keys()) if (!refs.includes(n)) throw no(`notebook/figures/${n}.svg is in it, and its notebook does not name it`);
    notebook = { text: md, figures };
  }
  return { manifest, files: text, page, notebook };
}
// A reel's run decks, in its manifest's order: [[path, text]], each path "<reel id>/<file>".
const reelDecks = r => r.manifest.contents.filter(c => c.type === "scn").map(c => [`${r.manifest.id}/${c.path}`, r.files.get(c.path)]);

// The page's data from the reels' page.json (#26 slices 7d, 7e; tools/gen_data.py), the scenario reels in their load
// order:
//   sits   every situation, each its page.json row plus `reel` (its scenario reel's id) and `scene`, its place among
//          all the scenario reels' situations, 1..N (config.js sitOf). A situation is (reel, id) outside the page: the
//          URL's scn= and sit= (loader.js), and the kernel's view_init(id) with that reel's decks loaded (each reel
//          numbers its own situations, #26 slice 7e). scene is the page's handle for it, and the old links' scene=N
//          (#22): Apollo 11's eight, then Apollo 8's as 9, as one numbering gave them before.
//   scns   by reel id: {id (the kernel's scenario number, 1 in every reel), mission, zero, spans, listing, quick}, the
//          spans' situations as scenes; listing the reel's event listing (reelListingWrong), each situation entry with
//          its scene added, and quick its quick views, {key: entry id}
//   tl     by reel id: the timeline, {name, events: [[get, kind, name], ...]}
//   lists  the playlist reels by id: their page.json (REEL and SHOT cards), each shot with `scene` added
// A reel without page.json, a span naming a situation its reel does not hold, a playlist using a scenario reel the
// page does not hold, or a shot naming a reel its playlist does not use or a situation that reel does not hold, is
// refused with the reel's id.
function reelPages(reels) {
  const sits = [], scns = {}, tl = {}, lists = {};
  for (const r of reels) {
    const id = r.manifest.id, pg = r.page;
    if (!pg) throw new Error(`REEL ${id}: no page.json`);
    if (r.manifest.kind === "playlist") continue;
    for (const s of pg.situations) sits.push({ ...s, reel: id, scene: sits.length + 1 });
    const scene = n => {
      const s = sits.find(x => x.reel === id && x.id === n);
      if (!s) throw new Error(`REEL ${id}: page.json: a span names situation ${n}, which the reel does not hold`);
      return s.scene;
    };
    const { follow, live, jump, pin } = pg.scenario.spans;
    scns[id] = { id: pg.scenario.id, mission: pg.scenario.mission, zero: pg.scenario.zero, spans: {
      follow: follow.map(([until, s, ...rest]) => [until, scene(s), ...rest]),
      live: live.map(([until, s, name]) => [until, scene(s), name]),
      jump: jump.map(j => ({ ...j, scene: scene(j.scene) })),
      pin: pin.map(scene) },
      listing: (pg.listing || []).map(e => e.kind === "situation" ? { ...e, scene: scene(e.sit) } : e),
      quick: pg.quickviews || {} };
    tl[id] = pg.timeline;
  }
  for (const r of reels.filter(x => x.manifest.kind === "playlist")) {
    const id = r.manifest.id, uses = r.manifest.uses;
    for (const u of uses) if (!scns[u]) throw new Error(`REEL ${id}: uses ${u}, which this page does not hold`);
    lists[id] = { ...r.page, shots: r.page.shots.map((sh, k) => {
      const s = uses.includes(sh.reel) && sits.find(x => x.reel === sh.reel && x.id === sh.sit);
      if (!s) throw new Error(`REEL ${id}: shot ${k + 1} names ${sh.reel} situation ${sh.sit}, which ${uses.includes(sh.reel) ? "that reel does not hold" : "the reel does not use"}`);
      return { ...sh, scene: s.scene };
    }) };
  }
  return { sits, scns, tl, lists };
}
// The situation a link names, as its scene, or null (loader.js loadLink). scn: a scenario reel's id; sit: a situation
// id or NAME (any case) in it. Without scn, the first reel in load order holding sit (by id that is Apollo 11's, since
// every reel numbers from 1; a NAME is unique); without sit, scn's first situation. scene: the old links' scene=N
// (#22), the Nth situation across the reels in load order, which before #26 slice 7e (one numbering for all
// situations) was situation N: kept so those links still open what they did. scn and sit win over scene. Ours.
function sceneOfLink(sits, scn, sit, scene) {
  if (scn !== null || sit !== null) {
    const v = sit === null ? null : String(sit).trim().toUpperCase();
    const s = sits.find(x => (scn === null || x.reel === scn) && (v === null || String(x.id) === v || x.name.toUpperCase() === v));
    return s ? s.scene : null;
  }
  return scene !== null && sits[scene - 1] ? scene : null;
}
