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
| UP-7619 | UNISCOPE 300 Visual Communication Terminal, General Description (1968): <https://fourmilab.ch/documents/univac/manuals/pdf/Uniscope/UP-7619_Uniscope_300_General_Description_1968.pdf> |
| Console photo | A UNIVAC machine room with the 1108 Display Console in the foreground; file name "UnivacII.jpg", provenance unknown, held locally as a reference only |
| UNISCOPE photo | "Sperry-rand-univac-uniscope-100-0a.jpg", Adamantios, 2008, CC BY-SA 3.0 (<https://creativecommons.org/licenses/by-sa/3.0>): <https://commons.wikimedia.org/wiki/File:Sperry-rand-univac-uniscope-100-0a.jpg> |
| UP-7789 | UNIVAC Advanced Graphic System Type 1557/1558, General Description (1970): <https://fourmilab.ch/documents/univac/manuals/pdf/Peripherals/UP-7789_Advanced_Graphic_System_Type_1557_1558_General_Description_1970.pdf> |
| Brochure | UNIVAC 1108 II brochure, Computer History Museum 102646105: <https://www.computerhistory.org/brochures/doc-4372956ec8276/> |
| MSC photo | "UNIVAC 1108 at NASA Manned Spacecraft Center", Sperry Rand, 15 July 1969: `docs/media/UNIVAC1108-NASA.png` |
| 4020 brochure | S-C 4020 Computer Recorder, Stromberg-Carlson, Apr 1965: <https://bitsavers.org/pdf/strombergDatagraphix/brochures/S-C_4020_Computer_Recorder_Brochure_Apr1965.pdf> |
| 4020 manual | S-C 4020 Computer Recorder Information Manual, Aug 1964: <https://bitsavers.org/pdf/strombergDatagraphix/SC_4020/S-C_4020_Computer_Recorder_Information_Manual_Aug1964.pdf> |
| 4060 description | S-C 4060 Stored Program Recording System, Description and Specifications 9500209, rev. Apr 1967: <https://bitsavers.org/pdf/strombergDatagraphix/SC_4060/9500209_S-C_4060_Stored_Program_Recording_System_Description_Apr1967.pdf> |
| IN 66-FM-79 | W. R. Pruett, MSC Internal Note 66-FM-79, Aug 1966 (NTRS 19700025047): <https://ntrs.nasa.gov/citations/19700025047> |
| HEPCAT | TRW Systems for MSC, Users Manual for Computer Program HEPCAT, June 1970 (NTRS 19700027062): <https://ntrs.nasa.gov/citations/19700027062> |

The UNIVAC manuals (© Sperry Rand), the 4020 manual and brochure (© Stromberg-Carlson), IN 66-FM-79 and HEPCAT are
hosted in the reference library, `web/library/`, whose README gives their rights and sources; the bookcase below holds
them. The 1108 II brochure, the 4060 description and the UNISCOPE photo are not kept in the repository.

Palette, read off the brochure's colour plates (approximate): cabinets `#c9ccc8`, the CPU row's warmer grey
`#cfcbc0`, panels charcoal `#3a3f44`, accent orange `#c8642a`, desk tops `#eeeeea`. The lamps are warm white and
amber. The materials are painted steel with a faint drifting roughness, laminate, chrome, smoked acrylic, rubber,
and unlit lamps and screens (`web/lab/src/equipment/kit.ts`). All textures are procedural.

## The pieces

Sizes are W x H x D in metres.

| Registry name | What it is | Source | Size | Confidence |
|---|---|---|---|---|
| `vector` | UNIVAC 1558 Graphic Display Console, showing the plot | UP-7789 Fig. 1-1 (p. 1), Fig. 2-5 (p. 11), Fig. 2-7 (p. 14), light pen p. 15, function keys p. 16, size p. 27 | 0.9 x 1.5 x 1.25 (35 x 60 x 50 in, read as W x H x D: inferred) | Shape good (below). Its use at MSC is not documented; we chose it as the 1108's own vector display |
| `glass` | UNISCOPE 100 Display Terminal, showing the kernel source | UP-7701 Fig. 1-1 and p. 1 (10 x 5 in viewing area, 16 x 64 or 12 x 80, green on dark), size p. 30; UNISCOPE photo (below) | 0.46 x 0.33 x 0.69 | Good. Delivered from 1970, a year after the film (an anachronism we keep for Source) |
| `uniservo` | UNISERVO VIII-C tape unit | UP-4046 sec. 8.4.2 (120 in/s, 240 in/s rewind, 2400 ft reels); brochure p. 7; MSC photo (numbers 60, 61, ...) | 0.75 x 1.8 x 0.75 (inferred) | Good on look; vacuum columns not shown |
| `cpu` | 1108 cabinet; `{lampPanel: true}` is the processor's maintenance panel | Brochure p. 3 (colour) | 0.8 x 1.9 x 0.8 (inferred) | Good on look; the lamp count is ours |
| `console4009` | 1108 Display Console, type 4009: indicator panel with Day Clock, display unit with CRT and keyboard, PAGEWRITER on a pedestal (below) | UP-7604 Figs. 2-1, 2-3, 2-4, 4-1, Tables 2-1, 2-3, secs. 2.1 to 2.3.4; UP-7619 App. A and cover; console photo; UP-4046 Fig. 1-1; brochure pp. 6, 7 | 2.8 x 1.25 x 0.95 (2.8 x 1.13 x 0.9 drawn; desk and panel sizes ours) | Fair: parts and display unit sourced, layout ours |
| `controller1557` | UNIVAC 1557 Display Controller | UP-7789 p. 27 (48 x 24 x 64 in, read as W x D x H) | 1.2 x 1.6 x 0.6 | Size sourced, look HYPOTHETICAL (no figure) |
| `printer` | High-speed printer, 132 columns, 1200 lines/min, fanfold greenbar paper | UP-4046 sec. 8.5 (model not stated); MSC photo | 1.4 x 1.2 x 0.8 (inferred) | Fair; the paper path and stacker are ours |
| `cardreader` | Card reader | MSC photo (foreground) | 1.0 x 1.1 x 0.7 (inferred) | Low: model unidentified |
| `reeltable` | Table with stacked reels, a reel rack and a desk clock | MSC photo | 1.6 x 0.75 x 0.8 (inferred) | Fair |
| `desk` | White slab on chrome T-legs | Brochure p. 7 | 1.5 x 0.73 x 0.75 (ours) | Fair |
| `chair` | Chrome swivel chair on casters | Brochure p. 7 | 0.6 x 0.88 x 0.6 (ours) | Fair |
| `bookcase` | Steel bookcase with one ring binder per document of the reference library, upright between L-shaped bookends, then a telephone directory, two paperbacks and an index card, for looks; the lower shelf holds three unlabelled binders lying flat | none: ours | 1.0 x 1.1 x 0.36 (ours) | HYPOTHETICAL throughout (below) |
| `filmrecorder` | S-C 4020 Computer Recorder: the microfilm recorder, HYPOTHETICAL as to MSC's model (below) | 4020 brochure pp. 1, 4; 4020 manual Fig. 1 (p. 1), Fig. 5 (p. 7), p. 25 | 2.24 x 1.88 x 0.94 (basic unit 66 x 37 x 74 in plus the 22 in tape adapter, brochure p. 4) | Fair on look; the model at MSC is our choice |

**The 1558's shape.** UP-7789's photographs, scaled by the 35 in width: Figure 2-5 (p. 11, square on) gives the face's
outline (a hexagon chamfered at the top corners), the centred bezel and tube, the light pen and its cord at the upper
right, and the shelf; Figure 2-7 (p. 14) gives the keyboard's groups key by key (6 function keys and the cursor keys at
the left, the typewriter block, TRANSMIT and RETURN, the 35 function keys in columns of 2, 3 and 2, two square buttons,
three knobs and a lamp on the strip behind); Figure 1-1 (p. 1, three-quarter view) gives the hood sweeping back with
a sloped top, its sides curving under the shelf, and the pedestal set back with three light panels a side. The depth
split between head, shelf and pedestal, and the function-key legends the figure does not show legibly, are ours. The
keys are plain, with printed legends and no backlight; every typewriter, cursor and control legend is read off
Figure 2-9 (p. 15, that part of the keyboard close up), shifted characters above unshifted ones: the slashed Ø in the
letter row and the plain 0 in the digit row, SOM ▽, the stacked ERASE TO END OF DISPL and the like, the arrow on the
space bar. The shift key at the left of the Z row and the three dark keys beside TRANSMIT carry none. Three glyphs
are our closest reading: □ over >, △ over @, and the ≠ under \. Drawn in a plain sans (Helvetica or Arial), as on
the UNISCOPE 100, from one atlas shared with it (`kit.ts` keyLegends): one more draw call.

