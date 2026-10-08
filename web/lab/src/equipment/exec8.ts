// The operator console's EXEC 8 loop (#68): what the 1108 Display Console's CRT shows, as text, driven by the page's
// real events. A simplified loop that looks convincing, not EXEC 8 (the operator, 2026-10-07): no public EXEC 8 source
// or working 1108 emulator is known, so this is a reconstruction from the manuals, like the kernel. No three.js: the
// console (console4009.ts) draws it, and `npm test` runs it under node (exec8.test.ts).
//
// Sourced (UP-4144 Rev. 1, "UNIVAC 1108 Operating System EXEC 8 Programmers Reference", 1968; printed pages; quotes
// checked against the scan):
// - The screen: "MESSAGES, INCLUDING A PERMANENTLY DISPLAYED STATUS SUMMARY ON THE TOP TWO LINES, ARE DISPLAYED ON THE
//   FACE OF A CATHODE RAY TUBE (CRT) UNTIL NO LONGER CURRENT AND THEN ARE ROLLED OFF ONTO A UNIVAC PAGEWRITER ...
//   CHARACTERS ENTERED AT THE KEYBOARD ARE DISPLAYED ON THE BOTTOM LINE OF THE CRT" (p. 11-3); 16 lines of 64
//   characters (UP-7604, 1968, sec. 2.1, p. 2-1).
// - The status summary is the SS report, "ALWAYS DISPLAYED ON THE CRT CONSOLE AND ... FREQUENTLY UPDATED" (p. 11-6), in
//   its printed form: "LAST PERIOD USAGE; EXEC XX%, BATCH XX%, DEMAND XX%, IDLE XX%, RT XX%, OPENBCH YY, UNOPRUN YY,
//   AVEBCH ZZ%, AVEDEM ZZ%", XX over "THE LAST 6 SECOND PERIOD" (p. 11-6). Its split over the two lines is ours.
// - Message forms (p. 11-2): EXEC "MMMMMM TEXT", a run's "IDIDID* TEXT" ("THE ASTERISK APPEARS IN AND IDENTIFIES ALL
//   USER MESSAGES"), and a reply needed, "N IDIDID* TEXT", answered by "TYPING IN THE MESSAGE NUMBER FOLLOWED BY HIS
//   RESPONSE"; the lowest free number is used (p. 11-3). No time stamps: none of the forms carries one.
// - Tape loading: "LOAD REEL NO. CC/UU FILENAME -REEL INDEX RUNID", needing no reply, for a file "NOT TO BE CATALOGUED
//   REGARDLESS OF WHETHER OR NOT REEL NUMBERS ARE SUPPLIED" (pp. 12-10, 12-11), as an @ASG,T is; the reel index shows
//   only for a BLANK reel (p. 12-10), so ours never shows it. Its sibling MOUNT ("TO BE ANSWERED BY THE OPERATOR BY A
//   KEY-IN OF THE REEL NUMBER") is for a file to be catalogued with no reel number given; no run here asks for one.
//   Until the reel is mounted the unit is interlocked, and "FOR A PERIOD OF TWO MINUTES AT WHICH TIME THE OPERATOR IS
//   AGAIN NOTIFIED ... SERVICE CC/UU" (p. 12-11).
// - `@ASG,T FILE,T,REEL` and a reel 'SCRTCH' that "MAY INDICATE THAT THE OPERATOR SHOULD MOUNT A SCRATCH REEL"
//   (pp. 5-33, 6-1); `@XQT ELEMENT` (p. 5-55); a run held by @MSG,W, its message "FOLLOWED BY THE ADDITIONAL MESSAGE
//   'WAIT'", which the operator "ANSWERS ... WITH 'GO' WHEN HE HAS COMPLIED WITH THE REQUEST" (p. 5-12).
// - The keyins (pp. 11-3 to 11-8): SS, CS TYPE, CS LIST BACKLOG, X RUNID ("(RUN IDENTITY) - ABORT", p. 11-6), II RUNID
//   (ignored unless the program "HAS ARRANGED TO ACCEPT THE CONSOLE INTERRUPT, OTHERWISE THE KEYIN IS IGNORED AND THE
//   OPERATOR IS NOTIFIED", p. 11-6), DN and UP C/U (pp. 11-3, 11-4; "DN" reads "ON" in the scan's text layer), and
//   "RN C/U RUNID1/RUNID2/.../RUNIDN  SCHEDULE SPECIFIED RUNS FROM MAGNETIC TAPE C/U" (p. 11-8). An undefined keyin
//   gets "KEY ER" (p. 11-2).
//
// Ours (RESTOMOD: a modern addition, labelled so):
// - The run: one per mounted scenario reel, started by the operator keying RN from the RUN STREAMS tape (unit 60,
//   systapes.ts; the fit to VIEW is ours, #87), its id VIEW and the mission's number (VIEW11), its account 69197.
// - Echoing the run's control statements (@RUN, @ASG, @XQT, @FIN) on the console: no source shows the console listing
//   them (the run's console traffic is printed with its listing, Rev. 1 p. 7-35), and no console line for a run
//   opening, a program loading or a normal end was found. They are shown so the run can be followed.
// - The run's own messages (its banner, situations, holds, engine runs, frames to the plot tape, listings) and every
//   reply text the manual does not print: CS TYPE's, CS LIST BACKLOG's layout, II's notice, DN's and UP's.
// - The run waiting at its top for a profile (a type-and-read answered GO) is conjecture: nothing found says VIEW waited
//   for one (issue #68's research findings: the evidence points to batch, TN D-6853 p. 3). It is what a typed READ$
//   line from a terminal would allow (Rev. 1 pp. 9-26, 9-27).
// - Channel/unit numbers: channel 6, the unit the tape unit's head plate's last digit (unit 63, the drive, is 06/03).
// - The plot tape (unit 65): named by the volume number lettered on the tape that unit carries for the run's reel
//   (systapes.ts, #104), not by SCRTCH; the manual's SCRTCH stays the sourced form for a scratch reel.
// - Reel numbers: V, the mission's number and three digits of a hash of the reel's id (a stable number, not a
//   manifest field; "SIX OR LESS CHARACTERS", p. 12-10).
// - The timing: every delay, the typing rate, the status figures and their drift, which messages roll off when.
// - Lines roll off to the PAGEWRITER when the message area is full (oldest first), not "when no longer current".
import type { LabEvent, LabState, ReelInfo } from "../types";
import { systemTapes } from "./systapes";

