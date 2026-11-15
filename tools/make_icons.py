"""Draws the app icons. Run from the repo root: python3 tools/make_icons.py
With "android", writes the source images @capacitor/assets wants into native/assets instead
(icon-only, icon-foreground, icon-background at 1024 and the splash at 2732).

The mark is a bill: a white sheet with a folded corner, the lines of the bill, a bold bar for the total and a red
rubber stamp, on a navy tile. Billhead is an Upfront for Small Business app, and the family's marks are all drawn
this way: a navy tile, a white object, and one red accent with a navy keyline around it. The family's own mark, a
striped awning over an arrow, is drawn here too, for the "by Upfront for Small Business" line of the launch
animation. One drawing on a 1024 grid, rendered with the bundled Chromium (Playwright) at each size. The native
splash is plain navy: the launch animation, not the splash, shows the mark.

The launch animation draws the same marks part by part: each part is its own small SVG, so the phone can move it
on the graphics chip (an animated shape inside one SVG is redrawn on the page's main thread, which is busy while
the app starts). Running this script also rewrites that markup in index.html, between the "app mark" and the
"family mark" comments, and the mark in the header (MARK in js/app.js); tests/ui_check.py checks they match."""
import math
import os
import re
import sys

NAVY, RED, WHITE = '#172E4E', '#F34D38', '#FFFFFF'
KEY = 16    # the navy keyline that separates a red accent from the white object
LINE = 34   # the thickness of a line of writing on the sheet
TILE = 230  # corner radius of the rounded tile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'icons')
STAMP = (662, 760, 0.94, -18)  # the stamp: the middle of its base, its scale and its tilt


def f(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def rect(x0, y0, x1, y1, r, fill):
    return '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>' % (f(x0), f(y0), f(x1 - x0), f(y1 - y0), f(r), fill)


def bar(x0, x1, y, fill, t=LINE):
    """A line of writing: a rounded bar centered on y."""
    return rect(x0, y - t / 2, x1, y + t / 2, t / 2, fill)


def rounded(points, radii):
    """Path data for a closed polygon with rounded corners (one radius, or one per corner)."""
    n = len(points)
    if not isinstance(radii, (list, tuple)):
        radii = [radii] * n
    d = []
    for i, (bx, by) in enumerate(points):
        ax, ay = points[i - 1]
        cx, cy = points[(i + 1) % n]
        r = radii[i]
        la, lc = math.hypot(ax - bx, ay - by), math.hypot(cx - bx, cy - by)
        ra, rc = min(r, la / 2), min(r, lc / 2)
        p1 = (bx + (ax - bx) / la * ra, by + (ay - by) / la * ra)
        p2 = (bx + (cx - bx) / lc * rc, by + (cy - by) / lc * rc)
        d.append('%s%s,%s' % ('M' if i == 0 else 'L', f(p1[0]), f(p1[1])))
        d.append('Q%s,%s %s,%s' % (f(bx), f(by), f(p2[0]), f(p2[1])) if r else '')
    return ' '.join(x for x in d if x) + ' Z'


def path(d, fill):
    return '<path d="%s" fill="%s"/>' % (d, fill)


def keyed(shapes_d):
    """A red accent made of several paths, with the navy keyline around their union."""
    under = ''.join('<path d="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>' % (d, NAVY, NAVY, f(2 * KEY)) for d in shapes_d)
    return under + ''.join(path(d, RED) for d in shapes_d)


def placed(x, y, cx, cy, scale, tilt):
    """Where a point of the stamp's own drawing lands on the grid."""
    a = math.radians(tilt)
    return (cx + scale * (x * math.cos(a) - y * math.sin(a)), cy + scale * (x * math.sin(a) + y * math.cos(a)))


def stamp(cx, cy, scale, tilt):
    """A rubber stamp seen from the side; (cx, cy) is the middle of its base."""
    knob = 'M0,-290 a50,50 0 1 0 0.1,0 Z'
    neck = 'M-22,-214 L-22,-124 Q-22,-84 -62,-84 L62,-84 Q22,-84 22,-124 L22,-214 Z'
    block = rounded([(-132, -88), (132, -88), (132, -10), (-132, -10)], [22, 22, 8, 8])
    die = rounded([(-132, 12), (132, 12), (132, 46), (-132, 46)], 9)
    return '<g transform="translate(%s %s) rotate(%s) scale(%s)">%s</g>' % (f(cx), f(cy), f(tilt), f(scale), keyed([neck, knob, block, die]))


def stamp_box(cx, cy, scale, tilt):
    """The box around the stamp, keyline included."""
    pts = [(66 * math.cos(math.radians(k * 15)), -240 + 66 * math.sin(math.radians(k * 15))) for k in range(24)]
    pts += [(-148, -104), (148, -104), (148, 62), (-148, 62)]
    xy = [placed(x, y, cx, cy, scale, tilt) for x, y in pts]
    xs, ys = [p[0] for p in xy], [p[1] for p in xy]
    return (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))