## What moves

- **Tape units.** The reels turn at tape speed over their pack radius, so the emptier reel turns faster. The packs
  trade radius as the tape moves, from 2400 ft of tape 1.5 mil thick (the thickness is inferred), at 12 times the real
  rate so that a burst shows. An idle unit makes a short shuttle now and then. When the engine runs (`tape`), about two
  units in three run bursts of reads, sometimes ending in a rewind. The meanings of the lamps on the top strip are
  ours.
- **CPU lamp panel.** 36 lamps a row in octal groups of three, one row per 36-bit word. The top row counts the kernel
  frames drawn, the second shows the g.e.t. in seconds, and the rest are random words (ours). The lamps change about
  20 times a second while the page plays and slowly when it is idle.
- **1558.** The plot screen, unlit and outside tone mapping, under a faint glossy dome that only adds reflections.
  The power-lamp colour is ours.
- **UNISCOPE 100.** 64 x 16 green characters in the IBM 3270 face when the page has it. The screen shows the Source
  tab's marked line or current unit, or VFRAME from `vdrive.f` in the embedded listing, and is redrawn only when that
  text changes. The cursor blinks.
- **4009 console.** The Day Clock shows hours, minutes and hundredths of a minute (UP-7604 sec. 2.3.3), written
  HH:MM.hh as in UP-4046 Fig. 1-1. It runs on the replay's UTC: Apollo 11's range zero, 1969-07-16 13:32:00 UTC, plus
  the g.e.t. In scene 9 the clock is offset by hdr(16), -17,887,260 s, to Apollo 8's epoch. At the touchdown g.e.t.
  102:45:40 it reads 20:17.66, that is 20:17:40 UTC. Its orange digits are HYPOTHETICAL. The CRT shows a console log
  (ours): the run's tape assignments and mounts and its two `@XQT` steps in the style of the sample run in
  `docs/batch-pipeline.md`, a line per 16 frames, the run's state, and a blinking prompt; the PAGEWRITER's sheet
  carries the same log, as UP-7604 sec. 2.3.2 says it logs the CRT's traffic. The lamps follow Fig. 4-1's sections:
  the Program Address Counter changes about 14 times a second while the page plays or after a `tape` event and once
  a second otherwise, GUARD mode is lit, and SELECT STOPS 0 and RELEASE STOPS 0 light on hold. UP-7604 says the
  address counter's indicators are disabled while a program runs, so a running counter is ours.