export const COLS = 64, ROWS = 16;
/** The message area between the status summary (2 lines) and the keyboard line. */
export const MSG_ROWS = ROWS - 3;
/** The PAGEWRITER prints 80 characters a line (UP-7604 sec. 2.1); the log keeps this many lines. */
export const PAPER_MAX = 120;

const RUNSTREAM_CU = "06/00";   // the RUN STREAMS tape's unit (60, systapes.ts)
const REEL_CU = "06/03";        // the drive (63)
const PLOT_CU = "06/05";        // the PLOT TAPE's unit (65)
const SERVICE_S = 120;          // "TWO MINUTES" (p. 12-11)
const STATUS_S = 6;             // "THE LAST 6 SECOND PERIOD" (p. 11-6)
const TYPE_S = 0.085;           // the operator's typing, s a character (ours)

/** A note in the operator's notebook (ours: the notebook and its wording): the keyin as the manual prints its form,
 *  what the operator wrote beside it, and the keyin typed for the run in hand. */
export interface Keyin { id: string; form: string; note: string; key(runid: string): string }
export const KEYINS: readonly Keyin[] = [
  { id: "ss", form: "SS", note: "STATUS REPORT", key: () => "SS" },
  { id: "cstype", form: "CS TYPE", note: "OPEN RUNS", key: () => "CS TYPE" },
  { id: "backlog", form: "CS LIST BACKLOG", note: "RUN QUEUE", key: () => "CS LIST BACKLOG" },
  { id: "rn", form: `RN ${RUNSTREAM_CU} RUNID`, note: "START RUN FROM UNIT 60", key: r => `RN ${RUNSTREAM_CU} ${r}` },
  { id: "ii", form: "II RUNID", note: "INTERRUPT - VIEW IGNORES", key: r => `II ${r}` },
  { id: "x", form: "X RUNID", note: "ABORT THE RUN !", key: r => `X ${r}` },
  { id: "dn", form: `DN ${PLOT_CU}`, note: "PLOT TAPE UNIT DOWN", key: () => `DN ${PLOT_CU}` },
  { id: "up", form: `UP ${PLOT_CU}`, note: "... AND BACK UP", key: () => `UP ${PLOT_CU}` },
];

