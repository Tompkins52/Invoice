"""Walks the app the way a person would, in headless Chromium, and checks the PDF it makes.
Run from the repo root: python3 tests/ui_check.py [--shots]

Covers: the company profile, a simple invoice through Ask me, the same invoice on the page, an advanced
invoice on a progress project (two invoices, the second shows what the first billed), a signature, a
payment, and the PDF: encrypted, print and copy allowed, editing not, with the right text on it. Also the
launch animation: the same mark as the icons, about 3 seconds, a tap skips it, once a session."""
import functools
import http.server
import io
import os
import socketserver
import sys
import threading
import time

from playwright.sync_api import sync_playwright
from pypdf import PdfReader

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SHOTS = '--shots' in sys.argv
SHOT_DIR = os.path.join(ROOT, 'tests', 'shots')
fails = []


def check(ok, what):
    print(('ok    ' if ok else 'FAIL  ') + what)
    if not ok:
        fails.append(what)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
BASE = 'http://127.0.0.1:%d/' % srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()


def shot(page, name):
    if SHOTS:
        os.makedirs(SHOT_DIR, exist_ok=True)
        page.screenshot(path=os.path.join(SHOT_DIR, name + '.png'), full_page=True)


def fill(page, selector, value):
    page.fill(selector, value)


