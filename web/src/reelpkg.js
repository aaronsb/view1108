// Reel packages (#26 slice 7): a reel is one .tar.gz (tools/pack.py), manifest.json first, then the files it lists.
// The page unpacks each with the browser's own gzip (DecompressionStream) and this USTAR reader; nothing in a reel
// is code. Its manifest names the kernel build it is for (kernel.sha256, of build/view.opt.wasm), and a reel for
// another build is refused.
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
// build `sha`, lists at least one run deck, its other members are exactly the files it lists, once each, and a
// scenario reel lists one page.json (type "page") that parses. page is that page.json's object, else null.
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
  if (!Array.isArray(c) || !c.some(e => e && e.type === "scn")) throw no("its manifest lists no run deck");
  const listed = new Set(c.map(e => e && e.path));
  for (const e of c) if (!text.has(e && e.path)) throw no(`${e && e.path} is listed but missing`);
  for (const n of text.keys()) if (!listed.has(n)) throw no(`${n} is in it but not listed`);
  const pages = c.filter(e => e.type === "page");
  if (manifest.kind === "scenario" && pages.length !== 1) throw no(`it lists ${pages.length} page.json, not one`);
  let page = null;
  if (pages.length) try { page = JSON.parse(text.get(pages[0].path)); } catch (e) { throw no(`${pages[0].path}: ${e.message}`); }
  return { manifest, files: text, page };
}
// A reel's run decks, in its manifest's order: [[path, text]], each path "<reel id>/<file>".
const reelDecks = r => r.manifest.contents.filter(c => c.type === "scn").map(c => [`${r.manifest.id}/${c.path}`, r.files.get(c.path)]);

// The page's data from the scenario reels' page.json (#26 slice 7d; tools/gen_data.py), in the reels' load order:
//   sits  every situation, each its page.json row plus `reel` (its reel's id) and `scene`, its place among all the
//         reels' situations, 1..N (config.js sitOf). A situation is (reel, id) outside the page: the URL's scn= and
//         sit= (loader.js). scene is the page's handle for it, and the old links' scene=N (#22). Until each reel
//         numbers its own situations (#26 slice 7e) a situation's id is its scene.
//   scns  by reel id: {id (the kernel's scenario number), mission, zero, spans}, the spans' situations as scenes
//   tl    by reel id: the timeline, {name, events: [[get, kind, name], ...]}
// A reel without page.json, or a span naming a situation its reel does not hold, is refused with the reel's id.
function reelPages(reels) {
  const sits = [], scns = {}, tl = {};
  for (const r of reels) {
    const id = r.manifest.id, pg = r.page;
    if (!pg) throw new Error(`REEL ${id}: no page.json`);
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
      pin: pin.map(scene) } };
    tl[id] = pg.timeline;
  }
  return { sits, scns, tl };
}
// The situation a link names, as its scene, or null (loader.js loadLink). scn: a scenario reel's id; sit: a situation
// id or NAME (any case) in it. Without scn, the first reel in load order holding sit; without sit, scn's first
// situation. scene: the old links' scene=N (#22), the Nth situation across the reels in load order, which before
// #26 slice 7d (one numbering for all situations) was situation N: kept so those links still open what they did.
// scn and sit win over scene. Ours.
function sceneOfLink(sits, scn, sit, scene) {
  if (scn !== null || sit !== null) {
    const v = sit === null ? null : String(sit).trim().toUpperCase();
    const s = sits.find(x => (scn === null || x.reel === scn) && (v === null || String(x.id) === v || x.name.toUpperCase() === v));
    return s ? s.scene : null;
  }
  return scene !== null && sits[scene - 1] ? scene : null;
}
