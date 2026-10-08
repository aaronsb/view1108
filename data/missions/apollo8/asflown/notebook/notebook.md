# Apollo 8 as flown: scenario notebook

This notebook is ours, written for VIEW-1108's reconstruction of Apollo 8 as flown, the apollo8-asflown reel. It follows the manner of MSC IN 69-FM-197, the bound volume of VIEW output for Apollo 11, but no such volume for Apollo 8 is among the documents we hold. The program's report says that VIEW began with this mission: "the development of a computerized capability to obtain this insight was undertaken before the Apollo 8 mission" (TN D-6853, printed p. 1), and "preflight views produced for the Apollo 8 mission included views as seen through the spacecraft windows during various critical maneuvers of the flight. These maneuvers were at TLI, LOI, transearth insertion (TEI), and the entry phase. In addition, views of the Earth and the Moon as they would appear from the spacecraft at various times during the mission were provided" (p. 3). We have none of those views, so the figures here use the Apollo 11 note's formats; that choice is ours.

Each figure is our own render of this reel, made by the kernel at the case of its name in the figures block at the end. The reel has one situation, 1 APOLLO 8 EARTHRISE; its times, field, fitted camera and sources are on its cards in the reel's deck (`asflown.scn`) and are not repeated here. Away from lunar orbit the situation's camera falls back to a view above the Earth's horizon (the deck says how), so the figures for the other phases use the CM station view or an Earth target, as the reel's follow track does (its SPAN cards).

## Translunar injection

The report puts TLI beside LOI: "in addition to the basic LOI objective, it was recognized that attitude information associated with translunar injection (TLI) was equally desirable for similar reasons", and "a method was sought to enable the crewmen to obtain information needed to support a go/no-go decision for TLI based on out-the-window determination of attitude relative to the crew optical alinement sight and the Earth horizon (or features)" (TN D-6853, p. 2), because "multiple TLI ignition opportunities precluded ground-dependent monitoring and evaluation techniques" (p. 3).

![Our render: the CM station at TLI ignition in the Apollo 11 note's maneuver format, the left rendezvous window's two outlines and the X-axis x, the Earth's horizon below with its night side drawn in shading lines](figures/tli-cm.svg)

The format is the Apollo 11 note's: the CM left rendezvous window "superimposed on these views to indicate the view available to the commander while he is in a restrained couch position during a burn", in a 100° field (MSC IN 69-FM-197, printed pp. 6 and 13). The aim is ours: the reconstruction models no burn attitude.

## Lunar orbit insertion

Lunar orbit insertion is where the program's full-scale development started: "Analytical work on an acceptable method for providing an out-the-window attitude check for the Apollo 8 lunar orbit insertion (LOI) maneuver prompted the original full-scale program-development effort" (TN D-6853, p. 2). The report gives the difficulties. "The LOI maneuver is performed behind the Moon, in a heads-down attitude, with the spacecraft gimbal angles referenced to another inertial attitude (with no obvious visible correlation)", and "because of terminator movement across the Moon during the monthly launch window, the surface of the Moon is not always visible at LOI ignition" (p. 2). The answer was a picture: "This view demonstrated for the first time that the information available to the crewmen could support an onboard go/no-go decision for LOI simply by verifying that the lunar horizon, as viewed from the window, was near a reference mark on the window" (p. 2).

![Our render: the CM station at LOI ignition in the same format, the lunar horizon across the frame just below the X-axis x, craters with their catalogue numbers, named stars and the Sun above](figures/loi-cm.svg)

The station looks where the situation's lunar-orbit camera points, not along the burn attitude, and the reconstruction draws no reference mark on the window; the horizon's place in the frame is ours. The labels on the lunar surface are the native driver's crater kind and catalogue index, which the page letters by name.

## Earthrise

NASA's Scientific Visualization Studio has reconstructed "the moment when the crew first saw and photographed the Earth rising from behind the Moon", working from vertical stereo photographs taken through a rendezvous window, and found that "the spacecraft was rolling when the photos were taken, and that it was this roll that brought the Earth into view" (NASA SVS 4129, *Earthrise: The 45th Anniversary*, https://svs.gsfc.nasa.gov/4129). It names three Earthrise photographs, AS08-13-2329, AS08-14-2383 and AS08-14-2384, and places them at frames 1092, 2814 and 3545 of a frame set that starts at 75:47:06 and runs at 30 frames a second (the page's "47 seconds (1410 frames)").

![Our render: the situation's fitted camera at the time of AS08-13-2329, the Earth's disc just clearing the lunar horizon](figures/earthrise-first.svg)

![Our render: the situation at its default, the moment of AS08-14-2383, the Earth clear of the horizon with its night side hatched](figures/earthrise.svg)

The first figure's time is our arithmetic from those frame numbers; the same arithmetic puts AS08-14-2383 within 0.1 s of the situation's own time. The situation's camera is fitted to AS08-14-2383 alone. The crew took AS08-13-2329 while the spacecraft rolled (SVS 4129), so the first figure keeps the fitted aim and shows only where the Earth stood a minute earlier, not that photograph's framing.

## Transearth coast

On the way home the program's Earth views showed which side of the Earth faced the crew. The report allows one limit: "the Earth terminator could not be duplicated accurately because of the atmospheric scattering of light" (TN D-6853, p. 4). The Apollo 11 note drew its transearth Earth views in a constant 50° field with the CM window outlines (MSC IN 69-FM-197, figure 7.3.2-1, p. 207), and this reel's follow track uses that field on the coast.

![Our render: the window view aimed at the Earth a little over two hours before entry interface, a 50° field, the Americas on the disc and its night side hatched](figures/transearth.svg)

The moment and the Earth target are ours. The figure has no window outline: that belongs to the CM station view.

## Transearth injection and entry

The report lists TEI and the entry phase among the Apollo 8 maneuver views (TN D-6853, p. 3). The reel's follow track carries the CM station through the TEI burn and an external view through entry (its SPAN cards); this notebook draws no figure of them.

## Sources

- C. T. Hyle and A. N. Lunde, *Apollo Experience Report: The Application of a Computerized Visualization Capability to Lunar Missions*, NASA TN D-6853, June 1972 (`reference/TN-D-6853_Hyle_Lunde_1972.pdf`; printed pages).
- A. N. Lunde, *Revision 1 to Views from the CM and LM During the Flight of Apollo 11 (Mission G)*, MSC Internal Note 69-FM-197, 3 July 1969, NTRS 19740073250 (`reference/MSC-IN-69-FM-197_Apollo11_views.pdf`; printed pages).
- NASA Scientific Visualization Studio, *Earthrise: The 45th Anniversary*, ID 4129, 20 December 2013, https://svs.gsfc.nasa.gov/4129.

```figures
# name          | environment   | reel            | viewsvg arguments (situation GET yaw pitch roll fov flags)
tli-cm          | VIEW_VIEW=2   | apollo8-asflown | 1 10237.79 0 0 0 100
loi-cm          | VIEW_VIEW=2   | apollo8-asflown | 1 248900.4 0 0 0 100
earthrise-first |               | apollo8-asflown | 1 272862.4
earthrise       |               | apollo8-asflown | 1
transearth      | VIEW_TARGET=1 | apollo8-asflown | 1 520000 0 0 0 50
```
