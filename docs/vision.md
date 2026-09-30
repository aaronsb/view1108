# Where VIEW-1108 is going

VIEW-1108 began as a reconstruction of one short film: four shots, six scenes. The direction now is an experience of the Apollo missions themselves, drawn the way MSC's view program drew them: white vectors on black microfilm, computed by period-style FORTRAN. This page sets out what that means, what counts as VIEW and what counts as our restoration, and how the code has to change to carry it.

Sourcing follows the rest of the repo: TN D-6853 by printed page (PDF page minus 5); MSC IN 69-FM-197 by PDF page of `reference/MSC-IN-69-FM-197_Apollo11_views.pdf`. Our reasoning is labelled "Conjecture:".

## Why a mission, not a scene

VIEW covered whole missions:

- It began "as an aid in the early Gemini rendezvous and docking studies" (TN D-6853, p.2).
- For Apollo 8, "Preflight views produced for the Apollo 8 mission included views as seen through the spacecraft windows at TLI, LOI, transearth injection (TEI), and the entry phase" (p.3).
- It was used for Apollo 10 (p.4), and on Apollo 13 "the views of the Earth were used as the sole attitude-reference source for a midcourse correction" (p.10).

MSC IN 69-FM-197 is Apollo 11 told in about 200 pages of VIEW plots, section by section: TLI, translunar coast, LOI, descent, ascent, rendezvous, TEI, transearth coast, entry, plus scanning-telescope and alignment-optics star fields.

We want to replay those records live and let the viewer look around inside them.

## What the experience is

- **Missions as reels.** A mission selector (Apollo 8 and Apollo 11 first) and, within each mission, its phases in flight order, as the Apollo 11 report is laid out.
- **One clock per mission.** Each mission runs on its own ground elapsed time from its own range zero, so the lettering shows that mission's g.e.t.
- **Windows and cabins.** Views from the CM and LM windows, with sparse wireframe cabins around the design eye position so the viewer can turn from the window to the cabin.
- **Spacecraft.** The CSM, LM and S-IVB as outline models at their apparent size.
- **Context.** Orbit-path and ground-track overlays, each a toggle.

## The fence: VIEW material and restorations

Every element is one of two kinds, and the page and code say which.

**VIEW material** has a source that VIEW drew it, or could draw it. Examples:
- window outlines from engineering drawings;
- CSM, LM and S-IVB outlines ("The vehicle outlines of the CSM, LM, and the S-IVB can be drawn", TN D-6853 p.12);
- hidden-line LM and S-IVB models (same page);
- crater ellipses, named navigation stars, and shading-line terminators.

We match these against the surviving output: the film clip and MSC IN 69-FM-197.

**Restorations** are our additions in VIEW's visual language, fenced `RESTOMOD` in the kernel and labelled on the page:
- **Orbit and ground tracks.** No surviving VIEW plot draws one. The style comes from the drafted mission-planning charts in MSC IN 69-FM-197: the spacecraft path on a celestial-sphere map (p.47) and the LM ground track with 60-second ticks (pp.123, 161).
- **Cabin wireframes.** VIEW drew window outlines as seen from the design eye position (TN D-6853 p.12, item 2); the cabin around the window is ours.
- **The CSM model's detail.** No surviving plot shows a CSM, so its shape comes from published dimensions.
- **Apollo 8 views.** VIEW made them (p.3), but none survive in our holdings. We draw Apollo 8 in the formats of the Apollo 11 note, with Apollo 8's trajectory.

## Missions are run decks

VIEW was a general program fed per-mission inputs:

- "the vehicle position, velocity, and attitude and Greenwich mean time must be known. These data are obtained readily from the operational trajectory document, which is printed and available several months before each Apollo mission" (TN D-6853, p.12).
- The integrator "can integrate any nonpowered-flight trajectory after the initial state vector is known" (p.3).
- When Apollo 11's trajectory changed, the views were regenerated: the note "supersedes MSC IN 69-FM-168" and "conforms with the latest nominal mission profile" (MSC IN 69-FM-197, PDF pp.23–24).

Today the kernel does the opposite: Apollo 11 times and geometry are written into the scene code. The kernel's lunar orbit is anchored to the Apollo 11 touchdown time, the Earthrise search is bounded to the revolution before it, and the translunar leg branches on a fixed g.e.t. That doesn't scale past one mission.

The direction is a **run deck per mission**: a data table the kernel reads, kept in `data/` and turned into `BLOCK DATA` by `tools/gen_data.py` as the star and crater catalogs are. A deck holds:

