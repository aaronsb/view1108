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
| `setTarget(name)` | fly to a placed equipment (`null`: the overview); a terminal ends at its handover pose and calls `hooks.arrive` |
| `event(e)` | pass a page event to every placed equipment |
| `info()`, `project(name)` | for tests: quality, draw calls and triangles of the last frame, the last handover's mismatch; a placed equipment's screen in client px |

`hooks` (`LabHooks` in `src/types.ts`): `screens.vector` is the plot canvas `#cv`; `state()` returns the
`LabState` below, read once per rendered frame; `screenRect(opens)` lays the page out for that tab behind the room
and returns the client rect of the element the terminal's screen becomes; `arrive(opens)` hands over to the page,
which shows the tab (`"workbench"`: the last plot tab, `"source"`: Source), fades the lab out and calls `hide()`.

### Handover

A flight into a terminal ends with the camera square to its screen, at the distance and offset where the picture's
part of the screen (`anchors.screen`: a plane in the mesh's local XY facing +Z, `uvRect` the part in use) covers
`screenRect(opens)` on the lab canvas: matched on height, centred. The vector screen carries `#cv` itself, so its
edges land on the plot's own (within 0.1 px in the headless check); the page then crossfades over 250 ms
(`ROOM_FADE` in `web/src/room.js`). Where the element is wider than the screen (the Source workspace on a wide window
against the UNISCOPE's 2:1 face; 150 px a side at 2399 × 1101) the page also grows sideways out of the screen's rect
during the crossfade (a `clip-path` inset from `info().mismatch`), and shrinks back into it before the room fades in.
Back out, the page measures the same rect, the lab starts at that pose under it, fades in, holds for the fade, then
flies to the overview. Flights take 1 s (smoothstep,
with a slight rise mid-way); bloom eases out toward a screen so the last frame shows the plot as the page draws it.

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

`LabState`: `tab`, `mode`, `playing`, `get`, `scene`, `frameNo` (kernel frames drawn; the lab re-uploads the
vector screen texture when it moves), and `sound` = `{ ctx, out, on }`, the page's `AudioContext` and master gain
from `web/src/sound.js` (null until the viewer turns sound on) for positional or ambient audio.

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
| `anchors.*` | anything else a room needs, e.g. the desk's `top` (a `Vector3`: where things stand on it) |
| `opens` | `"workbench"` or `"source"`: clicking the equipment flies to `anchors.camera`, then the page opens that |
| `update(dt, state)` | per rendered frame (blinking lamps, spinning reels) |
| `event(e, state)` | page events (a tape drive reacting to `tape`, a recorder to `beamFrame`) |
| `dispose()` | free what `build` made (geometry, materials, textures) |

A screen that shows the plot uses `ctx.vectorScreen` as its map; the plot canvas is 1.10 times as tall as it is wide.
Shared materials, surface maps and part geometries come from `src/equipment/kit.ts`, made once and shared by every
piece. An equipment's `dispose()` frees only what it made for itself. Lamps and screens are unlit and
`toneMapped: false`.

The registry (`EQUIPMENT`, with sizes in `FOOTPRINT`, W x H x D in metres; sources and confidence in
`docs/lab.md`):

| Name | Options | |
|---|---|---|
| `vector` | | UNIVAC 1558 graphic console, 0.9 x 1.5 x 1.25; its screen is the plot; opens the workbench |
| `glass` | | UNISCOPE 100, 0.46 x 0.33 x 0.69, standing on a desk top; shows the kernel source; opens Source |
| `uniservo` | `number` (head plate, 60, 61, ...), `index` (top strip) | UNISERVO VIII-C tape unit, 0.75 x 1.8 x 0.75 |
| `cpu` | `lampPanel` | 1108 cabinet, 0.8 x 1.9 x 0.8; with the lamp panel, the processor's maintenance panel |
| `console4009` | | 1108 Display Console with Day Clock, CRT and PAGEWRITER, 2.8 x 1.25 x 0.95 |
| `controller1557` | | 1557 display controller, 1.2 x 1.6 x 0.6 |
| `printer` | | line printer with fanfold paper, 1.4 x 1.2 x 0.8 |
| `cardreader` | | card reader, 1.0 x 1.1 x 0.7 |
| `reeltable` | | table with reels and a desk clock, 1.6 x 0.75 x 0.8 |
| `desk` | | desk, 1.5 x 0.73 x 0.75; anchor `top` |
| `chair` | | swivel chair, 0.6 x 0.88 x 0.6 |

`vector-terminal` and `glass-terminal` are phase A's names for `vector` and `glass`. Every piece but the desk and the
chair has `anchors.camera`, a close-up pose.

**Gallery** (development only, not in the page): `npm --prefix web/lab run gallery` bundles `src/gallery.ts` into
`build/lab-gallery.js`. Serve the repository root over HTTP and open `web/lab/gallery.html`. It shows every piece in
two rows under three-point lighting, with a stand-in plot. The flags are `?view=<name>` (that piece's close-up; add
`&q` for a three-quarter view), `&play` (a running page clock) and `&tape` (a `tape` event at load).
`window.__gallery.budget` gives one frame's draw calls and triangles, without shadows.

**The room** is `src/room/room.ts`, exporting `build(ctx: BuildContext): Room` with `object`, `placed`
(`{ name, equipment }` for each piece it placed, `equipment.object.userData.placed` set to the name for picking),
`overview` (the zoomed-out `CameraPose`), `labels` (hover text by name), `air` (the dust's box), `update` and
`dispose`. The page addresses two names: `"vector"` (the 1558, which opens the workbench) and `"glass"` (the
UNISCOPE 100, which opens Source). `src/room/shell.ts` builds the 8 m × 6 m × 2.75 m shell: one textured plane for
the raised floor's 0.6 m tiles (`surfaces.ts`), an acoustic-tile ceiling, two instanced meshes for the 20 troffers,
walls, a door and a wall clock. `room.ts` places by registry name, with options where a module takes them
(`uniservo` `{ number, index }`, `cpu` `{ lampPanel }`), and casts and receives shadows on everything it places. A
name the registry lacks becomes a grey stand-in box of the machine's size, so the room composes before every
module exists; `"vector"` and `"glass"` fall back to the phase-A `vector-terminal` and `glass-terminal`.
