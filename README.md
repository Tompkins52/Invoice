# Billhead

Invoices from your phone. A company profile set up once, then a simple or an advanced invoice made either by answering questions one at a time or by typing straight onto the invoice. Projects keep several invoices together (invoice 2 of 3, billed to date, remaining). The PDF is drawn on the phone and locked against editing. Nothing leaves the device: no account, no server.

Built by Tompkins Software Systems. A billhead is what printers called a business's invoice form a century ago: the name at the top, the bill below.

Web app, installable from the browser (Add to Home Screen). App Store and Google Play versions come later.

## What it does

- **Company profile.** Name or logo, address, phone, email, website, usual terms, tax rate, invoice prefix and next number, how to pay (payable to, instructions, a payment link), a note for the bottom, an accent color, currency, paper size, tax ID and VAT or GST registration, late fee terms, fine print, and a saved signature. Every new invoice starts filled in from it.
- **Two kinds of invoice.** *Simple* (planned price 99 cents): who, what, how much, one sales tax, a discount, a deposit, when it is due, how to pay, a note. *Advanced* (planned price 1.99): everything in simple plus PO and reference numbers, attention line, ship-to or job site, service period, units, tax per line, freight, retainage, late fee terms, progress billing on a project, a drawn signature, a customer acceptance line, tax ID and registration numbers, a currency other than US dollars, and terms and conditions. A simple invoice can switch to advanced at any time; adding an advanced part asks first.
- **Two tools.** *Ask me* walks through one question per screen (customer, project, the work, tax, dates, extras, payment, signature) and ends on the invoice. *On the page* is the invoice as the form: tap any part and type, dashed links add the parts you need, the small x takes them away. Both write the same record and you can switch between them any time.
- **Projects.** One-time, or several invoices with progress billing: contract amount, approved change orders, planned invoice count, PO, retainage percent. Each new invoice on a progress project fills in the contract, what was billed before, and which invoice it is (2 of 3). The project page shows billed, paid, outstanding, remaining and retainage held.
- **Tracking.** Draft until the PDF is made, then sent; overdue by the due date; partly paid and paid from recorded payments (check, ACH, card, cash, Zelle, Venmo, PayPal). Home shows outstanding, overdue and paid this month, and what needs attention. Customers are saved from the invoices you send; past line items are a tap away on the next invoice.
- **The PDF.** Drawn from the record with jsPDF (not a screenshot), in the app's own type, with the logo and the signature. It opens anywhere without a password, prints and copies, and refuses editing in viewers that honor PDF permissions (owner password, print and copy only). Honest note: PDF permissions are enforced by the viewer, and tools exist that strip them, so the invoice also carries an **Invoice ID**, a short fingerprint of what it says, kept with the record so a copy that comes back can be checked against the original. On phones the share sheet is the first way out (Save to Files, Mail, Messages); on a computer it downloads. Making the PDF marks the invoice sent.
- **Signature.** Drawn in the app with signature_pad, cropped to the ink, printed above a line with the name, title and "Signed electronically in Billhead on [date]". Saved once, applied with one tap. The customer acceptance line is a blank line for them to sign on paper.
- **Pricing.** No subscription, no account, no ads, and the app never touches the customer's payment (free invoicing apps earn 2.9 percent plus 60 cents on it instead: $29.60 on a $1,000 invoice). The plan, in `M.PRICING` in `js/model.js`: the first invoice free; 99 cents per simple and 1.99 per advanced invoice, paid once when it is downloaded; packs that never expire (10 simple 7.99, 10 advanced 14.99, 50 advanced 49); a year of unlimited invoices for 99, paid once, no auto-renew. `mode` is `free` while the app is in testing: every download is unlocked and the planned prices show struck through. In `paid` mode `M.unlockHow()` decides in order: already unlocked, first invoice, year pass, pack credit, pay; `unlock()` in `js/app.js` is where the checkout plugs in (see below). A paid invoice stays unlocked; downloading it again is free.
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
| `tools/make_icons.py` | Draws the icons (one SVG rendered with Playwright). |
| `tests/model.test.js` | Math and records. `node tests/model.test.js` |
| `tests/ui_check.py` | Walks the app in headless Chromium: profile, a simple invoice by questions and on the page, an advanced invoice on a progress project with a signature and retainage, a payment, the second invoice on the project, a backup, a reload, the desktop layout; and opens each PDF with pypdf to confirm encryption, permissions, text, logo and signature. `python3 tests/ui_check.py --shots` keeps screenshots in `tests/shots/`. |

## Look

Business: navy ink on cool paper, a ledger rule across the top of cards, tabular numbers in IBM Plex Mono for amounts and invoice numbers, IBM Plex Sans for everything else. Status colors: green paid, amber partly paid, red overdue. Light and dark, following the phone unless set under More. Motion is restrained: screens rise in, list rows stagger, sheets slide up, and a PAID stamp slams onto the invoice when it is paid in full. The invoice itself uses the company's own accent color.

## Running it

Any static server from the repo root, for example `python3 -m http.server 8000`, then open `http://localhost:8000/`. The browser check needs `pip install playwright pypdf pillow` and `python -m playwright install chromium`.

## Deploying

Pushing to `main` runs the tests, assembles `site/`, stamps the service worker and deploys to GitHub Pages, live at https://tompkins52.github.io/Invoice/ (the path is case-sensitive: the repo is named `Invoice`). For a custom domain (for example `invoice.tompkinssoftwaresystems.com`): add a CNAME record at Cloudflare pointing to `tompkins52.github.io` (DNS only), then enter the domain in the repo's Pages settings and turn on Enforce HTTPS. Deploys from Actions need no `CNAME` file.

## Before charging for downloads

- A Stripe account. The plan is Stripe Checkout with a small Cloudflare Worker (free tier) holding the secret key: one route creates a Checkout Session (a single invoice, a pack, or the year pass, with the invoice id as `client_reference_id` for singles), a webhook route records `checkout.session.completed` in KV, and a verify route returns a signed token the app turns into `invoice.unlock`, `state.credits` or `state.pass`. `unlock()` in `js/app.js` is the only place that changes. Stripe's 30-cent fixed fee takes about a third of a 99-cent sale and 3 to 7 percent of a pack, which is why the packs exist.
- Sales tax on digital goods varies by state; Stripe Tax or a merchant of record handles it.
- If the same app ships to the App Store or Google Play, a download unlock counts as a digital feature and has to go through in-app purchase there.
- Switch `M.PRICING.mode` to `paid` and the struck-through prices become the real ones.

## Still to do

- Store versions (Capacitor), once the D-U-N-S number and the developer accounts are in place.
- Estimates and quotes that turn into invoices; recurring invoices; reminders (needs a service, since there is no server).
- Replace the free invoice tool on the company site with a link to this app once it is settled.
