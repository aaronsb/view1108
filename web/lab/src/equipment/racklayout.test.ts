// The tape rack's plan against synthetic reel indexes (`npm test` in web/lab; tools/build.sh runs it after the bundle):
// every reel shelved while there is room, none overlapping another or leaving its bay, every group with its strip, the
// playlists never dropped, and today's four reels where the rack has always put them; the anonymous reels (filler) only
// on levels with none of the index's reels, each bay of those filled within FILL's share, inside the bay and never
// overlapping; with the system tapes (#87, #104), the site's and a set for each reel in a bay of its own below the
// playlists, the reels where they were, none lost; each set one tape for each of the six units that are not the drive.
// Node, no three.js.
import type { ReelInfo } from "../types";
import { REEL_COLOURS, defaultSet, systemTapes, tapeOnUnit, type SystemTape } from "./systapes";
import { BAY_W, BAYS, FILL, GAP, LEVELS, PER_BAY, SLOT, END0, END1, T, bayX0, bayX1, filler, rackLayout } from "./racklayout";

let fails = 0;
const ok = (c: boolean, what: string) => { if (!c) { fails++; console.error(`FAIL ${what}`); } };
const scenario = (id: string, mission: string, zero: number): ReelInfo => ({ id, title: id.toUpperCase(), kind: "scenario", mission, zero });
const playlist = (id: string): ReelInfo => ({ id, title: id.toUpperCase(), kind: "playlist", mission: "", zero: null });

/** Every slot inside its bay, and no two slots in a cell overlapping. */
function sound(name: string, reels: ReelInfo[], system: readonly SystemTape[] = []) {
  const p = rackLayout(reels, system), all = [...p.slots.map(s => ({ ...s, id: s.reel.id })), ...p.tapes.map(t => ({ ...t, id: `systape:${t.tape.id}` }))];
  for (const s of all) ok(s.x >= bayX0(s.bay) && s.x + SLOT <= bayX1(s.bay) - END1 + 1e-9 && s.level < LEVELS.length && s.bay < BAYS, `${name}: ${s.id} out of its bay`);
  const cells = new Map<string, number[]>();
  for (const s of all) cells.set(`${s.level}:${s.bay}`, [...cells.get(`${s.level}:${s.bay}`) ?? [], s.x]);
  for (const [k, xs] of cells) { xs.sort((a, b) => a - b); for (let i = 1; i < xs.length; i++) ok(xs[i] - xs[i - 1] >= SLOT - 1e-9, `${name}: overlap in cell ${k}`); }
  ok(new Set(all.map(s => s.id)).size === all.length, `${name}: a reel placed twice`);
  ok(p.slots.length + p.unplaced.length === reels.length, `${name}: reels lost`);
  ok(p.tapes.length + p.unplacedTapes.length === system.length, `${name}: system tapes lost`);
  ok(p.strips.length === p.groups.filter(g => p.slots.some(s => g.reels.includes(s.reel)) || p.tapes.some(t => g.tapes?.includes(t.tape))).length, `${name}: strips`);
  for (const st of p.strips) ok(!p.strips.some(o => o !== st && o.level === st.level && o.bay === st.bay), `${name}: two strips in one bay`);
  // The filler, for a few seeds.
  const n = Math.floor((BAY_W - END0 - END1 + GAP) / (T + GAP)), used = new Set(all.map(s => s.level));
  for (const seed of [1, 1919, 77]) {
    let x = seed;
    const r = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
    const f = filler(p, r);
    ok(!f.some(a => used.has(a.level)), `${name}/${seed}: filler on a level with the index's reels`);
    for (let l = 0; l < LEVELS.length; l++) for (let b = 0; b < BAYS; b++) {
      const xs = f.filter(a => a.level === l && a.x > bayX0(b) && a.x < bayX1(b)).map(a => a.x).sort((u, v) => u - v);
      for (const c of xs) ok(c - T / 2 >= bayX0(b) && c + T / 2 <= bayX1(b) - END1 + 1e-9, `${name}/${seed}: filler out of bay ${l}:${b}`);
      for (let i = 1; i < xs.length; i++) ok(xs[i] - xs[i - 1] >= T + GAP - 1e-9, `${name}/${seed}: filler overlap in ${l}:${b}`);
      if (!used.has(l)) ok(xs.length >= FILL[0] * n && xs.length <= FILL[1] * n, `${name}/${seed}: bay ${l}:${b} filled ${xs.length} of ${n}`);
      if (!used.has(l)) ok(xs.length < n && xs.some((c, i) => i > 0 && c - xs[i - 1] > T + GAP + 1e-6), `${name}/${seed}: bay ${l}:${b} has no gap`);
    }
  }
  return p;
}

