#!/usr/bin/env python3
"""Turn a generated render into a build-menu picture or a tab icon.

See ../CAMEOS.md for the whole process. Needs Pillow (pip install pillow).

  # a build-menu picture: a 4:3 crop of a 16:9 render, 240x180, 48 colors
  python3 tools/cameo.py cameo render.png public/cameos/<id>.png [--x0 160]

  # a tab icon: a render with its background removed (transparent PNG),
  # trimmed to the subject, at most 68x56, 48 colors
  python3 tools/cameo.py tab cutout.png public/tabs/<tab>.png [--top 0.55]
"""
import argparse

from PIL import Image, ImageEnhance

CAMEO = (240, 180)
TAB = (68, 56)  # twice the tab button's 34x28 image box, for sharp phones
COLORS = 48


def reduce(im: Image.Image) -> Image.Image:
    """Cut an RGB image to COLORS colors, dithered."""
    return im.quantize(COLORS, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).convert('RGB')


def cameo(src: str, out: str, x0: int | None) -> None:
    im = Image.open(src).convert('RGB')
    w, h = im.size
    cw = h * 4 // 3
    if x0 is None:
        x0 = (w - cw) // 2
    x0 = max(0, min(w - cw, x0))
    im = im.crop((x0, 0, x0 + cw, h)).resize(CAMEO, Image.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.08)
    reduce(im).save(out, optimize=True)


def tab(src: str, out: str, top: float) -> None:
    im = Image.open(src).convert('RGBA')
    # trim to the solid part of the cutout (the soft edge fades out)
    solid = im.getchannel('A').point(lambda a: 255 if a > 128 else 0)
    l, t, r, b = solid.getbbox()
    # keep only the top share of the subject (head and shoulders of a soldier)
    b = t + round((b - t) * top)
    im = im.crop((l, t, r, b))
    im.thumbnail(TAB, Image.LANCZOS)
    rgb = ImageEnhance.Contrast(im.convert('RGB')).enhance(1.1)
    rgb = reduce(rgb).convert('RGBA')
    # hard edge: each pixel is either solid or clear, like the pixel art
    alpha = im.getchannel('A').point(lambda a: 255 if a > 110 else 0)
    rgb.putalpha(alpha)
    rgb.save(out, optimize=True)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('mode', choices=['cameo', 'tab'])
    p.add_argument('src')
    p.add_argument('out')
    p.add_argument('--x0', type=int, help='cameo: left edge of the 4:3 crop (default: centered)')
    p.add_argument('--top', type=float, default=1.0, help='tab: share of the subject height to keep, from the top')
    a = p.parse_args()
    if a.mode == 'cameo':
        cameo(a.src, a.out, a.x0)
    else:
        tab(a.src, a.out, a.top)


if __name__ == '__main__':
    main()
