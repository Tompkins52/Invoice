"""Draws the app icons. Run from the repo root: python3 tools/make_icons.py
With "android", writes the source images @capacitor/assets wants into native/assets instead
(icon-only, icon-foreground, icon-background at 1024 and the splash at 2732).

The mark is a billhead: a sheet of paper with the company's band across the top and the bill below it,
on a navy tile. Billhead is an Upfront for Small Business app, so the band is the family's striped awning,
swept up to the right the way the family's arrow is. One drawing on a 1024 grid, rendered with the bundled
Chromium (Playwright) at each size. The native splash is plain navy: the launch animation, not the splash,
shows the mark.

The launch animation draws the same mark part by part: each part is its own small SVG, so the phone can move
it on the graphics chip (an animated shape inside one SVG is redrawn on the page's main thread, which is
busy while the app starts). Running this script also rewrites that markup in index.html, between the
"app mark" comments; tests/ui_check.py checks the two match."""
import math
import os
import re
import sys

NAVY, PAPER, RED, FOLD, LINE = '#1C3F7A', '#F3F5F8', '#E4572E', '#D9DFE7', '#C5CDD8'

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'icons')
VIEW = (262, 150, 500, 724)  # the part of the grid the launch animation shows: the sheet with a margin


def arc_box(x1, y1, x2, y2):
    """Bounding points of a half circle drawn clockwise from (x1, y1) to (x2, y2), the stripes' scalloped hem."""
    cx, cy, r = (x1 + x2) / 2, (y1 + y2) / 2, math.hypot(x2 - x1, y2 - y1) / 2
    t0 = math.atan2(y1 - cy, x1 - cx)
    return [(cx + r * math.cos(t0 + math.pi * k / 48), cy + r * math.sin(t0 + math.pi * k / 48)) for k in range(49)]


def parts():
    """The mark's parts, in drawing order: (class, index or None, bounding box (x, y, w, h), SVG element)."""
    x, y, w, h, fold, r = 292, 184, 440, 656, 112, 18
    out = [('bh-sheet', None, (x, y, w, h),
            '<path class="bh-sheet" d="M%d,%d H%d L%d,%d V%d a%d,%d 0 0 1 -%d,%d H%d a%d,%d 0 0 1 -%d,-%d V%d a%d,%d 0 0 1 %d,-%d Z" fill="%s"/>'
            % (x + r, y, x + w - fold, x + w, y + fold, y + h - r, r, r, r, r, x + r, r, r, r, r, y + r, r, r, r, r, PAPER)),
           ('bh-fold', None, (x + w - fold, y, fold, fold),
            '<path class="bh-fold" d="M%d,%d V%d a%d,%d 0 0 0 %d,%d H%d Z" fill="%s"/>' % (x + w - fold, y, y + fold - r, r, r, r, r, x + w, FOLD))]
    # The awning: four stripes, red and navy, each with a scalloped hem, the right end lifted 34 like the family's arrow.
    x0, x1, top, bottom, n, swept = x + 40, x + w - 128, y + 56, y + 56 + 78 + 16, 4, 34
    sw = (x1 - x0) / n
    lift = lambda v: -swept * (v - x0) / (x1 - x0)
    for i in range(n):
        a, b = x0 + i * sw, x0 + (i + 1) * sw
        ta, tb, ba, bb = top + lift(a), top + lift(b), bottom + lift(a), bottom + lift(b)
        rr = math.hypot(b - a, bb - ba) / 2
        pts = [(a, ta), (b, tb), (b, bb), (a, ba)] + arc_box(b, bb, a, ba)
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        out.append(('bh-st', i, (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)),
                    '<path class="bh-st" style="--i:%d" d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f A%.1f,%.1f 0 0 1 %.1f,%.1f Z" fill="%s"/>'
                    % (i, a, ta, b, tb, b, bb, rr, rr, a, ba, RED if i % 2 == 0 else NAVY)))
    for i, lw in enumerate((236, 196, 150)):
        out.append(('bh-line', i, (x + 64, y + 330 + i * 62, lw, 30),
                    '<rect class="bh-line" style="--i:%d" x="%d" y="%d" width="%d" height="30" rx="15" fill="%s"/>' % (i, x + 64, y + 330 + i * 62, lw, LINE)))
    out.append(('bh-total', None, (x + 64, y + h - 132, w - 128, 44),
                '<rect class="bh-total" x="%d" y="%d" width="%d" height="44" rx="22" fill="%s"/>' % (x + 64, y + h - 132, w - 128, NAVY)))
    return out


def mark():
    """The mark on the 1024 grid as one SVG fragment, no tile."""
    return ''.join(p[3] for p in parts())


