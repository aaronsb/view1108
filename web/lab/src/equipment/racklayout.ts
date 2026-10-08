// The tape rack's plan (ours, #19): its frame's measures and where each reel of the site reel index stands. Pure (no
// three.js), so racklayout.test.ts can check it against any index; taperack.ts builds the rack from it.
//
// The index is grouped (ours): one group per mission, earliest range zero first, its scenario reels in index order, then
// one group for the playlists, then, when the rack is given them, one for the system tapes (systapes.ts, #87: props,
// not reels of the index; they stand in `tapes`, not `slots`). Each group's reels fill the rack's cells in order: a cell
// is one bay of one level, the middle bay first, then the west (A) and the east (C) bays, level by level from the top.
// Each reel takes a slot: its case and a gap (its notebook stands on the bookcase, #19 revision after PR #69). A group
// starts on a fresh level while the levels left can still give every group left a level of its own, else in a fresh
// bay; a group too big for its first bay spills into the next cells. A reel with no cell left is not shelved
// (`unplaced`, `unplacedTapes`; the rack warns).
//
// The anonymous reels around them (`filler`, the operator's look of 2026-10-07): a level that holds any of the index's
// reels or system tapes holds only those; every other level is filled about half to two-thirds, in runs of cases
// with irregular gaps between them.
import type { ReelInfo } from "../types";
import type { SystemTape } from "./systapes";

