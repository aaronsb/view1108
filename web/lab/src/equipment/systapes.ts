// The site's system tapes (#87; set dressing, ours): props on the tape rack's SYSTEM TAPES level, and the reels the
// other six tape units carry while a mission reel is mounted on the drive. They are not reels of the site reel index
// (REEL_LIB): nothing loads them, and pulling one at the rack only shows its label (the page's modal says it is not a
// simulation scenario; LabHooks.ask "system").
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
// The names, the case and reel colours, the label lettering and which unit carries which are all ours.

export interface SystemTape {
  /** A key of its own (placed as "systape:<id>"). */
  id: string;
  /** The words on its labels. */
  label: string;
  /** The hand-lettered front label's lines. */
  lines: readonly string[];
  /** Its case colour on the rack. */
  tint: number;
  /** Its reel's flange colour on a tape unit. */
  flange: number;
  /** The tape unit (head plate number) that carries it while a mission reel is mounted; null: it stays on the rack. */
  unit: number | null;
}

export const SYSTEM_TAPES: readonly SystemTape[] = [
  { id: "exec8", label: "EXEC 8 SYSTEM (COPY)", lines: ["EXEC 8 SYSTEM", "(COPY)"], tint: 0x8a2b22, flange: 0xb8c0c6, unit: null },
  { id: "runstreams", label: "RUN STREAMS", lines: ["RUN", "STREAMS"], tint: 0x3f5a3a, flange: 0x4f8a52, unit: 60 },
  { id: "kernel", label: "VIEW KERNEL", lines: ["VIEW", "KERNEL"], tint: 0x2b2d30, flange: 0xd8d0b4, unit: 61 },
  { id: "ephemeris", label: "EPHEMERIS", lines: ["EPHEMERIS"], tint: 0xb8963a, flange: 0xd9b440, unit: 62 },
  { id: "models", label: "MODELS", lines: ["MODELS"], tint: 0x5b6f86, flange: 0x6d8fb8, unit: 64 },
  { id: "plot", label: "PLOT TAPE", lines: ["PLOT", "TAPE"], tint: 0xd8d0b4, flange: 0xc8642a, unit: 65 },
  { id: "media1", label: "MEDIA 1", lines: ["MEDIA 1"], tint: 0x6b4a78, flange: 0x9a78b0, unit: 66 },
  { id: "media2", label: "MEDIA 2", lines: ["MEDIA 2"], tint: 0x2f6b6b, flange: 0x4fa0a0, unit: null },
];

/** The system tape a tape unit carries while a mission reel is mounted, if any. */
export const tapeOnUnit = (unit: number): SystemTape | undefined => SYSTEM_TAPES.find(t => t.unit === unit);
