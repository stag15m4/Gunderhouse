#!/usr/bin/env python3
"""
Generate the Gundersen app-icon set: a near-black tile with a thin metallic
gold border and the app's mark centred inside.

The constants below are shared across every app in the suite — Alfred, CMS,
Consultant, Legal, Laundroweb, Gunderhouse — and are what make the icons read
as a matched set on a home screen. Do not tune them per app. The only knob
meant to move is --coverage.

See docs/ICON_TEMPLATE.md.

    pip install Pillow numpy
    python3 scripts/make_icon.py --art public/brand/mark.webp --out public/icons
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

# --- locked constants --------------------------------------------------------
BG = (10, 10, 10, 255)  # #0a0a0a
GOLD_STOPS = (
    (0.0, (0xF2, 0xDD, 0x92)),
    (0.5, (0xC9, 0xA0, 0x4C)),
    (1.0, (0x86, 0x5F, 0x22)),
)
BORDER_WEIGHT = 0.030  # of icon side
BORDER_INSET = 0.012  # of icon side, outer edge of the stroke
CORNER_RADIUS = 0.225  # of icon side — matches the iOS squircle
SUPERSAMPLE = 3  # render big, downscale once, for clean edges


def gold_gradient(size: int) -> Image.Image:
    """Vertical three-stop metallic gold, top to bottom."""
    grad = Image.new("RGB", (1, size))
    px = grad.load()
    for y in range(size):
        t = y / max(1, size - 1)
        for i in range(len(GOLD_STOPS) - 1):
            t0, c0 = GOLD_STOPS[i]
            t1, c1 = GOLD_STOPS[i + 1]
            if t0 <= t <= t1:
                k = (t - t0) / (t1 - t0)
                px[0, y] = tuple(round(a + (b - a) * k) for a, b in zip(c0, c1))
                break
    return grad.resize((size, size), Image.NEAREST)


def load_mark(path: Path, crop: str | None, alpha_floor: int = 0) -> Image.Image:
    """The mark on transparency, trimmed to its own ink."""
    mark = Image.open(path).convert("RGBA")
    if crop:
        left, top, right, bottom = (int(v) for v in crop.split(","))
        mark = mark.crop((left, top, right, bottom))

    if alpha_floor > 0:
        # Logo art often carries a wide, near-white glow at very low alpha.
        # Invisible on a white page; on a near-black plate it reads as grey
        # haze around the mark. Drop everything under the floor and rescale
        # what remains, so genuine antialiased edges stay smooth instead of
        # being cut to a hard line.
        import numpy as np

        arr = np.array(mark).astype(np.float32)
        a = arr[:, :, 3]
        a = np.clip((a - alpha_floor) / (255.0 - alpha_floor), 0.0, 1.0) * 255.0
        arr[:, :, 3] = a
        mark = Image.fromarray(arr.astype("uint8"), "RGBA")
    # Trim to the real content so --coverage means the same thing regardless of
    # how much empty canvas the source art happened to carry.
    bbox = mark.getbbox()
    if bbox:
        mark = mark.crop(bbox)
    return mark


def render_tile(mark: Image.Image, side: int, coverage: float) -> Image.Image:
    """One tile at the given side length, rendered supersampled."""
    s = side * SUPERSAMPLE
    radius = CORNER_RADIUS * s
    border_px = max(1, round(BORDER_WEIGHT * s))
    inset = BORDER_INSET * s

    tile = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    # The plate.
    plate_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(plate_mask).rounded_rectangle(
        (0, 0, s - 1, s - 1), radius=radius, fill=255
    )
    tile.paste(Image.new("RGBA", (s, s), BG), (0, 0), plate_mask)

    # The gold border, stroked just inside the plate edge. Drawn as an outline
    # on its own mask so the gradient shows through only the stroke.
    border_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(border_mask).rounded_rectangle(
        (
            inset + border_px / 2,
            inset + border_px / 2,
            s - 1 - inset - border_px / 2,
            s - 1 - inset - border_px / 2,
        ),
        radius=max(1.0, radius - inset - border_px / 2),
        outline=255,
        width=border_px,
    )
    tile.paste(gold_gradient(s).convert("RGBA"), (0, 0), border_mask)

    # The mark, scaled to `coverage` of the width and centred. Height is
    # constrained too, so a tall mark can't overflow the frame.
    max_w = coverage * s
    max_h = coverage * s
    scale = min(max_w / mark.width, max_h / mark.height)
    art = mark.resize(
        (max(1, round(mark.width * scale)), max(1, round(mark.height * scale))),
        Image.LANCZOS,
    )
    tile.alpha_composite(art, ((s - art.width) // 2, (s - art.height) // 2))

    return tile.resize((side, side), Image.LANCZOS)


def flatten(img: Image.Image) -> Image.Image:
    """Opaque on the plate colour — what iOS wants for a touch icon."""
    base = Image.new("RGBA", img.size, BG)
    base.alpha_composite(img)
    return base.convert("RGB")


def render_maskable(mark: Image.Image, side: int, coverage: float) -> Image.Image:
    """
    Beyond the shared template, and deliberately so.

    Android crops a maskable icon to a circle, which would cut the gold border
    off entirely. This keeps the whole bordered plate inside the 80% safe zone
    on a filled background, so the frame survives the crop.
    """
    inner = round(side * 0.80)
    plate = render_tile(mark, inner, coverage)
    out = Image.new("RGBA", (side, side), BG)
    off = (side - inner) // 2
    out.alpha_composite(plate, (off, off))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--art", required=True, help="PNG/WebP of the mark")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument(
        "--crop",
        help="L,T,R,B pixel box isolating just the mark in a larger image",
    )
    ap.add_argument(
        "--alpha-floor",
        type=int,
        default=0,
        help="drop source alpha below this (0-254) to kill a glow baked into "
        "the art; 0 leaves the art untouched",
    )
    ap.add_argument(
        "--coverage",
        type=float,
        default=0.78,
        help="mark size as a fraction of icon width (the only knob to tune)",
    )
    args = ap.parse_args()

    if not 0.1 <= args.coverage <= 1.0:
        raise SystemExit("--coverage must be between 0.1 and 1.0")

    if not 0 <= args.alpha_floor <= 254:
        raise SystemExit("--alpha-floor must be between 0 and 254")

    mark = load_mark(Path(args.art), args.crop, args.alpha_floor)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    tile512 = render_tile(mark, 512, args.coverage)

    written = []

    def save(img: Image.Image, name: str) -> None:
        path = out / name
        img.save(path)
        written.append(f"{name}  {img.size[0]}x{img.size[1]}")

    save(flatten(render_tile(mark, 180, args.coverage)), "apple-touch-icon.png")
    save(flatten(render_tile(mark, 192, args.coverage)), "icon-192.png")
    save(flatten(tile512), "icon-512.png")
    save(flatten(tile512), "icon-tile-512.png")
    save(flatten(render_maskable(mark, 512, args.coverage)), "icon-maskable-512.png")

    fav32 = flatten(render_tile(mark, 32, args.coverage))
    fav16 = flatten(render_tile(mark, 16, args.coverage))
    save(fav32, "favicon-32.png")
    save(fav16, "favicon-16.png")

    ico = out / "favicon.ico"
    flatten(render_tile(mark, 48, args.coverage)).save(
        ico, sizes=[(16, 16), (32, 32), (48, 48)]
    )
    written.append("favicon.ico  16/32/48")

    print(f"mark {mark.width}x{mark.height} · coverage {args.coverage}")
    for line in written:
        print("  " + line)
    if mark.width < 512:
        print(
            f"\nnote: the source mark is only {mark.width}px wide, so the large "
            "icons are upscaled. Re-run with higher-resolution art if you have it."
        )


if __name__ == "__main__":
    main()
