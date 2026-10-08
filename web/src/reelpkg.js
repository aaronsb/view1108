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
// under notebook/ (its finding and attach blocks are checked too, reelSlips); otherwise the reel is refused. The result
// then carries notebook: {text, figures: Map(name -> SVG text), media} in the manifest's order, else notebook is null.
// A reel's photographs (#29 slice g, #75) are its own, not the notebook's: members of type "media", each
// media/<name>.jpg or .png, raster only by its own first bytes, each named by an attach block or a photo event (a
// scenario reel's page.json `photos`, reelPhotosWrong), every attach's and photo event's photograph present. A media
// member is kept as bytes, every other member as text; the result carries them as media: Map(file -> {bytes, type: its
// MIME type}), the same Map as notebook.media. Readers before these types load such a reel and ignore the notebook (no
// format change; ours); a reader before media refuses a reel that carries any.
const REEL_FIGURE = /^notebook\/figures\/([a-z0-9][a-z0-9-]*)\.svg$/;
// What a figure may hold (ours; reviews of PR #69): an ALLOWLIST, the same as tools/notebook.py svg_unsafe (render and
// pack): the elements and attributes tools/viewsvg.f90 writes. Refused: a <! anywhere (doctype, entity, comment,
// CDATA), a <? but a leading XML declaration ("<?xml" and whitespace, so not <?xml-stylesheet; after at most one byte
// order mark, read from the member's bytes), an element or attribute not on the list (prefixed names among them), a
// namespace not SVG's, an href but to #..., url( or javascript:, a character reference in an attribute value (which
// could spell either; viewsvg writes none), an entity but the XML five and numeric references, and a tag the scanner
// cannot read whole. Whitespace is XML's: space, tab, CR,
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
  const s = String(text).replace(/^\uFEFF?[ \t\r\n]*<\?xml[ \t\r\n][^<>?]*\?>/, ""), TAG = /<([^<>]*)>/g;
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
      if (val.includes("&#")) return "a character reference in an attribute value";
      if (name in REEL_SVG_NS && val !== REEL_SVG_NS[name]) return `a namespace not SVG's ('${val.slice(0, 40)}')`;
      if ((name === "href" || name === "xlink:href") && !val.startsWith("#")) return "an href to anything but #...";
    }
    if (!at(REEL_SVG_END, body, k)) return `a tag the scanner cannot read whole ('${body.slice(k).replace(/^[ \t\r\n]+/, "").slice(0, 40)}')`;
  }
  return null;
}
// Findings and attachments (#29 slice g; the markup is ours, tools/notebook.py's docstring gives it): a fenced block
// whose info string is `finding` or `attach`, starting in the line's first column, holds `key: value` header lines
// (lowercase keys, each once, none empty) up to a blank line, then its text. A finding needs date (YYYY-MM-DD, a real
// day) and cite, and text. An attach needs source (media/<name>.jpg or .png, figures/<name>.svg, or golden=<case>),
// style (plate, clip, tape, insert), finish (photo, film, copy) and a caption (its text); a media source needs credit
// and cite too. Media members are photographs, raster only: media/<name>.jpg or .png, type "media", whose own first
// bytes are JPEG's or PNG's as the name says, at most REEL_MEDIA_MAX bytes. The same rules as tools/notebook.py slip,
// reel_media and load.
const REEL_SLIP_KEYS = { finding: ["date", "cite"], attach: ["source", "style", "finish", "credit", "cite"] };
const REEL_STYLES = ["plate", "clip", "tape", "insert"], REEL_FINISHES = ["photo", "film", "copy"];
const REEL_MEDIA = /^media\/([a-z0-9][a-z0-9-]*\.(jpg|png))$/, REEL_MEDIA_NAME = /^[a-z0-9][a-z0-9-]*\.(jpg|png)$/;
const REEL_MEDIA_MAGIC = { jpg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] };
const REEL_MEDIA_TYPE = { jpg: "image/jpeg", png: "image/png" }, REEL_MEDIA_MAX = 262144;
/** `s` without leading and trailing spaces and tabs, and nothing else (tools/notebook.py strips the same two, so the
 *  page and the packer agree on what is blank); a loop, linear on any run of them. */