export const W = 2.8, H = 1.85, D = 0.45;
export const POST = 0.03, BAYS = 3, PITCH = (W - POST) / BAYS;   // angle posts, and their spacing centre to centre
export const postX = (k: number) => -W / 2 + POST / 2 + k * PITCH;
export const bayX0 = (b: number) => postX(b) + POST / 2, bayX1 = (b: number) => postX(b + 1) - POST / 2;
export const BAY_W = bayX1(0) - bayX0(0);
/** Each level's deck top, m, levels 1 to 5 from the top. */
export const LEVELS = [1.47, 1.12, 0.77, 0.42, 0.07];
/** A reel case's thickness on edge, the gap between cases; the room left at a bay's ends. */
export const T = 0.04, GAP = 0.004, END0 = 0.012, END1 = 0.008;
/** One reel's slot: its case and a gap. */
export const SLOT = T + GAP;
/** Slots in a bay: the last one's case ends inside the bay. */
export const PER_BAY = Math.floor((BAY_W - END0 - END1 + GAP) / SLOT);
/** The bays in the order a group fills them: B, then A, then C. */
const BAY_ORDER = [1, 0, 2];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** One group: the words on its tape strip and its reels (the system tapes' group: its tapes). */
export interface Group { label: string; reels: ReelInfo[]; tapes?: readonly SystemTape[] }
/** A reel's place: its level (0 the top) and bay (0 A, 1 B, 2 C), and the case's west edge, m in the rack's frame. */
export interface Slot { reel: ReelInfo; level: number; bay: number; x: number }
/** A system tape's place, as a reel's. */
export interface TapeSlot { tape: SystemTape; level: number; bay: number; x: number }
/** A group's tape strip, on the front channel of the cell where its first reel stands. */
export interface Strip { label: string; level: number; bay: number }
export interface RackLayout {
  groups: Group[];
  slots: Slot[];
  tapes: TapeSlot[];
  strips: Strip[];
  unplaced: ReelInfo[];
  /** System tapes with no room left (not shelved). */
  unplacedTapes: SystemTape[];
}

/** One anonymous reel: its level and the centre of its case across the rack, m. */
export interface Filler { level: number; x: number }
/** The share of a bay's places the filler takes on an unlabelled level: about half to two-thirds (ours). */
export const FILL = [0.45, 0.72] as const;

/** Split `total` into `parts` random shares, each at least `min` (the total is enough), drawn from `r`. */
function shares(total: number, parts: number, min: number, r: () => number): number[] {
  const w = Array.from({ length: parts }, () => 0.2 + r()), sum = w.reduce((a, b) => a + b, 0), spare = total - parts * min;
  const out = w.map(x => min + Math.floor(spare * x / sum));
  for (let i = 0, left = total - out.reduce((a, b) => a + b, 0); left > 0; i = (i + 1) % parts, left--) out[Math.floor(r() * parts)]++;
  return out;
}

/** The anonymous reels: none on a level where the plan shelved a reel; on the others, per bay, a share of its places
 *  between FILL's bounds, in runs of cases (two or more) with gaps of irregular width between them, drawn from `r` (a
 *  seeded random in [0, 1)). */
export function filler(plan: RackLayout, r: () => number): Filler[] {
  const out: Filler[] = [], used = new Set([...plan.slots, ...plan.tapes].map(s => s.level)), step = T + GAP;
  const n = Math.floor((BAY_W - END0 - END1 + GAP) / step);
  LEVELS.forEach((_, level) => {
    if (used.has(level)) return;
    for (let b = 0; b < BAYS; b++) {
      const m = Math.round(n * (FILL[0] + 0.02 + r() * (FILL[1] - FILL[0] - 0.04)));
      const runs = Math.max(2, Math.min(Math.floor(m / 2), Math.round(m / 4.5) + (r() < 0.5 ? 0 : 1)));
      const cases = shares(m, runs, 2, r), gaps = shares(n - m, runs + 1, 0, r);
      for (let i = 1; i < runs; i++) if (!gaps[i]) { const j = gaps.findIndex((g, k) => g > 1 || (g > 0 && (k === 0 || k === runs))); if (j >= 0) { gaps[j]--; gaps[i]++; } }
      let k = 0;
      for (let i = 0; i < runs; i++) {
        k += gaps[i];
        for (let c = 0; c < cases[i]; c++, k++) out.push({ level, x: bayX0(b) + END0 + k * step + T / 2 });
      }
    }
  });
  return out;
}

/** The index grouped: each mission's scenario reels, missions by range zero, then the playlists, then the system tapes. */
export function groups(reels: readonly ReelInfo[], system: readonly SystemTape[] = []): Group[] {
  const missions = new Map<string, ReelInfo[]>();
  for (const r of reels) if (r.kind === "scenario") {
    const k = r.mission || r.title;
    missions.set(k, [...missions.get(k) ?? [], r]);
  }
  const when = (rs: ReelInfo[]) => rs[0].zero ?? Number.MAX_VALUE;
  const out: Group[] = [...missions].sort((a, b) => when(a[1]) - when(b[1])).map(([m, rs]) => {
    const z = rs[0].zero, d = z === null ? null : new Date(z);
    return { label: d ? `${m} · ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` : m, reels: rs };
  });
  const lists = reels.filter(r => r.kind === "playlist");
  if (lists.length) out.push({ label: `${lists.map(r => r.title).join(" / ")} REELS`, reels: lists });
  if (system.length) out.push({ label: "SYSTEM TAPES", reels: [], tapes: system });
  return out;
}

export function rackLayout(reels: readonly ReelInfo[], system: readonly SystemTape[] = []): RackLayout {
  const gs = groups(reels, system), cells = LEVELS.length * BAY_ORDER.length;
  const slots: Slot[] = [], tapes: TapeSlot[] = [], strips: Strip[] = [], unplaced: ReelInfo[] = [], unplacedTapes: SystemTape[] = [];
  const cell = (c: number) => ({ level: Math.floor(c / BAY_ORDER.length), bay: BAY_ORDER[c % BAY_ORDER.length] });
  let c = 0, k = 0;   // the next cell, and the slots taken in it
  gs.forEach((g, gi) => {
    if (k > 0) { c++; k = 0; }
    const fresh = Math.ceil(c / BAY_ORDER.length);
    if (LEVELS.length - fresh >= gs.length - gi) c = fresh * BAY_ORDER.length;
    const members: ({ reel: ReelInfo } | { tape: SystemTape })[] = [...g.reels.map(reel => ({ reel })), ...(g.tapes ?? []).map(tape => ({ tape }))];
    members.forEach((m, i) => {
      if (k >= PER_BAY) { c++; k = 0; }
      if (c >= cells) { if ("reel" in m) unplaced.push(m.reel); else unplacedTapes.push(m.tape); return; }
      const { level, bay } = cell(c), x = bayX0(bay) + END0 + k * SLOT;
      if (i === 0) strips.push({ label: g.label, level, bay });
      if ("reel" in m) slots.push({ reel: m.reel, level, bay, x }); else tapes.push({ tape: m.tape, level, bay, x });
      k++;
    });
  });
  return { groups: gs, slots, tapes, strips, unplaced, unplacedTapes };
}