/** Hooks for the file browser (#74), which will open from the console's seat: the reel's file name and unit. */
export const REEL_FILE = { name: "VIEWTP", cu: REEL_CU } as const;

interface Run {
  id: string;
  reel: string;          // the scenario reel's id
  reelNo: string;
  /** The volume number on the plot tape unit 65 carries for this reel (systapes.ts), else SCRTCH. */
  plotNo: string;
  title: string;
  /** opening: statements still to come; reel: waiting for its reel; profile: waiting for GO; go: running; done */
  phase: "opening" | "reel" | "profile" | "go" | "done";
  waitN: number;         // the type-and-read's number while waiting for GO
  service: number;       // s until the next SERVICE while waiting for the reel
  /** Its RN is on the screen: only then does its end print @FIN. */
  shown: boolean;
}
/** A timed action or a typed line, and the run it belongs to: dropped once that run is not the console's or has ended. */
interface Act { at: number; f: () => void; run?: Run }
interface Typed { text: string; i: number; next: number; done: () => void; run?: Run }
/** Notebook keyins clicked while the operator is typing wait their turn, this many at most (ours). */
const KEYIN_QUEUE = 4;

const pad = (n: number, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, "0");
const fmtGet = (g: number) => `${pad(g / 3600, 3)}:${pad(g / 60 % 60)}:${pad(g % 60)}`;
/** The mission's number from its name ("APOLLO 11" -> 11). */
const missionNo = (m: string) => Number((/\d+/.exec(m) || ["0"])[0]);
/** The run id (ours): VIEW and the mission's number, two digits. */
export const runIdFor = (mission: string) => "VIEW" + pad(missionNo(mission));
/** A stable reel number (ours): V, the mission's number, three digits of an FNV-1a hash of the reel's id. */
export function reelNumber(id: string, mission: string): string {
  let h = 0x811c9dc5;
  for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return "V" + pad(missionNo(mission)) + pad(h % 1000, 3);
}
const clip = (s: string) => s.length > COLS ? s.slice(0, COLS) : s;

/** What the loop reads of the page's state each step (a LabState is one). */
export type ExecState = Pick<LabState, "mounted" | "situation" | "reel" | "get" | "playing" | "tab" | "mode">;

export class Exec8 {
  /** The message area, oldest first (at most MSG_ROWS). */
  msgs: string[] = [];
  /** The PAGEWRITER's log, oldest first: what rolled off the CRT. */
  paper: string[] = [];
  /** The keyboard line: what is being typed. */
  input = "";
  /** Characters typed so far, for the key clicks (roomsound.ts). */
  keys = 0;
  /** Bumped whenever a line rolls off onto the paper: console4009.ts redraws the sheet on it. */
  paperRev = 0;
  /** Bumped whenever something on the screen changes: console4009.ts redraws the CRT on it. */
  rev = 0;
  run: Run | null = null;
  private status: [string, string] = ["", ""];
  private openShown = false;   // the summary's OPENBCH: a run open
  private usage = { exec: 3, batch: 0, demand: 0, idle: 97, avb: 0, avd: 0, n: 0, sumB: 0 };
  private q: Act[] = [];      // in time order
  private t = 0;
  private qt = 0;            // the time the EXEC's last queued action is due
  private typing: Typed[] = [];
  private statusT = 0;
  private seen: ExecState | null = null;
  private recorder = false;
  private last = { tape: -1e9, print: -1e9, frame: -1e9 };
  private frames = 0;
  private units = new Set<string>();   // units keyed down (DN), ours: nothing else reads it
  private r: () => number;

