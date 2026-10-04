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
        --out public/icons --coverage 0.88
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

PLATE = (10, 10, 10, 255)  # #0a0a0a, the locked tile colour

# The mark art carries a wide near-white glow at very low alpha — around 21,000
# pixels under alpha 60, averaging RGB (255, 254, 230). Invisible against a
# white page, and obvious grey haze on a near-black plate. Floor it and rescale
# what remains so genuine antialiased edges stay smooth rather than being cut
# to a hard line.
ALPHA_FLOOR = 96

# Padding around the trimmed mark, as a fraction of its size. make_icon.py
# feathers 5.3% in from the edge of whatever it is given, so the art needs a
# margin at least that wide or the feather eats into the mark itself.
MARGIN = 0.07


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", default="public/brand/mark.webp")
    ap.add_argument("--out", default="public/brand/icon-art.png")
    ap.add_argument("--alpha-floor", type=int, default=ALPHA_FLOOR)
    ap.add_argument("--margin", type=float, default=MARGIN)
    args = ap.parse_args()

    mark = Image.open(Path(args.src)).convert("RGBA")

    arr = np.array(mark).astype(np.float32)
    if args.alpha_floor:
        a = arr[:, :, 3]
        arr[:, :, 3] = (
            np.clip((a - args.alpha_floor) / (255.0 - args.alpha_floor), 0.0, 1.0)
            * 255.0
        )
    mark = Image.fromarray(arr.astype("uint8"), "RGBA")

    bbox = mark.getbbox()
    if bbox:
        mark = mark.crop(bbox)

    pad_w = int(mark.width * args.margin)
    pad_h = int(mark.height * args.margin)
    out = Image.new("RGBA", (mark.width + pad_w * 2, mark.height + pad_h * 2), PLATE)
    out.alpha_composite(mark, (pad_w, pad_h))

    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    out.convert("RGB").save(path)
    print(f"wrote {path}  {out.width}x{out.height}")
    print(f"  mark {mark.width}x{mark.height}, alpha floor {args.alpha_floor}, "
          f"margin {args.margin:.0%}")


if __name__ == "__main__":
    main()
