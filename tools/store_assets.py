#!/usr/bin/env python3
"""Makes the Google Play listing package into store/: raw phone screens of the app with the sample
company, captioned 1080x1920 screenshots, the 512 icon, the 1024x500 feature graphic, and the frames
behind the promo video (tools/promo_video.py stitches it). Run from the repo root:

    python3 tools/store_assets.py            # everything
    python3 tools/store_assets.py raw        # just the raw screens (quick look)
"""
import base64
import functools
import http.server
import os
import socketserver
import subprocess
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'store')
RAW = os.path.join(OUT, 'raw')
SEED_JS = open(os.path.join(ROOT, 'tools', 'sample_company.js'), encoding='utf-8').read()

# Phone: 360 x 640 CSS px at 3x = 1080 x 1920, the 9:16 Play wants.
W, H, SCALE = 360, 640, 3

# (file, route, ask, scroll, what the caption says)
SCREENS = [
    ('01-home', '#/', False, 0, ('Invoices from your phone', 'Set up your company once. Every new invoice starts filled in: your logo, your terms, your tax rate, how to pay you.')),
    ('02-ask', '#/ask/i1046', True, 0, ('Answer a few questions', 'Or type straight onto the invoice. Either way it adds up as you go.')),
    ('03-edit', '#/edit/i1044', False, 0, ('Bill a project in stages', 'Progress billing shows what was billed before, retainage and all.')),
    ('04-project', '#/project/p1', False, 0, ('Every project, every invoice', 'Open, overdue, partly paid, paid: the whole job on one page.')),
    ('05-pdf', '#/inv/i1041', False, 0, ('Locked PDFs, signed in the app', 'Your customer can print it and pay it, not change it.')),
    ('06-kinds', '#/new', False, 0, ('Under $100 is free', 'Otherwise 99 cents a simple invoice, $1.99 advanced. No subscription, no account, no ads.')),
    ('00-welcome', '#/welcome', None, 0, ('', '')),
    ('07-home-empty', '#/', None, 0, ('', '')),
]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return 'http://127.0.0.1:%d/' % srv.server_address[1]


def settle(page):
    page.wait_for_timeout(500)
    page.evaluate('document.fonts && document.fonts.ready')
    page.wait_for_timeout(200)


def seed(page, base, ask):
    page.goto(base + 'icons/icon-192.png', wait_until='domcontentloaded')
    if ask is None:
        # A fresh phone with the company set up and no invoices yet.
        page.evaluate(SEED_JS + '; seed({logo: SAMPLE_LOGO, ask: false}); var s = JSON.parse(localStorage.getItem("billhead.v1")); s.invoices = []; s.projects = []; s.clients = []; localStorage.setItem("billhead.v1", JSON.stringify(s));')
        return
    page.evaluate(SEED_JS + '; seed({logo: SAMPLE_LOGO, ask: ' + ('true' if ask else 'false') + '})')


def raw_screens(pw, base):
    os.makedirs(RAW, exist_ok=True)
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=SCALE, color_scheme='light')
    page = ctx.new_page()
    for name, route, ask, scroll, _ in SCREENS:
        seed(page, base, ask)
        page.goto(base + 'index.html' + route, wait_until='networkidle')
        settle(page)
        if scroll:
            page.evaluate('window.scrollTo(0, %d)' % scroll)
            page.wait_for_timeout(200)
        page.screenshot(path=os.path.join(RAW, name + '.png'))
        print('store/raw/%s.png' % name)
    # The PDF the app makes for a sent invoice, first page as an image (the video shows it).
    ctx2 = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=SCALE, accept_downloads=True)
    page = ctx2.new_page()
    seed(page, base, False)
    page.goto(base + 'index.html#/inv/i1041', wait_until='networkidle')
    settle(page)
    with page.expect_download(timeout=60000) as dl:
        page.click('[data-pdf]')
    pdf = os.path.join(RAW, 'invoice.pdf')
    dl.value.save_as(pdf)
    subprocess.check_call(['pdftoppm', '-png', '-r', '150', '-f', '1', '-l', '1', '-singlefile', pdf, os.path.join(RAW, 'pdf-page')])
    print('store/raw/pdf-page.png')
    b.close()


FONT_CSS = """
@font-face { font-family: 'Plex Sans'; src: url('%(b)sfonts/plex-sans-400.woff2') format('woff2'); font-weight: 400; }
@font-face { font-family: 'Plex Sans'; src: url('%(b)sfonts/plex-sans-500.woff2') format('woff2'); font-weight: 500; }
@font-face { font-family: 'Plex Sans'; src: url('%(b)sfonts/plex-sans-600.woff2') format('woff2'); font-weight: 600; }
@font-face { font-family: 'Plex Sans'; src: url('%(b)sfonts/plex-sans-700.woff2') format('woff2'); font-weight: 700; }
@font-face { font-family: 'Plex Mono'; src: url('%(b)sfonts/plex-mono-500.woff2') format('woff2'); font-weight: 500; }
* { box-sizing: border-box; } body { margin: 0; font-family: 'Plex Sans', sans-serif; -webkit-font-smoothing: antialiased; }
"""