  /** `reels`: the site reel index (the scenario reels' missions and titles); `still`: no drift in the status figures
   *  (the room's ?labmotion=0, for screenshots that repeat). */
  constructor(private reels: readonly ReelInfo[], private still = false, seed = 4144) {
    let s = seed >>> 0 || 1;
    this.r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    this.figures(false);
    this.history();
  }

  /** The shift so far (ours): the index's last scenario reel was run before the room was entered, through this same
   *  loop, and finished; its traffic stands on the CRT above whatever comes next. */
  private history(): void {
    const r = this.reels.filter(x => x.kind === "scenario").pop();
    if (!r) return;
    this.seen = { mounted: r.id, situation: 1, reel: "", get: 0, playing: false, tab: "", mode: "free" };
    const run = this.newRun(r);
    this.open(run, "show"); this.flush();
    this.line(`${run.waitN} GO`); this.fin(run);
    this.run = null; this.seen = null; this.keys = 0;
  }

  /** The screen: 16 lines, the status summary, the message area (padded) and the keyboard line. */
  screen(): string[] {
    const m = this.msgs.slice(-MSG_ROWS);
    return [this.status[0], this.status[1], ...Array.from({ length: MSG_ROWS }, (_, i) => m[i] ?? ""), this.input];
  }

  /** One step of `dt` s against the page's state: the timed actions, the typing, the status, what changed. */
  step(dt: number, s: ExecState): void {
    this.t += dt;
    this.observe(s);
    while (this.q.length && this.q[0].at <= this.t) { const a = this.q.shift()!; if (this.live(a)) a.f(); }
    this.dropStaleTyping();
    const k = this.typing[0];
    if (k && this.t >= k.next) {
      if (k.i < k.text.length) { this.input = clip(this.input + k.text[k.i++]); this.keys++; k.next = this.t + TYPE_S * (0.7 + 0.6 * this.r()); this.rev++; }
      else { this.typed(); k.done(); }   // the carriage return
    }
    if ((this.statusT += dt) >= STATUS_S) { this.statusT = 0; this.figures(!this.still); }
    const run = this.run;
    if (run?.phase === "reel" && (run.service -= dt) <= 0) { run.service = SERVICE_S; this.line(`SERVICE ${REEL_CU}`); }
  }

  /** Run every timed action and finish the typing now (the console as it stands when the room is first built). */
  flush(): void {
    for (let n = 0; n < 500 && (this.q.length || this.typing.length); n++) {
      this.dropStaleTyping();
      if (this.q.length && (!this.typing.length || this.q[0].at <= this.t)) { const a = this.q.shift()!; this.t = Math.max(this.t, a.at); if (this.live(a)) a.f(); continue; }
      const k = this.typing[0];
      if (!k) continue;
      this.keys += k.text.length - k.i; this.typed(); k.done();
    }
    this.qt = this.t; this.rev++;
  }

  /** An action or typed line still belongs to the console's run (or to none). */
  private live(a: { run?: Run }): boolean { return !a.run || (a.run === this.run && a.run.phase !== "done"); }

  /** The line being typed, or waiting to be, for a run that is gone: dropped, the keyboard line cleared. */
  private dropStaleTyping(): void {
    const n = this.typing.length;
    this.typing = this.typing.filter(k => this.live(k));
    if (this.typing.length !== n && this.input) { this.input = ""; this.rev++; }
  }

  /** The carriage return: the keyboard line clears and the next line to type starts a moment later. */
  private typed(): void {
    this.typing.shift(); this.input = ""; this.keys++; this.rev++;
    if (this.typing[0]) this.typing[0].next = Math.max(this.typing[0].next, this.t + 0.3);
  }

  /** Page events (LabEvent): the engine ran, the listing printed, a frame went to the recorder. */
  event(e: LabEvent): void {
    const run = this.run, go = run?.phase === "go";
    if (e.type === "tape" && go && this.t - this.last.tape > 3) { this.last.tape = this.t; this.say(run!, "ENGINE RUN - STATE TAPE WRITTEN"); }
    if (e.type === "print" && go && this.t - this.last.print > 20) { this.last.print = this.t; this.say(run!, "LISTING TO PRINTER"); }
    if (e.type === "beamFrame") {
      this.frames++;
      if (go && this.t - this.last.frame > 12) { this.last.frame = this.t; this.say(run!, `FRAME ${pad(this.frames, 6)} TO ${this.units.has(PLOT_CU) ? "DRUM - PLTTAP DOWN" : "PLTTAP"}`); }
    }
  }