- **Printer.** A finished beam frame advances the paper four lines, at most twice a second, and a lamp blinks. The
  stack grows by one sheet every 11 in.
- **Desk clock.** It shows Houston time for the replay's moment: Central time, with daylight time from the last Sunday
  in April to the last Sunday in October (Uniform Time Act of 1966).

- **Microfilm recorder.** A finished beam frame exposes a frame: the shutter lamp and a lamp at the camera's lens flash,
  the advance lamp lights for the pull-down (about 100 ms, 4060 description p. 20) and the frame counter steps on.
  The viewing port shows the plot, dimmed. The other lamps hold steady.

## The 4009 console

The console is the UNIVAC 1108 Display Console, type 4009 (4009-99 at 60 Hz, UP-7604 Table 2-3), not a UNISCOPE 100:
its parts, from UP-7604 sec. 2.1, are a four-bank keyboard, a CRT of 16 lines of 64 characters in a 10 x 5 in viewing
area (Table 2-1), a PAGEWRITER printing 80-character lines at 25 characters a second on a pedestal cabinet (sec.
2.3.2), a Day Clock and the Operator's Control and Indicator Panel (sec. 2.3.4). The CRT format is the UNISCOPE 100's
too (UP-7701 p. 1), and it is the UNISCOPE 300's: UP-7619, dated 1968 and so before the Apollo views of 1968-69, gives a 10 x 5 in screen,
64 characters by 16 lines and a .150 x .113 in character (sec. 3, p. 3-1; App. A), the same character size as UP-7604
Table 2-1.

What comes from where:

- **Layout** (UP-7604 Fig. 2-1): a long desk top, the indicator panel standing at the back of its left part, the display
  unit in a notch at the right with its keyboard shelf proud of the desk's front, a short wing beyond. The console photo
  shows the same desk from the front left, with the display unit set further back; we follow the figure.
- **Desk**: white top and the orange band under its front (brochure p. 7); dark legs, a slab at the left end and T-legs
  on long feet at the main top's right end and the wing's (console photo). The modesty panel, the cradle under the
  display unit and the sizes are ours.
- **Indicator panel**: light grey housing, dark face, UNIVAC 1108 on a header strip, three rows of switch-indicators
  over the Day Clock and a row of system switches (Fig. 2-1, console photo); the sections, their counts and names from
  Fig. 4-1 and pp. 4-2 to 4-4. Its 8 degree lean and size are ours.