def data_url(path):
    with open(path, 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode('ascii')


def shoot(b, html, w, h, path, scale=1):
    page = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=scale)
    page.set_content(html, wait_until='load')
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(250)
    page.screenshot(path=path, clip={'x': 0, 'y': 0, 'width': w, 'height': h})
    page.close()
    print(os.path.relpath(path, ROOT))


def captioned(b, base):
    """1080 x 1920: a navy band with the caption, the phone screen below it, cropped at the bottom."""
    out = os.path.join(OUT, 'screenshots')
    os.makedirs(out, exist_ok=True)
    for name, _, _, _, (head, sub) in SCREENS:
        if not head:
            continue
        img = data_url(os.path.join(RAW, name + '.png'))
        html = '<html><head><style>' + FONT_CSS % {'b': base} + """
          body { width: 1080px; height: 1920px; background: linear-gradient(160deg, #1C3F7A 0%, #122A52 100%); position: relative; overflow: hidden; color: #fff; }
          .blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.06); }
          .cap { position: absolute; left: 80px; right: 80px; top: 96px; }
          h1 { margin: 0; font-size: 76px; line-height: 1.08; font-weight: 700; letter-spacing: -0.015em; }
          p { margin: 26px 0 0; font-size: 36px; line-height: 1.35; font-weight: 400; color: rgba(255,255,255,0.84); }
          .phone { position: absolute; left: 90px; top: 520px; width: 900px; height: 1600px; border-radius: 64px; background: #0E1319; padding: 18px; box-shadow: 0 40px 120px rgba(0,0,0,0.45); }
          .phone img { width: 864px; height: 1536px; border-radius: 48px; display: block; object-fit: cover; object-position: top; }
        </style></head><body>
          <div class="blob" style="width:520px;height:520px;right:-180px;top:-200px"></div>
          <div class="blob" style="width:360px;height:360px;left:-140px;top:360px"></div>
          <div class="cap"><h1>@HEAD</h1><p>@SUB</p></div>
          <div class="phone"><img src="@IMG"></div>
        </body></html>""".replace('@HEAD', head).replace('@SUB', sub).replace('@IMG', img)
        shoot(b, html, 1080, 1920, os.path.join(out, name + '.png'))


def icon_and_feature(b, base):
    from PIL import Image
    src = os.path.join(ROOT, 'native', 'assets', 'icon-only.png')
    Image.open(src).resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-512.png'))
    print('store/icon-512.png')
    mark = data_url(os.path.join(ROOT, 'native', 'assets', 'icon-foreground.png'))
    home = data_url(os.path.join(RAW, '01-home.png'))
    html = '<html><head><style>' + FONT_CSS % {'b': base} + """
      body { width: 1024px; height: 500px; background: linear-gradient(135deg, #1C3F7A 0%, #122A52 100%); position: relative; overflow: hidden; color: #fff; }
      .blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.06); }
      .mark { position: absolute; left: 56px; top: 118px; width: 150px; height: 150px; background: #1C3F7A; border-radius: 34px; box-shadow: 0 16px 40px rgba(0,0,0,0.35); overflow: hidden; }
      .mark img { width: 220px; height: 220px; margin: -35px 0 0 -35px; }
      .name { position: absolute; left: 236px; top: 128px; font-size: 92px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
      .tag { position: absolute; left: 240px; top: 240px; font-size: 32px; color: rgba(255,255,255,0.84); line-height: 1.3; }
      .phone { position: absolute; right: 48px; top: 70px; width: 300px; height: 600px; border-radius: 34px; background: #0E1319; padding: 10px; box-shadow: 0 30px 80px rgba(0,0,0,0.45); transform: rotate(-6deg); }
      .phone img { width: 280px; height: 580px; border-radius: 26px; display: block; object-fit: cover; object-position: top; }
    </style></head><body>
      <div class="blob" style="width:420px;height:420px;left:-120px;bottom:-240px"></div>
      <div class="mark"><img src="@MARK"></div>
      <div class="name">Billhead</div>
      <div class="tag">Invoices from your phone.<br>Nothing leaves it.</div>
      <div class="phone"><img src="@HOME"></div>
    </body></html>""".replace('@MARK', mark).replace('@HOME', home)
    path = os.path.join(OUT, 'feature-graphic-1024x500.png')
    shoot(b, html, 1024, 500, path)
    Image.open(path).convert('RGB').save(path)  # Play wants no alpha channel


if __name__ == '__main__':
    base = serve()
    with sync_playwright() as pw:
        raw_screens(pw, base)
        if 'raw' in sys.argv:
            sys.exit(0)
        b = pw.chromium.launch()
        captioned(b, base)
        icon_and_feature(b, base)
        b.close()
