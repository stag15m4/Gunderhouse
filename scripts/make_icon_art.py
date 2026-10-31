#!/usr/bin/env python3
"""
Build public/brand/icon-art.png, the input make_icon.py expects.

make_icon.py is shared verbatim across every app in the suite, and it loads art
as RGB — it discards any alpha channel, because it expects a picture of the
mark already sitting on a dark background and feathers the rectangle edge so it
melts into the tile.

Gunderhouse's mark.webp is RGBA with a transparent surround, so handing it over
directly renders a grey box: the transparent pixels carry RGB (121, 121, 120)
underneath. This prepares a source that suits the shared script instead of
forking the shared script to suit this source.

    python3 scripts/make_icon_art.py
    python3 scripts/make_icon.py --art public/brand/icon-art.png \\
        --out public/icons --coverage 0.98

Two jobs beyond flattening, because the source carries a wide, cloudy white
haze around the mark that reads as grey smoke on a near-black plate:

  1. Remove the haze by SHAPE, not by brightness. A top-hat transform keeps
     features narrower than --haze-size (strokes, the steps under the G) and
     discards broad smooth fields (the haze). An earlier version cut everything
     under a fixed alpha, which also deleted the soft edges of the steps. A
     colour-based cut didn't work either: the haze is gold-tinted in places, so
     it can't be told from the real gold by saturation.

  2. Put a glow back on purpose. The sibling icons have a warm halo; a
     blurred, gold-tinted copy of the cleaned mark gives Gunderhouse the same
     one, without the accidental grey cloud.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PLATE = np.array([10, 10, 10], np.float32)  # #0a0a0a, the locked tile colour
GOLD = np.array([201, 160, 76], np.float32)  # #C9A04C, the template's mid gold

HAZE_SIZE = 21  # px, odd. Wider than any stroke in the mark (the G is ~14px)
NOISE_KNEE = 0.08  # drop residual alpha below this: grain and the stray speck
GLOW = 0.65  # strength of the gold halo, 0 for none
GLOW_SIGMA = 0.035  # blur radius, as a fraction of the mark's width
MARGIN = 0.12  # padding, as a fraction of the mark's width
TARGET = 0.79  # mark width as a fraction of the icon, per the template


def remove_haze(alpha: np.ndarray, size: int, knee: float) -> np.ndarray:
    """Keep what is narrower than `size`; discard broad smooth fields."""
    img = Image.fromarray((alpha * 255).astype("uint8"))
    opened = img.filter(ImageFilter.MinFilter(size)).filter(ImageFilter.MaxFilter(size))
    detail = np.clip(alpha - np.array(opened).astype(np.float32) / 255.0, 0.0, 1.0)
    # Boost slightly: the top-hat shaves a little off the thickest strokes.
    detail = np.clip(detail * 1.15, 0.0, 1.0)
    return np.clip((detail - knee) / (1.0 - knee), 0.0, 1.0)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--src", default="public/brand/mark.webp")
    ap.add_argument("--out", default="public/brand/icon-art.png")
    ap.add_argument("--haze-size", type=int, default=HAZE_SIZE)
    ap.add_argument("--knee", type=float, default=NOISE_KNEE)
    ap.add_argument("--glow", type=float, default=GLOW)
    ap.add_argument("--glow-sigma", type=float, default=GLOW_SIGMA)
    ap.add_argument("--margin", type=float, default=MARGIN)
    args = ap.parse_args()

    if args.haze_size % 2 == 0:
        raise SystemExit("--haze-size must be odd")

    src = np.array(Image.open(Path(args.src)).convert("RGBA")).astype(np.float32)
    rgb, alpha = src[..., :3], src[..., 3] / 255.0

    alpha = remove_haze(alpha, args.haze_size, args.knee)

    ys, xs = np.where(alpha > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb, alpha = rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]
    h, w = alpha.shape

    # The glow lives in the margin, so the margin has to be wide enough for it
    # to fade out before make_icon.py's edge feather reaches it.
    pad = int(round(w * args.margin))
    H, W = h + 2 * pad, w + 2 * pad
    A = np.zeros((H, W), np.float32)
    A[pad : pad + h, pad : pad + w] = alpha
    RGB = np.zeros((H, W, 3), np.float32)
    RGB[pad : pad + h, pad : pad + w] = rgb

    canvas = np.tile(PLATE, (H, W, 1))
    if args.glow > 0:
        blurred = np.array(
            Image.fromarray((A * 255).astype("uint8")).filter(
                ImageFilter.GaussianBlur(args.glow_sigma * w)
            )
        ).astype(np.float32) / 255.0
        g = np.clip(blurred * args.glow, 0.0, 1.0)[..., None]
        canvas = canvas * (1 - g) + GOLD * g
    A3 = A[..., None]
    canvas = canvas * (1 - A3) + RGB * A3

    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(canvas, 0, 255).astype("uint8")).save(path)

    # --coverage measures the whole art rectangle, padding included, so it has
    # to be scaled up for the mark itself to land at TARGET of the icon.
    coverage = min(1.0, TARGET * (W / w))
    print(f"wrote {path}  {W}x{H}   (mark {w}x{h}, margin {args.margin:.0%})")
    print(f"  haze {args.haze_size}px · knee {args.knee} · glow {args.glow} "
          f"· sigma {args.glow_sigma}")
    print(f"  run make_icon.py with --coverage {coverage:.2f}")


if __name__ == "__main__":
    main()
