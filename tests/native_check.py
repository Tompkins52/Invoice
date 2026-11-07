"""Checks the app's native path: what js/app.js does when the Android shell (window.BHNative) is present.
Run from the repo root after tools/assemble_native.py: python3 tests/native_check.py

The shell is stubbed here (no emulator): the stub records every call. Covers the splash and status bar
calls, the state file written on every save, a fresh install restored from that file alone (the way a new
phone gets the data back), Share PDF and Save to phone going through the shell, and the back button."""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
WWW = os.path.join(ROOT, 'native', 'www')
fails = []


def check(ok, what):
    print(('ok    ' if ok else 'FAIL  ') + what)
    if not ok:
        fails.append(what)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


if not os.path.isfile(os.path.join(WWW, 'native.js')):
    sys.exit('native/www is not assembled; run python3 tools/assemble_native.py first')

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=WWW))
BASE = 'http://127.0.0.1:%d/' % srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

STUB = r'''
window.__native = { calls: [], state: %s, backs: [] };
window.BHNative = {
  platform: "android",
  saveState: function (t) { __native.calls.push("saveState"); __native.state = t; return Promise.resolve(); },
  loadState: function () { __native.calls.push("loadState"); return Promise.resolve(__native.state); },
  sharePdf: function (bytes, name, title) { __native.calls.push("sharePdf:" + name + ":" + (bytes.byteLength || bytes.length) + ":" + title); return Promise.resolve({ activityType: "x" }); },
  emailPdf: function (bytes, name, mail) { __native.calls.push("emailPdf:" + name + ":" + (bytes.byteLength || bytes.length) + ":" + mail.to + ":" + mail.subject); __native.mail = mail; return Promise.resolve({}); },
  saveFile: function (bytes, name, mime) { __native.calls.push("saveFile:" + name + ":" + (bytes.byteLength || bytes.length) + ":" + mime); return Promise.resolve("Documents/Billhead/" + name); },
  setDark: function (d) { __native.calls.push("setDark:" + d); return Promise.resolve(); },
  onBack: function (fn) { __native.backs.push(fn); },
  minimize: function () { __native.calls.push("minimize"); return Promise.resolve(); },
  ready: function () { __native.calls.push("ready"); },
  info: function () { return Promise.resolve({ name: "Billhead", id: "com.tompkinssoftwaresystems.billhead", build: "1", version: "1.0.0" }); }
};
'''


def calls(page):
    return page.evaluate('window.__native.calls')


