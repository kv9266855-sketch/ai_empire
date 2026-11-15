"""Generate the Winter Edition illustrations (original procedural artwork, owned by the project).

Usage:  python assets/gen-winter.py      (needs Pillow + numpy)
Output: assets/images/winter-*.webp
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent / 'images'
SNOW, ICE, FROST, DEEP, SILVER = (250, 251, 255), (240, 245, 250), (220, 234, 245), (25, 38, 50), (185, 201, 213)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sky(w, h, top, bottom, glow=None):
    y = np.linspace(0, 1, h)[:, None, None]
    img = np.array(top)[None, None, :] * (1 - y) + np.array(bottom)[None, None, :] * y
    img = np.repeat(img, w, axis=1)
    if glow:
        gx, gy, r = glow
        yy, xx = np.mgrid[0:h, 0:w]
        d = np.sqrt((xx - gx * w) ** 2 + (yy - gy * h) ** 2) / (r * max(w, h))
        img += (np.clip(1 - d, 0, 1) ** 2)[..., None] * 22
    return np.clip(img, 0, 255)


def ridge(w, rng, base, amp, rough=.55, octaves=9):
    """Midpoint-displacement mountain line, returns y per x."""
    n = 2 ** octaves + 1
    pts = np.zeros(n); pts[0], pts[-1] = rng.uniform(-1, 1, 2) * amp * .5
    step, scale = n - 1, amp
    while step > 1:
        half = step // 2
        for i in range(half, n - 1, step):
            pts[i] = (pts[i - half] + pts[i + half]) / 2 + rng.uniform(-1, 1) * scale
        step, scale = half, scale * rough
    return base + np.interp(np.linspace(0, n - 1, w), np.arange(n), pts)


def mountains(img, rng, layers):
    h, w, _ = img.shape
    yy = np.arange(h)[:, None]
    for base, amp, color, snowline, blur in layers:
        line = ridge(w, rng, base * h, amp * h)
        mask = (yy >= line[None, :]).astype(float)
        # Snow gullies: smoothed per-column noise lets rock show through in streaks.
        gully = np.asarray(Image.fromarray((rng.uniform(0, 255, (1, w // 45 + 2))).astype('uint8')).resize((w, 1), Image.BICUBIC), float)[0] / 255
        dist = yy - line[None, :]
        depth = np.clip(dist / (snowline * h), 0, 1)
        slope = np.gradient(line)  # light from the left: faces sloping down-right are lit
        lit = np.clip(.5 + np.convolve(slope, np.ones(25) / 25, 'same') * .9, 0, 1)[None, :, None]
        near = np.exp(-np.clip(dist, 0, None) / (.035 * h))[..., None]  # shading only along the ridge crest
        rock = np.array(color)[None, None, :] * (1 + (lit - .5) * .35 * near)
        layer = np.array(SNOW)[None, None, :] * (1 - depth[..., None]) + rock * depth[..., None]
        m = Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(blur))
        mask = np.asarray(m, float)[..., None] / 255
        img[:] = img * (1 - mask) + layer * mask
        fog = np.exp(-((yy - (line.max() + .01 * h)) / (.06 * h)) ** 2)[..., None]  # mist pooling at the foot
        img[:] = img + (np.array(ICE) - img) * fog * .5
    return img


def pine(draw, x, base, height, color, snow, rng):
    """Natural spruce silhouette: drooping, jagged branch tiers with thin snow on their upper edges."""
    trunk = height * .012
    draw.rectangle([x - trunk, base - height * .06, x + trunk, base], fill=color)
    tiers = int(rng.integers(9, 14)); width = height * rng.uniform(.17, .23)
    top = base - height
    left, right, snows = [(x, top)], [(x, top)], []
    for t in range(1, tiers + 1):
        f = t / tiers
        y = top + height * .94 * f
        half = width * f ** .85 * rng.uniform(.85, 1.15)
        droop = height * .025 * rng.uniform(.6, 1.3)
        inner = half * rng.uniform(.38, .55)
        for side, pts in ((-1, left), (1, right)):
            tip = (x + side * half, y + droop)
            pts.append((x + side * inner, y - height * .035))
            pts.append(tip)
            snows.append((side, (x + side * inner * .4, y - height * .05), tip, height * .012 * rng.uniform(.6, 1.4)))
    poly = left + [(x, base - height * .05)] + right[::-1]
    draw.polygon(poly, fill=color)
    for side, a, b, th in snows:
        if rng.uniform() < .75:
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - th * .4)
            draw.polygon([a, mid, (b[0] - side * th, b[1] - th * .5), (b[0] - side * th * 2.5, b[1] - th * 1.2), (mid[0], mid[1] - th)], fill=snow)
    draw.polygon([(x, top - height * .005), (x - width * .08, top + height * .07), (x + width * .07, top + height * .07)], fill=snow)


def forest(img, rng, rows):
    """rows: (ground_y, tree_height, tone 0=deep..1=silver, blur, x positions as fractions)."""
    base = Image.fromarray(img.astype('uint8')).convert('RGBA')
    h, w = img.shape[:2]
    for y, size, tone, blur, xs in rows:
        layer = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
        color = mix(DEEP, SILVER, tone) + (255,); snow = mix(SNOW, FROST, tone * .4) + (255,)
        for fx in xs:
            pine(d, fx * w + rng.uniform(-.01, .01) * w, y * h + rng.uniform(-.006, .006) * h, size * h * rng.uniform(.75, 1.2), color, snow, rng)
        if blur: layer = layer.filter(ImageFilter.GaussianBlur(blur))
        base = Image.alpha_composite(base, layer)
        if y < 1:  # drift of snow at the stand's feet, then mist
            g = Image.new('RGBA', (w, h), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
            for k in range(int(h * .1)):
                gd.line([(0, y * h - k), (w, y * h - k)], fill=ICE + (int(150 * (1 - k / (h * .1)) ** 2),))
            gd.rectangle([0, y * h, w, h], fill=mix(SNOW, ICE, .5) + (255,))
            base = Image.alpha_composite(base, g.filter(ImageFilter.GaussianBlur(6)))
    return np.asarray(base.convert('RGB'), float)


def cluster(rng, center, spread, n):
    return sorted(center + rng.normal(0, spread, n))


def grain(img, rng, amount=3.5):
    return np.clip(img + rng.normal(0, amount, img.shape[:2])[..., None], 0, 255)


def save(img, name, size):
    im = Image.fromarray(img.astype('uint8')).resize(size, Image.LANCZOS)
    im.save(OUT / name, 'WEBP', quality=80, method=6)
    print(name, (OUT / name).stat().st_size // 1024, 'KB')


def ice(w, h, rng, cells=110):
    pts = rng.uniform(0, 1, (cells, 2)) * [w, h]
    yy, xx = np.mgrid[0:h, 0:w]
    d1 = np.full((h, w), 1e9); d2 = np.full((h, w), 1e9)
    for px, py in pts:
        d = np.hypot(xx - px, yy - py)
        d2 = np.where(d < d1, d1, np.minimum(d2, d)); d1 = np.minimum(d1, d)
    edge = np.exp(-(d2 - d1) / .9)
    inner = np.clip(d1 / 60, 0, 1)
    base = sky(w, h, ICE, FROST)
    img = base * (1 - .12 * inner[..., None]) + np.array(SNOW) * edge[..., None] * .4
    fine = Image.fromarray(np.clip(img, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(.6))
    return np.asarray(fine, float)


def main():
    OUT.mkdir(exist_ok=True)
    rng = np.random.default_rng(2026)
    # Hero: portrait, misty peaks, a sparse spruce stand; generous negative space.
    img = sky(1400, 1600, SNOW, FROST, glow=(.72, .26, .5))
    img = mountains(img, rng, [(.46, .15, (172, 190, 207), .18, 2), (.56, .11, (128, 150, 171), .13, 1.2), (.66, .06, (98, 120, 141), .09, .6)])
    img = forest(img, rng, [(.79, .1, .7, 2.2, cluster(rng, .3, .16, 14)), (.9, .2, .35, 1, [.06, .16, .22, .8, .9]), (1.02, .42, 0, 0, [-.04, .07, .95])])
    save(grain(img, rng), 'winter-hero.webp', (1400, 1600))
    # Visual break: wide spruce forest dissolving into fog.
    img = sky(1600, 1000, SNOW, ICE, glow=(.3, .2, .6))
    img = mountains(img, rng, [(.4, .12, (176, 194, 210), .2, 2.5), (.5, .08, (140, 162, 182), .14, 1.5)])
    img = forest(img, rng, [(.66, .1, .8, 2.5, list(np.linspace(-.02, 1.02, 34) + rng.normal(0, .008, 34))), (.8, .2, .5, 1.2, cluster(rng, .22, .1, 9) + cluster(rng, .78, .08, 7)), (1.03, .5, 0, 0, [.03, .12, .9])])
    save(grain(img, rng), 'winter-forest.webp', (1600, 1000))
    # Showcase panel: peaks under a pale low sun, a lone stand of spruce.
    img = sky(1400, 900, SNOW, ICE, glow=(.62, .3, .5))
    img = mountains(img, rng, [(.36, .2, (170, 189, 206), .2, 1.5), (.52, .14, (120, 143, 165), .14, 1)])
    img = forest(img, rng, [(.9, .2, .25, 0, cluster(rng, .2, .05, 5))])
    save(grain(img, rng), 'winter-peaks.webp', (1400, 900))
    # Ice texture: frozen crystalline cells.
    img = ice(1200, 900, rng, 70)
    save(grain(img, rng, 2), 'winter-ice.webp', (1200, 900))


if __name__ == '__main__':
    main()
