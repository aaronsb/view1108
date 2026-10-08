// The operator console's EXEC loop (exec8.ts) against a stand-in page (`npm test` in web/lab; tools/build.sh runs it
// after the bundle): the console as the room finds a scenario reel mounted, a reel mounted from the rack (the run, its
// LOAD message for the reel and the plot tape, the wait for a profile answered GO when the clock starts), a playlist
// mounted (the run's @FIN, the idle EXEC), a notebook keyin typed and answered, a run started by RN waiting for its reel
// (SERVICE every two minutes until it is mounted), every line 64 characters or fewer, and what rolls off reaching the
// PAGEWRITER. Node, no three.js.
import type { ReelInfo } from "../types";
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
    "LOAD SCRTCH 06/05 PLTTAP VIEW11", "VIEW11 @XQT VIEW", "0 VIEW11* AWAITING PROFILE - WAIT"]) ok(t.includes(want), `seeded: "${want}"`);
  ok(x.run?.phase === "profile" && x.input === "", "seeded: waiting for GO, nothing being typed");
  fits(x, "seeded");
}

// LOAD ... AND EXEC: Apollo 8 mounted while the demo plays (the clock stopped, as a fresh mount leaves it), then the
// clock started: the operator answers GO and the run goes on; a situation picked; the demo again ends the run.
{
  const x = new Exec8(REELS, true);
  run(x, 2, page());
  const a8 = page({ mounted: "apollo8-asflown", mode: "free", playing: false, reel: "EARTHRISE", get: 272919.7 });
  run(x, 1.5, a8);
  ok(x.input.length > 0 && "RN 06/00 VIEW08".startsWith(x.input), `mount: the operator types RN ("${x.input}")`);
  ok(x.keys > 0, "mount: key clicks counted");
  run(x, 12, a8);
  const r8 = reelNumber("apollo8-asflown", "APOLLO 8");
  let t = text(x);
  for (const want of ["RN 06/00 VIEW08", `LOAD ${r8} 06/03 VIEWTP VIEW08`, "VIEW08 @XQT VIEW", "VIEW08* APOLLO 8 AS FLOWN - APOLLO 8", "0 VIEW08* AWAITING PROFILE - WAIT"])
    ok(t.includes(want), `mount: "${want}"`);
  ok(t.indexOf("RN 06/00") < t.indexOf("@ASG,T VIEWTP") && t.indexOf("@ASG,T VIEWTP") < t.indexOf(`LOAD ${r8}`) && t.indexOf(`LOAD ${r8}`) < t.indexOf("@XQT"), "mount: RN, @ASG, LOAD, @XQT in order");
  ok(x.run?.phase === "profile", "mount: waiting for GO while the clock is stopped");
  run(x, 4, { ...a8, playing: true });
  t = text(x);
  ok(t.includes("\n0 GO\n") && t.includes("VIEW08* SIT 01 EARTHRISE GET 075:48:39"), "start: GO, then the situation");
  run(x, 1, { ...a8, playing: true, situation: 2, reel: "LUNAR ORBIT", get: 300000 });
  ok(text(x).includes("VIEW08* SIT 02 LUNAR ORBIT GET 083:20:00"), "a situation picked");
  x.event({ type: "tape", at: 0 });
  ok(text(x).endsWith("VIEW08* ENGINE RUN - STATE TAPE WRITTEN"), "engine run");
  run(x, 2, page({ mounted: "tour", mode: "tour" }));
  ok(text(x).endsWith("VIEW08 @FIN") && x.run?.phase === "done", "a playlist mounted: @FIN");
  fits(x, "mount");
}

// A notebook keyin: typed a character at a time, then answered; X aborts the console's run only.
{
  const x = new Exec8(REELS, true);
  const p = page({ mounted: "apollo11-asflown", mode: "free", playing: true, reel: "EARTHRISE" });
  x.step(0.05, p);
  ok(x.keyin("ss"), "keyin: accepted");
  ok(!x.keyin("cstype"), "keyin: one at a time");
  run(x, 0.36, p);
  ok(x.input.length > 0 && "SS".startsWith(x.input), `keyin: on the keyboard line ("${x.input}")`);
  run(x, 2, p);
  ok(x.msgs.slice(-3)[0] === "SS" && x.msgs.slice(-2).join("\n") === x.screen().slice(0, 2).join("\n"), "SS: the status report");
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
console.log("exec8: PASS (idle, the room built on a mounted reel, LOAD ... AND EXEC to GO and @FIN, the notebook's keyins, RN waiting on SERVICE, roll-off to the PAGEWRITER)");