def burst(cx, cy, scale, tilt):
    """The stamp landing: five short strokes fanning out from under its base. Only the launch animation shows
    them, for a moment. The box is centered on the base, so the strokes can grow out of it."""
    ticks = []
    for a in (18, 54, 90, 126, 162):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        ticks.append('<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="18" stroke-linecap="round"/>'
                     % (f(c * 182), f(30 + s * 98), f(c * 240), f(30 + s * 152), RED))
    mx, my = placed(0, 30, cx, cy, scale, tilt)
    r = 262 * scale
    return ((mx - r, my - r, 2 * r, 2 * r),
            '<g transform="translate(%s %s) rotate(%s) scale(%s)">%s</g>' % (f(cx), f(cy), f(tilt), f(scale), ''.join(ticks)))


def parts():
    """Billhead's mark in drawing order: (class, index or None, box (x, y, w, h), SVG, only in the launch animation)."""
    x0, x1, y0, y1, r, ear = 236, 716, 160, 864, 24, 132
    sheet = ('M%s,%s H%s L%s,%s V%s a%s,%s 0 0 1 -%s,%s H%s a%s,%s 0 0 1 -%s,-%s V%s a%s,%s 0 0 1 %s,-%s Z' % (
        f(x0 + r), f(y0), f(x1 - ear), f(x1), f(y0 + ear), f(y1 - r), r, r, r, r, f(x0 + r), r, r, r, r, f(y0 + r), r, r, r, r))
    fold = '<path d="M%s,%s V%s q0,22 22,22 H%s" fill="none" stroke="%s" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>' % (
        f(x1 - ear), f(y0 + 10), f(y0 + ear - 22), f(x1 - 10), NAVY)
    m = x0 + 62
    out = [('bh-sheet', None, (x0, y0, x1 - x0, y1 - y0), path(sheet, WHITE) + fold, False)]
    # who it is from (two lines), then what was done (three)
    for i, (w, y) in enumerate(((190, 262), (120, 328), (300, 440), (196, 508), (222, 576))):
        out.append(('bh-line', i, (m, y - LINE / 2, w, LINE), bar(m, m + w, y, NAVY), False))
    out.append(('bh-total', None, (m, 742 - 31, 190, 62), bar(m, m + 190, 742, NAVY, 62), False))
    out.append(('bh-stamp', None, stamp_box(*STAMP), stamp(*STAMP), False))
    box, svg_ = burst(*STAMP)
    out.append(('bh-burst', None, box, svg_, True))
    return out


def family_parts():
    """The family's mark, the awning over the arrow, in drawing order (same shape as parts())."""
    top_y, eave_y = 232, 430                       # the canopy's top, and the line its scallops hang from
    top_x0, top_x1, eave_x0, eave_x1 = 222, 802, 122, 902
    n = 7
    sw = (eave_x1 - eave_x0) / n
    r = sw / 2
    # the shop front is the arrow: a block arrow whose top sits behind the awning
    mid, shaft, head, x_tail, x_neck, x_tip = 578, 124, 252, 172, 572, 850
    arrow = rounded([(x_tail, mid - shaft), (x_neck, mid - shaft), (x_neck, mid - head), (x_tip, mid), (x_neck, mid + head), (x_neck, mid + shaft), (x_tail, mid + shaft)],
                    [22, 0, 10, 10, 10, 0, 22])
    out = [('uf-ar', None, (x_tail, mid - head, x_tip - x_tail, 2 * head), path(arrow, WHITE), False)]
    stripes = []
    for i in range(n):
        xt0, xt1 = top_x0 + (top_x1 - top_x0) * i / n, top_x0 + (top_x1 - top_x0) * (i + 1) / n
        xb0, xb1 = eave_x0 + sw * i, eave_x0 + sw * (i + 1)
        start = 'M%s,%s Q%s,%s %s,%s' % (f(xt0 - 6), f(top_y + 22), f(xt0), f(top_y), f(xt0 + 22), f(top_y)) if i == 0 else 'M%s,%s' % (f(xt0), f(top_y))
        top = 'L%s,%s Q%s,%s %s,%s' % (f(xt1 - 22), f(top_y), f(xt1), f(top_y), f(xt1 + 6), f(top_y + 22)) if i == n - 1 else 'L%s,%s' % (f(xt1), f(top_y))
        d = '%s %s L%s,%s A%s,%s 0 0 1 %s,%s Z' % (start, top, f(xb1), f(eave_y), f(r), f(r), f(xb0), f(eave_y))
        stripes.append((d, (min(xt0 - 6, xb0), top_y, max(xt1 + 6, xb1) - min(xt0 - 6, xb0), eave_y + r - top_y)))
    # the keyline under the whole awning, so its white stripes never touch the white arrow
    out.append(('uf-awk', None, (eave_x0 - KEY, top_y - KEY, eave_x1 - eave_x0 + 2 * KEY, eave_y + r - top_y + 2 * KEY),
                ''.join('<path d="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>' % (d, NAVY, NAVY, f(2 * KEY)) for d, _ in stripes), False))
    for i, (d, box) in enumerate(stripes):
        out.append(('uf-st', i, box, path(d, RED if i % 2 == 0 else WHITE), False))
    return out


