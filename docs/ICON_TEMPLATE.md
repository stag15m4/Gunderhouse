# Gundersen App-Icon Template

One look for every app on the home screen — **Alfred, CMS, Consultant, Legal,
Laundroweb** — so they read as a matched set: a near-black tile with a thin
**metallic gold border** and the app's own mark centered inside.

> **Visual spec (shareable):** https://claude.ai/code/artifact/9227d065-2b55-4f0a-a1c7-f6754923adc3
> — the same recipe as a page you can hand to another session at a glance.

![reference](../public/icons/icon-tile-512.png)

## How to generate

```bash
pip install Pillow numpy
python3 scripts/make_icon.py --art path/to/your-logo.png --out public/icons
```

If your logo art has the mark inside a larger image (a wordmark, a
background, a canvas), pass the pixel box of **just the mark** to isolate it:

```bash
python3 scripts/make_icon.py --art art.png --crop L,T,R,B --out public/icons
```

It writes `apple-touch-icon.png` (180 — the iOS home-screen icon),
`icon-192.png` / `icon-512.png` (PWA), `icon-tile-512.png` (preview), and a
favicon set (`favicon.ico`, `favicon-16.png`, `favicon-32.png`).

## The locked constants (do NOT change — this is what keeps them matched)

| Property        | Value                                        |
| --------------- | -------------------------------------------- |
| Background      | `#0a0a0a`                                     |
| Gold gradient   | `#F2DD92` → `#C9A04C` → `#865F22` (top→bottom)|
| Border weight   | **3.0%** of icon side                        |
| Border inset    | **1.2%** of icon side (flush to the edge)     |
| Corner radius   | **22.5%** of icon side (matches iOS squircle) |
| Supersample     | 3× then downscale (clean edges)              |

### `--alpha-floor`, when the art carries a glow

Logo art often has a wide, near-white halo at very low alpha. It is invisible
on a white page and obvious as grey haze on a near-black plate. `--alpha-floor`
drops everything under the given alpha and rescales what remains, so genuine
antialiased edges stay smooth rather than being cut to a hard line. It defaults
to `0` — off — so it changes nothing for art that doesn't need it.

**The only knob you tune per app is `--coverage`** — the mark's size as a
fraction of icon width (default `0.78`). A wide mark may want `~0.74`; a
compact mark `~0.82`. Pick whatever makes the mark sit balanced inside the
gold frame. Leave everything else at the defaults.

## What Gunderhouse used

```bash
python3 scripts/make_icon.py \
  --art public/brand/mark.webp --out public/icons --alpha-floor 96
```

`--coverage` left at the default. The floor is 96 because the mark art carries
a broad white glow — 21,000-odd pixels under alpha 60, averaging RGB
(255, 254, 230) — which read as a grey halo on the plate.

The source mark is only ~210px wide, so the 512 renders are upscaled and a
little soft at full size. Fine at the sizes anyone actually sees it; worth
re-running against the original high-resolution art if that turns up.

The favicons live at the web root (`public/favicon.ico` and friends) rather
than in `public/icons`, which is where browsers look for them by default.

## Wiring it into a Next.js app

`app/layout.tsx`:

```ts
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};
```

Gunderhouse serves its manifest from `src/app/manifest.ts` (a route) rather
than a static file, which is the same thing by another route — theme and
background must still be the same near-black:

```json
{
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

## Seeing the new icon on an iPhone

iOS caches home-screen icons hard. After deploying:

1. **Delete** the old icon from the home screen.
2. Open the site in Safari (if it's behind Cloudflare, **Purge Everything**).
3. **Share → Add to Home Screen** again.

Just redeploying will NOT swap an already-placed icon — the re-add is what
picks up the new art.
