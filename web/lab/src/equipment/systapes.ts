// The site's system tapes (#87, #104; set dressing, ours): props on the tape rack's system-tape levels, and the reels
// the seven tape units carry. They are not reels of the site reel index (REEL_LIB): nothing loads them, and pulling one
// at the rack only shows its label (the page's modal says it is not a simulation scenario; LabHooks.ask "system").
//
// Per reel (#104, ours): the tapes that belong to a run come in one set for each reel of the index (Apollo 11 as flown,
// Apollo 8 as flown, the demo and the tour), each copy lettered with its tape and the reel (EPHEMERIS / APOLLO 11) and in
// the reel's colours (blue for a scenario reel, red for a playlist, as their cases on the rack). EXEC 8 SYSTEM (COPY) and
// VIEW KERNEL are the site's, one each, and stay on the rack. A set has six tapes, one for each of the six units that are
// not the drive, so every unit always carries a reel in its colours: the mounted reel's set, or with nothing mounted the
// demo's (`defaultSet`); mounting another reel swaps the sets (uniservo.ts).
//
// What is sourced about them, and what is ours:
// - EPHEMERIS: a trajectory ephemeris tape passed between MSC's programs (C. E. Allday, NASA TN D-6855, printed pp. 7-8;
//   docs/batch-pipeline.md section 1). That the view program read one is not found.
// - PLOT TAPE: the plot tape to the film recorder is conjecture (docs/batch-pipeline.md).
// - RUN STREAMS: runs stored on tape could be started with the operator keyin `RN C/U RUNID...`, "SCHEDULE SPECIFIED
//   RUNS FROM MAGNETIC TAPE C/U" (UP-4144 Rev 1 p. 11-8; reference/cache/notes/exec8-console.md).
// - EXEC 8 SYSTEM (COPY): the site's operating system, set once at system generation (UP-4144 Rev 1 p. 18-11); a copy
//   on tape is ours, and so is leaving it on the rack.
// - VIEW KERNEL, MODELS, MEDIA 1, MEDIA 2: ours.
// The names, the per-reel copies, the case and reel colours, the label lettering, the volume numbers and which unit
// carries which are all ours.
import type { ReelInfo } from "../types";

/** A stable volume number (ours): a letter, the mission's number and three digits of an FNV-1a hash of `key` (the
 *  console's reel numbers, exec8.ts: "SIX OR LESS CHARACTERS", UP-4144 Rev 1 p. 12-10). */
export function volumeNo(letter: string, key: string, mission: string, taken?: Set<string>): string {
  let h = 0x811c9dc5;
  for (const c of key) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  const n = Number((/\d+/.exec(mission) || ["0"])[0]);
  const no = (k: number) => letter + String(n).padStart(2, "0") + String(k % 1000).padStart(3, "0");
  let k = h % 1000;
  for (let i = 0; i < 1000 && taken?.has(no(k)); i++) k++;   // the volume numbers are all different while there are numbers enough
  taken?.add(no(k));
  return no(k);
}

/** A reel's colours (ours): its case on the rack and its flange on a tape unit, the drive's too. */
export const REEL_COLOURS = {
  scenario: { tint: 0x2f4a6b, flange: 0x5d82b0 },
  playlist: { tint: 0x8a2b22, flange: 0xb0453a },
} as const;

export interface SystemTape {
  /** A key of its own (placed as "systape:<id>"): the tape's stem, and for a reel's copy ".<reel id>". */
  id: string;
  /** The tape's name (EPHEMERIS), the first line of its hub label. */
  name: string;
  /** The words on its labels: the name, and for a reel's copy " · " and the reel (EPHEMERIS · APOLLO 11). */
  label: string;
  /** The hand-lettered front label's lines. */
  lines: readonly string[];
  /** Its case colour on the rack. */
  tint: number;
  /** Its reel's flange colour on a tape unit. */
  flange: number;
  /** The tape unit (head plate number) that carries it while its reel is mounted; null: it stays on the rack. */
  unit: number | null;
  /** The reel whose copy it is (a key of the index), null for the site's tapes. */
  reel: string | null;
  /** The reel's short name (APOLLO 11, DEMO), "" for the site's tapes. */
  reelName: string;
  /** Its volume number as the console names it (a reel's copy), "" for the site's tapes. */
  volume: string;
}

