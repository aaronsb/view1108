# Modes, scenes and controls

Every example below is a live link to the page. Links set the view for that visit only; they never overwrite the settings you have chosen yourself.

Base URL: https://aaronsb.github.io/view1108/

## Modes

| Mode | What it does | Example |
|---|---|---|
| **Attract** | Replays the four shots of the surviving VIEW film at the film's pace (about 36 s): Earthrise, Earth approach, LM pirouette, LM descent. Plays once on a fresh load, then hands over to Tour. | [?mode=attract](https://aaronsb.github.io/view1108/?mode=attract) |
| **Tour** | A slow loop through every scene, a few minutes each, with a caption naming the shot and its g.e.t. Loops forever. | [?mode=tour](https://aaronsb.github.io/view1108/?mode=tour) |
| **Live** | The Apollo 11 mission clock at 1× (or 10×, 60×, 300×, 1000×). The scene follows the mission phase from the g.e.t.: Earth parking orbit until 2:50:00, translunar coast until 75:50:00, lunar orbit until 135:24:00, then transearth coast. The transposition and docking, the LM rendezvous and the descent are jump windows. | [Live at touchdown](https://aaronsb.github.io/view1108/?mode=live&get=102:45:40) |
| **Free-look** | Time paused or running at a chosen speed; look anywhere at the current moment. Any drag, wheel or key in Attract or Tour switches to Free-look and keeps the view. | [A frozen Earthrise](https://aaronsb.github.io/view1108/?mode=free&scene=1&get=102:20:06&fov=8) |
| **Beam** | Traces each frame vector by vector, in the kernel's output order, on a phosphor that fades, with a beam spot on the pen. The mission clock advances one frame at a time, by however long the frame took to draw. | [Slow trace of the Earth](https://aaronsb.github.io/view1108/?mode=beam&scene=2&bspeed=3) |

### Beam speeds (`bspeed`)

| `bspeed` | Name | Rate | Example |
|---|---|---|---|
| 1 | 1108 + recorder (est.) | about 1.3 s of computing, then about 13,000 vectors/s | [bspeed=1](https://aaronsb.github.io/view1108/?mode=beam&scene=1&bspeed=1) |
| 2 | Recorder only (est.) | about 13,000 vectors/s | [bspeed=2](https://aaronsb.github.io/view1108/?mode=beam&scene=1&bspeed=2) |
| 3 | Slow trace | 1,000 vectors/s | [bspeed=3](https://aaronsb.github.io/view1108/?mode=beam&scene=5&bspeed=3) |
| 4 | Persistence | a whole frame in about 1/15 s | [bspeed=4](https://aaronsb.github.io/view1108/?mode=beam&scene=2&bspeed=4) |

Speeds 1 and 2 are our estimates, worked out in [univac-1108.md](univac-1108.md). No source gives the recorder's vector rate.

## Scenes

| # | Scene | What you see | Example |
|---|---|---|---|
| 1 | Earthrise | The CSM in 60 n.mi. lunar orbit looking at the horizon; the Earth rises over the limb, night side hatched. | [scene=1](https://aaronsb.github.io/view1108/?mode=free&scene=1&get=102:20:06) |
| 2 | Translunar / transearth coast | The Earth among the stars. Near entry interface (195:03:06) it grows to a limb arc. | [Earth approach](https://aaronsb.github.io/view1108/?mode=free&scene=2&get=190:00:00&fov=60) |
| 3 | Earth limb | The limb from the 100 n.mi. parking orbit. | [scene=3](https://aaronsb.github.io/view1108/?mode=free&scene=3&get=5400) |
| 4 | LM rendezvous | The LM wireframe turning in place after undocking, 300 ft from the CSM. | [scene=4](https://aaronsb.github.io/view1108/?mode=free&scene=4) |
| 5 | LM descent | The commander's front window with the LPD scale; the horizon rises as the LM pitches over. | [scene=5](https://aaronsb.github.io/view1108/?mode=free&scene=5&get=102:44:00) |
| 6 | Moon view | The whole Moon from 35,000 km; drag to spin it. Maria, craters, the terminator and the landing site. A modern addition, not reconstructed 1969 output. | [scene=6](https://aaronsb.github.io/view1108/?mode=free&scene=6) |
| 7 | Transposition & docking | Through the CSM's docking sight, down onto the LM stowed on the S-IVB, closing from 100 ft to docking at 3:24:03. Hidden-line LM and S-IVB. | [scene=7](https://aaronsb.github.io/view1108/?mode=free&scene=7) |

### Scene 7 sources and guesses

Sourced: separation at 3:17:04.6 and docking at 3:24:03.1 (Apollo 11 Mission Report MSC-00171, table 7-II, printed p. 7-9); "a maximum separation distance of at least 100 feet" and contact "at an estimated 0.1 ft/sec" (same report, printed p. 4-2); the S-IVB held "a fixed inertial attitude to provide a stable docking platform" (AS-506 launch vehicle flight evaluation report MPR-SAT-FE-69-9, printed p. 11-1), chosen so "the Sun will shine across the top of the LM" ([Apollo 11 Flight Journal](https://apollojournals.org/afj/ap11fj/03tde.html), commentary at 002:54:09); the SLA's upper panels were jettisoned at separation (same flight evaluation report, p. xxiii); the LM's landing gear stayed retracted until the crew manned the LM, the S-IVB and IU are 21.7 ft across, the SLA tapers from 260 in to 154 in over 28 ft, and the drogue sits in a 32 in tunnel ([Apollo 11 press kit](https://apollojournals.org/alsj/a11/A11_PressKit.pdf), printed pp. 88, 101, 103, 109). VIEW could draw "the vehicle outlines of the CSM, LM, and the S-IVB" and "hidden-line models of the LM and the S-IVB" (TN D-6853, printed p. 12).

Our guesses: the approach starting at 3:20:30 and its closing law; the attitude (stack axis square to the Sun, in the trajectory plane, frozen at 3:09:20); how the folded gear lay; the LM's height in the SLA; the 7 ft fixed SLA ring (from a secondary source); the COAS position, reticle and docking target. With this attitude the Earth is out of the 30° field; look around to find it.

Is the film's leg-less LM shot (film seconds 20.5 to 26) this view? We think not. From the CSM during the approach the LM is seen from above, down its docking axis, inside the S-IVB's 21.7 ft rim; the film shows the LM from the side, turning, with no S-IVB. What the film does share with this scene is the missing landing gear: the gear was extended once the crew manned the LM (press kit, printed p. 103), before the undocking at 100:12, so a gear-less LM is not what the crew saw then either. Our reading is that VIEW's LM hidden-line model simply had no legs.

## Toggles

| Toggle | Key | What it does | Default |
|---|---|---|---|
| Labels | button | Star, body and feature names, drawn by the recorder's character generator | on |
| Frame | button | Plot frame, ticks and tick numbers | on in framed shots |
| LM hidden lines | button | Draws the LM's (and in scene 7 the S-IVB's) hidden edges dashed instead of dropping them | off |
| Catalog | C | NAV: the 391-star navigation catalog as asterisks (37 named). FULL: every catalog star to V 4.5 as dots. TN D-6853 p. 12 describes both. | NAV |
| Bloom | B | CRT/film glow: a hairline core with a gaussian halo | on in Attract and Tour |
| Film jitter | J | Frame-to-frame registration wobble of the film | on in Attract and Tour |
| Dust | D | Specks and occasional scratches | on in Attract and Tour |
| Film rate | F | Presents frames at a steady 16 fps | on in Attract and Tour; off in Beam |
| Listing | button | The FORTRAN listing, dark terminal or LIGHT greenbar paper | dark |

## Keys

| Key | Action |
|---|---|
| Arrows / drag | Look (yaw, pitch); in the Moon view, spin the Moon |
| Wheel / pinch, `+` `-` | Field of view (1°–170°) |
| `Q` `E` | Roll |
| Space | Pause |
| `[` `]` | Slower / faster (the Live rate, the Beam speed, or the Free-look speed) |
| `R` | Reset the view |
| `1`–`7` | Scenes |
| `T` | Beam mode |
| `L` | Copy a link to the current view |
| `B` `J` `D` `F` `C` | Bloom, jitter, dust, film rate, catalog |

## Control pad

The Look group holds a pad of key caps that does what the keyboard does, for mouse and touch. Each cap shows its key.

| Cap | Key | Action | Repeats when held |
|---|---|---|---|
| `↑` `↓` `←` `→` | Arrows | Pitch up, pitch down, yaw left, yaw right (in the Moon view, spin the Moon) | yes |
| `Q` `E` | `Q` `E` | Roll left, roll right, 2° a step | yes |
| `+` ZOOM, `-` WIDE | `+` `-` | Narrow or widen the field of view by 10% | yes |
| `R` RESET | `R` | Reset the view | no |
| `[` SLOWER, `]` FASTER | `[` `]` | Slower / faster | no |
| `SPC` PAUSE | Space | Pause or play | no |

A press acts at once and leaves Attract or Tour for Free-look, as a key press does. A held cap repeats after 0.5 s, then about 30 times a second (our choice, near common desktop key-repeat settings). Each finger holds its own cap, so two can be held together. Pressing or dragging on the pad does not scroll or zoom the page.

## Control groups

Each control group (Mode, Look, Scene, Time, Display, Film, Listing and link) has a header: `[-]` shows the group is open, `[+]` shut; click or tap the header to change it. The page remembers each group's state in this browser. Until you change one, a screen 600 px wide or less opens only Mode and Look, and puts Look first, under the picture; a wider screen opens every group.

## Link parameters

| Parameter | Values | Example |
|---|---|---|
| `mode` | `attract`, `tour`, `live`, `free`, `beam` | `?mode=live` |
| `scene` | `1`–`7` (in Live, `4`–`7` pin that view; `1`–`3` follow the mission phase) | `?mode=free&scene=7` |
| `get` | g.e.t. as `h:mm:ss` or seconds | `?get=102:45:40` |
| `utc` | `YYYY-MM-DDTHH:MM:SS` (Apollo 11 lift-off 1969-07-16T13:32:00Z plus g.e.t.) | `?utc=1969-07-20T20:17:40` |
| `fov`, `yaw`, `pitch`, `roll` | degrees | `?fov=100&pitch=-10` |
| `rate` | Live `1`/`10`/`60`/`300`/`1000`; Free-look speed | `?mode=live&rate=60` |
| `bspeed` | `1`–`4` | `?mode=beam&bspeed=3` |
| `labels`, `frame`, `hidden` | `0`/`1` | `?labels=0` |
| `bloom`, `jitter`, `dust`, `fps` | `0`/`1` | `?bloom=0&jitter=0` |
| `catalog` | `nav`, `full` | `?catalog=full` |
| `listing` | `dark`, `light` | `?listing=light` |
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
