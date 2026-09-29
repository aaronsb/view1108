#!/usr/bin/env python3
"""Build docs/media/film-vs-view1108.png: film frames (top row) against our page (bottom row).

Top row: reference/video_frames t04 t08 t15 t20 t22 t28 t35, top 60 px caption strip cropped.
Bottom row: web/view1108.html at the same film seconds, BLOOM on, jitter off, chrome hidden, captured
with headless Chromium, one call per frame:

    chromium --headless=new --no-sandbox --hide-scrollbars --window-size=800,900 \\
        --virtual-time-budget=4000 --screenshot=out.png \\
        'http://127.0.0.1:PORT/view1108.html?bare&film=N&jitter=0&bloom=1'

The script serves web/ itself on a free local port for the duration and stops the server after.
Set CHROMIUM to use another browser binary. Needs Pillow.
"""
import os, pathlib, socket, subprocess, sys, tempfile
from PIL import Image

R = pathlib.Path(__file__).resolve().parent.parent
TIMES = [4, 8, 15, 20, 22, 28, 35]
FRAMED = {4, 28, 35}                     # film seconds whose shot has the plot frame
TW, TH, G = 296, 271, 4                  # tile size and gutter (film crop 720x660 -> 296x271)
WIN_W, WIN_H = 800, 900
CHROMIUM = os.environ.get("CHROMIUM", "chromium")
OUT = R / "docs/media/film-vs-view1108.png"

if not (R / "web/view1108.html").is_file():
    sys.exit("film_sheet.py: web/view1108.html is missing (run make build)")

s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
server = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1",
                           "--directory", str(R / "web")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    # plot canvas width: the page sizes it to (window height - 190) / 1.10, capped by the window width
    W = int(min(WIN_W, (WIN_H - 190) / 1.10)); x0 = (WIN_W - W) // 2
    sheet = Image.new("RGB", (len(TIMES) * TW + (len(TIMES) - 1) * G, 2 * TH + G), (0, 0, 0))
    tmp = pathlib.Path(tempfile.mkdtemp())
    for i, t in enumerate(TIMES):
        film = Image.open(R / f"reference/video_frames/t{t:02d}.png").convert("RGB").crop((0, 60, 720, 720))
        sheet.paste(film.resize((TW, TH), Image.LANCZOS), (i * (TW + G), 0))
        shot = tmp / f"o{t}.png"
        url = f"http://127.0.0.1:{port}/view1108.html?bare&film={t}&jitter=0&bloom=1"
        for attempt in range(3):     # headless Chromium occasionally hangs; retry
            try:
                subprocess.run([CHROMIUM, "--headless=new", "--no-sandbox", "--hide-scrollbars",
                                f"--window-size={WIN_W},{WIN_H}", "--virtual-time-budget=4000",
                                f"--screenshot={shot}", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=40, check=True)
                break
            except subprocess.TimeoutExpired:
                if attempt == 2:
                    raise
        im = Image.open(shot).convert("RGB")
        box = (x0 + 0.04 * W, 0.11 * W, x0 + 0.96 * W, 0.955 * W) if t in FRAMED else (x0, 0.06 * W, x0 + W, 0.977 * W)
        sheet.paste(im.crop(tuple(int(v) for v in box)).resize((TW, TH), Image.LANCZOS), (i * (TW + G), TH + G))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, optimize=True)
    print(f"wrote {OUT} {sheet.size} {OUT.stat().st_size} bytes")
finally:
    server.terminate()