- **Display unit**: the shape of Fig. 2-3 (a deep light shell with its top falling to the back, a face leaning back,
  a recessed keyboard deck in a light rim with a lip) and the size of the UNISCOPE 300, 25 x 17 x 24 in (UP-7619 App.
  A). From the UNISCOPE 300 cover: the housing narrowing toward its top, the dark face, the screen at the left, the
  slatted grille at the right, the small UNIVAC plate under the screen and the brushed strip across the top. That the
  4009's display unit is a UNISCOPE 300 is our reading of the console photo and the shared screen; Fig. 2-1 shows a
  light strip at the top of the face too small to read, and lettering it "U N I S C O P E  3 0 0" follows that
  reading (HYPOTHETICAL). The keyboard is the 4009's, not the 300's: four banks of 47 keys and the space bar, a row of
  8 interrupt keys and 2 function keys (UP-7604 sec. 2.3.1; the text's "7 keys" is read as 47, which with the space
  bar gives four banks of about 12), with a red key and two lamps at the deck's back left (Fig. 2-1).
- **PAGEWRITER** (Fig. 2-4): a low wedge with the platen under its top and a control strip on its sloping front, on a
  light grey pedestal with a white top. The pedestal's place at the desk's left end is ours.
- **Back** (seen from the overview; no source shows it): the modesty panel with a cable cut-out at its foot and the
  cables dropping through the floor, louvres on the panel housing, the display unit and the pedestal, a UNIVAC 4009
  badge on the panel housing and a type plate "1108 DISPLAY CONSOLE TYPE 4009-99" on the modesty panel. All ours.

## The UNISCOPE 100

The model follows the UNISCOPE photo, a front-left view of a surviving terminal; UP-7701 gives the size, the viewing
area and the hood's top falling toward the back (Fig. 1-1). Read off the photo: a charcoal face over a cream keyboard
base that projects well forward, dark sides, a thin light trim along the hood's top edge; the screen at the face's left
in a dark recess, and to its right a panel lettered "Uniscope 100" in blue script; under them a brushed-aluminium strip
with a dark UNIVAC label, the red Sperry Rand mark and a dark window, rising at the right behind three push buttons
headed WAIT, INTENSITY and POWER. The face's layout is measured on the photo in pixels and scaled to the face.

