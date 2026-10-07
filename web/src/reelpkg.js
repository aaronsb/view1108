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
// A USTAR archive's regular files, in order: [[name, bytes]]. Names are the 100-byte field with the 155-byte
// prefix; sizes octal. Two zero blocks end it.
function untar(t) {
  const out = [], dec = new TextDecoder(), str = (o, n) => dec.decode(t.subarray(o, o + n)).replace(/\0.*$/s, "");
  for (let o = 0; o + 512 <= t.length;) {
    if (t.subarray(o, o + 512).every(b => b === 0)) break;
    if (str(o + 257, 5) !== "ustar") throw new Error("reel: not a USTAR archive");
    const name = [str(o + 345, 155), str(o + 0, 100)].filter(Boolean).join("/");
    const size = parseInt(str(o + 124, 12).trim() || "0", 8), type = str(o + 156, 1);
    if (!Number.isFinite(size) || o + 512 + size > t.length) throw new Error(`reel: ${name}: bad size`);
    if (type === "0" || type === "") out.push([name, t.slice(o + 512, o + 512 + size)]);
    o += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}
// One package (base64; `id` the name it is shipped under) -> {manifest, files: Map(name -> text)}; refused unless
// it unpacks, its manifest is first, in this format, under that id, names kernel build `sha`, and every file it
// lists is in it.
async function readReel(b64, sha, id) {
  let files;
  try { files = untar(await gunzip(reelBytes(b64))); }
  catch (e) { throw new Error(`REEL ${id} DOES NOT UNPACK (${e.message || e.name})`); }
  const dec = new TextDecoder("utf-8", { fatal: true });
  if (!files.length || files[0][0] !== "manifest.json") throw new Error(`REEL ${id}: manifest.json is not first`);
  const manifest = JSON.parse(dec.decode(files[0][1]));
  if (manifest.id !== id) throw new Error(`REEL ${id}: its manifest says ${manifest.id}`);
  if (manifest.format !== REEL_FORMAT) throw new Error(`REEL ${id}: format ${manifest.format}, not ${REEL_FORMAT}`);
  const k = manifest.kernel || {};
  if (k.sha256 !== sha)
    throw new Error(`REEL ${id} NAMES KERNEL ${k.id} ${String(k.sha256).slice(0, 8)}; THIS PAGE RUNS ${String(sha).slice(0, 8)}`);
  const text = new Map(files.slice(1).map(([n, b]) => [n, dec.decode(b)]));
  for (const c of manifest.contents || []) if (!text.has(c.path)) throw new Error(`REEL ${id}: ${c.path} missing`);
  return { manifest, files: text };
}
// A reel's run decks, in its manifest's order: [[path, text]], each path "<reel id>/<file>".
const reelDecks = r => r.manifest.contents.filter(c => c.type === "scn").map(c => [`${r.manifest.id}/${c.path}`, r.files.get(c.path)]);
