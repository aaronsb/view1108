# The machine room's equipment

The Room view (`web/lab`, see `web/lab/README.md`) is furnished with simplified models of the equipment around a
UNIVAC 1108. Each one is built from its sources where we have them. Where we don't, the model is inferred from a
photograph or is labelled hypothetical. Which pieces stand in the room and where they go is our choice. No floor
plan of MSC's 1108 room survives in our sources.

## Sources

| Short name | Document |
|---|---|
| UP-4046 | UNIVAC 1108 Multi-Processor System, System Description, rev. 3: <https://fourmilab.ch/documents/univac/manuals/pdf/1108/UP-4046_1108mpSysDescr.pdf> |
| UP-7604 | UNIVAC 1108 Display Console, Component Description (1968): <https://fourmilab.ch/documents/univac/manuals/pdf/1108/UP-7604_1108_Display_Console_Component_Description_1968.pdf> |
| UP-7701 | UNISCOPE 100 Display Terminal, General Description, rev. 2 (1973): <https://fourmilab.ch/documents/univac/manuals/pdf/Uniscope/UP-7701r2_Uniscope_100_Display_Terminal_General_Description_1973.pdf> |
| UP-7789 | UNIVAC Advanced Graphic System Type 1557/1558, General Description (1970): <https://fourmilab.ch/documents/univac/manuals/pdf/Peripherals/UP-7789_Advanced_Graphic_System_Type_1557_1558_General_Description_1970.pdf> |
| Brochure | UNIVAC 1108 II brochure, Computer History Museum 102646105: <https://www.computerhistory.org/brochures/doc-4372956ec8276/> |
| MSC photo | "UNIVAC 1108 at NASA Manned Spacecraft Center", Sperry Rand, 15 July 1969: `docs/media/UNIVAC1108-NASA.png` |

The manuals and the brochure are © Sperry Rand. We studied them but do not keep them in the repository.

Palette, read off the brochure's colour plates (approximate): cabinets `#c9ccc8`, the CPU row's warmer grey
`#cfcbc0`, panels charcoal `#3a3f44`, accent orange `#c8642a`, desk tops `#eeeeea`. The lamps are warm white and
amber. The materials are painted steel with a faint drifting roughness, laminate, chrome, smoked acrylic, rubber,
and unlit lamps and screens (`web/lab/src/equipment/kit.ts`). All textures are procedural.

## The pieces

Sizes are W x H x D in metres.

| Registry name | What it is | Source | Size | Confidence |
|---|---|---|---|---|
| `vector` | UNIVAC 1558 Graphic Display Console, showing the plot | UP-7789 Fig. 1-1 (p. 1), light pen p. 15, function keys p. 16, size p. 27 | 0.9 x 1.5 x 1.25 (35 x 60 x 50 in, read as W x H x D: inferred) | Shape good. Its use at MSC is not documented; we chose it as the 1108's own vector display |
| `glass` | UNISCOPE 100 Display Terminal, showing the kernel source | UP-7701 Fig. 1-1 and p. 1 (10 x 5 in viewing area, 16 x 64 or 12 x 80, green on dark), size p. 30 | 0.46 x 0.33 x 0.69 | Good. Delivered from 1970, a year after the film (an anachronism we keep for Source) |
| `uniservo` | UNISERVO VIII-C tape unit | UP-4046 sec. 8.4.2 (120 in/s, 240 in/s rewind, 2400 ft reels); brochure p. 7; MSC photo (numbers 60, 61, ...) | 0.75 x 1.8 x 0.75 (inferred) | Good on look; vacuum columns not shown |
| `cpu` | 1108 cabinet; `{lampPanel: true}` is the processor's maintenance panel | Brochure p. 3 (colour) | 0.8 x 1.9 x 0.8 (inferred) | Good on look; the lamp count is ours |
| `console4009` | 1108 Display Console: indicator panel with Day Clock, CRT and keyboard, PAGEWRITER on a pedestal | UP-7604 Fig. 2-1 (p. 2-1), Table 2-1 (p. 2-2), secs. 2.3.2 to 2.3.4 (pp. 2-5, 2-6); UP-4046 Fig. 1-1; brochure pp. 6, 7 | 2.8 x 1.25 x 0.95 (ours) | Fair: parts sourced, layout and sizes ours |
| `controller1557` | UNIVAC 1557 Display Controller | UP-7789 p. 27 (48 x 24 x 64 in, read as W x D x H) | 1.2 x 1.6 x 0.6 | Size sourced, look HYPOTHETICAL (no figure) |
| `printer` | High-speed printer, 132 columns, 1200 lines/min, fanfold greenbar paper | UP-4046 sec. 8.5 (model not stated); MSC photo | 1.4 x 1.2 x 0.8 (inferred) | Fair; the paper path and stacker are ours |
| `cardreader` | Card reader | MSC photo (foreground) | 1.0 x 1.1 x 0.7 (inferred) | Low: model unidentified |
| `reeltable` | Table with stacked reels, a reel rack and a desk clock | MSC photo | 1.6 x 0.75 x 0.8 (inferred) | Fair |
| `desk` | White slab on chrome T-legs | Brochure p. 7 | 1.5 x 0.73 x 0.75 (ours) | Fair |
| `chair` | Chrome swivel chair on casters | Brochure p. 7 | 0.6 x 0.88 x 0.6 (ours) | Fair |