/** The site's tapes, one each: they stay on the rack. */
const SITE = [
  { stem: "exec8", name: "EXEC 8 SYSTEM (COPY)", lines: ["EXEC 8 SYSTEM", "(COPY)"], tint: 0x8a2b22, flange: 0xb8c0c6 },
  { stem: "kernel", name: "VIEW KERNEL", lines: ["VIEW", "KERNEL"], tint: 0x2b2d30, flange: 0xd8d0b4 },
] as const;
/** A reel's set, one tape for each of the six units that are not the drive (the units' numbers are the head plates'). */
const SET = [
  { stem: "runstreams", name: "RUN STREAMS", unit: 60 },
  { stem: "media2", name: "MEDIA 2", unit: 61 },
  { stem: "ephemeris", name: "EPHEMERIS", unit: 62 },
  { stem: "models", name: "MODELS", unit: 64 },
  { stem: "plot", name: "PLOT TAPE", unit: 65 },
  { stem: "media1", name: "MEDIA 1", unit: 66 },
] as const;

/** The index's reels in the order the rack shelves them (ours): scenario reels by range zero, then the playlists. */
function ordered(reels: readonly ReelInfo[]): ReelInfo[] {
  const zero = (r: ReelInfo) => r.zero ?? Number.MAX_VALUE;
  return [...reels.filter(r => r.kind === "scenario").sort((a, b) => zero(a) - zero(b)), ...reels.filter(r => r.kind === "playlist")];
}
/** A reel's short name: a scenario reel's mission (APOLLO 11) while it is the only one of its mission, else its title. */
export function reelName(r: ReelInfo, reels: readonly ReelInfo[]): string {
  const alone = r.kind === "scenario" && !!r.mission && reels.filter(q => q.kind === "scenario" && q.mission === r.mission).length === 1;
  return (alone ? r.mission : r.title).toUpperCase();
}

/** The system tapes for an index: the site's two, then a set for each reel in shelving order. */
export function systemTapes(reels: readonly ReelInfo[]): SystemTape[] {
  const out: SystemTape[] = SITE.map(t => ({ id: t.stem, name: t.name, label: t.name, lines: t.lines, tint: t.tint, flange: t.flange, unit: null, reel: null, reelName: "", volume: "" }));
  const taken = new Set<string>();
  for (const r of ordered(reels)) {
    const rn = reelName(r, reels), c = REEL_COLOURS[r.kind];
    for (const t of SET)
      out.push({ id: `${t.stem}.${r.id}`, name: t.name, label: `${t.name} · ${rn}`, lines: [t.name, rn], tint: c.tint, flange: c.flange, unit: t.unit, reel: r.id, reelName: rn,
        volume: volumeNo(t.stem === "plot" ? "P" : "T", `${t.stem}:${r.id}`, r.mission, taken) });
  }
  return out;
}

/** The set a unit carries with nothing mounted: the demo's, else the first playlist's, else the first reel's. */
export function defaultSet(reels: readonly ReelInfo[]): string | undefined {
  return (reels.find(r => r.id === "demo") ?? reels.find(r => r.kind === "playlist") ?? ordered(reels)[0])?.id;
}

/** The tape unit `unit` carries while reel `mounted` is mounted ("" or a reel with no set: the default set). */
export function tapeOnUnit(tapes: readonly SystemTape[], reels: readonly ReelInfo[], unit: number, mounted: string): SystemTape | undefined {
  const set = tapes.some(t => t.reel === mounted) ? mounted : defaultSet(reels);
  return tapes.find(t => t.unit === unit && t.reel === set);
}