- the epoch (range zero, as a Julian date);
- trajectory legs: sourced burn states from the mission report (position, speed, flight-path angle, heading) and the conic or circular model each leg uses;
- the attitude timeline per phase (for example Apollo 8's +X at nadir with a 180° roll before Earthrise);
- the phases: g.e.t. span, vehicle, window, field of view and default look;
- event marks with their sources.

The kernel stays mission-agnostic: it reads the deck, propagates the leg that covers the current g.e.t., and draws. Adding Apollo 10, 12 or 13 then means adding a deck. Conjecture: this is close to how VIEW itself was used, a fixed program with a new input deck per mission and per trajectory revision. The job flow is our guess (see `docs/batch-pipeline.md`).

## Pluggable modules

The rendering stays a FORTRAN vector system. What changes is its shape: the kernel, once a single 2,944-line `src/view.f`, is now a set of modules with fixed interfaces, so a new mission, vehicle or overlay is added as a module and the core stays unchanged.

There is period precedent. On the 1108 a program was assembled by the Collector, which "is a system processor designed to provide the user with a means of gathering (collecting) and interconnecting one or more relocatable elements to produce a program" (UE-637 sec. 5.1), and it supported overlay segments (sec. 5.3.4). Separately compiled FORTRAN elements, linked by the build, are how a growing 1108 program was put together.

Four kinds of module:

| Kind | What it is | Examples | Added by |
|---|---|---|---|
| **Core elements** | FORTRAN files with a stable job each | ephemeris (Sun, Moon, Earth rotation); trajectory legs (conic, circular, powered descent); projection and the pen (clipping, dashing, `vbuf` emission); text records; vector and matrix math | Rarely; they are the engine |
| **Layer elements** | One FORTRAN file per drawable layer, each a subroutine with the same argument list, called by a dispatcher from the phase's layer list | stars, Sun, Earth, Moon and craters, vehicle models, window outlines and cabins, LPD, tracks | A new file, an id, and one line in the dispatcher. Restoration layers live in their own files, fenced `RESTOMOD` |
| **Data modules** | Tables in `data/`, turned into `BLOCK DATA` by `tools/gen_data.py` | mission run decks; vehicle and cabin models (vertices, edges, faces); star, coastline and crater catalogs | A data file, with no code change |
| **Page modules** | Separate JavaScript sources joined by `tools/assemble.py` into the single page | recorder renderer and film effects; control groups and the control pad; modes (Attract, Tour, Live, Free-look, Beam, later Batch); captions | A source file and its registration |

The dispatcher uses what FORTRAN 66 has, a computed `GO TO` over layer ids, and needs no procedure pointers.

### The elements against MSC's own description

TN D-6853 describes VIEW in parts. It was "the augmentation of a somewhat dormant computer program" first written for Gemini rendezvous studies (p.2). "The program consists of two basic parts: the integrator portion and the graphic-display portion" (p.3). For Apollo, "the basic changes and modifications to the original program ... were associated with the input/output options, coordinate transformations, lunar- and solar-ephemeris installation, three-dimensional-display problems, and realistic spacecraft-window outlines" (p.3).

Our kernel elements line up with those parts:

| TN D-6853 (p.3) | Our elements |
|---|---|
| the integrator portion | `traj.f`: trajectory legs, now conic and circular models; later driven by the run decks |
| the graphic-display portion | `pen.f` and the layer elements (`lframe.f`, `lstars.f`, `lsun.f`, `lmoon.f`, `learth.f`, `lvehic.f`, …), called by `vlayer.f` |
| lunar- and solar-ephemeris installation | `ephem.f` |
| coordinate transformations | `vmath.f`, and the frames set up in `vdrive.f` |
| three-dimensional-display problems | `pen.f` (projection, clipping, hidden lines) and `models.f` |
| realistic spacecraft-window outlines | window and cabin models, to come |
| input/output options | `vtext.f`, the plot-tape buffers and the run decks |

This table is our reading. The report names functions and modifications, not files, and no source says how VIEW's code was divided. It does describe a program changed piece by piece for a new mission. On the 1108, such a program was put together from separate elements by the Collector. So we keep the report's decomposition and make the seams explicit, and the modern parts of that (fixed interfaces, data-driven layers and decks) are restorations like any other.

The seam between kernel and page stays the plot tape: `vbuf`, `sbuf`, `lbuf`, `tbuf`, `hdr`. Conjecture, not yet decided: tagging each vector with its layer id would let the page restyle or hide a layer without a kernel call.

The split is a refactor with no change in behaviour. The gate is that every scene renders identically before and after: the wasm-vs-JS selftest, plus the native SVG renders from `make check` compared byte for byte.

## Directions to consider

Ideas we have not committed to. They shape design choices now, such as keeping room in the run deck for new event kinds, but are not scheduled.

- **Photographs in place.** A crew photograph with a known time becomes an event in the mission's run deck. The deck records the photo ID, g.e.t., camera and lens, window, and pointing where known. The page jumps to that moment and overlays the photograph on the vector frame with an opacity control. Where the pointing is unknown, free-look aligns it by hand. For fields under 100° our projection is gnomonic, the same mapping as a rectilinear camera lens, so a correct time, position, pointing and field of view should register the photograph line for line. That makes each photograph a fidelity test of the trajectory as well as an exhibit. The first case is AS08-14-2383, the Apollo 8 Earthrise: 16:39:39.7 UTC over 11.15°S 113.80°E, per NASA SVS 4129 (svs.gsfc.nasa.gov/4129), taken with a 250 mm Hasselblad lens (Apollo 8 Flight Journal). The photographs and their overlay are a restoration; VIEW's own frames were preflight predictions (TN D-6853, p.3).

- **Launch and staging.** Mark lift-off, S-IC cutoff and separation, tower jettison, S-II and S-IVB cutoffs and orbit insertion as run-deck events, with the times from SP-4029 *Apollo by the Numbers*. The Apollo 11 note has no launch views, so any launch view would be a restoration.

## Order of work

1. Transposition & docking, with a reusable vehicle-model system (in progress).
2. Page: split the template into page modules, then add collapsible control groups and an on-screen control pad as modules.
3. Kernel: split `src/view.f` into core and layer elements with a layer dispatcher, output identical before and after (done: 18 elements, `src/vdrive.f` first).
4. Kernel: per-mission epoch and the first run decks (Apollo 11 from the current constants, then Apollo 8); CSM model; CM and LM cabins.
5. Apollo 8 Earthrise (issue #2).
6. Apollo 11 CM-window burn views: entry, TLI, TEI, LOI. MSC IN 69-FM-197 has 18 pages to match against.
7. Orbit-path and ground-track toggles.
8. Page: mission → phase selector.

Batch mode (issue #1) comes after these. With missions as decks, a batch run becomes "print this mission's reel".