  /** A note clicked in the operator's notebook: type its keyin, then answer it (nothing the page holds changes). The
   *  keyboard is the operator's, so the keyin is typed now, not behind the EXEC's own traffic; clicked while a line is
   *  being typed, it waits its turn. False for an unknown note or a full queue. */
  keyin(id: string): boolean {
    const k = KEYINS.find(x => x.id === id);
    if (!k || this.typing.length > KEYIN_QUEUE) return false;
    // The run id is read when its turn comes, so a keyin queued behind a run's opening names that run.
    const runid = () => this.run && this.run.phase !== "done" ? this.run.id : this.runFor(this.seen?.mounted ?? "")?.id ?? "VIEW11";
    const item: Typed = { text: "", i: 0, next: this.t + 0.3, done: () => { this.line(item.text); const r = runid(); this.soon(0.5, () => this.answer(k.id, r)); } };
    item.text = k.key(runid());
    this.typing.push(item);
    return true;
  }

  /** Busy typing a keyin. */
  get busy(): boolean { return this.typing.length > 0; }

  // ---- the page's state ----

  private observe(s: ExecState): void {
    const was = this.seen;
    this.seen = { mounted: s.mounted, situation: s.situation, reel: s.reel, get: s.get, playing: s.playing, tab: s.tab, mode: s.mode };
    const rec = s.tab === "print" || s.mode === "beam";
    if (!was) {   // the room is built: the run for what is mounted, as it stands
      const r = this.reelInfo(s.mounted);
      if (r?.kind === "scenario") { this.open(this.newRun(r), "show"); this.flush(); }
      this.recorder = rec;
      return;
    }
    if (s.mounted !== was.mounted) this.mounted(s);
    const run = this.run;
    if (run && (run.phase === "profile" || run.phase === "go") && run.reel === s.mounted) {
      if (run.phase === "profile" && (s.playing || s.situation !== was.situation)) this.goAhead(run);
      else if (run.phase === "go") {
        if (s.situation !== was.situation) this.say(run, this.sit(s));
        if (s.playing !== was.playing) this.say(run, `${s.playing ? "CLOCK RUNNING" : "CLOCK HELD"} GET ${fmtGet(s.get)}`);
      }
    }
    if (rec !== this.recorder) {
      this.recorder = rec;
      if (run?.phase === "go" && rec) this.say(run, `PLTTAP ${PLOT_CU} TO RECORDER`);
    }
  }

  /** The mounted reel changed: the open run ends (its reel taken down), and a scenario reel gets a run of its own, or
   *  the run waiting for it goes on. */
  private mounted(s: ExecState): void {
    const run = this.run, r = this.reelInfo(s.mounted);
    if (run && run.phase === "reel" && r && run.reel === r.id) { this.toXqt(run); return; }
    if (run && run.phase !== "done") this.fin(run);
    if (r?.kind !== "scenario") return;
    // The new run is the console's at once, so a second mount before its RN is typed ends it, and nothing of the
    // last run's (its statements, a GO being typed) can land after it.
    const next = this.newRun(r);
    this.after(0.8, () => this.open(next, "type"), next);
  }

  // ---- a run ----

  private newRun(r: ReelInfo): Run {
    const run: Run = { id: runIdFor(r.mission), reel: r.id, reelNo: reelNumber(r.id, r.mission), plotNo: systemTapes(this.reels).find(t => t.reel === r.id && t.id.startsWith("plot."))?.volume ?? "SCRTCH", title: r.title, phase: "opening", waitN: 0, service: SERVICE_S, shown: false };
    this.run = run;
    return run;
  }

  /** The run for the mounted scenario reel, else for the first scenario reel of the index (its id and reel). */
  private runFor(mounted: string): { id: string; reel: ReelInfo } | null {
    const m = this.reelInfo(mounted), r = m?.kind === "scenario" ? m : this.reels.find(x => x.kind === "scenario");
    return r ? { id: runIdFor(r.mission), reel: r } : null;
  }

