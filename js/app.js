/* Billhead app: the screens. State lives in one JSON document in this browser's storage (js/model.js).
   Two ways to make an invoice: "Ask me" (one question at a time) and "On the page" (the invoice is the form).
   Both write the same invoice record, and the PDF is drawn from that record (js/pdf.js). */
(function () {
  "use strict";
  var M = window.BH, S = M.load();
  var $main = document.getElementById("main"), $hdr = document.getElementById("hdr"), $tabs = document.getElementById("tabs"), $layer = document.getElementById("layer");
  /* Embedded in a page that hosts a preview, the address bar is not ours, so routes live in memory there. That page
     sets window.BHPreview = { save(name, blob) } before the app loads: where a file goes when there is no download. */
  var ART = !!(window.BHPreview && typeof window.BHPreview.save === "function"), memHash = "#/";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var money = function (n, cur) { return M.money(n, cur || (S.company && S.company.currency) || "USD"); };
  var sym = function (cur) { return (M.CURRENCIES[cur || (S.company && S.company.currency) || "USD"] || M.CURRENCIES.USD).symbol; };
  /* One listener per event type on the main element; each view sets its own handlers and the old ones go away. */
  var mainHandlers = {};
  function onMain(type, fn) { mainHandlers[type] = fn; }
  ["click", "input", "change", "keydown"].forEach(function (type) { $main.addEventListener(type, function (e) { if (mainHandlers[type]) mainHandlers[type](e); }); });
  /* The Android and iOS apps load native.js first; it sets window.BHNative (files, the share sheet, the back button). */
  var NATIVE = window.BHNative || null;
  var canShareFiles = (function () { if (NATIVE) return true; try { return !ART && !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] })); } catch (e) { return false; } })();
  /* On a phone the share sheet is the way out (Save to Files, Mail, Messages, AirDrop); on a computer, a download. */
  function pdfButtons(primary, compact) {
    var cls = primary ? "btn primary" : "btn", mini = compact ? " mini" : "", save = NATIVE ? "Save to phone" : "Download";
    if (canShareFiles) return '<button type="button" class="' + cls + mini + '" data-share' + (compact ? ' aria-label="Share PDF"' : "") + ">" + I.share + (compact ? "<span>Share</span>" : " Share PDF") + '</button><button type="button" class="btn' + mini + '" data-pdf' + (compact ? ' aria-label="' + save + '"' : "") + ">" + I.down + (compact ? "<span>Save</span>" : " " + save) + "</button>";
    return '<button type="button" class="' + cls + mini + '" data-pdf' + (compact ? ' aria-label="Download PDF"' : "") + ">" + I.down + (compact ? "<span>PDF</span>" : " Download PDF") + "</button>";
  }
  /* Send to customer leads (the email app with the PDF attached); the PDF on its own follows as plain buttons.
     compact: the editor's bottom bar, where the PDF buttons are an icon over a short word.
     again: the invoice already went out, so sending is no longer the main thing to do with it. */
  function sendButtons(compact, again) { return '<button type="button" class="btn' + (again ? "" : " primary") + '" data-send>' + I.mail + (again ? " Send again" : " Send to customer") + "</button>" + pdfButtons(false, compact); }
  var saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    var run = function () {
      if (!M.save(S)) toast("Could not save on this device. Storage may be full or blocked.");
      /* In the app, the same document also goes to a file in the app's own folder, which Android backs up and carries to a new phone. */
      if (NATIVE) NATIVE.saveState(JSON.stringify(S)).catch(function () { });
    };
    if (now) run(); else saveTimer = setTimeout(run, 300);
  }
  function currentHash() { return ART ? memHash : location.hash; }
  /* navNew: this move was started in the app (a button or a link), so the next screen opens at its top.
     Without it the move is the back or forward button, and the screen returns to where the person left it. */
  var navNew = false, lastHash = null, scrollMem = {};
  function go(hash) { navNew = true; if (ART) { memHash = hash; route(); return; } if (location.hash === hash) route(); else location.hash = hash; }
  /* The same, but the screen we are on does not stay in the phone's history: the back button skips it. */
  function replaceTo(hash) { navNew = true; if (ART) { memHash = hash; route(); return; } if (location.hash === hash) route(); else location.replace(hash); }
  function invoiceById(id) { return S.invoices.filter(function (i) { return i.id === id; })[0]; }
  function projectById(id) { return S.projects.filter(function (p) { return p.id === id; })[0]; }
  function clientById(id) { return S.clients.filter(function (c) { return c.id === id; })[0]; }
  function clientName(id) { var c = clientById(id); return c ? c.name : ""; }
  function isDark() { var l = S.settings.look || "auto"; return l === "dark" || (l === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches); }
  function applyLook() { document.documentElement.setAttribute("data-look", S.settings.look || "auto"); document.documentElement.classList.toggle("dark-auto", (S.settings.look || "auto") === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches); if (NATIVE) NATIVE.setDark(isDark()).catch(function () { }); }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyLook);

  /* ---------- Icons ---------- */
  var I = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
    invoices: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>',
    projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h6l2 2h10v10H3z"/><path d="M3 7V5h5"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 13v7h14v-7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M12 8l4 4"/></svg>',
    sheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  /* The app's mark, the same drawing as the icons (tools/make_icons.py; tests/ui_check.py checks they match). */
  var MARK = '<svg class="mark" viewBox="0 0 1024 1024" aria-hidden="true"><rect width="1024" height="1024" rx="230" fill="#172E4E"/><path d="M260,160 H584 L716,292 V840 a24,24 0 0 1 -24,24 H260 a24,24 0 0 1 -24,-24 V184 a24,24 0 0 1 24,-24 Z" fill="#FFFFFF"/><path d="M584,170 V270 q0,22 22,22 H706" fill="none" stroke="#172E4E" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><rect x="298" y="245" width="190" height="34" rx="17" fill="#172E4E"/><rect x="298" y="311" width="120" height="34" rx="17" fill="#172E4E"/><rect x="298" y="423" width="300" height="34" rx="17" fill="#172E4E"/><rect x="298" y="491" width="196" height="34" rx="17" fill="#172E4E"/><rect x="298" y="559" width="222" height="34" rx="17" fill="#172E4E"/><rect x="298" y="711" width="190" height="62" rx="31" fill="#172E4E"/><g transform="translate(662 760) rotate(-18) scale(0.9)"><path d="M-22,-214 L-22,-124 Q-22,-84 -62,-84 L62,-84 Q22,-84 22,-124 L22,-214 Z" fill="#172E4E" stroke="#172E4E" stroke-width="32" stroke-linejoin="round"/><path d="M0,-290 a50,50 0 1 0 0.1,0 Z" fill="#172E4E" stroke="#172E4E" stroke-width="32" stroke-linejoin="round"/><path d="M-132,-66 Q-132,-88 -110,-88 L110,-88 Q132,-88 132,-66 L132,-18 Q132,-10 124,-10 L-124,-10 Q-132,-10 -132,-18 Z" fill="#172E4E" stroke="#172E4E" stroke-width="32" stroke-linejoin="round"/><path d="M-132,21 Q-132,12 -123,12 L123,12 Q132,12 132,21 L132,37 Q132,46 123,46 L-123,46 Q-132,46 -132,37 Z" fill="#172E4E" stroke="#172E4E" stroke-width="32" stroke-linejoin="round"/><path d="M-22,-214 L-22,-124 Q-22,-84 -62,-84 L62,-84 Q22,-84 22,-124 L22,-214 Z" fill="#F34D38"/><path d="M0,-290 a50,50 0 1 0 0.1,0 Z" fill="#F34D38"/><path d="M-132,-66 Q-132,-88 -110,-88 L110,-88 Q132,-88 132,-66 L132,-18 Q132,-10 124,-10 L-124,-10 Q-132,-10 -132,-18 Z" fill="#F34D38"/><path d="M-132,21 Q-132,12 -123,12 L123,12 Q132,12 132,21 L132,37 Q132,46 123,46 L-123,46 Q-132,46 -132,37 Z" fill="#F34D38"/></g></svg>';

  /* ---------- Frame: header, tabs, toasts, sheets ---------- */
  var hdrClose = null;
  $hdr.addEventListener("click", function (e) { if (hdrClose && e.target.closest("[data-close]")) hdrClose(); });
  function header(title, opts) {
    opts = opts || {};
    $hdr.innerHTML = (opts.close ? '<button class="back" type="button" data-close aria-label="Close">' + I.close + "</button>" : opts.back ? '<button class="back" type="button" data-go="' + esc(opts.back) + '" aria-label="Back">' + I.back + (opts.backLabel ? "<span>" + esc(opts.backLabel) + "</span>" : "") + "</button>" : '<a class="brand" href="#/">' + MARK + "</a>") +
      '<div class="title">' + esc(title) + "</div>" + (opts.actions ? '<div class="actions">' + opts.actions + "</div>" : "");
  }
  function tabs(active) {
    document.body.classList.toggle("has-tabs", !!active);
    $tabs.hidden = !active;
    if (!active) return;
    var overdue = S.invoices.some(function (i) { return M.status(i) === "overdue"; });
    $tabs.innerHTML = '<div class="rail-brand"><img src="icons/icon-192.png" alt="">' + M.NAME + "</div>" +
      [["home", "#/", "Home"], ["invoices", "#/invoices", "Invoices"], ["projects", "#/projects", "Projects"], ["more", "#/more", "More"]].map(function (t) {
        return '<a href="' + t[1] + '" class="' + (active === t[0] ? "on" : "") + '">' + I[t[0]] + "<span>" + t[2] + "</span>" + (t[0] === "invoices" && overdue ? '<i class="dot" aria-label="Overdue invoices"></i>' : "") + "</a>";
      }).join("");
  }
  var toastTimer = null;
  function toast(msg, ms) {
    var old = $layer.querySelector(".toast"); if (old) old.remove();
    var t = document.createElement("div"); t.className = "toast"; t.textContent = msg; $layer.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 260); }, ms || 2600);
  }
  function sheet(html, onReady) {
    closeSheet();
    var w = document.createElement("div"); w.className = "sheet-wrap"; w.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="grip"></div>' + html + "</div>";
    w.addEventListener("click", function (e) { if (e.target === w) closeSheet(); });
    $layer.appendChild(w); document.body.style.overflow = "hidden";
    if (onReady) onReady(w.querySelector(".sheet"));
    return w.querySelector(".sheet");
  }
  function closeSheet() { var w = $layer.querySelector(".sheet-wrap"); if (w) w.remove(); document.body.style.overflow = ""; }
  function ask(title, body, buttons) {
    return new Promise(function (res) {
      sheet("<h2>" + esc(title) + "</h2>" + (body ? '<p class="muted">' + body + "</p>" : "") + '<div class="actions">' + buttons.map(function (b, i) { return '<button type="button" class="btn ' + (b.cls || "") + '" data-i="' + i + '">' + esc(b.label) + "</button>"; }).join("") + "</div>", function (sh) {
        sh.addEventListener("click", function (e) { var b = e.target.closest("[data-i]"); if (!b) return; closeSheet(); res(buttons[Number(b.getAttribute("data-i"))].value); });
      });
    });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  document.addEventListener("click", function (e) {
    var g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); go(g.getAttribute("data-go")); return; }
    var a = e.target.closest('a[href^="#/"]'); if (!a) return;
    if (ART) { e.preventDefault(); go(a.getAttribute("href")); } else navNew = true;
  });

  /* ---------- Shared pieces ---------- */
  var fieldN = 0;
  function field(label, inner, help) {
    var id = "f" + (++fieldN), hid = help ? id + "h" : "";
    inner = inner.replace(/<(input|textarea|select)\b/, function (m) { return m + ' id="' + id + '"' + (hid ? ' aria-describedby="' + hid + '"' : ""); });
    return '<div class="field"><label for="' + id + '">' + esc(label) + "</label>" + inner + (help ? '<div class="help" id="' + hid + '">' + help + "</div>" : "") + "</div>";
  }
  function input(k, v, attrs) { return '<input data-k="' + k + '" value="' + esc(v == null ? "" : v) + '" ' + (attrs || 'type="text"') + ">"; }
  function textarea(k, v, ph, rows) { return '<textarea data-k="' + k + '" rows="' + (rows || 3) + '" placeholder="' + esc(ph || "") + '">' + esc(v || "") + "</textarea>"; }
  function moneyInput(k, v, ph, cur) { return '<span class="money-in" data-sym="' + esc(sym(cur)) + '">' + input(k, v, 'type="text" inputmode="decimal" placeholder="' + esc(ph || "0.00") + '"') + "</span>"; }
  function readFields(scope, target) {
    scope.querySelectorAll("[data-k]").forEach(function (el) {
      var k = el.getAttribute("data-k"), v = el.type === "checkbox" ? el.checked : el.value;
      if (el.hasAttribute("data-num")) v = v === "" ? "" : M.num(v);
      M.set(target, k, v);
    });
  }
  function statusPill(inv) { var s = M.status(inv); return '<span class="pill ' + s + '">' + M.STATUS_LABEL[s] + "</span>"; }
  function dueText(inv) {
    var s = M.status(inv);
    if (s === "paid") return "Paid" + (inv.paidAt ? " " + M.shortDate(inv.paidAt) : "");
    if (s === "void") return "Void";
    if (s === "draft") return "Draft, " + M.shortDate(inv.date);
    var d = M.daysBetween(M.today(), inv.due);
    if (d < 0) return "Overdue " + (-d) + (d === -1 ? " day" : " days");
    if (d === 0) return "Due today";
    if (d <= 7) return "Due in " + d + (d === 1 ? " day" : " days");
    return "Due " + M.shortDate(inv.due);
  }
  function invoiceItem(inv) {
    var t = M.totals(inv), s = M.status(inv);
    return '<a class="item" href="#/inv/' + inv.id + '"><div><div class="t">' + esc(inv.cust.name || "No customer yet") + '</div><div class="s"><span class="mono">' + esc(inv.num) + "</span> · " + esc(dueText(inv)) + (inv.projectId && projectById(inv.projectId) ? " · " + esc(projectById(inv.projectId).name) : "") + '</div></div><div class="r"><div class="amt' + (s === "overdue" ? " due" : "") + '">' + money(s === "draft" || s === "paid" || s === "void" ? t.total : t.due, inv.currency) + "</div>" + statusPill(inv) + "</div></a>";
  }
  function emptyState(text, action) { return '<div class="empty">' + I.sheet + "<p>" + text + "</p>" + (action || "") + "</div>"; }

  /* ---------- Router ---------- */
  /* An invoice carried over from TSS Invoice Creator arrives as #import=..., is read here, and leaves the address at once. */
  function takeImport() {
    var imp = /^#import=([A-Za-z0-9_-]+)$/.exec(location.hash || "");
    if (!imp) return false;
    var oldInv = M.decodeImport(imp[1]);
    history.replaceState(null, "", location.pathname + location.search + "#/");
    if (!oldInv) { toast("That link did not carry an invoice this app can read."); return false; }
    var got = M.fromCreator(oldInv, S.company);
    if (S.company) { addImported(got.invoice); return true; }
    importDraft = got; return false;
  }
  function route() {
    var from = lastHash, wasNew = navNew; navNew = false;
    if (from != null) scrollMem[from] = window.scrollY || 0;
    routeTo();
    var now = currentHash();
    if (now !== from) window.scrollTo(0, wasNew ? 0 : (scrollMem[now] || 0));
    lastHash = now;
  }
  /* A new invoice nobody typed into is not kept: it would sit in the list as an empty draft and use up a number.
     The one on screen is left alone. When the dropped invoice had the newest number, the number is given back. */
  function dropUntouched(keepId) {
    var dropped = false;
    for (var i = S.invoices.length - 1; i >= 0; i--) {
      var inv = S.invoices[i];
      if (!inv._new || inv.id === keepId) continue;
      if (!M.isUntouched(inv)) { delete inv._new; continue; }
      if (S.company && inv.num === (S.company.prefix || "") + (M.num(S.company.next) - 1)) S.company.next = M.num(S.company.next) - 1;
      S.invoices.splice(i, 1); dropped = true;
    }
    if (dropped) save(true);
  }
  function routeTo() {
    if (!ART && takeImport()) return;
    closeSheet(); mainHandlers = {}; hdrClose = null; document.body.classList.remove("has-bar");
    clearTimeout(wizTimer); if (wizFlush) { var flush = wizFlush; wizFlush = null; try { flush(); } catch (err) { } }
    var h = currentHash().replace(/^#\/?/, ""), parts = h.split("/");
    dropUntouched(parts[0] === "ask" || parts[0] === "edit" || parts[0] === "inv" ? parts[1] : "");
    if (!S.company) { if (parts[0] !== "welcome") { if (ART) { memHash = "#/welcome"; return route(); } location.replace("#/welcome"); return; } return viewWelcome(); }
    switch (parts[0]) {
      case "": case "home": return viewHome();
      case "welcome": return viewWelcome();
      case "new": return viewNew(parts[1] || "", parts[2] || "");
      case "ask": return viewWizard(parts[1], parts[2] || "");
      case "edit": return viewEditor(parts[1]);
      case "inv": return viewInvoice(parts[1]);
      case "invoices": return viewInvoices(parts[1] || "all");
      case "projects": return viewProjects();
      case "project": return parts[2] === "edit" || parts[1] === "new" ? viewProjectEdit(parts[1] === "new" ? null : parts[1]) : viewProject(parts[1]);
      case "clients": return viewClients();
      case "client": return viewClientEdit(parts[1] === "new" ? null : parts[1]);
      case "more": return viewMore();
      case "company": return viewCompany(parts[1] || "");
      default: return viewHome();
    }
  }
  window.addEventListener("hashchange", route);

  /* ---------- Welcome: the company profile ---------- */
  function companyForm(c) {
    return '<div class="stack" data-company>' +
      '<div class="card"><div class="stack">' +
      field("Company name", input("name", c.name, 'type="text" placeholder="Hart Electric LLC" autocomplete="organization"'), "As it should print on invoices.") +
      '<div class="field"><div class="lbl">Logo</div><div class="row">' + (c.logo ? '<img src="' + c.logo + '" alt="Your logo" style="max-height:56px;max-width:180px"><button type="button" class="btn small" data-logo-clear>Remove</button>' : '<label class="btn small file-btn">Upload a logo<input type="file" accept="image/*" data-logo></label>') + '</div><div class="help">Optional. A PNG with a transparent background looks best. Without one, your company name prints in its place.</div></div>' +
      field("Address", textarea("addr", c.addr, "Street\nCity, State ZIP", 2)) +
      '<div class="inline-fields">' + field("Phone", input("phone", c.phone, 'type="tel" autocomplete="tel"')) + field("Email", input("email", c.email, 'type="email" autocomplete="email"')) + "</div>" +
      field("Website", input("web", c.web, 'type="text" placeholder="example.com"')) +
      "</div></div>" +
      '<div class="card"><h3>How you bill</h3><div class="stack" style="margin-top:0.6rem">' +
      '<div class="inline-fields">' + field("Usual terms", '<select data-k="terms">' + M.TERMS.map(function (t) { return "<option" + (t === c.terms ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select>") +
      field("Sales tax rate", input("taxRate", c.taxRate, 'type="text" inputmode="decimal" placeholder="0" data-num'), "Percent. Leave blank if you do not charge tax.") + "</div>" +
      '<div class="inline-fields">' + field("Invoice prefix", input("prefix", c.prefix, 'type="text" placeholder="INV-"')) + field("Next number", input("next", c.next, 'type="text" inputmode="numeric" data-num')) + "</div>" +
      field("Make checks payable to", input("payTo", c.payTo, 'type="text" placeholder="' + esc(c.name || "Your company") + '"')) +
      field("Payment instructions", textarea("payInstr", c.payInstr, "Where to mail a check, ACH details, which cards you take", 3), "Prints on every invoice. You can change it per invoice.") +
      field("Payment link", input("payLink", c.payLink, 'type="url" placeholder="https://"'), "Optional. A PayPal, Venmo, Stripe or bank link. Invoices with a pay button get paid faster.") +
      field("Note at the bottom", input("notes", c.notes, 'type="text" placeholder="Thank you for your business."')) +
      "</div></div>" +
      '<details class="card flat"><summary style="cursor:pointer;font-weight:600">More options</summary><div class="stack" style="margin-top:0.8rem">' +
      '<div class="inline-fields">' + field("Accent color", '<input data-k="accent" type="color" value="' + esc(c.accent || "#1C3F7A") + '" style="height:46px;width:100%;border:1px solid var(--line-2);border-radius:10px;background:var(--surface)">', "The color on the invoice: the rule, the table header, the balance due.") +
      field("Currency", '<select data-k="currency">' + Object.keys(M.CURRENCIES).map(function (k) { return '<option value="' + k + '"' + (k === c.currency ? " selected" : "") + ">" + k + ", " + M.CURRENCIES[k].name + "</option>"; }).join("") + "</select>") + "</div>" +
      '<div class="inline-fields">' + field("Paper size", '<select data-k="paper">' + Object.keys(M.PAPER).map(function (k) { return '<option value="' + k + '"' + (k === c.paper ? " selected" : "") + ">" + M.PAPER[k] + "</option>"; }).join("") + "</select>") +
      field("Tax label", input("taxLabel", c.taxLabel, 'type="text" placeholder="Sales tax"'), "Sales tax, VAT, GST, HST.") + "</div>" +
      field("Tax ID (EIN)", input("taxid", c.taxid, 'type="text" placeholder="00-0000000"'), "Stays private unless you add it to an advanced invoice.") +
      '<div class="inline-fields">' + field("Registration label", input("vatLabel", c.vatLabel, 'type="text" placeholder="VAT no." ')) + field("Registration number", input("vat", c.vat, 'type="text"')) + "</div>" +
      field("Late fee or early-pay terms", input("late", c.late, 'type="text" placeholder="1.5% per month after the due date"'), "Advanced invoices print this under Payment. Late fees hold up only when they were agreed to in advance.") +
      field("Terms and conditions", textarea("fine", c.fine, "Fine print for advanced invoices", 3)) +
      "</div></details>" +
      '<button type="button" class="btn primary big block" data-company-save>Save changes</button>' +
      "</div>";
  }
  function bindCompanyForm(scope, c, after) {
    onMain("change", function (e) {
      if (e.target.matches("[data-logo]")) {
        var f = e.target.files && e.target.files[0]; if (!f) return;
        readLogo(f, function (dataUrl) { c.logo = dataUrl; readFields(scope, c); var host = scope.querySelector("[data-company]") || scope; host.outerHTML = companyForm(c); bindCompanyForm($main, c, after); });
      }
    });
    onMain("click", function (e) {
      if (e.target.closest("[data-logo-clear]")) { readFields(scope, c); c.logo = ""; var host = scope.querySelector("[data-company]") || scope; host.outerHTML = companyForm(c); bindCompanyForm($main, c, after); return; }
      if (e.target.closest("[data-company-save]")) {
        readFields(scope, c);
        if (!c.name.trim()) { toast("The company name is the one thing an invoice cannot do without."); scope.querySelector('[data-k="name"]').focus(); return; }
        c.next = Math.max(1, Math.round(M.num(c.next)) || 1); if (!c.payTo) c.payTo = c.name;
        after(c);
      }
    });
  }
  function readLogo(file, done) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () { var scale = Math.min(1, 600 / img.width, 240 / img.height), cv = document.createElement("canvas"); cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); done(cv.toDataURL("image/png")); };
      img.onerror = function () { toast("That file is not an image the browser can read."); };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }
  /* The first screen asks for one thing, the name that prints on the invoice (and a logo for whoever has one).
     The rest of the profile is asked for where it matters, once: in the first invoice's questions, or from Home. */
  function viewWelcome() {
    tabs(null); header(M.NAME);
    var c = S.company ? M.clone(S.company) : (importDraft ? M.clone(importDraft.company) : M.blankCompany());
    function draw() {
      $main.innerHTML = '<div class="view welcome"><div class="welcome-top">' + MARK.replace('class="mark"', 'class="mark big"') + "<h1>" + M.NAME + '</h1><p class="muted">' + esc(M.TAGLINE) + "</p></div>" +
        (importDraft ? '<div class="inv-bar"><span>Your details came over from <b>TSS Invoice Creator</b>, with invoice <b class="mono">' + esc(importDraft.invoice.num) + "</b>. Check the name and save; the invoice opens next.</span></div>" : "") +
        '<div class="card stack">' + field("What is your business called?", input("name", c.name, 'type="text" placeholder="Hart Electric LLC" autocomplete="organization" enterkeyhint="go"'), "It prints at the top of every invoice.") +
        '<div class="row">' + (c.logo ? '<img src="' + c.logo + '" alt="Your logo" style="max-height:48px;max-width:160px"><button type="button" class="btn small" data-logo-clear>Remove</button>' : '<label class="btn small file-btn">Add a logo<input type="file" accept="image/*" data-logo></label><span class="small muted">Optional</span>') + "</div></div>" +
        (importDraft ? '<button type="button" class="btn primary big block" data-company-save>Save and open the invoice</button>' :
          '<button type="button" class="btn primary big block" data-first>Make my first invoice</button><button type="button" class="btn block" data-company-save>Look around first</button>') +
        '<p class="small muted center">About two minutes. No account, no sign-up; everything stays with you.' + (importDraft ? "" : '<br><button type="button" class="btn-text" data-sample>Just looking? Load a sample company.</button>') + "</p></div>";
    }
    function keep() { var el = $main.querySelector('[data-k="name"]'); if (el) c.name = el.value; }
    function finish(first) {
      keep();
      if (!c.name.trim()) { toast("Your business name is the one thing an invoice cannot do without."); $main.querySelector('[data-k="name"]').focus(); return; }
      c.name = c.name.trim(); if (!c.payTo) c.payTo = c.name; c.createdAt = c.createdAt || M.today();
      var fresh = !S.company; S.company = c; S.settings.onboarded = true;
      /* Details that came with the name (an invoice carried over) count as asked; a new name alone does not. */
      if (fresh) S.settings.asked = importDraft ? { details: true, pay: true, tax: true, terms: true } : {};
      save(true);
      if (importDraft) { var imp = importDraft.invoice; importDraft = null; addImported(imp); return; }
      if (first) { var inv = newInvoice("simple"); replaceTo("#/ask/" + inv.id); return; }
      replaceTo("#/");
    }
    draw();
    onMain("change", function (e) { if (!e.target.matches("[data-logo]")) return; var f = e.target.files && e.target.files[0]; if (!f) return; keep(); readLogo(f, function (url) { c.logo = url; draw(); }); });
    onMain("keydown", function (e) { if (e.key === "Enter" && e.target.matches('[data-k="name"]')) { e.preventDefault(); finish(!importDraft); } });
    onMain("click", function (e) {
      if (e.target.closest("[data-logo-clear]")) { keep(); c.logo = ""; draw(); return; }
      if (e.target.closest("[data-first]")) { finish(true); return; }
      if (e.target.closest("[data-company-save]")) { finish(false); return; }
      if (e.target.closest("[data-sample]")) loadSample();
    });
  }
  /* An invoice carried over from TSS Invoice Creator: kept as a draft, its number kept unless it is taken. */
  var importDraft = null;
  function addImported(inv) {
    var taken = S.invoices.some(function (i) { return i.num === inv.num && i.status !== "void"; });
    if (taken) { inv.num = (S.company.prefix || "") + S.company.next; S.company.next = (M.num(S.company.next) || 1) + 1; }
    else { var m = /^(.*?)(\d+)$/.exec(inv.num || ""); if (m && m[1] === (S.company.prefix || "") && Number(m[2]) >= M.num(S.company.next)) S.company.next = Number(m[2]) + 1; }
    inv.status = "draft"; inv.createdAt = inv.updatedAt = M.today();
    S.invoices.push(inv); if (inv.cust.name) ensureClient(inv); save(true);
    go("#/edit/" + inv.id); toast("Brought over from TSS Invoice Creator. Check it, then download it from here.", 4200);
  }
  function viewCompany(from) {
    var backTo = from === "home" ? "#/" : "#/more";
    tabs(from === "home" ? "home" : "more"); header("Company profile", { back: backTo });
    var c = M.clone(S.company);
    $main.innerHTML = '<div class="view">' + companyForm(c) + "</div>";
    bindCompanyForm($main, c, function (done) { S.company = done; S.settings.asked = { details: true, pay: true, tax: true, terms: true }; save(true); toast("Company profile saved."); go(backTo); });
  }
  function loadSample() {
    S.company = M.sampleCompany(); S.settings.onboarded = true; S.settings.asked = { details: true, pay: true, tax: true, terms: true };
    var cl = M.blankClient(); cl.name = "Lakeside Dental"; cl.attn = "Accounts payable"; cl.addr = "42 Lakeview Dr\nPrairie City, IL 60000"; cl.email = "ap@lakesidedental.example"; S.clients.push(cl);
    var pr = M.blankProject(); pr.name = "Second-floor exam rooms"; pr.clientId = cl.id; pr.kind = "progress"; pr.contract = 9600; pr.planned = 3; pr.po = "PO 4471"; S.projects.push(pr);
    var a = M.sampleInvoice(S.company, "advanced"); a.num = "INV-1042"; a.date = M.addDays(M.today(), -20); a.due = M.dueFor(a.date, a.terms); a.status = "sent"; a.sentAt = a.date; a.clientId = cl.id; a.projectId = pr.id; a.deposit = 1500; a.lines = [{ d: "Mobilization and demolition", q: 1, u: "", r: 3200, t: false }]; a.prog = { on: true, contract: 9600, n: 1, m: 3, prev: 0 }; a.freight = ""; a.payments = [{ id: M.uid(), date: M.addDays(M.today(), -5), amount: 1700, method: "Check", note: "Check 2231" }];
    var b = M.sampleInvoice(S.company, "simple"); b.num = "INV-1043"; b.clientId = cl.id; b.lines = [{ d: "Service call, replace failed GFCI outlets (3)", q: 1, u: "", r: 285, t: true }]; b.desc = "";
    S.invoices.push(a, b); S.company.next = 1044; save(true); go("#/"); toast("Sample company loaded. Replace it from More when you are ready.");
  }

  /* ---------- Home ---------- */
  /* A price as the choice cards show it: during the free launch, struck through with "Free" beside it. */
  function priceTag(p) { return M.PRICING.mode === "free" ? "<s>" + M.priceText(p) + "</s>Free" : M.priceText(p); }
  /* What the profile still lacks, in the words the Home card uses. */
  function profileGaps() {
    var c = S.company, gaps = [];
    if (!c.addr) gaps.push("your address");
    if (!c.phone && !c.email) gaps.push("a phone number or email");
    if (!c.payInstr && !c.payLink) gaps.push("how customers pay you");
    return gaps;
  }
  function viewHome() {
    tabs("home"); header(S.company.name);
    var today = M.today(), open = S.invoices.filter(function (i) { var s = M.status(i); return s === "sent" || s === "partial" || s === "overdue"; });
    var outstanding = open.reduce(function (s, i) { return s + M.totals(i).due; }, 0), overdue = open.filter(function (i) { return M.status(i) === "overdue"; });
    var paidMonth = S.invoices.reduce(function (s, i) { return s + (i.payments || []).filter(function (p) { return (p.date || "").slice(0, 7) === today.slice(0, 7); }).reduce(function (a, p) { return a + M.num(p.amount); }, 0); }, 0);
    var attention = open.filter(function (i) { return M.status(i) === "overdue" || M.daysBetween(today, i.due) <= 7; }).sort(function (a, b) { return (a.due || "").localeCompare(b.due || ""); });
    var recent = S.invoices.slice().sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || "") || (b.createdAt || "").localeCompare(a.createdAt || ""); }).slice(0, 5);
    var openProjects = S.projects.filter(function (p) { return p.status !== "closed"; }).slice(0, 3);
    var free = M.PRICING.mode === "free", under = M.PRICING.freeUnder ? M.priceText(M.PRICING.freeUnder) : "";
    /* The chips that count something open the list they count. */
    var hero = S.invoices.length ?
      '<div class="hero"><div class="l">Outstanding</div><div class="v">' + money(outstanding) + '</div><div class="chips">' +
        (overdue.length ? '<a class="chip warn" href="#/invoices/overdue">' + overdue.length + " overdue</a>" : '<span class="chip">Nothing overdue</span>') +
        (paidMonth ? '<span class="chip good">' + money(paidMonth) + " paid this month</span>" : "") +
        (open.length ? '<a class="chip" href="#/invoices/open">' + open.length + (open.length === 1 ? " open invoice" : " open invoices") + "</a>" : "") + "</div></div>" :
      '<div class="hero"><div class="l">Welcome</div><div class="v" style="font-family:var(--sans);font-size:1.35rem">Your first invoice takes about two minutes.</div><div class="chips">' +
        (under ? '<span class="chip good">Under ' + under + ": free</span>" : "") + '<span class="chip">No account, nothing leaves your phone</span></div></div>';
    var gaps = profileGaps();
    var setup = gaps.length && !S.settings.setupLater ? '<div class="card"><div class="row between"><h2>Finish your profile</h2><button type="button" class="btn-text quiet small" data-setup-later>Later</button></div><p class="small muted" style="margin:0.3rem 0 0.7rem">Not on your invoices yet: ' + gaps.join(", ") + '.</p><a class="btn" href="#/company/home">Add ' + (gaps.length === 1 ? "it" : "them") + "</a></div>" : "";
    $main.innerHTML = '<div class="view stack">' + hero +
      '<div class="card ledger"><div class="row between" style="margin-bottom:0.6rem"><h2>New invoice</h2>' + (free ? '<span class="small pill free">Free during launch</span>' : "") + "</div>" +
      '<div class="choice"><button type="button" class="opt" data-new="simple"><div class="h"><span>Simple</span><span class="price">' + priceTag(M.PRICING.simple) + '</span></div><div class="small muted">One page: who, what, how much, when it is due.</div></button>' +
      '<button type="button" class="opt adv" data-new="advanced"><div class="h"><span>Advanced</span><span class="price">' + priceTag(M.PRICING.advanced) + '</span></div><div class="small muted">Adds a PO, job site, progress billing, retainage and your signature.</div></button></div>' +
      '<p class="small muted" style="margin:0.7rem 0 0">' + (under ? "<b>Under " + under + " is always free.</b> " : "") + "Pay once per invoice, never a subscription.</p></div>" +
      setup +
      (attention.length ? '<div><div class="section-head"><h2>Needs attention</h2></div><div class="list">' + attention.slice(0, 4).map(invoiceItem).join("") + "</div></div>" : "") +
      (recent.length ? '<div><div class="section-head"><h2>Recent</h2><a href="#/invoices" class="small">All invoices</a></div><div class="list">' + recent.map(invoiceItem).join("") + "</div></div>" : "") +
      (openProjects.length ? '<div><div class="section-head"><h2>Projects</h2><a href="#/projects" class="small">All projects</a></div><div class="list">' + openProjects.map(projectItem).join("") + "</div></div>" : "") +
      "</div>";
    onMain("click", function (e) {
      var b = e.target.closest("[data-new]"); if (b) { go("#/new/" + b.getAttribute("data-new")); return; }
      if (e.target.closest("[data-setup-later]")) { S.settings.setupLater = true; save(); viewHome(); toast("It is under More, Company profile, when you want it."); }
    });
  }

  /* ---------- New invoice: tier, then tool ---------- */
  function viewNew(tier, projectId) {
    tabs("home"); header("New invoice", { back: projectId ? "#/project/" + projectId : "#/" });
    if (tier !== "simple" && tier !== "advanced") {
      $main.innerHTML = '<div class="view stack"><h1>Which kind?</h1><div class="choice">' +
        '<button type="button" class="opt" data-tier="simple"><div class="h"><span>Simple</span><span class="price">' + priceTag(M.PRICING.simple) + '</span></div><ul><li>Your name or logo, the customer, a number and dates</li><li>Line items, one sales tax, a discount, a deposit, notes</li><li>How to pay you, with a pay link if you have one</li></ul></button>' +
        '<button type="button" class="opt adv" data-tier="advanced"><div class="h"><span>Advanced</span><span class="price">' + priceTag(M.PRICING.advanced) + '</span></div><ul><li>Everything in simple</li><li>Purchase order, reference, job site, service period</li><li>Progress billing on a project: invoice 2 of 3, billed to date, remaining</li><li>Freight, retainage, late fee terms, tax per line</li><li>Your signature and a customer acceptance line</li></ul></button></div>' +
        '<p class="small muted">' + (M.PRICING.freeUnder ? "<b>Under " + M.priceText(M.PRICING.freeUnder) + " is always free.</b> " : "") + (M.PRICING.mode === "free" ? "Both kinds are free during launch; after that you" : "Your first invoice is free. After that you") + " pay once per invoice, never a subscription. A simple invoice can switch to advanced later.</p></div>";
      onMain("click", function (e) { var b = e.target.closest("[data-tier]"); if (b) go("#/new/" + b.getAttribute("data-tier") + (projectId ? "/" + projectId : "")); });
      return;
    }
    /* Once the person has picked a way to make invoices, a new one opens that way (More changes it). The screen that
       makes the invoice does not stay in the phone's history, so the back button cannot make a second one. */
    var pref = S.settings.tool;
    if (pref === "ask" || pref === "edit") { var made = newInvoice(tier, projectId); replaceTo((pref === "ask" ? "#/ask/" : "#/edit/") + made.id); return; }
    $main.innerHTML = '<div class="view stack"><h1>' + (tier === "advanced" ? "Advanced" : "Simple") + ' invoice</h1><p class="muted">Two ways to make it. Both end on the same invoice.</p><div class="choice">' +
      '<button type="button" class="opt" data-tool="ask"><div class="h"><span>Ask me</span></div><div class="small muted">One question at a time. Good on a phone.</div></button>' +
      '<button type="button" class="opt" data-tool="edit"><div class="h"><span>On the page</span></div><div class="small muted">The invoice is the form: tap any part of it and type.</div></button></div></div>';
    onMain("click", function (e) {
      var b = e.target.closest("[data-tool]"); if (!b) return;
      var tool = b.getAttribute("data-tool"), inv = newInvoice(tier, projectId);
      S.settings.tool = tool; save();
      replaceTo((tool === "ask" ? "#/ask/" : "#/edit/") + inv.id);
      toast("New invoices will open this way. More changes it.", 3600);
    });
  }
  function newInvoice(tier, projectId) {
    var inv = M.blankInvoice(S.company, tier);
    S.company.next = (M.num(S.company.next) || 1) + 1;
    if (projectId) { var p = projectById(projectId); if (p) { M.applyProject(inv, p, S.invoices); var cl = clientById(p.clientId); if (cl) setClient(inv, cl); } }
    inv._new = M.draftSig(inv);
    S.invoices.push(inv); save(true); return inv;
  }
  function setClient(inv, cl) { inv.clientId = cl.id; inv.cust = { name: cl.name, attn: cl.attn || "", addr: cl.addr || "", email: cl.email || "", phone: cl.phone || "" }; if (cl.terms) { inv.terms = cl.terms; if (inv.dueAuto) inv.due = M.dueFor(inv.date, inv.terms); } }
  function touch(inv) { inv.updatedAt = M.today(); }

  /* ---------- The wizard: one question at a time ----------
     Each question has its own address (#/ask/<invoice>/<step>), so the phone's back button goes one question back.
     A routine simple invoice is three questions: who, what, when. The first invoice also asks, once, for the details
     that print at the top and for how customers pay; those answers go to the company profile and are not asked again.
     An advanced invoice adds the project, the reference details and the signature. */
  var wizFrom = {}, wizPlan = {}, wizTimer = null, wizFlush = null;
  function wizardSteps(inv) {
    var adv = inv.tier === "advanced", c = S.company, asked = S.settings.asked || {}, ids = ["customer"];
    if (adv) ids.push("project");
    ids.push("work", "dates");
    if (adv) ids.push("extras");
    if (!asked.details && !(c.addr || c.phone || c.email)) ids.push("details");
    if (!asked.pay && !(c.payInstr || c.payLink)) ids.push("pay");
    if (adv) ids.push("sign");
    return ids;
  }
  /* Saved customers, the ones billed most recently first. */
  function recentClients() {
    var last = {};
    S.invoices.forEach(function (i) { if (i.clientId && (i.date || "") > (last[i.clientId] || "")) last[i.clientId] = i.date || ""; });
    return S.clients.slice().sort(function (a, b) { return (last[b.id] || b.createdAt || "").localeCompare(last[a.id] || a.createdAt || "") || a.name.localeCompare(b.name); });
  }
  function viewWizard(id, stepId) {
    var inv = invoiceById(id); if (!inv) return go("#/");
    var adv = inv.tier === "advanced", cur = inv.currency, c = S.company;
    var asked = S.settings.asked || (S.settings.asked = {});
    tabs(null); document.body.classList.add("has-bar");
    var shown = function (k, v) { return !!(inv.show || {})[k] || (v !== "" && v != null && M.num(v) !== 0); };
    var ALL = {
      customer: { q: "Who is this invoice for?", why: "A name is enough. With an email, you can send it straight from here.", html: function () {
        var open = !adv && inv.clientId ? S.projects.filter(function (p) { return p.status !== "closed" && (p.clientId === inv.clientId || p.id === inv.projectId); }) : [];
        return field("Customer or company", input("cust.name", inv.cust.name, 'type="text" autocomplete="off" placeholder="Lakeside Dental"')) + (function (s) { return '<div class="field" data-sugg' + (s ? "" : " hidden") + ">" + s + "</div>"; })(suggest(inv.cust.name)) +
          (adv ? field("Attention", input("cust.attn", inv.cust.attn, 'type="text" placeholder="Accounts payable, or a person"')) : "") +
          field("Email", input("cust.email", inv.cust.email, 'type="email" autocomplete="off"')) +
          (adv ? field("Phone", input("cust.phone", inv.cust.phone, 'type="tel"')) : "") +
          field("Billing address (optional)", textarea("cust.addr", inv.cust.addr, "Street\nCity, State ZIP", 2)) +
          (open.length ? '<div class="field"><div class="lbl">Part of a project?</div><div class="chips"><button type="button" class="chip' + (!inv.projectId ? " on" : "") + '" data-proj="">No project</button>' + open.map(function (p) { return '<button type="button" class="chip' + (inv.projectId === p.id ? " on" : "") + '" data-proj="' + p.id + '">' + esc(p.name) + "</button>"; }).join("") + "</div></div>" : "");
      }, valid: function () { return !!inv.cust.name.trim() || "Who is it for? A name is enough."; },
      after: function () {
        /* A saved customer typed by name, not picked: their address and email come along. Typed over a customer picked
           before, the name of another saved customer brings that customer's details in place of the first one's. */
        var name = inv.cust.name.trim().toLowerCase(), picked = inv.clientId && clientById(inv.clientId), cl = S.clients.filter(function (x) { return x.name.trim().toLowerCase() === name; })[0];
        if (cl && picked && picked.id !== cl.id) setClient(inv, cl);
        else if (cl && !picked) { ["attn", "addr", "email", "phone"].forEach(function (k) { if (!inv.cust[k] && cl[k]) inv.cust[k] = cl[k]; }); inv.clientId = cl.id; }
        ensureClient(inv);
        if (!adv) { var pr = inv.projectId && projectById(inv.projectId); if (pr) M.applyProject(inv, pr, S.invoices); }
      } },
      project: { q: "Is this part of a project?", why: "Projects keep several invoices together: what was billed before, what is left, which invoice this is. Skip it for one-off work.", html: function () {
        var list = S.projects.filter(function (p) { return p.status !== "closed" && (!p.clientId || !inv.clientId || p.clientId === inv.clientId); });
        return '<div class="chips"><button type="button" class="chip' + (!inv.projectId && !inv._newProject ? " on" : "") + '" data-proj="">No project</button>' + list.map(function (p) { return '<button type="button" class="chip' + (inv.projectId === p.id ? " on" : "") + '" data-proj="' + p.id + '">' + esc(p.name) + "</button>"; }).join("") + '<button type="button" class="chip add' + (inv._newProject ? " on" : "") + '" data-proj="new">+ New project</button></div>' +
          (inv._newProject ? '<div class="card flat stack" data-newproj>' + field("Project name", input("name", inv._newProject.name, 'type="text" placeholder="Second-floor exam rooms"')) +
            '<div class="field"><div class="lbl">How it is billed</div><div class="chips"><button type="button" class="chip' + (inv._newProject.kind === "once" ? " on" : "") + '" data-kind="once">One invoice</button><button type="button" class="chip' + (inv._newProject.kind === "progress" ? " on" : "") + '" data-kind="progress">Several invoices</button></div></div>' +
            (inv._newProject.kind === "progress" ? '<div class="inline-fields">' + field("Contract amount", moneyInput("contract", inv._newProject.contract, "0.00", cur)) + field("Planned invoices", input("planned", inv._newProject.planned, 'type="text" inputmode="numeric" data-num')) + "</div>" + '<div class="inline-fields">' + field("Customer PO", input("po", inv._newProject.po, 'type="text"')) + field("Retainage %", input("retain", inv._newProject.retain, 'type="text" inputmode="decimal" data-num placeholder="0"'), "Held back until the job is done.") + "</div>" : field("Customer PO", input("po", inv._newProject.po, 'type="text"'))) + "</div>" : "") +
          (inv.projectId && projectById(inv.projectId) ? '<div class="picked">' + projectSummaryLine(projectById(inv.projectId)) + "</div>" : "");
      }, valid: function () { if (inv._newProject && !inv._newProject.name.trim()) return "Give the project a name, or pick No project."; return true; },
      after: function () {
        if (inv._newProject) { var p = M.merge(M.blankProject(), inv._newProject); p.clientId = inv.clientId || (ensureClient(inv) || {}).id || ""; if (p.kind !== "progress") p.planned = 1; S.projects.push(p); inv.projectId = p.id; delete inv._newProject; }
        var pr = inv.projectId && projectById(inv.projectId);
        if (pr) M.applyProject(inv, pr, S.invoices); else if (inv.prog) inv.prog.on = false;
      } },
      work: { q: "What are you billing for?", why: "One line per thing. For a flat price, leave the quantity at 1.", html: function () {
        var past = pastItems(), chips = [];
        if (!shown("disc", inv.disc)) chips.push(["disc", "Discount"]);
        if (!shown("deposit", inv.deposit)) chips.push(["deposit", "Deposit received"]);
        if (adv && !shown("freight", inv.freight)) chips.push(["freight", "Freight"]);
        if (adv && !shown("retain", inv.retain)) chips.push(["retain", "Retainage"]);
        var noteOn = !!(inv.show || {}).notes || !!inv.pay.notes;
        if (!noteOn) chips.push(["notes", "Note to the customer"]);
        return (adv ? field("In a sentence (optional)", textarea("desc", inv.desc, "What the work was and the dates it covered", 2)) : "") + '<datalist id="bh-items">' + past.map(function (it) { return '<option value="' + esc(it.d) + '">'; }).join("") + '</datalist><div class="lines-ed" data-lines>' + inv.lines.map(lineForm).join("") + '</div><div class="row"><button type="button" class="btn" style="flex:1" data-addline>' + I.plus + " Add another line</button>" + (past.length ? '<button type="button" class="btn" data-pastitems>Past items</button>' : "") + "</div>" +
          totalsBox() + (chips.length ? '<div class="chips">' + chips.map(function (x) { return '<button type="button" class="chip add" data-addpart="' + x[0] + '">+ ' + x[1] + "</button>"; }).join("") + "</div>" : "") +
          (noteOn ? field("Note to the customer", textarea("pay.notes", inv.pay.notes, "Thank you, warranty, what happens next", 2)) + '<button type="button" class="btn-text quiet small" style="justify-self:start" data-rmpart="notes">Remove the note</button>' : "");
      }, valid: function () { return inv.lines.some(function (l) { return (l.d || "").trim() || M.num(l.r); }) || "At least one line: what it was and what it costs."; },
      after: function () {
        /* The first tax rate typed becomes the usual one. */
        if (!asked.tax && c.taxRate === "" && M.num(inv.tax) > 0) { c.taxRate = M.num(inv.tax); asked.tax = true; toast("Saved " + c.taxRate + "% as your usual tax rate."); }
      } },
      dates: { q: "When is it due?", why: "Net 30 means 30 days after the invoice date. The terms and the date both print.", html: function () {
        return '<div class="field"><div class="lbl">Terms</div><div class="chips">' + M.TERMS.map(function (t) { return '<button type="button" class="chip' + (inv.terms === t ? " on" : "") + '" data-terms="' + t + '">' + t + "</button>"; }).join("") + "</div></div>" +
          field("Due date", input("due", inv.due, 'type="date"')) +
          '<div class="inline-fields">' + field("Invoice date", input("date", inv.date, 'type="date"')) + field("Invoice number", input("num", inv.num, 'type="text" class="mono" autocomplete="off"')) + "</div>";
      }, valid: function () {
        if (!inv.date || !inv.due) return "The invoice needs a date and a due date.";
        if (!String(inv.num || "").trim()) return "The invoice needs a number.";
        if (S.invoices.some(function (i) { return i.id !== inv.id && i.status !== "void" && i.num === inv.num; })) return "Another invoice already has that number.";
        return true;
      }, after: function () {
        /* The first terms picked become the usual ones. */
        if (!asked.terms) { if (inv.terms !== c.terms) { c.terms = inv.terms; toast("Saved " + inv.terms + " as your usual terms."); } asked.terms = true; }
      } },
      extras: { q: "Anything else on this one?", why: "Turn on what applies. Each prints in its place on the invoice.", html: function () {
        var show = inv.show || {};
        var sw = function (k, label, help, on) { return '<label class="switch"><span class="sw-l"><span>' + label + "</span>" + (help ? '<span class="help">' + help + "</span>" : "") + '</span><input type="checkbox" data-ex="' + k + '"' + (on ? " checked" : "") + '><span class="sw"></span></label>'; };
        return '<div class="card flat" style="padding:0.2rem 1rem">' +
          sw("po", "Purchase order number", "How their system matches your invoice to approved money", show.po || inv.po) + (show.po || inv.po ? field("PO number", input("po", inv.po, 'type="text"')) : "") +
          sw("ref", "Reference", "Your quote or job number", show.ref || inv.ref) + (show.ref || inv.ref ? field("Reference", input("ref", inv.ref, 'type="text" placeholder="Quote 1042"')) : "") +
          sw("ship", "Ship to or job site", "", show.ship || inv.ship) + (show.ship || inv.ship ? field("Address", textarea("ship", inv.ship, "Job site or shipping address", 2)) : "") +
          sw("period", "Service period", "The dates the work covered", show.period || inv.from || inv.to) + (show.period || inv.from || inv.to ? '<div class="inline-fields">' + field("From", input("from", inv.from, 'type="date"')) + field("To", input("to", inv.to, 'type="date"')) + "</div>" : "") +
          sw("accept", "Customer acceptance line", "A blank line for them to sign", inv.accept) +
          sw("taxid", "Print your tax ID", c.taxid ? "Tax ID " + esc(c.taxid) : "Add it under Company profile first", inv.showTaxid) +
          "</div>";
      } },
      details: { q: "Your details on the invoice", why: "Asked once. They print at the top of every invoice so customers can reach you. Leave out what you do not want printed.", html: function () {
        return field("Address", textarea("addr", c.addr, "Street\nCity, State ZIP", 2)) + field("Phone", input("phone", c.phone, 'type="tel" autocomplete="tel"')) + field("Email", input("email", c.email, 'type="email" autocomplete="email"'));
      }, after: function () { asked.details = true; } },
      pay: { q: "How do customers pay you?", why: "Asked once, then printed on every invoice. You can change it on any one invoice later.", html: function () {
        return field("Payment instructions", textarea("pay.instr", inv.pay.instr, "Check by mail to the address above, Zelle, cash on completion", 3)) +
          field("Payment link (optional)", input("pay.link", inv.pay.link, 'type="url" inputmode="url" placeholder="https://" autocomplete="off"'), "A PayPal, Venmo, Stripe or bank link. Invoices with a way to pay online get paid faster.");
      }, after: function () { c.payInstr = inv.pay.instr || ""; c.payLink = inv.pay.link || ""; asked.pay = true; } },
      sign: { q: "Sign it?", why: "Optional. A drawn signature prints above a line with your name and the date. The PDF is locked, so nobody can lift it off the page.", html: function () {
        return '<div class="chips"><button type="button" class="chip' + (!inv.sig.on ? " on" : "") + '" data-sigon="0">No signature</button><button type="button" class="chip' + (inv.sig.on ? " on" : "") + '" data-sigon="1">Sign this invoice</button></div>' +
          (inv.sig.on ? (inv.sig.png ? '<div class="card flat sig-saved"><img src="' + inv.sig.png + '" alt="Your signature"><div class="small muted">' + esc([inv.sig.name, inv.sig.title].filter(Boolean).join(", ")) + "</div><div class=\"row\" style=\"margin-top:0.5rem\"><button type=\"button\" class=\"btn small\" data-sign>Sign again</button></div></div>" : '<button type="button" class="btn block" data-sign>' + I.pen + " Draw your signature</button>") : "");
      }, valid: function () { return !inv.sig.on || !!inv.sig.png || "Draw a signature, or pick No signature."; } }
    };
    /* The questions for this invoice are settled when it first opens here, so answering one does not reshuffle the rest. */
    var plan = wizPlan[inv.id];
    if (!plan || plan.tier !== inv.tier) plan = wizPlan[inv.id] = { tier: inv.tier, ids: wizardSteps(inv) };
    var steps = plan.ids.map(function (k) { var s = ALL[k]; s.id = k; return s; });
    /* A draft from before the questions had names kept its place as a number. */
    if (typeof inv._step === "number") inv._step = ["customer", "project", "work", "work", "dates", adv ? "extras" : "work", "pay", "sign"][inv._step] || "customer";
    var want = stepId || inv._step || steps[0].id, at = 0;
    steps.forEach(function (s, i) { if (s.id === want) at = i; });
    function stepHash(i) { return "#/ask/" + inv.id + "/" + steps[i].id; }
    /* Opened without a question in the address (a new invoice, or a draft picked up again): the address becomes the question's. */
    if (stepId !== steps[at].id) { if (ART) memHash = stepHash(at); else history.replaceState(null, "", location.pathname + location.search + stepHash(at)); }

    function suggest(q) {
      q = String(q || "").trim().toLowerCase();
      var list = recentClients().filter(function (cl) { return cl.name && (!q || cl.name.toLowerCase().indexOf(q) >= 0); });
      if (q && list.length === 1 && list[0].id === inv.clientId && list[0].name.trim().toLowerCase() === q) list = [];
      if (!list.length) return "";
      return '<div class="lbl">' + (q ? "Saved customers" : "Recent customers") + '</div><div class="chips">' + list.slice(0, 6).map(function (cl) { return '<button type="button" class="chip' + (inv.clientId === cl.id ? " on" : "") + '" data-client="' + cl.id + '">' + esc(cl.name) + "</button>"; }).join("") + "</div>";
    }
    function lineForm(l, i) {
      return '<div class="line" data-line="' + i + '">' + '<div class="field"><input type="text" data-l="d" list="bh-items" value="' + esc(l.d) + '" placeholder="What was done or delivered" aria-label="Description, line ' + (i + 1) + '"></div>' +
        '<div class="nums' + (adv ? " adv" : "") + '"><div class="field"><label for="l' + i + 'q">Qty</label><input id="l' + i + 'q" type="text" inputmode="decimal" data-l="q" value="' + esc(l.q) + '"></div>' + (adv ? '<div class="field"><label for="l' + i + 'u">Unit</label><input id="l' + i + 'u" type="text" data-l="u" value="' + esc(l.u) + '" placeholder="hr, ea"></div>' : "") + '<div class="field"><label for="l' + i + 'r">Rate</label><span class="money-in" data-sym="' + esc(sym(cur)) + '"><input id="l' + i + 'r" type="text" inputmode="decimal" data-l="r" value="' + esc(l.r) + '" placeholder="0.00"></span></div>' + (adv ? "" : '<div class="field"><div class="lbl r">Amount</div><div class="lamt out">' + money(M.lineAmount(l), cur) + "</div></div>") + "</div>" +
        '<div class="foot">' + (adv ? '<button type="button" class="chip' + (l.t !== false ? " on" : "") + '" data-ltax aria-pressed="' + (l.t !== false) + '">Taxable</button><span class="lamt">' + money(M.lineAmount(l), cur) + "</span>" : "<span></span>") + (inv.lines.length > 1 ? '<button type="button" class="btn small ghost" data-rmline>Remove</button>' : "") + "</div></div>";
    }
    /* The sum under the lines: it adds up as the person types, and the tax rate, a discount and a deposit sit where they act. */
    function totalsBox() {
      var t = M.totals(inv);
      var numIn = function (k, v, label, ph) { return '<input data-k="' + k + '" data-num type="text" inputmode="decimal" value="' + esc(v == null ? "" : v) + '" placeholder="' + (ph || "0") + '" aria-label="' + label + '">'; };
      var moneyIn = function (k, v, label) { return '<span class="money-in" data-sym="' + esc(sym(cur)) + '">' + numIn(k, v, label, "0.00") + "</span>"; };
      var pctIn = function (k, v, label, ph) { return '<span class="pct-in">' + numIn(k, v, label, ph) + "</span>"; };
      /* A part the person added: what it comes to on the first line, where it is typed (and taken away) on the second. */
      var part = function (k, label, amount, controls) { return '<div class="tpart"><div class="trow"><span>' + label + '</span><b data-t="' + k + '">' + amount + '</b></div><div class="tctl">' + controls + '<button type="button" class="btn-text quiet small" data-rmpart="' + k + '">Remove</button></div></div>'; };
      var h = '<div class="totals" data-totals><div class="trow"><span>Subtotal</span><b data-t="sub">' + money(t.sub, cur) + "</b></div>";
      if (shown("disc", inv.disc)) h += part("disc", "Discount", "-" + money(t.disc, cur), (inv.discPct ? pctIn("disc", inv.disc, "Discount percent") : moneyIn("disc", inv.disc, "Discount amount")) + '<button type="button" class="chip mini" data-discpct aria-label="Switch between an amount and a percent">' + (inv.discPct ? "% to " + esc(sym(cur)) : esc(sym(cur)) + " to %") + "</button>");
      h += '<div class="trow"><span>' + esc(inv.taxLabel || "Sales tax") + " " + pctIn("tax", inv.tax, (inv.taxLabel || "Sales tax") + " percent") + '</span><b data-t="tax">' + money(t.tax, cur) + "</b></div>";
      if (adv && shown("freight", inv.freight)) h += part("freight", "Freight", money(t.freight, cur), moneyIn("freight", inv.freight, "Freight"));
      h += '<div class="trow strong"><span>Total</span><b data-t="total">' + money(t.total, cur) + "</b></div>";
      if (adv && shown("retain", inv.retain)) h += part("retain", "Retainage held back", "-" + money(t.retainAmt, cur), pctIn("retain", inv.retain, "Retainage percent", "10"));
      if (shown("deposit", inv.deposit)) h += part("deposit", "Deposit received", "-" + money(t.deposit, cur), moneyIn("deposit", inv.deposit, "Deposit received"));
      if (shown("deposit", inv.deposit) || (adv && shown("retain", inv.retain))) h += '<div class="trow due"><span>Balance due</span><b data-t="due">' + money(t.due, cur) + "</b></div>";
      return h + "</div>";
    }
    function patchTotals() {
      var t = M.totals(inv), set = function (k, v) { var e = $main.querySelector('[data-t="' + k + '"]'); if (e) e.textContent = v; };
      set("sub", money(t.sub, cur)); set("disc", "-" + money(t.disc, cur)); set("tax", money(t.tax, cur)); set("freight", money(t.freight, cur)); set("total", money(t.total, cur));
      set("retain", "-" + money(t.retainAmt, cur)); set("deposit", "-" + money(t.deposit, cur)); set("due", money(t.due, cur));
      $main.querySelectorAll("[data-line]").forEach(function (row, i) { if (inv.lines[i]) row.querySelectorAll(".lamt").forEach(function (el) { el.textContent = money(M.lineAmount(inv.lines[i]), cur); }); });
    }
    function render() {
      var st = steps[at], last = at === steps.length - 1;
      header((adv ? "Advanced" : "Simple") + " invoice", { close: true }); hdrClose = leave;
      inv._step = st.id;
      $main.innerHTML = '<div class="wiz"><div class="prog" role="progressbar" aria-valuemin="1" aria-valuemax="' + steps.length + '" aria-valuenow="' + (at + 1) + '" aria-label="Question ' + (at + 1) + " of " + steps.length + '">' + steps.map(function (s, i) { return "<i class=\"" + (i < at ? "done" : i === at ? "now" : "") + '"></i>'; }).join("") + '</div><div class="small muted">' + (at + 1) + " of " + steps.length + '</div><h1 class="q">' + st.q + '</h1><div class="why">' + st.why + '</div><div class="step" data-step="' + st.id + '">' + st.html() + "</div></div>" +
        '<div class="wiz-nav">' + (at > 0 ? '<button type="button" class="btn" data-prev>Back</button>' : '<button type="button" class="btn" data-go="#/edit/' + inv.id + '">On the page</button>') + '<button type="button" class="btn primary" data-next>' + (last ? "See the invoice" : "Next") + "</button></div>";
      $main.querySelectorAll(".step input:not([type=checkbox]):not([type=date])").forEach(function (el) { el.setAttribute("enterkeyhint", "next"); });
      var first = $main.querySelector(".step input[type=text], .step textarea"); if (first && window.innerWidth > 700) first.focus();
    }
    function readStep() {
      var scope = $main.querySelector(".step"), st = steps[at].id;
      if (!scope || scope.getAttribute("data-step") !== st) return;
      if (st === "details") { readFields(scope, c); return; }
      if (st === "project") { var np = scope.querySelector("[data-newproj]"); if (np && inv._newProject) readFields(np, inv._newProject); return; }
      if (st === "work") scope.querySelectorAll("[data-line]").forEach(function (row, i) { var l = inv.lines[i]; if (!l) return; l.d = row.querySelector('[data-l="d"]').value; l.q = row.querySelector('[data-l="q"]').value === "" ? "" : M.num(row.querySelector('[data-l="q"]').value); var u = row.querySelector('[data-l="u"]'); if (u) l.u = u.value; var r = row.querySelector('[data-l="r"]').value; l.r = r === "" ? "" : M.num(r); });
      if (st === "extras") scope.querySelectorAll("[data-ex]").forEach(function (cb) { var k = cb.getAttribute("data-ex"); if (k === "accept") inv.accept = cb.checked; else if (k === "taxid") inv.showTaxid = cb.checked; else { inv.show[k] = cb.checked; if (!cb.checked) clearPart(inv, k); } });
      readFields(scope, inv);
      if (st === "dates") inv.dueAuto = inv.due === M.dueFor(inv.date, inv.terms);
      inv.updatedAt = M.today();
    }
    function next() {
      readStep();
      var st = steps[at], v = st.valid ? st.valid() : true;
      if (v !== true) { toast(v); return; }
      if (st.after) st.after();
      if (at < steps.length - 1) { var to = stepHash(at + 1); wizFrom[to] = currentHash(); inv._step = steps[at + 1].id; save(); go(to); return; }
      delete inv._step; delete inv._newProject; delete wizPlan[inv.id]; save(true);
      go("#/inv/" + inv.id); toast("Check it over, then send it.");
    }
    function prev() {
      readStep(); save();
      var to = stepHash(at - 1);
      if (!ART && wizFrom[currentHash()] === to) history.back(); else replaceTo(to);
    }
    /* Closing the questions keeps what was typed as a draft; an invoice nobody typed into is not kept at all. */
    function leave() {
      readStep(); save(true);
      if (M.isUntouched(inv)) { go("#/"); return; }
      go("#/inv/" + inv.id); toast("Saved as a draft.");
    }
    onMain("click", function (e) {
      var t = e.target, b;
      if (t.closest("[data-next]")) { next(); return; }
      if (t.closest("[data-prev]")) { prev(); return; }
      if ((b = t.closest("[data-client]"))) { readStep(); var cl = clientById(b.getAttribute("data-client")); if (cl) { if (inv.clientId !== cl.id) inv.projectId = ""; setClient(inv, cl); save(); render(); } return; }
      if ((b = t.closest("[data-proj]"))) { readStep(); var pid = b.getAttribute("data-proj"); if (pid === "new") { inv._newProject = inv._newProject || M.merge(M.blankProject(), { kind: "progress", planned: 3 }); inv.projectId = ""; } else { delete inv._newProject; inv.projectId = pid; var pr = projectById(pid); if (pr && pr.clientId && !inv.clientId) { var c2 = clientById(pr.clientId); if (c2) setClient(inv, c2); } } save(); render(); return; }
      if ((b = t.closest("[data-kind]"))) { readStep(); inv._newProject.kind = b.getAttribute("data-kind"); render(); return; }
      if (t.closest("[data-addline]")) { readStep(); inv.lines.push(M.blankLine()); render(); var rows = $main.querySelectorAll("[data-line]"), lastRow = rows[rows.length - 1]; if (lastRow) lastRow.querySelector("input").focus(); return; }
      if (t.closest("[data-pastitems]")) { readStep(); itemsSheet(inv, function () { render(); }); return; }
      if ((b = t.closest("[data-rmline]"))) { readStep(); inv.lines.splice(Number(b.closest("[data-line]").getAttribute("data-line")), 1); if (!inv.lines.length) inv.lines.push(M.blankLine()); save(); render(); return; }
      if ((b = t.closest("[data-ltax]"))) { readStep(); var li = Number(b.closest("[data-line]").getAttribute("data-line")); inv.lines[li].t = inv.lines[li].t === false; save(); render(); return; }
      if ((b = t.closest("[data-addpart]"))) { readStep(); var k = b.getAttribute("data-addpart"); inv.show[k] = true; save(); render(); var el = $main.querySelector('[data-k="' + (k === "notes" ? "pay.notes" : k) + '"]'); if (el) el.focus(); return; }
      if ((b = t.closest("[data-rmpart]"))) { readStep(); var rk = b.getAttribute("data-rmpart"); inv.show[rk] = false; clearPart(inv, rk); save(); render(); return; }
      if (t.closest("[data-discpct]")) { readStep(); inv.discPct = !inv.discPct; save(); render(); return; }
      if ((b = t.closest("[data-terms]"))) { readStep(); inv.terms = b.getAttribute("data-terms"); inv.due = M.dueFor(inv.date, inv.terms); inv.dueAuto = true; save(); render(); return; }
      if ((b = t.closest("[data-sigon]"))) { readStep(); inv.sig.on = b.getAttribute("data-sigon") === "1"; if (inv.sig.on && !inv.sig.png && c.sig && c.sig.png) { inv.sig.png = c.sig.png; inv.sig.name = c.sig.name; inv.sig.title = c.sig.title; inv.sig.date = M.today(); } save(); render(); return; }
      if (t.closest("[data-sign]")) { readStep(); signatureSheet(inv, function () { render(); }); return; }
    });
    onMain("change", function (e) {
      if (e.target.matches("[data-ex]")) { readStep(); save(); render(); return; }
      if (e.target.matches('[data-k="date"]')) { readStep(); if (inv.dueAuto) { inv.due = M.dueFor(inv.date, inv.terms); render(); } return; }
      if (e.target.matches('[data-l="d"]')) {
        /* A line used before brings its rate along. */
        readStep(); var row = e.target.closest("[data-line]"), i = Number(row.getAttribute("data-line"));
        if (inv.lines[i].r === "") { var hit = pastItems().filter(function (it) { return it.d.toLowerCase() === inv.lines[i].d.trim().toLowerCase(); })[0]; if (hit && hit.r !== "") { inv.lines[i].r = hit.r; if (adv) inv.lines[i].u = hit.u; row.querySelector('[data-l="r"]').value = hit.r; var u = row.querySelector('[data-l="u"]'); if (u && adv) u.value = hit.u; patchTotals(); } }
      }
    });
    /* What is typed is kept as it is typed, so a call or a dead battery in the middle costs nothing. */
    onMain("input", function (e) {
      var st = steps[at].id;
      if (st === "work") { readStep(); patchTotals(); }
      if (e.target.matches('[data-k="cust.name"]')) { var box = $main.querySelector("[data-sugg]"), sg = suggest(e.target.value); if (box) { box.innerHTML = sg; box.hidden = !sg; } }
      clearTimeout(wizTimer); wizTimer = setTimeout(function () { readStep(); save(); }, 600);
    });
    /* Enter on the phone's keyboard moves on: to the rate inside a line, otherwise to the next question. */
    onMain("keydown", function (e) {
      if (e.key !== "Enter" || e.isComposing || !e.target.matches || !e.target.matches(".step input:not([type=checkbox])")) return;
      e.preventDefault();
      var l = e.target.getAttribute("data-l");
      if (l === "d" || l === "q" || l === "u") { var r = e.target.closest("[data-line]").querySelector('[data-l="r"]'); if (r) { r.focus(); r.select(); return; } }
      if (steps[at].id === "work") { e.target.blur(); return; }
      var all = Array.prototype.slice.call($main.querySelectorAll(".step input:not([type=checkbox]):not([type=date]), .step textarea")), i = all.indexOf(e.target);
      if (i >= 0 && i < all.length - 1) { all[i + 1].focus(); return; }
      e.target.blur(); next();
    });
    wizFlush = function () { readStep(); save(); };
    render();
  }
  function clearPart(inv, k) {
    if (k === "po") inv.po = ""; if (k === "ref") inv.ref = ""; if (k === "ship") inv.ship = ""; if (k === "period") { inv.from = ""; inv.to = ""; } if (k === "disc") inv.disc = ""; if (k === "freight") inv.freight = ""; if (k === "deposit") inv.deposit = ""; if (k === "retain") inv.retain = "";
    if (k === "late") inv.pay.late = ""; if (k === "notes") inv.pay.notes = ""; if (k === "link") inv.pay.link = ""; if (k === "fine") inv.fine = ""; if (k === "attn") inv.cust.attn = ""; if (k === "prog") { inv.prog.on = false; } if (k === "sig") { inv.sig.on = false; } if (k === "accept") inv.accept = false; if (k === "taxid") inv.showTaxid = false; if (k === "vat") inv.vat = ""; if (k === "units") inv.lines.forEach(function (l) { l.u = ""; }); if (k === "web") S.company.web = ""; if (k === "phone") inv.cust.phone = "";
  }
  function ensureClient(inv) {
    var name = (inv.cust.name || "").trim(); if (!name) return null;
    /* A different name typed over a picked customer is a different customer, not a new name for the old one. When that
       name is another saved customer's, their saved details are not overwritten by what was left on the invoice. */
    var cl = inv.clientId && clientById(inv.clientId), other = false;
    if (cl && cl.name.trim().toLowerCase() !== name.toLowerCase()) { cl = null; other = true; }
    if (!cl) { cl = S.clients.filter(function (c) { return c.name.trim().toLowerCase() === name.toLowerCase(); })[0]; other = other && !!cl; }
    if (!cl) { cl = M.blankClient(); S.clients.push(cl); }
    cl.name = name; ["attn", "addr", "email", "phone"].forEach(function (k) { if (inv.cust[k] && (!other || !cl[k])) cl[k] = inv.cust[k]; });
    inv.clientId = cl.id;
    if (inv.projectId) { var pr = projectById(inv.projectId); if (pr && !pr.clientId) pr.clientId = cl.id; }
    return cl;
  }
  /* Line items used before, newest first and one per description, so a repeat job is a tap. */
  function pastItems() {
    var seen = {}, out = [];
    S.invoices.slice().sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); }).forEach(function (i) {
      (i.lines || []).forEach(function (l) { var k = (l.d || "").trim().toLowerCase(); if (!k || seen[k]) return; seen[k] = true; out.push({ d: l.d.trim(), r: l.r, u: l.u || "", t: l.t }); });
    });
    return out.slice(0, 60);
  }
  function itemsSheet(inv, done) {
    var items = pastItems();
    sheet("<h2>Past items</h2><p class=\"muted small\">Lines from your earlier invoices. Tap one to add it.</p><div class=\"list\">" + items.map(function (it, i) { return '<button type="button" class="item" data-item="' + i + '"><div><div class="t">' + esc(it.d) + '</div><div class="s">' + esc(it.u ? "per " + it.u : "") + '</div></div><div class="r"><div class="amt">' + (it.r === "" || it.r == null ? "" : money(it.r, inv.currency)) + "</div></div></button>"; }).join("") + "</div>", function (el) {
      el.addEventListener("click", function (e) { var b = e.target.closest("[data-item]"); if (!b) return; var it = items[Number(b.getAttribute("data-item"))]; var last = inv.lines[inv.lines.length - 1]; var line = { d: it.d, q: 1, u: inv.tier === "advanced" ? it.u : "", r: it.r, t: inv.tier === "advanced" ? it.t !== false : true }; if (last && !last.d && !M.num(last.r)) inv.lines[inv.lines.length - 1] = line; else inv.lines.push(line); touch(inv); save(); closeSheet(); done(); });
    });
  }
  function projectSummaryLine(p) {
    var s = M.projectSummary(p, S.invoices);
    return "<b>" + esc(p.name) + "</b><span class=\"small\">" + (p.kind === "progress" ? "Progress billing · " + money(s.billed) + " of " + money(s.contract) + " billed · this would be invoice " + (s.sent + 1) + " of " + Math.max(s.planned, s.sent + 1) : "One-time project") + (p.clientId ? " · " + esc(clientName(p.clientId)) : "") + "</span>";
  }

  /* ---------- Signature sheet ---------- */
  function signatureSheet(inv, done) {
    var c = S.company;
    var sh = sheet('<h2>Sign</h2><p class="muted small">Draw with your finger or a stylus. It prints above a line with your name and today\'s date.</p>' +
      '<div class="sig-wrap"><canvas></canvas><div class="base"></div><div class="x">×</div><div class="hint">Sign here</div></div>' +
      '<div class="inline-fields" style="margin-top:0.8rem">' + field("Name", input("name", inv.sig.name || c.sig.name || "", 'type="text" autocomplete="name"')) + field("Title", input("title", inv.sig.title || c.sig.title || "", 'type="text" placeholder="Owner"')) + "</div>" +
      '<label class="switch"><span class="sw-l"><span>Save as my signature</span><span class="help">Next time, one tap signs.</span></span><input type="checkbox" data-k="remember" checked><span class="sw"></span></label>' +
      '<div class="actions"><div class="row">' + (c.sig.png ? '<button type="button" class="btn" data-saved>Use my saved signature</button>' : "") + '<button type="button" class="btn" data-clear>Clear</button></div><button type="button" class="btn primary big" data-use>Use this signature</button></div>', function (el) {
      var cv = el.querySelector("canvas"), pad;
      function size() { var r = window.devicePixelRatio || 1; cv.width = cv.offsetWidth * r; cv.height = cv.offsetHeight * r; cv.getContext("2d").scale(r, r); if (pad) pad.clear(); }
      size(); pad = new window.SignaturePad(cv, { minWidth: 0.9, maxWidth: 2.4, penColor: "#1a2330", backgroundColor: "rgba(0,0,0,0)" });
      el.addEventListener("click", function (e) {
        if (e.target.closest("[data-clear]")) { pad.clear(); return; }
        if (e.target.closest("[data-saved]")) { finish(c.sig.png); return; }
        if (e.target.closest("[data-use]")) { if (pad.isEmpty()) { toast("Sign in the box first."); return; } finish(trimmed(pad)); }
      });
      function finish(png) {
        var f = {}; readFields(el, f);
        inv.sig.on = true; inv.sig.png = png; inv.sig.name = f.name || ""; inv.sig.title = f.title || ""; inv.sig.date = M.today();
        if (f.remember) { c.sig = { png: png, name: inv.sig.name, title: inv.sig.title }; }
        touch(inv); save(true); closeSheet(); done();
      }
    });
    return sh;
  }
  /* Crops the drawn signature to its ink, with a little room, so it sits tight on the line. */
  function trimmed(pad) {
    var cv = pad.canvas, ctx = cv.getContext("2d"), w = cv.width, h = cv.height, d = ctx.getImageData(0, 0, w, h).data, minX = w, minY = h, maxX = 0, maxY = 0, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 20) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (maxX <= minX || maxY <= minY) return pad.toDataURL("image/png");
    var pad2 = 12, out = document.createElement("canvas"); out.width = maxX - minX + pad2 * 2; out.height = maxY - minY + pad2 * 2;
    out.getContext("2d").drawImage(cv, minX - pad2, minY - pad2, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  }

  /* ---------- The live editor: the invoice is the form ---------- */
  function viewEditor(id) {
    var inv = invoiceById(id); if (!inv) return go("#/");
    tabs(null);
    var cur = inv.currency, adv = inv.tier === "advanced", c = S.company;
    header(inv.num, { back: "#/inv/" + inv.id, actions: '<button type="button" class="btn small primary" data-go="#/inv/' + inv.id + '">Done</button>' });
    var pr = inv.projectId && projectById(inv.projectId);
    /* The invoice itself is what this screen is for, so it starts near the top: one slim bar says what the invoice
       costs and opens the options, and the sending buttons stay within reach at the bottom of the screen. */
    document.body.classList.add("has-bar");
    $main.innerHTML = '<div class="view wide with-bar">' +
      '<div class="inv-bar"><span>' + (adv ? '<span class="pill adv">Advanced</span>' : '<span class="pill simple">Simple</span>') + ' <span data-pricebar>' + priceBar(inv) + '</span></span><button type="button" class="btn small" data-options>Options</button></div>' +
      (adv || pr ? '<div class="inv-bar" data-projbar><span>' + (pr ? "Project: <b>" + esc(pr.name) + "</b>" + (inv.prog && inv.prog.on ? " · invoice " + esc(inv.prog.n) + " of " + esc(inv.prog.m) : "") : "Not on a project") + '</span><button type="button" class="btn small" data-project>' + (pr ? "Change" : "Add to a project") + "</button></div>" : "") +
      (inv.status !== "draft" && inv.status !== "void" ? '<div class="inv-bar warn"><span>' + ((inv.sends || []).length ? esc(sendsText(inv)) : "This invoice went out " + esc(M.shortDate(inv.sentAt || inv.date)) + ".") + ' Changing it changes what you sent. For a correction, duplicate it as a new number instead.</span></div>' : "") +
      '<p class="inv-note">Tap anything on the invoice to change it. The dashed links add more.</p>' +
      '<input type="file" accept="image/*" data-logo hidden><div class="inv" data-inv aria-label="Your invoice, editable"></div></div>' +
      '<div class="wiz-nav act">' + sendButtons(true) + "</div>";
    var inv_el = $main.querySelector("[data-inv]"), logoIn = $main.querySelector("[data-logo]");
    function render() { inv_el.innerHTML = invoiceHtml(inv, c, { edit: true }); inv_el.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(c.accent) ? c.accent : "#1C3F7A"); inv_el.classList.toggle("locked", !inv.unlock); }
    function patch() {
      var t = M.totals(inv), setText = function (sel, v) { var e = inv_el.querySelector(sel); if (e) e.textContent = v; };
      inv.lines.forEach(function (l, i) { var a = inv_el.querySelector('[data-amt="' + i + '"]'); if (a) a.innerHTML = money(M.lineAmount(l), cur) + (adv && l.t !== false && M.num(inv.tax) && inv.lines.some(function (x) { return x.t === false; }) ? '<span class="t">T</span>' : ""); });
      setText("[data-sub]", money(t.sub, cur)); setText("[data-taxbase]", money(t.taxBase, cur)); setText("[data-taxamt]", money(t.tax, cur)); setText("[data-total]", money(t.total, cur)); setText("[data-due]", money(t.due, cur)); setText("[data-retainamt]", "-" + money(t.retainAmt, cur)); setText("[data-paid]", "-" + money(t.paid, cur));
      var tr = inv_el.querySelector("[data-taxrow]"); if (tr) tr.hidden = !(M.num(inv.tax) && t.taxBase !== t.sub);
      var pb = $main.querySelector("[data-pricebar]"); if (pb) pb.innerHTML = priceBar(inv);
      var pg = M.progress(inv); if (pg) { setText("[data-prog-this]", money(pg.thisInvoice, cur)); setText("[data-prog-billed]", money(pg.billed, cur)); setText("[data-prog-left]", money(pg.remaining, cur)); var bar = inv_el.querySelector("[data-prog-bar]"); if (bar) bar.style.width = pg.pct.toFixed(1) + "%"; }
    }
    function upgrade(k) {
      return ask("Switch to advanced?", (k ? "<b>" + esc(M.ADVANCED[k]) + "</b> is part of the advanced invoice. " : "It adds a purchase order, job site, service period, progress billing on a project, freight, retainage, late fee terms, your signature and a customer acceptance line. ") + "Advanced is " + M.priceText(M.PRICING.advanced) + " instead of " + M.priceText(M.PRICING.simple) + " when paid downloads start" + (M.PRICING.mode === "free" ? " (free now)" : "") + ". Everything you have typed stays.", [{ label: "Switch to advanced", cls: "primary", value: true }, { label: "Keep it simple", value: false }]).then(function (yes) { if (yes) { inv.tier = "advanced"; adv = true; touch(inv); save(); viewEditor(inv.id); } return yes; });
    }
    inv_el.addEventListener("input", function (e) {
      var el = e.target;
      if (el.matches("[contenteditable][data-f]")) {
        var path = el.getAttribute("data-f"), fmt = el.getAttribute("data-num"), target = path.indexOf("company.") === 0 ? S : inv, p2 = path.indexOf("company.") === 0 ? path : path;
        if (fmt) { var raw = el.textContent.trim(); M.set(target, p2, raw === "" ? "" : M.num(raw)); }
        else M.set(target, p2, el.classList.contains("multi") ? el.innerText.replace(/\n$/, "") : el.textContent);
        if (path === "num") { var dup = S.invoices.some(function (i) { return i.id !== inv.id && i.status !== "void" && i.num === inv.num; }); el.style.color = dup ? "#B42318" : ""; if (dup) toast("Another invoice already has that number."); }
        patch(); touch(inv); save(); return;
      }
      if (el.matches("select[data-f]")) { inv.terms = el.value; var st = el.parentNode.querySelector(".sel-text"); if (st) st.textContent = inv.terms; if (inv.dueAuto) { inv.due = M.dueFor(inv.date, inv.terms); refreshDate("due"); } touch(inv); save(); return; }
      if (el.matches("select[data-cur]")) { inv.currency = el.value; cur = el.value; touch(inv); save(); render(); return; }
      if (el.matches('input[type="date"]')) {
        var p = el.closest("[data-date]").getAttribute("data-date"); M.set(inv, p, el.value);
        if (p === "due") inv.dueAuto = false;
        if (p === "date" && inv.dueAuto) { inv.due = M.dueFor(inv.date, inv.terms); refreshDate("due"); }
        if (p === "sig.date") { /* nothing else */ }
        refreshDate(p); touch(inv); save(); return;
      }
      if (el.matches("[data-accent]")) { c.accent = el.value; inv_el.style.setProperty("--accent", c.accent); save(); }
    });
    function refreshDate(path) { var wrap = inv_el.querySelector('[data-date="' + path + '"]'); if (!wrap) return; var v = M.get(inv, path) || "", b = wrap.querySelector(".dt-text"), i = wrap.querySelector("input"); b.textContent = M.longDate(v) || i.getAttribute("aria-label"); b.classList.toggle("ph", !v); if (i.value !== v) i.value = v; }
    inv_el.addEventListener("keydown", function (e) {
      var el = e.target; if (!el.matches || !el.matches("[contenteditable][data-f]")) return;
      if (e.key === "Enter" && !el.classList.contains("multi")) {
        e.preventDefault();
        var m = /^lines\.(\d+)\.r$/.exec(el.getAttribute("data-f"));
        if (m && Number(m[1]) === inv.lines.length - 1) { addLine(); return; }
        var all = Array.prototype.slice.call(inv_el.querySelectorAll("[contenteditable][data-f]")), i = all.indexOf(el); if (all[i + 1]) all[i + 1].focus();
      }
    });
    inv_el.addEventListener("paste", function (e) {
      var el = e.target; if (!el.matches || !el.matches("[contenteditable][data-f]")) return;
      e.preventDefault(); var text = (e.clipboardData || window.clipboardData).getData("text/plain"); if (!el.classList.contains("multi")) text = text.replace(/\s*\n\s*/g, " ");
      document.execCommand("insertText", false, text);
    });
    inv_el.addEventListener("focusout", function (e) { var el = e.target; if (!el.matches || !el.matches("[contenteditable][data-num]")) return; var fmt = el.getAttribute("data-num"), v = M.get(el.getAttribute("data-f").indexOf("company.") === 0 ? S : inv, el.getAttribute("data-f")); el.textContent = v === "" || v == null ? "" : fmt === "money" ? money(v, cur) : fmt === "pct" ? M.num(v) + "%" : String(v); });
    inv_el.addEventListener("focusin", function (e) { var el = e.target; if (!el.matches || !el.matches("[contenteditable][data-num]")) return; var v = M.get(el.getAttribute("data-f").indexOf("company.") === 0 ? S : inv, el.getAttribute("data-f")); el.textContent = v === "" || v == null ? "" : String(v); });
    inv_el.addEventListener("click", function (e) {
      var b = e.target.closest("button, [data-date]"); if (!b) return;
      if (b.hasAttribute("data-show")) {
        var k = b.getAttribute("data-show");
        if (k === "line") { addLine(); return; }
        if (k === "pastitems") { itemsSheet(inv, function () { render(); }); return; }
        if (k === "adv") { upgrade(); return; }
        if (k === "biz") { bizSheet(function () { header(inv.num, { back: "#/inv/" + inv.id, actions: '<button type="button" class="btn small primary" data-go="#/inv/' + inv.id + '">Done</button>' }); render(); }); return; }
        if (!adv && M.ADVANCED[k]) { upgrade(k).then(function (yes) { if (yes) { var i2 = invoiceById(inv.id); i2.show[k] = true; if (k === "prog") projectSheet(i2, function () { viewEditor(i2.id); }); else viewEditor(i2.id); } }); return; }
        if (k === "prog") { projectSheet(inv, function () { viewEditor(inv.id); }); return; }
        if (k === "sig") { signatureSheet(inv, function () { render(); }); return; }
        if (k === "client") { clientSheet(inv, function () { render(); }); return; }
        if (k === "accept") { inv.accept = true; } if (k === "taxid") { inv.showTaxid = true; if (!c.taxid) toast("Add your tax ID under Company profile; it prints once it is there."); } if (k === "units") { inv.show.units = true; }
        inv.show[k] = true; render(); touch(inv); save();
        var first = inv_el.querySelector('[data-f^="' + ({ web: "company.web", taxid: "company.taxid", vat: "vat", ref: "ref", attn: "cust.attn", phone: "cust.phone", ship: "ship", period: "from", disc: "disc", freight: "freight", deposit: "deposit", retain: "retain", late: "pay.late", notes: "pay.notes", link: "pay.link", fine: "fine", po: "po", desc: "desc" })[k] + '"]'); if (first) first.focus(); return;
      }
      if (b.hasAttribute("data-hide")) { var hk = b.getAttribute("data-hide"); inv.show[hk] = false; clearPart(inv, hk); if (hk === "prog") { inv.projectId = ""; } render(); touch(inv); save(); return; }
      if (b.hasAttribute("data-tax")) { var li = Number(b.getAttribute("data-tax")); inv.lines[li].t = inv.lines[li].t === false; b.setAttribute("aria-pressed", inv.lines[li].t !== false ? "true" : "false"); patch(); touch(inv); save(); return; }
      if (b.hasAttribute("data-rmline")) { inv.lines.splice(Number(b.getAttribute("data-rmline")), 1); if (!inv.lines.length) inv.lines.push(M.blankLine()); render(); touch(inv); save(); return; }
      if (b.hasAttribute("data-discpct")) { inv.discPct = !inv.discPct; render(); touch(inv); save(); return; }
      if (b.hasAttribute("data-logo-pick")) { logoIn.click(); return; }
      if (b.hasAttribute("data-logo-clear")) { c.logo = ""; logoIn.value = ""; render(); save(); return; }
      if (b.hasAttribute("data-sign")) { signatureSheet(inv, function () { render(); }); return; }
      if (b.hasAttribute("data-date") && !e.target.matches("input")) { var di = b.querySelector("input"); try { if (di.showPicker) di.showPicker(); else di.focus(); } catch (err) { di.focus(); } }
    });
    function addLine() { inv.lines.push(M.blankLine()); render(); touch(inv); save(); var last = inv_el.querySelector('[data-f="lines.' + (inv.lines.length - 1) + '.d"]'); if (last) last.focus(); }
    logoIn.addEventListener("change", function (e) { var f = e.target.files && e.target.files[0]; if (!f) return; readLogo(f, function (url) { c.logo = url; render(); save(); toast("Logo saved to your company profile."); }); });
    onMain("click", function (e) {
      if (e.target.closest("[data-pdf]")) { makePdf(inv, false); return; }
      if (e.target.closest("[data-share]")) { makePdf(inv, true); return; }
      if (e.target.closest("[data-send]")) { sendSheet(inv); return; }
      if (e.target.closest("[data-project]")) { projectSheet(inv, function () { viewEditor(inv.id); }); return; }
      if (e.target.closest("[data-options]")) { optionsSheet(inv, { done: function () { viewEditor(inv.id); }, upgrade: function () { upgrade(); }, project: function () { projectSheet(inv, function () { viewEditor(inv.id); }); } }); return; }
    });
    render();
  }

  /* What this invoice will cost to download, as the editor's bar says it. */
  function priceBar(inv) {
    var how = M.unlockHow(S, inv), under = M.PRICING.freeUnder ? "under " + M.priceText(M.PRICING.freeUnder) : "";
    if (M.PRICING.mode === "free") return M.isSmall(inv) ? "Free (" + under + ")" : "Free during launch (" + M.priceText(M.price(inv)) + " later)";
    if (how === "small") return "<b>Free</b>, " + under;
    if (how === "pay") return "<b>" + M.priceText(M.price(inv)) + "</b> to download";
    if (how === "first") return "<b>Free</b>, your first invoice";
    return "Download included";
  }
  /* The invoice as HTML. edit: contenteditable with add links; otherwise a read-only preview. Used by the editor, the detail page and printing. */
  function invoiceHtml(inv, c, o) {
    o = o || {}; var edit = !!o.edit, adv = inv.tier === "advanced", cur = inv.currency, t = M.totals(inv), cu = inv.cust, show = inv.show || {};
    var shown = function (key, value) { return !!show[key] || !!(value && String(value).trim()); };
    function ed(path, ph, cls, multi, extra) {
      var v = M.get(path.indexOf("company.") === 0 ? { company: c } : inv, path); v = v == null ? "" : String(v);
      if (!edit) return v ? '<span class="ed' + (cls ? " " + cls : "") + (multi ? " multi" : "") + '">' + esc(v) + "</span>" : "";
      return '<span class="ed' + (cls ? " " + cls : "") + (multi ? " multi" : "") + '" contenteditable="true" data-f="' + path + '" data-ph="' + esc(ph) + '"' + (extra || "") + ">" + esc(v) + "</span>";
    }
    function edNum(path, ph, cls, fmt) {
      var v = M.get(inv, path), text = v === "" || v == null ? "" : (fmt === "money" ? money(v, cur) : fmt === "pct" ? M.num(v) + "%" : String(v));
      if (!edit) return '<span class="ed num' + (cls ? " " + cls : "") + '">' + esc(text) + "</span>";
      return '<span class="ed num' + (cls ? " " + cls : "") + '" contenteditable="true" inputmode="decimal" data-f="' + path + '" data-num="' + (fmt || "plain") + '" data-ph="' + esc(ph) + '">' + esc(text) + "</span>";
    }
    function dateField(path, ph) { var v = M.get(inv, path) || ""; if (!edit) return "<b>" + esc(M.longDate(v) || "") + "</b>"; return '<span class="dt" data-date="' + path + '"><input type="date" value="' + esc(v) + '" aria-label="' + esc(ph) + '"><b class="dt-text' + (v ? "" : " ph") + '">' + (M.longDate(v) || ph) + "</b></span>"; }
    var addLink = function (key, label) { return edit && (adv || !M.ADVANCED[key]) ? '<button type="button" class="add" data-show="' + key + '">+ ' + esc(label) + "</button>" : ""; };
    var removeLink = function (key, label) { return edit ? '<button type="button" class="rm" data-hide="' + key + '" aria-label="Remove ' + esc(label) + '">×</button>' : ""; };
    var st = M.status(inv), pg = M.progress(inv);
    var html = (st === "paid" || st === "void" ? '<div class="stamp ' + st + (o.slam ? " slam" : "") + '">' + st + "</div>" : "");
    html += '<header class="inv-top"><div class="inv-biz">' +
      (c.logo ? '<span class="logo-wrap"><img src="' + c.logo + '" alt="">' + (edit ? '<button type="button" class="rm logo-rm" data-logo-clear aria-label="Remove logo">×</button>' : "") + "</span>" : (edit ? '<button type="button" class="add logo-add" data-logo-pick>+ Add your logo</button>' : "")) +
      (c.logo ? '<span class="bc"><b>' + esc(c.name) + "</b></span>" : '<span class="bn">' + esc(c.name) + "</span>") + lines(c.addr).map(function (l) { return '<span class="bc">' + esc(l) + "</span>"; }).join("") + [c.phone, c.email, c.web].filter(Boolean).map(function (l) { return '<span class="bc">' + esc(l) + "</span>"; }).join("") +
      (adv && inv.showTaxid && c.taxid ? '<span class="bc">Tax ID ' + esc(c.taxid) + " " + removeLink("taxid", "tax ID") + "</span>" : "") + (adv && shown("vat", inv.vat) ? '<span class="bc">' + ed("vatLabel", "VAT no.", "inl") + " " + ed("vat", "Registration number", "inl") + " " + removeLink("vat", "registration number") + "</span>" : "") +
      (edit ? '<span class="adds"><button type="button" class="add" data-show="biz">' + (c.addr || c.phone || c.email ? "Edit your details" : "+ Add your address and phone") + "</button>" + (adv && !inv.showTaxid ? addLink("taxid", "Tax ID") : "") + (adv && !shown("vat", inv.vat) ? addLink("vat", "VAT or GST number") : "") + "</span>" : "") + "</div>" +
      '<div class="inv-title"><h2>Invoice</h2>' + (edit ? '<label class="color-pick" title="Color on the invoice"><input type="color" value="' + esc(/^#[0-9a-f]{6}$/i.test(c.accent) ? c.accent : "#1C3F7A") + '" data-accent aria-label="Color on the invoice"><i></i>Color</label>' : "") +
      '<dl class="inv-meta"><div class="big"><dt>Invoice</dt><dd>' + ed("num", "INV-1001") + "</dd></div><div><dt>Date</dt><dd>" + dateField("date", "Pick a date") + "</dd></div>" +
      "<div><dt>Terms</dt><dd>" + (edit ? '<span class="sel"><select data-f="terms" aria-label="Terms">' + M.TERMS.map(function (x) { return "<option" + (x === inv.terms ? " selected" : "") + ">" + x + "</option>"; }).join("") + '</select><b class="sel-text">' + esc(inv.terms) + "</b></span>" : esc(inv.terms)) + "</dd></div>" +
      "<div><dt>Due</dt><dd>" + dateField("due", "Due date") + "</dd></div>" +
      (adv && shown("po", inv.po) ? "<div><dt>Customer PO</dt><dd>" + ed("po", "PO number") + removeLink("po", "PO") + "</dd></div>" : "") +
      (adv && shown("ref", inv.ref) ? "<div><dt>Reference</dt><dd>" + ed("ref", "Job or quote") + removeLink("ref", "reference") + "</dd></div>" : "") +
      (adv && pg ? "<div><dt>This is invoice</dt><dd>" + edNum("prog.n", "1", "inl") + " of " + edNum("prog.m", "3", "inl") + "</dd></div>" : "") +
      "</dl>" + (edit ? '<span class="adds right">' + (shown("po", inv.po) ? "" : addLink("po", "Customer PO")) + (shown("ref", inv.ref) ? "" : addLink("ref", "Reference")) + "</span>" : "") + "</div></header>";

    html += '<section class="inv-parties"><div><h3>Bill to</h3>' + ed("cust.name", "Customer name", "bn") + (adv && shown("attn", cu.attn) ? "<div>Attn: " + ed("cust.attn", "Accounts payable, a person", "inl") + removeLink("attn", "attention line") + "</div>" : "") + ed("cust.addr", "Billing address", "", true) + ed("cust.email", "Email", "") + (adv && shown("phone", cu.phone) ? ed("cust.phone", "Phone", "") : "") +
      (edit ? '<span class="adds">' + (S.clients.length ? addLink("client", "Pick a saved customer") : "") + (adv && !shown("attn", cu.attn) ? addLink("attn", "Attention line") : "") + (adv && !shown("phone", cu.phone) ? addLink("phone", "Phone") : "") + (shown("ship", inv.ship) ? "" : addLink("ship", "Ship to or job site")) + "</span>" : "") + "</div>" +
      (adv && shown("ship", inv.ship) ? "<div><h3>Ship to / job site " + removeLink("ship", "ship to") + "</h3>" + ed("ship", "Address or job site", "", true) + "</div>" : "") +
      (edit || inv.desc || (adv && (inv.from || inv.to)) ? '<div><h3>Services</h3>' + ed("desc", "What you did, in a sentence or two", "", true) + (adv && shown("period", inv.from || inv.to) ? '<div class="period">' + dateField("from", "From") + " to " + dateField("to", "To") + " " + removeLink("period", "service period") + "</div>" : (edit ? '<span class="adds">' + addLink("period", "Service period") + "</span>" : "")) + "</div>" : "") + "</section>";

    var useUnits = adv && (show.units || inv.lines.some(function (l) { return l.u; })), mixed = adv && M.num(inv.tax) > 0 && inv.lines.some(function (l) { return l.t === false; });
    html += '<table class="inv-lines"><thead><tr><th>Description</th><th class="num">Qty</th>' + (useUnits ? '<th class="num unit">Unit</th>' : "") + '<th class="num rate">Rate</th><th class="num">Amount</th>' + (edit ? '<th class="ctl"></th>' : "") + "</tr></thead><tbody>" +
      inv.lines.map(function (l, i) {
        if (!edit && !(l.d || M.num(l.r))) return "";
        return '<tr data-i="' + i + '"><td>' + ed("lines." + i + ".d", "What was done or delivered", "ld") + '</td><td class="num" data-l="Qty">' + edNum("lines." + i + ".q", "1", "", "plain") + "</td>" + (useUnits ? '<td class="num unit" data-l="Unit">' + ed("lines." + i + ".u", "ea", "inl") + "</td>" : "") + '<td class="num rate" data-l="Rate">' + edNum("lines." + i + ".r", money(0, cur), "", "money") + '</td><td class="num amt" data-l="Amount" data-amt="' + i + '">' + money(M.lineAmount(l), cur) + (mixed && l.t !== false ? '<span class="t">T</span>' : "") + "</td>" +
          (edit ? '<td class="ctl">' + (adv ? '<button type="button" class="tax" data-tax="' + i + '" aria-pressed="' + (l.t !== false ? "true" : "false") + '" title="' + esc(inv.taxLabel || "Sales tax") + ' applies to this line">tax</button>' : "") + '<button type="button" class="rm" data-rmline="' + i + '" aria-label="Remove line">×</button></td>' : "") + "</tr>";
      }).join("") + (edit ? '<tr class="addrow"><td colspan="' + (useUnits ? 6 : 5) + '">' + addLink("line", "Add a line item") + (pastItems().length ? " " + addLink("pastitems", "Past items") : "") + (adv && !useUnits ? " " + addLink("units", "Units column") : "") + "</td></tr>" : "") + "</tbody></table>";

    var prog = "";
    if (adv && pg) {
      prog = '<div class="inv-prog"><h3>Progress on ' + (inv.po ? esc(inv.po) : "the contract") + " " + removeLink("prog", "progress billing") + "</h3><div><span>Contract amount</span>" + edNum("prog.contract", money(0, cur), "", "money") + "</div><div><span>Previously billed</span>" + edNum("prog.prev", money(0, cur), "", "money") + '</div><div><span>This invoice (' + esc(pg.n) + " of " + esc(pg.m) + ')</span><span data-prog-this>' + money(pg.thisInvoice, cur) + '</span></div><div><span>Billed to date</span><span data-prog-billed>' + money(pg.billed, cur) + '</span></div><div><span>Remaining</span><span data-prog-left>' + money(pg.remaining, cur) + '</span></div><div class="bar"><i data-prog-bar style="width:' + pg.pct.toFixed(1) + '%"></i></div></div>';
    } else if (edit && adv) prog = '<div class="adds col">' + addLink("prog", "Progress billing (invoice 2 of 3 on a project)") + "</div>";
    var showTotal = t.disc || M.num(inv.tax) || t.freight || t.retainAmt || t.deposit || t.paid;
    var tot = '<div class="inv-totals"><div><span>Subtotal</span><span data-sub>' + money(t.sub, cur) + "</span></div>" +
      (shown("disc", inv.disc) ? "<div><span>Discount " + (edit ? '<button type="button" class="tax" data-discpct aria-pressed="' + (inv.discPct ? "true" : "false") + '" title="Percent or amount">' + (inv.discPct ? "%" : sym(cur)) + "</button>" : (inv.discPct ? "(" + M.num(inv.disc) + "%)" : "")) + removeLink("disc", "discount") + "</span>" + (inv.discPct ? edNum("disc", "0%", "", "pct") : edNum("disc", money(0, cur), "", "money")) + "</div>" : "") +
      (M.num(inv.tax) || edit ? '<div data-taxrow' + (M.num(inv.tax) && t.taxBase !== t.sub ? "" : ' hidden') + '><span>Taxable subtotal</span><span data-taxbase>' + money(t.taxBase, cur) + "</span></div><div><span>" + ed("taxLabel", "Sales tax", "inl") + " at " + edNum("tax", "0%", "inl", "pct") + '</span><span data-taxamt>' + money(t.tax, cur) + "</span></div>" : "") +
      (adv && shown("freight", inv.freight) ? "<div><span>Freight " + removeLink("freight", "freight") + "</span>" + edNum("freight", money(0, cur), "", "money") + "</div>" : "") +
      (showTotal || edit ? '<div class="total"><span>Total</span><span data-total>' + money(t.total, cur) + "</span></div>" : "") +
      (adv && shown("retain", inv.retain) ? "<div><span>Less retainage " + edNum("retain", "0%", "inl", "pct") + " " + removeLink("retain", "retainage") + '</span><span data-retainamt>-' + money(t.retainAmt, cur) + "</span></div>" : "") +
      (shown("deposit", inv.deposit) ? "<div><span>Deposit received " + removeLink("deposit", "deposit") + "</span>" + edNum("deposit", money(0, cur), "", "money") + "</div>" : "") +
      (t.paid ? '<div><span>Payments received</span><span data-paid>-' + money(t.paid, cur) + "</span></div>" : "") +
      '<div class="due"><span>Balance due</span><span data-due>' + money(t.due, cur) + "</span></div>" +
      (edit ? '<span class="adds">' + (shown("disc", inv.disc) ? "" : addLink("disc", "Discount")) + (shown("freight", inv.freight) ? "" : addLink("freight", "Freight")) + (shown("deposit", inv.deposit) ? "" : addLink("deposit", "Deposit received")) + (shown("retain", inv.retain) ? "" : addLink("retain", "Retainage")) + "</span>" : "") + "</div>";
    html += '<div class="inv-sum">' + prog + tot + "</div>";

    var pay = inv.pay;
    html += '<section class="inv-pay"><div><h3>Payment</h3>' + (edit || pay.to ? "<div>Make checks payable to " + ed("pay.to", "your business", "inl b") + "</div>" : "") + ed("pay.instr", "Where to send a check, ACH details, or a card link", "", true) +
      (shown("link", pay.link) ? "<div>Pay online: " + (edit ? ed("pay.link", "https://", "inl") : '<a href="' + esc(pay.link) + '">' + esc(pay.link) + "</a>") + " " + removeLink("link", "payment link") + "</div>" : "") +
      (adv && shown("late", pay.late) ? "<div>" + ed("pay.late", "Late fee or early-pay terms", "") + " " + removeLink("late", "late fee") + "</div>" : "") +
      (edit ? '<span class="adds">' + (shown("link", pay.link) ? "" : addLink("link", "Payment link")) + (shown("late", pay.late) ? "" : addLink("late", "Late fee or early-pay terms")) + "</span>" : "") + "</div>" +
      (shown("notes", pay.notes) ? "<div><h3>Notes " + removeLink("notes", "notes") + "</h3>" + ed("pay.notes", "Thank you, warranty, or what happens next", "", true) + "</div>" : (edit ? '<div class="adds col">' + addLink("notes", "Note to the customer") + "</div>" : "")) + "</section>";

    if (adv && ((inv.sig && inv.sig.on) || inv.accept || edit)) {
      html += '<section class="inv-sig">' + (inv.sig && inv.sig.on ? "<div>" + (inv.sig.png ? '<img class="sig-img" src="' + inv.sig.png + '" alt="Signature">' : "") + '<div class="line signed">' + esc([inv.sig.name, inv.sig.title].filter(Boolean).join(", ") || "Authorized signature") + (inv.sig.date ? "<br>Signed electronically in " + M.NAME + " on " + esc(M.longDate(inv.sig.date)) : "") + (edit ? ' <button type="button" class="add" data-sign>Sign again</button> ' + removeLink("sig", "signature") : "") + "</div></div>" : (edit ? '<div class="adds col">' + addLink("sig", "Sign this invoice") + "</div>" : "")) +
        (inv.accept ? '<div><div class="line">Accepted by (customer)' + (edit ? " " + removeLink("accept", "acceptance line") : "") + '<span style="float:right">Date</span></div></div>' : (edit ? '<div class="adds col">' + addLink("accept", "Customer acceptance line") + "</div>" : "")) + "</section>";
    }
    if (adv && shown("fine", inv.fine)) html += '<div class="inv-fine">' + ed("fine", "Terms and conditions", "", true) + " " + removeLink("fine", "terms") + "</div>";
    else if (edit && adv) html += '<div class="adds" style="margin-top:0.8rem">' + addLink("fine", "Terms and conditions") + "</div>";
    /* On a simple invoice the advanced parts are one link, which asks before it switches the invoice over. */
    if (edit && !adv) html += '<div class="adds" style="margin-top:0.9rem"><button type="button" class="add adv" data-show="adv">+ PO, job site, progress billing, freight, retainage, signature</button></div>';
    var reach = [c.phone, c.email].filter(Boolean).join(" or ");
    html += '<footer class="inv-foot"><span>' + (reach ? "Questions? " + esc(reach) : "") + "</span><span>" + (inv.fingerprint ? "Invoice ID <b>" + esc(inv.fingerprint) + "</b> · " : "") + "Made with <b>" + M.NAME + "</b>, " + M.SITE + "</span></footer>";
    return html;
  }
  function lines(s) { return String(s || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }

  /* ---------- Sheets used by the editor ---------- */
  function clientSheet(inv, done) {
    sheet("<h2>Saved customers</h2><div class=\"list\" style=\"margin-top:0.6rem\">" + S.clients.map(function (c) { return '<button type="button" class="item" data-pick="' + c.id + '"><div><div class="t">' + esc(c.name) + '</div><div class="s">' + esc(lines(c.addr)[0] || c.email || "") + "</div></div></button>"; }).join("") + "</div>", function (el) {
      el.addEventListener("click", function (e) { var b = e.target.closest("[data-pick]"); if (!b) return; setClient(inv, clientById(b.getAttribute("data-pick"))); touch(inv); save(); closeSheet(); done(); });
    });
  }
  function projectSheet(inv, done) {
    var list = S.projects.filter(function (p) { return p.status !== "closed"; });
    sheet("<h2>Project</h2><p class=\"muted small\">Invoices on a project are kept together. On an advanced invoice, a progress project fills in the contract amount, what was billed before and which invoice this is.</p>" +
      '<div class="chips" style="margin-bottom:0.8rem"><button type="button" class="chip' + (!inv.projectId ? " on" : "") + '" data-pick="">No project</button>' + list.map(function (p) { return '<button type="button" class="chip' + (inv.projectId === p.id ? " on" : "") + '" data-pick="' + p.id + '">' + esc(p.name) + "</button>"; }).join("") + "</div>" +
      '<div class="card flat stack" data-newproj><h3>Or a new project</h3>' + field("Project name", input("name", "", 'type="text" placeholder="Second-floor exam rooms"')) + '<div class="field"><div class="lbl">How it is billed</div><div class="chips"><button type="button" class="chip on" data-kind="once">One invoice</button><button type="button" class="chip" data-kind="progress">Several invoices</button></div></div>' +
      '<div data-progfields hidden><div class="inline-fields">' + field("Contract amount", moneyInput("contract", "", "0.00", inv.currency)) + field("Planned invoices", input("planned", 3, 'type="text" inputmode="numeric" data-num')) + "</div>" + '<div class="inline-fields">' + field("Customer PO", input("po", "", 'type="text"')) + field("Retainage %", input("retain", "", 'type="text" inputmode="decimal" data-num placeholder="0"')) + "</div></div>" +
      '<button type="button" class="btn primary" data-create>Create and use it</button></div>', function (el) {
      var kind = "once";
      el.addEventListener("click", function (e) {
        var b;
        if ((b = e.target.closest("[data-kind]"))) { kind = b.getAttribute("data-kind"); el.querySelectorAll("[data-kind]").forEach(function (x) { x.classList.toggle("on", x === b); }); el.querySelector("[data-progfields]").hidden = kind !== "progress"; return; }
        if ((b = e.target.closest("[data-pick]"))) { var pid = b.getAttribute("data-pick"); inv.projectId = pid; var p = pid && projectById(pid); if (p) { M.applyProject(inv, p, S.invoices); if (p.clientId && !inv.cust.name) { var cl = clientById(p.clientId); if (cl) setClient(inv, cl); } } else { inv.prog.on = false; } touch(inv); save(); closeSheet(); done(); return; }
        if ((b = e.target.closest("[data-create]"))) { var np = M.blankProject(); readFields(el.querySelector("[data-newproj]"), np); if (!np.name.trim()) { toast("Give the project a name."); return; } np.kind = kind; if (kind !== "progress") { np.planned = 1; np.contract = ""; np.retain = ""; } np.clientId = (ensureClient(inv) || {}).id || ""; S.projects.push(np); inv.projectId = np.id; M.applyProject(inv, np, S.invoices); touch(inv); save(true); closeSheet(); done(); return; }
      });
    });
  }
  function optionsSheet(inv, on) {
    var adv = inv.tier === "advanced", pr = inv.projectId && projectById(inv.projectId);
    sheet("<h2>Options</h2><div class=\"stack\" style=\"margin-top:0.6rem\">" +
      (adv ? "" : '<button type="button" class="btn" data-upgrade>Switch to advanced</button><p class="small muted" style="margin:-0.4rem 0 0">Adds a PO, job site, progress billing, freight, retainage and your signature.</p>' +
        '<button type="button" class="btn" data-project>' + (pr ? "Project: " + esc(pr.name) : "Add to a project") + "</button>") +
      '<button type="button" class="btn" data-go="#/ask/' + inv.id + '">Ask me the questions instead</button>' +
      (adv ? field("Currency", '<select data-k="currency">' + Object.keys(M.CURRENCIES).map(function (k) { return '<option value="' + k + '"' + (k === inv.currency ? " selected" : "") + ">" + k + ", " + M.CURRENCIES[k].name + "</option>"; }).join("") + "</select>") : "") +
      field("Paper size", '<select data-k="paper">' + Object.keys(M.PAPER).map(function (k) { return '<option value="' + k + '"' + (k === S.company.paper ? " selected" : "") + ">" + M.PAPER[k] + "</option>"; }).join("") + "</select>", "For every invoice.") +
      '<button type="button" class="btn primary" data-ok>Done</button></div>', function (el) {
      el.addEventListener("click", function (e) {
        if (e.target.closest("[data-upgrade]")) { closeSheet(); on.upgrade(); return; }
        if (e.target.closest("[data-project]")) { closeSheet(); on.project(); return; }
        if (!e.target.closest("[data-ok]")) return;
        var f = {}; readFields(el, f); if (adv && f.currency) inv.currency = f.currency; if (f.paper) S.company.paper = f.paper; touch(inv); save(); closeSheet(); on.done();
      });
    });
  }
  /* The details that print at the top of every invoice, from wherever the person noticed they were missing. */
  function bizSheet(done) {
    var c = S.company;
    sheet('<h2>Your details</h2><p class="muted small">They print at the top of every invoice.</p><div class="stack">' + field("Business name", input("name", c.name, 'type="text" autocomplete="organization"')) + field("Address", textarea("addr", c.addr, "Street\nCity, State ZIP", 2)) +
      field("Phone", input("phone", c.phone, 'type="tel" autocomplete="tel"')) + field("Email", input("email", c.email, 'type="email" autocomplete="email"')) + field("Website", input("web", c.web, 'type="text" placeholder="example.com" autocomplete="off"')) +
      '<button type="button" class="btn primary big" data-ok>Save</button></div>', function (el) {
      el.addEventListener("click", function (e) {
        if (!e.target.closest("[data-ok]")) return;
        var f = {}; readFields(el, f);
        if (!String(f.name || "").trim()) { toast("The name is the one thing an invoice cannot do without."); return; }
        c.name = f.name.trim(); c.addr = f.addr || ""; c.phone = f.phone || ""; c.email = f.email || ""; c.web = f.web || "";
        (S.settings.asked || (S.settings.asked = {})).details = true; save(true); closeSheet(); done();
      });
    });
  }

  /* ---------- Invoice detail ---------- */
  function viewInvoice(id, slam) {
    var inv = invoiceById(id); if (!inv) return go("#/invoices");
    tabs("invoices");
    var t = M.totals(inv), st = M.status(inv), pr = inv.projectId && projectById(inv.projectId);
    header(inv.num, { back: pr ? "#/project/" + pr.id : "#/invoices", actions: (st !== "void" ? '<button type="button" class="btn small" data-go="#/edit/' + inv.id + '">' + I.pen + " Edit</button>" : "") });
    $main.innerHTML = '<div class="view wide stack">' +
      '<div class="card ledger"><div class="row between"><div><div class="row" style="gap:0.5rem">' + statusPill(inv) + '<span class="pill ' + (inv.tier === "advanced" ? "adv" : "simple") + '">' + inv.tier + '</span></div><div style="font-size:1.6rem;font-weight:600;margin-top:0.3rem" class="mono">' + money(st === "draft" || st === "paid" || st === "void" ? t.total : t.due, inv.currency) + '</div><div class="muted small">' + esc(inv.cust.name || "No customer yet") + " · " + esc(dueText(inv)) + (pr ? ' · <a href="#/project/' + pr.id + '">' + esc(pr.name) + "</a>" : "") + "</div></div></div>" +
      /* The main button follows the invoice: a draft is for sending, one that went out is for getting paid. */
      '<div class="row send-row" style="margin-top:0.9rem">' + (st === "void" ? "" : st === "draft" ? sendButtons() : (st !== "paid" ? '<button type="button" class="btn green" data-payment>' + I.check + " Record a payment</button>" : "") + sendButtons(false, true)) + '<button type="button" class="btn" data-more>More</button></div>' +
      ((inv.sends || []).length ? '<p class="small muted note-line" style="margin:0.6rem 0 0">' + I.mail + "<span>" + esc(sendsText(inv)) + "</span></p>" : "") +
      (M.PRICING.mode === "free" ? '<p class="small muted" style="margin:0.7rem 0 0">' + (M.isSmall(inv) ? "Under " + M.priceText(M.PRICING.freeUnder) + ", so this one is always free." : "Free during launch. Later, " + M.priceText(M.price(inv)) + " once for this invoice; sending it again stays free.") + "</p>" : "") + "</div>" +
      ((inv.payments || []).length ? '<div class="card"><div class="section-head" style="margin-top:0"><h2>Payments</h2><span class="mono small">' + money(t.paid, inv.currency) + " of " + money(t.owed, inv.currency) + '</span></div><div class="list">' + inv.payments.map(function (p) { return '<div class="item" style="cursor:default"><div><div class="t">' + esc(p.method || "Payment") + (p.note ? ", " + esc(p.note) : "") + '</div><div class="s">' + esc(M.longDate(p.date)) + '</div></div><div class="r"><div class="amt">' + money(p.amount, inv.currency) + '</div><button type="button" class="btn-text quiet small" data-rmpay="' + p.id + '">Remove</button></div></div>'; }).join("") + "</div></div>" : "") +
      '<div class="inv readonly' + (inv.unlock ? "" : " locked") + '" data-inv style="--accent:' + esc(/^#[0-9a-f]{6}$/i.test(S.company.accent) ? S.company.accent : "#1C3F7A") + '">' + invoiceHtml(inv, S.company, { edit: false, slam: slam }) + "</div>" +
      '<p class="small muted">' + (inv.fingerprint ? "Invoice ID " + esc(inv.fingerprint) + " is printed on the PDF; it changes if the invoice changes, so a copy that comes back can be checked against this one. " : "") + "Created " + esc(M.longDate(inv.createdAt)) + (inv.sentAt ? ", sent " + esc(M.longDate(inv.sentAt)) : "") + (inv.paidAt ? ", paid " + esc(M.longDate(inv.paidAt)) : "") + ".</p></div>";
    onMain("click", function (e) {
      if (e.target.closest("[data-pdf]")) { makePdf(inv, false); return; }
      if (e.target.closest("[data-share]")) { makePdf(inv, true); return; }
      if (e.target.closest("[data-send]")) { sendSheet(inv); return; }
      if (e.target.closest("[data-payment]")) { paymentSheet(inv); return; }
      if (e.target.closest("[data-more]")) { moreSheet(inv); return; }
      var rp = e.target.closest("[data-rmpay]"); if (rp) { inv.payments = inv.payments.filter(function (p) { return p.id !== rp.getAttribute("data-rmpay"); }); if (inv.status === "paid") { inv.status = "sent"; inv.paidAt = ""; } touch(inv); save(); viewInvoice(inv.id); }
    });
  }
  /* Is this invoice the one on screen (its page or its editor)? In the artifact preview the route is in memory. */
  function onInvoice(inv) { var h = currentHash(); return h === "#/inv/" + inv.id || h.indexOf("#/edit/" + inv.id) === 0; }
  function sendsText(inv) {
    var last = inv.sends[inv.sends.length - 1];
    return "Sent to " + last.to + " on " + M.longDate(M.iso(new Date(last.at))) + (inv.sends.length > 1 ? " (" + inv.sends.length + " times)" : "") + ".";
  }
  /* Send to customer: the phone's email app opens with the PDF attached and the address, subject and message filled in;
     the person presses Send there, from their own address. In a browser the PDF downloads first and the email opens
     without it (browsers cannot attach), so the note says to attach it. */
  function sendSheet(inv) {
    if (!inv.cust.name.trim() && !inv.lines.some(function (l) { return l.d; })) { toast("Add a customer and at least one line first."); return; }
    var d = M.emailDraft(inv, S.company);
    var how = NATIVE ? "Your email app opens with the PDF attached and everything below filled in. Press Send there; it goes from your own address." :
      "The PDF downloads, then your email opens with everything below filled in. Attach the PDF from your downloads and press Send." + (canShareFiles ? " Or share the PDF straight to an app; the address is copied for you." : "");
    sheet("<h2>Send to customer</h2><p class=\"small muted\" style=\"margin:0.3rem 0 0.6rem\">" + how + '</p><div class="stack">' +
      field("To", input("to", d.to, 'type="email" autocomplete="email" placeholder="customer@example.com"')) +
      field("Subject", input("subject", d.subject, 'type="text"')) +
      field("Message", textarea("body", d.body, "", 9)) +
      '<button type="button" class="btn primary big" data-ok>' + I.mail + (NATIVE ? " Open email app" : " Download and open email") + "</button>" +
      (!NATIVE && canShareFiles ? '<button type="button" class="btn big" data-share-instead>' + I.share + " Share the PDF to an app instead</button>" : "") + "</div>", function (el) {
      el.addEventListener("click", function (e) {
        var ok = e.target.closest("[data-ok]"), alt = e.target.closest("[data-share-instead]"); if (!ok && !alt) return;
        var f = {}; readFields(el, f);
        var to = (f.to || "").trim();
        if (ok && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { toast("Enter the customer's email address."); return; }
        if (to && to !== inv.cust.email) { inv.cust.email = to; var cl = ensureClient(inv); if (cl) cl.email = to; }
        closeSheet();
        sendInvoice(inv, { to: to, subject: f.subject || d.subject, body: f.body || d.body }, !!alt);
      });
    });
  }
  function sendInvoice(inv, mail, shareInstead) {
    unlock(inv).then(function (ok) {
      if (!ok) return;
      busy("Making the PDF");
      return M.fingerprint(inv, S.company).then(function (fp) { inv.fingerprint = fp; return window.BHPDF.make(inv, S.company); }).then(function (out) {
        busy(null);
        var done = function (howSent) {
          if (howSent === "cancelled") { save(true); return; }
          if (inv.status === "draft") { inv.status = "sent"; inv.sentAt = M.today(); }
          ensureClient(inv);
          inv.sends = inv.sends || []; inv.sends.push({ at: new Date().toISOString(), to: mail.to, how: howSent }); touch(inv); save(true);
          /* Sent from the editor: the making is over, so the person lands on the invoice's own page, which says it went out. */
          if (currentHash().indexOf("#/edit/" + inv.id) === 0) replaceTo("#/inv/" + inv.id); else if (onInvoice(inv)) route();
          toast(howSent === "share" ? "Pick the app to send it with. The address is copied; paste it in the To line." : (NATIVE ? "Press Send in your email app." : "The PDF is in your downloads; attach it and press Send."), 5000);
        };
        if (NATIVE) return NATIVE.emailPdf(out.bytes, out.name, mail).then(function () { done("email"); }, function (e) { toast("Could not open an email app: " + (e && e.message ? e.message : e)); done("cancelled"); });
        var blob = new Blob([out.bytes], { type: "application/pdf" });
        if (shareInstead && navigator.share) {
          var file = new File([blob], out.name, { type: "application/pdf" });
          if (navigator.clipboard && mail.to) navigator.clipboard.writeText(mail.to).catch(function () { });
          return navigator.share({ files: [file], title: mail.subject, text: mail.body }).then(function () { done("share"); }, function (e) { done(e && e.name === "AbortError" ? "cancelled" : "share"); });
        }
        return Promise.resolve(download(blob, out.name)).then(function (saved) {
          if (saved === "cancelled") { done("cancelled"); return; }
          var href = "mailto:" + encodeURIComponent(mail.to) + "?subject=" + encodeURIComponent(mail.subject) + "&body=" + encodeURIComponent(mail.body);
          setTimeout(function () { window.location.href = href; }, 350);
          done("email");
        });
      });
    }).catch(function (e) { busy(null); toast("Could not make the PDF: " + (e && e.message ? e.message : e)); });
  }
  function paymentSheet(inv) {
    var t = M.totals(inv);
    sheet("<h2>Record a payment</h2><div class=\"stack\" style=\"margin-top:0.6rem\"><div class=\"inline-fields\">" + field("Amount", moneyInput("amount", t.due > 0 ? t.due.toFixed(2) : "", "0.00", inv.currency)) + field("Date", input("date", M.today(), 'type="date"')) + "</div>" +
      '<div class="field"><div class="lbl">How</div><div class="chips">' + ["Check", "ACH", "Card", "Cash", "Zelle", "Venmo", "PayPal", "Other"].map(function (m, i) { return '<button type="button" class="chip' + (i === 0 ? " on" : "") + '" data-method="' + m + '">' + m + "</button>"; }).join("") + "</div></div>" + field("Note", input("note", "", 'type="text" placeholder="Check number, reference"')) +
      '<button type="button" class="btn primary big" data-ok>Record it</button></div>', function (el) {
      var method = "Check";
      el.addEventListener("click", function (e) {
        var b;
        if ((b = e.target.closest("[data-method]"))) { method = b.getAttribute("data-method"); el.querySelectorAll("[data-method]").forEach(function (x) { x.classList.toggle("on", x === b); }); return; }
        if (e.target.closest("[data-ok]")) {
          var f = {}; readFields(el, f); var amt = M.num(f.amount); if (!(amt > 0)) { toast("How much came in?"); return; }
          inv.payments = inv.payments || []; inv.payments.push({ id: M.uid(), date: f.date || M.today(), amount: M.round2(amt), method: method, note: f.note || "" });
          if (inv.status === "draft") { inv.status = "sent"; inv.sentAt = inv.sentAt || M.today(); }
          var paid = M.totals(inv).due <= 0.004; if (paid) { inv.status = "paid"; inv.paidAt = f.date || M.today(); }
          touch(inv); save(true); closeSheet(); viewInvoice(inv.id, paid); toast(paid ? "Paid in full." : "Recorded. " + money(M.totals(inv).due, inv.currency) + " still due.");
        }
      });
    });
  }
  function moreSheet(inv) {
    var st = M.status(inv), opts = [];
    if (st === "draft") opts.push(["sent", "Mark as sent without downloading"]);
    if (st !== "draft" && st !== "void" && st !== "paid") opts.push(["paidfull", "Mark paid in full"]);
    if (st !== "draft" && st !== "void") opts.push(["draft", "Back to draft"]);
    opts.push(["dup", "Duplicate as a new invoice"]);
    opts.push(["print", "Print"]);
    if (st !== "void" && st !== "draft") opts.push(["void", "Void this invoice"]);
    if (st === "draft" || st === "void") opts.push(["delete", "Delete"]);
    sheet("<h2>" + esc(inv.num) + '</h2><div class="actions">' + opts.map(function (o) { return '<button type="button" class="btn' + (o[0] === "delete" || o[0] === "void" ? " danger" : "") + '" data-op="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>", function (el) {
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-op]"); if (!b) return; var op = b.getAttribute("data-op"); closeSheet();
        if (op === "sent") { inv.status = "sent"; inv.sentAt = M.today(); ensureClient(inv); touch(inv); save(true); viewInvoice(inv.id); toast("Marked as sent."); }
        if (op === "paidfull") { var t = M.totals(inv); inv.payments = inv.payments || []; if (t.due > 0) inv.payments.push({ id: M.uid(), date: M.today(), amount: t.due, method: "Payment", note: "" }); inv.status = "paid"; inv.paidAt = M.today(); touch(inv); save(true); viewInvoice(inv.id, true); toast("Paid in full."); }
        if (op === "draft") { inv.status = "draft"; inv.sentAt = ""; inv.paidAt = ""; touch(inv); save(true); viewInvoice(inv.id); }
        if (op === "dup") { var d = M.clone(inv); d.id = M.uid(); d.num = S.company.prefix + S.company.next; S.company.next = (M.num(S.company.next) || 1) + 1; d.status = "draft"; d.date = M.today(); d.due = M.dueFor(d.date, d.terms); d.dueAuto = true; d.payments = []; d.unlock = null; d.fingerprint = ""; d.sentAt = ""; d.paidAt = ""; d.createdAt = d.updatedAt = M.today(); if (d.sig) d.sig.date = d.sig.on ? M.today() : ""; d.deposit = ""; if (d.projectId && projectById(d.projectId)) M.applyProject(d, projectById(d.projectId), S.invoices); S.invoices.push(d); save(true); go("#/edit/" + d.id); toast("Copied as " + d.num + "."); }
        if (op === "print") { window.print(); }
        if (op === "void") { ask("Void " + inv.num + "?", "The number stays on record as void, which is what an auditor expects. Nothing is deleted.", [{ label: "Void it", cls: "danger", value: true }, { label: "Keep it", value: false }]).then(function (y) { if (y) { inv.status = "void"; touch(inv); save(true); viewInvoice(inv.id, true); } }); }
        if (op === "delete") { ask("Delete " + inv.num + "?", "Gone for good from this device.", [{ label: "Delete", cls: "danger", value: true }, { label: "Keep it", value: false }]).then(function (y) { if (y) { S.invoices = S.invoices.filter(function (i) { return i.id !== inv.id; }); save(true); go("#/invoices"); toast("Deleted."); } }); }
      });
    });
  }

  /* ---------- PDF: unlock, build, deliver ---------- */
  function unlock(inv) {
    var how = M.unlockHow(S, inv);
    if (how === "unlocked") return Promise.resolve(true);
    if (how === "pay") return ask("Pay " + M.priceText(M.price(inv)) + " to download", "One payment unlocks this invoice for good; download it again any time. Packs and the year pass are cheaper per invoice. Payments are not switched on yet in this build.", [{ label: "OK", value: false }]);
    if (how === "credit") S.credits[inv.tier] = M.num(S.credits[inv.tier]) - 1;
    inv.unlock = { at: new Date().toISOString(), tier: inv.tier, how: how };
    if (how === "small") toast("Under " + M.priceText(M.PRICING.freeUnder) + ", so this one is free.");
    if (how === "first") toast("Your first invoice is on us.");
    if (how === "credit") toast(S.credits[inv.tier] + " " + inv.tier + (S.credits[inv.tier] === 1 ? " invoice" : " invoices") + " left in your pack.");
    return Promise.resolve(true);
  }
  var busyEl = null;
  function busy(msg) { if (busyEl) busyEl.remove(); busyEl = null; if (!msg) return; busyEl = document.createElement("div"); busyEl.className = "toast"; busyEl.textContent = msg; $layer.appendChild(busyEl); }
  function makePdf(inv, share) {
    if (!inv.cust.name.trim() && !inv.lines.some(function (l) { return l.d; })) { toast("Add a customer and at least one line first."); return; }
    unlock(inv).then(function (ok) {
      if (!ok) return;
      busy("Making the PDF");
      return M.fingerprint(inv, S.company).then(function (fp) { inv.fingerprint = fp; return window.BHPDF.make(inv, S.company); }).then(function (out) {
        busy(null);
        return deliver(out, inv, share).then(function (how) {
          if (how === "cancelled") { save(true); return; }
          var first = inv.status === "draft";
          if (first) { inv.status = "sent"; inv.sentAt = M.today(); }
          ensureClient(inv); touch(inv); save(true);
          if (onInvoice(inv)) route();
          var where = how === "downloaded" && savedWhere ? "Saved to " + savedWhere + "." : "PDF ready.";
          savedWhere = "";
          toast(first ? where + " Marked as sent; change that under More on the invoice." : where, how === "downloaded" && NATIVE ? 4200 : undefined);
        });
      });
    }).catch(function (e) { busy(null); toast("Could not make the PDF: " + (e && e.message ? e.message : e)); });
  }
  var savedWhere = "";
  function deliver(out, inv, share) {
    if (NATIVE) {
      var title = "Invoice " + inv.num + (S.company.name ? " from " + S.company.name : "");
      if (share) return NATIVE.sharePdf(out.bytes, out.name, title).then(function () { return "shared"; }, function (e) { if (e && /cancel/i.test(String(e.message || e))) return "cancelled"; toast("Could not share: " + (e && e.message ? e.message : e)); return "cancelled"; });
      return NATIVE.saveFile(out.bytes, out.name, "application/pdf").then(function (where) { savedWhere = where; return "downloaded"; }, function (e) { toast("Could not save: " + (e && e.message ? e.message : e)); return "cancelled"; });
    }
    var blob = new Blob([out.bytes], { type: "application/pdf" });
    if (share && navigator.share) {
      try {
        var file = new File([blob], out.name, { type: "application/pdf" });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: "Invoice " + inv.num, text: "Invoice " + inv.num + (S.company.name ? " from " + S.company.name : "") }).then(function () { return "shared"; }).catch(function (e) { if (e && e.name === "AbortError") return "cancelled"; return download(blob, out.name); });
        }
      } catch (e) { /* fall through to a download */ }
    }
    return Promise.resolve(download(blob, out.name));
  }
  function download(blob, name) {
    if (NATIVE) {
      return blob.arrayBuffer().then(function (buf) { return NATIVE.saveFile(buf, name, blob.type || "application/octet-stream"); })
        .then(function (where) { toast("Saved to " + where, 4200); return "downloaded"; }, function (e) { toast("Could not save: " + (e && e.message ? e.message : e)); return "cancelled"; });
    }
    if (ART) {
      return Promise.resolve().then(function () { return window.BHPreview.save(name, blob); })
        .then(function () { return "downloaded"; }, function (e) { if (e && e.code === "declined") return "cancelled"; toast("Could not save the file: " + (e && e.message ? e.message : e)); return "cancelled"; });
    }
    var url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
    return "downloaded";
  }

  /* ---------- Invoices list ---------- */
  function viewInvoices(filter) {
    tabs("invoices"); header("Invoices", { actions: '<button type="button" class="btn small primary" data-go="#/new">' + I.plus + " New</button>" });
    var q = "";
    function list() {
      var items = S.invoices.filter(function (i) {
        var s = M.status(i);
        if (filter === "open") return s === "sent" || s === "partial" || s === "overdue";
        if (filter === "overdue") return s === "overdue";
        if (filter === "paid") return s === "paid";
        if (filter === "draft") return s === "draft";
        return s !== "void" || filter === "all";
      }).filter(function (i) { if (!q) return true; var hay = (i.num + " " + i.cust.name + " " + (i.po || "") + " " + (i.ref || "")).toLowerCase(); return hay.indexOf(q.toLowerCase()) >= 0; })
        .sort(function (a, b) { return (b.date || "").localeCompare(a.date || "") || b.num.localeCompare(a.num, undefined, { numeric: true }); });
      return items.length ? items.map(invoiceItem).join("") : emptyState(q ? "Nothing matches." : filter === "all" ? "No invoices yet." : "Nothing here.");
    }
    var filters = [["all", "All"], ["draft", "Drafts"], ["open", "Open"], ["overdue", "Overdue"], ["paid", "Paid"]];
    $main.innerHTML = '<div class="view stack"><div class="chips">' + filters.map(function (f) { return '<a class="chip' + (filter === f[0] ? " on" : "") + '" href="#/invoices/' + f[0] + '">' + f[1] + "</a>"; }).join("") + '</div><input class="input" type="search" placeholder="Search number, customer, PO" data-q><div class="list" data-list>' + list() + "</div></div>";
    $main.querySelector("[data-q]").addEventListener("input", function (e) { q = e.target.value; $main.querySelector("[data-list]").innerHTML = list(); });
  }

  /* ---------- Projects ---------- */
  function projectItem(p) {
    var s = M.projectSummary(p, S.invoices);
    return '<a class="item" href="#/project/' + p.id + '"><div><div class="t">' + esc(p.name) + (p.status === "closed" ? ' <span class="pill">Closed</span>' : "") + '</div><div class="s">' + esc(clientName(p.clientId) || "No customer") + " · " + (p.kind === "progress" ? s.sent + " of " + Math.max(s.planned, s.sent) + " invoices" + (s.contract ? ", " + Math.round(s.pct) + "% billed" : "") : s.count + (s.count === 1 ? " invoice" : " invoices")) + '</div>' + (p.kind === "progress" && s.contract ? '<div class="bar" style="margin-top:0.4rem;width:min(100%,220px)"><i style="width:' + s.pct.toFixed(1) + '%"></i></div>' : "") + '</div><div class="r"><div class="amt' + (s.outstanding ? " due" : "") + '">' + money(s.outstanding || s.billed) + '</div><div class="small muted">' + (s.outstanding ? "outstanding" : "billed") + "</div></div></a>";
  }
  function viewProjects() {
    tabs("projects"); header("Projects", { actions: '<button type="button" class="btn small primary" data-go="#/project/new">' + I.plus + " New</button>" });
    var open = S.projects.filter(function (p) { return p.status !== "closed"; }), closed = S.projects.filter(function (p) { return p.status === "closed"; });
    $main.innerHTML = '<div class="view stack">' + (S.projects.length ? "" : '<p class="muted">A project keeps the invoices for one job together: billed to date, paid, what is left. Bill it once, or several times with progress billing (invoice 2 of 3, previously billed, remaining) on advanced invoices.</p>') +
      '<div class="list">' + (open.length ? open.map(projectItem).join("") : emptyState("No open projects.", '<a class="btn primary" href="#/project/new">New project</a>')) + "</div>" +
      (closed.length ? '<div class="section-head"><h2>Closed</h2></div><div class="list">' + closed.map(projectItem).join("") + "</div>" : "") + "</div>";
  }
  function viewProject(id) {
    var p = projectById(id); if (!p) return go("#/projects");
    tabs("projects"); header(p.name, { back: "#/projects", actions: '<button type="button" class="btn small" data-go="#/project/' + p.id + '/edit">' + I.pen + " Edit</button>" });
    var s = M.projectSummary(p, S.invoices);
    $main.innerHTML = '<div class="view stack">' +
      '<div class="card ledger"><div class="muted small">' + esc(clientName(p.clientId) || "No customer") + (p.po ? " · " + esc(p.po) : "") + " · " + (p.kind === "progress" ? "Progress billing" : "One-time") + (p.status === "closed" ? " · Closed" : "") + "</div>" +
      (p.kind === "progress" ? '<div style="margin:0.6rem 0 0.3rem"><div class="row between"><span class="small">Billed ' + money(s.billed) + " of " + money(s.contract) + (s.changes ? " (with " + money(s.changes) + " in change orders)" : "") + '</span><span class="small mono">' + Math.round(s.pct) + '%</span></div><div class="bar"><i style="width:' + s.pct.toFixed(1) + '%"></i></div></div>' : "") +
      '<div class="stats" style="margin-top:0.8rem"><div class="stat"><div class="v">' + money(s.billed) + '</div><div class="l">Billed</div></div><div class="stat green"><div class="v">' + money(s.paid) + '</div><div class="l">Paid</div></div><div class="stat' + (s.outstanding ? " red" : "") + '"><div class="v">' + money(s.outstanding) + '</div><div class="l">Outstanding</div></div></div>' +
      (p.kind === "progress" ? '<div class="stats" style="margin-top:0.6rem"><div class="stat"><div class="v">' + money(s.remaining) + '</div><div class="l">Remaining</div></div><div class="stat"><div class="v">' + money(s.retained) + '</div><div class="l">Retainage held</div></div><div class="stat"><div class="v">' + s.sent + " / " + Math.max(s.planned, s.sent) + '</div><div class="l">Invoices</div></div></div>' : "") +
      (p.status !== "closed" ? '<div class="row" style="margin-top:0.9rem"><a class="btn primary" href="#/new/' + (p.kind === "progress" ? "advanced" : "") + "/" + p.id + '">' + I.plus + " New invoice on this project</a></div>" : "") + "</div>" +
      (p.notes ? '<div class="card flat small">' + esc(p.notes).replace(/\n/g, "<br>") + "</div>" : "") +
      '<div class="section-head"><h2>Invoices</h2></div><div class="list">' + (s.invoices.length ? s.invoices.map(invoiceItem).join("") : emptyState("No invoices on this project yet.")) + "</div></div>";
  }
  function viewProjectEdit(id) {
    var p = id ? M.clone(projectById(id)) : M.blankProject(); if (id && !p.id) return go("#/projects");
    tabs("projects"); header(id ? "Edit project" : "New project", { back: id ? "#/project/" + id : "#/projects" });
    function form() {
      return '<div class="view stack"><div class="card stack">' + field("Project name", input("name", p.name, 'type="text" placeholder="Second-floor exam rooms"')) +
        field("Customer", '<select data-k="clientId"><option value="">Pick one</option>' + S.clients.map(function (c) { return '<option value="' + c.id + '"' + (c.id === p.clientId ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select>", S.clients.length ? "" : "Customers are saved from your invoices; the first invoice on this project will set it.") +
        '<div class="field"><div class="lbl">How it is billed</div><div class="chips"><button type="button" class="chip' + (p.kind === "once" ? " on" : "") + '" data-kind="once">One invoice</button><button type="button" class="chip' + (p.kind === "progress" ? " on" : "") + '" data-kind="progress">Several invoices (progress billing)</button></div></div>' +
        (p.kind === "progress" ? '<div class="inline-fields">' + field("Contract amount", moneyInput("contract", p.contract, "0.00")) + field("Planned invoices", input("planned", p.planned, 'type="text" inputmode="numeric" data-num')) + "</div>" + '<div class="inline-fields">' + field("Customer PO", input("po", p.po, 'type="text"')) + field("Retainage %", input("retain", p.retain, 'type="text" inputmode="decimal" data-num placeholder="0"'), "Held back from each invoice until the end.") + "</div>" : field("Customer PO", input("po", p.po, 'type="text"'))) +
        field("Notes", textarea("notes", p.notes, "Scope, who to call, anything to remember", 3)) +
        (id ? '<label class="switch"><span class="sw-l"><span>Closed</span><span class="help">Done and paid. Closed projects drop off the lists.</span></span><input type="checkbox" data-closed' + (p.status === "closed" ? " checked" : "") + '><span class="sw"></span></label>' : "") + "</div>" +
        (p.kind === "progress" ? '<div class="card"><div class="section-head" style="margin-top:0"><h2>Change orders</h2></div><p class="small muted">Approved additions or deductions. They adjust the contract amount on every invoice after them.</p><div class="list" data-changes>' + (p.changes || []).map(function (ch, i) { return '<div class="item" style="cursor:default"><div><div class="t">' + esc(ch.d || "Change order") + '</div><div class="s">' + esc(M.shortDate(ch.date)) + '</div></div><div class="r"><div class="amt">' + money(ch.amount) + '</div><button type="button" class="btn-text quiet small" data-rmch="' + i + '">Remove</button></div></div>'; }).join("") + '</div><div class="inline-fields" style="margin-top:0.6rem">' + field("Description", input("_chd", "", 'type="text" placeholder="Added outlet run"')) + field("Amount (negative to deduct)", moneyInput("_cha", "", "0.00")) + '</div><button type="button" class="btn small" style="margin-top:0.5rem" data-addch>Add change order</button></div>' : "") +
        '<button type="button" class="btn primary big block" data-save>' + (id ? "Save project" : "Create project") + "</button>" + (id ? '<button type="button" class="btn-text danger" data-delete>Delete this project</button>' : "") + "</div>";
    }
    function read() { var scope = $main; readFields(scope, p); delete p._chd; delete p._cha; var cl = scope.querySelector("[data-closed]"); if (cl) p.status = cl.checked ? "closed" : "open"; }
    $main.innerHTML = form();
    onMain("click", function (e) {
      var b;
      if ((b = e.target.closest("[data-kind]"))) { read(); p.kind = b.getAttribute("data-kind"); $main.innerHTML = form(); return; }
      if ((b = e.target.closest("[data-addch]"))) { var d = $main.querySelector('[data-k="_chd"]').value, a = M.num($main.querySelector('[data-k="_cha"]').value); if (!a) { toast("How much does it change the contract by?"); return; } read(); p.changes = p.changes || []; p.changes.push({ d: d, amount: M.round2(a), date: M.today() }); $main.innerHTML = form(); return; }
      if ((b = e.target.closest("[data-rmch]"))) { read(); p.changes.splice(Number(b.getAttribute("data-rmch")), 1); $main.innerHTML = form(); return; }
      if (e.target.closest("[data-save]")) {
        read(); if (!p.name.trim()) { toast("Give the project a name."); return; }
        if (p.kind !== "progress") { p.planned = 1; } else p.planned = Math.max(1, Math.round(M.num(p.planned)) || 1);
        var idx = S.projects.findIndex(function (x) { return x.id === p.id; }); if (idx >= 0) S.projects[idx] = p; else S.projects.push(p);
        save(true); go("#/project/" + p.id); toast(id ? "Project saved." : "Project created."); return;
      }
      if (e.target.closest("[data-delete]")) { ask("Delete this project?", "Its invoices stay; they just come off the project.", [{ label: "Delete", cls: "danger", value: true }, { label: "Keep it", value: false }]).then(function (y) { if (!y) return; S.invoices.forEach(function (i) { if (i.projectId === p.id) { i.projectId = ""; if (i.prog) i.prog.on = false; } }); S.projects = S.projects.filter(function (x) { return x.id !== p.id; }); save(true); go("#/projects"); }); }
    });
  }

  /* ---------- Clients ---------- */
  function viewClients() {
    tabs("more"); header("Customers", { back: "#/more", actions: '<button type="button" class="btn small primary" data-go="#/client/new">' + I.plus + " New</button>" });
    $main.innerHTML = '<div class="view stack"><div class="list">' + (S.clients.length ? S.clients.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { var n = S.invoices.filter(function (i) { return i.clientId === c.id; }).length; return '<a class="item" href="#/client/' + c.id + '"><div><div class="t">' + esc(c.name) + '</div><div class="s">' + esc(lines(c.addr)[0] || c.email || "") + '</div></div><div class="r"><div class="small muted">' + n + (n === 1 ? " invoice" : " invoices") + "</div></div></a>"; }).join("") : emptyState("Customers are saved from your invoices as you send them.")) + "</div></div>";
  }
  function viewClientEdit(id) {
    var c = id ? M.clone(clientById(id)) : M.blankClient(); if (id && !c.id) return go("#/clients");
    tabs("more"); header(id ? c.name : "New customer", { back: "#/clients" });
    $main.innerHTML = '<div class="view stack"><div class="card stack">' + field("Name", input("name", c.name, 'type="text" autocomplete="organization"')) + field("Attention", input("attn", c.attn, 'type="text" placeholder="Accounts payable"')) + field("Billing address", textarea("addr", c.addr, "", 2)) + '<div class="inline-fields">' + field("Email", input("email", c.email, 'type="email"')) + field("Phone", input("phone", c.phone, 'type="tel"')) + "</div>" +
      field("Their terms", '<select data-k="terms"><option value="">Your usual (' + esc(S.company.terms) + ")</option>" + M.TERMS.map(function (t) { return "<option" + (t === c.terms ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select>", "Some customers pay on their own schedule.") + field("Notes", textarea("notes", c.notes, "", 2)) + "</div>" +
      '<button type="button" class="btn primary big block" data-save>Save</button>' + (id ? '<button type="button" class="btn-text danger" data-delete>Delete this customer</button>' : "") + "</div>";
    onMain("click", function (e) {
      if (e.target.closest("[data-save]")) { readFields($main, c); if (!c.name.trim()) { toast("A name, at least."); return; } var idx = S.clients.findIndex(function (x) { return x.id === c.id; }); if (idx >= 0) S.clients[idx] = c; else S.clients.push(c); save(true); go("#/clients"); }
      if (e.target.closest("[data-delete]")) { ask("Delete " + c.name + "?", "Their invoices stay.", [{ label: "Delete", cls: "danger", value: true }, { label: "Keep", value: false }]).then(function (y) { if (!y) return; S.clients = S.clients.filter(function (x) { return x.id !== c.id; }); S.invoices.forEach(function (i) { if (i.clientId === c.id) i.clientId = ""; }); S.projects.forEach(function (p) { if (p.clientId === c.id) p.clientId = ""; }); save(true); go("#/clients"); }); }
    });
  }

  /* ---------- More ---------- */
  function viewMore() {
    tabs("more"); header("More");
    var build = (document.querySelector('meta[name="build"]') || {}).content || "dev";
    $main.innerHTML = '<div class="view stack">' +
      '<div class="list"><a class="item" href="#/company"><div><div class="t">Company profile</div><div class="s">' + esc(S.company.name) + ", " + esc(S.company.terms) + (S.company.taxRate !== "" ? ", " + esc(String(S.company.taxRate)) + "% tax" : "") + '</div></div><div class="r">›</div></a>' +
      '<button type="button" class="item" data-sig><div><div class="t">My signature</div><div class="s">' + (S.company.sig && S.company.sig.png ? "Saved. Used on advanced invoices with one tap." : "Draw it once, sign invoices with one tap.") + '</div></div><div class="r">›</div></button>' +
      '<a class="item" href="#/clients"><div><div class="t">Customers</div><div class="s">' + S.clients.length + " saved</div></div><div class=\"r\">›</div></a></div>" +
      '<div class="card"><h3>Look</h3><div class="chips" style="margin-top:0.5rem">' + [["auto", "Match the phone"], ["light", "Light"], ["dark", "Dark"]].map(function (l) { return '<button type="button" class="chip' + ((S.settings.look || "auto") === l[0] ? " on" : "") + '" data-setlook="' + l[0] + '">' + l[1] + "</button>"; }).join("") + "</div></div>" +
      '<div class="card"><h3>New invoices open in</h3><div class="chips" style="margin-top:0.5rem">' + [["ask", "Ask me"], ["edit", "On the page"], ["", "Choose each time"]].map(function (t) { return '<button type="button" class="chip' + ((S.settings.tool || "") === t[0] ? " on" : "") + '" data-settool="' + t[0] + '">' + t[1] + "</button>"; }).join("") + '</div><p class="small muted" style="margin:0.5rem 0 0">Ask me goes one question at a time. On the page puts the invoice in front of you to type on.</p></div>' +
      (iosSafariTab() ? '<div class="card" style="border-color:var(--amber)"><h3>Keep it safe</h3><p class="small" style="margin-top:0.4rem">In Safari, tap Share, then <b>Add to Home Screen</b>. As a home-screen app, Billhead opens full screen and works offline, and Safari stops counting the days toward clearing its stored data (it clears a site\'s data after seven days without a visit). Keep a backup file either way.</p></div>' : "") +
      '<div class="card"><h3>Backup</h3><p class="small muted" style="margin-top:0.4rem">' + (NATIVE ? "Everything lives on this phone. When Google backup is on, Android backs the app up to your Google account and carries it to a new phone. A backup file is a second copy you control: keep one somewhere safe." : "Everything lives on this device only. A backup file holds your company, customers, projects and invoices; keep one somewhere safe, and use it to move to a new phone.") + '</p><div class="row"><button type="button" class="btn" data-backup>Save a backup file</button><label class="btn file-btn">Restore from a backup<input type="file" accept=".json,application/json" data-restore></label>' + (S.invoices.length ? '<button type="button" class="btn" data-csv>Invoices as CSV</button>' : "") + "</div></div>" +
      '<div class="card"><h3>Pricing</h3>' + (M.PRICING.mode === "free" ? '<p class="small" style="margin-top:0.4rem"><b>Free during launch.</b> The prices after that:</p>' : "") + pricingTable() +
      '<p class="small muted">No subscription, no account, no ads. Billhead charges for the invoice, never a percentage of what your customer pays you: a $1,000 invoice costs ' + M.priceText(M.PRICING.simple) + " to make, and your customer pays you however you like. Apps that are free to send often take 2.9 percent plus 60 cents when the customer pays by card through them, which is $29.60 on $1,000.</p></div>" +
      '<div class="card"><h3>About</h3><p class="small" style="margin-top:0.4rem"><b>' + M.NAME + "</b> by Tompkins Software Systems. A billhead is what printers called a business's invoice form a century ago: the name at the top, the bill below. Nothing you type leaves this device; there is no server and no account. PDFs are drawn on the phone and locked against editing. Build " + esc(build) + '.</p><p class="small muted">Type: IBM Plex (SIL Open Font License). PDF: jsPDF (MIT). Signatures: signature_pad (MIT).</p>' +
      '<div class="row"><a class="btn small" href="https://' + M.SITE + '/support.html#billhead" target="_blank" rel="noopener">Support</a><a class="btn small" href="https://' + M.SITE + '/privacy.html#billhead" target="_blank" rel="noopener">Privacy</a>' + (S.invoices.length ? "" : '<button type="button" class="btn small" data-sample>Load a sample company</button>') + '<button type="button" class="btn-text danger" data-forget>Forget everything on this device</button></div></div></div>';
    onMain("click", function (e) {
      var b;
      if ((b = e.target.closest("[data-setlook]"))) { S.settings.look = b.getAttribute("data-setlook"); applyLook(); save(); viewMore(); return; }
      if ((b = e.target.closest("[data-settool]"))) { S.settings.tool = b.getAttribute("data-settool"); save(true); viewMore(); return; }
      if (e.target.closest("[data-sig]")) { var tmp = { sig: { name: S.company.sig.name, title: S.company.sig.title, png: "" }, updatedAt: "" }; signatureSheet(tmp, function () { viewMore(); toast("Signature saved."); }); return; }
      if (e.target.closest("[data-backup]")) { var text = JSON.stringify(S, null, 1); download(new Blob([text], { type: "application/json" }), "billhead-backup-" + M.today() + ".json"); toast("Backup saved."); return; }
      if (e.target.closest("[data-sample]")) { loadSample(); return; }
      if (e.target.closest("[data-csv]")) { exportCsv(); return; }
      if (e.target.closest("[data-forget]")) { ask("Forget everything?", "Your company, customers, projects and invoices on this device. Save a backup first if you may want them back.", [{ label: "Forget everything", cls: "danger", value: true }, { label: "Keep it", value: false }]).then(function (y) { if (!y) return; try { localStorage.removeItem(M.KEY); } catch (err) { } S = M.blankState(); location.hash = "#/welcome"; route(); }); }
    });
    $main.querySelector("[data-restore]").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { var data = JSON.parse(r.result); if (!data || !data.company || !Array.isArray(data.invoices)) throw new Error("not a backup"); ask("Restore this backup?", "It replaces what is on this device: " + data.invoices.length + " invoices, " + (data.projects || []).length + " projects, " + (data.clients || []).length + " customers, for " + esc(data.company.name) + ".", [{ label: "Restore", cls: "primary", value: true }, { label: "Cancel", value: false }]).then(function (y) { if (!y) return; S = M.normalize(data); save(true); applyLook(); go("#/"); toast("Restored."); }); }
        catch (err) { toast("That file is not a " + M.NAME + " backup."); }
      };
      r.readAsText(f); e.target.value = "";
    });
  }

  function pricingTable() {
    var P = M.PRICING, rows = [];
    if (P.freeUnder) rows.push(["Any invoice under " + M.priceText(P.freeUnder), "whatever kind, as many as you like", "Free"]);
    if (P.firstFree) rows.push(["Your first invoice", "", "Free"]);
    rows.push(["Simple invoice", "paid once, when you download it", M.priceText(P.simple)]); rows.push(["Advanced invoice", "paid once, when you download it", M.priceText(P.advanced)]);
    (P.packs || []).forEach(function (k) { rows.push([k.count + " " + k.tier + " invoices", M.priceText(Math.round(k.price / k.count * 100) / 100) + " each, never expire", M.priceText(k.price)]); });
    if (P.pass) rows.push(["A year of unlimited invoices", "paid once, no auto-renew", M.priceText(P.pass.price)]);
    var have = [];
    if (S.pass && S.pass.until && S.pass.until >= M.today()) have.push("Year pass until " + M.longDate(S.pass.until));
    if (S.credits && (M.num(S.credits.simple) || M.num(S.credits.advanced))) have.push(M.num(S.credits.simple) + " simple and " + M.num(S.credits.advanced) + " advanced left in packs");
    return '<table class="small" style="width:100%;border-collapse:collapse;margin:0.4rem 0 0.6rem">' + rows.map(function (r) { return '<tr><td style="padding:0.3rem 0;border-bottom:1px solid var(--line)">' + r[0] + (r[1] ? '<br><span class="muted">' + r[1] + "</span>" : "") + '</td><td class="mono right" style="padding:0.3rem 0 0.3rem 0.6rem;border-bottom:1px solid var(--line);white-space:nowrap;vertical-align:top;font-weight:600">' + r[2] + "</td></tr>"; }).join("") + "</table>" + (have.length ? '<p class="small"><b>' + have.join(". ") + ".</b></p>" : "");
  }
  function iosSafariTab() { var ua = navigator.userAgent || ""; return /iPhone|iPad|iPod/.test(ua) && !window.navigator.standalone && !window.matchMedia("(display-mode: standalone)").matches; }
  function exportCsv() {
    var rows = [["Invoice", "Date", "Due", "Status", "Customer", "Project", "PO", "Currency", "Subtotal", "Discount", "Tax", "Freight", "Total", "Retainage", "Deposit", "Payments", "Balance due", "Sent", "Paid"]];
    S.invoices.slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); }).forEach(function (i) {
      var t = M.totals(i), pr = i.projectId && projectById(i.projectId);
      rows.push([i.num, i.date, i.due, M.STATUS_LABEL[M.status(i)], i.cust.name, pr ? pr.name : "", i.po || "", i.currency, t.sub.toFixed(2), t.disc.toFixed(2), t.tax.toFixed(2), t.freight.toFixed(2), t.total.toFixed(2), t.retainAmt.toFixed(2), t.deposit.toFixed(2), t.paid.toFixed(2), t.due.toFixed(2), i.sentAt || "", i.paidAt || ""]);
    });
    var csv = rows.map(function (r) { return r.map(function (c) { c = String(c == null ? "" : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\r\n");
    download(new Blob([csv], { type: "text/csv" }), "billhead-invoices-" + M.today() + ".csv"); toast("CSV saved.");
  }

  /* ---------- Launch animation ----------
     Billhead's mark and name, then "by Upfront for Small Business" (index.html has the markup, app.css the motion).
     It runs when the head script turned it on (html.uf-on, once a session) and starts once the first screen is
     drawn; in the Android app that is when the splash lifts. The status bar icons go light over the navy meanwhile.
     A tap skips it; when it ends the markup is removed. */
  var introStarted = false;
  /* Two frames after the splash is told to lift: the shell holds the page's drawing until then, so the animation
     starts when the page is really on screen, not underneath the splash on a slow phone. */
  function introAfterSplash() { requestAnimationFrame(function () { requestAnimationFrame(intro); }); }
  function intro() {
    var el = document.getElementById("uf-intro");
    if (introStarted || !el) return;
    introStarted = true;
    if (!document.documentElement.classList.contains("uf-on")) { el.parentNode.removeChild(el); return; }
    var over = false;
    function end() {
      if (over) return;
      over = true;
      if (el.parentNode) el.parentNode.removeChild(el);
      document.documentElement.classList.remove("uf-on");
      if (NATIVE) NATIVE.setDark(isDark()).catch(function () { });
    }
    if (NATIVE) NATIVE.setDark(true).catch(function () { });
    el.addEventListener("animationend", function (e) { if (e.target === el && /^uf(Out|Skip|Gone)$/.test(e.animationName)) end(); });
    el.addEventListener("click", function () { el.classList.add("uf-skip"); setTimeout(end, 400); });
    /* The end comes from the fade's animationend. The motion starts with the first frame actually drawn, which on a
       slow phone can be seconds after this call, so the backstop timer is long (the faded markup is hidden anyway). */
    setTimeout(end, 10000);
    el.classList.add("uf-go");
  }

  /* ---------- Start ---------- */
  /* In the Android app the screen shrinks when the keyboard comes up, and a bar fixed to the bottom would ride on top
     of it. body.kb marks that, and the editor's sending bar hides until the keyboard goes away. */
  var baseW = window.innerWidth, baseH = window.innerHeight;
  window.addEventListener("resize", function () {
    if (window.innerWidth !== baseW) { baseW = window.innerWidth; baseH = window.innerHeight; }
    if (window.innerHeight > baseH) baseH = window.innerHeight;
    document.body.classList.toggle("kb", window.innerHeight < baseH - 150);
  });
  applyLook();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { });
  var goParam = /[?&]go=([a-z-]+)/.exec(location.search);
  if (goParam && S.company && !ART) { history.replaceState(null, "", location.pathname + "#/new/" + goParam[1].replace("new-", "")); }
  route();
  if (!NATIVE) intro();
  if (NATIVE) {
    /* A fresh install restored from a phone backup has the file but not the browser storage: take the file. Otherwise the newer of the two wins. */
    NATIVE.loadState().then(function (text) {
      if (!text) return;
      var data; try { data = JSON.parse(text); } catch (e) { return; }
      if (!data || !data.company) return;
      var mine = S.savedAt || "", theirs = data.savedAt || "";
      if (!S.company || theirs > mine) { S = M.normalize(data); M.save(S); applyLook(); if (/welcome/.test(currentHash())) go("#/"); else route(); }
    }).catch(function () { }).then(function () { NATIVE.ready(); introAfterSplash(); });
    /* The shell lifts the splash by itself after 4 seconds if the state file never answers; start the animation then too. */
    setTimeout(introAfterSplash, 4000);
    NATIVE.onBack(function () {
      if ($layer.querySelector(".sheet-wrap")) { closeSheet(); return; }
      var h = currentHash().replace(/^#\/?/, "");
      if (!h || h === "home" || h === "welcome") { NATIVE.minimize(); return; }
      if (history.length > 1) history.back(); else go("#/");
    });
  }
  if (!ART && !NATIVE && "serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      reg.addEventListener("updatefound", function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener("statechange", function () {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            var t = document.createElement("div"); t.className = "toast"; t.innerHTML = 'A new version is ready. <button type="button" class="btn-text" style="color:inherit">Reload</button>'; t.querySelector("button").onclick = function () { location.reload(); }; $layer.appendChild(t);
          }
        });
      });
    }).catch(function () { });
  }
})();