## What moves

- **Tape units.** The reels turn at tape speed over their pack radius, so the emptier reel turns faster. The packs
  trade radius as the tape moves, from 2400 ft of tape 1.5 mil thick (the thickness is inferred), at 12 times the real
  rate so that a burst shows. An idle unit makes a short shuttle now and then. When the engine runs (`tape`), about two
  units in three run bursts of reads, sometimes ending in a rewind. The meanings of the lamps on the top strip are
  ours.
- **CPU lamp panel.** 36 lamps a row in octal groups of three, one row per 36-bit word. The top row counts the kernel
  frames drawn, the second shows the g.e.t. in seconds, and the rest are random words (ours). The lamps change about
  20 times a second while the page plays and slowly when it is idle.
- **1558.** The plot screen, unlit and outside tone mapping. The 35 function keys glow as if backlit and carry
  printed legends; the backlight is HYPOTHETICAL (UP-7789 p. 16 describes plastic overlays, not lamps). The
  power-lamp colour is ours.
- **UNISCOPE 100.** 64 x 16 green characters in the IBM 3270 face when the page has it. The screen shows the Source
  tab's marked line or current unit, or VFRAME from `vdrive.f` in the embedded listing, and is redrawn only when that
  text changes. The cursor blinks.
- **4009 console.** The Day Clock shows hours, minutes and hundredths of a minute (UP-7604 sec. 2.3.3). It runs on
  the replay's UTC: Apollo 11's range zero, 1969-07-16 13:32:00 UTC, plus the g.e.t. In scene 9 the clock is offset
  by hdr(16), -17,887,260 s, to Apollo 8's epoch. At the touchdown g.e.t. 102:45:40 it reads 20:17:66, that is
  20:17:40 UTC. Its neon-orange digits are HYPOTHETICAL. The CRT's operator messages and the PAGEWRITER's log are
  ours.
- **Printer.** A finished beam frame advances the paper four lines, at most twice a second, and a lamp blinks. The
  stack grows by one sheet every 11 in.
- **Desk clock.** It shows Houston time for the replay's moment: Central time, with daylight time from the last Sunday
  in April to the last Sunday in October (Uniform Time Act of 1966).

