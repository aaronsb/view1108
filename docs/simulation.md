# Simulation: the engine, the score and the tape

VIEW-1108 can show a mission two ways. **Replay** draws the spacecraft on the scenario's legs: simple curves fixed by sourced states (see `src/traj.f`). **Simulation** flies the command and service module (CSM) through the scenario with our own physics and draws it from what the engine recorded. This page describes the simulation. The whole simulation is a restoration: VIEW's own integrator is lost, and ours is new code with its own choices.

## Concept

A historical scenario has two parts:

- A **score**: the scheduled burns, each a time and a velocity change.
- A **reference track**: states the reports give (Apollo 11 Mission Report MSC-00171, Table 7-II, p. 7-9, and Table 7-VII, p. 7-12).

The engine starts from a sourced state, just after translunar injection, and plays the score. If the viewer changes nothing, the mission plays out as flown, as far as our physics allows.

**State vector updates** (our "delta correction"). At each reference row the engine can reset its state to the sourced one, as the ground updated the spacecraft's state by uplink. With updates off, the engine coasts on our physics alone and drifts. Its error at each reference row is a report card on the physics.

Next: burns as targets. For now every burn is the as-flown impulse at its sourced time. A score entry will later carry a TRIGGER (an absolute g.e.t., or relative to an event such as a time base plus an interval, pericynthion, or an engine cutoff) and a TARGET (the cutoff condition, such as the velocity or orbit to reach), beside the sourced as-flown time and velocity change. The card format already allows this: cards are KEY=VALUE with a SRC, and `tools/gen_data.py` ignores keys it does not know yet, with a warning. After that: a planner that edits the score, and direct control.

## Period terms

Each piece has a documented counterpart in Apollo mission support. We use these names; the pieces themselves are ours.

| Here | Period term | Source |
|---|---|---|
| The scenario (`data/missions`) | the "Spacecraft Operational Trajectory", with per-burn "target loads" | MSC Internal Note 69-FM-96, "Revision I of the Spacecraft Operational Trajectory for Apollo 10", Vol. I (tables 5.5-II, 5.6-1, 5.7-1, 5.8-1, "Target loads for ...") |
| The engine (`src/sim.f`) | the RTACF integrator, "the Apollo Reference Mission Program" | Allday, TN D-6855, pp. 7-8 |
| The tape (`src/tape.f`) | the "trajectory ephemeris tape" | Allday, TN D-6855, p. 8 |
| State vector updates | the "CSM/LM state vector update" by uplink to program P27, verb 71 | Comanche 055 (Apollo 11 CM software), `UPDATE_PROGRAM.agc`: "P27 (THE UPDATE PROGRAM) PROCESSES COMMANDS AND DATA INSERTIONS REQUESTED BY THE GROUND VIA UPLINK"; V71 is used for "CSM/LM STATE VECTOR UPDATE" |
| A live feed of vectors (not built) | "A06 - TRANSMIT VECTOR FROM USABLE VECTOR TABLE TO RTACF OR MARSHALL" | RTCC Operations Support Plan, Mission G, MSC IN 69-FS-2, table 4.1-1 (p. 4.1-2) |

Allday also describes the tape: "This tape was written by the basic RTACF integrator (the Apollo Reference Mission Program), which had both free-flight and powered-flight capabilities. Other programs ... that contained no integrator also used the ephemeris tape for input" (TN D-6855, p. 8).

## Boundaries

Each piece is its own element with a narrow interface:

| Piece | File | Knows | Does not know |
|---|---|---|---|
| Scenario | `data/missions/*/*.scn` → `src/viewdata.f` | START state, BURN cards (the score), REF rows, with sources | anything about code |
| Engine | `src/sim.f` | physics, the score, the reference rows | drawing |
| Tape | `src/tape.f` | time-tagged states, up to 4 vehicle channels (CSM only now), event marks | how states were made or drawn |
| State source | `src/vsrc.f` | whether to read the replay or the tape | what a scene does with the state |
| Scenes and layers | `src/vdrive.f`, `src/l*.f` | cameras and drawing | which source fed them |

The four channels follow TN D-6853 (printed p. 12): "As many as four vehicle trajectories can be integrated simultaneously."

