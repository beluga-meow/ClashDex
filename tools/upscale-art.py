#!/usr/bin/env python3
"""Upscale the small source art in assets/ so it stops looking soft on retina
phones. This is a cosmetic resample, not a recovery of detail: a 100px source
cannot contain information that a 400px file would need, so treat the output as
a sharper-looking stand-in.

What it does, per file:
  1. reads the image and separates alpha,
  2. alpha-bleeds the RGB under the transparent edge (stops dark halos after
     resampling),
  3. light denoise on the small source (fast non-local means, low strength),
  4. Lanczos upscale so the longest side reaches the target,
  5. two unsharp-mask passes (fine + coarse),
  6. re-thresholds the alpha edge so cut-outs stay crisp,
  7. writes the same file name in the same format.

It is idempotent: a file already at or above its target is skipped, so running
it twice does not upscale twice. Use --force to override that.

Only art that the pages render large is worth upscaling: the skin sheet and
the full-screen scenery previews. Equipment cards, scenery thumbnails and hero
portraits are displayed at 140-280px, so their small originals look fine and
upscaling them only adds weight. The default run therefore covers just the two
large-display groups; the other groups stay available for a deliberate run.

Usage:
    python3 tools/upscale-art.py                 # large-display groups only (default)
    python3 tools/upscale-art.py --only all      # every group (adds weight)
    python3 tools/upscale-art.py --only equipment
    python3 tools/upscale-art.py --dry-run
    python3 tools/upscale-art.py --force
    python3 tools/upscale-art.py --quality 90    # WebP/JPEG quality, default 92

Requires: Pillow and opencv-python (cv2 uses numpy).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:  # pragma: no cover - environment guidance
    sys.exit("Pillow is missing. Install it with: pip install pillow opencv-python-headless")

try:
    import cv2
    import numpy as np
except ImportError:  # pragma: no cover - environment guidance
    sys.exit("OpenCV is missing. Install it with: pip install pillow opencv-python-headless")

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# group -> (glob directory, target px on the longest side)
GROUPS = {
    "equipment": ("equipment", 400),
    "skins": ("skins", 560),
    "sceneries": ("sceneries", 560),
    "scenery-previews": ("sceneries/alternates", 800),
    "heroes": ("heroes", 568),
}

# Groups whose art is rendered at or near full width and therefore benefits
# from an upscale. Everything else is left at its original size.
LARGE_DISPLAY = ("skins", "scenery-previews")

SKIP_DIRS = {"adapters", "raw", "source"}
# The alternate scenery maps are full previews, handled by their own group so
# they get the larger 800px target instead of the 560px thumbnail target.
GROUP_SKIP = {"sceneries": {"alternates"}}


def alpha_bleed(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Fill the RGB just outside the visible edge with the nearest colour.

    Resampling transparent pixels that still hold black RGB produces a dark
    fringe, so the ring of transparent pixels touching the subject is painted
    with a blur of the subject instead.
    """
    if alpha.min() > 8:
        return rgb
    solid = (alpha > 8).astype(np.uint8) * 255
    edge = cv2.dilate(solid, np.ones((5, 5), np.uint8)) - solid
    if not edge.any():
        return rgb
    # Inpainting the thin ring is cheap and avoids smearing the whole canvas.
    return cv2.inpaint(rgb, edge, 3, cv2.INPAINT_TELEA)


def denoise(rgb: np.ndarray) -> np.ndarray:
    """Very light denoise: the source is small, so strong filtering kills it."""
    return cv2.fastNlMeansDenoisingColored(rgb, None, 2, 2, 5, 11)


def sharpen(image: Image.Image) -> Image.Image:
    """Two passes: a tight one for the resampled edges, a wide one for form."""
    first = image.filter(ImageFilter.UnsharpMask(radius=1.4, percent=90, threshold=2))
    return first.filter(ImageFilter.UnsharpMask(radius=2.8, percent=45, threshold=3))


def threshold_alpha(alpha: Image.Image) -> Image.Image:
    """Push near-transparent to 0 and near-opaque to 255 to keep a clean edge."""
    data = np.asarray(alpha, dtype=np.uint8).copy()
    low, high = 22, 232
    data[data < low] = 0
    data[data > high] = 255
    # Remap what is left so the soft edge stays soft but does not look muddy.
    middle = (data > 0) & (data < 255)
    if middle.any():
        scaled = (data[middle].astype(np.float32) - low) / max(1, high - low) * 255.0
        data[middle] = np.clip(scaled, 0, 255).astype(np.uint8)
    return Image.fromarray(data, "L")


