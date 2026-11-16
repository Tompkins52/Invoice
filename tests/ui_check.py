"""Walks the app the way a person would, in headless Chromium, and checks the PDF it makes.
Run from the repo root: python3 tests/ui_check.py [--shots]

Covers: the first screen (one question), the first invoice through the questions (five, two of them asked
once), the same invoice on the page, the PDF (encrypted, print and copy allowed, editing not, the right text
on it), sending, a payment, a second invoice (three questions, the customer a tap away, the back button one
question back), an advanced invoice on a progress project (two invoices, the second shows what the first
billed), a signature, the launch animation (the same mark as the icons, about 3 seconds, a tap skips it,
once a session), and the things that went wrong once."""
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

    # ---------- The first screen: one question ----------
    check(page.url.endswith('#/welcome'), 'a new device opens on the first screen')
    check(page.locator('main input[type="text"], main textarea, main select').count() == 1, 'it asks for one thing: what the business is called')
    page.click('[data-first]')
    page.wait_for_selector('.toast')
    check(page.url.endswith('#/welcome'), 'and will not go on without it')
    # The message that says so comes up in the middle of the screen from its first frame (it used to start half its width to the right).
    off = page.evaluate('''() => { var t = document.querySelector(".toast"), a = t.getAnimations()[0]; if (a) { a.pause(); a.currentTime = 0; } var r = t.getBoundingClientRect(); var d = Math.abs((r.left + r.right) / 2 - window.innerWidth / 2); if (a) a.finish(); return d; }''')
    check(off < 2, 'a message comes up centred, not from the side (%.1f px off)' % off)
    fill(page, '[data-k="name"]', 'Hart Electric LLC')
    page.set_input_files('[data-logo]', os.path.join(ROOT, 'tests', 'fixtures', 'logo.png'))
    page.wait_for_selector('[data-logo-clear]')
    check(page.input_value('[data-k="name"]') == 'Hart Electric LLC', 'adding a logo keeps the name that was typed')
    shot(page, '01-welcome')
    page.click('[data-first]')

    # ---------- The first invoice, through the questions ----------
    page.wait_for_selector('[data-step="customer"]')
    check('#/ask/' in page.url and page.url.endswith('/customer'), 'Make my first invoice goes straight to the first question')
    check('1 of 5' in page.inner_text('.wiz'), 'the first invoice is five questions: who, what, when, your details, how to be paid')
    first_id = page.url.split('#/ask/')[1].split('/')[0]
    fill(page, '[data-k="cust.name"]', 'Lakeside Dental')
    fill(page, '[data-k="cust.addr"]', '42 Lakeview Dr\nPrairie City, IL 60000')
    fill(page, '[data-k="cust.email"]', 'ap@lakesidedental.example')
    shot(page, '03-ask-customer')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="work"]')
    page.fill('[data-line="0"] [data-l="d"]', 'Service call, replace failed GFCI outlets (3)')
    page.fill('[data-line="0"] [data-l="r"]', '285')
    page.click('[data-addline]')
    page.fill('[data-line="1"] [data-l="d"]', 'GFCI outlets')
    page.fill('[data-line="1"] [data-l="q"]', '3')
    page.fill('[data-line="1"] [data-l="r"]', '24.50')
    page.wait_for_timeout(100)
    check('$73.50' in page.inner_text('[data-line="1"]'), 'a line amount follows the quantity and rate as they are typed')
    check('$358.50' in page.inner_text('[data-t="sub"]'), 'the subtotal adds up under the lines (285 + 3 x 24.50)')
    page.fill('[data-totals] [data-k="tax"]', '7.25')
    page.wait_for_timeout(100)
    check('$25.99' in page.inner_text('[data-t="tax"]') and '$384.49' in page.inner_text('[data-t="total"]'), 'the tax rate is typed in the totals, and the total follows')
    check(page.locator('[data-addpart="disc"]').count() == 1 and page.locator('[data-addpart="deposit"]').count() == 1 and page.locator('[data-addpart="freight"]').count() == 0, 'a simple invoice offers a discount and a deposit, not the advanced parts')
    page.click('[data-addpart="disc"]')
    page.fill('[data-totals] [data-k="disc"]', '10')
    page.wait_for_timeout(100)
    check('-$10.00' in page.inner_text('[data-t="disc"]') and '$373.77' in page.inner_text('[data-t="total"]'), 'a discount comes off before tax')
    page.click('[data-rmpart="disc"]')
    page.wait_for_selector('[data-addpart="disc"]')
    check('$384.49' in page.inner_text('[data-t="total"]'), 'and removing it puts the total back')
    shot(page, '04-ask-lines')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="dates"]')
    check('usual tax rate' in page.inner_text('.toast'), 'the first tax rate typed is kept as the usual one')
    page.click('[data-terms="Net 15"]')
    page.wait_for_timeout(100)
    due = page.input_value('[data-k="due"]')
    date = page.input_value('[data-k="date"]')
    check(due > date, 'picking Net 15 sets a due date after the invoice date')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="details"]')
    fill(page, '[data-k="addr"]', '300 Main St, Suite 2\nPrairie City, IL 60000')
    fill(page, '[data-k="phone"]', '(555) 010-0142')
    fill(page, '[data-k="email"]', 'office@hartelectric.example')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="pay"]')
    fill(page, '[data-k="pay.instr"]', 'Mail checks to the address above, or ask for our ACH letter.')
    fill(page, '[data-k="pay.link"]', 'https://pay.example/hart')
    check('See the invoice' in page.inner_text('[data-next]'), 'the last question says what comes next')
    page.click('[data-next]')
    page.wait_for_selector('[data-more]')
    check('#/inv/' + first_id in page.url, 'the last question lands on the invoice, ready to send')
    shot(page, '05-invoice-ready')
    txt = page.inner_text('[data-inv]')
    check('Lakeside Dental' in txt and 'GFCI' in txt, 'the invoice shows what was typed')
    check('$358.50' in txt and '$384.49' in txt, 'with the subtotal and the total')
    check('300 Main St' in txt and '(555) 010-0142' in txt and 'ACH letter' in txt, 'and the details and payment instructions asked along the way')
    co = page.evaluate('JSON.parse(localStorage.getItem("billhead.v1")).company')
    check(co['taxRate'] == 7.25 and co['terms'] == 'Net 15' and 'Main St' in co['addr'] and 'ACH letter' in co['payInstr'] and co['payLink'] == 'https://pay.example/hart', 'those answers are now the company profile')
    check(page.locator('[data-send]').count() == 1 and 'primary' in page.get_attribute('[data-send]', 'class'), 'Send to customer leads the invoice page')

    # ---------- Edit it on the page ----------
    page.click('[data-go^="#/edit/"]')
    page.wait_for_selector('[data-inv] [data-f="lines.1.q"]')
    check(page.locator('[data-inv] .add.adv').count() == 1, 'on a simple invoice the advanced parts are one link, not a tag on every part')
    check(page.locator('[data-inv] [data-show="po"]').count() == 0, 'and the advanced add links are not shown')
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
    # the details at the top can be changed from the invoice
    page.click('[data-inv] [data-show="biz"]')
    page.wait_for_selector('.sheet [data-k="web"]')
    page.fill('.sheet [data-k="web"]', 'hartelectric.example')
    page.click('.sheet [data-ok]')
    page.wait_for_timeout(200)
    check('hartelectric.example' in page.inner_text('[data-inv]'), 'the details at the top of the invoice can be changed from the invoice')
    shot(page, '06-editor-simple')

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
    lead = page.evaluate('(function () { var b = document.querySelector(".send-row > :first-child"); return b.hasAttribute("data-payment") ? "payment" : b.hasAttribute("data-send") ? "send" : "other"; })()')
    check(lead == 'payment' and 'primary' not in page.get_attribute('[data-send]', 'class') and 'Send again' in page.inner_text('[data-send]'), 'once an invoice is out, Record a payment leads and sending is a plain Send again')
    shot(page, '07-invoice-detail')

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
    check(page.locator('[data-payment]').count() == 0 and page.locator('.send-row .primary, .send-row .green').count() == 0, 'a paid invoice asks for nothing more')
    shot(page, '07-invoice-paid')

    # ---------- A second invoice: three questions, the customer a tap away ----------
    page.goto(BASE + '#/', wait_until='networkidle')
    page.click('[data-new="simple"]')
    page.wait_for_selector('[data-tool="ask"]')
    check(True, 'the first time from Home, the app asks which way to make invoices')
    page.click('[data-tool="ask"]')
    page.wait_for_selector('[data-step="customer"]')
    check('1 of 3' in page.inner_text('.wiz'), 'after the first, an invoice is three questions')
    second_id = page.url.split('#/ask/')[1].split('/')[0]
    check('Lakeside Dental' in page.inner_text('[data-sugg]'), 'the customer billed before is offered by name')
    page.fill('[data-k="cust.name"]', 'zz')
    page.wait_for_timeout(100)
    check(page.locator('[data-sugg]').is_hidden(), 'the offer narrows as a name is typed')
    page.fill('[data-k="cust.name"]', 'lake')
    page.wait_for_timeout(100)
    page.click('[data-sugg] [data-client]')
    page.wait_for_timeout(100)
    check(page.input_value('[data-k="cust.email"]') == 'ap@lakesidedental.example' and 'Lakeview' in page.input_value('[data-k="cust.addr"]'), 'a tap fills in their address and email')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="work"]')
    check('7.25' == page.input_value('[data-totals] [data-k="tax"]'), 'the usual tax rate is already there')
    page.fill('[data-line="0"] [data-l="d"]', 'GFCI outlets')
    page.dispatch_event('[data-line="0"] [data-l="d"]', 'change')
    check(page.input_value('[data-line="0"] [data-l="r"]') == '24.5', 'a line used before brings its rate')
    # the phone's back button goes one question back, on the same invoice
    page.go_back()
    page.wait_for_selector('[data-step="customer"]')
    check(second_id in page.url and page.input_value('[data-k="cust.name"]') == 'Lakeside Dental', 'the back button goes one question back, on the same invoice')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="work"]')
    check(page.input_value('[data-line="0"] [data-l="d"]') == 'GFCI outlets', 'and what was typed on the question left behind was kept')
    page.keyboard.press('Tab')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="dates"]')
    check('Net 15' in page.inner_text('.chip.on'), 'the usual terms are already picked')
    page.click('[data-prev]')
    page.wait_for_selector('[data-step="work"]')
    page.click('[data-next]')
    page.wait_for_selector('[data-step="dates"]')
    page.click('[data-next]')
    page.wait_for_selector('[data-more]')
    check('#/inv/' + second_id in page.url, 'three questions later the invoice is ready')
    n_inv = page.evaluate('JSON.parse(localStorage.getItem("billhead.v1")).invoices.length')
    check(n_inv == 2, 'going back and forth made no extra invoices (%d)' % n_inv)
    # from now on a new invoice opens the questions directly; closing an untouched one leaves nothing behind
    page.goto(BASE + '#/', wait_until='networkidle')
    page.click('[data-new="simple"]')
    page.wait_for_selector('[data-step="customer"]')
    check(page.locator('[data-tool]').count() == 0, 'the way to make invoices is remembered: no second choice')
    page.click('#hdr [data-close]')
    page.wait_for_selector('[data-new="simple"]')
    st = page.evaluate('JSON.parse(localStorage.getItem("billhead.v1"))')
    check(len(st['invoices']) == 2 and st['company']['next'] == 1003, 'closing a new invoice nobody typed into leaves no draft and keeps its number')
    # typed, then closed: kept as a draft
    page.click('[data-new="simple"]')
    page.wait_for_selector('[data-step="customer"]')
    page.fill('[data-k="cust.name"]', 'Oak Street Bakery')
    page.click('#hdr [data-close]')
    page.wait_for_selector('[data-more]')
    check('Oak Street Bakery' in page.inner_text('main') and 'draft' in page.inner_text('.pill').lower(), 'closing the questions keeps what was typed as a draft')
    # a different name typed over a picked customer does not rename the saved customer
    page.click('[data-go^="#/edit/"]')
    page.wait_for_selector('[data-inv] [data-f="cust.name"]')
    page.click('[data-inv] [data-show="client"]')
    page.click('.sheet [data-pick]')
    page.wait_for_timeout(150)
    page.locator('[data-inv] [data-f="cust.name"]').fill('Oak Street Bakery')
    page.dispatch_event('[data-inv] [data-f="cust.name"]', 'input')
    page.locator('[data-inv] [data-f="lines.0.d"]').fill('Sign lighting repair')
    page.dispatch_event('[data-inv] [data-f="lines.0.d"]', 'input')
    page.locator('[data-inv] [data-f="lines.0.r"]').fill('420')
    page.dispatch_event('[data-inv] [data-f="lines.0.r"]', 'input')
    with page.expect_download():
        page.click('[data-pdf]')
    page.wait_for_timeout(400)
    names = page.evaluate('JSON.parse(localStorage.getItem("billhead.v1")).clients.map(function (c) { return c.name; }).sort()')
    check(names == ['Lakeside Dental', 'Oak Street Bakery'], 'a new name typed over a picked customer makes a new customer; the saved one keeps its name (%s)' % ', '.join(names))

    # ---------- More: how a new invoice opens ----------
    page.goto(BASE + '#/more', wait_until='networkidle')
    check('on' in page.get_attribute('[data-settool="ask"]', 'class'), 'More shows the way that was picked')
    page.click('[data-settool="edit"]')
    page.wait_for_timeout(100)
    check(page.evaluate('JSON.parse(localStorage.getItem("billhead.v1")).settings.tool') == 'edit', 'and changes it')

    # ---------- Advanced invoice on a progress project, on the page ----------
    page.goto(BASE + '#/', wait_until='networkidle')
    page.click('[data-new="advanced"]')
    page.wait_for_selector('[data-inv]')
    check('#/edit/' in page.url and page.locator('[data-tool]').count() == 0, 'with On the page picked in More, a new invoice opens as the page')
    check(page.locator('[data-inv] .add.adv').count() == 0 and page.locator('[data-inv] [data-show="po"]').count() == 1, 'an advanced invoice shows its own add links, with no switch-to-advanced link')
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
    page.wait_for_selector('a[href^="#/new/advanced/"]')
    check('$3,200.00' in page.inner_text('.view'), 'the project page shows what was billed')
    page.click('a[href^="#/new/advanced/"]')
    page.wait_for_selector('[data-inv] .inv-prog')
    check(page.locator('[data-tier]').count() == 0, 'a new invoice on a progress project is advanced without asking which kind')
    txt = page.inner_text('[data-inv]')
    check('2 of 3' in txt and '$3,200.00' in txt, 'the second invoice is 2 of 3 and shows the first as previously billed')
    check('Lakeside Dental' in txt, 'the customer carries over from the project')
    page.locator('[data-inv] [data-f="lines.0.d"]').fill('Rough-in, second floor')
    page.dispatch_event('[data-inv] [data-f="lines.0.d"]', 'input')
    page.locator('[data-inv] [data-f="lines.0.r"]').fill('2900')
    page.dispatch_event('[data-inv] [data-f="lines.0.r"]', 'input')
    shot(page, '09-second-progress-invoice')

    # ---------- Lists and backup ----------
    page.goto(BASE + '#/invoices', wait_until='networkidle')
    check(page.locator('.list .item').count() == 5, 'the invoices list shows all five')
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

    # ---------- Embedded in a preview: routes in memory, files to the host page ----------
    pctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    pctx.add_init_script('window.BHPreview = { saved: [], save: function (name, blob) { this.saved.push(name + ":" + blob.size); return Promise.resolve(); } };')
    ppage = pctx.new_page()
    ppage.on('pageerror', lambda e: errors.append(str(e)))
    ppage.goto(BASE, wait_until='networkidle')
    ppage.click('[data-sample]')
    ppage.wait_for_selector('.list .item')
    check('Hart Electric' in ppage.inner_text('#hdr') and ppage.evaluate('location.hash') == '', 'in a preview the screens change without touching the address')
    ppage.click('.list .item')
    ppage.wait_for_selector('[data-pdf]')
    ppage.click('[data-pdf]')
    ppage.wait_for_function('window.BHPreview.saved.length > 0', timeout=30000)
    saved = ppage.evaluate('window.BHPreview.saved[0]')
    check(saved.split(':')[0].endswith('.pdf') and int(saved.split(':')[1]) > 10000, 'and a PDF goes to the page that hosts the preview (%s)' % saved.split(':')[0])
    pctx.close()
    # The first invoice, start to finish, with no address bar to lean on.
    pctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    pctx.add_init_script('window.BHPreview = { saved: [], save: function (name, blob) { this.saved.push(name + ":" + blob.size); return Promise.resolve(); } };')
    ppage = pctx.new_page()
    ppage.on('pageerror', lambda e: errors.append(str(e)))
    ppage.goto(BASE, wait_until='networkidle')
    ppage.fill('[data-k="name"]', 'Ridgeline Lawn Care')
    ppage.click('[data-first]')
    ppage.wait_for_selector('[data-step="customer"]')
    ppage.fill('[data-k="cust.name"]', 'Dana Whitfield')
    ppage.click('[data-next]')
    ppage.wait_for_selector('[data-step="work"]')
    ppage.fill('[data-line="0"] [data-l="d"]', 'Fall cleanup')
    ppage.fill('[data-line="0"] [data-l="r"]', '240')
    ppage.click('[data-prev]')
    ppage.wait_for_selector('[data-step="customer"]')
    check(ppage.input_value('[data-k="cust.name"]') == 'Dana Whitfield', 'in a preview, Back goes one question back')
    ppage.click('[data-next]')
    ppage.wait_for_selector('[data-step="work"]')
    check(ppage.input_value('[data-line="0"] [data-l="r"]') == '240', 'and what was typed is still there')
    for step in ['dates', 'details', 'pay']:
        ppage.click('[data-next]')
        ppage.wait_for_selector('[data-step="%s"]' % step)
    ppage.click('[data-next]')
    ppage.wait_for_selector('[data-more]')
    check('$240.00' in ppage.inner_text('main') and ppage.evaluate('location.hash') == '', 'the five questions end on the invoice, the address untouched')
    ppage.click('#hdr [data-go^="#/edit/"]')
    ppage.wait_for_selector('[data-inv] [data-f="cust.name"]')
    ppage.click('[data-options]')
    ppage.click('.sheet [data-go^="#/ask/"]')
    ppage.wait_for_selector('[data-step]')
    ppage.click('#hdr [data-close]')
    ppage.wait_for_selector('[data-more]')
    check(ppage.evaluate('JSON.parse(localStorage.getItem("billhead.v1")).invoices.length') == 1, 'switching tools and closing the questions leaves the one invoice')
    pctx.close()

    # ---------- The launch animation (the Upfront for Small Business family's) ----------
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    import make_icons
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    appjs = open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()
    check(make_icons.intro_mark() in html, 'the launch animation draws the same mark as the icons')
    check(make_icons.intro_family() in html, 'and the family mark comes from the same drawing script')
    check(make_icons.header_mark() in appjs, 'the mark in the header is the same drawing as the icons')
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
    # When every part has finished moving, the two marks are the drawings themselves: nothing shifted, scaled or
    # faded, and the strokes that jump out from under the stamp are gone again.
    moving = lpage.evaluate('''() => {
      var parts = Array.prototype.slice.call(document.querySelectorAll("#uf-intro .uf-mark > svg, #uf-intro .uf-fam > svg"));
      var done = [];
      parts.forEach(function (p) { p.getAnimations().forEach(function (a) { done.push(a.finished); }); });
      return Promise.all(done).then(function () {
        return parts.filter(function (p) {
          var s = getComputedStyle(p), still = s.transform === "none" || s.transform === "matrix(1, 0, 0, 1, 0, 0)";
          return p.classList.contains("bh-burst") ? s.opacity !== "0" : !(still && s.opacity === "1");
        }).map(function (p) { return p.getAttribute("class"); });
      });
    }''')
    check(moving == [], 'it ends on the finished marks, every part at rest' + ('' if moving == [] else ' (not: %s)' % ', '.join(moving)))
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

    # ---------- Smaller things that went wrong once (November 15) ----------
    seed_js = open(os.path.join(ROOT, 'tools', 'sample_company.js'), encoding='utf-8').read()

    def seeded(**kw):
        c = browser.new_context(viewport={'width': 360, 'height': 740}, device_scale_factor=1, accept_downloads=True, **kw)
        pg = c.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(BASE + 'icons/icon-192.png', wait_until='domcontentloaded')
        pg.evaluate(seed_js + '; seed({logo: SAMPLE_LOGO, ask: false})')
        return c, pg

    # A new invoice nobody typed into is not kept, and its number is given back.
    fctx, fp = seeded()
    fp.goto(BASE + '#/new/simple', wait_until='networkidle')
    fp.click('[data-tool="edit"]')
    fp.wait_for_selector('[data-inv]')
    check('INV-1046' in fp.inner_text('#hdr'), 'a new invoice takes the next number')
    fp.goto(BASE + '#/invoices', wait_until='networkidle')
    check('INV-1046' not in fp.inner_text('main') and fp.locator('.list .item').count() == 6, 'left untouched, it is not kept as an empty draft')
    check(fp.evaluate('JSON.parse(localStorage.getItem("billhead.v1")).company.next') == 1046, 'and its number is given back')
    fp.goto(BASE + '#/new/simple', wait_until='networkidle')
    fp.wait_for_selector('[data-inv]')
    fp.locator('[data-inv] [data-f="cust.name"]').fill('Oak Street Bakery')
    fp.dispatch_event('[data-inv] [data-f="cust.name"]', 'input')
    fp.wait_for_timeout(500)
    fp.goto(BASE + '#/invoices', wait_until='networkidle')
    check('INV-1046' in fp.inner_text('main'), 'once something is typed, it stays as a draft')

    # A new screen opens at its top; the back button returns to where the person was.
    fp.goto(BASE + '#/more', wait_until='networkidle')
    fp.evaluate('window.scrollTo(0, 600)')
    fp.wait_for_timeout(100)
    was = fp.evaluate('window.scrollY')
    fp.click('a[href="#/invoices"]')
    fp.wait_for_selector('[data-q]')
    check(was > 300 and fp.evaluate('window.scrollY') == 0, 'a new screen opens at its top')
    fp.go_back()
    fp.wait_for_selector('[data-backup]')
    fp.wait_for_timeout(200)
    check(abs(fp.evaluate('window.scrollY') - was) < 40, 'going back returns to where the person was (%d, was %d)' % (fp.evaluate('window.scrollY'), was))

    # The invoice page: one main button. On a draft it is Send; the PDF button is plain. (The sent line is checked below.)
    fp.goto(BASE + '#/inv/i1044', wait_until='networkidle')
    fp.wait_for_selector('[data-send]')
    check('primary' in fp.get_attribute('[data-send]', 'class') and 'primary' not in fp.get_attribute('[data-pdf]', 'class') and fp.locator('.send-row .primary, .send-row .green').count() == 1, 'on a draft, Send to customer is the one main button; the PDF button is plain')
    fp.goto(BASE + '#/inv/i1043', wait_until='networkidle')
    fp.wait_for_selector('[data-payment]')
    check(fp.locator('.send-row .primary, .send-row .green').count() == 1 and fp.locator('.send-row .green[data-payment]').count() == 1, 'on an invoice that went out, Record a payment is the one main button')
    fctx.close()

    # 8:30 in the evening in Chicago is already tomorrow in Greenwich: the app must say today.
    tctx, tp = seeded(timezone_id='America/Chicago')
    tp.clock.install(time='2026-11-16T02:30:00Z')
    tp.goto(BASE + '#/inv/i1043', wait_until='networkidle')
    tp.click('[data-send]')
    tp.wait_for_selector('.sheet [data-ok]')
    with tp.expect_download():
        tp.click('.sheet [data-ok]')
    tp.wait_for_selector('.note-line')
    line = tp.inner_text('.note-line')
    check('November 15, 2026' in line, 'the sent line shows the day on this phone, not the day in Greenwich (%s)' % line.strip())
    box = tp.locator('.note-line svg').bounding_box()
    check(box and box['width'] <= 20 and box['height'] <= 20, 'the envelope beside it is a small icon (%s)' % (box and '%d x %d' % (box['width'], box['height'])))
    tctx.close()

    # A share the person cancels does not mark the invoice sent.
    sctx2, sp = seeded()
    sp.add_init_script('navigator.canShare = function () { return true; }; navigator.share = function () { var e = new Error("cancelled"); e.name = "AbortError"; return Promise.reject(e); };')
    sp.goto(BASE + '#/inv/i1044', wait_until='networkidle')
    sp.wait_for_selector('[data-share]')
    sp.click('[data-share]')
    sp.wait_for_timeout(1500)
    check(sp.evaluate('JSON.parse(localStorage.getItem("billhead.v1")).invoices.filter(function (i) { return i.id === "i1044"; })[0].status') == 'draft', 'a share that was cancelled leaves the invoice a draft')
    sctx2.close()

    # With no phone or email on file, the invoice does not end on a bare "Questions?".
    qctx, qp = seeded()
    qp.evaluate('var s = JSON.parse(localStorage.getItem("billhead.v1")); s.company.phone = ""; s.company.email = ""; localStorage.setItem("billhead.v1", JSON.stringify(s));')
    qp.goto(BASE + '#/inv/i1043', wait_until='networkidle')
    check('Questions?' not in qp.inner_text('[data-inv]'), 'no bare "Questions?" on the invoice when there is no phone or email')
    with qp.expect_download() as dl:
        qp.click('[data-pdf]')
    rq = PdfReader(dl.value.path())
    rq.decrypt('')
    check('Questions?' not in rq.pages[0].extract_text(), 'nor on the PDF')
    # Nothing on the editor is wider than a small phone.
    qp.goto(BASE + '#/edit/i1040', wait_until='networkidle')
    qp.wait_for_selector('[data-inv]')
    wide = qp.evaluate('''() => { var inv = document.querySelector("[data-inv]"), r = inv.getBoundingClientRect(); return Array.prototype.slice.call(inv.querySelectorAll("*")).filter(function (e) { var b = e.getBoundingClientRect(); return b.width > 0 && b.right > r.right + 1; }).map(function (e) { return (e.className || e.tagName) + ""; }).slice(0, 5); }''')
    check(wide == [], 'nothing on the invoice runs off the right edge of a 360 px phone' + ('' if wide == [] else ' (%s)' % ', '.join(wide)))
    qctx.close()

    # ---------- An easier start (November 15) ----------
    # Looking around first: Home says once what the invoices still lack, and can be told to wait.
    ectx = browser.new_context(viewport={'width': 360, 'height': 740}, device_scale_factor=1, accept_downloads=True)
    ep = ectx.new_page()
    ep.on('pageerror', lambda e: errors.append(str(e)))
    ep.goto(BASE, wait_until='networkidle')
    ep.fill('[data-k="name"]', 'Ridgeline Lawn Care')
    ep.click('[data-company-save]')
    ep.wait_for_selector('[data-new="simple"]')
    check('Finish your profile' in ep.inner_text('main') and 'how customers pay you' in ep.inner_text('main'), 'after Look around first, Home says what the invoices still lack')
    ep.click('a[href="#/company/home"]')
    ep.wait_for_selector('[data-company] [data-k="addr"]')
    ep.fill('[data-company] [data-k="addr"]', '18 Ridge Rd\nElburn, IL 60119')
    ep.fill('[data-company] [data-k="phone"]', '(555) 010-0177')
    ep.fill('[data-company] [data-k="payInstr"]', 'Check or cash on completion.')
    ep.click('[data-company-save]')
    ep.wait_for_selector('[data-new="simple"]')
    check(ep.url.endswith('#/') and 'Finish your profile' not in ep.inner_text('main'), 'filling the profile in from that card comes back to Home, and the card is gone')
    # With the profile filled in, the first invoice is the three questions; nothing is asked twice.
    ep.click('[data-new="simple"]')
    ep.click('[data-tool="ask"]')
    ep.wait_for_selector('[data-step="customer"]')
    check('1 of 3' in ep.inner_text('.wiz'), 'a profile that is already filled in is not asked for again')
    # What is typed is kept as it is typed, with no Next pressed.
    ep.fill('[data-k="cust.name"]', 'Dana Whitfield')
    ep.wait_for_timeout(1200)
    kept_id = ep.url.split('#/ask/')[1].split('/')[0]
    ep.reload(wait_until='networkidle')
    ep.wait_for_selector('[data-step="customer"]')
    check(ep.input_value('[data-k="cust.name"]') == 'Dana Whitfield', 'what is typed is kept without pressing Next, through a reload')
    # Enter on the phone's keyboard moves on.
    ep.click('[data-k="cust.name"]')
    ep.keyboard.press('Enter')
    check(ep.evaluate('document.activeElement.getAttribute("data-k")') == 'cust.email', 'Enter moves to the next field')
    ep.click('[data-next]')
    ep.wait_for_selector('[data-step="work"]')
    ep.fill('[data-line="0"] [data-l="d"]', 'Fall cleanup, front and back yard')
    ep.keyboard.press('Enter')
    check(ep.evaluate('document.activeElement.getAttribute("data-l")') == 'r', 'in a line, Enter goes from the description to the rate')
    ep.keyboard.type('240')
    ep.wait_for_timeout(100)
    check('$240.00' in ep.inner_text('[data-t="total"]'), 'the total is on the screen as the rate is typed')
    ep.click('[data-next]')
    ep.wait_for_selector('[data-step="dates"]')
    ep.click('[data-k="num"]')
    ep.keyboard.press('Enter')
    ep.wait_for_selector('[data-more]')
    check('#/inv/' + kept_id in ep.url, 'on the last question, Enter shows the invoice')
    # The editor keeps the sending buttons within reach at the bottom of the screen.
    ep.click('[data-go^="#/edit/"]')
    ep.wait_for_selector('[data-inv]')
    bar = ep.locator('.wiz-nav.act [data-send]').bounding_box()
    check(bar and bar['y'] + bar['height'] <= 740 and bar['y'] > 600, 'in the editor, Send to customer stays at the bottom of the screen')
    top = ep.locator('[data-inv] [data-f="cust.name"]').bounding_box()
    check(top and top['y'] < 740, 'and the customer is on the first screen of the editor, not below it (%d px down)' % (top['y'] if top else -1))
    ep.click('[data-options]')
    ep.wait_for_selector('.sheet [data-upgrade]')
    check(ep.locator('.sheet [data-k="paper"]').count() == 1 and ep.locator('.sheet [data-go^="#/ask/"]').count() == 1, 'the settings that used to sit above the invoice are behind one Options button')
    ep.click('.sheet [data-ok]')
    ep.wait_for_timeout(200)
    ep.click('.wiz-nav.act [data-send]')
    ep.wait_for_selector('.sheet [data-k="to"]')
    ep.fill('.sheet [data-k="to"]', 'dana@whitfield.example')
    with ep.expect_download():
        ep.click('.sheet [data-ok]')
    ep.wait_for_selector('.note-line')
    check('#/inv/' + kept_id in ep.url and 'Sent to dana@whitfield.example' in ep.inner_text('.note-line'), 'sending from the editor lands on the invoice page, which says where it went')
    ectx.close()

    # The numbers at the top of Home open the lists they count.
    hctx, hp = seeded()
    hp.goto(BASE + '#/', wait_until='networkidle')
    hp.click('.hero a.chip[href="#/invoices/open"]')
    hp.wait_for_selector('.list .item')
    check(hp.url.endswith('#/invoices/open'), 'the open-invoices count on Home opens the open invoices')
    # A company from before today is not asked the first-invoice questions.
    hp.goto(BASE + '#/new/simple', wait_until='networkidle')
    hp.click('[data-tool="ask"]')
    hp.wait_for_selector('[data-step="customer"]')
    check('1 of 3' in hp.inner_text('.wiz'), 'a company set up before this change gets the three questions, not five')
    # The sample company is one tap from the first screen.
    hctx.close()
    xctx = browser.new_context(viewport={'width': 360, 'height': 740}, device_scale_factor=1)
    xp = xctx.new_page()
    xp.on('pageerror', lambda e: errors.append(str(e)))
    xp.goto(BASE, wait_until='networkidle')
    xp.click('[data-sample]')
    xp.wait_for_selector('[data-new="simple"]')
    check('Hart Electric' in xp.inner_text('#hdr') and xp.locator('.list .item').count() >= 2, 'the sample company loads from the first screen')
    xctx.close()

    check(not errors, 'no page errors' + ('' if not errors else ': ' + '; '.join(errors[:3])))
    browser.close()

print()
print('%d checks, %d failed' % (len(fails) + 0 if False else 0, len(fails)) if False else ('ALL PASSED' if not fails else '%d FAILED:\n  ' % len(fails) + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
