// The operator console's EXEC loop (exec8.ts) against a stand-in page (`npm test` in web/lab; tools/build.sh runs it
// after the bundle): the console as the room finds a scenario reel mounted, a reel mounted from the rack (the run, its
// LOAD message for the reel and the plot tape, the wait for a profile answered GO when the clock starts), a playlist
// mounted (the run's @FIN, the idle EXEC), a notebook keyin typed and answered, a run started by RN waiting for its reel
// (SERVICE every two minutes until it is mounted), every line 64 characters or fewer, and what rolls off reaching the
// PAGEWRITER; and the runs kept apart (PR #101 review): a remount 0.3, 1.2 and 4 s after a mount, the demo taken over
// while GO is typed, X while a run opens, and a keyin queued behind another. Node, no three.js.
import type { ReelInfo } from "../types";
import { systemTapes } from "./systapes";
import { COLS, Exec8, KEYINS, MSG_ROWS, ROWS, reelNumber, runIdFor, type ExecState } from "./exec8";

let fails = 0;
const ok = (c: boolean, what: string) => { if (!c) { fails++; console.error(`FAIL ${what}`); } };
const REELS: ReelInfo[] = [   // the page's index, in its load order
  { id: "apollo11-asflown", title: "APOLLO 11 AS FLOWN", kind: "scenario", mission: "APOLLO 11", zero: 0 },
  { id: "apollo8-asflown", title: "APOLLO 8 AS FLOWN", kind: "scenario", mission: "APOLLO 8", zero: 0 },
  { id: "demo", title: "DEMO", kind: "playlist", mission: "", zero: null },
  { id: "tour", title: "TOUR", kind: "playlist", mission: "", zero: null },
];
const page = (o: Partial<ExecState> = {}): ExecState => ({ mounted: "demo", situation: 1, reel: "DEMO", get: 0, playing: true, tab: "review", mode: "attract", ...o });
/** Step `s` seconds of console time in 50 ms steps against the page state `p`. */
const run = (x: Exec8, s: number, p: ExecState) => { for (let t = 0; t < s; t += 0.05) x.step(0.05, p); };
const text = (x: Exec8) => [...x.paper, ...x.msgs].join("\n");
const fits = (x: Exec8, what: string) => ok(x.screen().length === ROWS && x.screen().every(l => l.length <= COLS), `${what}: 16 lines of at most 64`);

// Ours: the run id and the reel number.
ok(runIdFor("APOLLO 11") === "VIEW11" && runIdFor("APOLLO 8") === "VIEW08", "run ids");
const r11 = reelNumber("apollo11-asflown", "APOLLO 11");
// The plot tape on unit 65 for the reel, as the tape the unit carries is lettered (systapes.ts, #104).
const p11 = systemTapes(REELS).find(t => t.reel === "apollo11-asflown" && t.unit === 65)!.volume;
ok(/^P11\d{3}$/.test(p11), `plot tape volume ${p11}`);
ok(/^V11\d{3}$/.test(r11) && r11 === reelNumber("apollo11-asflown", "APOLLO 11") && r11 !== reelNumber("apollo8-asflown", "APOLLO 11"), `reel number ${r11}`);

// The demo playing: the idle EXEC, its status summary on the top two lines, nothing in the message area.
{
  const x = new Exec8(REELS, true);
  run(x, 10, page());
  const sc = x.screen();
  ok(sc[0].startsWith("LAST PERIOD USAGE; EXEC ") && /IDLE \d\d%,$/.test(sc[0]), `idle: status line 1 "${sc[0]}"`);
  ok(/^RT 00%, OPENBCH 00, UNOPRUN 00, AVEBCH \d\d%, AVEDEM \d\d%$/.test(sc[1]), `idle: status line 2 "${sc[1]}"`);
  ok(x.run === null && x.msgs[0] === "RN 06/00 VIEW08" && x.msgs.slice(-2).join("|") === "0 GO|VIEW08 @FIN", "idle: no run; the shift's last run on the screen, ended");
  fits(x, "idle");
}

