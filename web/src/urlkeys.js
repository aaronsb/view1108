// The link's keys (#22): every key a link may carry, by its canonical name, and the old keys and values the page still
// reads for old links. docs/modes.md "Link parameters" is this table written out (its key, switch and old-key tables);
// the selftest's `url keys:` line checks that the three agree with URL_KEYS, URL_SWITCHES and URL_ALIASES, that the
// page reads no key outside them, and that the LINK button (link.js linkURL) writes only URL_KEYS.
"use strict";
// The keys a shared link carries, the model's first (docs/systems-model.md section 3: mission, scn, sit, reel, get and
// the look), then the presentation's (tab, space and the display), in the order docs/modes.md lists them.
const URL_KEYS = ["mode", "reel", "tab", "mission", "scn", "sit", "photo", "get", "utc", "fov", "yaw", "pitch", "roll",
  "rate", "bspeed", "labels", "frame", "hidden", "view", "target", "cabin", "walls", "bloom", "jitter", "dust", "fps",
  "catalog", "disp", "hz", "traj", "svu", "listing", "notebook", "space", "code", "theme"];
// Switches for screenshots, tests and debugging: read by the page or the room, never written by the LINK button.
const URL_SWITCHES = ["still", "t", "bare", "film", "p", "nosteer", "debug", "dpr", "nowasm", "mock", "labq", "labprobe",
  "labmotion", "labdust"];
// Old keys and values, each read as its canonical key and value: [old key, old value (null: any), canonical key,
// canonical value (null: the old value)]. They are slated for removal (#22): old links keep working until a release
// note retires them. canonUrl applies them all but the last three, which need the reels and so are the loader's
// (loader.js loadLink: sceneOfLink for scene, pMode for a playlist reel's ALIAS).
const URL_ALIASES = [
  ["space", "tiled", "space", "tabbed"],         // Room and Tiled became Room and Tabbed (#27)
  ["src", "replay", "traj", "replay"],           // src was both the state source and a code location (#22)
  ["src", "sim", "traj", "sim"],
  ["src", null, "code", null],
  ["lab", "0", "labels", "off"],                 // lab, the label level, beside labq, the room's quality (#22)
  ["lab", "1", "labels", "primary"],
  ["lab", "2", "labels", "secondary"],
  ["lab", "3", "labels", "all"],
  ["labels", "0", "labels", "off"],              // labels was on or off before the levels
  ["labels", "1", "labels", "all"],
  ["scene", null, "scn&sit", null],              // scene=N, the Nth situation across the reels in load order (#26 slice 7e)
  ["mode", "attract", "reel", "demo"],           // a playlist reel's ALIAS as a mode (#18)
  ["mode", "tour", "reel", "tour"],
];
const URL_LATE = 3;   // the last URL_LATE aliases are the loader's
// A link's parameters with each old key or value replaced by its canonical one, in place; a canonical key the link
// also gives wins over the old one.
function canonUrl(q) {
  const out = new URLSearchParams(), aliases = URL_ALIASES.slice(0, -URL_LATE);
  for (const [k, v] of q) {
    const a = aliases.find(([ok, ov]) => ok === k && (ov === null || ov === v));
    if (!a) { out.append(k, v); continue; }
    if (a[2] !== k && q.has(a[2])) continue;
    out.set(a[2], a[3] === null ? v : a[3]);
  }
  return out;
}