def view(ps, margin=10):
    """The part of the grid the launch animation shows of a mark: its drawing, with a margin."""
    ps = [p for p in ps if not p[4]]
    x0, y0 = min(p[2][0] for p in ps) - margin, min(p[2][1] for p in ps) - margin
    return (x0, y0, max(p[2][0] + p[2][2] for p in ps) + margin - x0, max(p[2][1] + p[2][3] for p in ps) + margin - y0)


def square(v):
    """The view widened or heightened to a square about its middle."""
    x, y, w, h = v
    s = max(w, h)
    return (x - (s - w) / 2, y - (s - h) / 2, s, s)


VIEW = view(parts())                          # Billhead's mark in the launch animation: the sheet and its stamp
FAMILY_VIEW = square(view(family_parts()))    # the family's mark beside "by Upfront for Small Business"


def mark():
    """Billhead's mark on the 1024 grid as one SVG fragment, no tile."""
    return ''.join(p[3] for p in parts() if not p[4])


def family_mark():
    """The family's mark on the 1024 grid as one SVG fragment, no tile."""
    return ''.join(p[3] for p in family_parts())


def pieces(ps, v, cls):
    """A mark for the launch animation: one small SVG per part, placed in percent of the view v."""
    vx, vy, vw, vh = v
    out = []
    for name, i, (bx, by, bw, bh), inner, _ in ps:
        place = 'left:%.3f%%;top:%.3f%%;width:%.3f%%;height:%.3f%%' % ((bx - vx) / vw * 100, (by - vy) / vh * 100, bw / vw * 100, bh / vh * 100)
        out.append('<svg class="%s" style="%s%s" viewBox="%s %s %s %s">%s</svg>' % (name, '' if i is None else '--i:%d;' % i, place, f(bx), f(by), f(bw), f(bh), inner))
    return '<div class="%s">%s</div>' % (cls, ''.join(out))


def intro_mark():
    """The launch animation's app mark."""
    return pieces(parts(), VIEW, 'uf-mark bh-mark')


def intro_family():
    """The launch animation's family mark."""
    return pieces(family_parts(), FAMILY_VIEW, 'uf-fam')


def header_mark():
    """The mark on its tile, as the header draws it (MARK in js/app.js)."""
    return '<svg class="mark" viewBox="0 0 1024 1024" aria-hidden="true"><rect width="1024" height="1024" rx="%d" fill="%s"/>%s</svg>' % (TILE, NAVY, mark())


def put(path_, pattern, make, what):
    """Rewrites the one place in a file that pattern finds (its first and last groups stay)."""
    text = open(path_, encoding='utf-8').read()
    new, n = re.subn(pattern, lambda m: m.group(1) + make() + m.group(2), text, flags=re.S)
    if n != 1:
        sys.exit('%s: %s is missing' % (os.path.relpath(path_, ROOT), what))
    if new != text:
        open(path_, 'w', encoding='utf-8').write(new)
    print('%s (%s)' % (os.path.relpath(path_, ROOT), what))


def write_intro():
    """Puts the launch animation's marks into index.html and the header's mark into js/app.js."""
    index = os.path.join(ROOT, 'index.html')
    put(index, r'(<!-- app mark: tools/make_icons\.py -->).*?(<!-- /app mark -->)', intro_mark, 'the app mark comments')
    put(index, r'(<!-- family mark: tools/make_icons\.py -->).*?(<!-- /family mark -->)', intro_family, 'the family mark comments')
    put(os.path.join(ROOT, 'js', 'app.js'), r"(  var MARK = ')[^'\n]*(';)", header_mark, 'the header mark')


def svg(size, scale=1.0, tile='square'):
    """The icon at size px. tile: 'square', 'rounded' or None (transparent). scale shrinks the mark about the
    middle for icons that are masked (maskable web icon, Android adaptive foreground)."""
    t = (1 - scale) * 512
    back = {'square': '<rect width="1024" height="1024" fill="%s"/>' % NAVY,
            'rounded': '<rect width="1024" height="1024" rx="%d" fill="%s"/>' % (TILE, NAVY), None: ''}[tile]
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 1024 1024">%s'
            '<g transform="translate(%.1f %.1f) scale(%.3f)">%s</g></svg>') % (size, size, back, t, t, scale, mark())


def plain(size):
    return '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d"><rect width="%d" height="%d" fill="%s"/></svg>' % (size, size, size, size, NAVY)


def render(b, markup, size, path_, transparent):
    page = b.new_page(viewport={'width': size, 'height': size}, device_scale_factor=1)
    page.set_content('<html><body style="margin:0;background:transparent">' + markup + '</body></html>')
    page.screenshot(path=path_, omit_background=transparent, clip={'x': 0, 'y': 0, 'width': size, 'height': size})
    page.close()
    print(os.path.relpath(path_, ROOT))


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
            # (a circle on most phones); at 0.92 the sheet and its stamp sit well inside the 66 dp safe circle.
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