Page interface (see `CLAUDE.md`):
- `sim_run(flags)` runs the engine over the current scenario and fills the tape. Flags bit 0 turns state vector updates on.
- `in_src` (0 replay, 1 tape) draws from the tape (the engine's, or one read from a deck: `TAPE` cards, `CLAUDE.md`); the kernel also takes this as `in_flags` bit 3.
- `hdr(17)` reports the source used: 0 replay, 1 sim with updates, 2 sim free, 3 a tape read from the deck.
- `hdr(18)`, `hdr(19)` and `hdr(20)` give the last run's position error (km), velocity error (ft/s) and the time of the nearest reference row (0 with a deck tape).

A time outside the tape, for example before translunar injection, falls back to replay, and so does any time after the scenario's entry interface (its EI event): the tape runs on past it (END), but the engine has no atmosphere, so the replay's entry leg (a TABLE of the entry's states, see `src/traj.f`) carries the CSM down to the splash point. The engine flies the CSM only (tape channel 1). The lunar module (LM) is always drawn from replay: its own legs (`VEH=LM` in the scenario) and the rules of `LMSTAT` in `src/traj.f`. Its CSM-relative spans (docked, 300 ft out after undocking, the closing before docking) follow whichever CSM state the frame uses.

## Period analogue

The planning programs ran on the same machines, in the same way, during missions. Allday (TN D-6855, p. 7): the RTACF programs were "incorporated into the RTACF computer system without change to the basic logic and equations. During the mission, the programs were run in a batch-processing mode, which is similar to the premission planning mode."

State vectors went from the mission computers to those planning computers:

- TN D-6855 (Allday, 1972), printed p. 6: figure 2 draws a "Vector transmit" line from the RTCC to the Real-Time Auxiliary Computing Facility (RTACF). Figure 3 shows the RTACF's computing as two Univac 1108s, fed by a "Data line" "From RTCC".
- The RTCC ran on IBM 360/75s (NASA-TM-X-64290, p. 113; see `docs/univac-1108.md`).
- During missions the RTACF's programs "were run in a batch-processing mode, which is similar to the premission planning mode" (TN D-6855, p. 7).
- VIEW's own integrator was Encke/Cowell (TN D-6853, p. 3).

Our state vector updates play the part of the transmitted and uplinked vectors. The mapping is our reading; no source says VIEW was run this way.

## What the engine does (all ours)

- **Integration.** Cowell's method with fourth-order Runge-Kutta. The Earth, the Moon and the Sun act as point masses. The Moon comes from the kernel's Meeus ch. 47 series and the Sun from its low-precision series (`src/ephem.f`); the Sun is placed at 1 AU. The step is 1/50 of the local dynamical time, sqrt(r³/μ), about whichever of the Earth or the Moon gives the shorter one, clamped to 1–600 s. Steps end exactly on every burn and reference row.
- **Burns** are impulses at mid-burn: ignition plus half the firing time.
  - Magnitudes are from MR Tables 7-III, 7-V and 7-VI.
  - The small Earth-referenced burns (the evasive manoeuvre and both midcourse corrections) take their directions from the Table 7-II ignition and cutoff rows. We derived these directions ourselves.
  - Lunar orbit insertion and circularization are assumed retrograde, and transearth injection prograde.
  - Three burns under 2.5 ft/s are left out; the scenario lists them.
- **Reference rows** about the Moon use the sourced position, altitude, speed and flight-path angle. The horizontal direction comes from the lunar leg's plane. The report's lunar headings are in a frame we cannot use.
- **The tape** stores every step. It reads by cubic Hermite interpolation and never interpolates across a burn or a state vector update.

## The Moon and the frames

The engine and the pictures share one Moon: Meeus, *Astronomical Algorithms* (2nd ed., 1998), chapter 47. That is the ELP-2000/82 lunar theory abridged to the 60 + 60 periodic terms of tables 47.A and 47.B (`data/meeus47.txt`). Time is TT; Earth-fixed coordinates are precessed to J2000 (IAU 1976). This is a restoration: the period RTCC read its ephemeris from a tape ("The ephemeris subroutines used in the RTCC will be system subroutines", reading "an ephemeris tape"; Analytical Mechanics Associates Report 68-4, contract NAS 9-4036, April 1968, p. 17, NTRS 19680014837), so a precise Moon is nearer period practice than a short formula.

Against JPL Horizons (geocentric, ICRF, queried 2026-09-30), every 12 h:

| Span | Position error, km (min–max) | Before (the old low-precision series), km |
|---|---|---|
| Apollo 8, 1968 Dec 20–28 | 5.1–15.0 | 499–1086 |
| Apollo 11, 1969 Jul 16–25 | 1.1–10.4 | 283–813 |

Most of the old engine's lunar miss was a frame error, not the Moon's. The reports' latitudes and longitudes are Earth-fixed. Turning them by sidereal time gives the equator and equinox of *date*, about 0.43° of precession away from the J2000 frame of our stars and Moon. Before the fix, the MR's 4:40 and first-midcourse states flew to closest approaches 520–610 n mi *below* the lunar surface, about 46 minutes early. After it they reach 182.3 n mi at 75:38:10, where the MR predicts 180.8 n mi at 75:39:30 after the evasive manoeuvre. The first-midcourse state reaches 51.6 n mi at 75:53:31, where the MR predicts 61.5 n mi at 75:53:35 (MR Table 7-III, p. 7-10). The Earth's coastlines use the same precession now.

The engine reads the Moon from a half-hourly table filled from the series at the start of each run (cubic Hermite, error well under a metre). The series is too slow to call at every step.

## Report card: Apollo 11

These results are for Apollo 11 as flown, starting from the TLI state at 2:50:13.2. Each error is the engine's state against the reference row, just before any update there. Wasm run time: 9.2 ms with updates, 4.7 ms without (`node tools/selftest.mjs`).

| Reference row (MR Table 7-II) | g.e.t. | with updates: km | ft/s | free: km | ft/s |
|---|---|---|---|---|---|
| separation manoeuvre cutoff | 4:40:04.7 | 50 | 30 | 50 | 30 |
| first midcourse correction cutoff | 26:45:01.8 | 29 | 1.4 | 873 | 42 |
| lunar orbit insertion cutoff | 75:55:48.0 | 38 | 368 | 3917 | 2614 |
| circularization cutoff | 80:11:53.5 | 8 | 96 | 5131 | 9246 |
| undocking | 100:12:00.0 | 481 | 1392 | 5300 | 5028 |
| separation cutoff | 100:40:01.9 | 14 | 69 | 3975 | 3403 |
| docking | 128:03:00.0 | 624 | 1785 | 4110 | 5175 |
| ascent stage jettison | 130:09:31.2 | 48 | 138 | 2725 | 8417 |
| transearth injection ignition | 135:23:42.3 | 146 | 419 | 1179 | 748 |
| second midcourse correction cutoff | 150:30:07.4 | 6290 | 346 | 47606 | 2857 |
| CM/SM separation | 194:49:12.7 | 30 | 108 | 182662 | 24966 |
| entry interface (Table 7-VII) | 195:03:05.7 | 23 | 124 | 180534 | 34182 |

The free run's lunar orbit insertion is an impulse against the velocity wherever the engine then is. Once it is off, it stays off. The free run is a report card, not a mission.

## Known limits

- **The lunar orbit drifts about 480–620 km over 20–27 hours between rows.** The rows' 7113 s period implies a mean radius about 6 km below RM plus the rows' altitudes. The altitudes are referenced to Landing Site 2 (MR Table 7-I, p. 7-8), whose radius we don't have, and a point-mass Moon ignores the lunar gravity field. Table 7-II has no rows between 80:11 and 100:12, or between 100:40 and 128:03. We are not modelling the gravity field now.
- **Transearth injection is one prograde impulse for a 151 s burn** with an assumed direction. Fifteen hours later, at the second midcourse correction, the run with updates is 6290 km off. The update there brings it back: 30 km at CM/SM separation.
- **The sourced rows agree with each other only to about 20–60 km near the Earth.** The CM/SM separation → entry interface arc gives 23 km at entry.
- **The 3:17:04.6 separation row is excluded as a reference.** It sits about 0.28° of longitude (60 km) off the conic through the TLI row, while the 4:40 row agrees with that conic to 0.04°. Correcting to it made the 4:40 error worse (184 km against 50). The scenario keeps it, commented out, with this reason.
- **Lunar-orbit insertion and circularization are impulses against the velocity,** a direction we assumed.

Between rows the integrator itself is exact enough: from the same state it matches a Kepler conic to 2 m over 30 minutes after translunar injection, and to under 1 m from CM/SM separation to entry.

## Restoration, labelled

Everything on this page beyond the quoted sources is ours: the engine and its physics, the step rule, impulsive burns and their assumed directions, the reference-state construction about the Moon, the tape and its interpolation, and a state vector update as an instant reset. VIEW's output was pre-flight (TN D-6853, p. 3); flying the as-flown score is a modern use.