with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # ---------- A fresh install ----------
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    ctx.add_init_script(STUB % 'null')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('window.__native.calls.indexOf("ready") >= 0')
    c = calls(page)
    check('loadState' in c, 'the app asks the shell for the state file at start')
    check('ready' in c and c.index('ready') > c.index('loadState'), 'the splash is hidden after the state file is read')
    check(any(x.startswith('setDark:') for x in c), 'the status bar is set to match the look')
    check(len(page.evaluate('window.__native.backs')) == 1, 'the back button handler is registered')
    check(page.url.endswith('#/welcome'), 'a fresh install opens on the company profile')

    page.fill('[data-k="name"]', 'Hart Electric LLC')
    page.fill('[data-k="addr"]', '300 Main St\nPrairie City, IL 60000')
    page.click('[data-company-save]')
    page.wait_for_selector('[data-new="simple"]')
    page.wait_for_function('window.__native.calls.indexOf("saveState") >= 0')
    state = json.loads(page.evaluate('window.__native.state'))
    check(state.get('company', {}).get('name') == 'Hart Electric LLC', 'saving the profile writes the state file through the shell')

    page.goto(BASE + '#/new/simple', wait_until='networkidle')
    page.click('[data-tool="edit"]')
    page.wait_for_selector('[data-inv]')
    page.locator('[data-inv] [data-f="cust.name"]').fill('Prairie Dental')
    page.dispatch_event('[data-inv] [data-f="cust.name"]', 'input')
    page.locator('[data-inv] [data-f="lines.0.d"]').fill('Panel upgrade')
    page.dispatch_event('[data-inv] [data-f="lines.0.d"]', 'input')
    page.locator('[data-inv] [data-f="lines.0.r"]').fill('1200')
    page.dispatch_event('[data-inv] [data-f="lines.0.r"]', 'input')
    page.wait_for_timeout(500)
    check('Save to phone' in page.inner_text('[data-pdf]'), 'the PDF button says Save to phone in the app')
    before = len(calls(page))
    page.click('[data-share]')
    page.wait_for_function('window.__native.calls.some(function (x) { return x.indexOf("sharePdf:") === 0; })', timeout=30000)
    share = [x for x in calls(page) if x.startswith('sharePdf:')][-1]
    parts = share.split(':')
    check(parts[1].endswith('.pdf') and int(parts[2]) > 10000, 'Share PDF hands the shell a PDF file: ' + parts[1])
    check('Hart Electric' in share, 'the share sheet title names the company')
    page.click('[data-pdf]')
    page.wait_for_function('window.__native.calls.some(function (x) { return x.indexOf("saveFile:") === 0; })', timeout=30000)
    sv = [x for x in calls(page) if x.startswith('saveFile:')][-1]
    check(sv.split(':')[3] == 'application/pdf', 'Save to phone hands the shell the PDF')
    page.wait_for_selector('.toast')
    check('Documents/Billhead' in page.inner_text('.toast'), 'the toast says where the PDF went')
    page.wait_for_timeout(700)
    state = json.loads(page.evaluate('window.__native.state'))
    check(len(state.get('invoices', [])) == 1 and state['invoices'][0].get('unlock'), 'the state file has the invoice, unlocked')

    # Send to customer: the email app with the PDF, the address and the message.
    page.click('[data-send]')
    page.wait_for_selector('.sheet [data-ok]')
    check('Your email app opens with the PDF attached' in page.inner_text('.sheet'), 'the send sheet explains the email app hand-off')
    check(page.input_value('.sheet [data-k="subject"]').startswith('Invoice INV-1001 from Hart Electric LLC'), 'the subject is filled in')
    page.fill('.sheet [data-k="to"]', 'ap@prairiedental.example')
    page.click('.sheet [data-ok]')
    page.wait_for_function('window.__native.calls.some(function (x) { return x.indexOf("emailPdf:") === 0; })', timeout=30000)
    em = [x for x in calls(page) if x.startswith('emailPdf:')][-1]
    check('ap@prairiedental.example' in em and em.split(':')[1].endswith('.pdf') and int(em.split(':')[2]) > 10000, 'the email app gets the PDF, the address and the subject')
    mail = page.evaluate('window.__native.mail')
    check('Attached is invoice INV-1001 from Hart Electric LLC for $1,200.00' in mail['body'], 'the message names the invoice and the amount')
    page.wait_for_selector('.toast')
    check('Press Send in your email app' in page.inner_text('.toast'), 'the toast says to press Send')
    page.wait_for_timeout(500)
    check('Sent to ap@prairiedental.example on' in page.inner_text('body'), 'the invoice page logs the send')
    state = json.loads(page.evaluate('window.__native.state'))
    check(state['invoices'][0]['cust']['email'] == 'ap@prairiedental.example' and state['clients'][0]['email'] == 'ap@prairiedental.example', 'a new address is kept on the invoice and the customer')

    # Back button: a sheet closes first, then pages go back, then Home minimizes the app.
    page.goto(BASE + '#/more', wait_until='networkidle')
    page.wait_for_selector('[data-backup]')
    check('backs the app up' in page.inner_text('body'), 'Settings explains the Android backup in the app')
    page.evaluate('window.__native.backs[0]()')
    page.wait_for_timeout(400)
    check('minimize' not in calls(page), 'back on a page does not leave the app')
    page.goto(BASE + '#/', wait_until='networkidle')
    page.wait_for_selector('[data-new="simple"]')
    page.evaluate('window.__native.backs[0]()')
    page.wait_for_function('window.__native.calls.indexOf("minimize") >= 0')
    check(True, 'back on Home minimizes the app')
    saved_state = page.evaluate('window.__native.state')
    ctx.close()

    # ---------- A new phone: the file came back with the backup, the browser storage did not ----------
    ctx2 = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    ctx2.add_init_script(STUB % json.dumps(saved_state))
    page2 = ctx2.new_page()
    page2.on('pageerror', lambda e: errors.append(str(e)))
    page2.goto(BASE, wait_until='networkidle')
    page2.wait_for_function('window.__native.calls.indexOf("ready") >= 0')
    page2.wait_for_selector('[data-new="simple"]')
    body = page2.inner_text('body')
    check(page2.url.endswith('#/') or page2.url.endswith('/'), 'a restored phone opens on Home, not the profile')
    check('Hart Electric' in body, 'the company came back from the state file')
    check('Prairie Dental' in body or 'INV-' in body or '1,200' in body, 'the invoice came back from the state file')
    check(page2.evaluate('localStorage.getItem("billhead.v1") !== null'), 'the restored state is written back to browser storage')
    ctx2.close()

    # ---------- The web build is untouched: no shell, the normal download path ----------
    ctx3 = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
    page3 = ctx3.new_page()
    page3.on('pageerror', lambda e: errors.append(str(e)))
    page3.goto(BASE, wait_until='networkidle')
    check(page3.evaluate('typeof window.BHNative') == 'undefined', 'native.js sets nothing in a browser')
    ctx3.close()

    check(not errors, 'no page errors' + ('' if not errors else ': ' + '; '.join(errors)))
    browser.close()

print()
if fails:
    print('%d FAILED' % len(fails))
    sys.exit(1)
print('ALL PASSED')
