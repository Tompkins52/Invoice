"""Draws the app icons. Run from the repo root: python3 tools/make_icons.py
With "android", writes the source images @capacitor/assets wants into native/assets instead
(icon-only, icon-foreground, icon-background at 1024 and the splash at 2732).

The mark is a billhead: a sheet of paper with the company's band across the top and the bill below it,
on a navy tile. Billhead is an Upfront for Small Business app, so the band is the family's striped awning,
swept up to the right the way the family's arrow is. The launch animation in index.html draws the same
mark part by part (tests/ui_check.py checks the two match). One SVG, drawn on a 1024 grid and rendered
with the bundled Chromium (Playwright) at each size. The native splash is plain navy: the launch
animation, not the splash, shows the mark."""
import math
import os
import sys

NAVY, PAPER, RED, FOLD, LINE = '#1C3F7A', '#F3F5F8', '#E4572E', '#D9DFE7', '#C5CDD8'

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'icons')


def awning(x0, x1, top, bottom, n=4, swept=34):
    """The family's awning: n stripes, red and navy, each with a scalloped hem. swept lifts the right end."""
    w = (x1 - x0) / n
    lift = lambda x: -swept * (x - x0) / (x1 - x0)
    out = []
    for i in range(n):
        a, b = x0 + i * w, x0 + (i + 1) * w
        ta, tb, ba, bb = top + lift(a), top + lift(b), bottom + lift(a), bottom + lift(b)
        r = math.hypot(b - a, bb - ba) / 2
        out.append('<path class="bh-st" style="--i:%d" d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f A%.1f,%.1f 0 0 1 %.1f,%.1f Z" fill="%s"/>'
                   % (i, a, ta, b, tb, b, bb, r, r, a, ba, RED if i % 2 == 0 else NAVY))
    return ''.join(out)


def mark():
    """The mark on the 1024 grid, no tile. The classes are what the launch animation moves."""
    x, y, w, h, fold, r = 292, 184, 440, 656, 112, 18
    sheet = ('<path class="bh-sheet" d="M%d,%d H%d L%d,%d V%d a%d,%d 0 0 1 -%d,%d H%d a%d,%d 0 0 1 -%d,-%d V%d a%d,%d 0 0 1 %d,-%d Z" fill="%s"/>'
             % (x + r, y, x + w - fold, x + w, y + fold, y + h - r, r, r, r, r, x + r, r, r, r, r, y + r, r, r, r, r, PAPER))
    corner = ('<path class="bh-fold" d="M%d,%d V%d a%d,%d 0 0 0 %d,%d H%d Z" fill="%s"/>'
              % (x + w - fold, y, y + fold - r, r, r, r, r, x + w, FOLD))
    band = awning(x + 40, x + w - 128, y + 56, y + 56 + 78 + 16)
    lines = ''.join('<rect class="bh-line" style="--i:%d" x="%d" y="%d" width="%d" height="30" rx="15" fill="%s"/>'
                    % (i, x + 64, y + 330 + i * 62, lw, LINE) for i, lw in enumerate((236, 196, 150)))
    total = '<rect class="bh-total" x="%d" y="%d" width="%d" height="44" rx="22" fill="%s"/>' % (x + 64, y + h - 132, w - 128, NAVY)
    return sheet + corner + band + lines + total


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


if __name__ == '__main__':
    sys.exit(main())
