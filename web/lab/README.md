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
| `event(e)` | pass a page event to every placed equipment |
| `info()`, `project(name)` | for tests: quality, draw calls and triangles of the last frame, the last handover's mismatch, the walk (`x`, `z`, `yaw`, `pitch`, `near`), `locked` (pointer lock) and `hover`; a placed equipment's screen in client px |
| `plan(px?)`, `layout()`, `stand(x, z, yaw, pitch?)` | for tests: the room from above as a PNG data URL; the footprints, door and terminals; stand somewhere walking |
| `lights(on?)` | the light switch: set the troffers on or off (omitted: leave them); returns the state |

`hooks` (`LabHooks` in `src/types.ts`): `screens.vector` is the plot canvas `#cv`; `state()` returns the
`LabState` below, read once per rendered frame; `screenRect(opens)` lays the page out for that tab behind the room
and returns the client rect of the element the terminal's screen becomes (null for the library: the flight ends at the
piece's `anchors.camera`); `arrive(opens, name)` hands over to the page, which shows the tab (`"workbench"`: the last
plot tab, `"source"`: Source) or the overlay (`"listing"`, `"library"`; `name` "binder:<id>" picks that document),
fades the lab out and calls `hide()`; `leave(opens)` undoes what `screenRect` laid out when the viewer steps back from the close-up instead (the printer's hidden listing).

### Handover

A flight into a terminal ends at its arrival pose: for the 1558 and the UNISCOPE `anchors.view`, the screen and the
keyboard together from a little above and in front (`viewPose` in `kit.ts` fits their bounds), else the handover pose.
Opening it eases over 0.5 s to the handover pose: the camera square to its screen, at the distance and offset where
the picture's part of the screen (`anchors.screen`: a plane in the mesh's local XY facing +Z, `uvRect` the part in use) covers
`screenRect(opens)` on the lab canvas: matched on height, centred. The vector screen carries `#cv` itself, so its
edges land on the plot's own (within 0.1 px in the headless check); the page then crossfades over 250 ms
(`ROOM_FADE` in `web/src/room.js`). Where the element is wider than the screen (the Source workspace on a wide window
against the UNISCOPE's 2:1 face; 150 px a side at 2399 × 1101) the page also grows sideways out of the screen's rect
during the crossfade (a `clip-path` inset from `info().mismatch`), and shrinks back into it before the room fades in.
Back out, the page measures the same rect, the lab starts at that pose under it, fades in, holds for the fade, then
flies back to stand 2 m out from the screen, facing it, walking. Flights take 1 s (smoothstep, with a slight rise
mid-way); bloom eases out toward a screen so the last frame shows the plot as the page draws it.

### Walking

`src/walk.ts`: from the overview the viewer walks at its eye height, 1.4 m/s (2.6 with Shift) with eased starts and
stops, on `W` `A` `S` `D` or the arrows; the wheel or a pinch steps along the view. Looking (yaw free, pitch ±35°) is a
first-person game's: a mouse click on the room away from a machine requests pointer lock (`unadjustedMovement`, else
plain); while locked the mouse turns 0.12° per count (right looks right, down looks down), a crosshair shows, the
machine under it is the hover target, and a click, `E` or Enter uses it. A flight into a terminal, `hide()` and
`stop()` release the lock; the browser's Esc releases it, and that Esc does nothing else. Unlocked, a click on a
machine uses it, and a drag turns (touch, pen, or a refused lock). Until the first lock a line at the bottom says
how ("Drag to look around" once a lock was refused). `info()` gives `locked` and `hover`. The body is a 0.25 m circle against the walls and every `footprint`, pushed out along the shallower side so it
slides. While the room is shown a capture listener on `window` keeps every key from the page but Esc, Tab, `M`,
function keys and modifier chords, so the plot's keys cannot act behind the room. Each terminal (`opens` and
`anchors.screen`) has a zone: within 1.3 m of its screen, in front of it, facing it within 35°. There a hint names it,
and a 0.4 s dwell or `E`/Enter flies in as a click does; the terminal re-arms once the viewer is 1.7 m out. Footsteps
come from `src/audio/roomsound.ts` (`footstep`), one per 0.77 m actually walked.

