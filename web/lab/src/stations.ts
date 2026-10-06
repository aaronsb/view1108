// The station table (docs/systems-model.md, sections 1 and 6; #20, #27): the one declared equipment -> purpose table.
// Each row is a piece of equipment the room places under `name`, what using it does, its hover label, the line at its
// close-up, and its Tabbed counterpart. Everything else reads this table rather than restating it:
//   the lab:  each placed station's `opens` (room/room.ts place()), its hover label (room.ts labels), the close-up's
//             line (lab.ts), and the `Opens` type below;
//   the page: VIEW_LAB.stations (main.ts), from which web/src/room.js derives what a terminal opens (roomOpens), whether
//             that is an overlay (roomOver), the tab it shows (roomTabOf) and the terminal a tab belongs to (roomTermOf).
// Kinds: "tab" opens a page tab (the handover crossfades to it), "overlay" opens over the page, which keeps its tab, and
// "control" acts in place without leaving the room (the drive: STOP/START of the mounted reel's playback clock).
// Adding a station is one row here (for a new kind of opening, its page side in room.js too); both presentations follow.
// The tape library shelf (#19) is not built yet; its row arrives with it.

export interface Station {
  /** The placed name (room.ts) and the page's handle for the terminal. */
  readonly name: string;
  /** The equipment module it is (equipment/index.ts EQUIPMENT). */
  readonly kind: string;
  readonly does: "tab" | "overlay" | "control";
  /** What it opens (the lab's `opens`; the page's arrive(opens)), or for a control what it drives. */
  readonly opens: string;
  /** The page tabs this station is: a tab picked over the room flies here. The first is the one it opens, except the
   *  workbench, which opens the plot tab last shown. */
  readonly tabs: readonly string[];
  /** The hover label. */
  readonly label: string;
  /** The line at its close-up (a shelf's own hint wins while it has one); none for a control. */
  readonly at: string;
  /** Its Tabbed counterpart, for the docs and readers: the tab or panel that does the same. */
  readonly tabbed: string;
}

export const STATIONS = [
  { name: "vector", kind: "vector", does: "tab", opens: "workbench", tabs: ["review", "simulate", "fusion"],
    label: "UNIVAC 1558 — workbench", at: "Click the screen to open", tabbed: "plot view: Review, Simulate and Fusion tabs" },
  { name: "glass", kind: "glass", does: "tab", opens: "source", tabs: ["source"],
    label: "UNISCOPE 100 — source", at: "Click the screen to open", tabbed: "Source tab" },
  { name: "filmrecorder", kind: "filmrecorder", does: "tab", opens: "print", tabs: ["print"],
    label: "Microfilm recorder (S-C 4020, hypothetical) — print", at: "Click the viewing port to open", tabbed: "Print tab" },
  { name: "printer", kind: "printer", does: "overlay", opens: "listing", tabs: [],
    label: "Line printer — listing", at: "Click the paper to open", tabbed: "the listing (Source's Listing button)" },
  { name: "library", kind: "bookcase", does: "overlay", opens: "library", tabs: [],
    label: "Reference library", at: "Click a binder to pull it out · click again to open", tabbed: "the library (Source's Library button)" },
  { name: "drive", kind: "uniservo", does: "control", opens: "playback", tabs: [],
    label: "UNISERVO VIII-C — mounted reel", at: "", tabbed: "the Time panel's DEMO label and Play/Pause button" },
] as const satisfies readonly Station[];

export type StationRow = typeof STATIONS[number];
/** What a terminal opens when the camera arrives at it and it is opened: a tab or an overlay. */
export type Opens = Extract<StationRow, { does: "tab" | "overlay" }>["opens"];

export const stationNamed = (name: string): Station | undefined => STATIONS.find(s => s.name === name);
export const stationOpening = (opens: string): Station | undefined => STATIONS.find(s => s.opens === opens);