// The room built with Apollo 11 mounted (a link): the run stands opened, waiting for its profile.
{
  const x = new Exec8(REELS, true);
  x.step(0.05, page({ mounted: "apollo11-asflown", mode: "free", playing: false, reel: "EARTHRISE" }));
  const t = text(x);
  for (const want of ["RN 06/00 VIEW11", "VIEW11 @RUN VIEW11,69197,APOLLO", `VIEW11 @ASG,T VIEWTP,T,${r11}`, `LOAD ${r11} 06/03 VIEWTP VIEW11`,
    `LOAD ${p11} 06/05 PLTTAP VIEW11`, "VIEW11 @XQT VIEW", "0 VIEW11* AWAITING PROFILE - WAIT"]) ok(t.includes(want), `seeded: "${want}"`);
  ok(x.run?.phase === "profile" && x.input === "", "seeded: waiting for GO, nothing being typed");
  fits(x, "seeded");
}

/** What the console has shown since the shift's last run (the history, Apollo 8 in this index) ended. */
const HIST_END = "VIEW08 @FIN";
const livePart = (x: Exec8) => { const t = text(x), i = t.indexOf(HIST_END); return i < 0 ? t : t.slice(i + HIST_END.length + 1); };
const liveLines = (x: Exec8) => livePart(x).split("\n").filter(Boolean);
/** Every run's @FIN after its own RN, and every run whose RN was shown ended or still the console's. */
function runsSane(x: Exec8, what: string) {
  const L = liveLines(x);
  for (const id of ["VIEW11", "VIEW08"]) {
    const rn = L.indexOf(`RN 06/00 ${id}`), fin = L.indexOf(`${id} @FIN`);
    if (fin >= 0) ok(rn >= 0 && rn < fin, `${what}: ${id} @FIN after its RN (RN ${rn}, @FIN ${fin})`);
    if (rn >= 0 && fin < 0) ok(x.run?.id === id && x.run.phase !== "done", `${what}: ${id} opened and neither ended nor the console's run`);
  }
}
/** No line of run `id` after line `from` of the live part. */
const nothingOf = (x: Exec8, id: string, from: number) => liveLines(x).slice(from + 1).filter(l => l.includes(id) || /^\d GO$/.test(l));

// LOAD ... AND EXEC: Apollo 11 mounted while the demo plays (the clock stopped, as a fresh mount leaves it), then the
// clock started: the operator answers GO and the run goes on; a situation picked; the demo again ends the run. Checked
// on what came after the shift's history run, which shows the same kinds of lines.
{
  const x = new Exec8(REELS, true);
  run(x, 2, page());
  const a11 = page({ mounted: "apollo11-asflown", mode: "free", playing: false, reel: "EARTHRISE", get: 368044 });
  run(x, 1.5, a11);
  ok(x.input.length > 0 && "RN 06/00 VIEW11".startsWith(x.input), `mount: the operator types RN ("${x.input}")`);
  ok(x.keys > 0, "mount: key clicks counted");
  run(x, 12, a11);
  ok(liveLines(x).join("|") === ["RN 06/00 VIEW11", "VIEW11 @RUN VIEW11,69197,APOLLO", `VIEW11 @ASG,T VIEWTP,T,${r11}`, `LOAD ${r11} 06/03 VIEWTP VIEW11`,
    `VIEW11 @ASG,T PLTTAP,T,${p11}`, `LOAD ${p11} 06/05 PLTTAP VIEW11`, "VIEW11 @XQT VIEW", "VIEW11* APOLLO 11 AS FLOWN - APOLLO 11", "0 VIEW11* AWAITING PROFILE - WAIT"].join("|"),
    `mount: the run's lines in order after the history ("${liveLines(x).join("|")}")`);
  ok(x.run?.phase === "profile", "mount: waiting for GO while the clock is stopped");
  run(x, 4, { ...a11, playing: true });
  ok(liveLines(x).slice(-2).join("|") === "0 GO|VIEW11* SIT 01 EARTHRISE GET 102:14:04", "start: GO, then the situation");
  run(x, 1, { ...a11, playing: true, situation: 2, reel: "LUNAR ORBIT", get: 300000 });
  ok(liveLines(x).slice(-1)[0] === "VIEW11* SIT 02 LUNAR ORBIT GET 083:20:00", "a situation picked");
  x.event({ type: "tape", at: 0 });
  ok(text(x).endsWith("VIEW11* ENGINE RUN - STATE TAPE WRITTEN"), "engine run");
  run(x, 2, page({ mounted: "tour", mode: "tour" }));
  ok(text(x).endsWith("VIEW11 @FIN") && x.run?.phase === "done", "a playlist mounted: @FIN");
  runsSane(x, "mount");
  fits(x, "mount");
}

