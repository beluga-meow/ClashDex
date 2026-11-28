#!/usr/bin/env python3
"""Builds assets/heroes/encyclopedia-banner.webp (1320x480) from the six hero
portraits already in the repository. No external art is downloaded.

Usage: python3 tools/make-banner.py
Requires: Pillow
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
HEROES = [
    "barbarian-king",
    "archer-queen",
    "grand-warden",
    "royal-champion",
    "minion-prince",
    "dragon-duke",
]
WIDTH, HEIGHT = 1320, 480
OUT = ROOT / "assets" / "heroes" / "encyclopedia-banner.webp"


def background():
    """Night-sky gradient with a warm glow behind the middle portrait."""
    base = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(base)
    top = (13, 30, 54)
    bottom = (32, 18, 8)
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        draw.line(
            [(0, y), (WIDTH, y)],
            fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)),
        )
    glow = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        (WIDTH // 2 - 420, HEIGHT - 300, WIDTH // 2 + 420, HEIGHT + 60),
        fill=(120, 74, 20),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    return Image.blend(base, Image.blend(base, glow, 0.55), 0.9)


def portrait(name, box):
    art = Image.open(ROOT / "assets" / "heroes" / f"{name}.webp").convert("RGBA")
    art.thumbnail((box, box), Image.LANCZOS)
    # Rounded sound-holes so the square source art reads as a medallion instead
    # of six pasted squares; the gold rim is drawn on top in main().
    mask = Image.new("L", art.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, art.width - 1, art.height - 1), radius=28, fill=255)
    art.putalpha(mask)
    return art


def main():
    canvas = background().convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    slot = WIDTH // len(HEROES)  # 220
    for index, name in enumerate(HEROES):
        art = portrait(name, 190)
        # Middle portraits sit a little higher, the outer ones lower.
        offset = abs(index - (len(HEROES) - 1) / 2)
        y = 80 + round(offset * 16)
        x = round(index * slot + (slot - art.width) / 2)
        shadow = Image.new("RGBA", art.size, (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 120), (0, 0), art.split()[3])
        canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12)), (x + 6, y + 14))
        canvas.alpha_composite(art, (x, y))
        draw.rounded_rectangle(
            (x - 2, y - 2, x + art.width + 1, y + art.height + 1),
            radius=30,
            outline=(247, 184, 35, 235),
            width=4,
        )

    canvas.convert("RGB").save(OUT, "WEBP", quality=88, method=6)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KiB)")


if __name__ == "__main__":
    main()
