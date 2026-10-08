# Apollo 11 as flown: scenario notebook

PLACEHOLDER (ours): this stub exercises the notebook machinery (#29 slice c) and makes no claim about the mission; the cited notebook comes with #29 slice e. Each figure below is our own render of this reel at the case of its name in the figures block, made once by `tools/notebook.py` with the native driver, checked by the golden gate and packed as rendered.

![Our render: situation 1, EARTHRISE, at its default g.e.t.](figures/earthrise.svg)

![Our render: situation 5, LM DESCENT, at g.e.t. 102:40:00, secondary labels](figures/descent.svg)

```figures
# name     | environment  | reel             | viewsvg arguments (situation GET yaw pitch roll fov flags)
earthrise  |              | apollo11-asflown | 1
descent    | VIEW_LABLV=2 | apollo11-asflown | 5 369600
```