// A second mount soon after the first (0.3 s: before the first run's RN is typed; 1.2 s: while it is typed): the first
// run ends cleanly or leaves no trace, nothing of it lands after the second run's RN, and the second runs to its wait.
for (const gap of [0.3, 1.2, 4]) {
  const x = new Exec8(REELS, true);
  run(x, 1, page());
  run(x, gap, page({ mounted: "apollo11-asflown", mode: "free", playing: false, reel: "EARTHRISE" }));
  run(x, 15, page({ mounted: "apollo8-asflown", mode: "free", playing: false, reel: "EARTHRISE" }));
  const what = `remount after ${gap} s`, L = liveLines(x), rn8 = L.indexOf("RN 06/00 VIEW08");
  runsSane(x, what);
  ok(rn8 >= 0 && nothingOf(x, "VIEW11", rn8).length === 0, `${what}: nothing of VIEW11 after RN VIEW08 (${nothingOf(x, "VIEW11", rn8).join("|")})`);
  ok(L.filter(l => l === "RN 06/00 VIEW08").length === 1 && x.run?.id === "VIEW08" && x.run.phase === "profile", `${what}: one VIEW08 run, waiting (${x.run?.id} ${x.run?.phase})`);
}

// The demo taken over again while the operator is typing GO: the run's @FIN, and no GO after it.
{
  const x = new Exec8(REELS, true);
  run(x, 1, page());
  const a11 = page({ mounted: "apollo11-asflown", mode: "free", playing: false, reel: "EARTHRISE" });
  run(x, 12, a11);
  ok(x.run?.phase === "profile", "demo during GO: waiting first");
  run(x, 0.42, { ...a11, playing: true });
  ok(x.input.length > 0 && "0 GO".startsWith(x.input), `demo during GO: GO being typed ("${x.input}")`);
  run(x, 5, page());
  const L = liveLines(x), fin = L.indexOf("VIEW11 @FIN");
  ok(fin >= 0 && nothingOf(x, "VIEW11", fin).length === 0 && x.input === "", `demo during GO: @FIN, nothing after it (${L.slice(fin).join("|")})`);
  runsSane(x, "demo during GO");
}

// X keyed while the run is opening, the clock running: typed at once, not behind the EXEC's statements; the abort
// ends the run, and nothing of it (no @XQT, no wait, no GO) follows.
{
  const x = new Exec8(REELS, true);
  run(x, 1, page());
  const a11 = page({ mounted: "apollo11-asflown", mode: "free", playing: true, reel: "EARTHRISE" });
  run(x, 3.2, a11);
  ok(x.run?.phase === "opening" && liveLines(x).includes("RN 06/00 VIEW11") && !liveLines(x).includes("VIEW11 @XQT VIEW"), "X while opening: opening");
  ok(x.keyin("x"), "X while opening: keyed");
  run(x, 15, a11);
  const L = liveLines(x), ab = L.indexOf("VIEW11 - ABORT");
  const xi = L.indexOf("X VIEW11");   // the EXEC may print a line already due while the operator types (0.5 s)
  ok(xi >= 0 && ab > xi && ab - xi <= 2, `X while opening: X VIEW11, then VIEW11 - ABORT at once (${L.join("|")})`);
  ok(nothingOf(x, "VIEW11", ab).length === 0 && !L.includes("VIEW11 @XQT VIEW"), `X while opening: nothing of the run after the abort (${L.slice(ab).join("|")})`);
  ok(x.run?.phase === "done", "X while opening: the run ended");
}