The keyboard is counted from the photo: an edit cluster of six wide keys (ERASE TO END OF DISPL, ERASE TO END OF LINE,
IN DISPL DELETE IN LINE, IN DISPL INSERT IN LINE, CURSOR TO HOME, CYCLE) over four cursor arrows; a main block topped by
SOE, TAB SET, F1 to F4, PRINT, MESSAGE WAITING and a red TRANSMIT key, with CHAR ERASE, a back arrow, SHIFT LOCK, two
SHIFTs, a dark RETURN, a forward arrow and a long space bar around the typewriter rows; and a cream keypad of +, -, the
digits and TAB. Caps are cream on dark grey skirts (the keypad's skirts cream). Where the photo's legends are not legible
(the keypad's lowest row, a few punctuation keys) they are our guesses.

Ours: the depths, the face's 8 degree lean, the screen glass's slight dome, the key pitch (17.8 mm) and heights. The
POWER lamp lit amber is HYPOTHETICAL (the photographed terminal is off). The script is drawn in a system script face
where one is installed ("Snell Roundhand", "Brush Script MT", "URW Chancery L"), else the browser's cursive or italic;
no font is bundled for it.

## The microfilm recorder

TN D-6853 (printed p. 3) says VIEW's frames were "produced by a camera that photographs an image constructed on the
surface of a cathode-ray tube" and names no recorder. We chose the Stromberg-Carlson S-C 4020 because MSC had one:
IN 66-FM-79 (printed p. 2) says its figures "were plotted by an SC 4020 microfilm plotter" from IBM 7094 plot tapes,
and HEPCAT (printed pp. 40, 45), a program TRW wrote for MSC in 1970 that runs "on the UNIVAC 1108 using the EXEC II
system", writes "4020 plots" and microfilm tapes. The 4020 had a UNIVAC 1107 software package (4020 manual p. 26) and a
tape adapter for UNIVAC tape units (F-53-5, p. 25). That HEPCAT's 1108 was MSC's own is our reading, and no source we
found ties VIEW to the 4020. The 4020's successor, the S-C 4060 (1967), is the other candidate; we found no tie of it, of
the Information International FR-80 or of other recorders to MSC. Confidence that the frames came from a 4020:
moderate.

Sourced: the row of tall flat-doored cabinets with split doors and recessed handles, two small lamp panels at eye
height, the badge (4020 brochure p. 1 photograph); the sizes; the CHARACTRON tube standing upright with the 35 mm
camera and its supply and take-up magazines above it (4020 manual Fig. 5). HYPOTHETICAL: the window onto the camera,
the viewing port, the frame counter, the panel layouts and lamp meanings, the colours.

Not modelled: drums (FH-432/1782, FASTRAND; we cannot identify them in the MSC photo; they are heard, see Sound), a
keypunch, and the 4020's tape transport and hard-copy camera.

## The reference library

No source shows where MSC kept its manuals; the bookcase, its place (against the east wall behind the UNISCOPE's
desk, its front 0.9 m clear) and everything on it are ours. Each binder's thickness follows its PDF's page count (1 in
rings for the thinnest up to 2 1/2 in for 330 pages), its spine card gives the number and a short title in the
nameplate face, and the colours are ours too: grey and blue vinyl for the UNIVAC manuals, black and oxblood for the
Stromberg-Carlson ones, buff for the NASA reports. The bookends are olive enamel. A binder is picked on its own (its
title on hover). At the bookcase's close-up a click pulls a binder 9 cm out of the row, its top tipped toward you, and
puts back the one that was out; a second click on it opens it, and stepping back puts it back. A binder asked for from
across the room comes out while the camera flies to its spine.

After the binders, for looks only (named on hover; they pull out like the binders but open nothing; the card comes up
off the back panel and turns to face you), stand things someone left there while waiting
for a batch run (the idea and the choice of things are ours):

- A Houston telephone directory for 1969, 6.5 cm thick. Southwestern Bell Telephone Company was the Bell System's
  company for Texas from 1917 (Wikipedia, "Southwestern Bell", <https://en.wikipedia.org/wiki/Southwestern_Bell>);
  that it published Houston's directory in 1969 is our assumption, as we found no catalogue record or image of that
  book. Its spine (HOUSTON, TELEPHONE DIRECTORY, 1969, SOUTHWESTERN BELL, and a plain bell outline that copies no
  logo) is ours.
- Two mass-market paperbacks in print by then: Arthur C. Clarke, *2001: A Space Odyssey* (Signet, New York, 1968, 221
  pp.; Open Library OL26627441M, <https://openlibrary.org/books/OL26627441M>), and Robert A. Heinlein, *The Moon Is a
  Harsh Mistress* (Berkley Medallion, September 1968, 302 pp.; Open Library OL26835764M,
  <https://openlibrary.org/books/OL26835764M>). Their spine colours and lettering are ours.
- A 6 x 4 in ruled index card in blue ballpoint, leaning on the back panel: places to eat. The list is the user's, from
  their own notes. The U-Joint is checked: "Fort Terry's The Universal Joint" in Webster, a barbecue place in a
  wartime Ellington barracks moved there in 1965, sold in 1980 and reopened as the Outpost Tavern (collectSPACE,
  9 Dec 2009, <https://www.collectspace.com/news/news-120209a.html>). The Singing Wheel (Webster), the Flintlock and
  the Monterrey House are unverified: we found no source for them in 1969. The handwriting is a system script font
  with each line nudged and turned a little.

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
| Footsteps | the viewer, walking (Room) | a step every 0.77 m walked (0.55 s at walking speed, quicker with Shift), feet alternating a little left and right: a heel tap (noise band-passed at 700 to 950 Hz) with a faint hollow knock (260 to 180 Hz, a tile on pedestals), then a softer toe tap; level and pitch varied per step, well under the bed; none when a wall or machine stops you, none in flights | | all of it |
| Ballasts | each troffer row | 120 Hz hum with harmonics; a strike ticks, flickers and buzzes | | the model (magnetic ballasts hum at twice the mains frequency); it follows the room's light switch (`room.lightsOn`) |

The panners use the inverse distance law (1 m reference; rolloff 1 for the machines, 0.5 to 0.8 for the air, the
drums and the ballasts). The drums are low-passed (1.1 to 1.4 kHz) as heard through the wall. At the overview the
mix is about -29 dBFS RMS (peaks -13 dBFS) with this spread (share of the power by octave band, dB): 20-63 Hz -7.5,
63-125 -4.3, 125-250 -10.7, 250-500 -15.6, 500-1k -15.7, 1-2k -16.4, 2-4k -20.5, 4-8k -26.3, 8-16k -34.8. Standing at a
tape unit raises its level about 10 dB over the overview, and its burst of reads lifts the mix there about 3 dB. The
printer's sounds come from `web/src/sound.js`: printing the listing (a fresh copy, `web/src/printout.js`) plays a hammer
burst and a ratchet per line, a thunk and a paper rush per form feed and the drum motor's hum, ours, adapted from
progression's teletype (`src/eras/teletype/sound.ts`, MIT, same author).
