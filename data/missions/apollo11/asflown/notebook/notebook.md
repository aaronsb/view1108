# Apollo 11 as flown: scenario notebook

This notebook is ours. It is a note of the kind MSC IN 69-FM-197 was, "Revision 1 to Views from the CM and LM During the Flight of Apollo 11 (Mission G)", A. N. Lunde, Flight Analysis Branch, 3 July 1969, whose stated purpose was "to visually depict various aspects of the Apollo 11 (Mission G) lunar landing mission" (printed p. 5), made with "the major analytical tool ... developed by Mr. G. B. Roush of the Computation and Analysis Division" (p. 6). That note was drawn before the flight and "conforms with the latest nominal mission profile" (p. 5); this one goes with VIEW-1108's reconstruction of the mission as flown, the apollo11-asflown reel.

Each figure is our own render of this reel, made by the kernel at the case of its name in the figures block at the end, and labelled "our render". The situations, their default times, fields and sources are on the cards of the reel's deck (`asflown.scn`) and are not repeated here; a situation is named by its number and NAME in that deck. Where the reconstruction departs from the record, the departure is ours and is said to be.

## Earth parking orbit and translunar injection: situation 3, EARTH LIMB

The program's experience report, TN D-6853, gives the analysts' aim for translunar injection: "a method was sought to enable the crewmen to obtain information needed to support a go/no-go decision for TLI based on out-the-window determination of attitude relative to the crew optical alinement sight and the Earth horizon (or features)", because "multiple TLI ignition opportunities precluded ground-dependent monitoring and evaluation techniques" (TN D-6853, printed pp. 2-3). The Apollo 11 note drew the burn's beginning, middle and end, and observed that "the horizon is dark until shortly before the end of the burn, at which time the terminator can be seen" (MSC IN 69-FM-197, p. 14).

Its maneuver views had a format of their own: "The CM left rendezvous window has been superimposed on these views to indicate the view available to the commander while he is in a restrained couch position during a burn" (p. 6), the x at the centre "denotes the projection of the CM X-axis" (p. 6), and "all the views of the critical maneuvers have a field of view of 100°, although the crew does not have such a large field of view" (p. 13).

![Our render: the CM station at TLI ignition in the note's maneuver format, the left rendezvous window's two outlines, the X-axis x, named navigation stars, and the Earth's horizon across the lower frame](figures/tli-cm.svg)

The figure takes that format from the CM station view. Its aim is ours: the reconstruction models no burn attitude, so the station looks where situation 3's camera points, and situation 3 draws the Earth without night shading. It shows the format, not the crew's view at ignition.

## Transposition and docking: situation 7, TRANSPOSITION AND DOCKING

After separation from the S-IVB the command and service modules turned around and docked with the LM, which was still on the stage. The mission report: the transposition was "scheduled to begin 20 seconds after spacecraft separation from the S-IVB", the autopilot stopped pitching up and had to be taken back by hand, so that "the spacecraft reached a maximum separation distance of at least 100 feet from the S-IVB", and "contact was made at an estimated 0.1 ft/sec, without side velocity, but with a small roll misalignment" (Apollo 11 Mission Report, MSC-00171, printed p. 4-2).

VIEW could draw this kind of scene: its appendix lists outlines of "the CSM, LM, and the S-IVB" at their apparent size "when viewed from a different vehicle", and "hidden-line models of the LM and the S-IVB" (TN D-6853, p. 12). The Apollo 11 note's contents list no docking views, so this situation has no period answer key (our reading of the note's contents, pp. iii-iv).

![Our render: the CSM's COAS view down onto the LM's top in the S-IVB adapter, hidden lines removed, a few stars beyond](figures/docking.svg)

The approach's start, closing rate, attitude and the COAS offset are ours.

## Translunar coast: situation 8, DOCKED STACK

Situation 8, the docked stack seen from outside, is a modern addition: VIEW drew vehicles as seen from another vehicle (TN D-6853, p. 12), not from a point outside both. The period views of this phase are of the Earth and the Moon. The note drew the Earth "every hour during the coast period" to "determine which part of the world can be seen from the spacecraft", and the Moon "almost totally dark" on the way out (MSC IN 69-FM-197, p. 15); the report adds that such views "were useful for crewmember orientation during television transmissions from space" (TN D-6853, p. 8). We draw no figure for this phase here.

## Lunar orbit: situation 1, EARTHRISE

Lunar orbit insertion was flown with the LM docked, and the note found that "because of the obstruction caused by the docked LM, the views from the rendezvous windows are severely limited" (MSC IN 69-FM-197, p. 15); the same question had come up for Apollo 10 (TN D-6853, p. 4). The Apollo 8 notebook carries an insertion figure; this one does not.

Situation 1 is the film clip's first shot, an Earthrise over craters drawn as ellipses (README, "The film and the reconstruction"; the clip's archive source is unknown). Its revolution and time are ours. Views of this kind served photography: the note expected its coast views to "prove useful for photography purposes" (p. 6), and the report says the program "has been used in preflight and postflight photographic planning and evaluation" (TN D-6853, p. 8).

![Our render: the Earth just clear of the lunar horizon, its night side hatched with shading lines, gazetteer craters as ellipses in the foreground](figures/earthrise-clear.svg)

The figure is a little over a minute after the situation's default time, when the Earth's disc has just cleared the horizon (our choice of moment). The night side's shading lines are the report's convention ("the terminator was shown with shading lines to indicate the darkened portions", TN D-6853, p. 3). The report has circular craters appear as ellipses "as the descent is simulated" (p. 12); drawing the Earthrise's craters that way is ours.

