"""Draws the app icons. Run from the repo root: python3 tools/make_icons.py

The mark is a billhead: a sheet of paper with the company's band across the top and the bill below it,
on a navy tile. One SVG, rendered with the bundled Chromium (Playwright) at each size."""
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'icons')


def svg(size, pad, rounded):
    # pad: fraction of the tile kept clear around the sheet (maskable icons need a bigger safe zone).
    s = size
    r = s * 0.22 if rounded else 0
    sheet_w, sheet_h = s * (0.50 - pad), s * (0.64 - pad)
    x = (s - sheet_w) / 2
    y = (s - sheet_h) / 2
    fold = sheet_w * 0.26
    band_h = sheet_h * 0.17
    line = lambda i, w: '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="#C5CDD8"/>' % (x + sheet_w * 0.16, y + band_h + sheet_h * (0.22 + i * 0.16), sheet_w * w, sheet_h * 0.055, sheet_h * 0.027)
    return '''<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">
<rect width="%d" height="%d" rx="%.1f" fill="#1C3F7A"/>
<path d="M%.1f %.1f h%.1f l%.1f %.1f v%.1f h-%.1f z" fill="#FFFFFF"/>
<path d="M%.1f %.1f v%.1f h%.1f z" fill="#D9DFE7"/>
<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#1C3F7A"/>
%s%s%s
<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="#1C3F7A"/>
</svg>''' % (s, s, s, s, s, s, r,
             x, y, sheet_w - fold, fold, fold, sheet_h - fold, sheet_w,
             x + sheet_w - fold, y, fold, fold,
             x + sheet_w * 0.16, y + sheet_h * 0.30, sheet_w * 0.46, band_h * 0.5,
             line(0, 0.62), line(1, 0.52), line(2, 0.40),
             x + sheet_w * 0.16, y + band_h + sheet_h * 0.70, sheet_w * 0.68, sheet_h * 0.07, sheet_h * 0.035)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [('icon-192.png', 192, 0.0, True), ('icon-512.png', 512, 0.0, True), ('apple-touch-icon.png', 180, 0.0, False), ('maskable-512.png', 512, 0.10, False)]
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for name, size, pad, rounded in jobs:
            page = b.new_page(viewport={'width': size, 'height': size}, device_scale_factor=1)
            page.set_content('<html><body style="margin:0;background:transparent">' + svg(size, pad, rounded) + '</body></html>')
            page.screenshot(path=os.path.join(OUT, name), omit_background=True, clip={'x': 0, 'y': 0, 'width': size, 'height': size})
            page.close()
            print('icons/' + name)
        b.close()
    open(os.path.join(OUT, 'mark.svg'), 'w').write(svg(64, 0.0, True))


if __name__ == '__main__':
    sys.exit(main())