### Rendering

`src/lab.ts` owns the renderer, the camera (free look about the overview, flights, hover and picking) and the
quality tier; `src/post.ts` the high tier's post chain; `src/room/lighting.ts` the lights, fog and environment.
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

Budget at the overview (1600 × 900): high about 230 draw calls and 140k triangles, low about 105 and 70k
(`info()`). The room keeps it there with `src/room/batch.ts`, run after placement: each kind of machine's baked parts
merge into one mesh per material, repeated loose parts (reels, glass) become instanced meshes and the machines'
lamp grids one instanced mesh per geometry and material, copied from the hidden originals each frame, which the
machines keep animating and the picking keeps hitting. Equipment that opens a tab is not batched.

The light switch (ours) is on the south wall by the door's latch, a `"switch"` placed piece with a `use()`: a click, `E` in its zone or `L` while the room is shown flips it, and `view1108.lights` remembers it. `room.lightsOn` is its state (the soundscape's ballasts follow it). Off, `lighting.ts` darkens the troffers (per tube, through their instance colour), the area lights and the key, drops the fill to a faint blue, raises the exposure (1.0 lit, 1.7 dark; the high tier's tone pass, the low tier's renderer) and adds `room.glows`, dim lights standing for what stays lit: the 1558's, UNISCOPE's and film recorder's screens, the tape units' lamp row and the EXIT sign (their lamps and screens are unlit materials and shine regardless). Each glow is a face (`Glow.face`: a screen's own face half as large again, the lamp row a 5.6 m strip, the sign its panel): at high an area light over it, facing out, so the light falls off softly; at low a point light 0.35 m out with linear decay. The CPU's and the console's lamp panels (`anchors.lamps`) are glows too, `always`, lit with the troffers on as well; the dust motes take the glows' colours near them. On, each tube strikes after up to half a second (two of them a second or two late), flickers for a quarter to half a second, then warms up over a second; the glows go when the last tube is steady, so the lit room pays nothing for them. The door's lever handle (`"door"`, room.ts) is used the same way, without a dwell, and opens its `anchors.href`, the repository, in a new tab; `lab.ts` releases the pointer lock first.

`LabState`: `tab`, `mode`, `playing`, `get`, `scene`, `frameNo` (kernel frames drawn; the lab re-uploads the
vector screen texture when it moves), and `sound` = `{ ctx, out, on, bed, whine }`, the page's `AudioContext`, master gain
and switch for its ambience bed from `web/src/sound.js`, and the 1558's deflection whine from `web/src/whine.js`
(null until the viewer turns sound on).

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
| `opens` | `"workbench"`, `"source"`, `"print"`, `"listing"` or `"library"`: clicking the equipment flies to `anchors.view`, the handover pose or `anchors.camera`, then a click there opens that |
| `select(on)` | called with true on the piece a flight is going to, false on every piece when the room is shown or the camera steps back (a binder comes out and goes back) |
| `pull()` | at a close-up, a click on the piece: it comes out of its shelf; true when it was already out and opens (the lab then opens it under its placed name) |
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
is out at a time; `Object.assign(piece, shelf.member(item))` gives a placed piece its `select`, `pull` and `hint`, and
the shelf's owner calls `shelf.update(dt)` from its own `update`. The bookcase is the first user: every binder (opens
on the second click), the telephone directory and paperbacks (only come out) and the index card (lifts up and forward,
turned to the viewer).

The registry (`EQUIPMENT`, with sizes in `FOOTPRINT`, W x H x D in metres; sources and confidence in
`docs/lab.md`):