// Today's index: three groups, each on its own level at the left of bay B, playlists last.
{
  const p = sound("today", [scenario("apollo11-asflown", "APOLLO 11", Date.UTC(1969, 6, 16, 13, 32)), scenario("apollo8-asflown", "APOLLO 8", Date.UTC(1968, 11, 21, 12, 51)), playlist("demo"), playlist("tour")]);
  ok(p.strips.map(s => `${s.label}@${s.level}${s.bay}`).join("|") === "APOLLO 8 · DEC 1968@01|APOLLO 11 · JUL 1969@11|DEMO / TOUR REELS@21", `today: strips ${JSON.stringify(p.strips)}`);
  ok(p.slots.every(s => s.bay === 1) && p.unplaced.length === 0, "today: all in bay B");
  ok(LEVELS.length - new Set(p.slots.map(s => s.level)).size === 2, "today: two levels of filler");
}
// 30 reels: 25 scenario reels over 7 missions and 5 playlists, more groups than levels.
{
  const reels: ReelInfo[] = [];
  for (let i = 0; i < 25; i++) reels.push(scenario(`s${i}`, `APOLLO ${7 + (i % 7)}`, Date.UTC(1968 + (i % 7), i % 12, 1)));
  for (let i = 0; i < 5; i++) reels.push(playlist(`p${i}`));
  const p = sound("30 reels", reels);
  ok(p.groups.length === 8 && p.unplaced.length === 0, `30 reels: ${p.groups.length} groups, ${p.unplaced.length} unplaced`);
  ok(reels.filter(r => r.kind === "playlist").every(r => p.slots.some(s => s.reel === r)), "30 reels: a playlist dropped");
}
// One mission of 30 reels: spills from bay B into A and C and the next level.
{
  const p = sound("one big mission", Array.from({ length: 30 }, (_, i) => scenario(`m${i}`, "APOLLO 11", 0)));
  ok(p.unplaced.length === 0 && new Set(p.slots.map(s => `${s.level}:${s.bay}`)).size === Math.ceil(30 / PER_BAY), "one big mission: spill");
}
// More than the rack holds: the rest is reported, not overlapped.
{
  const n = LEVELS.length * BAYS * PER_BAY + 7, p = sound("too many", Array.from({ length: n }, (_, i) => scenario(`x${i}`, "APOLLO 12", 0)));
  ok(p.unplaced.length === 7, `too many: ${p.unplaced.length} unplaced`);
}
// Today's index with the system tapes (#87, #104): the site's two under SYSTEM TAPES and a set for each reel, each group in
// a bay of its own below the playlists (level 4, then 5); the reels where they were.
{
  const today = [scenario("apollo11-asflown", "APOLLO 11", Date.UTC(1969, 6, 16, 13, 32)), scenario("apollo8-asflown", "APOLLO 8", Date.UTC(1968, 11, 21, 12, 51)), playlist("demo"), playlist("tour")];
  const sys = systemTapes(today), p = sound("today + system", today, sys), q = rackLayout(today);
  ok(sys.length === 2 + 4 * 6, `today + system: ${sys.length} tapes`);
  ok(p.strips.map(s => `${s.label}@${s.level}${s.bay}`).join("|") === "APOLLO 8 · DEC 1968@01|APOLLO 11 · JUL 1969@11|DEMO / TOUR REELS@21|SYSTEM TAPES@31|SYSTEM · APOLLO 8@30|SYSTEM · APOLLO 11@32|SYSTEM · DEMO@41|SYSTEM · TOUR@40", `today + system: strips ${JSON.stringify(p.strips)}`);
  ok(p.tapes.length === sys.length && p.unplacedTapes.length === 0, "today + system: tapes lost");
  ok(p.tapes.every(t => t.level >= 3), "today + system: tapes below the playlists");
  // grouped by reel: each set alone in a bay
  const cellOf = (t: { level: number; bay: number }) => `${t.level}:${t.bay}`;
  for (const id of ["apollo8-asflown", "apollo11-asflown", "demo", "tour"]) {
    const mine = p.tapes.filter(t => t.tape.reel === id);
    ok(mine.length === 6 && new Set(mine.map(cellOf)).size === 1 && p.tapes.filter(t => cellOf(t) === cellOf(mine[0])).length === 6, `today + system: ${id} not alone in its bay`);
    ok(mine.every(t => t.tape.label.endsWith(t.tape.reelName) && t.tape.lines[1] === t.tape.reelName), `today + system: ${id} labels`);
  }
  ok(p.tapes.filter(t => t.tape.reel === null).map(t => t.tape.id).join() === "exec8,kernel", "today + system: the site's tapes");
  ok(JSON.stringify(p.slots) === JSON.stringify(q.slots), "today + system: the reels moved");
  ok(LEVELS.length - new Set([...p.slots, ...p.tapes].map(s => s.level)).size === 0, "today + system: no level of filler left");
  // the units: a set is one tape for each of the six units that are not the drive, in its reel's colours
  for (const r of today) {
    const set = sys.filter(t => t.reel === r.id), c = REEL_COLOURS[r.kind];
    ok(set.map(t => t.unit).sort().join() === "60,61,62,64,65,66", `units: ${r.id}'s set ${set.map(t => t.unit)}`);
    ok(set.every(t => t.tint === c.tint && t.flange === c.flange), `units: ${r.id}'s colours`);
    for (let u = 60; u <= 66; u++) {
      const t = tapeOnUnit(sys, today, u, r.id);
      ok(u === 63 ? t === undefined : t?.reel === r.id && t.unit === u, `units: ${r.id} on unit ${u}`);
    }
  }
  ok(defaultSet(today) === "demo" && tapeOnUnit(sys, today, 62, "")?.label === "EPHEMERIS · DEMO", "units: nothing mounted carries the demo's set");
  ok(tapeOnUnit(sys, today, 62, "apollo11-asflown")?.label === "EPHEMERIS · APOLLO 11" && tapeOnUnit(sys, today, 65, "apollo8-asflown")?.label === "PLOT TAPE · APOLLO 8", "units: a mounted reel's set");
  ok(new Set(sys.map(t => t.id)).size === sys.length && new Set(sys.map(t => t.volume).filter(Boolean)).size === 24, "units: ids and volume numbers distinct");
}
// 30 reels in 8 groups and the system tapes: more groups than levels, nothing lost or overlapping.
{
  const reels: ReelInfo[] = [];
  for (let i = 0; i < 25; i++) reels.push(scenario(`s${i}`, `APOLLO ${7 + (i % 7)}`, Date.UTC(1968 + (i % 7), i % 12, 1)));
  for (let i = 0; i < 5; i++) reels.push(playlist(`p${i}`));
  const p = sound("30 reels + system", reels, systemTapes(reels));
  ok(p.unplaced.length === 0, "30 reels + system: unplaced reels");
}
// An overfull rack: the system tapes come last and are the ones reported.
{
  const n = LEVELS.length * BAYS * PER_BAY, reels = Array.from({ length: n }, (_, i) => scenario(`x${i}`, "APOLLO 12", 0)), sys = systemTapes(reels);
  const p = sound("full + system", reels, sys);
  ok(p.unplaced.length === 0 && p.unplacedTapes.length === sys.length, `full + system: ${p.unplacedTapes.length} tapes unplaced`);
}
ok(PER_BAY >= 1 && PER_BAY * SLOT <= BAY_W, "slots per bay");
if (fails) throw new Error(`racklayout: ${fails} failure(s)`);
console.log(`racklayout: PASS (today's 4 reels, 30 reels in 8 groups, one mission of 30, an overfull rack; the system tapes in sets by reel with today's, 30 and a full rack; ${PER_BAY} slots a bay; filler on unlabelled levels only, ${FILL[0]}-${FILL[1]} of each bay, 3 seeds)`);
