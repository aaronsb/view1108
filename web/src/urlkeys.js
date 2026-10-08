// The link's keys (#22): every key a link may carry, by its canonical name, and the old keys and values the page still
// reads for old links. docs/modes.md "Link parameters" is this table written out (its key, switch and old-key tables);
// the selftest's `url keys:` line checks that the three agree with URL_KEYS, URL_SWITCHES and URL_ALIASES, that the
// page reads no key outside them, and that the LINK button (link.js linkURL) writes only URL_KEYS.
// Most of the page reads the link through UP (config.js), which canonUrl makes canonical. The switches are read
// straight from the address (config.js, kernel.js, player.js, main.js; web/lab/src/lab.ts), which is harmless
// only while none of them has an old name: giving one an alias means moving its reader onto UP. The selftest refuses
// a new reader of the address or a new URLSearchParams outside the files that read them now.
"use strict";
// The keys a shared link carries, the model's first (docs/systems-model.md section 3: mission, scn, sit, reel, get and
// the look), then the presentation's (tab, space and the display), in the order docs/modes.md lists them.
const URL_KEYS = ["mode", "reel", "tab", "mission", "scn", "sit", "photo", "get", "utc", "fov", "yaw", "pitch", "roll",
  "rate", "bspeed", "labels", "frame", "hidden", "view", "target", "cabin", "walls", "bloom", "jitter", "dust", "fps",
  "catalog", "disp", "hz", "traj", "svu", "listing", "notebook", "space", "code", "theme"];
// Switches for screenshots, tests and debugging: read by the page or the room, never written by the LINK button.
const URL_SWITCHES = ["still", "t", "bare", "film", "p", "nosteer", "debug", "dpr", "nowasm", "mock", "labq", "labprobe",
  "labmotion", "labdust"];
// lab=N as the loader read it before #22 (a number, 0 to 3, rounded): its level's name, else null (ignored).
const labLevelOf = v => { const n = v.trim() === "" ? NaN : Number(v); return isFinite(n) && n >= 0 && n <= 3 ? ["off", "primary", "secondary", "all"][Math.round(n)] : null; };
// Old keys and values, each read as its canonical key and value: [old key, old value (null: any), canonical key,
// canonical value (null: the old value; a function: of the old value, null to ignore it), who reads it ("url": canonUrl;
// "loader": loader.js loadLink, since it needs the reels: sceneOfLink for scene, pMode for a playlist reel's ALIAS)].
// They are slated for removal (#22): old links keep working until a release note retires them.
const URL_ALIASES = [
  ["space", "tiled", "space", "tabbed", "url"],         // Room and Tiled became Room and Tabbed (#27)
  ["src", "replay", "traj", "replay", "url"],           // src was both the state source and a code location (#22)
  ["src", "sim", "traj", "sim", "url"],
  ["src", null, "code", null, "url"],
  ["lab", null, "labels", labLevelOf, "url"],           // lab, the label level, beside labq, the room's quality (#22)
  ["labels", "0", "labels", "off", "url"],              // labels was on or off before the levels
  ["labels", "1", "labels", "all", "url"],
  ["scene", null, "scn&sit", null, "loader"],           // scene=N, the Nth situation across the reels in load order (#26 slice 7e)
  ["mode", "attract", "reel", "demo", "loader"],        // a playlist reel's ALIAS as a mode (#18)
  ["mode", "tour", "reel", "tour", "loader"],
];
// A new URLSearchParams: the link's parameters with each old key or value read as its canonical one. For each canonical
// key, a canonical value given in the link wins (all of them, in order, so get() takes the first, as before #22);
// without one, the first old key or value in the link that reads as a value. Keys keep the order they first appear in.
function canonUrl(q) {
  const aliases = URL_ALIASES.filter(a => a[4] === "url"), got = new Map();   // canonical key -> { canon: [values], old: value }
  for (const [k, v] of q) {
    const a = aliases.find(([ok, ov]) => ok === k && (ov === null || ov === v));
    const ck = a ? a[2] : k, cv = !a ? v : a[3] === null ? v : typeof a[3] === "function" ? a[3](v) : a[3];
    if (!got.has(ck)) got.set(ck, { canon: [], old: null });
    const g = got.get(ck);
    if (!a) g.canon.push(v); else if (g.old === null && cv !== null) g.old = cv;
  }
  const out = new URLSearchParams();
  for (const [k, g] of got) for (const v of g.canon.length ? g.canon : g.old === null ? [] : [g.old]) out.append(k, v);
  return out;
}