def intro_mark():
    """The launch animation's mark: one small SVG per part, placed in percent of VIEW. The sheet and its folded
    corner move together, so they share one."""
    vx, vy, vw, vh = VIEW
    groups = [('bh-sheet', None, [p for p in parts() if p[0] in ('bh-sheet', 'bh-fold')])] + \
             [(p[0], p[1], [p]) for p in parts() if p[0] not in ('bh-sheet', 'bh-fold')]
    out = []
    for cls, i, ps in groups:
        bx = min(p[2][0] for p in ps) - 2
        by = min(p[2][1] for p in ps) - 2
        bw = max(p[2][0] + p[2][2] for p in ps) + 2 - bx
        bh = max(p[2][1] + p[2][3] for p in ps) + 2 - by
        inner = ''.join(re.sub(r' class="[^"]*"| style="[^"]*"', '', p[3]) for p in ps)
        place = 'left:%.3f%%;top:%.3f%%;width:%.3f%%;height:%.3f%%' % ((bx - vx) / vw * 100, (by - vy) / vh * 100, bw / vw * 100, bh / vh * 100)
        out.append('<svg class="%s" style="%s%s" viewBox="%.1f %.1f %.1f %.1f">%s</svg>'
                   % (cls, '' if i is None else '--i:%d;' % i, place, bx, by, bw, bh, inner))
    return '<div class="uf-mark">' + ''.join(out) + '</div>'


def write_intro():
    """Puts intro_mark() into index.html between the app mark comments."""
    path = os.path.join(ROOT, 'index.html')
    html = open(path, encoding='utf-8').read()
    new, n = re.subn(r'(<!-- app mark: tools/make_icons\.py -->).*?(<!-- /app mark -->)', lambda m: m.group(1) + intro_mark() + m.group(2), html, flags=re.S)
    if n != 1:
        sys.exit('index.html: the app mark comments are missing')
    if new != html:
        open(path, 'w', encoding='utf-8').write(new)
    print('index.html (launch animation mark)')


def svg(size, scale=1.0, tile='square'):
    """The icon at size px. tile: 'square', 'rounded' or None (transparent). scale shrinks the mark about the
    middle for icons that are masked (maskable web icon, Android adaptive foreground)."""
    t = (1 - scale) * 512
    back = {'square': '<rect width="1024" height="1024" fill="%s"/>' % NAVY,
            'rounded': '<rect width="1024" height="1024" rx="225" fill="%s"/>' % NAVY, None: ''}[tile]
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 1024 1024">%s'
            '<g transform="translate(%.1f %.1f) scale(%.3f)">%s</g></svg>') % (size, size, back, t, t, scale, mark())


def plain(size):
    return '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d"><rect width="%d" height="%d" fill="%s"/></svg>' % (size, size, size, size, NAVY)


def render(b, markup, size, path, transparent):
    page = b.new_page(viewport={'width': size, 'height': size}, device_scale_factor=1)
    page.set_content('<html><body style="margin:0;background:transparent">' + markup + '</body></html>')
    page.screenshot(path=path, omit_background=transparent, clip={'x': 0, 'y': 0, 'width': size, 'height': size})
    page.close()
    print(os.path.relpath(path, ROOT))


def main():
    from playwright.sync_api import sync_playwright
    android = len(sys.argv) > 1 and sys.argv[1] == 'android'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        if android:
            out = os.path.join(ROOT, 'native', 'assets')
            os.makedirs(out, exist_ok=True)
            render(b, svg(1024), 1024, os.path.join(out, 'icon-only.png'), False)
            # The asset tool insets the foreground to the adaptive icon's visible 72 dp, which the launcher masks
            # (a circle on most phones); at 0.92 the sheet sits well inside the 66 dp safe circle.
            render(b, svg(1024, 0.92, None), 1024, os.path.join(out, 'icon-foreground.png'), True)
            render(b, plain(1024), 1024, os.path.join(out, 'icon-background.png'), False)
            render(b, plain(2732), 2732, os.path.join(out, 'splash.png'), False)
            render(b, plain(2732), 2732, os.path.join(out, 'splash-dark.png'), False)
            b.close()
            return
        os.makedirs(OUT, exist_ok=True)
        jobs = [('icon-192.png', 192, 1.0, 'rounded'), ('icon-512.png', 512, 1.0, 'rounded'),
                ('apple-touch-icon.png', 180, 1.0, 'square'), ('maskable-512.png', 512, 0.92, 'square')]
        for name, size, scale, tile in jobs:
            render(b, svg(size, scale, tile), size, os.path.join(OUT, name), True)
        b.close()
    open(os.path.join(OUT, 'mark.svg'), 'w').write(svg(64, 1.0, 'rounded'))
    write_intro()


if __name__ == '__main__':
    sys.exit(main())
