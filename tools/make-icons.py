#!/usr/bin/env python3
"""Generate the home-screen icons from one simplified Union-Flag design.

    python3 tools/make-icons.py

Requires Pillow. Writes app/icons/*.png (the SVG beside them is hand-written and
is the same design, for the browser tab).
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

NAVY = (1, 33, 105)  # --brand    #012169
RED = (200, 16, 46)  # --brand-2  #c8102e
WHITE = (255, 255, 255)

OUT = Path(__file__).resolve().parent.parent / "app" / "icons"
FONT = Path("/usr/share/fonts/truetype/dejavu")


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


def og_image():
    """The 1200x630 card search engines and chat apps show when the site is
    linked (og:image / twitter:image). Navy panel on the left, the flag on the
    right, the promise of the app spelled out in between."""
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)

    # A flag panel on the right, with a thin white rule between it and the text.
    panel = flag(430)
    img.paste(panel, (W - 430 - 70, (H - 430) // 2))
    d.rectangle([W - 430 - 100, 90, W - 430 - 96, H - 90], fill=(255, 255, 255))

    bold = ImageFont.truetype(str(FONT / "DejaVuSans-Bold.ttf"), 62)
    body = ImageFont.truetype(str(FONT / "DejaVuSans.ttf"), 33)
    small = ImageFont.truetype(str(FONT / "DejaVuSans.ttf"), 26)

    x = 76
    d.text((x, 150), "Life in the UK Test", font=bold, fill=WHITE)
    d.text((x, 232), "practice questions & mock tests", font=body, fill=(214, 222, 244))
    for i, line in enumerate(["716 original questions", "24-question timed mocks", "4, 2 and 1-week study plans", "free, offline, no account"]):
        d.text((x + 2, 320 + i * 44), "•  " + line, font=small, fill=(178, 192, 226))

    return img


OUT.mkdir(parents=True, exist_ok=True)
# "any" icons: rounded like a launcher icon.
save(flag(192, 0.22), "icon-192.png")
save(flag(512, 0.22), "icon-512.png")
# Maskable: full bleed, because Android supplies its own mask.
save(flag(512), "icon-maskable-512.png")
# iOS applies its own rounding and dislikes transparency.
save(flag(180), "apple-touch-icon.png")
# The link preview card.
save(og_image(), "og.png")
