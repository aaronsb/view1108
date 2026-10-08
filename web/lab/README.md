# web/lab: the machine room

The 3D room around the workbench (Room in the tab bar; see `docs/modes.md`). A modern addition: TypeScript and
three.js, bundled by esbuild into `build/lab.js`, a single IIFE that `tools/assemble.py` inlines into the page. The
kernel and the page modules in `web/src/` do not depend on it; a page built without it is the Tiled page.

## Build

`tools/build.sh` does this; by hand:

```
npm --prefix web/lab ci --ignore-scripts   # three, @types/three, esbuild, typescript, as pinned in package-lock.json
npm --prefix web/lab run build             # -> build/lab.js
npm --prefix web/lab run typecheck         # tsc --noEmit (not part of the build)
```

esbuild is the pinned devDependency (0.28.2), not a system binary, so CI and every checkout bundle with the same
version. `--ignore-scripts` is safe: esbuild's postinstall only optimises its launcher, and its platform binary
comes as an optional dependency. Without npm or the network the build warns and makes the page without the lab.

## Licence

three.js is MIT licensed (Copyright 2010-2026 three.js authors, `node_modules/three/LICENSE`). The bundle keeps its
licence comment at the end (`--legal-comments=eof`); `THIRD_PARTY.md` lists it.

## How the page drives it

`web/src/room.js` owns Room and Tiled. Loading the bundle only defines `window.VIEW_LAB`; nothing runs until Room
is chosen.