## Undocking and the LM inspection: situation 4, LM RENDEZVOUS

After undocking the CSM backed off to "the desired inspection distance of 40 feet", and "a visual inspection by the Command Module Pilot during a lunar module 360-degree yaw maneuver confirmed proper landing gear extension" (Apollo 11 Mission Report, p. 4-7). Seeing one vehicle from the other was among VIEW's listed capabilities: with two trajectories integrated, "a determination can be made whether or not the secondary vehicle is visible through a window of the optical system of the primary vehicle" (TN D-6853, p. 12).

![Our render: the LM with its gear down, turning in place, seen from the CSM's window soon after undocking](figures/pirouette.svg)

Situation 4 follows the film clip's third shot. Its LM stands off farther than the report's 40 feet; the distance, the turn and the time are ours.

## Powered descent: situation 5, LM DESCENT

The report calls "the production of detailed preflight views for the crucial lunar descent and landing phases" "perhaps the most important application of this program", and says the results "were promising, not only because of the uniqueness of these descent views, but because the Apollo 11 crewmen had elected to begin the descent with the LM windows face down. In that attitude, the lunar terrain was visible, and the view of the terrain could be used to evaluate ignition-time errors and burn progress. Subsequently, the LM was yawed in the direction of the Earth to a forward-facing direction for final descent and landing" (TN D-6853, pp. 4 and 7). The mission report confirms the use: the descent "was initiated in a face-down attitude to permit the crew to make time marks on selected landmarks", and "a landing-point-designator sighting on the crater Maskelyne W was approximately 3 seconds early" (Apollo 11 Mission Report, p. 5-4).

The note warned that after the yaw "the crew loses sight of the moon until about 444 seconds into the PDI burn", and that once the horizon was in the front windows "very few craters are visible because of the flatness of the approach area to landing site 2" (MSC IN 69-FM-197, p. 15). The window outlines, "the lunar landing-point designator (LPD) and overhead docking scribe" were taken from engineering drawings of the LM windows into the program (TN D-6853, p. 7), and one of the report's closing uses is "confirmation of trajectory progress during lunar descent and ascent through observed crater movement across the landing-point designator" (p. 11).

![Our render: the commander's left front window and LPD scale early in the reconstructed approach, the horizon low in the window, the DPS BURN record and secondary labels](figures/descent.svg)

![Our render: the same window near the end of the reconstructed approach, the LM nearly upright and the horizon high on the LPD scale](figures/descent-late.svg)

Situation 5 follows the film clip's fourth shot. Its descent profile is ours, fitted to the film's descent frames, and is not the one flown (comment at LMDESC in `src/traj.f`): the pitch and the horizon's place on the scale come from that fit, not from the mission's records. The DPS BURN record in the first figure is a modern addition (CLAUDE.md, Burn cue).

## The landing site: situation 6, MOON VIEW

Situation 6 is a modern addition: the whole disc from above the sub-observer point, the maria by their gazetteer circles and the landing site as a boxed X. The nearest period kind we know of is the note's enlarged views of the Moon in translunar coast (figure 5.2.2-2; MSC IN 69-FM-197, p. 15; our comparison).

![Our render: the Moon's whole disc at touchdown, selenographic north up, the terminator and night-side shading lines, named maria and the Apollo 11 landing site as a boxed X](figures/moon-view.svg)

## Transearth coast and Earth approach: situation 2, EARTH APPROACH

On the way home the note again drew the Earth and Moon at intervals, finding that "the moon is nearly three-quarters full as seen by the crew, and half of the earth facing the crew is in darkness" (MSC IN 69-FM-197, p. 16); its constant-field Earth views put a small disc inside the CM window outlines in a 50° field (figure 7.3.2-1, p. 207). For entry it named a horizon check on the window: "The angle between the spacecraft X-axis and the earth horizon is held at +31.7°, which can be monitored on the 31.7° scribe on the window" (p. 16).

![Our render: a small Earth disc among named stars at the situation's default time, its night side hatched over about half the disc](figures/approach.svg)

Situation 2 follows the film clip's second shot, the Earth growing in an inertially fixed field. Its times and field are ours; the reconstruction draws no window scribe.

## Sources

- C. T. Hyle and A. N. Lunde, *Apollo Experience Report: The Application of a Computerized Visualization Capability to Lunar Missions*, NASA TN D-6853, June 1972 (`reference/TN-D-6853_Hyle_Lunde_1972.pdf`; printed pages).
- A. N. Lunde, *Revision 1 to Views from the CM and LM During the Flight of Apollo 11 (Mission G)*, MSC Internal Note 69-FM-197, 3 July 1969, NASA-TM-X-69921, N74-71189 (`reference/MSC-IN-69-FM-197_Apollo11_views.pdf`; printed pages).
- *Apollo 11 Mission Report*, MSC-00171, November 1969, https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_MissionReport.pdf (printed pages).
- The film clip and the reconstruction: this repository's README.md and CLAUDE.md.

```figures
# name          | environment  | reel             | viewsvg arguments (situation GET yaw pitch roll fov flags)
tli-cm          | VIEW_VIEW=2  | apollo11-asflown | 3 9856.2 0 0 0 100
docking         |              | apollo11-asflown | 7
earthrise-clear |              | apollo11-asflown | 1 368115
pirouette       |              | apollo11-asflown | 4
descent         | VIEW_LABLV=2 | apollo11-asflown | 5 369600
descent-late    |              | apollo11-asflown | 5 369840
moon-view       |              | apollo11-asflown | 6
approach        |              | apollo11-asflown | 2
```