function reelTrim(s, more = "") {
  const ws = c => c === " " || c === "\t" || more.includes(c);
  let a = 0, b = s.length;
  while (a < b && ws(s[a])) a++;
  while (b > a && ws(s[b - 1])) b--;
  return s.slice(a, b);
}
/** A `finding` or `attach` block's lines, checked: {key: value, ..., body: its text}; throws why not. */
function reelSlip(kind, lines) {
  const f = {}, no = why => { throw new Error(`${kind}: ${why}`); };
  let k = 0;
  for (; k < lines.length && reelTrim(lines[k]); k++) {
    const m = /^([a-z]+):([^\n]*)$/.exec(lines[k]);
    if (!m) no(`${JSON.stringify(lines[k].trim().slice(0, 60))} is not a 'key: value' header line (a blank line ends them)`);
    const val = reelTrim(m[2]);
    if (!REEL_SLIP_KEYS[kind].includes(m[1])) no(`no key '${m[1]}' (its keys: ${REEL_SLIP_KEYS[kind].join(", ")})`);
    if (m[1] in f) no(`${m[1]} given twice`);
    if (!val) no(`${m[1]} is empty`);
    f[m[1]] = val;
  }
  const body = reelTrim(lines.slice(k).join("\n"), "\n");
  if (kind === "finding") {
    for (const key of ["date", "cite"]) if (!(key in f)) no(`no ${key} (a finding carries the date it was added and its source)`);
    const d = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(f.date), t = new Date(0);
    if (d) t.setUTCFullYear(+d[1], +d[2] - 1, +d[3]);
    if (!d || +d[1] < 1 || t.getUTCFullYear() !== +d[1] || t.getUTCMonth() !== +d[2] - 1 || t.getUTCDate() !== +d[3])
      no(`date '${f.date}' is not a YYYY-MM-DD date`);
    if (!body) no("no text after its header");
  } else {
    for (const key of ["source", "style", "finish"]) if (!(key in f)) no(`no ${key}`);
    if (!REEL_STYLES.includes(f.style)) no(`style '${f.style}' is not one of ${REEL_STYLES.join(", ")}`);
    if (!REEL_FINISHES.includes(f.finish)) no(`finish '${f.finish}' is not one of ${REEL_FINISHES.join(", ")}`);
    if (!body) no("no caption after its header");
    const s = f.source;
    if (s.startsWith("media/")) {
      if (!REEL_MEDIA_NAME.test(s.slice(6))) no(`source '${s}': a photograph is media/<name>.jpg or .png`);
      for (const key of ["credit", "cite"]) if (!(key in f)) no(`source ${s} is a photograph and has no ${key}`);
    } else if (!/^(figures\/[a-z0-9][a-z0-9-]*\.svg|golden=[A-Za-z0-9_-]+)$/.test(s))
      no(`source '${s}' is not media/<file>, figures/<name>.svg or golden=<case>`);
  }
  f.body = body;
  return f;
}
/** A notebook text's `finding` and `attach` blocks, checked, in order: [[kind, fields]]; throws why not. Fences as
 *  tools/notebook.py prose reads them: a line starting ``` opens one (its info string the rest, trimmed) and the next
 *  such line closes it. */
function reelSlips(md) {
  const out = [];
  let fence = null, cur = null;
  for (const ln of String(md).split("\n")) {
    if (fence === null && ln.startsWith("```")) {
      fence = reelTrim(ln.slice(3));
      if (Object.hasOwn(REEL_SLIP_KEYS, fence)) out.push(cur = [fence, []]);
    } else if (fence !== null && ln.startsWith("```")) { fence = null; cur = null; }
    else if (cur) cur[1].push(ln);
  }
  return out.map(([kind, lines]) => [kind, reelSlip(kind, lines)]);
}
/** The figure name an attach source names (figures/<name>.svg, or golden=<case> through the figures block's row
 *  `name | golden=<case>`, `rows` its [name, golden case] pairs), or null for a photograph; throws for a golden case
 *  without a row. */
