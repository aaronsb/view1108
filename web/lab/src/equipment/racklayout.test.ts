// The tape rack's plan against synthetic reel indexes (`npm test` in web/lab; tools/build.sh runs it after the bundle):
// every reel shelved while there is room, none overlapping another or leaving its bay, every group with its strip, the
// playlists never dropped, and today's four reels where the rack has always put them. Node, no three.js.
import type { ReelInfo } from "../types";
import { BAY_W, BAYS, LEVELS, PER_BAY, SLOT, END1, bayX0, bayX1, rackLayout } from "./racklayout";

let fails = 0;
const ok = (c: boolean, what: string) => { if (!c) { fails++; console.error(`FAIL ${what}`); } };
const scenario = (id: string, mission: string, zero: number): ReelInfo => ({ id, title: id.toUpperCase(), kind: "scenario", mission, zero });
const playlist = (id: string): ReelInfo => ({ id, title: id.toUpperCase(), kind: "playlist", mission: "", zero: null });

/** Every slot inside its bay (its case and notebook place), and no two slots in a cell overlapping. */
function sound(name: string, reels: ReelInfo[]) {
  const p = rackLayout(reels);
  for (const s of p.slots) ok(s.x >= bayX0(s.bay) && s.x + SLOT <= bayX1(s.bay) - END1 + 1e-9 && s.level < LEVELS.length && s.bay < BAYS, `${name}: ${s.reel.id} out of its bay`);
  const cells = new Map<string, number[]>();
  for (const s of p.slots) cells.set(`${s.level}:${s.bay}`, [...cells.get(`${s.level}:${s.bay}`) ?? [], s.x]);
  for (const [k, xs] of cells) { xs.sort((a, b) => a - b); for (let i = 1; i < xs.length; i++) ok(xs[i] - xs[i - 1] >= SLOT - 1e-9, `${name}: overlap in cell ${k}`); }
  ok(new Set(p.slots.map(s => s.reel.id)).size === p.slots.length, `${name}: a reel placed twice`);
  ok(p.slots.length + p.unplaced.length === reels.length, `${name}: reels lost`);
  ok(p.strips.length === p.groups.filter(g => p.slots.some(s => g.reels.includes(s.reel))).length, `${name}: strips`);
  for (const st of p.strips) ok(!p.strips.some(o => o !== st && o.level === st.level && o.bay === st.bay), `${name}: two strips in one bay`);
  return p;
}

// Today's index: three groups, each on its own level at the left of bay B, playlists last.
{
  const p = sound("today", [scenario("apollo11-asflown", "APOLLO 11", Date.UTC(1969, 6, 16, 13, 32)), scenario("apollo8-asflown", "APOLLO 8", Date.UTC(1968, 11, 21, 12, 51)), playlist("demo"), playlist("tour")]);
  ok(p.strips.map(s => `${s.label}@${s.level}${s.bay}`).join("|") === "APOLLO 8 · DEC 1968@01|APOLLO 11 · JUL 1969@11|DEMO / TOUR REELS@21", `today: strips ${JSON.stringify(p.strips)}`);
  ok(p.slots.every(s => s.bay === 1) && p.unplaced.length === 0, "today: all in bay B");
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
ok(PER_BAY >= 1 && PER_BAY * SLOT <= BAY_W, "slots per bay");
if (fails) throw new Error(`racklayout: ${fails} failure(s)`);
console.log(`racklayout: PASS (today's 4 reels, 30 reels in 8 groups, one mission of 30, an overfull rack; ${PER_BAY} slots a bay)`);