| `VIEW_LAB.` | |
|---|---|
| `supported()` | a cheap guess that WebGL exists, without creating a context |
| `start(host, hooks)` | build the renderer and the room into `host`; `false` when WebGL fails |
| `stop()` | dispose of everything, the WebGL context included (Tiled) |
| `show(from?, rect?, holdMs?)` | render the room; with a placed name the camera starts at that terminal (with `rect`, at the handover pose for it), holds `holdMs`, and flies out |
| `hide()` | stop rendering (the page is shown) |
| `setTarget(name, open?)` | fly to a placed equipment (`null`: the overview); a terminal ends at its arrival pose and holds there until a click, `E` or Enter eases to its handover pose and calls `hooks.arrive` (with `open`, straight to the handover pose and on arrival) |
| `back()` | at a terminal's close-up, step back out in front of it, as Esc or a walking key does there (calls `hooks.leave`); `false` when not at one |
| `stations` | the station table (`src/stations.ts`): the page derives what each terminal opens, its tab and the terminal a tab belongs to from it |
| `escLock()`, `home()` | the page's Esc stack (`web/src/esc.js`): `escLock()` is true when an Esc reaching the page while the room shows was the pointer lock's (it releases a lock still held); `home()` is the stack's bottom entry, walking back to the overview (`false` when already there) |
| `walkup(on)` | walk-up auto-entry on or off, remembered as `view1108.walkup` (off by default) |
| `event(e)` | pass a page event to every placed equipment |
| `carry(id)` | reel `id` out at the tape rack and carried, its notebook half out on the bookcase (the notebook viewer's Load this reel in the room, after `show("rack")` or before `setTarget("rack")`); pushes `"pulled"`; `false` when the reel is not on the rack |
| `answer(choice)` | the page's answer to its modal (`LabHooks.ask`) for what was pulled: `"back"` puts it and its partner back, `"load"` puts it back and mounts its reel (`hooks.mount`), `"read"` opens the notebook, `"loadread"` mounts and opens it |
| `info()`, `project(name, lift?)` | for tests: `tapes` (each tape unit's paper label, west to east, "" undressed; #87) and `systapes` (the rack's system tapes by label); quality, draw calls and triangles of the last frame, the last handover's mismatch, the walk (`x`, `z`, `yaw`, `pitch`, `near`), `walkup`, `locked` (pointer lock), `hover`, the top line's text (`line`), what is out on a shelf (`out`: placed name to 1, or 0.45 half out beside its partner) and the loaded state as the lab reads it (`loaded`, with `reel` and `playing`); a placed equipment's screen (else its origin, `lift` m above it) in client px |
| `plan(px?)`, `layout()`, `stand(x, z, yaw, pitch?)` | for tests: the room from above as a PNG data URL; the footprints, door and terminals; stand somewhere walking |
| `lights(on?)` | the light switch: set the troffers on or off (omitted: leave them); returns the state |

`hooks` (`LabHooks` in `src/types.ts`): `screens.vector` is the plot canvas `#cv`; `state()` returns the
`LabState` below, read once per rendered frame; `screenRect(opens)` lays the page out for that tab behind the room
and returns the client rect of the element the terminal's screen becomes (null for the library: the flight ends at the
piece's `anchors.camera`); `arrive(opens, name)` hands over to the page, which shows the tab (`"workbench"`: the last
plot tab, `"source"`: Source) or the overlay (`"listing"`, `"library"`; `name` "binder:<id>" picks that document, "binder:nb-<reel id>" that reel's notebook),
fades the lab out and calls `hide()`; `leave(opens)` undoes what `screenRect` laid out when the viewer steps back from the close-up instead (the printer's hidden listing). `drive()` is the drive's STOP/START (the page toggles its playback clock); `reels` is the site reel index (`ReelInfo[]`: each packaged reel's manifest id, title and kind, a scenario reel's mission and range zero, and its notebook's title if it carries one; `web/src/reels.js` `reelIndex`), read once when the room is built, one reel on the tape rack each; `mount(id)` mounts reel `id` through the page's `loadReel` (`reelMount`, the same call as Tabbed's reel list) when a reel carried from the rack is used on a tape unit; `ask(kind, id, title)` asks the page for its modal when a pulled reel (`"reel"`), a pulled mission notebook whose reel is a scenario reel (`"notebook"`) or a pulled system tape (`"system"`, #87: `id` is the tape's, its only answer `"back"`) is clicked again (the page answers through `answer()`); `esc(key, pop)` pushes `key` onto the page's Esc stack with what Esc does while it is on top, or with `null` takes it off: the lab pushes `"closeup"` at a terminal's close-up (step back) and `"pulled"` when a binder or reel is pulled out there (put it back; a carried reel's entry stays after the close-up until it is mounted or put back). `LabState.mounted` is the mounted reel's id in that index.

### Handover

A flight into a terminal ends at its arrival pose: for the 1558 and the UNISCOPE `anchors.view`, the screen and the keyboard together from a little above and in front (`viewPose` in `kit.ts` fits their bounds), else the handover pose. Opening it eases over 0.5 s to the handover pose: the camera square to its screen, at the distance and offset where the picture's part of the screen (`anchors.screen`: a plane in the mesh's local XY facing +Z, `uvRect` the part in use) covers `screenRect(opens)` on the lab canvas: matched on height, centred. The vector screen carries `#cv` itself, so its edges land on the plot's own (within 0.1 px in the headless check); the page then crossfades over 250 ms (`ROOM_FADE` in `web/src/room.js`). Where the element is wider than the screen (the Source workspace on a wide window against the UNISCOPE's 2:1 face; 150 px a side at 2399 × 1101) the page also grows sideways out of the screen's rect during the crossfade (a `clip-path` inset from `info().mismatch`), and shrinks back into it before the room fades in. Back out, the page measures the same rect, the lab starts at that pose under it, fades in, holds for the fade, then flies back to stand 2 m out from the screen, facing it, walking. Flights take 1 s up to 2.5 m, then 0.08 s more per metre, at most 1.8 s (`flyS` in `lab.ts`: 1.7 s across the room; smoothstep, with a slight rise mid-way); bloom eases out toward a screen so the last frame shows the plot as the page draws it.

### Walking

`src/walk.ts`: from the overview the viewer walks at its eye height, 1.4 m/s (2.6 with Shift) with eased starts and
stops, on `W` `A` `S` `D` or the arrows; the wheel or a pinch steps along the view. Looking (yaw free, pitch ±35°) is a
first-person game's: a mouse click on the room away from a machine requests pointer lock (`unadjustedMovement`, else
plain); while locked the mouse turns 0.12° per count (right looks right, down looks down), a crosshair shows, the
machine under it is the hover target, and a click, `E` or Enter uses it. A flight into a terminal, `hide()` and
`stop()` release the lock; the browser's Esc releases it, and that Esc does nothing else. Unlocked, a click on a
machine uses it, and a drag turns (touch, pen, or a refused lock). A line at the top left says what the drive has mounted and whether it runs (`LabState.reel` and `playing`: "DEMO · running · ... · drive: stop") and, until the viewer first looks, walks or clicks, how to take control ("drag to look" where a lock was refused or there is no mouse). `info()` gives `locked` and `hover`. The body is a 0.25 m circle against the walls and every `footprint`, pushed out along the shallower side so it
slides. While the room is shown a capture listener on `window` keeps every key from the page but Esc, Tab, `M`,
function keys and modifier chords, so the plot's keys cannot act behind the room; Esc goes to the page's stack. Each terminal (`opens` and `anchors.screen`), and each piece used in place (the light switch, the drive), has a zone: within 1.3 m of its screen, in front of it, facing it within 35°. There a hint names it, and `E`/Enter flies in as a click does (or uses the piece); with walk-up on (the WALK-UP button at the bottom right, beside the quality button; `view1108.walkup`, off by default, #20) a 0.4 s dwell flies in too. The terminal re-arms once the viewer is 1.7 m out. Footsteps
come from `src/audio/roomsound.ts` (`footstep`), one per 0.77 m actually walked.

### Rendering

`src/lab.ts` owns the renderer, the camera (free look about the overview, flights) and the quality tier, and wires
the parts it hands work to: `src/input.ts` (pointer, pointer lock, keys), `src/picking.ts` (hover, hit, lift),
`src/carry.ts` (the reel carried from the rack and the tape units that mount it), `src/shot.ts` (camera shots and
the screen-matching pose) and `src/quality.ts` (the auto-quality probe); `src/post.ts` the high tier's post chain; `src/room/lighting.ts` the lights, fog and environment.
Screens are not tone mapped in either tier: in the high tier every `toneMapped: false` material writes alpha 0
(`markScreens`) and the tone pass mixes ACES by alpha (progression's approach, MIT, same author).

| Tier | |
|---|---|
| `high` | PCF soft shadows from one overhead light (a static map, drawn when the room is shown), a `RectAreaLight` per troffer row, a PMREM room environment, GTAO, ACES, subtle bloom; pixel ratio up to 2 |
| `low` | hemisphere and one unshadowed overhead light, the environment, the renderer's ACES, no post; pixel ratio up to 1.25 |

`?labq=low|high` forces one for a visit; the button at the room's lower right switches and remembers
(`view1108.labq`). Otherwise a software rasteriser starts low, and a GPU starts high and drops to low for good when
the median of its first frames is over 24 ms or, after that, the mean over the next 2 s is over 22 ms; the button
then reads `LOW (auto: slow)`. `?labprobe=<ms>` starts high on any renderer and feeds `<ms>` per frame to both
checks (40 drops at the first, 23 at the second, 10 stays high); `info()` gives `slow` and `checking`.
`?labdust=0` leaves the dust motes out, whose drift follows the real frame time, for repeatable screenshots
(`make shots`, `tools/shoot.mjs`). `?labmotion=0` (`BuildContext.still`) holds the machines' motion for the same reason: the tape units' reels, the FASTRAND II's drums, head carriage and lamps, and the CPU lamp panel stay as they were built, while labels still follow the page.

Budget at the overview: low about 374 draw calls and 98k triangles at 1280 × 800 (`make shots` `room-overview`, Apollo 11 mounted, 2026-10-08; 331 before the system tapes, the dressed tape units and the FASTRAND II, #87 and #89, which add about 43: the dressed units' hub and paper labels 13, the eight system tapes 16, the FASTRAND II about 14). Earlier, at 1600 × 900: high about 230 draw calls and 140k triangles, low about 105 and 70k
(`info()`). The room keeps it there with `src/room/batch.ts`, run after placement: each kind of machine's baked parts
merge into one mesh per material, repeated loose parts (reels, glass) become instanced meshes and the machines'
lamp grids one instanced mesh per geometry and material, copied from the hidden originals each frame, which the
machines keep animating and the picking keeps hitting. The stations (`src/stations.ts`: what opens a tab or an overlay, and the drive) and the tape units (which mount a carried reel, so hover lifts them) are not batched.

The light switch (ours) is on the south wall by the door's latch, a `"switch"` placed piece with a `use()`: a click, `E` in its zone or `L` while the room is shown flips it, and `view1108.lights` remembers it. `room.lightsOn` is its state (the soundscape's ballasts follow it). Off, `lighting.ts` darkens the troffers (per tube, through their instance colour), the area lights and the key, drops the fill to a faint blue, raises the exposure (1.0 lit, 1.7 dark; the high tier's tone pass, the low tier's renderer) and adds `room.glows`, dim lights standing for what stays lit: the 1558's, UNISCOPE's and film recorder's screens, the tape units' lamp row and the EXIT sign (their lamps and screens are unlit materials and shine regardless). Each glow is a face (`Glow.face`: a screen's own face half as large again, the lamp row a 5.6 m strip, the sign its panel): at high an area light over it, facing out, so the light falls off softly; at low a point light 0.35 m out with linear decay. The CPU's and the console's lamp panels (`anchors.lamps`) are glows too, `always`, lit with the troffers on as well; the dust motes take the glows' colours near them. On, each tube strikes after up to half a second (two of them a second or two late), flickers for a quarter to half a second, then warms up over a second; the glows go when the last tube is steady, so the lit room pays nothing for them. The door's lever handle (`"door"`, room.ts) is used the same way, without a dwell, and opens its `anchors.href`, the repository, in a new tab; `lab.ts` releases the pointer lock first.

`LabState`: `tab`, `mode`, `playing`, `get`, the loaded `situation`, `scenario`, `mission`, `epoch` and `zero` (the scenario's range zero as UTC ms, which the console and reel-table clocks add the g.e.t. to; all read from the page's loaded state, `web/src/state.js` `LS`, which the lab never writes), `frameNo` (kernel frames drawn; the lab re-uploads the vector screen texture when it moves), and `sound` = `{ ctx, out, on, bed, whine }`, the page's `AudioContext`, master gain and switch for its ambience bed from `web/src/sound.js`, and the 1558's deflection whine from `web/src/whine.js` (null until the viewer turns sound on).

### Sound

`src/audio/roomsound.ts` (`RoomSound`, made by `Lab`) builds the room's soundscape on `sound.ctx` into `sound.out`
once sound is on, turns the page's bed off while it lives (`sound.bed(false)`, back on at `stop()`), and steps every
50 ms on its own timer, so it keeps going while the page is shown over the room: the listener follows the camera, the
room ducks 8 dB when `hide()` has been called, the tape units' sound follows `anchors.motion` (`{ v, w0, w1 }`, tape
speed in m/s and the reels' rad/s, set by `uniservo.ts`), and the ballasts follow `room.lightsOn` when the room
has it, and `sound.whine`'s two outputs are placed at the 1558's screen and at the film recorder. `src/audio/synth.ts` holds the noise buffers, waves, the room response and one-shot knocks and clicks; both
take any `BaseAudioContext`, so `RoomSound` with `auto` false can be attached to an `OfflineAudioContext` and stepped
by hand. `VIEW_LAB.info().sound` gives, for tests, the source and panner counts, the master's gain and RMS, and each
source's inverse-law gain at the listener. Sources and levels: `docs/lab.md`, Sound.

`LabEvent` (`event()`): `{ type: "beamFrame", at }` when a Beam trace frame ends (`at` its `performance.now()`
time, as `soundFrame` gets it) and `{ type: "tape", at }` when the engine runs (`sim_run`).

While the room is shown the page's own loop keeps stepping the kernel at the 16 fps film rate, on every tab, so
the vector screen is live; the lab renders at the display rate in its own `requestAnimationFrame` loop.

## Interfaces for the room (phase B) and the equipment (phase C)

All types are in `src/types.ts`. Units are metres; +Y is up, the room's back wall is toward -Z, the overview
camera looks toward -Z.

**Equipment** is one module per kind, `src/equipment/<kind>.ts`, exporting

```ts
export function build(ctx: BuildContext, options?): Equipment
```

and registered by kind in `src/equipment/index.ts`. `BuildContext` gives `vectorScreen` (the plot as a
`THREE.Texture`, shared; the lab marks it dirty) and `maxAnisotropy`. `Equipment` is

| Field | |
|---|---|
| `object` | the model, in its own frame: origin on the floor (or the surface it stands on) under its centre, front toward +Z |
| `anchors.screen` | `{ mesh, uvRect }`: the face that carries a picture and the part of its UV square in use |
| `anchors.camera` | `{ position, target, fov }` in the equipment's frame: the zoom-in pose, framing the screen |
| `anchors.view` | a console's arrival pose, where it has one: its screen and keyboard as its operator sees them |
| `anchors.*` | anything else a room needs, e.g. the desk's `top` (a `Vector3`: where things stand on it) |
| `opens` | `"workbench"`, `"source"`, `"print"`, `"listing"`, `"library"` or `"reels"` (the tape rack, a shelf station: its close-up opens nothing on the page): clicking the equipment flies to `anchors.view`, the handover pose or `anchors.camera`, then a click there opens that. Set by the room from the station table (`src/stations.ts`) by placed name, not by the module |
| `status()` | the piece's state, added to its hover label (the drive: its reel, running or stopped) |
| `putBack()` | a shelf at its close-up: put back what is out (Esc on a pulled binder or reel), and its half-pulled partner; `false` when nothing is |
| `out()` | how far it is out on its shelf: 0, `HALF` (beside its partner, which is out) or 1; for tests (`info().out`) |
| `carried()` | it is out and stays out after the close-up (a reel pulled at the tape rack): any tape unit then mounts it |
| `usable()` | whether `use` does anything now; while false the piece is not picked (a tape unit other than the drive, without a carried reel) |
| `select(on)` | called with true on the piece a flight is going to, false on every piece when the room is shown or the camera steps back (a binder comes out and goes back) |
| `pull()` | at a close-up, a click on the piece: it comes out of its shelf; true when it was already out and opens (the lab then opens it under its placed name) |
| `pulled()` | it is out and opens: E or Enter at the close-up opens it, as a second click would |
| `hint()` | the close-up's line, when it depends on the piece's state |
| `inert` | for looks: named on hover, nothing to fly to or open (the bookcase's props) |
| `update(dt, state)` | per rendered frame (blinking lamps, spinning reels) |
| `event(e, state)` | page events (a tape drive reacting to `tape`, a recorder to `beamFrame`) |
| `dispose()` | free what `build` made (geometry, materials, textures) |

A screen that shows the plot uses `ctx.vectorScreen` as its map; the plot canvas is 1.10 times as tall as it is wide.
Shared materials, surface maps and part geometries come from `src/equipment/kit.ts`, made once and shared by every
piece. An equipment's `dispose()` frees only what it made for itself. Lamps and screens are unlit and
`toneMapped: false`.

Things on a shelf that come out when clicked use `src/equipment/pullable.ts`. A `Shelf` (constructed with its three
hint lines) takes each item with `add(object, { offset, turn?, opens? })` once the object is placed: its rest pose is
taken then, and its out pose is the offset (in the parent's frame) and the turn (in its own axes) from there. One item
is out at a time; `Object.assign(piece, shelf.member(item))` gives a placed piece its `select`, `pull`, `pulled` and `hint`, and
the shelf's owner calls `shelf.update(dt)` from its own `update`. The bookcase is the first user: every binder (opens
on the second click), the telephone directory and paperbacks (only come out) and the index card (lifts up and forward,
turned to the viewer). The tape rack is the second: its reels only come out, and a reel's `select(false)` leaves it out (it is carried; `Shelf.isOut`).

The registry (`EQUIPMENT`, with sizes in `FOOTPRINT`, W x H x D in metres; sources and confidence in
`docs/lab.md`):

| Name | Options | |
|---|---|---|
| `vector` | | UNIVAC 1558 graphic console, 0.9 x 1.5 x 1.25; its screen is the plot; opens the workbench |
| `glass` | | UNISCOPE 100, 0.46 x 0.33 x 0.69, standing on a desk top; shows the kernel source; opens Source |
| `uniservo` | `number` (head plate, 60, 61, ...), `index` (top strip), `drive` | UNISERVO VIII-C tape unit, 0.75 x 1.8 x 0.75; with `drive`, the unit with the mounted reel: a paper label across the window names it (`LabState.reel`), RUN and STOP lamps show `LabState.playing`, the label is its screen anchor, and its reels read in bursts only while it runs; the file reel's flange and hub label follow the mounted reel. Without `drive`, while a scenario reel is mounted (`LabState.mounted`'s kind in `BuildContext.reels`) a unit numbered in `systapes.ts` carries that system tape: a paper label (not a screen anchor), its flange colour and hub label, and bursts of reads at its own staggered times; `anchors.tapeLabel()` gives its label for `info().tapes` (#87) |
| `cpu` | `lampPanel` | 1108 cabinet, 0.8 x 1.9 x 0.8; with the lamp panel, the processor's maintenance panel |
| `powercab` | | the power distribution cabinet (HYPOTHETICAL), low, 1.0 x 1.13 x 0.7: a sloped meter panel over a pair of doors with breakers and bus bars behind; placed as `"power"`, named on hover; `use` opens and shuts its doors; `anchors.selector`, placed as `"power:selector"`, turns the voltmeter selector (`anchors.panel` holds both states for the soundscape) |
| `console4009` | | 1108 Display Console with Day Clock, CRT and PAGEWRITER, 2.8 x 1.25 x 0.95; `anchors.seat` (`{ position, yaw }`) is where the room stands the operator's chair |
| `controller1557` | | 1557 display controller, 1.2 x 1.6 x 0.6 |
| `printer` | | line printer with fanfold paper, 1.4 x 1.2 x 0.8; the page on its hood is its screen (`fit: "width"`); `print` events feed its paper; opens `"listing"` |
| `cardreader` | | card reader, 1.0 x 1.1 x 0.7 |
| `reeltable` | | table with reels and a desk clock, 1.6 x 0.75 x 0.8 |
| `desk` | | desk, 1.5 x 0.73 x 0.75; anchor `top` |
| `chair` | | swivel chair, 0.6 x 0.88 x 0.6; `{tall: true}` a drafting chair (seat 0.74 m, foot ring) |
| `taperack` | | the tape library rack, 2.8 x 1.85 x 0.45 (the library zone exactly): three bays, five wire shelves, number plates A-1 to C-5; one reel per `BuildContext.reels` entry, `anchors.reels`, placed as `"reel:<id>"` and opening `"reels"`, grouped one level per mission then the playlists, spilling into other bays and levels when a group or the groups outgrow them (`racklayout.ts`, the pure plan, checked by `npm test`: `racklayout.test.ts` against synthetic indexes, with and without the system tapes; `tools/build.sh` runs it after the bundle), each group with a hand-lettered tape strip (`kit.ts` `tapeStrip`); `anchors.shelf` and `anchors.items` (reel id to its `Pullable`), which the room links to the bookcase's for the half-pull; a reel "opens": a second click on a pulled one asks the page for the reel modal (`LabHooks.ask`); each reel's rim carries a hand-lettered front label (`frontLines`, `kit.ts` `marker`) and its typed title; anonymous reels instanced only on the levels with none of the index's reels, about half to two-thirds full (`racklayout.ts` `filler`); below the playlists the system tapes (#87, `systapes.ts`), `anchors.systapes`, placed as `"systape:<id>"`, props that pull out (the close-up's line their own) and ask the page for their modal (`"system"`), never carried; `setTarget(null)` puts one back as stepping back does |
| `bookcase` | | steel bookcase, 1.0 x 1.1 x 0.36, holding a ring binder per document of `web/library/library.json` (imported; JSON modules via `resolveJsonModule`; `ringBinder` builds a binder); 1.85 m tall, its two upper shelves holding `anchors.notebooks`, one mission notebook per reel whose `ReelInfo.notebook` names one (#29), placed as `"binder:nb-<id>"` and opening `"library"`, and `anchors.shelf`/`anchors.items` (reel id to its `Pullable`), which the room links to the rack's (`Shelf.link`, `Shelf.pair`: one item out across both units, its partner half out, `HALF`); `anchors.binders` are pieces of their own the room places as `"binder:<id>"`; the bookcase and every binder open `"library"`; `anchors.props` (placed as `"prop:<id>"`) are `inert`: named on hover, nothing on a click |
| `fastrand` | | UNIVAC FASTRAND II drum unit, 3.5 x 1.6 x 0.9 (#89): two drums turning behind its window (one mesh, its texture sliding round), the head carriage with its 64 heads stepping on seeks, red lamps flickering with activity (`tape` events, a mount); `inert`, named on hover; placed as `"fastrand"` (`room.ts` `FASTRAND`: 1.2 m clear of every other footprint and the walls); the room's FASTRAND sound comes from it |
| `filmrecorder` | | S-C 4020 microfilm recorder (HYPOTHETICAL as MSC's), 2.24 x 1.88 x 0.94; its viewing port shows the plot dimmed; `beamFrame` steps its frame counter; opens `"print"` (the Print tab) |

`vector-terminal` and `glass-terminal` are phase A's names for `vector` and `glass`. Every piece but the desk and the
chair has `anchors.camera`, a close-up pose.

**Gallery** (development only, not in the page): `npm --prefix web/lab run gallery` bundles `src/gallery.ts` into
`build/lab-gallery.js`. Serve the repository root over HTTP and open `web/lab/gallery.html`. It shows every piece in
two rows under three-point lighting, with a stand-in plot. The flags are `?view=<name>` (that piece's close-up; add
`&q` for a three-quarter view), `&play` (a running page clock) and `&tape` (a `tape` event at load).
`window.__gallery.budget` gives one frame's draw calls and triangles, without shadows.

**The room** is `src/room/room.ts`, exporting `build(ctx: BuildContext): Room` with `object`, `placed` (`{ name, equipment }` for each piece it placed, `equipment.object.userData.placed` set to the name for picking), `footprints` (each floor-standing piece's own bounding box seen from above, placed and turned: what the plan's checks and walking use), `door`, `overview` (the zoomed-out `CameraPose`), `labels` (hover text by name), `air` (the dust's box), `update` and `dispose`. The page addresses the station table's names: `"vector"` (the 1558, which opens the workbench), `"glass"` (the UNISCOPE 100, which opens Source), `"filmrecorder"` (which opens Print), `"printer"` (the listing), `"library"` (the bookcase, which opens the library; its binders are `"binder:<id>"`), `"rack"` (the tape rack, a shelf; its reels are `"reel:<id>"`, and the other tape units `"uniservo-<number>"`, which mount a carried reel) and `"drive"` (the middle tape unit, STOP/START; the lab gives it its `use`, `hooks.drive`). Their hover labels come from the same table. `src/room/shell.ts` builds the 13.2 m × 10.2 m × 2.75 m shell: one textured plane for the raised floor's 0.6 m tiles (`surfaces.ts`), an acoustic-tile ceiling, two instanced meshes for the 42 troffers, walls, a door in the south wall with an EXIT sign over it, and a wall clock. `room.ts` places by registry name, with options where a module takes them (`uniservo` `{ number, index, drive }`, `cpu` `{ lampPanel }`), and casts and receives shadows on everything it places (but casts none from a mesh a module marks `userData.noShadow`: small parts inside a machine, such as the FASTRAND II's drums and the tape units' labels). Nothing stands in the door's swing, its aisle runs clear 2 m into the room, and every machine's front has at least 0.9 m clear (the UNISCOPE's desk, beside the 1558, only on its chair side). The equipment stands in #21's zones (tape area, machine floor, operator consoles, output, library) with at least 1.2 m between them; `room.ts`'s header comment gives the map, and `LIBRARY` there the library zone on the north wall, which the tape rack fills (#19; the room refuses anything else on it or its 1.2 m of standing room); `FASTRAND` the FASTRAND II's place on the machine floor, which the room keeps 1.2 m clear (#89). A name the registry lacks becomes a grey stand-in box of its `FOOTPRINT`, so the room composes before every module exists.