// A notebook keyin: typed a character at a time, then answered; X aborts the console's run only.
{
  const x = new Exec8(REELS, true);
  const p = page({ mounted: "apollo11-asflown", mode: "free", playing: true, reel: "EARTHRISE" });
  x.step(0.05, p);
  ok(x.keyin("ss"), "keyin: accepted");
  run(x, 0.36, p);
  ok(x.input.length > 0 && "SS".startsWith(x.input), `keyin: on the keyboard line ("${x.input}")`);
  run(x, 2, p);
  ok(x.msgs.slice(-3)[0] === "SS" && x.msgs.slice(-2).join("\n") === x.screen().slice(0, 2).join("\n"), "SS: the status report");
  ok(x.keyin("backlog") && x.keyin("cstype"), "keyin: a second while the first is typed, queued");
  run(x, 5, p);
  ok(x.msgs.slice(-4).join("|") === "CS LIST BACKLOG|NO RUNS IN BACKLOG|CS TYPE|VIEW11   ACTIVE", `keyin: both typed and answered in turn (${x.msgs.slice(-4).join("|")})`);
  x.keyin("x"); run(x, 3, p);
  ok(x.msgs.slice(-2).join("|") === "X VIEW11|VIEW11 - ABORT" && x.run?.phase === "done", "X: VIEW11 - ABORT");
  x.keyin("cstype"); run(x, 3, p);
  ok(x.msgs.slice(-1)[0] === "NO ACTIVE RUNS", "CS TYPE after the abort");
  x.keyin("ii"); run(x, 3, p);
  ok(x.msgs.slice(-1)[0] === "VIEW11 NOT ACTIVE", "II after the abort");
  for (const k of KEYINS) { x.keyin(k.id); run(x, 4, p); }
  fits(x, "keyins");
}

// RN from the notebook while the demo plays: the run asks for its reel and, unanswered, SERVICE every two minutes; the
// reel mounted then, the program runs.
{
  const x = new Exec8(REELS, true);
  const d = page();
  x.step(0.05, d);
  x.keyin("rn"); run(x, 8, d);
  ok(text(x).includes("LOAD") && x.run?.phase === "reel", "RN: waiting for the reel");
  run(x, 125, d);
  ok(x.msgs.filter(l => l === "SERVICE 06/03").length === 1, "RN: SERVICE after two minutes");
  ok(x.msgs.includes("RN 06/00 VIEW11"), "RN: for the index's first scenario reel");
  const before = x.msgs.filter(l => l.endsWith("@FIN")).length;
  run(x, 6, page({ mounted: "apollo11-asflown", mode: "free", playing: false }));
  ok(text(x).includes("VIEW11 @XQT VIEW") && x.msgs.filter(l => l.endsWith("@FIN")).length === before && x.run?.phase === "profile", "RN: the reel mounted, @XQT, no @FIN");
}

// Lines roll off the message area onto the PAGEWRITER, oldest first.
{
  const x = new Exec8(REELS, true);
  const p = page({ mounted: "apollo11-asflown", mode: "free", playing: true });
  x.step(0.05, p);
  for (let i = 0; i < 6; i++) { x.keyin("backlog"); run(x, 3, p); }
  ok(x.msgs.length === MSG_ROWS && x.paper.length > 0 && x.paper[0] === "RN 06/00 VIEW08" && x.paper.includes("VIEW08 @FIN") && x.paper.includes("RN 06/00 VIEW11"),
    `roll-off: ${x.paper.length} lines on the PAGEWRITER, oldest first`);
}

if (fails) throw new Error(`exec8: ${fails} failure(s)`);
console.log("exec8: PASS (idle, the room built on a mounted reel, LOAD ... AND EXEC to GO and @FIN, remounts at 0.3/1.2/4 s, the demo taken over during GO, X while opening, the notebook's keyins queued, RN waiting on SERVICE, roll-off to the PAGEWRITER)");
