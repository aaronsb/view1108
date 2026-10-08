# Mission photographs

Apollo 8 and Apollo 11 frames to compare against the renderer. Credit NASA/JSC; public domain.

Scans from the Apollo Flight Journal and Apollo Lunar Surface Journal (https://apollojournals.org),
the 4k scans where the journals have them. Reduced here to a long side of 2048 px, JPEG quality 85,
metadata stripped, orientation as scanned. Each frame's source URL is in `data/photos.tsv`. These are not packed:
`tools/photo_pack.py` reduces each frame with a situation to the copy its reel carries (1024 px, turned to its usual
presentation), `data/missions/<mission>/<scenario>/media/<frame>.jpg`, Fusion's photo events (#75).

`data/photos.tsv` holds the timing (g.e.t. or bracket, with its source and precision), lens,
magazine, window, the scene that best fits and what the sim lacks for each frame. The AS08-14-2383
time is from NASA SVS 4129 (https://svs.gsfc.nasa.gov/4129).