Not modelled: drums (FH-432/1782, FASTRAND; we cannot identify them in the MSC photo; they are heard, see Sound), a
keypunch, and the microfilm recorder (no source names MSC's).

## Sound

The room has its own soundscape (`web/lab/src/audio/`), synthesized with WebAudio: oscillators, noise made in code,
filters, a panner per source and one convolver with a made-up response for the room (0.45 s, ours). No source says
what MSC's machine room sounded like. The aim is a room that was "not quiet but tolerable", with the air handling
and the fans as a steady bed and the machines heard when you are near them. It plays only with Sound on, through
the page's master gain, so the Sound button and M mute it everywhere (a 15 ms fade, then the context suspends). While
the room runs it replaces the page's ambience bed (`web/src/sound.js`); Tiled plays that bed. With a terminal's page
shown the room ducks 8 dB and its tape units keep turning, so an engine run is still heard.

| Source | Where | What it is | Sourced | Ours |
|---|---|---|---|---|
| Air handling | 3 ceiling diffusers, 2 perforated floor tiles | pink noise low-passed to a rumble (most of it under 120 Hz) and band-passed to a hiss (450 to 1000 Hz); slow drift | the raised floor and dropped ceiling (MSC photo) | everything else |
| Cabinet fans | each 1108 cabinet, the 1557 and the film recorder | a blade-pass tone over band-limited noise, and a faint mains hum (60 Hz and harmonics, 120 Hz strongest) | US mains, 60 Hz | 3,420 to 3,480 rev/min, 5 blades (285 to 290 Hz, so neighbours beat); levels |
| FH-432 drums | behind the west wall | three drums at 120 Hz and harmonics, windage from the flying heads | 7,200 rev/min (UP-4046 p. 8-5); three FH-432 (or one FH-1782, 1,800 rev/min, p. 8-6) in the minimum system (p. 5-3) | that MSC had these, their place, the slight detune, the windage |
| FASTRAND II | behind the west wall | a rumble modulated at 14.7 Hz, low harmonics, head seeks (a knock and a click) | 880 rev/min (p. 8-10); 64 heads moved together in 30 to 86 ms (p. 8-8); one FASTRAND in the minimum system (p. 5-3) | the sound of a seek; seeks every 4 to 15 s, and a burst on each engine run |
| Tape units | each UNISERVO | at rest a faint vacuum blower; moving, two reel-motor whines pitched at the reels' speed, the vacuum columns' air and the tape's hiss; a knock at start and stop | speeds (UP-4046 sec. 8.4.2); the reels' motion from the unit's model | 24 commutator bars (so the whine is 90 to 200 Hz reading, twice that on rewind); levels |
| Deflection whine | the 1558's screen | the beam's path for one refresh, sampled at the audio rate: its velocity in x and y (what a yoke's voltage follows) and the blank and unblank edges, looped at the refresh (1/16 s; 1/60 s at half level on STEADY), high-passed at 150 Hz, a 6 dB peak at 3 kHz, low-passed at 4.5 kHz, soft-clipped; rebuilt from each kernel frame (at most 16 a second; 0.1 to 2.2 ms each in the headless check, scenes 4, 1, 6) and crossfaded in 30 ms | | all of it. Designers potted and varnished deflection magnetics to keep them quiet, so it is residual leakage, deliberately faint: about 36 dB under the bed at the overview, rolloff 4 (10 dB down at 1.5 m), no room response. Room only; at the 1558 on SCOPE outside Beam, at the film recorder (its own CRT) while it runs; Tiled has none |
| Film recorder | `filmrecorder` (when the room places one) | idle: its cabinet fan only. Running (the Print tab, or Beam): a film-transport motor (30 Hz and harmonics, a 12-tooth gear at 360 Hz, a little flutter) that spins up and down over about a second, its own plot-tape transport whining for a block read before each frame, and per frame a shutter tick, three claw clicks and a stop thunk, timings varied a little; the CRT whine above. Frames come from Beam's frames, or on the Print tab one every 1.2 to 1.8 s; at most one every 0.35 s | | all of it: no source names MSC's recorder or describes its sound |
| Ballasts | each troffer row | 120 Hz hum with harmonics; a strike ticks, flickers and buzzes | | the model (magnetic ballasts hum at twice the mains frequency); it follows the room's light switch (`room.lightsOn`, on when absent) |

The panners use the inverse distance law (1 m reference; rolloff 1 for the machines, 0.5 to 0.8 for the air, the
drums and the ballasts). The drums are low-passed (1.1 to 1.4 kHz) as heard through the wall. At the overview the
mix is about -29 dBFS RMS (peaks -13 dBFS) with this spread (share of the power by octave band, dB): 20-63 Hz -7.5,
63-125 -4.3, 125-250 -10.7, 250-500 -15.6, 500-1k -15.7, 1-2k -16.4, 2-4k -20.5, 4-8k -26.3, 8-16k -34.8. Standing at a
tape unit raises its level about 10 dB over the overview, and its burst of reads lifts the mix there about 3 dB. The
printer's sounds come from `web/src/sound.js`.
