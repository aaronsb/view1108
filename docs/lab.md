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

Not modelled: drums (FH-432/1782, FASTRAND; we cannot identify them in the MSC photo), a keypunch, and the microfilm
recorder (no source names MSC's).