  /** Open `run`: RN from the RUN STREAMS tape, then the EXEC reads the stream and asks for its tapes. `how`: the
   *  operator types the RN now ("type"), it stands keyed already ("show": the console as the room finds it), or the
   *  notebook's RN note keyed it ("keyed"). Every step belongs to the run, and is dropped if the run ends first. */
  private open(run: Run, how: "type" | "show" | "keyed"): void {
    const rn = `RN ${RUNSTREAM_CU} ${run.id}`;
    const go = () => {
      run.shown = true;
      this.after(0.7, () => this.line(`${run.id} @RUN ${run.id},69197,APOLLO`), run);
      this.after(0.8, () => this.line(`${run.id} @ASG,T ${REEL_FILE.name},T,${run.reelNo}`), run);
      this.after(0.5, () => this.line(`LOAD ${run.reelNo} ${REEL_CU} ${REEL_FILE.name} ${run.id}`), run);
      this.after(0.8, () => this.line(`${run.id} @ASG,T PLTTAP,T,${run.plotNo}`), run);
      this.after(0.5, () => this.line(`LOAD ${run.plotNo} ${PLOT_CU} PLTTAP ${run.id}`), run);
      this.after(0.4, () => { if (this.seen?.mounted === run.reel) this.toXqt(run); else { run.phase = "reel"; run.service = SERVICE_S; } }, run);
    };
    if (how === "type") this.type(rn, () => { this.line(rn); go(); }, run);
    else { if (how === "show") this.line(rn); go(); }
  }

  /** The reel is up: the program is loaded and waits for its profile (ours, conjecture), unless the clock already runs. */
  private toXqt(run: Run): void {
    run.phase = "opening";
    this.after(0.9, () => this.line(`${run.id} @XQT VIEW`), run);
    this.after(0.8, () => this.say(run, `${run.title} - ${this.reelInfo(run.reel)?.mission || ""}`.replace(/ - $/, "")), run);
    this.after(0.7, () => {
      run.phase = "profile"; run.waitN = 0;
      this.line(`${run.waitN} ${run.id}* AWAITING PROFILE - WAIT`);
      if (this.seen?.playing) this.goAhead(run);
    }, run);
  }

  /** The operator answers the run's wait with GO (p. 5-12), and the program runs the situation picked; never for a run
   *  that has ended or is no longer the console's. */
  private goAhead(run: Run): void {
    if (run !== this.run || run.phase !== "profile") return;
    run.phase = "go";
    const reply = `${run.waitN} GO`;
    this.type(reply, () => {
      this.line(reply);
      this.after(0.6, () => { if (this.seen) this.say(run, this.sit(this.seen)); }, run);
    }, run);
  }

  /** The run ends: @FIN once its RN has been seen (a run ended before its RN was typed leaves no trace). */
  private fin(run: Run): void {
    run.phase = "done";
    if (run.shown) this.line(`${run.id} @FIN`);
  }

  private sit(s: ExecState): string {
    return clip(`SIT ${pad(s.situation)} ${(s.reel || "").toUpperCase()}`.slice(0, COLS - 20) + ` GET ${fmtGet(s.get)}`);
  }

  // ---- the keyins' answers ----

