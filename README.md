# Billhead

https://invoice.tompkinssoftwaresystems.com

Invoices from your phone. The first screen asks one thing, what the business is called; the first invoice picks up the rest along the way. After that an invoice is three questions (who, what, when), or typed straight onto the invoice. Projects keep several invoices together (invoice 2 of 3, billed to date, remaining). The PDF is drawn on the phone and locked against editing. Nothing leaves the device: no account, no server.

Built by Tompkins Software Systems, one of its Upfront for Small Business apps. A billhead is what printers called a business's invoice form a century ago: the name at the top, the bill below. The mark is a bill: a white sheet, the lines of the bill, a bold bar for the total and a red rubber stamp, on the family's navy tile.

Web app, installable from the browser (Add to Home Screen). App Store and Google Play versions come later.

## What it does

- **First open.** One field (the business name) and an optional logo, then *Make my first invoice*. The first invoice asks five questions: who it is for, what it is for, when it is due, and, once only, the details that print at the top (address, phone, email) and how customers pay. Those two answers, the first tax rate typed and the first terms picked go to the company profile and are not asked again. *Look around first* skips to Home, where one card says what the invoices still lack.
- **Company profile.** Name or logo, address, phone, email, website, usual terms, tax rate, invoice prefix and next number, how to pay (payable to, instructions, a payment link), a note for the bottom, an accent color, currency, paper size, tax ID and VAT or GST registration, late fee terms, fine print, and a saved signature. Every new invoice starts filled in from it. The whole form is under More; nobody has to fill it in to send an invoice.
- **Two kinds of invoice.** *Simple* (planned price 99 cents): who, what, how much, one sales tax, a discount, a deposit, when it is due, how to pay, a note. *Advanced* (planned price 1.99): everything in simple plus PO and reference numbers, attention line, ship-to or job site, service period, units, tax per line, freight, retainage, late fee terms, progress billing on a project, a drawn signature, a customer acceptance line, tax ID and registration numbers, a currency other than US dollars, and terms and conditions. A simple invoice can switch to advanced at any time; adding an advanced part asks first.
- **Two tools.** *Ask me* walks through one question per screen and ends on the invoice, ready to send. A simple invoice is three questions: the customer (saved customers are offered as the name is typed), the work (lines, with the total, the tax rate, a discount and a deposit adding up underneath as they are typed) and the dates. An advanced invoice adds the project, the reference details and the signature. Each question has its own address (`#/ask/<invoice>/<question>`), so the phone's back button goes one question back; what is typed is saved as it is typed; Enter moves on. *On the page* is the invoice as the form: tap any part and type, dashed links add the parts you need, the small x takes them away, and Send stays at the bottom of the screen. Both write the same record and you can switch between them any time. The app asks which tool once and remembers it (More changes it). A new invoice nobody typed into is not kept, and its number is given back.
- **Projects.** One-time, or several invoices with progress billing: contract amount, approved change orders, planned invoice count, PO, retainage percent. Each new invoice on a progress project fills in the contract, what was billed before, and which invoice it is (2 of 3). The project page shows billed, paid, outstanding, remaining and retainage held.
- **Tracking.** Draft until the PDF is made, then sent; overdue by the due date; partly paid and paid from recorded payments (check, ACH, card, cash, Zelle, Venmo, PayPal). Home shows outstanding, overdue and paid this month, and what needs attention. An invoice's page has one main button, which follows the invoice: Send to customer on a draft, Record a payment once it is out. Customers are saved from the invoices you send; past line items are a tap away on the next invoice.
- **The PDF.** Drawn from the record with jsPDF (not a screenshot), in the app's own type, with the logo and the signature. It opens anywhere without a password, prints and copies, and refuses editing in viewers that honor PDF permissions (owner password, print and copy only). Honest note: PDF permissions are enforced by the viewer, and tools exist that strip them, so the invoice also carries an **Invoice ID**, a short fingerprint of what it says, kept with the record so a copy that comes back can be checked against the original. On phones the share sheet is the first way out (Save to Files, Mail, Messages); on a computer it downloads. Making the PDF marks the invoice sent.
- **Signature.** Drawn in the app with signature_pad, cropped to the ink, printed above a line with the name, title and "Signed electronically in Billhead on [date]". Saved once, applied with one tap. The customer acceptance line is a blank line for them to sign on paper.
- **Pricing.** No subscription, no account, no ads, and the app never touches the customer's payment (free invoicing apps earn 2.9 percent plus 60 cents on it instead: $29.60 on a $1,000 invoice). The plan, in `M.PRICING` in `js/model.js`: the first invoice free; 99 cents per simple and 1.99 per advanced invoice, paid once when it is downloaded; packs that never expire (10 simple 7.99, 10 advanced 14.99, 50 advanced 49); a year of unlimited invoices for 99, paid once, no auto-renew. `mode` is `free` while the app is in testing: every download is unlocked and the planned prices show struck through. In `paid` mode `M.unlockHow()` decides in order: already unlocked, first invoice, year pass, pack credit, pay; `unlock()` in `js/app.js` is where the checkout plugs in (see below). A paid invoice stays unlocked; downloading it again is free.
- **Coming from TSS Invoice Creator.** Billhead replaced the free invoice tool on the company site. That page offers anyone with an invoice saved in the old tool a one-tap move: it opens Billhead with the invoice in the address after `#import=` (base64url JSON, never sent to a server, since browsers do not send the part after `#`). Billhead reads it, clears the address, and either fills in the company profile from it (new device) or adds it as a draft (`M.fromCreator`, `M.decodeImport` in `js/model.js`). The invoice keeps its number unless that number is taken.
- **Backup.** Everything is one JSON document in the browser's storage. More has a backup file (company, customers, projects, invoices, images included), restore, a CSV of all invoices for the accountant, and a one-tap "forget everything".

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `app.css`, `js/app.js` | The app. No build step, no framework. `app.js` is the screens; the invoice as HTML lives in `invoiceHtml()` and is used by the editor, the detail page and printing. |
| `js/model.js` | Everything with no screen: records, totals, status, projects and progress billing, the fingerprint, storage. Runs in Node for `tests/model.test.js`. |
| `js/pdf.js` | Draws the PDF from an invoice record and locks it. Loads jsPDF and the TTF fonts on first use. |
| `vendor/` | jsPDF 4.2.1 (MIT) and signature_pad 5.1.4 (MIT). |
| `fonts/` | IBM Plex Sans and IBM Plex Mono (SIL Open Font License): woff2 for the screen, subset TTF for the PDF. |
| `manifest.webmanifest`, `sw.js`, `icons/` | Home-screen install and offline use. The service worker caches the whole shell under one version and serves every page load from it. |
| `tools/stamp_sw.py` | Run by the deploy: stops if a cached file is missing, sets the worker's VERSION to a hash of the shell, stamps the build into the page. |
| `tools/make_icons.py` | Draws the icons: the mark on a 1024 grid, rendered with Playwright at each size (`android` for the shell's source images). It also writes the launch animation's two marks (Billhead's and the family's) into `index.html`, one small SVG per part so the motion runs on the graphics chip, and the header mark into `js/app.js`; `tests/ui_check.py` checks all three against the drawing. |
| `tests/model.test.js` | Math and records. `node tests/model.test.js` |
| `tests/ui_check.py` | Walks the app in headless Chromium: the first screen, the first invoice by questions (five, two asked once) and on the page, sending, a payment, a second invoice (three questions, the back button, nothing asked twice), an advanced invoice on a progress project with a signature and retainage, the second invoice on the project, a backup, a reload, the desktop layout, the launch animation, and the things that went wrong once; and opens each PDF with pypdf to confirm encryption, permissions, text, logo and signature. `python3 tests/ui_check.py --shots` keeps screenshots in `tests/shots/`. |

## Look

Business: navy ink on cool paper (the Upfront family's navy, `#172E4E`, with its red, `#F34D38`, kept for the stamp in the mark), a ledger rule across the top of cards, tabular numbers in IBM Plex Mono for amounts and invoice numbers, IBM Plex Sans for everything else. Status colors: green paid, amber partly paid, red overdue. Light and dark, following the phone unless set under More. Motion is restrained: screens rise in, list rows stagger, sheets slide up, and a PAID stamp slams onto the invoice when it is paid in full. The invoice itself uses the company's own accent color.

Opening: like every Upfront for Small Business app, Billhead opens with the family's launch, once a session. On navy, the mark builds (the sheet rises, the bill writes itself line by line down to the total, and the stamp comes down on it) and the name comes up, then "by Upfront for Small Business" with the family mark (its awning drops stripe by stripe and the arrow runs in under it). 3 seconds, and a tap skips it. The markup is at the top of `index.html` so it is there from the first paint; the script in its head turns it on (`html.uf-on`; not under test automation unless the address has `?intro=1`), `intro()` in `js/app.js` starts it once the first screen is drawn (in the Android app, as the plain navy splash lifts) and removes it at the end, and `app.css` has the motion. With reduced motion it is the finished picture for about a second. The next app in the family copies this with its own mark and name.

## Running it

Any static server from the repo root, for example `python3 -m http.server 8000`, then open `http://localhost:8000/`. The browser check needs `pip install playwright pypdf pillow` and `python -m playwright install chromium`.

## Deploying

Pushing to `main` runs the tests, assembles `site/`, stamps the service worker and deploys to GitHub Pages, live at https://invoice.tompkinssoftwaresystems.com. The custom domain is a Cloudflare CNAME `invoice` pointing to `tompkins52.github.io` (DNS only, gray cloud), entered in the repo's Pages settings with Enforce HTTPS on. Deploys from Actions need no `CNAME` file. The old address, https://tompkins52.github.io/Invoice/, forwards there. Saved data does not move between addresses (each is its own origin), so use a backup file to carry it across.

## Before charging for downloads

- A Stripe account. The plan is Stripe Checkout with a small Cloudflare Worker (free tier) holding the secret key: one route creates a Checkout Session (a single invoice, a pack, or the year pass, with the invoice id as `client_reference_id` for singles), a webhook route records `checkout.session.completed` in KV, and a verify route returns a signed token the app turns into `invoice.unlock`, `state.credits` or `state.pass`. `unlock()` in `js/app.js` is the only place that changes. Stripe's 30-cent fixed fee takes about a third of a 99-cent sale and 3 to 7 percent of a pack, which is why the packs exist.
- Sales tax on digital goods varies by state; Stripe Tax or a merchant of record handles it.
- If the same app ships to the App Store or Google Play, a download unlock counts as a digital feature and has to go through in-app purchase there.
- Switch `M.PRICING.mode` to `paid` and the struck-through prices become the real ones.

## Still to do

- Store versions (Capacitor), once the D-U-N-S number and the developer accounts are in place.
- Estimates and quotes that turn into invoices; recurring invoices; reminders (needs a service, since there is no server).
- Replace the free invoice tool on the company site with a link to this app once it is settled.
