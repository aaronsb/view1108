// The tape rack's plan (ours, #19): its frame's measures and where each reel of the site reel index stands. Pure (no
// three.js), so racklayout.test.ts can check it against any index; taperack.ts builds the rack from it.
//
// The index is grouped (ours): one group per mission, earliest range zero first, its scenario reels in index order, then
// one group for the playlists. Each group's reels fill the rack's cells in order: a cell is one bay of one level, the
// middle bay first, then the west (A) and the east (C) bays, level by level from the top. Each reel takes a slot: its
// case and, after it, an empty place for its notebook binder (slice d). A group starts on a fresh level while the levels
// left can still give every group left a level of its own, else in a fresh bay; a group too big for its first bay
// spills into the next cells. A reel with no cell left is not shelved (`unplaced`; the rack warns).
import type { ReelInfo } from "../types";

export const W = 2.8, H = 1.85, D = 0.45;
export const POST = 0.03, BAYS = 3, PITCH = (W - POST) / BAYS;   // angle posts, and their spacing centre to centre
export const postX = (k: number) => -W / 2 + POST / 2 + k * PITCH;
export const bayX0 = (b: number) => postX(b) + POST / 2, bayX1 = (b: number) => postX(b + 1) - POST / 2;
export const BAY_W = bayX1(0) - bayX0(0);
/** Each level's deck top, m, levels 1 to 5 from the top. */
export const LEVELS = [1.47, 1.12, 0.77, 0.42, 0.07];
/** A reel case's thickness on edge, the gap between cases, a notebook slot's width; the room left at a bay's ends. */
export const T = 0.04, GAP = 0.004, NB = 0.05, END0 = 0.012, END1 = 0.008;
/** One reel's slot: its case, a gap, its notebook's place, a gap. */
export const SLOT = T + GAP + NB + GAP;
/** Slots in a bay: the last one's notebook place ends inside the bay. */
export const PER_BAY = Math.floor((BAY_W - END0 - END1 + GAP) / SLOT);
/** The bays in the order a group fills them: B, then A, then C. */
const BAY_ORDER = [1, 0, 2];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** One group: the words on its tape strip and its reels. */
export interface Group { label: string; reels: ReelInfo[] }
/** A reel's place: its level (0 the top) and bay (0 A, 1 B, 2 C), and the case's west edge, m in the rack's frame. */
export interface Slot { reel: ReelInfo; level: number; bay: number; x: number }
/** A group's tape strip, on the front channel of the cell where its first reel stands. */
export interface Strip { label: string; level: number; bay: number }
export interface RackLayout {
  groups: Group[];
  slots: Slot[];
  strips: Strip[];
  /** Per cell (`${level}:${bay}`), where the anonymous reels may start: after the cell's last slot. */
  free: Map<string, number>;
  unplaced: ReelInfo[];
}

/** The index grouped: each mission's scenario reels, missions by range zero, then the playlists. */
export function groups(reels: readonly ReelInfo[]): Group[] {
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
  return out;
}

export function rackLayout(reels: readonly ReelInfo[]): RackLayout {
  const gs = groups(reels), cells = LEVELS.length * BAY_ORDER.length;
  const slots: Slot[] = [], strips: Strip[] = [], free = new Map<string, number>(), unplaced: ReelInfo[] = [];
  const cell = (c: number) => ({ level: Math.floor(c / BAY_ORDER.length), bay: BAY_ORDER[c % BAY_ORDER.length] });
  let c = 0, k = 0;   // the next cell, and the slots taken in it
  gs.forEach((g, gi) => {
    if (k > 0) { c++; k = 0; }
    const fresh = Math.ceil(c / BAY_ORDER.length);
    if (LEVELS.length - fresh >= gs.length - gi) c = fresh * BAY_ORDER.length;
    g.reels.forEach((reel, ri) => {
      if (k >= PER_BAY) { c++; k = 0; }
      if (c >= cells) { unplaced.push(reel); return; }
      const { level, bay } = cell(c), x = bayX0(bay) + END0 + k * SLOT;
      if (ri === 0) strips.push({ label: g.label, level, bay });
      slots.push({ reel, level, bay, x });
      free.set(`${level}:${bay}`, x + SLOT);
      k++;
    });
  });
  return { groups: gs, slots, strips, free, unplaced };
}
