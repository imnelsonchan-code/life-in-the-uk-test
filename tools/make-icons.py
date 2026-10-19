#!/usr/bin/env python3
"""Generate the home-screen icons from one simplified Union-Flag design.

    python3 tools/make-icons.py

Requires Pillow. Writes app/icons/*.png (the SVG beside them is hand-written and
is the same design, for the browser tab).
"""

from pathlib import Path

from PIL import Image, ImageDraw

NAVY = (1, 33, 105)  # --brand    #012169
RED = (200, 16, 46)  # --brand-2  #c8102e
WHITE = (255, 255, 255)

OUT = Path(__file__).resolve().parent.parent / "app" / "icons"


def flag(size, radius_ratio=0.0):
    """A square, simplified Union Flag: St George's cross over the saltires.

    Proportions follow the real flag (white saltire 1/10 of the height, red
    saltire 1/15, white cross 1/3, red cross 1/5), scaled to a square.
    """
    s = size
    img = Image.new("RGB", (s, s), NAVY)
    d = ImageDraw.Draw(img)

    # St Andrew's saltire, with St Patrick's narrower red saltire inside it.
    for xy in ([(0, 0), (s, s)], [(s, 0), (0, s)]):
        d.line(xy, fill=WHITE, width=round(s * 0.10))
    for xy in ([(0, 0), (s, s)], [(s, 0), (0, s)]):
        d.line(xy, fill=RED, width=round(s * 0.067))

    # St George's cross: a red cross with a white fimbriation either side.
    cw, hw = round(s * 0.333), round(s * 0.20)
    d.rectangle([s / 2 - cw / 2, 0, s / 2 + cw / 2, s], fill=WHITE)
    d.rectangle([0, s / 2 - cw / 2, s, s / 2 + cw / 2], fill=WHITE)
    d.rectangle([s / 2 - hw / 2, 0, s / 2 + hw / 2, s], fill=RED)
    d.rectangle([0, s / 2 - hw / 2, s, s / 2 + hw / 2], fill=RED)

    if radius_ratio:
        img = img.convert("RGBA")
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, s - 1, s - 1), radius=round(s * radius_ratio), fill=255
        )
        img.putalpha(mask)
    return img


def save(img, name):
    img.save(OUT / name, "PNG", optimize=True)
    print("wrote app/icons/" + name)


OUT.mkdir(parents=True, exist_ok=True)
# "any" icons: rounded like a launcher icon.
save(flag(192, 0.22), "icon-192.png")
save(flag(512, 0.22), "icon-512.png")
# Maskable: full bleed, because Android supplies its own mask.
save(flag(512), "icon-maskable-512.png")
# iOS applies its own rounding and dislikes transparency.
save(flag(180), "apple-touch-icon.png")
