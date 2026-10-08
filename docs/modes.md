# Modes, scenes and controls

Every example below is a live link to the page. Links set the view for that visit only; they never overwrite the settings you have chosen yourself.

Base URL: https://aaronsb.github.io/view1108/

## Tabs

The tab bar across the top, after the title, picks the workspace and the control groups in the dock (below the plot on a narrow screen, beside it on a screen 1000 px wide or more; on a screen 600 px wide or less Simulate's Mission clock, then the Look pad, come first under the plot). The status line under the plot gives the mission, mode, g.e.t., Beam's frame, the rate and the UTC, then the display (the film effects that are on, or the scope's refresh; the film rate; the star catalog), which a message such as COPIED replaces for a moment. It keeps a fixed height, two lines on a wide screen, three on a narrow one and four at 400 px or less, and is cut with an ellipsis at its end where it runs out of room, which only the display reaches; hovering it shows the whole line. Link, at the right end of the bar, copies a link to the current view. Sound, beside it (key `M`), plays a synthesized machine room of our own invention: air handling and a cooling fan, a frame-advance clunk per Beam frame, a tape whir when the engine runs, and key clicks. It is off by default and remembered.

Choosing a tab, here or by walking up to a terminal in the Room, changes only what is shown: the mode, the scene and the time stay as they were (docs/systems-model.md, section 4, rule 2). Each tab's own controls change them; the last column says which.

| Tab | Workspace | Dock | Controls that change the mode |
|---|---|---|---|
| **Review** | the plot | Mode (Attract, Tour, Free-look), Reels, Time, Timeline, Look, Display | the Mode group's Attract, Tour and Free-look. The page opens here, in Attract |
| **Simulate** | the plot | Mission clock (Live, Free-look, the jumps), Simulation, Reels, Time, Timeline, Look, Display | the Mission clock's Live (or a jump button) starts Live; its Free-look stops it |
| **Print** | the plot | Beam (the trace and its speed), Film (with its Prints, the frame as an SVG file of the kernel's vectors, with no film effects: NEGATIVE, white lines on black as they went onto the film; POSITIVE, true black lines on white, for a printer; CLEAR, the positive on a transparent background; named `<reel>-s<id>-<situation>-<h-mm-ss>-negative.svg`, `-positive.svg`, `-positive-clear.svg`; #82, ours), Reels, Time, Timeline, Look, Display | Beam trace (or `T`) starts and stops Beam; film effects default on |
| **Fusion** | the plot, with a crew photograph over it | Fusion (the photographs, the overlay and its alignment), Look, Display | picking a photograph opens its scene in Free-look (from Attract, Tour or Beam too), on the mounted tape |
| **Source** | its own: the kernel's code browser (below) | none | none; the plot stops drawing and time holds until you return. The plot's keys do nothing here |

Attract and Tour keep playing on every tab until you take control (any drag, wheel, key or time control, as in Review); Live keeps its clock and Beam keeps tracing on every plot tab until you stop them where they started.

**Reels** is one button, **Return to reels** (#73; ours): it leaves the simulation for the tape shelf. In the Room it brings the room back and flies to the tape rack's close-up, where a reel is pulled and loaded from its modal; in Tabbed it opens the reel list, a modal with one button per reel (the mounted one marked), each reel that carries a notebook followed by Read the notebook, and Back to the simulation (or Esc). Picking a reel mounts it as a fresh run (its first situation at its defaults, Free-look, the clock stopped), as the rack does. There are no scene buttons: the situations are entries of the event list below. A mission notebook (the library; in the Room, a binder on the bookcase) opens with its run sheet, the same listing typed as a sheet, at first only the situations and milestones (SHOW ALL ENTRIES shows the rest): picking an entry there loads its reel as a fresh run and goes to that entry, closing the viewer onto the plot (in the Room, the workbench's page, Esc back to the room).

**Timeline** (Review, Simulate, Print) is the loaded reel's event list (#73, #29 slice f): its event listing, which `tools/pack.py` generates from the reel's situations and its TIMELINE cards (SP-4029's mission timelines) and packs in its `page.json`. Each row is a g.e.t., a kind and a name. The reel's situations are marked entries (kind SITUATION, a ▸ before the name, and the quick-view key boxed where one is mapped); picking one applies its view, as a scene button did: its situation at its defaults, its own view and target, Free-look (or a Live pin where Live pins it). The other rows are the timeline's events, filtered by kind or by Noteworthy, our own short list of milestones (lift-off, Earth orbit insertion, TLI, transposition docking, LOI, undocking, powered descent, landing, lunar lift-off, docking, TEI, entry, splashdown). The situations show under every filter. Clicking an event sets the time as the g.e.t. box does and re-centres the Free-look scrubber on it; where the current scene's camera does not suit that moment, the page switches to one that does: each scenario's time is cut into spans (our own: the FOLLOW `SPAN` cards in the scenario's deck, which carry their sources; generated into `build/names.js`), each naming a scene and, where it needs them, a view, target and field of view. For Apollo 11, the docked span after transposition (3:24:03.1 to 4:17:03) is scene 7 from outside, aimed at the LM. For Apollo 8, scene 9 is the Earthrise camera only in lunar orbit; before the Earth parking orbit and after entry interface it is the external view of the Earth, on the parking orbit the forward horizon view at 70°, and from TLI to about 3:27 (while the disc overfills a 50° field) the external view again, then on the translunar and transearth coasts the CSM window aimed at the Earth at 50°, the field of MSC IN 69-FM-197's transearth-coast Earth views (figure 7.3.2-1, printed p. 207). Away from lunar orbit those Apollo 8 spans carry their own caption (`CAPTION=` on the `SPAN` card: the Apollo 8 Mission Report's phase names, launch phase, Earth parking orbit, translunar injection and coast, lunar orbit insertion, transearth injection and coast, entry), so the plot is not captioned Earthrise at the entry; a span's caption applies wherever the scene shown is the span's, outside Live and the reels. **Follow** (any scenario with FOLLOW spans, Apollo 8 included) keeps doing so as the time runs, in Free-look: it switches to Free-look from another mode, reads **Following** while on, and stops at a click or when a scene, view, target or time is picked. The event at or before the current time is highlighted, and the shown events within the scrubber's span are marked under it. For Apollo 11 only (the companion site covers Apollo 11), **Companion** opens [Apollo in Real Time](https://apolloinrealtime.org/11/) (Ben Feist) at the current g.e.t. in a window of its own; each discrete jump (an event, a scene, a released scrub, a Live jump, the g.e.t. box) re-points it, and **Resync** does so on demand. It plays in real time on its own; its pause and rate are independent. Opening or resyncing it also starts Follow, at 1×. Each event's ↗ opens that moment in the same window.

**The code browser** (Source) has three panes: a tree (the files grouped by kind as in CLAUDE.md's element table, each file's units, under each unit an outline of its DO loops, block IFs, GO TOs, CALLs, RETURNs and labels; then the COMMON blocks and PARAMETERs, with a filter), the listing (fixed-form colouring, RESTOMOD fences as a shaded band with their reason on hover, a rule after column 72, folds on DO and IF, the open unit's lines lit), and an inspector (the unit's signature, doc comment, declarations, COMMON and PARAMETERs used, a callers-and-callees graph, calls, called-by and fences; or a COMMON block's, PARAMETER's or variable's card). In the listing a routine's name goes to its definition, a COMMON member or PARAMETER opens its card, a local or argument marks its uses in the unit, and a label after GO TO or DO goes to that label. On a narrow screen the tree is a drawer (Files) and the inspector follows the listing. Keys: `Ctrl+P` or `/` go to a unit, block, member, PARAMETER, file or `file:line` by fuzzy match; `Alt+Left` and `Alt+Right` go back and forward; `Esc` closes. The symbols and outline come from `tools/gen_symbols.py`. The toolbar's theme picker (ours, remembered per browser) switches PHOSPHOR, the page's green, to DARK, LIGHT or HIGH CONTRAST (in these three every code colour is 4.5:1 or better on its background), the font between 3270, an embedded JetBrains Mono (the default outside PHOSPHOR) and the system's monospace, and A− A+ step the listing's size.

**Fusion** lays a mission photograph over the plot at its moment. The list is the mounted tape's photographs (#75): each scenario reel carries its own photo events, packed from `data/photos.tsv`'s rows with a situation (the photograph a `media` member, 1024 px, its timing, lens and our fit in the reel's `page.json`; `docs/systems-model.md`, section 3, Photo events), so with Apollo 11 mounted only Apollo 11's frames are listed, and none of another mission's. A tape without photographs says so. Picking one stays on the tape; it opens its scene in the window view in Free-look, held at its g.e.t. (a bracket's midpoint, with a slider across the bracket), with the field of view of its lens on the 70 mm gate (55.74 mm, our measurement; our computation), and lays the photograph over the plot box: opacity, blend (normal, screen, difference), and its centre, rotation and scale in plot degrees and percent. **Move photo** moves it by drag, arrows, `Q`/`E` and `+`/`-` or the wheel (Shift: 10×) instead of the look; Esc ends it. Changes are remembered per photograph in this browser; **Reset alignment** goes back to our fit, **Copy alignment** copies the view and alignment as JSON for `data/photos.tsv`'s fit columns. **Unpin** hides the photograph while you look around, **Return** restores its view. AS08-14-2383, AS08-14-2384 and AS08-13-2329 come fitted by us (pointing and alignment from their Earth discs and horizons); each photograph's panel says what still misfits, and its credit and source. A photo event is also an entry of the reel's event list (kind PHOTO, marked like the situations) and of the notebook's run sheet, and may be a quick view; picking it there opens Fusion at it. A notebook's print of a photo event opens it in Fusion too.

## Room and Tiled

**Room** puts the workbench inside a 3D machine room (a modern addition, ours: three.js, built from `web/lab/`). Its layout is ours, after the MSC photograph of 15 July 1969 (white raised floor, troffer rows, tape drives in a row): tape drives along the back wall with a reel table in front of them, the 1108's cabinets on the left across open raised floor, the operator console in the middle, and on the right a UNIVAC 1558 graphic console (UP-7789, 1970; not known to have been at MSC) whose screen is the live plot, beside a UNISCOPE 100 on a desk; along the right-hand wall a microfilm recorder (an S-C 4020, our guess at MSC's) and the line printer, and behind you the door under its EXIT sign, with the light switch beside it. You stand near the front right corner. Click the room (anywhere but a machine) and the mouse looks around as in a first-person game: the pointer is captured, a small crosshair marks the centre, and the machine under it is the one you hover and click; Esc gives the pointer back. A line at the top left says what is mounted and whether it runs (DEMO while Attract or Tour plays, else the situation's title; RUNNING or STOPPED) and, until you first look, walk or click, how to take control. You turn all the way round and 35° up or down. Where the browser will not capture the pointer, and with touch or a pen, drag to turn instead. You walk with `W` `A` `S` `D` or the arrow keys (Shift walks faster), the wheel or a pinch to step forward or back; walls and machines stop you and you slide along them, and your footsteps are faint on the raised floor. While the room is shown these keys walk and the plot's keys wait (Esc, Tab, `M` and the browser's chords still pass); Esc, once you have moved and the pointer is free, flies back to the starting view. Hovering a terminal, with the pointer or the crosshair, lifts it and names it. Walk up to a terminal and face its screen: its name shows with "press E", and `E` or Enter flies the camera in as a click does. With WALK-UP turned on (its button at the bottom right; off by default, and remembered) the line says "approach or press E" and standing there a moment flies in too. The middle tape drive on the back wall holds the mounted reel: its paper label reads DEMO while the demo plays (Attract, then Tour), else the situation's title, and its RUN or STOP lamp is lit. Click it, or `E` in front of it, to stop the playback clock (the g.e.t. holds; the mode, the scene and the shot stay) and again to start it; the room starts with the demo running (#20). Beam paces its own clock, so in Beam the drive's lamps are dark, it does nothing, and the top line leaves it out. The light switch (click it, `E` in front of it, or `L` anywhere in the room) turns the fluorescent lights off and on: off, the room is lit only by the equipment's lamps and screens and the EXIT sign; on, the tubes strike one by one, flickering, a couple of them late. Your choice is remembered. The door's handle (click it, or `E` in front of it) is the way out: it opens the project's repository, github.com/aaronsb/view1108, in a new tab. Click the 1558 and the camera flies to it, ending with its screen and keyboard in view as its operator would see them, and stays there with the room live and a line at the bottom on how to go on: click the machine again, `E` or Enter, and the camera closes in until the screen covers the plot's place on the page and the room crossfades into the workbench on the last plot tab you used (Review the first time); Esc, `[ ROOM ]`, a walking key or a click off the machine steps back to stand in front of it. The UNISCOPE opens Source the same way, the microfilm recorder Print, and the line printer the kernel listing on greenbar (the page torn off on its hood becomes the listing's first sheet; Esc or its `[ ← ROOM ]` goes back to the printer, Close leaves you on the page). The steel bookcase on the back wall, beyond the UNISCOPE's desk east of the tape drives, holds a ring binder for each document of the Library (below): hover a binder for its title, click it (or the crosshair and `E`) and the camera flies to its spine as it slides out of the row; click again and the Library opens on that document. The bookcase itself, clicked or walked up to, flies to its close-up, where a click on a binder pulls it out and a second opens it; a click on the bookcase's frame or anywhere else steps back. Esc or its `[ ← ROOM ]` returns you to stand in front of the bookcase. A tab picked while the room is shown flies to its terminal first and opens it without the second click. `[ ROOM ]` in the tab bar, or Esc on a plot tab or in Source when Esc has nothing else to close (the listing, Fusion's Move photo; Source's quick-open, tooltip and Files drawer), fades the room back in over the page and flies out to stand about 2 m in front of that terminal, facing it; it takes you in again only once you have stepped away. On a terminal's page the button reads `[ ← ROOM ]`, unlit. While the room is shown the plot keeps running, kernel frames at 16 fps on every tab, Source included, so the 1558's screen is live; it is always a Scope (see Screen under Toggles). No tab is lit in the tab bar while the room shows. Esc is one stack (`web/src/esc.js`): it closes or steps back from the last thing opened, in this order: a fresh copy printing (finished at once), the library or the listing (opened from the bookcase or the printer: back to it; from Source: closed), a terminal's page (back to the room), a binder pulled out at the bookcase's close-up (back on the shelf), a terminal's close-up (step back), and last the room itself (back to the starting view). Source's quick-open, tooltip and Files drawer and Fusion's Move photo take Esc first.

The room renders at one of two qualities, shown and switched by the button at its lower right (the choice is remembered): HIGH (soft shadows, area lights from the troffers, ambient occlusion, a little bloom) and LOW (no shadows or post-processing). Without a choice the room starts HIGH and drops to LOW for the visit if its first frames take longer than 24 ms, or the next 2 s average over 22 ms; the button then reads LOW (auto: slow). A software renderer starts LOW.

**Tiled** is the plain page, unchanged: the lab is not started, so there is no WebGL context and no second frame loop. `[ TILED ]` beside `[ ROOM ]` picks it; the choice is remembered. Room is the default where it can run. The page is Tiled, with neither button, on a screen narrower than 1000 px, with `bare` or `still`, where WebGL fails, and in a page built without the lab (the build needs npm for it; see the README).

## Modes

Attract and Tour are playlist reels (#18): their shots are SHOT cards in `data/reels/demo/run.scn` and `data/reels/tour/run.scn`, each naming a situation, an absolute g.e.t. and its look, and one player (`web/src/player.js`) plays whichever is mounted. The deck's header gives the card format. Attract and Tour stay the page's names for the two reels (each REEL card's ALIAS), and `reel=demo` or `reel=tour` in a link mounts the same reel as `mode=attract` or `mode=tour`.

| Mode | What it does | Example |
|---|---|---|
| **Attract** | The demo reel (`data/reels/demo/run.scn`): replays the four shots of the surviving VIEW film at the film's pace (about 36 s): Earthrise, Earth approach, LM pirouette, LM descent. A fifth shot follows, 12 s orbiting the translunar stack from outside, captioned as a modern addition. Plays once on a fresh load, then mounts its NEXT reel, the tour. The Time group and the room's drive label the mounted reel with its TITLE: DEMO, then TOUR. | [?mode=attract](https://aaronsb.github.io/view1108/?mode=attract) |
| **Tour** | The tour reel (`data/reels/tour/run.scn`): a slow loop through every scene, a few minutes each, with a caption naming the shot and its g.e.t. It ends by orbiting the stack from outside, looking out of the CM's left rendezvous window, then the Apollo 8 Earthrise. Loops forever. | [?mode=tour](https://aaronsb.github.io/view1108/?mode=tour) |
| **Live** | The Apollo 11 mission clock at 1× (or 10×, 60×, 300×, 1000×). The scene follows the mission phase from the g.e.t.: Earth parking orbit until 2:50:00, translunar coast until 75:50:00, lunar orbit until 135:24:00, then transearth coast. The transposition and docking, the LM rendezvous and the descent are jump windows. Phases and jumps are the LIVE and JUMP `SPAN` cards of the Apollo 11 deck. | [Live at touchdown](https://aaronsb.github.io/view1108/?mode=live&get=102:45:40) |
| **Free-look** | Time paused or running at a chosen speed; look anywhere at the current moment. Any drag, wheel or key in Attract or Tour switches to Free-look and keeps the view. The room's drive is the exception: it stops and starts the demo without leaving it, and once the drive has stopped it, Pause (the button, Space, the pad's key) starts it again. | [A frozen Earthrise](https://aaronsb.github.io/view1108/?mode=free&scene=1&get=102:20:06&fov=8) |
| **Beam** | Started from the Print tab (Beam trace, or `T`). It keeps tracing on the other plot tabs, with that tab's film defaults; `T` there shows Print, and `T` again stops it. Traces each frame vector by vector, in the kernel's output order, on a phosphor that fades, with a beam spot on the pen. The mission clock advances one frame at a time, by however long the frame took to draw. | [Slow trace of the Earth](https://aaronsb.github.io/view1108/?mode=beam&scene=2&bspeed=3) |

### Beam speeds (`bspeed`)

| `bspeed` | Name | Rate | Example |
|---|---|---|---|
| 1 | 1108 + recorder (est.) | about 1.3 s of computing, then about 13,000 vectors/s | [bspeed=1](https://aaronsb.github.io/view1108/?mode=beam&scene=1&bspeed=1) |
| 2 | Recorder only (est.) | about 13,000 vectors/s | [bspeed=2](https://aaronsb.github.io/view1108/?mode=beam&scene=1&bspeed=2) |
| 3 | Slow trace | 1,000 vectors/s | [bspeed=3](https://aaronsb.github.io/view1108/?mode=beam&scene=5&bspeed=3) |
| 4 | Persistence | a whole frame in about 1/15 s | [bspeed=4](https://aaronsb.github.io/view1108/?mode=beam&scene=2&bspeed=4) |

Speeds 1 and 2 are our estimates, worked out in [univac-1108.md](univac-1108.md). No source gives the recorder's vector rate.

## Scenes

The number is the scene's place in the page's order, `scene=N` in a link (kept for old links, #22): Apollo 11's situations 1–8 (`scn=apollo11-asflown`, the same ids there), then Apollo 8's Earthrise (`scn=apollo8-asflown&sit=1`). In the page each is an entry of the event list (Timeline, above).

**Quick views** (#73; ours): keys 1–9 are shortcuts into the loaded reel's event list, and each does exactly what picking its entry does. Each reel maps its own, in `quickviews.txt` in its source folder (`data/missions/<mission>/<scenario file stem>/`, beside its notebook; one line per key, `<key> <entry id>`, the id a situation's NAME or an event's id: its name as a slug, with `@` and its g.e.t. where the name repeats, e.g. `midcourse-correction-ignition@26:44:58.64`; gaps allowed), packed as `page.json`'s `quickviews`; without the file the reel's first nine situations take keys 1–9. Apollo 11 keeps its eight situations on 1–8 and puts Translunar injection on 9; Apollo 8 has its Earthrise on 1. The hint line lists the loaded reel's keys.

| # | Scene | What you see | Example |
|---|---|---|---|
| 1 | Earthrise | The CSM in 60 n.mi. lunar orbit looking at the horizon; the Earth rises over the limb, night side hatched. | [scene=1](https://aaronsb.github.io/view1108/?mode=free&scene=1&get=102:20:06) |
| 2 | Transearth coast | The Earth among the stars on the way home (its card's NAME is EARTH APPROACH). Near entry interface (195:03:06) it grows to a limb arc. Live also shows it for the translunar coast. | [Earth approach](https://aaronsb.github.io/view1108/?mode=free&scene=2&get=190:00:00&fov=60) |
| 3 | Earth limb | The limb from the 100 n.mi. parking orbit. | [scene=3](https://aaronsb.github.io/view1108/?mode=free&scene=3&get=5400) |
| 4 | LM rendezvous | The LM wireframe turning in place after undocking, 300 ft from the CSM. | [scene=4](https://aaronsb.github.io/view1108/?mode=free&scene=4) |
| 5 | LM descent | The commander's front window with the LPD scale; the horizon rises as the LM pitches over. | [scene=5](https://aaronsb.github.io/view1108/?mode=free&scene=5&get=102:44:00) |
| 6 | Moon view | The whole Moon from 35,000 km; drag to spin it. Maria, craters, the terminator and the landing site. A modern addition, not reconstructed 1969 output. | [scene=6](https://aaronsb.github.io/view1108/?mode=free&scene=6) |
| 7 | Transposition & docking | Through the CSM's docking sight, down onto the LM stowed on the S-IVB, closing from 100 ft to docking at 3:24:03. Hidden-line LM and S-IVB. | [scene=7](https://aaronsb.github.io/view1108/?mode=free&scene=7) |
| 8 | Translunar stack | The CSM and LM docked, in translunar coast, seen from outside or from a crew station (View). A modern addition, not reconstructed 1969 output. | [scene=8](https://aaronsb.github.io/view1108/?mode=free&scene=8&view=external) |
| 9 | Apollo 8 Earthrise | The Earth rising over the lunar limb from Apollo 8's lunar orbit, 24 Dec 1968; the status line names APOLLO 8 and the UTC follows Apollo 8's lift-off. Built from Apollo 8 data in the Apollo 11 note's formats: VIEW did make Apollo 8 views: "Preflight views produced for the Apollo 8 mission included views as seen through the spacecraft windows during various critical maneuvers of the flight. These maneuvers were at TLI, LOI, transearth insertion (TEI), and the entry phase." (TN D-6853, printed p. 3; also p. 2, "the window view of the lunar horizon at the Apollo 8 LOI ignition time and attitude"). None survive that we know of. It is situation 1 of the Apollo 8 reel (`apollo8-asflown`); Live and the jump buttons follow the scenario with LIVE and JUMP `SPAN` cards (Apollo 11), so this scene opens in Free-look and hides the jumps. | [scn=apollo8-asflown](https://aaronsb.github.io/view1108/?mode=free&scn=apollo8-asflown) |

### Scene 7 sources and guesses

Sourced: separation at 3:17:04.6 and docking at 3:24:03.1 (Apollo 11 Mission Report MSC-00171, table 7-II, printed p. 7-9); "a maximum separation distance of at least 100 feet" and contact "at an estimated 0.1 ft/sec" (same report, printed p. 4-2); the S-IVB held "a fixed inertial attitude to provide a stable docking platform" (AS-506 launch vehicle flight evaluation report MPR-SAT-FE-69-9, printed p. 11-1), chosen so "the Sun will shine across the top of the LM" ([Apollo 11 Flight Journal](https://apollojournals.org/afj/ap11fj/03tde.html), commentary at 002:54:09); the SLA's upper panels were jettisoned at separation (same flight evaluation report, p. xxiii); the LM's landing gear stayed retracted until the crew manned the LM, the S-IVB and IU are 21.7 ft across, the SLA tapers from 260 in to 154 in over 28 ft, and the drogue sits in a 32 in tunnel ([Apollo 11 press kit](https://apollojournals.org/alsj/a11/A11_PressKit.pdf), printed pp. 88, 101, 103, 109). VIEW could draw "the vehicle outlines of the CSM, LM, and the S-IVB" and "hidden-line models of the LM and the S-IVB" (TN D-6853, printed p. 12).

Our guesses: the approach starting at 3:20:30 and its closing law; the attitude (stack axis square to the Sun, in the trajectory plane, frozen at 3:09:20); how the folded gear lay; the LM's height in the SLA; the 7 ft fixed SLA ring (from a secondary source); the COAS position, reticle and docking target. With this attitude the Earth is out of the 30° field; look around to find it.

Is the film's leg-less LM shot (film seconds 20.5 to 26) this view? We think not. From the CSM during the approach the LM is seen from above, down its docking axis, inside the S-IVB's 21.7 ft rim; the film shows the LM from the side, turning, with no S-IVB. What the film does share with this scene is the missing landing gear: the gear was extended once the crew manned the LM (press kit, printed p. 103), before the undocking at 100:12, so a gear-less LM is not what the crew saw then either. Our reading is that VIEW's LM hidden-line model simply had no legs.

## Toggles

| Toggle | Key | What it does | Default |
|---|---|---|---|
| Labels | button | Star, body and feature names, drawn by the recorder's character generator. With a kernel that has label levels, the button cycles OFF, PRIMARY, SECONDARY, ALL; crater names follow the level (none at PRIMARY, craters of 25 km and more at SECONDARY, all at ALL); otherwise it is on/off | on (ALL) |
| Frame | button | Plot frame, ticks and tick numbers | on in framed shots |
| LM hidden lines | button | Draws the LM's (and in scene 7 the S-IVB's) hidden edges dashed instead of dropping them | off |
| Catalog | C | NAV: the 391-star navigation catalog as asterisks (37 named). FULL: every catalog star to V 4.5 as dots. TN D-6853 p. 12 describes both. | NAV |
| Bloom | B | CRT/film glow: a hairline core with a gaussian halo | on in Attract, Tour and the Print tab |
| Screen | S (cycles) | FILM: the microfilm recorder, with bloom, jitter, dust, grain and the film rate below. SCOPE: the room's UNIVAC 1558 console, none of them (ours: the 1558's use at MSC is not documented). AUTO: the 1558's screen in the room is always a Scope; on the page, Scope when it was reached through the room (Room, not Tiled), except Attract (the film clip) and the Print tab, which stay Film; Film otherwise. While the screen is a Scope the film toggles are greyed out | AUTO |
| Refresh | H | The Scope's refresh. 16 HZ: the picture is redrawn as one beam pass every 1/16 s, in the kernel's drawing order, on a phosphor that fades between passes (to 81% before the beam returns: our persistence), with brighter dots where the beam stops and starts; drawn at the display's rate, so the sweep shows as a faint shimmer, as on a vector arcade monitor. STEADY: constant lines with a gentle glow, a modern vector look. Both ours: UP-7789 gives no refresh rate or phosphor. In the Room, with Sound on, the 1558 also leaks a faint deflection whine shaped by the picture (`web/src/whine.js`; ours, docs/lab.md Sound) | 16 HZ |
| Film jitter | J | Frame-to-frame registration wobble of the film | on in Attract, Tour and the Print tab |
| Dust | D | Specks and occasional scratches | on in Attract, Tour and the Print tab |
| Film rate | F | Presents frames at a steady 16 fps | on in Attract, Tour and the Print tab; off in Beam |
| Print listing | button (Source tab) | The FORTRAN as a period compile listing, dark terminal or LIGHT greenbar paper. In it, PRINT FRESH COPY clears the greenbar and prints the listing again a line at a time at the 1108 printer's 1,200 lines a minute (UP-4046 sec. 8.5; REAL) or ten times that (FAST), with the printer's sound when Sound is on (ours) and, in the room, the 3D printer's paper moving in step; a click, Esc or scroll skips to the end. DOWNLOAD PDF writes the listing as 14 7/8 x 11 in greenbar sheets (66 lines, 132 columns, Courier; the stock is our choice) | dark |
| Library | button (Source tab) | The reference library: the manuals and reports this reconstruction is built from (the UNIVAC manuals, the S-C 4020's manual and brochure, the NASA reports; `web/library/README.md` gives sources and rights), listed with year and publisher beside the browser's own PDF viewer, with OPEN IN NEW TAB and SOURCE (where the document came from). Esc or CLOSE closes it. On a screen narrower than 1000 px it is the list with each document's Open and Source links, since PDF viewers inside a page are unreliable on phones; opened from a file (`file://`), or where the PDFs are not beside the page, it points to the sources instead. After the documents come the reels' mission notebooks (#29), read in LIGHT, the default, as typed pages in an open three-ring binder on a desk, one page on a narrow screen and a two-page spread on a wide one, paged by BACK and NEXT, PgUp and PgDn, the arrow keys, Home and End; DARK shows the notebook green on black as one scrolling column. The toggle beside LOAD THIS REEL switches them and is remembered (`?notebook=` holds one for a visit). It sits in Source's toolbar beside Print listing rather than in the tab bar, which it would crowd for something opened now and then | closed |

## Keys

Keys act in the plot tabs (Review, Simulate, Print, Fusion), not in Source.

| Key | Action |
|---|---|
| Arrows / drag | Look (yaw, pitch); in the Moon view, spin the Moon |
| Wheel / pinch, `+` `-` | Field of view (1°–170°) |
| `Q` `E` | Roll |
| Space | Pause (in Attract or Tour it takes control in Free-look, paused, unless the room's drive stopped the demo: then it starts it again) |
| `[` `]` | Slower / faster (the Live rate, the Beam speed, or the Free-look speed) |
| `R` | Reset the view |
| `1`–`9` | Scenes: the situations, from the SITUATION cards, as many as there are up to 9 |
| `T` | Beam on or off in the Print tab; on another tab with Beam running, shows Print and leaves Beam on |
| `L` | Copy a link to the current view |
| Esc | Closes or steps back from the last thing opened (one stack: see Room); on a terminal's page in Room, back to the machine room |
| `W` `A` `S` `D`, arrows, Shift | In the room (Room, shown): walk, Shift faster; `E` or Enter goes into the terminal in front of you (or flips the light switch, or stops and starts the drive); `L` the lights |
| `B` `J` `D` `F` `C` | Bloom, jitter, dust, film rate, catalog |
| `S` `H` | Screen (Auto, Film, Scope), Scope refresh (16 Hz, Steady) |
| `I` | Cabin interior on or off (with a kernel that has it) |
| `W` | Cabin walls on or off: the outside only through the windows (with a kernel that has it) |

## Simulation

A modern addition, in the RESTOMOD spirit: VIEW drew pre-flight predictions (TN D-6853, p. 3); this engine integrates our own trajectory. The Simulation control group, in the Simulate tab, appears only when the kernel has the engine (a `sim_run` export); on a phone it starts shut.

| Control | What it does |
|---|---|
| Source: Replay | Draw the sourced trajectory, as every other mode does |
| Source: Simulate | Integrate our own trajectory from the sourced state |
| State vector updates on/off | With updates on, the simulated state is corrected from the sourced trajectory, as the ground's state vector updates corrected the spacecraft's; off, it flies free and drifts |

The readout line says `SOURCE REPLAY`, `SIM - UPDATES ON` or `SIM - FREE`, followed in simulation by the position and velocity error at the sourced reference point nearest the g.e.t. and that point's g.e.t., e.g. `ERR 12.3 KM 4.1 FT/S   VS 75:55:48`. Before TLI there is no simulated trajectory, and it says `SIM - BEFORE TLI, REPLAY`.

The updates are named after the guidance computer's update program. Comanche055 `UPDATE_PROGRAM.agc` (https://github.com/chrislgarry/Apollo-11): "P27 (THE UPDATE PROGRAM) PROCESSES COMMANDS AND DATA INSERTIONS REQUESTED BY THE GROUND VIA UPLINK", and verb 71 performs a "CSM/LM STATE VECTOR UPDATE". How the engine applies an update is our design.

## Control pad

The Look group holds a pad of key caps that does what the keyboard does, for mouse and touch. Each cap shows its key.

| Cap | Key | Action | Repeats when held |
|---|---|---|---|
| `↑` `↓` `←` `→` | Arrows | Pitch up, pitch down, yaw left, yaw right (in the Moon view, spin the Moon) | yes |
| `Q` `E` | `Q` `E` | Roll left, roll right, 2° a step | yes |
| `+` ZOOM, `-` WIDE | `+` `-` | Narrow or widen the field of view by 10% | yes |
| `R` RESET | `R` | Reset the view | no |
| `[` SLOWER, `]` FASTER | `[` `]` | Slower / faster | no |
| `SPC` PAUSE | Space | Pause or play (starts a demo the room's drive stopped) | no |

A press acts at once and leaves Attract or Tour for Free-look, as a key press does. A held cap repeats after 0.5 s, then about 30 times a second (our choice, near common desktop key-repeat settings). Each finger holds its own cap, so two can be held together. Pressing or dragging on the pad does not scroll or zoom the page.

## View and target

With a kernel that has them, the Look group adds two rows. They are modern additions: VIEW drew what a crew saw from the vehicle's windows.

| Control | Choices | What it does |
|---|---|---|
| View | WINDOW, EXTERNAL, CM, LM | WINDOW is the scene's own window. EXTERNAL looks at the target from outside: drag, the arrows and the pad turn azimuth and elevation around it, as in the Moon view; wheel or pinch sets the field of view. CM and LM look from the CM or LM crew station |
| Target | DEFAULT, EARTH, MOON, SUN, CSM, LM | What the view points at; DEFAULT is the scene's own |
| Cabin | on, off (`I`) | In the CM and LM views, the crew compartment drawn around the eye as a wireframe: walls, windows, hatches, tunnel, panels, couches or consoles. On by default, and in Attract and Tour. Built from period drawings and data books, with the estimates labelled in `src/models.f` (CMINT, LMINT). Its opaque parts (the CM's console, couches, equipment bays and the bulkhead about the tunnel; the LM's floor, panels, consoles, engine cover and the bulkheads about the midsection and the overhead hatch) hide the cabin's lines behind them, so the far walls do not show through (ours, #71; `src/vmask.f` CBCUT). The commander's couch back is drawn and opaque too: turned to look behind, the eye sees it 0.22 m away. Where a period window outline is drawn (the CM's left rendezvous window, CMCAB; the LM commander's window frame, the LPD overlay), the cabin does not draw its own copy |
| Walls | on, off (`W`) | With the cabin on, its walls hide the outside: stars, Sun, Earth, Moon and the other vehicles show only through the windows (the CM's five, the LM's two front windows and its docking window), as from the seat. The plot frame and the LPD scale draw as before. Off, the outside shows through the wireframe. On by default, and in Attract and Tour. A modern addition (`src/vmask.f`) |

## Control groups

Each control group in the dock has a header: `[-]` shows the group is open, `[+]` shut; click or tap the header to change it. The tab decides which groups the dock shows (see Tabs). The page remembers each group's state in this browser. Until you change one, a screen 600 px wide or less opens only the tab's own groups (Mode, Mission clock, Beam, Film, Fusion) and Look, and puts Look first, under the picture; a wider screen opens every group.

## Link parameters

| Parameter | Values | Example |
|---|---|---|
| `mode` | `attract`, `tour`, `live`, `free`, `beam` | `?mode=live` |
| `reel` | a playlist reel's id: `demo` (Attract) or `tour`; it wins over `mode` | `?reel=tour` |
| `tab` | `review`, `simulate`, `print`, `fusion`, `source`. Without it, the mode's tab (Live: Simulate, Beam: Print, else Review). With no `mode`, the link loads that tab's mode at the first scene (Simulate: Live; Print and Fusion: Free-look; Review and Source: Attract) and its other view keys are ignored, except that with `photo` the photograph's `get`, `fov`, `yaw`, `pitch` and `roll` still apply. Beam is always in Print | `?tab=simulate` |
| `scn` | a scenario reel's id: `apollo11-asflown` or `apollo8-asflown` (#26 slice 7d; `reel` names playlist reels, so the scenario reel has its own key, the Scenario key of `docs/systems-model.md` section 3; ours). Alone, its first situation | `?mode=free&scn=apollo8-asflown` |
| `sit` | a situation of that reel, by its id or its card's NAME (any case); without `scn`, the first reel holding it. The LINK button writes `scn` and `sit` by NAME, which no renumbering of a reel moves | `?mode=free&scn=apollo11-asflown&sit=7` |
| `scene` | kept for old links (#22): `1`–`9`, the Nth situation across the reels in load order: Apollo 11's situations 1–8, then Apollo 8's Earthrise (situation 1 of its reel) as 9, since each reel numbers its own (#26 slice 7e). `scn` and `sit` win over it. In Live, `4`–`7` pin that view; `1`–`3` and `8` follow the mission phase; `9` opens in Free-look | `?mode=free&scene=7` |
| `photo` | a photo event's frame (a row of `data/photos.tsv` with a situation, packed in its reel, #75): mounts the photograph's reel first when another is mounted (a fresh run, as the rack mounts it), opens it in Fusion, then `get`, `fov`, `yaw`, `pitch` and `roll` apply on top | `?tab=fusion&photo=AS08-14-2383` |
| `get` | g.e.t. as `h:mm:ss` or seconds | `?get=102:45:40` |
| `utc` | `YYYY-MM-DDTHH:MM:SS` (the scene's mission lift-off plus g.e.t.; Apollo 11: 1969-07-16T13:32:00Z) | `?utc=1969-07-20T20:17:40` |
| `fov`, `yaw`, `pitch`, `roll` | degrees | `?fov=100&pitch=-10` |
| `rate` | Live `1`/`10`/`60`/`300`/`1000`; Free-look speed | `?mode=live&rate=60` |
| `bspeed` | `1`–`4` | `?mode=beam&bspeed=3` |
| `labels`, `frame`, `hidden` | `0`/`1` | `?labels=0` |
| `lab` | `0`–`3`: label level OFF, PRIMARY, SECONDARY, ALL (with a kernel that has levels; otherwise `0` is off, else on) | `?lab=1` |
| `view` | `window`, `external`, `cm`, `lm` | `?mode=free&scene=8&view=external` |
| `target` | `default`, `earth`, `moon`, `sun`, `csm`, `lm` | `?view=external&target=moon` |
| `cabin` | `0`/`1`: the cabin interior in the CM and LM views (default 1) | `?mode=free&scene=8&view=cm&cabin=0` |
| `walls` | `0`/`1`: with the cabin, the outside only through its windows (default 1) | `?mode=free&scene=8&view=lm&walls=0` |
| `bloom`, `jitter`, `dust`, `fps` | `0`/`1` | `?bloom=0&jitter=0` |
| `catalog` | `nav`, `full` | `?catalog=full` |
| `disp` | `auto`, `film`, `scope`: the Screen | `?mode=free&scene=4&disp=scope` |
| `hz` | `16`, `steady`: the Scope's refresh | `?disp=scope&hz=steady` |
| `src` | `replay`, `sim` (Simulation; only when the kernel has the engine) | `?src=sim` |
| `svu` | `0`/`1`: state vector updates in simulation (default 1) | `?src=sim&svu=0` |
| `listing` | `dark`, `light` | `?listing=light` |
| `notebook` | `light`, `dark`: the scenario notebook's reading view for this visit (the toggle's choice is remembered) | `?notebook=dark` |
| `space` | `room`, `tiled` (Room and Tiled; links carry `tiled` when you chose it) | `?space=tiled` |
| `labq` | `high`, `low`: the room's quality for this visit | `?labq=low` |
| `labdust` | `0`: no dust motes in the room (a test switch: they drift with the real frame time; `make shots`) | `?labdust=0` |
| `code` | with `tab=source`: a unit, `/BLOCK/`, a PARAMETER or COMMON member, a file, or `file:line`. `src=` with any value but `replay` or `sim` reads the same | `?tab=source&code=PROJ`, `?tab=source&code=pen.f:120` |
| `theme` | the Source browser's theme for this visit: `dark`, `light` or `contrast` (PHOSPHOR when absent) | `?tab=source&theme=dark` |
| `still` | `earthrise` (frozen Earthrise, controls hidden, for screenshots) | `?still=earthrise` |
| `bare` | present to hide the controls | `?bare&film=8` |

Moon view links to share (drag to spin; wheel or pinch to zoom):

- [The near side at the moment of landing](https://aaronsb.github.io/view1108/?mode=free&scene=6&get=102:45:40)
- [The far side](https://aaronsb.github.io/view1108/?mode=free&scene=6&yaw=180)
- [The east limb and Mare Crisium, labels on, no film effects](https://aaronsb.github.io/view1108/?mode=free&scene=6&yaw=60&labels=1&bloom=0&jitter=0&dust=0&fps=0)
- [Looking down on the south pole](https://aaronsb.github.io/view1108/?mode=free&scene=6&pitch=-90)
- [Zoomed in on the Apollo 11 landing site](https://aaronsb.github.io/view1108/?mode=free&scene=6&yaw=23.5&pitch=0.7&fov=1.5)

More examples:

- [Touchdown through the LM window, at 60×](https://aaronsb.github.io/view1108/?mode=live&utc=1969-07-20T20:17:40&rate=60)
- [Transearth coast, looking back at the Earth](https://aaronsb.github.io/view1108/?mode=live&get=150:00:00)
- [The full star catalog around the Earth, no film effects](https://aaronsb.github.io/view1108/?mode=free&scene=2&get=100:00:00&fov=90&catalog=full&bloom=0&jitter=0&dust=0&fps=0)
- [Transposition and docking, live from 3:20:30 to the docking](https://aaronsb.github.io/view1108/?mode=live&scene=7)
- [The last 13 ft before docking, hidden lines dashed](https://aaronsb.github.io/view1108/?mode=free&scene=7&get=3:23:00&hidden=1)
- [The crisp Earthrise still used for the README](https://aaronsb.github.io/view1108/?still=earthrise&bloom=1&jitter=0)
