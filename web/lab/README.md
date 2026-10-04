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
| `show(from?)` | render the room; with a placed name, the camera starts at its zoom-in pose and flies out |
| `hide()` | stop rendering (the page is shown) |
| `setTarget(name)` | fly to a placed equipment's zoom-in pose (`null`: the overview); on arrival a terminal calls `hooks.arrive` |
| `event(e)` | pass a page event to every placed equipment |

`hooks` (`LabHooks` in `src/types.ts`): `screens.vector` is the plot canvas `#cv`; `state()` returns the
`LabState` below, read once per rendered frame; `arrive(opens)` hands over to the page, which shows the tab
(`"workbench"`: the last plot tab, `"source"`: Source) and calls `hide()`.

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
export function build(ctx: BuildContext): Equipment
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

The placeholders `vector-terminal.ts`, `glass-terminal.ts` and `desk.ts` follow this; phase C replaces them in
place. A screen that shows the plot uses `ctx.vectorScreen` as its map; the plot canvas is 1.10 times as tall as
it is wide.

**The room** is `src/room/room.ts`, exporting `build(ctx: BuildContext): Room` with `object` (walls, floor,
lights of its own), `placed` (`{ name, equipment }` for each piece it placed, `equipment.object.userData.placed`
set to the name for picking) and `overview` (the zoomed-out `CameraPose`). It places equipment by kind from the
registry. The page addresses two names: `"vector"` (the terminal that opens the workbench) and `"glass"` (the one
that opens Source); a room must place those. Phase B may split the room into more files under `src/room/`.

`src/lab.ts` (renderer, camera flights, picking) and `src/main.ts` (the global) belong to neither phase.