| Name | Options | |
|---|---|---|
| `vector` | | UNIVAC 1558 graphic console, 0.9 x 1.5 x 1.25; its screen is the plot; opens the workbench |
| `glass` | | UNISCOPE 100, 0.46 x 0.33 x 0.69, standing on a desk top; shows the kernel source; opens Source |
| `uniservo` | `number` (head plate, 60, 61, ...), `index` (top strip) | UNISERVO VIII-C tape unit, 0.75 x 1.8 x 0.75 |
| `cpu` | `lampPanel` | 1108 cabinet, 0.8 x 1.9 x 0.8; with the lamp panel, the processor's maintenance panel |
| `powercab` | | the power distribution cabinet (HYPOTHETICAL), low, 1.0 x 1.13 x 0.7: a sloped meter panel over a pair of doors with breakers and bus bars behind; placed as `"power"`, named on hover; `use` opens and shuts its doors (`anchors.doors.open`, which the soundscape hears) |
| `console4009` | | 1108 Display Console with Day Clock, CRT and PAGEWRITER, 2.8 x 1.25 x 0.95 |
| `controller1557` | | 1557 display controller, 1.2 x 1.6 x 0.6 |
| `printer` | | line printer with fanfold paper, 1.4 x 1.2 x 0.8; the page on its hood is its screen (`fit: "width"`); `print` events feed its paper; opens `"listing"` |
| `cardreader` | | card reader, 1.0 x 1.1 x 0.7 |
| `reeltable` | | table with reels and a desk clock, 1.6 x 0.75 x 0.8 |
| `desk` | | desk, 1.5 x 0.73 x 0.75; anchor `top` |
| `chair` | | swivel chair, 0.6 x 0.88 x 0.6 |
| `bookcase` | | steel bookcase, 1.0 x 1.1 x 0.36, holding a ring binder per document of `web/library/library.json` (imported; JSON modules via `resolveJsonModule`); `anchors.binders` are pieces of their own the room places as `"binder:<id>"`; the bookcase and every binder open `"library"`; `anchors.props` (placed as `"prop:<id>"`) are `inert`: named on hover, nothing on a click |
| `filmrecorder` | | S-C 4020 microfilm recorder (HYPOTHETICAL as MSC's), 2.24 x 1.88 x 0.94; its viewing port shows the plot dimmed; `beamFrame` steps its frame counter; opens `"print"` (the Print tab) |

`vector-terminal` and `glass-terminal` are phase A's names for `vector` and `glass`. Every piece but the desk and the
chair has `anchors.camera`, a close-up pose.

**Gallery** (development only, not in the page): `npm --prefix web/lab run gallery` bundles `src/gallery.ts` into
`build/lab-gallery.js`. Serve the repository root over HTTP and open `web/lab/gallery.html`. It shows every piece in
two rows under three-point lighting, with a stand-in plot. The flags are `?view=<name>` (that piece's close-up; add
`&q` for a three-quarter view), `&play` (a running page clock) and `&tape` (a `tape` event at load).
`window.__gallery.budget` gives one frame's draw calls and triangles, without shadows.

**The room** is `src/room/room.ts`, exporting `build(ctx: BuildContext): Room` with `object`, `placed`
(`{ name, equipment }` for each piece it placed, `equipment.object.userData.placed` set to the name for picking),
`footprints` (each floor-standing piece's own bounding box seen from above, placed and turned: what the plan's
checks and walking use), `door`, `overview` (the zoomed-out `CameraPose`), `labels` (hover text by name), `air` (the
dust's box), `update` and `dispose`. The page addresses these names: `"vector"` (the 1558, which opens the
workbench), `"glass"` (the UNISCOPE 100, which opens Source), `"filmrecorder"` (which opens Print), `"printer"` (the
listing) and `"library"` (the bookcase, which opens the library; its binders are `"binder:<id>"`).
`src/room/shell.ts` builds the 9 m × 7 m × 2.75 m shell: one textured plane for the raised floor's 0.6 m tiles
(`surfaces.ts`), an acoustic-tile ceiling, two instanced meshes for the 20 troffers, walls, a door in the south wall
with an EXIT sign over it, and a wall clock. `room.ts` places by registry name, with options where a module takes
them (`uniservo` `{ number, index }`, `cpu` `{ lampPanel }`), and casts and receives shadows on everything it
places. Nothing stands in the door's swing, its aisle runs clear 2 m into the room, and every machine's front has at
least 0.9 m clear (the UNISCOPE's desk, beside the 1558, only on its chair side). A name the registry lacks becomes a
grey stand-in box of its `FOOTPRINT`, so the room composes before every module exists.