function reelAttachFigure(source, rows) {
  if (source.startsWith("media/")) return null;
  if (source.startsWith("figures/")) return source.slice(8, -4);
  const r = rows.find(([, gc]) => gc === source.slice(7));
  if (!r) throw new Error(`an attach names ${source}, and the figures block has no row 'name | ${source}'`);
  return r[0];
}
/** The figures block's `name | golden=<case>` rows: [[name, case]]. */
function reelGoldenRows(md) {
  const rows = [];
  let fence = null;
  for (const ln of String(md).split("\n")) {
    if (fence === null && ln.startsWith("```")) fence = reelTrim(ln.slice(3));
    else if (fence !== null && ln.startsWith("```")) fence = null;
    else if (fence === "figures") {
      const f = ln.split("|").map(x => reelTrim(x));
      if (f.length === 2 && f[1].startsWith("golden=") && !reelTrim(ln).startsWith("#")) rows.push([f[0], f[1].slice(7)]);
    }
  }
  return rows;
}
// The figure names a notebook's text names, in order of first use: its Markdown images outside fenced blocks and its
// attach blocks' figure sources. The text names no other image: every "![" opens an inline image
// ![alt](figures/<name>.svg), alt text without "]", and an HTML <img> or a reference definition ("[r]: ...", which
// reference-style images need) is refused (thrown), as is a finding or attach block reelSlips refuses. The same rules
// as tools/notebook.py refs and load, which apply them when it packs.
function reelFigureRefs(md) {
  const out = [], img = /!\[[^\]]*\]\(([^)\s]*)[^)]*\)/g, slips = reelSlips(md), rows = reelGoldenRows(md);
  for (const [k, [, gc]] of rows.entries()) if (rows.findIndex(r => r[1] === gc) !== k) throw new Error(`its figures block names golden=${gc} twice`);
  let fence = false, k = 0;
  for (const ln of md.split("\n")) {
    if (ln.startsWith("```")) {
      if (!fence && Object.hasOwn(REEL_SLIP_KEYS, reelTrim(ln.slice(3)))) {
        const [kind, f] = slips[k++], n = kind === "attach" ? reelAttachFigure(f.source, rows) : null;
        if (n && !out.includes(n)) out.push(n);
      }
      fence = !fence; continue;
    }
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
// A scenario reel's photo events (#75; tools/photos.py, which gives the entry's format): page.json's `photos`, the
// photographs Fusion lays over the plot, each pinned to a situation of the reel and a moment. Why they may not be the
// reel's, or null: each a frame ([A-Z0-9][A-Z0-9-]*, once), its photograph a media member the reel holds (`media`,
// file -> {bytes, type}), a situation the reel holds, a g.e.t. or a bracket's start (numbers or null; get_lo not after
// get_hi), its credit and an https source, its text fields text (get_src, lens_mm, magazine, where, needs, note), and its
// fit null or {cam: three numbers, x, y, rot: numbers, scale above 0}. A frame on two reels is refused by reelPages
// (Fusion keys a photograph by its frame). The same rules as tools/photos.py events.
const REEL_FRAME = /^[A-Z0-9][A-Z0-9-]*$/;
const reelNum = v => typeof v === "number" && isFinite(v);
/** A photo event's g.e.t. in the listing: its own, else its bracket's midpoint, else the bracket's start
 *  (tools/photos.py event_get). */
const reelPhotoGet = p => p.get !== null ? p.get : p.get_hi !== null ? (p.get_lo + p.get_hi) / 2 : p.get_lo;
function reelPhotosWrong(pg, media) {
  const P = pg.photos, sits = pg.situations || [], seen = new Set();
  if (!Array.isArray(P)) return "page.json has no photos";
  for (const p of P) {
    if (!p || typeof p !== "object" || typeof p.frame !== "string" || !REEL_FRAME.test(p.frame)) return `a photo event's frame ${JSON.stringify(p && p.frame)} is not [A-Z0-9][A-Z0-9-]*`;
    const at = `photo ${p.frame}`;
    if (seen.has(p.frame)) return `${at} is in page.json twice`;
    seen.add(p.frame);
    if (!sits.some(s => s.id === p.sit)) return `${at} names situation ${JSON.stringify(p.sit)}, which the reel does not hold`;
    const m = typeof p.media === "string" ? REEL_MEDIA.exec(p.media) : null;
    if (!m || !media.has(m[1])) return `${at} names ${JSON.stringify(p.media)}, which it does not hold`;
    if (![p.get, p.get_lo, p.get_hi].every(v => v === null || reelNum(v)) || (p.get === null && p.get_lo === null))
      return `${at} has no g.e.t. or bracket`;
    if (p.get_lo !== null && p.get_hi !== null && p.get_lo > p.get_hi) return `${at}'s bracket runs backwards`;
    for (const k of ["get_src", "lens_mm", "magazine", "where", "needs", "note"])
      if (typeof p[k] !== "string") return `${at}'s ${k} is not text`;
    if (typeof p.credit !== "string" || !p.credit || typeof p.url !== "string" || !p.url.startsWith("https://")) return `${at} has no credit or https source`;
    const f = p.fit;
    if (f !== null && !(f && typeof f === "object" && Array.isArray(f.cam) && f.cam.length === 3 && f.cam.every(reelNum) &&
        [f.x, f.y, f.rot, f.scale].every(reelNum) && f.scale > 0)) return `${at}'s fit is not null or {cam, x, y, rot, scale}`;
  }
  return null;
}
// A scenario reel's event listing and quick views (#29 slice f, #73; ours): page.json's `listing` and `quickviews`,
// which tools/pack.py generates from the reel's own situations and TIMELINE rows (its header gives the format). Why
// they may not be the reel's, or null. The listing must hold each situation of page.json once (kind "situation", id
// its NAME, sit its id) and each timeline row once, in the timeline's order (kind "event"), every entry with a unique
// id, a name and a g.e.t., in g.e.t. order; a situation entry carries its title and default view, target and field,
// each as its page.json row has it; and each photo event once (kind "photo", #75: id and name its
// frame, sit its situation, get reelPhotoGet). quickviews maps keys "1" to "9" to ids the listing holds.
const REEL_LIST_KINDS = ["situation", "event", "photo"];
function reelListingWrong(pg) {
  const L = pg.listing, Q = pg.quickviews, ids = new Set(), sits = pg.situations || [], evs = (pg.timeline || {}).events || [];
  const shots = Array.isArray(pg.photos) ? pg.photos : [];
  let ph = 0;
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
    } else if (e.kind === "photo") {
      const p = shots.find(x => x.frame === e.id);
      ph++;
      if (!p || e.name !== p.frame || e.sit !== p.sit || e.get !== reelPhotoGet(p)) return `${at} (${e.id}) is not one of the reel's photo events`;
    } else {
      const t = evs[ev++];
      if (!t || t[0] !== e.get || t[1] !== e.tl || t[2] !== e.name) return `${at} (${e.id}) is not the timeline's row ${ev}`;
    }
  }
  if (seenSit.size !== sits.length) return `the listing holds ${seenSit.size} of the reel's ${sits.length} situations`;
  if (ev !== evs.length) return `the listing holds ${ev} of the timeline's ${evs.length} rows`;
  if (ph !== shots.length) return `the listing holds ${ph} of the reel's ${shots.length} photo events`;
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
  // Every member is UTF-8 text but the photographs, kept as bytes (`blobs`): a member its manifest lists as type media.
  const dec = new TextDecoder("utf-8", { fatal: true }), text = new Map(), blobs = new Map();
  let manifest;
  try {
    manifest = JSON.parse(dec.decode(files[0][1]));
    const media = new Set(manifest && Array.isArray(manifest.contents) ? manifest.contents.filter(e => e && e.type === "media").map(e => e.path) : []);
    for (const [n, b] of files.slice(1)) {
      if (text.has(n) || blobs.has(n) || n === "manifest.json") throw new Error(`${n} is in it twice`);
      if (media.has(n)) blobs.set(n, b); else text.set(n, dec.decode(b));
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
  for (const e of c) if (!text.has(e && e.path) && !blobs.has(e && e.path)) throw no(`${e && e.path} is listed but missing`);
  for (const n of [...text.keys(), ...blobs.keys()]) if (!listed.has(n)) throw no(`${n} is in it but not listed`);
  const pages = c.filter(e => e.type === "page");
  if (pages.length !== 1) throw no(`it lists ${pages.length} page.json, not one`);
  let page;
  try { page = JSON.parse(text.get(pages[0].path)); } catch (e) { throw no(`${pages[0].path}: ${e.message}`); }
  const books = c.filter(e => e.type === "notebook"), figs = c.filter(e => e.type === "figure"), pics = c.filter(e => e.type === "media");
  // Its photographs: raster only, by their own first bytes; each one an attach or a photo event names, each named one
  // here (below, after the text's blocks and the photo events are read).
  const media = new Map();
  for (const e of pics) {
    const m = REEL_MEDIA.exec(e.path), b = blobs.get(e.path);
    if (!m) throw no(`${e.path} is media, not media/<name>.jpg or .png (raster only)`);
    if (!REEL_MEDIA_MAGIC[m[2]].every((x, i) => b[i] === x)) throw no(`${e.path} is not a ${m[2].toUpperCase()} file (by its first bytes; raster only)`);
    if (b.length > REEL_MEDIA_MAX) throw no(`${e.path}: ${b.length} bytes, more than ${REEL_MEDIA_MAX}`);
    media.set(m[1], { bytes: b, type: REEL_MEDIA_TYPE[m[2]] });
  }
  const named = new Set();
  if (manifest.kind === "scenario") {
    const why = reelPhotosWrong(page || {}, media) || reelListingWrong(page || {});
    if (why) throw no(why);
    for (const p of page.photos) named.add(REEL_MEDIA.exec(p.media)[1]);
  }
  for (const e of c) if (String(e.path).startsWith("notebook/") && !["notebook", "figure"].includes(e.type))
    throw no(`${e.path} is under notebook/ as type ${e.type}, not notebook or figure`);
  if (books.length > 1) throw no(`it lists ${books.length} notebooks, not one`);
  if (books.length && books[0].path !== "notebook/notebook.md") throw no(`its notebook is ${books[0].path}, not notebook/notebook.md`);
  if (figs.length && !books.length) throw no(`${figs[0].path} is a figure, and it holds no notebook`);
  let notebook = null;
  if (books.length) {
    // The allowlist reads a figure as tools/notebook.py does, its byte order marks kept (dec drops a leading one).
    const figures = new Map(), raw = new TextDecoder("utf-8", { ignoreBOM: true }), member = new Map(files);
    for (const e of figs) {
      const m = REEL_FIGURE.exec(e.path), svg = text.get(e.path);
      if (!m) throw no(`${e.path} is a figure, not notebook/figures/<name>.svg`);
      if (!/^\s*(<\?xml[ \t\r\n][^>]*\?>\s*)?<svg[\s>]/.test(svg) || !/<\/svg>\s*$/.test(svg)) throw no(`${e.path} is not an SVG document`);
      const bad = reelSvgUnsafe(raw.decode(member.get(e.path)));
      if (bad) throw no(`${e.path} holds ${bad}, which a figure may not (the allowlist)`);
      figures.set(m[1], svg);
    }
    const md = text.get(books[0].path);
    let refs;
    try { refs = reelFigureRefs(md); } catch (e) { throw no(e.message); }
    for (const n of refs) if (!figures.has(n)) throw no(`its notebook names figures/${n}.svg, which it does not hold`);
    for (const n of figures.keys()) if (!refs.includes(n)) throw no(`notebook/figures/${n}.svg is in it, and its notebook does not name it`);
    for (const [kind, f] of reelSlips(md)) if (kind === "attach" && f.source.startsWith("media/")) {
      if (!media.has(f.source.slice(6))) throw no(`an attach names ${f.source}, which it does not hold`);
      named.add(f.source.slice(6));
    }
    notebook = { text: md, figures, media };
  }
  for (const n of media.keys()) if (!named.has(n)) throw no(`media/${n} is in it, and no attach or photograph names it`);
  return { manifest, files: text, page, notebook, media };
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
//   photos every scenario reel's photo events (#75; page.json `photos`, reelPhotosWrong), in load order, each with
//          `reel`, `scene` (its situation's), `mission` (its reel's MISSION name) and `pic`, its photograph
//          ({bytes, type}, the reel's media member)
// A reel without page.json, a span naming a situation its reel does not hold, a playlist using a scenario reel the
// page does not hold, or a shot naming a reel its playlist does not use or a situation that reel does not hold, is
// refused with the reel's id.
function reelPages(reels) {
  const sits = [], scns = {}, tl = {}, lists = {}, photos = [];
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
      listing: (pg.listing || []).map(e => e.kind === "event" ? e : { ...e, scene: scene(e.sit) }),
      quick: pg.quickviews || {} };
    tl[id] = pg.timeline;
    for (const ph of pg.photos || []) {
      const twin = photos.find(x => x.frame === ph.frame);
      if (twin) throw new Error(`REEL ${id}: photo ${ph.frame} is on reel ${twin.reel} too`);
      photos.push({ ...ph, reel: id, scene: scene(ph.sit), mission: pg.scenario.mission, pic: r.media && r.media.get(ph.media.slice(6)) });
    }
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
  return { sits, scns, tl, lists, photos };
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