def process(path: Path, target: int, force: bool, dry_run: bool, args_quality: int = 92) -> tuple[str, int, int]:
    with Image.open(path) as source:
        source.load()
        original_size = source.size
        fmt = (source.format or path.suffix.lstrip(".")).upper()
        if max(original_size) >= target and not force:
            return "skipped", 0, 0
        has_alpha = source.mode in ("RGBA", "LA") or "transparency" in source.info
        image = source.convert("RGBA" if has_alpha else "RGB")

    if dry_run:
        width = round(original_size[0] * target / max(original_size))
        height = round(original_size[1] * target / max(original_size))
        return "would upscale", width, height

    if has_alpha:
        rgb = np.array(image)[:, :, :3]
        alpha_img = image.getchannel("A")
        rgb = alpha_bleed(rgb, np.array(alpha_img))
        if max(original_size) < target * 2:
            rgb = denoise(rgb)
        scale = target / max(image.size)
        size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        rgb_up = Image.fromarray(rgb, "RGB").resize(size, Image.LANCZOS)
        alpha_up = threshold_alpha(alpha_img.resize(size, Image.LANCZOS))
        out = rgb_up.convert("RGBA")
        out.putalpha(alpha_up)
    else:
        rgb = np.array(image)
        if max(original_size) < target * 2:
            rgb = denoise(rgb)
        scale = target / max(image.size)
        size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        out = Image.fromarray(rgb, "RGB").resize(size, Image.LANCZOS)

    out = sharpen(out)

    save_kwargs = {}
    if fmt in ("JPEG", "JPG"):
        out = out.convert("RGB")
        save_kwargs = {"quality": 92, "optimize": True, "progressive": True}
    elif fmt == "WEBP":
        save_kwargs = {"quality": 92, "method": 6}
    elif fmt == "PNG":
        save_kwargs = {"optimize": True}
    if fmt in ("JPEG", "JPG", "WEBP"):
        save_kwargs["quality"] = args_quality
    out.save(path, fmt, **save_kwargs)
    return "upscaled", out.width, out.height


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", choices=sorted(GROUPS) + ["all", "large"], default="large")
    parser.add_argument("--force", action="store_true", help="re-process files already at target size")
    parser.add_argument("--quality", type=int, default=92, help="WebP/JPEG quality (default 92)")
    parser.add_argument("--dry-run", action="store_true", help="report what would change without writing")
    args = parser.parse_args()

    if args.only == "all":
        selected = GROUPS.items()
    elif args.only == "large":
        selected = [(group, GROUPS[group]) for group in LARGE_DISPLAY]
    else:
        selected = [(args.only, GROUPS[args.only])]
    totals = {"upscaled": 0, "skipped": 0, "would upscale": 0, "failed": 0}

    for group, (folder, target) in selected:
        directory = ASSETS / folder
        if not directory.is_dir():
            print(f"skip group {group}: {directory} does not exist")
            continue
        files = sorted(
            path for path in directory.rglob("*")
            if path.is_file()
            and path.suffix.lower() in {".webp", ".png", ".jpg", ".jpeg"}
            and not (set(part.lower() for part in path.relative_to(directory).parts) & SKIP_DIRS)
            and not (set(part.lower() for part in path.relative_to(directory).parts) & GROUP_SKIP.get(group, set()))
        )
        print(f"\n{group}: {len(files)} file(s) -> {target}px")
        for path in files:
            rel = path.relative_to(ROOT)
            try:
                status, width, height = process(path, target, args.force, args.dry_run, args.quality)
            except Exception as error:  # keep going: one bad file should not stop the batch
                totals["failed"] += 1
                print(f"  ! {rel}: {error}")
                continue
            totals[status] = totals.get(status, 0) + 1
            if status != "skipped":
                print(f"  {status}: {rel} -> {width}x{height}")

    print(
        f"\ndone — upscaled {totals['upscaled']}, skipped {totals['skipped']}, "
        f"would upscale {totals['would upscale']}, failed {totals['failed']}"
    )
    print(
        "Remember: upscaling cannot invent detail. If you get the original "
        "high-resolution files, drop them in with the same names and this script "
        "will leave them alone (they are already at or above the target size)."
    )


if __name__ == "__main__":
    main()
