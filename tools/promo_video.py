#!/usr/bin/env python3
"""Makes the Play listing promo video (store/billhead-promo-1920x1080.mp4, about 34 seconds, silent, captioned)
from the raw screens in store/raw (run tools/store_assets.py first). Every frame is rendered deterministically:
one HTML page with a render(t) function, stepped at 30 frames a second, then stitched by ffmpeg.

    python3 tools/promo_video.py            # the video
    python3 tools/promo_video.py 12.5       # one frame at 12.5 s, to store/promo-frame.png
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'store')
RAW = os.path.join(OUT, 'raw')
FPS = 30
W, H = 1920, 1080


def data_url(name):
    with open(os.path.join(RAW, name + '.png'), 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode('ascii')


def font_css():
    css = ''
    for fam, file_, weight in [('Plex Sans', 'plex-sans-400', 400), ('Plex Sans', 'plex-sans-500', 500), ('Plex Sans', 'plex-sans-600', 600), ('Plex Sans', 'plex-sans-700', 700), ('Plex Mono', 'plex-mono-500', 500)]:
        with open(os.path.join(ROOT, 'fonts', file_ + '.woff2'), 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('ascii')
        css += "@font-face { font-family: '%s'; src: url('data:font/woff2;base64,%s') format('woff2'); font-weight: %d; }\n" % (fam, b64, weight)
    return css


# Scenes: start, end, headline, sub, phone screens (name, from, to) shown inside the scene.
SCENES = [
    (4.0, 9.5, 'Set up your company once.', 'Your logo, your terms, your tax rate, how to pay you. After that every invoice starts filled in.', [('00-welcome', 4.0, 9.5)]),
    (9.5, 16.0, 'Make an invoice two ways.', 'Answer a few questions, or type straight onto the page. It adds up as you go.', [('02-ask', 9.5, 12.8), ('03-edit', 12.8, 16.0)]),
    (16.0, 20.5, 'Bill a project in stages.', 'Invoice 2 of 3, billed to date, retainage held: progress billing without a spreadsheet.', [('04-project', 16.0, 20.5)]),
    (20.5, 25.5, 'Send it from your phone.', 'One tap opens your email app with the PDF attached and the customer already filled in.', [('05-pdf', 20.5, 25.5)]),
    (25.5, 30.0, 'Locked PDFs, signed in the app.', 'Your customer can print it and pay it, not change it.', [('03-edit', 25.5, 30.0)]),
    (30.0, 35.0, 'Any invoice under $100 is free.', 'Otherwise 99 cents for a simple invoice, $1.99 for an advanced one. No subscription, no account, no ads.', [('06-kinds', 30.0, 35.0)]),
]
TITLE_END = 4.0
END_START = 35.0
TOTAL = 38.5


def page_html():
    imgs = {n: data_url(n) for n in ['00-welcome', '02-ask', '03-edit', '04-project', '05-pdf', '06-kinds', 'pdf-page']}
    with open(os.path.join(ROOT, 'native', 'assets', 'icon-only.png'), 'rb') as f:
        mark = 'data:image/png;base64,' + base64.b64encode(f.read()).decode('ascii')
    scenes_js = json.dumps([[s, e, h, sub, [list(x) for x in shots]] for s, e, h, sub, shots in SCENES])
    phones = ''.join('<img class="shot" data-shot="%s" src="%s">' % (n, imgs[n]) for n in ['00-welcome', '02-ask', '03-edit', '04-project', '05-pdf', '06-kinds'])
    return """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