def read_pdf(download):
    data = io.BytesIO(download.path() and open(download.path(), 'rb').read())
    r = PdfReader(data)
    return r


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until='networkidle')

    # ---------- Company profile ----------
    check(page.url.endswith('#/welcome'), 'a new device opens on the company profile')
    fill(page, '[data-k="name"]', 'Hart Electric LLC')
    fill(page, '[data-k="addr"]', '300 Main St, Suite 2\nPrairie City, IL 60000')
    fill(page, '[data-k="phone"]', '(555) 010-0142')
    fill(page, '[data-k="email"]', 'office@hartelectric.example')
    fill(page, '[data-k="taxRate"]', '7.25')
    fill(page, '[data-k="payInstr"]', 'Mail checks to the address above, or ask for our ACH letter.')
    fill(page, '[data-k="payLink"]', 'https://pay.example/hart')
    page.set_input_files('[data-logo]', os.path.join(ROOT, 'tests', 'fixtures', 'logo.png'))
    page.wait_for_selector('[data-logo-clear]')
    shot(page, '01-welcome')
    page.click('[data-company-save]')
    page.wait_for_selector('[data-new="simple"]')
    check(page.url.endswith('#/'), 'saving the profile lands on Home')
    shot(page, '02-home-empty')

    # ---------- Simple invoice through Ask me ----------
    page.click('[data-new="simple"]')
    page.wait_for_selector('[data-tool="ask"]')
    page.click('[data-tool="ask"]')
    page.wait_for_selector('[data-step="customer"]')
    fill(page, '[data-k="cust.name"]', 'Lakeside Dental')
    fill(page, '[data-k="cust.addr"]', '42 Lakeview Dr\nPrairie City, IL 60000')
    fill(page, '[data-k="cust.email"]', 'ap@lakesidedental.example')
    shot(page, '03-ask-customer')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="project"]')
    page.click('[data-next]')  # no project
    page.wait_for_selector('[data-step="work"]')
    page.fill('[data-line="0"] [data-l="d"]', 'Service call, replace failed GFCI outlets (3)')
    page.fill('[data-line="0"] [data-l="r"]', '285')
    page.click('[data-addline]')
    page.fill('[data-line="1"] [data-l="d"]', 'GFCI outlets')
    page.fill('[data-line="1"] [data-l="q"]', '3')
    page.fill('[data-line="1"] [data-l="r"]', '24.50')
    page.dispatch_event('[data-line="1"] [data-l="r"]', 'change')
    check('$73.50' in page.inner_text('[data-line="1"]'), 'a line amount follows the quantity and rate')
    shot(page, '04-ask-lines')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="tax"]')
    check(page.input_value('[data-k="tax"]') == '7.25', 'the tax step is prefilled from the profile')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="dates"]')
    page.click('[data-terms="Net 15"]')
    page.wait_for_timeout(100)
    due = page.input_value('[data-k="due"]')
    date = page.input_value('[data-k="date"]')
    check(due > date, 'picking Net 15 sets a due date after the invoice date')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="extras"]')
    check(page.locator('[data-ex="disc"]').count() == 1 and page.locator('[data-ex="po"]').count() == 0, 'a simple invoice offers a discount and a deposit but not the advanced extras')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="pay"]')
    check('ACH letter' in page.input_value('[data-k="pay.instr"]'), 'payment instructions come from the profile')
    page.click('[data-next]')
    page.wait_for_selector('[data-inv]')
    check('#/edit/' in page.url, 'the last question lands on the invoice itself')
    shot(page, '05-editor-simple')
    txt = page.inner_text('[data-inv]')
    check('Lakeside Dental' in txt and 'GFCI' in txt, 'the invoice shows what was typed')
    check('$358.50' in txt, 'the subtotal is right (285 + 3 x 24.50)')
    check('$384.49' in txt, 'tax at 7.25 percent is added to the total')
    check(page.locator('[data-inv] .add.adv').count() > 0, 'advanced parts show as Advanced links on a simple invoice')

    # ---------- Edit it on the page ----------
    page.click('[data-inv] [data-f="lines.1.q"]')
    page.keyboard.press('Control+A')
    page.keyboard.type('4')
    page.dispatch_event('[data-inv] [data-f="lines.1.q"]', 'input')
    page.wait_for_timeout(100)
    check('$383.00' in page.inner_text('[data-inv] [data-sub]'), 'typing on the page updates the totals')
    page.click('[data-inv] [data-show="notes"]')
    page.wait_for_selector('[data-inv] [data-f="pay.notes"]')
    page.locator('[data-inv] [data-f="pay.notes"]').fill('Thank you for the work.')
    page.dispatch_event('[data-inv] [data-f="pay.notes"]', 'input')

    # ---------- Download the PDF ----------
    with page.expect_download() as dl:
        page.click('[data-pdf]')
    download = dl.value
    check(download.suggested_filename.startswith('invoice-inv-1001'), 'the PDF is named after the invoice number (%s)' % download.suggested_filename)
    r = PdfReader(download.path())
    check(r.is_encrypted, 'the PDF is encrypted')
    check(r.decrypt('') == 1, 'it opens with no password')
    perms = r.user_access_permissions
    check(bool(perms & 4) and bool(perms & 16) and not (perms & 8) and not (perms & 32), 'permissions: print and copy yes, modify and annotate no (%s)' % int(perms))
    text = r.pages[0].extract_text()
    check('Hart Electric LLC' in text and 'Lakeside Dental' in text, 'the PDF carries both parties')
    check('INV-1001' in text and 'GFCI' in text, 'the PDF carries the number and the lines')
    check('$383.00' in text and 'Balance due' in text, 'the PDF carries the totals')
    check('Pay online' in text, 'the payment link prints')
    check('Invoice ID' in text, 'the fingerprint prints in the footer')
    check(len(r.pages[0].images) >= 1, 'the logo is in the PDF')
    page.wait_for_timeout(300)
    page.click('[data-go^="#/inv/"]')
    page.wait_for_selector('[data-payment]')
    check('sent' in page.inner_text('.pill').lower(), 'downloading marks the invoice sent')
    shot(page, '06-invoice-detail')

    # ---------- Send to customer (browser: the PDF downloads, then the email opens with the details) ----------
    page.click('[data-send]')
    page.wait_for_selector('.sheet [data-ok]')
    check(page.input_value('.sheet [data-k="to"]') == 'ap@lakesidedental.example', 'the send sheet is addressed to the customer')
    check('The PDF downloads, then your email opens' in page.inner_text('.sheet'), 'in a browser the sheet says the PDF downloads first')
    with page.expect_download() as dl:
        page.click('.sheet [data-ok]')
    check(dl.value.suggested_filename.endswith('.pdf'), 'sending downloads the PDF for the email')
    page.wait_for_selector('.toast')
    check('attach it and press Send' in page.inner_text('.toast'), 'the toast says to attach the PDF')
    page.wait_for_timeout(600)
    check('Sent to ap@lakesidedental.example on' in page.inner_text('body'), 'the invoice page logs the send')

    # ---------- Record a payment ----------
    page.click('[data-payment]')
    page.wait_for_selector('[data-ok]')
    page.click('[data-ok]')
    page.wait_for_selector('.stamp.paid')
    check(page.locator('.pill.paid').count() > 0, 'a full payment marks it paid and stamps the preview')
    shot(page, '07-invoice-paid')

    # ---------- Advanced invoice on a progress project, on the page ----------
    page.goto(BASE + '#/new/advanced', wait_until='networkidle')
    page.click('[data-tool="edit"]')
    page.wait_for_selector('[data-inv]')
    check(page.locator('[data-inv] .add.adv').count() == 0, 'an advanced invoice has no Advanced-only tags')
    page.click('[data-project]')
    page.wait_for_selector('[data-newproj]')
    page.fill('[data-newproj] [data-k="name"]', 'Second-floor exam rooms')
    page.click('[data-newproj] [data-kind="progress"]')
    page.fill('[data-newproj] [data-k="contract"]', '9600')
    page.fill('[data-newproj] [data-k="planned"]', '3')
    page.fill('[data-newproj] [data-k="po"]', 'PO 4471')
    page.fill('[data-newproj] [data-k="retain"]', '10')
    page.click('[data-inv] [data-f="cust.name"]') if False else None
    page.click('[data-create]')
    page.wait_for_selector('[data-inv] .inv-prog')
    txt = page.inner_text('[data-inv]')
    check('1 of 3' in txt and '$9,600.00' in txt, 'the first invoice on the project is 1 of 3 against the contract')
    page.locator('[data-inv] [data-f="cust.name"]').fill('Lakeside Dental')
    page.dispatch_event('[data-inv] [data-f="cust.name"]', 'input')
    page.locator('[data-inv] [data-f="lines.0.d"]').fill('Mobilization and demolition')
    page.dispatch_event('[data-inv] [data-f="lines.0.d"]', 'input')
    page.locator('[data-inv] [data-f="lines.0.r"]').fill('3200')
    page.dispatch_event('[data-inv] [data-f="lines.0.r"]', 'input')
    page.click('[data-inv] [data-tax="0"]')  # labor, not taxed
    page.wait_for_timeout(100)
    txt = page.inner_text('[data-inv]')
    check('-$320.00' in txt, 'retainage of 10 percent comes off the balance')
    check('$2,880.00' in txt, 'the balance due is the total less retainage')
    # signature
    page.click('[data-inv] [data-show="sig"]')
    page.wait_for_selector('.sig-wrap canvas')
    box = page.locator('.sig-wrap canvas').bounding_box()
    page.mouse.move(box['x'] + 30, box['y'] + 100)
    page.mouse.down()
    for i in range(1, 30):
        page.mouse.move(box['x'] + 30 + i * 8, box['y'] + 100 + (30 if i % 2 else -30))
    page.mouse.up()
    page.fill('.sheet [data-k="name"]', 'Dana Hart')
    page.fill('.sheet [data-k="title"]', 'Owner')
    page.click('[data-use]')
    page.wait_for_selector('[data-inv] .sig-img')
    check('Dana Hart, Owner' in page.inner_text('[data-inv]'), 'the signature prints with the name and title')
    shot(page, '08-editor-advanced')
    with page.expect_download() as dl:
        page.click('[data-pdf]')
    r = PdfReader(dl.value.path())
    r.decrypt('')
    text = r.pages[0].extract_text()
    check('PROGRESS ON PO 4471' in text and '1 of 3' in text, 'the PDF carries the progress block')
    check('retainage' in text.lower() and '$2,880.00' in text, 'the PDF carries retainage and the balance')
    check('Dana Hart, Owner' in text and 'Signed electronically' in text, 'the PDF carries the signature line')
    check(len(r.pages[0].images) >= 2, 'the logo and the signature are both in the PDF')

    # second invoice on the same project
    page.goto(BASE + '#/projects', wait_until='networkidle')
    page.click('a.item')
    page.wait_for_selector('a[href^="#/new//"]')
    check('$3,200.00' in page.inner_text('.view'), 'the project page shows what was billed')
    page.click('a[href^="#/new//"]')
    page.wait_for_selector('[data-tier="advanced"]')
    page.click('[data-tier="advanced"]')
    page.click('[data-tool="edit"]')
    page.wait_for_selector('[data-inv] .inv-prog')
    txt = page.inner_text('[data-inv]')
    check('2 of 3' in txt and '$3,200.00' in txt, 'the second invoice is 2 of 3 and shows the first as previously billed')
    check('Lakeside Dental' in txt, 'the customer carries over from the project')
    shot(page, '09-second-progress-invoice')

    # ---------- Lists and backup ----------
    page.goto(BASE + '#/invoices', wait_until='networkidle')
    check(page.locator('.list .item').count() == 3, 'the invoices list shows all three')
    page.goto(BASE + '#/more', wait_until='networkidle')
    with page.expect_download() as dl:
        page.click('[data-backup]')
    check(dl.value.suggested_filename.startswith('billhead-backup-'), 'a backup file downloads')
    shot(page, '10-more')

    # ---------- Reload keeps everything ----------
    page.goto(BASE, wait_until='networkidle')
    check('Hart Electric' in page.inner_text('#hdr'), 'a reload keeps the company')
    check(page.locator('.list .item').count() >= 3, 'a reload keeps the invoices')
    shot(page, '11-home')

    # ---------- Nothing on a phone is wider than the phone ----------
    for route in ['#/', '#/invoices/all', '#/projects']:
        page.goto(BASE + route, wait_until='networkidle')
        page.wait_for_timeout(200)
        sw = page.evaluate('document.documentElement.scrollWidth')
        check(sw <= 390, 'no sideways scrolling on a phone at %s (page is %d px wide)' % (route, sw))
    page.goto(BASE + '#/projects', wait_until='networkidle')
    page.click('a.item')
    page.wait_for_selector('.stats')
    sw = page.evaluate('document.documentElement.scrollWidth')
    check(sw <= 390, 'no sideways scrolling on a project page (page is %d px wide)' % sw)

    # ---------- Desktop layout ----------
    dctx = browser.new_context(viewport={'width': 1280, 'height': 900}, storage_state=ctx.storage_state())
    dpage = dctx.new_page()
    dpage.on('pageerror', lambda e: errors.append(str(e)))
    dpage.goto(BASE, wait_until='networkidle')
    check(dpage.locator('.tabs .rail-brand').is_visible(), 'the tab bar is a left rail on a wide screen')
    shot(dpage, '12-desktop-home')
    dpage.goto(BASE + '#/invoices', wait_until='networkidle')
    dpage.click('a.item')
    dpage.wait_for_selector('[data-inv]')
    shot(dpage, '13-desktop-invoice')

    # ---------- An invoice carried over from TSS Invoice Creator ----------
    import base64, json as _json
    old = {"biz": {"name": "Prairie Plumbing", "addr": "12 Elm St\nPrairie City, IL", "phone": "(555) 010-0199", "email": "office@prairieplumbing.example", "web": "", "taxid": "", "accent": "#12352b", "logo": ""},
           "num": "INV-2207", "date": "2026-11-01", "terms": "Net 15", "due": "2026-11-16", "po": "PO 88", "ref": "", "cust": {"name": "Elm Street Cafe", "attn": "", "addr": "40 Elm St", "email": ""},
           "ship": "", "desc": "", "from": "", "to": "", "lines": [{"d": "Water heater, 50 gal", "q": 1, "r": 1325, "t": True}, {"d": "Labor", "q": 4, "r": 110, "t": False}],
           "disc": "", "tax": 7.25, "freight": "", "paid": "", "prog": {"on": False, "contract": "", "n": 1, "m": 3, "prev": ""}, "pay": {"to": "Prairie Plumbing", "late": "", "instr": "Checks to the address above.", "notes": ""}}
    code = base64.urlsafe_b64encode(_json.dumps({"v": 1, "src": "tss-invoice-creator", "inv": old}).encode()).decode().rstrip("=")
    ictx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    ipage = ictx.new_page()
    ipage.on('pageerror', lambda e: errors.append(str(e)))
    ipage.goto(BASE + '#import=' + code, wait_until='networkidle')
    ipage.wait_for_selector('[data-company-save]')
    check('TSS Invoice Creator' in ipage.inner_text('main') and ipage.input_value('[data-k="name"]') == 'Prairie Plumbing', 'a new device opens the profile filled in from the old tool')
    check('#import=' not in ipage.url, 'the carried-over invoice is cleared from the address')
    ipage.click('[data-company-save]')
    ipage.wait_for_selector('[data-inv]')
    txt = ipage.inner_text('[data-inv]')
    check('INV-2207' in txt and 'Elm Street Cafe' in txt and 'PO 88' in txt, 'saving the profile opens the carried-over invoice, number and PO kept')
    check(ipage.locator('.pill.adv').count() > 0, 'a carried-over invoice with a PO comes over as advanced')
    ipage.goto(BASE + '#import=' + code, wait_until='networkidle')
    ipage.wait_for_selector('[data-inv]')
    check('INV-2208' in ipage.inner_text('[data-inv]'), 'carrying the same invoice over again gives it the next number instead of a duplicate')
    ictx.close()

    # ---------- The launch animation (the Upfront for Small Business family's) ----------
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    import re as _re
    import make_icons
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    appjs = open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()
    check(make_icons.mark() in html, 'the launch animation draws the same mark as the icons')
    check(_re.sub(r' class="[^"]*"| style="--i:\d"', '', make_icons.mark()) in appjs, 'the mark in the header is the same drawing as the icons')
    lctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    lpage = lctx.new_page()
    lpage.on('pageerror', lambda e: errors.append(str(e)))
    lpage.goto(BASE, wait_until='networkidle')
    check(lpage.locator('#uf-intro').count() == 0, 'under test automation the app opens without it')
    lpage.goto(BASE + '?intro=1')
    lpage.wait_for_selector('#uf-intro.uf-go', state='attached', timeout=5000)
    t0 = time.time()
    check(lpage.evaluate('!!document.elementFromPoint(195, 422).closest("#uf-intro")'), 'it covers the app while it plays')
    words = lpage.inner_text('#uf-intro')
    check('Billhead' in words and 'Upfront for Small Business' in words, 'it shows Billhead, then by Upfront for Small Business')
    lpage.wait_for_selector('#uf-intro', state='detached', timeout=6000)
    took = time.time() - t0
    check(2.4 < took < 4.2, 'it ends by itself in about 3 seconds (%.1f s)' % took)
    check(not lpage.evaluate('document.documentElement.classList.contains("uf-on")'), 'nothing of it is left on the page')
    lpage.goto(BASE + '?intro=1')
    lpage.wait_for_selector('#uf-intro.uf-go', state='attached', timeout=5000)
    lpage.wait_for_timeout(500)
    t0 = time.time()
    lpage.mouse.click(195, 422)
    lpage.wait_for_selector('#uf-intro', state='detached', timeout=3000)
    check(time.time() - t0 < 1.0, 'a tap skips it')
    lctx.close()
    # Once a session: a person (no automation) sees it when the app opens, not again on a reload.
    sctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    sctx.add_init_script('Object.defineProperty(navigator, "webdriver", { get: function () { return false; } });')
    spage = sctx.new_page()
    spage.on('pageerror', lambda e: errors.append(str(e)))
    spage.goto(BASE)
    try:
        spage.wait_for_selector('#uf-intro.uf-go', state='attached', timeout=5000)
        played = True
    except Exception:
        played = False
    check(played, 'it plays when the app opens')
    spage.reload(wait_until='networkidle')
    check(spage.locator('#uf-intro').count() == 0, 'it does not play again in the same session')
    sctx.close()

    check(not errors, 'no page errors' + ('' if not errors else ': ' + '; '.join(errors[:3])))
    browser.close()

print()
print('%d checks, %d failed' % (len(fails) + 0 if False else 0, len(fails)) if False else ('ALL PASSED' if not fails else '%d FAILED:\n  ' % len(fails) + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