  private answer(id: string, runid: string): void {
    const run = this.run && this.run.phase !== "done" && this.run.id === runid ? this.run : null;
    switch (id) {
      case "ss": this.line(this.status[0]); this.line(this.status[1]); break;
      case "cstype": this.line(run ? `${run.id}   ${{ go: "ACTIVE", reel: "WAITING ON " + REEL_CU, profile: `WAITING ON MESSAGE ${run.waitN}`, opening: "OPENING", done: "" }[run.phase]}` : "NO ACTIVE RUNS"); break;
      case "backlog": this.line("NO RUNS IN BACKLOG"); break;
      case "ii": this.line(run ? `${run.id} II IGNORED - NO INTERRUPT ROUTINE` : `${runid} NOT ACTIVE`); break;
      case "x":   // the run ends now: what it had queued, and a GO being typed for it, are dropped
        if (run) { run.phase = "done"; this.q = this.q.filter(a => this.live(a)); this.qt = this.t; this.dropStaleTyping(); this.line(`${run.id} - ABORT`); }
        else this.line(`${runid} NOT ACTIVE`);
        break;
      case "dn": this.units.add(PLOT_CU); this.line(`${PLOT_CU} DN`); break;
      case "up": this.units.delete(PLOT_CU); this.line(`${PLOT_CU} UP`); break;
      case "rn": {
        // p. 11-5's form; the new id's letter, and that no second run follows, are ours
        if (run) { this.line(`${run.id} DUPLICATED. NEW ID IS ${run.id.slice(0, 5)}A`); break; }
        const r = this.reels.find(x => x.kind === "scenario" && runIdFor(x.mission) === runid) ?? this.reelInfo(this.seen?.mounted ?? "");
        if (r && r.kind === "scenario") this.open(this.newRun(r), "keyed");
        else this.line("KEY ER");
        break;
      }
      default: this.line("KEY ER");
    }
  }

  // ---- the screen ----

  /** The status summary from the last period's use (figures ours): a run going takes the batch share. */
  private figures(drift: boolean): void {
    const u = this.usage, go = this.run?.phase === "go", open = this.openShown = !!this.run && this.run.phase !== "done";
    const j = (n: number) => drift ? n + Math.floor((this.r() - 0.5) * 8) : n;
    u.exec = Math.max(1, j(go ? 6 : 3)); u.batch = go && this.seen?.playing ? Math.max(20, j(64)) : open ? Math.max(0, j(4)) : 0;
    u.demand = 0; u.idle = Math.max(0, 100 - u.exec - u.batch - u.demand);
    // AVEBCH: "THE PERCENTAGE OF THE ELAPSED TIME SINCE BOOTING" (p. 11-6), here since the room was built (ours)
    u.n++; u.sumB += u.batch; u.avb = Math.round(u.sumB / u.n); u.avd = 0;
    const p = (n: number) => pad(n) + "%";
    this.status = [`LAST PERIOD USAGE; EXEC ${p(u.exec)}, BATCH ${p(u.batch)}, DEMAND ${p(u.demand)}, IDLE ${p(u.idle)},`,
      `RT 00%, OPENBCH ${pad(open ? 1 : 0)}, UNOPRUN 00, AVEBCH ${p(u.avb)}, AVEDEM ${p(u.avd)}`];
    this.rev++;
  }

  /** A run's own message, "IDIDID* TEXT". */
  private say(run: Run, text: string): void { if (this.run === run && run.phase !== "done") this.line(`${run.id}* ${text}`); }

  /** A line into the message area; the oldest rolls off onto the PAGEWRITER when it is full. A run's state may have
   *  changed with it: the summary's open-run count follows at once (its figures at the next period). */
  private line(text: string): void {
    if ((!!this.run && this.run.phase !== "done") !== this.openShown) this.figures(false);
    this.msgs.push(clip(text));
    while (this.msgs.length > MSG_ROWS) { this.paper.push(this.msgs.shift()!); this.paperRev++; if (this.paper.length > PAPER_MAX) this.paper.shift(); }
    this.rev++;
  }

  /** The EXEC's next action, `d` s after the last one it queued (or now), for `run` if it belongs to one. */
  private after(d: number, f: () => void, run?: Run): void {
    this.qt = Math.max(this.qt, this.t) + d;
    this.at({ at: this.qt, f, run });
  }

  /** An answer to the operator, `d` s from now, not behind the EXEC's queue. */
  private soon(d: number, f: () => void): void { this.at({ at: this.t + d, f }); }

  private at(a: Act): void {
    let i = this.q.length;
    while (i > 0 && this.q[i - 1].at > a.at) i--;
    this.q.splice(i, 0, a);
  }

  /** The operator types `text` for `run` once the EXEC's queue has played out, then the carriage return runs `done`. */
  private type(text: string, done: () => void, run?: Run): void {
    this.typing.push({ text, i: 0, next: Math.max(this.t, this.qt) + 0.3, done, run });
  }

  private reelInfo(id: string): ReelInfo | undefined { return this.reels.find(r => r.id === id); }
}