""" + font_css() + """
* { box-sizing: border-box; }
body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: linear-gradient(135deg, #1C3F7A 0%, #122A52 100%); font-family: 'Plex Sans', sans-serif; color: #fff; -webkit-font-smoothing: antialiased; position: relative; }
.blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.06); }
#title, #end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.mark { width: 230px; height: 230px; border-radius: 52px; background: #1C3F7A; box-shadow: 0 30px 80px rgba(0,0,0,0.4); overflow: hidden; }
.mark img { width: 230px; height: 230px; display: block; }
.name { font-size: 150px; font-weight: 700; letter-spacing: -0.025em; line-height: 1; margin-top: 34px; }
.tag { font-size: 46px; color: rgba(255,255,255,0.84); margin-top: 22px; }
#text { position: absolute; left: 140px; top: 0; width: 900px; height: 1080px; display: flex; flex-direction: column; justify-content: center; }
#head { font-size: 88px; font-weight: 700; line-height: 1.08; letter-spacing: -0.02em; }
#sub { font-size: 38px; line-height: 1.4; color: rgba(255,255,255,0.84); margin-top: 34px; max-width: 820px; }
#phone { position: absolute; left: 1220px; top: 60px; width: 560px; height: 960px; border-radius: 56px; background: #0E1319; padding: 14px; box-shadow: 0 40px 120px rgba(0,0,0,0.5); }
#phone .screen { position: relative; width: 532px; height: 932px; border-radius: 44px; overflow: hidden; background: #F3F5F8; }
#phone .shot { position: absolute; left: 0; top: 0; width: 532px; height: 946px; object-fit: cover; object-position: top; opacity: 0; }
#paper { position: absolute; left: 980px; top: 170px; width: 400px; height: 518px; box-shadow: 0 30px 80px rgba(0,0,0,0.5); border-radius: 8px; overflow: hidden; background: #fff; transform-origin: bottom left; }
#paper img { width: 400px; display: block; }
#end .small { font-size: 40px; color: rgba(255,255,255,0.84); margin-top: 26px; }
#end .pill { margin-top: 40px; font-size: 34px; font-weight: 600; padding: 18px 40px; border-radius: 999px; background: rgba(255,255,255,0.14); }
</style></head><body>
<div class="blob" style="width:900px;height:900px;right:-300px;top:-420px"></div>
<div class="blob" style="width:620px;height:620px;left:-260px;bottom:-320px"></div>
<div id="title"><div class="mark"><img src="@MARK"></div><div class="name">Billhead</div><div class="tag">Invoices from your phone. Nothing leaves it.</div></div>
<div id="text"><div id="head"></div><div id="sub"></div></div>
<div id="phone"><div class="screen">@PHONES</div></div>
<div id="paper"><img src="@PAPER"></div>
<div id="end"><div class="mark"><img src="@MARK"></div><div class="name">Billhead</div><div class="small">Invoices from your phone. Nothing leaves it.</div><div class="pill">tompkinssoftwaresystems.com/billhead</div></div>
<script>
var SCENES = @SCENES, TITLE_END = @TITLE_END, END_START = @END_START;
function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function ease(x) { x = clamp(x); return 1 - Math.pow(1 - x, 3); }
function fadeIn(t, a, d) { return ease((t - a) / d); }
function render(t) {
  var title = document.getElementById('title'), end = document.getElementById('end'), text = document.getElementById('text'), phone = document.getElementById('phone'), paper = document.getElementById('paper');
  // Title card.
  var tin = fadeIn(t, 0, 0.9), tout = 1 - clamp((t - (TITLE_END - 0.5)) / 0.5);
  title.style.opacity = t < TITLE_END ? Math.min(tin, tout) : 0;
  title.querySelector('.mark').style.transform = 'scale(' + (0.6 + 0.4 * fadeIn(t, 0, 1.0)) + ')';
  title.querySelector('.name').style.opacity = fadeIn(t, 0.35, 0.7);
  title.querySelector('.name').style.transform = 'translateY(' + (24 * (1 - fadeIn(t, 0.35, 0.7))) + 'px)';
  title.querySelector('.tag').style.opacity = fadeIn(t, 0.9, 0.7);
  // End card.
  var ein = fadeIn(t, END_START, 0.8);
  end.style.opacity = t >= END_START ? ein : 0;
  end.querySelector('.pill').style.opacity = fadeIn(t, END_START + 0.9, 0.6);
  // Scenes.
  var scene = null;
  for (var i = 0; i < SCENES.length; i++) if (t >= SCENES[i][0] && t < SCENES[i][1]) scene = SCENES[i];
  var inScenes = t >= TITLE_END && t < END_START;
  text.style.opacity = inScenes ? 1 : 0;
  phone.style.opacity = inScenes ? fadeIn(t, TITLE_END, 0.7) * (1 - clamp((t - (END_START - 0.5)) / 0.5)) : 0;
  phone.style.transform = 'translateX(' + (120 * (1 - fadeIn(t, TITLE_END, 0.9))) + 'px)';
  if (scene) {
    var s0 = scene[0], s1 = scene[1];
    var hin = fadeIn(t, s0, 0.6), hout = 1 - clamp((t - (s1 - 0.4)) / 0.4);
    document.getElementById('head').textContent = scene[2];
    document.getElementById('sub').textContent = scene[3];
    document.getElementById('head').style.opacity = Math.min(hin, hout);
    document.getElementById('head').style.transform = 'translateY(' + (30 * (1 - hin)) + 'px)';
    var sin = fadeIn(t, s0 + 0.25, 0.6);
    document.getElementById('sub').style.opacity = Math.min(sin, hout);
    document.getElementById('sub').style.transform = 'translateY(' + (30 * (1 - sin)) + 'px)';
    var shots = scene[4];
    document.querySelectorAll('#phone .shot').forEach(function (img) {
      var op = 0;
      shots.forEach(function (sh) { if (img.getAttribute('data-shot') === sh[0]) { op = Math.max(op, Math.min(fadeIn(t, sh[1] - 0.3, 0.5), 1 - clamp((t - (sh[2] - 0.3)) / 0.4))); } });
      // The first shot of a scene simply stays until the next one fades over it.
      shots.forEach(function (sh, k) { if (img.getAttribute('data-shot') === sh[0] && k === 0 && t >= sh[1] && t < s1) op = 1; });
      img.style.opacity = op;
    });
    var isPdf = scene[2].indexOf('PDF') >= 0;
    text.style.width = isPdf ? '760px' : '900px';
    var pin = isPdf ? fadeIn(t, s0 + 0.8, 0.8) : 0;
    paper.style.opacity = isPdf ? Math.min(pin, hout) : 0;
    paper.style.transform = 'rotate(' + (-8 + 4 * pin) + 'deg) translateY(' + (60 * (1 - pin)) + 'px)';
  } else {
    paper.style.opacity = 0;
  }
}
render(0);
</script></body></html>""".replace('@MARK', mark).replace('@PHONES', phones).replace('@PAPER', imgs['pdf-page']).replace('@SCENES', scenes_js).replace('@TITLE_END', str(TITLE_END)).replace('@END_START', str(END_START))


def main():
    html = page_html()
    one = float(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1][0].isdigit() else None
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        page = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        page.set_content(html, wait_until='load')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(300)
        if one is not None:
            page.evaluate('render(%f)' % one)
            page.wait_for_timeout(50)
            page.screenshot(path=os.path.join(OUT, 'promo-frame.png'))
            print('store/promo-frame.png at %.2f s' % one)
            b.close()
            return
        tmp = tempfile.mkdtemp(prefix='billhead-promo-')
        n = int(TOTAL * FPS)
        for i in range(n):
            page.evaluate('render(%f)' % (i / FPS))
            page.screenshot(path=os.path.join(tmp, 'f%05d.jpg' % i), type='jpeg', quality=93)
            if i % (FPS * 5) == 0:
                print('frame %d of %d' % (i, n))
        b.close()
    out = os.path.join(OUT, 'billhead-promo-1920x1080.mp4')
    subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%05d.jpg'),
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out])
    shutil.rmtree(tmp)
    print('store/billhead-promo-1920x1080.mp4 (%.1f s)' % TOTAL)


if __name__ == '__main__':
    main()
