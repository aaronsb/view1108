# Systems model: mission, scenario, situation, reel, presentation

This page is the design for how VIEW-1108 decides what it shows. It extends [`docs/vision.md`](vision.md) ("Missions as reels", one engine and many scenarios) and does not repeat it. It is written for maintainers and future agents: the first half explains the model and its rules, the second half is reference (package layout, directory tree, migration order). The agreed design and its evidence are in GitHub epic #15 and issues #16-#26; where they differ, #26 (the reel package) is the latest and wins.

Sourcing follows `CLAUDE.md`: UE-637 (UNIVAC 1108 Executive Users Guide, 1970, https://fourmilab.ch/documents/univac/manuals/pdf/1108/UE-637_1108execUG_1970.pdf) is cited by its printed section and page, as in `docs/batch-pipeline.md`; historical claims cite a document the repo holds, by printed page; our design choices are labelled "ours"; our reasoning about the period is labelled "Conjecture:". Almost everything below is design, so it is ours unless a source is given. File:line references are to the tree at `f8ef1ee` and will drift as the migration lands.

## 1. Problem

What is simulated is decided in many places, and some of them disagree.

- **Mission identity takes five forms:** the scenario id in the `.scn` header (`data/scenarios/apollo11-asflown.scn:57`, `apollo8-asflown.scn:21`); the `mission` column (8, 11) of `data/photos.tsv`; `SCENE_MISSION = { 9: "APOLLO 8" }` (`web/src/views.js:11`); `LIFTOFF_MS`, fixed to Apollo 11 (`web/src/lettering.js:4`), with the epoch offset read back from `hdr(16)` (`web/src/kernel.js:59-60`); and `A11_RANGE_ZERO` plus `A8_OFFSET` keyed on scene 9 (`web/lab/src/equipment/console4009.ts:56`).
- **The scene→scenario map is written four times:** `DATA ISNSC` (`src/vdrive.f:82`), `SCENE_SCENARIO` (`web/src/timeline.js:4`), `SCN` (`tools/selftest.mjs:49`) and `replayUTC` (`console4009.ts:56`).
- **The scene list is written five or more times:** `SCENES` (`web/src/config.js:9`) plus runtime pushes for scenes 8 and 9 (`web/src/views.js:44-56`); `tools/selftest.mjs:49`; `Makefile:7`, which has drifted to `1 2 3 4 5 6 7 8`; the key hint at `web/page.template.html:141`, patched at runtime (`views.js:58`); and the README, which still says 1..6.
- **Scenes are hard-coded in the kernel:** the 1..9 clamp in `VINIT` (`src/vdrive.f:93`), 25 `ISCN .EQ. n` branches in `vdrive.f` and 10 in `vview.f`, more in `lvlab.f`, `pen.f` and `lmoon.f`, and the layer lists `LL(12,9)` (`src/vlayer.f:36`).
- **Phase is three tables at three granularities:** `PHASES` (`web/src/modes.js:33`) and `JUMPS` (`modes.js:39`), both Apollo 11 only, and `TL_SCENES` (`web/src/timeline.js:54-107`), per scenario.
- **Scenario facts live outside the scenario files:** `BURN_CUES` (`tools/gen_data.py:179-210`) and the string `"APOLLO 11 LANDING SITE"` (`gen_data.py:625`).
- **Shot lists are tied to scene defaults:** Attract and Tour are scene numbers plus offsets from each scene's default g.e.t. (`modes.js:15-30`, `:65-72`; `ATTRACT8`, `TOUR8`, `TOUR9` pushed in at `views.js:54-56`), so retuning a default moves the shots.
- **Presentation changes state as a side effect.** `setTab` starts a mode: Simulate starts Live, Review starts Tour, Print or Fusion starts Free-look out of Attract or Tour (`web/src/tabs.js:11-22`). Room arrival calls it (`web/src/room.js:129-131`), so walking up to a terminal can change mode, scene and clock during the camera flight. Six paths set the scene: scene buttons and keys (`web/src/controls.js:112`), the Attract/Tour shot lists (`modes.js` `autoStep`), Live's `PHASES`/`JUMPS`, Following via `TL_SCENES`, the Fusion photo pick (`web/src/fusion.js:44`) and the URL (`web/src/link.js:47`).
- **The room restates one mapping five times** (`ROOM_OPENS`, `roomOver`, `roomTermOf` at `room.js:51-54`; the `Opens` type at `web/lab/src/types.ts:6`; `AT_HINT` at `web/lab/src/lab.ts:48-51`; hover labels at `web/lab/src/room/room.ts:148-152`), and Esc has seven handlers whose meaning depends on order (`room.js` three times, `lab.ts` `onKey` and `onKeyCapture`, `web/src/library.js:69`, `web/src/printout.js:72`).

The cost shows when adding a mission. An Apollo 17 LM-descent view today touches about 16-18 files across FORTRAN, Python, JavaScript, TypeScript and docs: a new `.scn`; `gen_data.py` (`BURN_CUES`, `SITECH`); `vdrive.f`, `vlayer.f`, `vview.f` and possibly `pen.f`, `lvlab.f`, `lmoon.f`; `config.js`, `views.js`, `timeline.js`, `modes.js`, `controls.js`; `console4009.ts`; `page.template.html`; `selftest.mjs`; `Makefile`; `photos.tsv`; and `CLAUDE.md`, `README.md`, `docs/modes.md`, `docs/vision.md` (#23).

## 2. Model

Five concepts. Four describe what is simulated; the fifth only shows it.

| Concept | What it is | Source of truth | Owner at run time | URL key |
|---|---|---|---|---|
| **Mission** | Identity: name, range zero (epoch), landing site, launch pad, crew | The MISSION card in `data/missions/<id>/mission.scn` | the loaded-state object, set by `loadReel` | `mission=` |
| **Scenario** | One run deck for that mission: as flown, pre-flight nominal, a later revision; legs, burns, events, timeline | A `.scn` file in the mission folder | the kernel's scenario COMMON, written by `loadReel` | `scn=` |
| **Situation** | A named span of a scenario plus a camera recipe: g.e.t. span, default g.e.t., recipe, view, target, FOV, window, overlays | SITUATION cards inside the scenario `.scn` | the loaded-state object | `sit=` (with `get=` and the look keys) |
| **Reel** | Anything loadable: a package (`.reel.tar.gz`) with a manifest and a `.scn` run deck, plus tapes, images and models. It names the kernel build it runs on and declares its controls; it never carries code. A scenario reel carries one scenario; a playlist reel carries a playlist `.scn` of shots | The package, packed from `data/missions/<id>/` or `data/reels/<id>/`; or a private package from the viewer's disk | `loadReel` | `reel=` |
| **Presentation** | How the loaded state is shown: tab, Room or Tiled, room equipment, overlays (library, listing), film effects | Page and lab code; per-viewer preferences | page and lab | `tab=`, `space=` |

The loaded-state object is one record: reel, mission, scenario, situation, g.e.t., look, playback position. The page and the lab read it; only `loadReel` writes it. Today's `LabState` (`web/lab/src/types.ts:9-17`, carrying `tab`, `mode`, `get`, `scene`) is where it starts: it gains reel, mission, scenario and epoch and loses `scene` (#16).

```mermaid
flowchart LR
  M["Mission<br>mission.scn: name, epoch,<br>site, pad, crew"]
  S["Scenario<br>.scn run deck:<br>legs, burns, events, timeline"]
  T["Situation<br>SITUATION card:<br>GET span, default GET,<br>recipe, view, target, FOV"]
  C["Camera recipe<br>fixed kernel set"]
  R["Reel package<br>.reel.tar.gz:<br>manifest, run.scn,<br>tape, images, models"]
  B["Kernel build<br>site kernel library:<br>core + named elements,<br>id + hash"]
  I["Input table<br>generated from src/:<br>names, types, ranges,<br>in_flags bits"]
  P["Playlist reel<br>demo, tour:<br>SHOT cards"]
  L["loadReel(params)<br>the only state change"]
  K["Kernel<br>COMMON tables<br>at run time"]
  V["Presentation<br>tabs, room, overlays<br>read only"]
  M -->|"has 1..n"| S
  S -->|"has 1..n"| T
  T -->|"names one"| C
  S -->|"packed into"| R
  P -->|"shots name<br>reel, sit, GET"| R
  R --> L
  P --> L
  L -->|"run deck, tapes"| K
  L -->|"loaded state"| V
  R -.->|"names by<br>id + hash"| B
  R -.->|"declares controls<br>checked against"| I
  B --> K
```

### Mission

A mission is identity and nothing else: what the lettering, the status line, the Houston clock and the photo index need to agree on. It is written once, in `data/missions/<id>/mission.scn`, and copied by the packer into every reel of that mission. The five forms in section 1 are all derived from it. The `mission` column of `photos.tsv` becomes the mission id, and photographs move into the reel that uses them (section 4).

### Scenario

A scenario is what `docs/vision.md` already calls a run deck: one trajectory version of one mission. Today's `.scn` cards (epoch, `SITE`, `PAD`, legs, `EVENT`, `TIMELINE`, `BURN`, `REF`) stay; `BURN_CUES` and `SITECH` move into cards. A mission folder can hold several scenarios, for example Apollo 11 as flown and the pre-flight nominal, and each packs into its own reel.

### Situation

A situation is the unit a viewer picks: "Apollo 8 Earthrise", "Apollo 11 LM descent". It replaces the scene number, `PHASES`, `JUMPS` and `TL_SCENES` (#17). It is a card in the scenario `.scn`, cited like every other card, so the mission → phase selector of `docs/vision.md` becomes mission → situation. The page's lists, Live's phase spans, the Following camera script and the selftest's list are all generated from these cards.

### Camera recipes

The kernel keeps a small fixed set of camera recipes, the parts of today's scenes that are genuinely different camera code. #17 names six: forward horizon, inertially fixed, COAS, LM window with LPD, whole-disc Moon, and external. A situation names one recipe and supplies the mission facts (times, vehicles, targets) as data; the kernel no longer branches on scene numbers for mission facts. `view_init(scene)` in the interface contract becomes an initialisation from the loaded situation (exact entry point to be set in #17).

Our first reading of how today's nine scenes fall onto the recipes, to be confirmed in #17:

| Today | Recipe | Notes |
|---|---|---|
| 1 Earthrise, 3 Earth limb, 9 Apollo 8 Earthrise | forward horizon | 9 differs from 1 only in scenario and defaults |
| 2 Transearth coast / Earth approach | inertially fixed | |
| 4 LM rendezvous | external (vehicle seen from a vehicle) | may need its own recipe if the pirouette pose stays kernel code |
| 5 LM descent | LM window with LPD | |
| 6 Moon view | whole-disc Moon | a modern addition (`CLAUDE.md`, Scenes) |
| 7 Transposition & docking | COAS | |
| 8 Docked stack in translunar coast | external | a modern addition |

Today's nine scenes become nine situations with their current defaults, and every frame must render identically (the gate in section 7).

### Reel

A reel is the only thing that can be loaded. #18 and #23 first said "a reel is a `.scn` file"; #26 refines that to a package with the `.scn` inside, and this page follows #26. There are two kinds:

- **Scenario reel**: one scenario's run deck with its situations, tapes, images and models.
- **Playlist reel**: a playlist `.scn` of REEL/SHOT cards, each naming a reel, a situation, an absolute g.e.t. and look parameters (#18). Shots use absolute g.e.t., not offsets from a default, so retuning a situation's default does not move them.

**Attract is the demo reel.** It is a hypothetical demonstration of the system, packaged and loaded like any other playlist reel, and it is the default reel mounted when the viewer has not chosen one, both on page load and in the room (#18, refinement of 2026-10-06). Tour is another playlist reel. Nothing in the code is special to either: there is one playlist player, and leaving the demo means loading a different reel. "Attract" and "Tour" stop being modes; `mode=attract` and `mode=tour` survive only as URL aliases for `reel=demo` and `reel=tour` (#22). The film's four-shot sequence that the attract loop replays today (`CLAUDE.md`, "Attract loop") becomes the first shots of the demo reel.

How the viewer leaves the demo is ours and open (section 8): the proposal is that the first input that takes control loads the scenario reel of the shot on screen, at the current g.e.t. and look, so the picture does not jump.

### Presentation

Presentation is the tab bar, Room or Tiled, the room's equipment and camera flights, the overlays, the film effects and the sound. It reads the loaded state and never writes it. Live, Free-look and Beam remain ways of driving time and look within a loaded situation; choosing a tab does not start any of them (section 3).

## 3. Rules

1. **One loader.** `loadReel(params)`, taking a `URLSearchParams`-like object, is the only code that changes reel, mission, scenario, situation, g.e.t. or look. The URL, keys, buttons, the Fusion photo pick, Live, the playlist player and the room shelf all build params and call it (#16). `applyParams` (`web/src/link.js:47`) stops reading the global `UP` and becomes the parser `loadReel` uses. Continuous changes inside a situation (the clock running, a drag of the look) go through the same object without reloading the reel.
2. **Presentation never changes mode, scene or time.** `setTab`, room arrival, walk-up, overlays and Esc change only what is shown. Done when opening any tab or room terminal leaves the loaded state unchanged (#16).
3. **No scene numbers in the page loops.** The playback loop, Live, Following and the keys read situations from the loaded reel. Done when `modes.js` has no scene numbers and grepping for `=== 9`, `{9:`, `ISNSC` and `A8_OFFSET` outside generated tables finds nothing (#16, #18).
4. **Every fact has one source, generated outward.** A fact is written once, in a card in `data/`, and the packer generates everything else from it: the reel's `run.scn` and tables, the site reel index, `build/names.js`, the selftest's list. No list of missions, situations or reels is typed by hand in page, lab, kernel, tests or Makefile.
5. **Everything loadable is a reel package with a `.scn` run deck inside, read at run time** (#26). The demo reel is no exception.
6. **Reels reference and declare; they never carry a copy of code** (decision on #26, 2026-10-06). Three consequences:
   - **Kernel by reference.** A reel's manifest names the kernel build it runs on from the site's kernel library, by id and hash. Period parallel: an EXEC 8 run named its program with `@XQT`, whose element field "names the specific element (absolute element only) to be executed" (UE-637 sec. 2.14.2, p. 2-34).
   - **One kernel core, no forks.** New capability, such as #24's contour terrain, is a new element in the one `src/` tree. A kernel build is the shared core plus a named set of elements, linked as the Collector gathers "one or more relocatable elements to produce a program" (UE-637 sec. 5.1). There is no per-reel FORTRAN.
   - **Controls as declared options.** The kernel publishes its input table (names, types, ranges, `in_flags` bits), generated from source. A reel's manifest lists which inputs to expose and how, from a closed vocabulary; the page owns the widgets and validates the reel against the input table at load. Period parallel: `@XQT` option letters "generate a 26 bit mask with bit position 25 set to a 1 bit for an A option letter, bit 24 for a B, etc." (UE-637 sec. 2.14.1), which the program read through `ER OPT$` (same section); `in_flags` is that mask today.

Rules 4 and 6 together: mission, scenario and situation data live only in the run deck; kernel tables, page names, the input table's page copy and the shelf index are generated from the deck or from `src/`.

## 4. Reel package

### Layout

From #26; the file names are ours.

```
apollo17-asflown.reel.tar.gz
  manifest.json      id, title, mission, version, sources, contents
  run.scn            mission card, legs, events, burns, SITUATION and TIMELINE cards
  tape/              time-tagged data, g.e.t.-indexed
    csm.tsv lm.tsv   state vectors: t, r, v
    events.tsv       g.e.t., kind, name, source
  images/            photographs matched to the mission profile
  models/            vehicle or terrain models (e.g. Taurus-Littrow contour rings)
```

There is no `kernels/` directory. #26 first proposed optional kernel elements inside a reel; the decision of 2026-10-06 on #26 replaces that with a kernel named by reference (below).

A playlist reel holds `manifest.json` and `run.scn` (its SHOT cards) and usually nothing else.

### Manifest

`manifest.json` has the reel's `id`, `title`, `kind` (`scenario` or `playlist`), `mission`, `scenario`, `version`, `sources` (the documents the reel's data come from), `kernel`, `controls` and `contents`.

- `kernel`: the id and hash of a build in the site's kernel library. The loader refuses a reel whose build is not in the library or whose hash does not match.
- `controls`: the inputs this reel exposes and how, each an input-table name plus a widget kind from a closed vocabulary (toggle, slider, select, presets) with an optional narrower range or preset values. The page checks every entry against the kernel build's input table at load and refuses the reel if one does not match (ours, from #26).

Each `contents` entry has:

- `path` (inside the package) or `url` (outside it);
- `type`: `scn`, `tape`, `events`, `image`, `model` or `terrain`;
- the g.e.t. span or event id it applies to, where it applies;
- a source citation and a licence or credit line;
- for a `url` entry, a content hash where the content is fixed (ours).

### Data formats: no processing step

Everything in a reel is read as it is. Tables are TSV or JSON; the run deck is the `.scn` card text the kernel's cards already use; images are ordinary web images. The page unpacks with the browser's native `DecompressionStream('gzip')` and a small tar reader (#26). There is no build step between a reel and the page.

The tape tables carry the samples the kernel's tape holds: time, position and velocity per vehicle channel, up to four channels (`src/tape.f`, after TN D-6853 printed p. 12, "As many as four vehicle trajectories can be integrated simultaneously"). Today the tape is written only by the engine (`sim.f`); a reader that fills it from `tape/*.tsv` is new.

### Material we cannot redistribute

A manifest entry can be a URL instead of a file, so material we may not copy is referenced, not packed (#26). The page fetches it at run time and the reel still loads without it. Photographs use this where their licence does not allow redistribution.

Material held only locally is never put in a published reel or referenced from the repo by path. The 16 mm film "Commander's Window View for LM Landing at Taurus-Littrow" (Flight Performance Branch, Mission Planning and Analysis Division, 1972; JSC reel FR-9438, archive id jsc2014m002233), sent to the maintainer by Ben Feist (NASA JSC), is the case in point (#24): it is described by title and credit, and its frames go only into a private reel.

### Private reels

A viewer can load a reel package from their own disk (file picker or drop). It is read in the browser and never uploaded or published (#26). The use is local reference material, for example FR-9438 frames overlaid on the Apollo 17 descent. A private reel cannot be named by `reel=`, which resolves only against the site reel index; a link made while one is loaded carries `mission=`, `scn=`, `sit=` and `get=` and falls back to the site reel for that scenario (ours; section 8).

### Kernels by reference, never in a reel

Code reaches the page only from the site. The site's kernel library holds the kernel builds, each the shared core plus a named set of elements from `src/`, built by `tools/build.sh` and listed with its hash. A reel, whether shipped with the site or loaded from disk, carries data and declarations only and names its build. This replaces #26's first proposal of optional kernel elements inside site-shipped, hash-listed reels: the hash list moves from reels to kernel builds, and no reel is ever a carrier of executable code (decision on #26, 2026-10-06). A private reel naming a build the site does not have cannot load.

Conjecture: how many builds the library needs is open. One build holding every element may be enough while the elements are small; named builds keep the `@XQT` analogy and let a reel pin the build it was checked against.

### Kernel input moves to run time

Today scenario data is compiled in: `tools/gen_data.py` turns `data/scenarios/*.scn` into `BLOCK DATA` in `src/viewdata.f` (`/CSCEN/`, `/CTLN/`; `CLAUDE.md`, Architecture), and `docs/vision.md` planned the same for new scenarios. With reels, the shell writes the run deck and tapes into the kernel's COMMON tables when a reel is loaded, through a new shell entry point (#26). Static catalogs (stars, coastlines, craters, the Moon series) stay compiled in as `BLOCK DATA`: they are the program's, not the run's.

This is also the more faithful shape. VIEW was a general program fed per-mission inputs: "the vehicle position, velocity, and attitude and Greenwich mean time must be known. These data are obtained readily from the operational trajectory document, which is printed and available several months before each Apollo mission" (TN D-6853, printed p. 12, as quoted in `docs/vision.md`). Conjecture: those inputs reached the 1108 as a run deck or input tape per run (`docs/batch-pipeline.md`, section 3). Loading a reel at run time stands in for that; the reel package itself, its manifest and its compression are ours.

### Packing

`tools/gen_data.py` becomes the reel packer for our own reels: it validates every card, checks every card has a source, checks each manifest's `controls` against the input table, packs `data/missions/<id>/` and `data/reels/<id>/` into packages, and writes the site reel index the shelf and `reel=` read (#26). It keeps generating the static catalogs. The build generates the input table from `src/` (the shell's `in_*` globals and the `in_flags` bits) and writes the kernel library's list of builds and hashes.

## 5. Room

The room (`web/lab/`) is presentation. These rules apply rules 1 and 2 to it.

### Tape library shelf

A shelf in the machine room holds one reel per package in the site reel index, labelled from its manifest (#19). The pattern is the bookcase: `equipment/bookcase.ts` builds one binder per `web/library/library.json` entry, placed as `binder:<id>` (`room.ts:97-100`), pulled then opened through `pullable.ts`. Reels are `reel:<id>` pullables on the shelf or the existing reel table (`web/lab/src/equipment/reeltable.ts`, placed at `room.ts:73`).

**Mounting a reel on a UNISERVO drive is the load gesture.** Pull a reel, carry it to one of the seven drives (`room.ts:65`), mount it: that calls `loadReel` with the reel's params, with no page reload. This is our design. Tapes and run decks belong to the period picture (TN D-6855 printed pp. 7-8 documents an ephemeris tape between MSC programs; `docs/batch-pipeline.md`), but no source says VIEW's inputs were mounted this way, and the shelf and drive gesture are a restoration.

### Idle by default

The room starts idle: the demo reel is mounted on a UNISERVO drive with a visible DEMO label, and nothing is chosen (#20, refinement of 2026-10-06). Choosing a reel from the shelf replaces it. Idle also means the room does not change state on its own:

- Entering the room, walking about and arriving at a terminal leave the loaded state as it is (rule 2).
- Walk-up auto-entry (0.4 s dwell within 1.3 m, `web/lab/src/walk.ts:15,136`) becomes an option, off by default (#20).
- A control at the drive starts and stops the mounted reel. Whether the demo reel's tape is moving when the viewer first enters is open (section 8); our proposal is stopped, so the screens, clocks and lamps hold still until the viewer starts it.

### One equipment→target table

One declared table maps each piece of equipment to what it opens (its tab, overlay or the shelf) and its hover label. `ROOM_OPENS`, `roomOver`, `roomTermOf`, the `Opens` type, `AT_HINT` and the hover labels are generated from or read it. A new kind (the shelf, `scenario` in `Opens`) is one row.

### One Esc stack

Opening anything (a terminal, an overlay, a pulled binder or reel) pushes onto one stack; Esc pops the top. The seven handlers in section 1 go. The stack never touches the loaded state.

## 6. Directory layout

The target tree (ours, from #23 and #26):

```
data/
  missions/
    apollo11/
      mission.scn           MISSION card: name, epoch, site, pad, crew
      asflown.scn           scenario: legs, burns, events, TIMELINE, SITUATION cards
      nominal.scn           (later) the pre-flight nominal
      reel.json             manifest source: title, sources, contents beyond the .scn
      tape/  images/  models/
    apollo8/ ...
    apollo17/
      ...
      terrain/              Taurus-Littrow landforms (#24)
  reels/
    demo/  run.scn reel.json    playlist: the demo reel (today's Attract)
    tour/  run.scn reel.json    playlist
  stars.6.json, coastline, meeus47.txt, gazetteer ...   static catalogs, unchanged
src/
  viewdata.f, viewdims.inc  GENERATED: static catalogs only (open: committed or not)
build/                      GENERATED, gitignored
  names.js                  name tables the page reads
  reels/
    index.json              site reel index: id, title, kind, mission, hash
    *.reel.tar.gz           packed reels
  kernels/
    index.json              site kernel library: build id, element list, hash
    inputs.json             the input table, generated from src/
    <build>.wasm, .js       kernel builds
web/
  view1108.html             GENERATED, gitignored
  reels/, kernels/          the packed reels, kernel builds and their indexes, shipped beside the page (ours)
  library/                  open: PDF policy
```

Open decisions, from #23:

- **Whether generated kernel tables stay committed.** `src/viewdata.f` (510K) and `src/viewdims.inc` are committed today. Once scenario data leaves them they shrink to the static catalogs. If the kernel must build without Python, keep them committed and marked generated; otherwise move them to `build/`.
- **The PDF policy for `web/library`.** It holds about 48 MB of PDFs beside the page, two of them symlinks into `reference/`, which duplicates `reference/`'s role. Options: keep the binders' PDFs in `web/library` and drop the duplicates in `reference/`; keep one copy in `reference/` and have the build copy what the site serves; or serve only `library.json` with URLs to the public copies.

## 7. Migration order

Our proposed order. Each step keeps output identical where it touches existing scenes: the wasm-vs-JS selftest and the native SVG renders from `make check`, compared byte for byte, the gate `docs/vision.md` set for the kernel split. The epic's checklist lists #26 first; this order puts it after the steps that make the data clean, so the first packages are packed from a tree that already has one source per fact.

| Step | Issue | What lands | Gate |
|---|---|---|---|
| 0 | #15 | This page | review |
| 1 | #23 | `data/missions/<id>/`; `BURN_CUES` and `SITECH` into cards; Makefile and selftest read generated lists | identical frames |
| 2 | #17 | SITUATION cards; kernel scenes become camera recipes; `PHASES`, `JUMPS`, `TL_SCENES` and scene lists generated | today's nine scenes as situations, identical frames |
| 3 | #16 | `loadReel`; loaded-state object; `setTab` and room arrival presentation-only; per-file maps deleted | grep test in rule 3; tabs and terminals leave state unchanged |
| 4 | #18 | Demo and Tour as playlist `.scn` with absolute g.e.t.; one playlist player; no Attract or Tour mode | frame-identical playback from reel data |
| 5 | #26 | Packer, site reel index, package loader, run-time kernel input; kernel library and generated input table; manifest `kernel` and `controls` | Apollo 11 and Apollo 8 load from packages with identical frames |
| 6 | #22 | Canonical URL keys; colliding keys renamed with aliases; one URL table | parser test against the table |
| 7 | #20 | Idle room, one equipment table, one Esc stack, walk-up off by default | — |
| 8 | #19 | Tape library shelf and UNISERVO mount | mounting loads without reload |
| 9 | #21 | Room set dressing from period UNIVAC 1108 photographs, labelled ours | — |
| 10 | #24 | **Acceptance test:** Apollo 17 LM descent at Taurus-Littrow as a new reel | see below |
| — | #25 | Research: the 1972 films and the MPAD source behind FR-9438; runs alongside | — |

**Acceptance (#24).** The Apollo 17 reel passes when it is added as one mission folder plus its entry in the reel index, with no edits to page or kernel code except the new terrain layer it needs (#24, #26). That layer is a new element in `src/`, part of a kernel build in the site library that the reel names (rule 6), not code in the reel. The checks are the film's data block readings (TIME FROM IGN, ALTITUDE, PITCH ANGLE and the rest) for its 96 plots, which are local-only research material and stay out of the repo. The photographs used for the room in #21 are described by title and credit only: a Dakota County Historical Society (Lawshe Memorial Museum) photograph of a UNIVAC 1108 installation, and the UNIVAC 1108-II Information Brochure (Computer History Museum); `docs/media/univac-1108-census-bureau.jpg` is the public-domain alternative already in the repo.

## 8. Open questions

1. **Leaving the demo.** Does the first input that takes control load the scenario reel of the shot on screen at the current g.e.t. and look (our proposal), or return to a reel chooser?
2. **The idle room's tape.** In the room the demo reel is mounted; is it running or stopped when the viewer enters? Running is the page-load behaviour; stopped is what #20 asked for.
3. **Kernel builds.** One build with every element, or several named builds a reel picks between? And how a layer list in a SITUATION card names layers that only some builds have (refuse at load, as for controls, is our proposal).
4. **The run-time kernel entry point.** Its name and shape (one call per card table, or one buffer the kernel parses as cards), and whether the native driver `tools/viewsvg.f90` reads the same reel files.
5. **Links to private reels.** A link cannot name a private reel. Should the page say so when it falls back to the site reel, or refuse the link?
6. **Situation versus scenario reel granularity.** One reel per scenario (as #26's example) or per mission with several scenarios inside?
7. **Generated tables committed or not, and the `web/library` PDF policy** (section 6).
8. **The controls vocabulary.** The exact closed set of widget kinds, and whether presentation-only settings (film effects, label level) are reel-declared or stay per-viewer preferences.
9. **Mode names.** With Attract and Tour gone as modes, are Live, Free-look and Beam still modes, or properties of the loaded state (clock rate, look source, output)?
10. **Photo index.** `data/photos.tsv` serves Fusion across missions today; does it split into each reel's `images/` entries, with a generated site-wide index for Fusion?
