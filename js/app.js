/* Billhead app: the screens. State lives in one JSON document in this browser's storage (js/model.js).
   Two ways to make an invoice: "Ask me" (one question at a time) and "On the page" (the invoice is the form).
   Both write the same invoice record, and the PDF is drawn from that record (js/pdf.js). */
(function () {
  "use strict";
  var M = window.BH, S = M.load();
  var $main = document.getElementById("main"), $hdr = document.getElementById("hdr"), $tabs = document.getElementById("tabs"), $layer = document.getElementById("layer");
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var money = function (n, cur) { return M.money(n, cur || (S.company && S.company.currency) || "USD"); };
  var sym = function (cur) { return (M.CURRENCIES[cur || (S.company && S.company.currency) || "USD"] || M.CURRENCIES.USD).symbol; };
  /* One listener per event type on the main element; each view sets its own handlers and the old ones go away. */
  var mainHandlers = {};
  function onMain(type, fn) { mainHandlers[type] = fn; }
  ["click", "input", "change", "keydown"].forEach(function (type) { $main.addEventListener(type, function (e) { if (mainHandlers[type]) mainHandlers[type](e); }); });
  var canShareFiles = (function () { try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] })); } catch (e) { return false; } })();
  /* On a phone the share sheet is the way out (Save to Files, Mail, Messages, AirDrop); on a computer, a download. */
  function pdfButtons(primary) {
    if (canShareFiles) return '<button type="button" class="btn ' + (primary || "primary") + '" data-share>' + I.share + ' Share PDF</button><button type="button" class="btn" data-pdf>' + I.down + " Download</button>";
    return '<button type="button" class="btn ' + (primary || "primary") + '" data-pdf>' + I.down + " Download PDF</button>";
  }
  var saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    var run = function () { if (!M.save(S)) toast("Could not save on this device. Storage may be full or blocked."); };
    if (now) run(); else saveTimer = setTimeout(run, 300);
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function invoiceById(id) { return S.invoices.filter(function (i) { return i.id === id; })[0]; }
  function projectById(id) { return S.projects.filter(function (p) { return p.id === id; })[0]; }
  function clientById(id) { return S.clients.filter(function (c) { return c.id === id; })[0]; }
  function clientName(id) { var c = clientById(id); return c ? c.name : ""; }
  function applyLook() { document.documentElement.setAttribute("data-look", S.settings.look || "auto"); document.documentElement.classList.toggle("dark-auto", (S.settings.look || "auto") === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches); }
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
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M12 8l4 4"/></svg>',
    sheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
  };
  var MARK = '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#1C3F7A"/><path d="M19 14h21l7 7v29H19z" fill="#fff"/><path d="M40 14v7h7" fill="#D9DFE7"/><rect x="19" y="14" width="21" height="9" fill="#1C3F7A" opacity="0.001"/><rect x="24" y="27" width="16" height="3.5" rx="1.5" fill="#1C3F7A"/><rect x="24" y="34" width="14" height="2.4" rx="1.2" fill="#C5CDD8"/><rect x="24" y="39" width="12" height="2.4" rx="1.2" fill="#C5CDD8"/><rect x="24" y="44" width="16" height="2.4" rx="1.2" fill="#C5CDD8"/></svg>';

  /* ---------- Frame: header, tabs, toasts, sheets ---------- */
  function header(title, opts) {
    opts = opts || {};
    $hdr.innerHTML = (opts.back ? '<button class="back" type="button" data-go="' + esc(opts.back) + '" aria-label="Back">' + I.back + (opts.backLabel ? "<span>" + esc(opts.backLabel) + "</span>" : "") + "</button>" : '<a class="brand" href="#/">' + MARK + "</a>") +
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
    var g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); go(g.getAttribute("data-go")); }
  });

  /* ---------- Shared pieces ---------- */
  function field(label, inner, help) { return '<div class="field"><label>' + esc(label) + "</label>" + inner + (help ? '<div class="help">' + help + "</div>" : "") + "</div>"; }
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
  function route() {
    closeSheet(); mainHandlers = {};
    var h = location.hash.replace(/^#\/?/, ""), parts = h.split("/");
    if (!S.company) { if (parts[0] !== "welcome") { location.replace("#/welcome"); return; } return viewWelcome(); }
    switch (parts[0]) {
      case "": case "home": return viewHome();
      case "welcome": return viewWelcome();
      case "new": return viewNew(parts[1] || "", parts[2] || "");
      case "ask": return viewWizard(parts[1]);
      case "edit": return viewEditor(parts[1]);
      case "inv": return viewInvoice(parts[1]);
      case "invoices": return viewInvoices(parts[1] || "all");
      case "projects": return viewProjects();
      case "project": return parts[2] === "edit" || parts[1] === "new" ? viewProjectEdit(parts[1] === "new" ? null : parts[1]) : viewProject(parts[1]);
      case "clients": return viewClients();
      case "client": return viewClientEdit(parts[1] === "new" ? null : parts[1]);
      case "more": return viewMore();
      case "company": return viewCompany();
      default: return viewHome();
    }
  }
  window.addEventListener("hashchange", route);

  /* ---------- Welcome: the company profile ---------- */
  function companyForm(c, isNew) {
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
      '<button type="button" class="btn primary big block" data-company-save>' + (isNew ? "Save and start invoicing" : "Save changes") + "</button>" +
      (isNew ? '<p class="small muted" style="text-align:center">Everything stays on this device. No account, no server. <button type="button" class="btn-text" data-sample>Just looking? Load a sample company.</button></p>' : "") +
      "</div>";
  }
  function bindCompanyForm(scope, c, after) {
    onMain("change", function (e) {
      if (e.target.matches("[data-logo]")) {
        var f = e.target.files && e.target.files[0]; if (!f) return;
        readLogo(f, function (dataUrl) { c.logo = dataUrl; readFields(scope, c); var host = scope.querySelector("[data-company]") || scope; host.outerHTML = companyForm(c, !S.company); bindCompanyForm($main, c, after); });
      }
    });
    onMain("click", function (e) {
      if (e.target.closest("[data-logo-clear]")) { readFields(scope, c); c.logo = ""; var host = scope.querySelector("[data-company]") || scope; host.outerHTML = companyForm(c, !S.company); bindCompanyForm($main, c, after); return; }
      if (e.target.closest("[data-company-save]")) {
        readFields(scope, c);
        if (!c.name.trim()) { toast("The company name is the one thing an invoice cannot do without."); scope.querySelector('[data-k="name"]').focus(); return; }
        c.next = Math.max(1, Math.round(M.num(c.next)) || 1); if (!c.payTo) c.payTo = c.name;
        after(c);
      }
      if (e.target.closest("[data-sample]")) { loadSample(); }
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
  function viewWelcome() {
    tabs(null); header(M.NAME);
    var c = S.company ? M.clone(S.company) : M.blankCompany();
    $main.innerHTML = '<div class="view"><div class="card navy" style="margin-bottom:1rem"><div class="row" style="gap:0.8rem;align-items:center">' + MARK.replace('class="mark"', 'class="mark" style="width:44px;height:44px;border-radius:10px"') + '<div><h1 style="color:inherit">' + M.NAME + '</h1><div class="muted">' + esc(M.TAGLINE) + '</div></div></div><p style="margin:0.9rem 0 0">Set up your company once. After that, every new invoice starts filled in: your name and logo, your terms, your tax rate, how to pay you. Invoices and projects stay on this phone and go out as locked PDFs.</p></div>' +
      "<h2 style=\"margin:0 0 0.6rem\">Your company</h2>" + companyForm(c, !S.company) + "</div>";
    bindCompanyForm($main, c, function (done) { done.createdAt = done.createdAt || M.today(); S.company = done; S.settings.onboarded = true; save(true); go("#/"); toast("Saved. Your first invoice takes about two minutes."); });
  }
  function viewCompany() {
    tabs("more"); header("Company profile", { back: "#/more" });
    var c = M.clone(S.company);
    $main.innerHTML = '<div class="view">' + companyForm(c, false) + "</div>";
    bindCompanyForm($main, c, function (done) { S.company = done; save(true); toast("Company profile saved."); go("#/more"); });
  }
  function loadSample() {
    S.company = M.sampleCompany(); S.settings.onboarded = true;
    var cl = M.blankClient(); cl.name = "Lakeside Dental"; cl.attn = "Accounts payable"; cl.addr = "42 Lakeview Dr\nPrairie City, IL 60000"; cl.email = "ap@lakesidedental.example"; S.clients.push(cl);
    var pr = M.blankProject(); pr.name = "Second-floor exam rooms"; pr.clientId = cl.id; pr.kind = "progress"; pr.contract = 9600; pr.planned = 3; pr.po = "PO 4471"; S.projects.push(pr);
    var a = M.sampleInvoice(S.company, "advanced"); a.num = "INV-1042"; a.date = M.addDays(M.today(), -20); a.due = M.dueFor(a.date, a.terms); a.status = "sent"; a.sentAt = a.date; a.clientId = cl.id; a.projectId = pr.id; a.deposit = 1500; a.lines = [{ d: "Mobilization and demolition", q: 1, u: "", r: 3200, t: false }]; a.prog = { on: true, contract: 9600, n: 1, m: 3, prev: 0 }; a.freight = ""; a.payments = [{ id: M.uid(), date: M.addDays(M.today(), -5), amount: 1700, method: "Check", note: "Check 2231" }];
    var b = M.sampleInvoice(S.company, "simple"); b.num = "INV-1043"; b.clientId = cl.id; b.lines = [{ d: "Service call, replace failed GFCI outlets (3)", q: 1, u: "", r: 285, t: true }]; b.desc = "";
    S.invoices.push(a, b); S.company.next = 1044; save(true); go("#/"); toast("Sample company loaded. Replace it from More when you are ready.");
  }

  /* ---------- Home ---------- */
  function viewHome() {
    tabs("home"); header(S.company.name);
    var today = M.today(), open = S.invoices.filter(function (i) { var s = M.status(i); return s === "sent" || s === "partial" || s === "overdue"; });
    var outstanding = open.reduce(function (s, i) { return s + M.totals(i).due; }, 0), overdue = open.filter(function (i) { return M.status(i) === "overdue"; });
    var paidMonth = S.invoices.reduce(function (s, i) { return s + (i.payments || []).filter(function (p) { return (p.date || "").slice(0, 7) === today.slice(0, 7); }).reduce(function (a, p) { return a + M.num(p.amount); }, 0); }, 0);
    var attention = open.filter(function (i) { return M.status(i) === "overdue" || M.daysBetween(today, i.due) <= 7; }).sort(function (a, b) { return (a.due || "").localeCompare(b.due || ""); });
    var recent = S.invoices.slice().sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || "") || (b.createdAt || "").localeCompare(a.createdAt || ""); }).slice(0, 5);
    var openProjects = S.projects.filter(function (p) { return p.status !== "closed"; }).slice(0, 3);
    $main.innerHTML = '<div class="view stack">' +
      '<div class="card ledger"><div class="row between" style="margin-bottom:0.6rem"><h2>New invoice</h2><span class="small muted">' + (M.PRICING.mode === "free" ? "Free while in testing" : "") + "</span></div>" +
      '<div class="choice"><button type="button" class="opt" data-new="simple"><div class="h"><span>Simple</span><span class="price">' + (M.PRICING.mode === "free" ? "<s>" + M.priceText(M.PRICING.simple) + "</s>Free" : M.priceText(M.PRICING.simple)) + '</span></div><div class="small muted">Who, what, how much, when it is due, how to pay. One page.</div></button>' +
      '<button type="button" class="opt adv" data-new="advanced"><div class="h"><span>Advanced</span><span class="price">' + (M.PRICING.mode === "free" ? "<s>" + M.priceText(M.PRICING.advanced) + "</s>Free" : M.priceText(M.PRICING.advanced)) + '</span></div><div class="small muted">Everything in simple, plus PO and job site, progress billing on a project, deposits, discounts, freight, retainage, late fees, your signature.</div></button></div></div>' +
      (S.invoices.length ? '<div class="stats"><div class="stat' + (outstanding ? "" : " green") + '"><div class="v">' + money(outstanding) + '</div><div class="l">Outstanding</div></div><div class="stat' + (overdue.length ? " red" : "") + '"><div class="v">' + overdue.length + '</div><div class="l">Overdue</div></div><div class="stat green"><div class="v">' + money(paidMonth) + '</div><div class="l">Paid this month</div></div></div>' : "") +
      (attention.length ? '<div><div class="section-head"><h2>Needs attention</h2></div><div class="list">' + attention.slice(0, 4).map(invoiceItem).join("") + "</div></div>" : "") +
      (recent.length ? '<div><div class="section-head"><h2>Recent</h2><a href="#/invoices" class="small">All invoices</a></div><div class="list">' + recent.map(invoiceItem).join("") + "</div></div>" : emptyState("No invoices yet. Pick Simple or Advanced above; the first one takes about two minutes.")) +
      (openProjects.length ? '<div><div class="section-head"><h2>Projects</h2><a href="#/projects" class="small">All projects</a></div><div class="list">' + openProjects.map(projectItem).join("") + "</div></div>" : "") +
      "</div>";
    onMain("click", function (e) { var b = e.target.closest("[data-new]"); if (b) go("#/new/" + b.getAttribute("data-new")); });
  }

  /* ---------- New invoice: tier, then tool ---------- */
  function viewNew(tier, projectId) {
    tabs("home"); header("New invoice", { back: projectId ? "#/project/" + projectId : "#/" });
    if (tier !== "simple" && tier !== "advanced") {
      $main.innerHTML = '<div class="view stack"><h1>Which kind?</h1><div class="choice">' +
        '<button type="button" class="opt" data-tier="simple"><div class="h"><span>Simple</span><span class="price">' + M.priceText(M.PRICING.simple) + '</span></div><ul><li>Your name or logo, the customer, a number and dates</li><li>Line items, one sales tax, notes</li><li>How to pay you, with a pay link if you have one</li></ul></button>' +
        '<button type="button" class="opt adv" data-tier="advanced"><div class="h"><span>Advanced</span><span class="price">' + M.priceText(M.PRICING.advanced) + '</span></div><ul><li>Everything in simple</li><li>Purchase order, reference, job site, service period</li><li>Progress billing on a project: invoice 2 of 3, billed to date, remaining</li><li>Discount, freight, deposit, retainage, late fee terms</li><li>Your signature and a customer acceptance line</li></ul></button></div>' +
        '<p class="small muted">' + (M.PRICING.mode === "free" ? "Both are free while the app is in testing. " : "") + "You pay once per invoice when you download it, never a subscription. A simple invoice can switch to advanced any time.</p></div>";
      onMain("click", function (e) { var b = e.target.closest("[data-tier]"); if (b) go("#/new/" + b.getAttribute("data-tier") + (projectId ? "/" + projectId : "")); });
      return;
    }
    $main.innerHTML = '<div class="view stack"><h1>' + (tier === "advanced" ? "Advanced" : "Simple") + ' invoice</h1><p class="muted">Two ways to make it. Both end on the same invoice, and you can switch between them any time.</p><div class="choice">' +
      '<button type="button" class="opt" data-tool="ask"><div class="h"><span>Ask me</span></div><div class="small muted">One question at a time: who it is for, what you did, when it is due. Good on a phone, good when you are new to invoicing.</div></button>' +
      '<button type="button" class="opt" data-tool="edit"><div class="h"><span>On the page</span></div><div class="small muted">The invoice is the form. Tap any part of it and type, add the parts you need. Good when you know what you want.</div></button></div></div>';
    onMain("click", function (e) {
      var b = e.target.closest("[data-tool]"); if (!b) return;
      var inv = newInvoice(tier, projectId);
      go((b.getAttribute("data-tool") === "ask" ? "#/ask/" : "#/edit/") + inv.id);
    });
  }
  function newInvoice(tier, projectId) {
    var inv = M.blankInvoice(S.company, tier);
    S.company.next = (M.num(S.company.next) || 1) + 1;
    if (projectId) { var p = projectById(projectId); if (p) { M.applyProject(inv, p, S.invoices); var cl = clientById(p.clientId); if (cl) setClient(inv, cl); } }
    S.invoices.push(inv); save(true); return inv;
  }
  function setClient(inv, cl) { inv.clientId = cl.id; inv.cust = { name: cl.name, attn: cl.attn || "", addr: cl.addr || "", email: cl.email || "", phone: cl.phone || "" }; if (cl.terms) { inv.terms = cl.terms; if (inv.dueAuto) inv.due = M.dueFor(inv.date, inv.terms); } }
  function touch(inv) { inv.updatedAt = M.today(); }

  /* ---------- The wizard: one question at a time ---------- */
  function viewWizard(id) {
    var inv = invoiceById(id); if (!inv) return go("#/");
    var adv = inv.tier === "advanced", cur = inv.currency;
    tabs(null);
    var steps = [
      { id: "customer", q: "Who is this invoice for?", why: "Their name is all it needs. The address and email help their bookkeeper.", html: function () {
        var chips = S.clients.length ? '<div class="field"><div class="lbl">Saved customers</div><div class="chips">' + S.clients.map(function (c) { return '<button type="button" class="chip' + (inv.clientId === c.id ? " on" : "") + '" data-client="' + c.id + '">' + esc(c.name) + "</button>"; }).join("") + "</div></div>" : "";
        return chips + field("Customer or company", input("cust.name", inv.cust.name, 'type="text" autocomplete="organization" placeholder="Lakeside Dental"')) +
          (adv ? field("Attention", input("cust.attn", inv.cust.attn, 'type="text" placeholder="Accounts payable, or a person"')) : "") +
          field("Billing address", textarea("cust.addr", inv.cust.addr, "Street\nCity, State ZIP", 2)) +
          '<div class="inline-fields">' + field("Email", input("cust.email", inv.cust.email, 'type="email"')) + (adv ? field("Phone", input("cust.phone", inv.cust.phone, 'type="tel"')) : "") + "</div>";
      }, valid: function () { return !!inv.cust.name.trim() || "Who is it for? A name is enough."; } },
      { id: "project", q: "Is this part of a project?", why: adv ? "Projects keep several invoices together: what was billed before, what is left, which invoice this is. Skip it for one-off work." : "Projects keep the invoices for one job together so you can see what has been billed and paid. Progress billing figures print on advanced invoices.", html: function () {
        var list = S.projects.filter(function (p) { return p.status !== "closed" && (!p.clientId || !inv.clientId || p.clientId === inv.clientId); });
        return '<div class="chips"><button type="button" class="chip' + (!inv.projectId && !inv._newProject ? " on" : "") + '" data-proj="">No project</button>' + list.map(function (p) { return '<button type="button" class="chip' + (inv.projectId === p.id ? " on" : "") + '" data-proj="' + p.id + '">' + esc(p.name) + "</button>"; }).join("") + '<button type="button" class="chip add' + (inv._newProject ? " on" : "") + '" data-proj="new">+ New project</button></div>' +
          (inv._newProject ? '<div class="card flat stack" data-newproj>' + field("Project name", input("name", inv._newProject.name, 'type="text" placeholder="Second-floor exam rooms"')) +
            '<div class="field"><div class="lbl">How it is billed</div><div class="chips"><button type="button" class="chip' + (inv._newProject.kind === "once" ? " on" : "") + '" data-kind="once">One invoice</button><button type="button" class="chip' + (inv._newProject.kind === "progress" ? " on" : "") + '" data-kind="progress">Several invoices</button></div></div>' +
            (inv._newProject.kind === "progress" ? '<div class="inline-fields">' + field("Contract amount", moneyInput("contract", inv._newProject.contract, "0.00", cur)) + field("Planned invoices", input("planned", inv._newProject.planned, 'type="text" inputmode="numeric" data-num')) + "</div>" + (adv ? '<div class="inline-fields">' + field("Customer PO", input("po", inv._newProject.po, 'type="text"')) + field("Retainage %", input("retain", inv._newProject.retain, 'type="text" inputmode="decimal" data-num placeholder="0"'), "Held back from each invoice until the job is done.") + "</div>" : "") : (adv ? field("Customer PO", input("po", inv._newProject.po, 'type="text"')) : "")) + "</div>" : "") +
          (inv.projectId && projectById(inv.projectId) ? '<div class="picked">' + projectSummaryLine(projectById(inv.projectId)) + "</div>" : "");
      }, valid: function () { if (inv._newProject && !inv._newProject.name.trim()) return "Give the project a name, or pick No project."; return true; } },
      { id: "work", q: "What are you billing for?", why: "One line per thing. A quantity times a rate makes the amount; for a flat price leave the quantity at 1.", html: function () { var past = pastItems(); return (adv ? field("In a sentence (optional)", textarea("desc", inv.desc, "What the work was and the dates it covered", 2)) : "") + '<datalist id="bh-items">' + past.map(function (it) { return '<option value="' + esc(it.d) + '">'; }).join("") + '</datalist><div class="lines-ed" data-lines>' + inv.lines.map(lineForm).join("") + '</div><div class="row"><button type="button" class="btn" style="flex:1" data-addline>' + I.plus + " Add another line</button>" + (past.length ? '<button type="button" class="btn" data-pastitems>Past items</button>' : "") + "</div>"; },
        valid: function () { return inv.lines.some(function (l) { return l.d.trim() || M.num(l.r); }) || "At least one line, with what it was and what it costs."; } },
      { id: "tax", q: "Sales tax?", why: "Tax prints on its own line. Leave it blank if you do not collect it" + (adv ? "; the tax pills on each line say which lines it applies to." : "."), html: function () {
        return '<div class="inline-fields">' + field("Rate (percent)", input("tax", inv.tax, 'type="text" inputmode="decimal" placeholder="0" data-num')) + field("Label", input("taxLabel", inv.taxLabel, 'type="text" placeholder="Sales tax"')) + "</div><div class=\"chips\"><button type=\"button\" class=\"chip\" data-notax>No tax</button>" + (S.company.taxRate !== "" ? '<button type="button" class="chip" data-usualtax>' + esc(String(S.company.taxRate)) + "% (your usual)</button>" : "") + "</div>";
      } },
      { id: "dates", q: "When is it due?", why: "A calendar date gets paid sooner than a term alone, so both print.", html: function () {
        return '<div class="inline-fields">' + field("Invoice date", input("date", inv.date, 'type="date"')) + field("Invoice number", input("num", inv.num, 'type="text" class="mono"')) + "</div>" +
          '<div class="field"><div class="lbl">Terms</div><div class="chips">' + M.TERMS.map(function (t) { return '<button type="button" class="chip' + (inv.terms === t ? " on" : "") + '" data-terms="' + t + '">' + t + "</button>"; }).join("") + "</div></div>" +
          field("Due date", input("due", inv.due, 'type="date"'), "Set from the terms; change it if you agreed something else.");
      }, valid: function () { return (!!inv.date && !!inv.due) || "The invoice needs a date and a due date."; } },
      { id: "extras", q: "Anything else on this one?", why: "Turn on what applies. Each prints in its place on the invoice.", adv: true, html: function () {
        var show = inv.show || {};
        var sw = function (k, label, help, on) { return '<label class="switch"><span class="sw-l"><span>' + label + "</span>" + (help ? '<span class="help">' + help + "</span>" : "") + '</span><input type="checkbox" data-ex="' + k + '"' + (on ? " checked" : "") + '><span class="sw"></span></label>'; };
        return '<div class="card flat" style="padding:0.2rem 1rem">' +
          sw("po", "Purchase order number", "How their system matches your invoice to approved money", show.po || inv.po) + (show.po || inv.po ? field("PO number", input("po", inv.po, 'type="text"')) : "") +
          sw("ref", "Reference", "Your quote or job number", show.ref || inv.ref) + (show.ref || inv.ref ? field("Reference", input("ref", inv.ref, 'type="text" placeholder="Quote 1042"')) : "") +
          sw("ship", "Ship to or job site", "", show.ship || inv.ship) + (show.ship || inv.ship ? field("Address", textarea("ship", inv.ship, "Job site or shipping address", 2)) : "") +
          sw("period", "Service period", "The dates the work covered", show.period || inv.from || inv.to) + (show.period || inv.from || inv.to ? '<div class="inline-fields">' + field("From", input("from", inv.from, 'type="date"')) + field("To", input("to", inv.to, 'type="date"')) + "</div>" : "") +
          sw("disc", "Discount", "", show.disc || inv.disc !== "") + (show.disc || inv.disc !== "" ? '<div class="inline-fields">' + field("Discount", inv.discPct ? input("disc", inv.disc, 'type="text" inputmode="decimal" data-num placeholder="0"') : moneyInput("disc", inv.disc, "0.00", cur)) + '<div class="field"><div class="lbl">Kind</div><div class="chips"><button type="button" class="chip' + (!inv.discPct ? " on" : "") + '" data-discpct="0">Amount</button><button type="button" class="chip' + (inv.discPct ? " on" : "") + '" data-discpct="1">Percent</button></div></div></div>' : "") +
          sw("freight", "Freight or shipping", "Not taxed", show.freight || inv.freight !== "") + (show.freight || inv.freight !== "" ? field("Freight", moneyInput("freight", inv.freight, "0.00", cur)) : "") +
          sw("deposit", "Deposit already received", "Comes off the balance due", show.deposit || inv.deposit !== "") + (show.deposit || inv.deposit !== "" ? field("Deposit", moneyInput("deposit", inv.deposit, "0.00", cur)) : "") +
          sw("retain", "Retainage", "A percent held back until the job is done", show.retain || inv.retain !== "") + (show.retain || inv.retain !== "" ? field("Retainage (percent)", input("retain", inv.retain, 'type="text" inputmode="decimal" data-num placeholder="10"')) : "") +
          sw("accept", "Customer acceptance line", "A blank line for them to sign", inv.accept) +
          sw("taxid", "Print your tax ID", S.company.taxid ? "Tax ID " + esc(S.company.taxid) : "Add it under Company profile first", inv.showTaxid) +
          "</div>";
      } },
      { id: "pay", q: "How should they pay you?", why: "Prefilled from your company profile. Change it here for this invoice only.", html: function () {
        return field("Make checks payable to", input("pay.to", inv.pay.to, 'type="text"')) + field("Payment instructions", textarea("pay.instr", inv.pay.instr, "Mail a check to the address above, ACH details, cards accepted", 3)) + field("Payment link", input("pay.link", inv.pay.link, 'type="url" placeholder="https://"')) +
          (adv ? field("Late fee or early-pay terms", input("pay.late", inv.pay.late, 'type="text" placeholder="1.5% per month after the due date"')) : "") + field("Note to the customer", textarea("pay.notes", inv.pay.notes, "Thank you, warranty, what happens next", 2));
      } },
      { id: "sign", q: "Sign it?", why: "Optional. A drawn signature prints above a line with your name and the date. The PDF is locked, so nobody can lift it off the page.", adv: true, html: function () {
        return '<div class="chips"><button type="button" class="chip' + (!inv.sig.on ? " on" : "") + '" data-sigon="0">No signature</button><button type="button" class="chip' + (inv.sig.on ? " on" : "") + '" data-sigon="1">Sign this invoice</button></div>' +
          (inv.sig.on ? (inv.sig.png ? '<div class="card flat sig-saved"><img src="' + inv.sig.png + '" alt="Your signature"><div class="small muted">' + esc([inv.sig.name, inv.sig.title].filter(Boolean).join(", ")) + "</div><div class=\"row\" style=\"margin-top:0.5rem\"><button type=\"button\" class=\"btn small\" data-sign>Sign again</button></div></div>" : '<button type="button" class="btn block" data-sign>' + I.pen + " Draw your signature</button>") : "");
      }, valid: function () { return !inv.sig.on || !!inv.sig.png || "Draw a signature, or pick No signature."; } }
    ].filter(function (s) { return !s.adv || adv; });
    var at = Math.max(0, Math.min(steps.length - 1, Number(inv._step) || 0));
    function lineForm(l, i) {
      return '<div class="line" data-line="' + i + '">' + '<div class="field"><input type="text" data-l="d" list="bh-items" value="' + esc(l.d) + '" placeholder="What was done or delivered" aria-label="Description"></div>' +
        '<div class="nums' + (adv ? " adv" : "") + '"><div class="field"><label>Qty</label><input type="text" inputmode="decimal" data-l="q" value="' + esc(l.q) + '"></div>' + (adv ? '<div class="field"><label>Unit</label><input type="text" data-l="u" value="' + esc(l.u) + '" placeholder="hr, ea"></div>' : "") + '<div class="field"><label>Rate</label><span class="money-in" data-sym="' + esc(sym(cur)) + '"><input type="text" inputmode="decimal" data-l="r" value="' + esc(l.r) + '" placeholder="0.00"></span></div>' + (adv ? "" : '<div class="field"><label>Amount</label><div class="input lamt" style="display:flex;align-items:center;justify-content:flex-end">' + money(M.lineAmount(l), cur) + "</div></div>") + "</div>" +
        '<div class="foot">' + (adv ? '<button type="button" class="chip' + (l.t !== false ? " on" : "") + '" data-ltax aria-pressed="' + (l.t !== false) + '">Taxable</button><span class="lamt">' + money(M.lineAmount(l), cur) + "</span>" : "<span></span>") + '<button type="button" class="btn-text quiet" data-rmline>Remove</button></div></div>';
    }
    function render() {
      var st = steps[at];
      header((adv ? "Advanced" : "Simple") + " invoice", { back: "#/inv/" + inv.id, backLabel: "" });
      $main.innerHTML = '<div class="wiz"><div class="prog">' + steps.map(function (s, i) { return "<i class=\"" + (i < at ? "done" : i === at ? "now" : "") + '"></i>'; }).join("") + '</div><div class="small muted">' + (at + 1) + " of " + steps.length + '</div><div class="q">' + st.q + '</div><div class="why">' + st.why + '</div><div class="step" data-step="' + st.id + '">' + st.html() + "</div></div>" +
        '<div class="wiz-nav">' + (at > 0 ? '<button type="button" class="btn" data-prev>Back</button>' : '<button type="button" class="btn" data-go="#/edit/' + inv.id + '">On the page</button>') + '<button type="button" class="btn primary" data-next>' + (at === steps.length - 1 ? "See the invoice" : "Next") + "</button></div>";
      var first = $main.querySelector(".step input[type=text], .step textarea"); if (first && window.innerWidth > 700) first.focus();
    }
    function readStep() {
      var scope = $main.querySelector(".step"); if (!scope) return;
      var st = steps[at];
      if (st.id === "work") { scope.querySelectorAll("[data-line]").forEach(function (row, i) { var l = inv.lines[i]; if (!l) return; l.d = row.querySelector('[data-l="d"]').value; l.q = row.querySelector('[data-l="q"]').value === "" ? "" : M.num(row.querySelector('[data-l="q"]').value); var u = row.querySelector('[data-l="u"]'); if (u) l.u = u.value; var r = row.querySelector('[data-l="r"]').value; l.r = r === "" ? "" : M.num(r); }); var d = scope.querySelector('[data-k="desc"]'); if (d) inv.desc = d.value; return; }
      if (st.id === "project") { var np = scope.querySelector("[data-newproj]"); if (np && inv._newProject) readFields(np, inv._newProject); return; }
      if (st.id === "extras") { scope.querySelectorAll("[data-ex]").forEach(function (cb) { var k = cb.getAttribute("data-ex"); if (k === "accept") inv.accept = cb.checked; else if (k === "taxid") inv.showTaxid = cb.checked; else { inv.show[k] = cb.checked; if (!cb.checked) clearPart(inv, k); } }); }
      readFields(scope, inv);
      if (st.id === "dates") { inv.dueAuto = inv.due === M.dueFor(inv.date, inv.terms); }
      touch(inv);
    }
    function finishProject() {
      if (inv._newProject) { var p = M.merge(M.blankProject(), inv._newProject); p.clientId = inv.clientId || ensureClient(inv).id; if (p.kind !== "progress") { p.planned = 1; } S.projects.push(p); inv.projectId = p.id; delete inv._newProject; }
      var pr = inv.projectId && projectById(inv.projectId);
      if (pr) M.applyProject(inv, pr, S.invoices); else if (inv.prog) inv.prog.on = false;
    }
    onMain("click", function (e) {
      var t = e.target, b;
      if ((b = t.closest("[data-next]"))) { readStep(); var v = steps[at].valid ? steps[at].valid() : true; if (v !== true) { toast(v); return; } if (steps[at].id === "project") finishProject(); if (steps[at].id === "customer") { ensureClient(inv); } save(); if (at < steps.length - 1) { at++; inv._step = at; render(); window.scrollTo(0, 0); } else { delete inv._step; delete inv._newProject; save(true); go("#/edit/" + inv.id); toast("Here is the invoice. Tap anything on it to change it."); } return; }
      if ((b = t.closest("[data-prev]"))) { readStep(); save(); at--; inv._step = at; render(); window.scrollTo(0, 0); return; }
      if ((b = t.closest("[data-client]"))) { var cl = clientById(b.getAttribute("data-client")); if (cl) { setClient(inv, cl); render(); } return; }
      if ((b = t.closest("[data-proj]"))) { readStep(); var pid = b.getAttribute("data-proj"); if (pid === "new") { inv._newProject = inv._newProject || M.merge(M.blankProject(), { kind: adv ? "progress" : "once", planned: 3 }); inv.projectId = ""; } else { delete inv._newProject; inv.projectId = pid; var pr = projectById(pid); if (pr && pr.clientId && !inv.clientId) { var c2 = clientById(pr.clientId); if (c2) setClient(inv, c2); } } render(); return; }
      if ((b = t.closest("[data-kind]"))) { readStep(); inv._newProject.kind = b.getAttribute("data-kind"); render(); return; }
      if ((b = t.closest("[data-addline]"))) { readStep(); inv.lines.push(M.blankLine()); render(); var rows = $main.querySelectorAll("[data-line]"); var last = rows[rows.length - 1]; if (last) last.querySelector("input").focus(); return; }
      if ((b = t.closest("[data-pastitems]"))) { readStep(); itemsSheet(inv, function () { render(); }); return; }
      if ((b = t.closest("[data-rmline]"))) { readStep(); var i = Number(b.closest("[data-line]").getAttribute("data-line")); inv.lines.splice(i, 1); if (!inv.lines.length) inv.lines.push(M.blankLine()); render(); return; }
      if ((b = t.closest("[data-ltax]"))) { readStep(); var li = Number(b.closest("[data-line]").getAttribute("data-line")); inv.lines[li].t = inv.lines[li].t === false; render(); return; }
      if ((b = t.closest("[data-notax]"))) { inv.tax = ""; render(); return; }
      if ((b = t.closest("[data-usualtax]"))) { inv.tax = S.company.taxRate; render(); return; }
      if ((b = t.closest("[data-terms]"))) { readStep(); inv.terms = b.getAttribute("data-terms"); inv.due = M.dueFor(inv.date, inv.terms); inv.dueAuto = true; render(); return; }
      if ((b = t.closest("[data-discpct]"))) { readStep(); inv.discPct = b.getAttribute("data-discpct") === "1"; render(); return; }
      if ((b = t.closest("[data-sigon]"))) { readStep(); inv.sig.on = b.getAttribute("data-sigon") === "1"; if (inv.sig.on && !inv.sig.png && S.company.sig && S.company.sig.png) { inv.sig.png = S.company.sig.png; inv.sig.name = S.company.sig.name; inv.sig.title = S.company.sig.title; inv.sig.date = M.today(); } render(); return; }
      if ((b = t.closest("[data-sign]"))) { readStep(); signatureSheet(inv, function () { render(); }); return; }
    });
    onMain("change", function (e) {
      if (e.target.matches("[data-ex]")) { readStep(); render(); }
      if (e.target.matches('[data-k="date"]')) { readStep(); if (inv.dueAuto) { inv.due = M.dueFor(inv.date, inv.terms); render(); } }
      if (e.target.matches("[data-l]")) {
        readStep(); var row = e.target.closest("[data-line]"), i = Number(row.getAttribute("data-line"));
        if (e.target.getAttribute("data-l") === "d" && inv.lines[i].r === "") { var hit = pastItems().filter(function (it) { return it.d.toLowerCase() === inv.lines[i].d.trim().toLowerCase(); })[0]; if (hit && hit.r !== "") { inv.lines[i].r = hit.r; if (adv) inv.lines[i].u = hit.u; row.querySelector('[data-l="r"]').value = hit.r; } }
        row.querySelectorAll(".lamt").forEach(function (el) { el.textContent = money(M.lineAmount(inv.lines[i]), cur); });
      }
    });
    render();
  }
  function clearPart(inv, k) {
    if (k === "po") inv.po = ""; if (k === "ref") inv.ref = ""; if (k === "ship") inv.ship = ""; if (k === "period") { inv.from = ""; inv.to = ""; } if (k === "disc") inv.disc = ""; if (k === "freight") inv.freight = ""; if (k === "deposit") inv.deposit = ""; if (k === "retain") inv.retain = "";
    if (k === "late") inv.pay.late = ""; if (k === "notes") inv.pay.notes = ""; if (k === "link") inv.pay.link = ""; if (k === "fine") inv.fine = ""; if (k === "attn") inv.cust.attn = ""; if (k === "prog") { inv.prog.on = false; } if (k === "sig") { inv.sig.on = false; } if (k === "accept") inv.accept = false; if (k === "taxid") inv.showTaxid = false; if (k === "vat") inv.vat = ""; if (k === "units") inv.lines.forEach(function (l) { l.u = ""; }); if (k === "web") S.company.web = ""; if (k === "phone") inv.cust.phone = "";
  }
  function ensureClient(inv) {
    var name = (inv.cust.name || "").trim(); if (!name) return null;
    var cl = inv.clientId && clientById(inv.clientId);
    if (!cl) cl = S.clients.filter(function (c) { return c.name.trim().toLowerCase() === name.toLowerCase(); })[0];
    if (!cl) { cl = M.blankClient(); S.clients.push(cl); }
    cl.name = name; ["attn", "addr", "email", "phone"].forEach(function (k) { if (inv.cust[k]) cl[k] = inv.cust[k]; });
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
    $main.innerHTML = '<div class="view wide">' +
      '<div class="inv-bar"><span>' + (adv ? '<span class="pill adv">Advanced</span>' : '<span class="pill simple">Simple</span>') + " " + (M.PRICING.mode === "free" ? "Free while in testing (" + M.priceText(M.price(inv)) + " later)" : "<b>" + M.priceText(M.price(inv)) + "</b> to download") + '</span><span class="row" style="gap:0.3rem">' + (adv ? "" : '<button type="button" class="btn small" data-upgrade>Switch to advanced</button>') + '<button type="button" class="btn small" data-options>Options</button></span></div>' +
      '<div class="inv-bar" data-projbar><span>' + (pr ? "Project: <b>" + esc(pr.name) + "</b>" + (inv.prog && inv.prog.on ? " · invoice " + esc(inv.prog.n) + " of " + esc(inv.prog.m) : "") : "Not on a project") + '</span><button type="button" class="btn small" data-project>' + (pr ? "Change" : "Add to a project") + "</button></div>" +
      (inv.status !== "draft" && inv.status !== "void" ? '<div class="inv-bar warn"><span>This invoice went out ' + esc(M.shortDate(inv.sentAt || inv.date)) + '. Changing it changes what you sent. For a correction, duplicate it as a new number instead.</span></div>' : "") +
      '<div class="inv-tools">' + pdfButtons() + '<span class="spacer"></span><button type="button" class="btn ghost small" data-go="#/ask/' + inv.id + '">Ask me instead</button></div>' +
      '<p class="inv-note">Tap anything on the invoice to change it. The dashed links add the parts you need; the × takes them away. Nothing here prints.</p>' +
      '<input type="file" accept="image/*" data-logo hidden><div class="inv" data-inv aria-label="Your invoice, editable"></div></div>';
    var inv_el = $main.querySelector("[data-inv]"), logoIn = $main.querySelector("[data-logo]");
    function render() { inv_el.innerHTML = invoiceHtml(inv, c, { edit: true }); inv_el.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(c.accent) ? c.accent : "#1C3F7A"); inv_el.classList.toggle("locked", !inv.unlock); }
    function patch() {
      var t = M.totals(inv), setText = function (sel, v) { var e = inv_el.querySelector(sel); if (e) e.textContent = v; };
      inv.lines.forEach(function (l, i) { var a = inv_el.querySelector('[data-amt="' + i + '"]'); if (a) a.innerHTML = money(M.lineAmount(l), cur) + (adv && l.t !== false && M.num(inv.tax) && inv.lines.some(function (x) { return x.t === false; }) ? '<span class="t">T</span>' : ""); });
      setText("[data-sub]", money(t.sub, cur)); setText("[data-taxbase]", money(t.taxBase, cur)); setText("[data-taxamt]", money(t.tax, cur)); setText("[data-total]", money(t.total, cur)); setText("[data-due]", money(t.due, cur)); setText("[data-retainamt]", "-" + money(t.retainAmt, cur)); setText("[data-paid]", "-" + money(t.paid, cur));
      var tr = inv_el.querySelector("[data-taxrow]"); if (tr) tr.hidden = !(M.num(inv.tax) && t.taxBase !== t.sub);
      var pg = M.progress(inv); if (pg) { setText("[data-prog-this]", money(pg.thisInvoice, cur)); setText("[data-prog-billed]", money(pg.billed, cur)); setText("[data-prog-left]", money(pg.remaining, cur)); var bar = inv_el.querySelector("[data-prog-bar]"); if (bar) bar.style.width = pg.pct.toFixed(1) + "%"; }
    }
    function upgrade(k) {
      return ask("Switch to advanced?", (k ? "<b>" + esc(M.ADVANCED[k]) + "</b> is part of the advanced invoice. " : "") + "Advanced is " + M.priceText(M.PRICING.advanced) + " instead of " + M.priceText(M.PRICING.simple) + " when paid downloads start" + (M.PRICING.mode === "free" ? " (free now)" : "") + ". Everything you have typed stays.", [{ label: "Switch to advanced", cls: "primary", value: true }, { label: "Keep it simple", value: false }]).then(function (yes) { if (yes) { inv.tier = "advanced"; adv = true; touch(inv); save(); viewEditor(inv.id); } return yes; });
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
      if (e.target.closest("[data-upgrade]")) { upgrade(); return; }
      if (e.target.closest("[data-project]")) { projectSheet(inv, function () { viewEditor(inv.id); }); return; }
      if (e.target.closest("[data-options]")) { optionsSheet(inv, function () { viewEditor(inv.id); }); return; }
    });
    render();
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
    var addLink = function (key, label) { return edit ? '<button type="button" class="add' + (!adv && M.ADVANCED[key] ? " adv" : "") + '" data-show="' + key + '">+ ' + esc(label) + "</button>" : ""; };
    var removeLink = function (key, label) { return edit ? '<button type="button" class="rm" data-hide="' + key + '" aria-label="Remove ' + esc(label) + '">×</button>' : ""; };
    var st = M.status(inv), pg = M.progress(inv);
    var html = (st === "paid" || st === "void" ? '<div class="stamp ' + st + (o.slam ? " slam" : "") + '">' + st + "</div>" : "");
    html += '<header class="inv-top"><div class="inv-biz">' +
      (c.logo ? '<span class="logo-wrap"><img src="' + c.logo + '" alt="">' + (edit ? '<button type="button" class="rm logo-rm" data-logo-clear aria-label="Remove logo">×</button>' : "") + "</span>" : (edit ? '<button type="button" class="add logo-add" data-logo-pick>+ Add your logo</button>' : "")) +
      (c.logo ? '<span class="bc"><b>' + esc(c.name) + "</b></span>" : '<span class="bn">' + esc(c.name) + "</span>") + lines(c.addr).map(function (l) { return '<span class="bc">' + esc(l) + "</span>"; }).join("") + [c.phone, c.email, c.web].filter(Boolean).map(function (l) { return '<span class="bc">' + esc(l) + "</span>"; }).join("") +
      (adv && inv.showTaxid && c.taxid ? '<span class="bc">Tax ID ' + esc(c.taxid) + " " + removeLink("taxid", "tax ID") + "</span>" : "") + (adv && shown("vat", inv.vat) ? '<span class="bc">' + ed("vatLabel", "VAT no.", "inl") + " " + ed("vat", "Registration number", "inl") + " " + removeLink("vat", "registration number") + "</span>" : "") +
      (edit ? '<span class="adds">' + (adv && !inv.showTaxid ? addLink("taxid", "Tax ID") : "") + (adv && !shown("vat", inv.vat) ? addLink("vat", "VAT or GST number") : "") + "</span>" : "") + "</div>" +
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
    } else if (edit) prog = '<div class="adds col">' + addLink("prog", "Progress billing (invoice 2 of 3 on a project)") + "</div>";
    var showTotal = t.disc || M.num(inv.tax) || t.freight || t.retainAmt || t.deposit || t.paid;
    var tot = '<div class="inv-totals"><div><span>Subtotal</span><span data-sub>' + money(t.sub, cur) + "</span></div>" +
      (adv && shown("disc", inv.disc) ? "<div><span>Discount " + (edit ? '<button type="button" class="tax" data-discpct aria-pressed="' + (inv.discPct ? "true" : "false") + '" title="Percent or amount">' + (inv.discPct ? "%" : sym(cur)) + "</button>" : (inv.discPct ? "(" + M.num(inv.disc) + "%)" : "")) + removeLink("disc", "discount") + "</span>" + (inv.discPct ? edNum("disc", "0%", "", "pct") : edNum("disc", money(0, cur), "", "money")) + "</div>" : "") +
      (M.num(inv.tax) || edit ? '<div data-taxrow' + (M.num(inv.tax) && t.taxBase !== t.sub ? "" : ' hidden') + '><span>Taxable subtotal</span><span data-taxbase>' + money(t.taxBase, cur) + "</span></div><div><span>" + ed("taxLabel", "Sales tax", "inl") + " at " + edNum("tax", "0%", "inl", "pct") + '</span><span data-taxamt>' + money(t.tax, cur) + "</span></div>" : "") +
      (adv && shown("freight", inv.freight) ? "<div><span>Freight " + removeLink("freight", "freight") + "</span>" + edNum("freight", money(0, cur), "", "money") + "</div>" : "") +
      (showTotal || edit ? '<div class="total"><span>Total</span><span data-total>' + money(t.total, cur) + "</span></div>" : "") +
      (adv && shown("retain", inv.retain) ? "<div><span>Less retainage " + edNum("retain", "0%", "inl", "pct") + " " + removeLink("retain", "retainage") + '</span><span data-retainamt>-' + money(t.retainAmt, cur) + "</span></div>" : "") +
      (adv && shown("deposit", inv.deposit) ? "<div><span>Deposit received " + removeLink("deposit", "deposit") + "</span>" + edNum("deposit", money(0, cur), "", "money") + "</div>" : "") +
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
    } else if (edit && !adv) {
      html += '<section class="inv-sig"><div class="adds col">' + addLink("sig", "Sign this invoice") + addLink("accept", "Customer acceptance line") + "</div></section>";
    }
    if (adv && shown("fine", inv.fine)) html += '<div class="inv-fine">' + ed("fine", "Terms and conditions", "", true) + " " + removeLink("fine", "terms") + "</div>";
    else if (edit) html += '<div class="adds" style="margin-top:0.8rem">' + addLink("fine", "Terms and conditions") + "</div>";
    html += '<footer class="inv-foot"><span>' + (c.name ? "Questions? " + esc([c.phone, c.email].filter(Boolean).join(" or ")) : "") + "</span><span>" + (inv.fingerprint ? "Invoice ID <b>" + esc(inv.fingerprint) + "</b> · " : "") + "Made with <b>" + M.NAME + "</b>, " + M.SITE + "</span></footer>";
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
  function optionsSheet(inv, done) {
    var adv = inv.tier === "advanced";
    sheet("<h2>Options</h2><div class=\"stack\" style=\"margin-top:0.6rem\">" +
      (adv ? field("Currency", '<select data-k="currency">' + Object.keys(M.CURRENCIES).map(function (k) { return '<option value="' + k + '"' + (k === inv.currency ? " selected" : "") + ">" + k + ", " + M.CURRENCIES[k].name + "</option>"; }).join("") + "</select>") : '<p class="small muted">Currency, paper size and registration numbers are advanced-invoice options.</p>') +
      field("Paper size", '<select data-k="paper">' + Object.keys(M.PAPER).map(function (k) { return '<option value="' + k + '"' + (k === S.company.paper ? " selected" : "") + ">" + M.PAPER[k] + "</option>"; }).join("") + "</select>", "For every invoice; set in your company profile.") +
      '<button type="button" class="btn primary" data-ok>Done</button></div>', function (el) {
      el.addEventListener("click", function (e) { if (!e.target.closest("[data-ok]")) return; var f = {}; readFields(el, f); if (adv && f.currency) inv.currency = f.currency; if (f.paper) S.company.paper = f.paper; touch(inv); save(); closeSheet(); done(); });
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
      '<div class="row" style="margin-top:0.9rem">' + (st !== "void" ? pdfButtons() + (st !== "paid" && st !== "draft" ? '<button type="button" class="btn green" data-payment>' + I.check + " Record a payment</button>" : "") : "") + '<button type="button" class="btn" data-more>More</button></div>' +
      (M.PRICING.mode === "free" ? '<p class="small muted" style="margin:0.7rem 0 0">Downloads are free while the app is in testing. Later, ' + M.priceText(M.price(inv)) + " once for this invoice; downloading it again is free.</p>" : "") + "</div>" +
      ((inv.payments || []).length ? '<div class="card"><div class="section-head" style="margin-top:0"><h2>Payments</h2><span class="mono small">' + money(t.paid, inv.currency) + " of " + money(t.owed, inv.currency) + '</span></div><div class="list">' + inv.payments.map(function (p) { return '<div class="item" style="cursor:default"><div><div class="t">' + esc(p.method || "Payment") + (p.note ? ", " + esc(p.note) : "") + '</div><div class="s">' + esc(M.longDate(p.date)) + '</div></div><div class="r"><div class="amt">' + money(p.amount, inv.currency) + '</div><button type="button" class="btn-text quiet small" data-rmpay="' + p.id + '">Remove</button></div></div>'; }).join("") + "</div></div>" : "") +
      '<div class="inv readonly' + (inv.unlock ? "" : " locked") + '" data-inv style="--accent:' + esc(/^#[0-9a-f]{6}$/i.test(S.company.accent) ? S.company.accent : "#1C3F7A") + '">' + invoiceHtml(inv, S.company, { edit: false, slam: slam }) + "</div>" +
      '<p class="small muted">' + (inv.fingerprint ? "Invoice ID " + esc(inv.fingerprint) + " is printed on the PDF; it changes if the invoice changes, so a copy that comes back can be checked against this one. " : "") + "Created " + esc(M.longDate(inv.createdAt)) + (inv.sentAt ? ", sent " + esc(M.longDate(inv.sentAt)) : "") + (inv.paidAt ? ", paid " + esc(M.longDate(inv.paidAt)) : "") + ".</p></div>";
    onMain("click", function (e) {
      if (e.target.closest("[data-pdf]")) { makePdf(inv, false); return; }
      if (e.target.closest("[data-share]")) { makePdf(inv, true); return; }
      if (e.target.closest("[data-payment]")) { paymentSheet(inv); return; }
      if (e.target.closest("[data-more]")) { moreSheet(inv); return; }
      var rp = e.target.closest("[data-rmpay]"); if (rp) { inv.payments = inv.payments.filter(function (p) { return p.id !== rp.getAttribute("data-rmpay"); }); if (inv.status === "paid") { inv.status = "sent"; inv.paidAt = ""; } touch(inv); save(); viewInvoice(inv.id); }
    });
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
    if (inv.unlock) return Promise.resolve(true);
    if (M.PRICING.mode === "free") { inv.unlock = { at: new Date().toISOString(), tier: inv.tier, how: "free" }; return Promise.resolve(true); }
    return ask("Pay " + M.priceText(M.price(inv)) + " to download", "One payment unlocks this invoice for good; download it again any time. Payments are not switched on yet in this build.", [{ label: "OK", value: false }]);
  }
  var busyEl = null;
  function busy(msg) { if (busyEl) busyEl.remove(); busyEl = null; if (!msg) return; busyEl = document.createElement("div"); busyEl.className = "toast"; busyEl.textContent = msg; $layer.appendChild(busyEl); }
  function makePdf(inv, share) {
    if (!inv.cust.name.trim() && !inv.lines.some(function (l) { return l.d; })) { toast("Add a customer and at least one line first."); return; }
    unlock(inv).then(function (ok) {
      if (!ok) return;
      busy("Making the PDF");
      return M.fingerprint(inv, S.company).then(function (fp) { inv.fingerprint = fp; return window.BHPDF.make(inv, S.company); }).then(function (out) {
        var first = inv.status === "draft";
        if (first) { inv.status = "sent"; inv.sentAt = M.today(); }
        ensureClient(inv); touch(inv); save(true); busy(null);
        return deliver(out, inv, share).then(function (how) {
          if (how === "cancelled") return;
          if (location.hash === "#/inv/" + inv.id || location.hash === "#/edit/" + inv.id) route();
          toast(first ? "PDF ready. Marked as sent; change that under More on the invoice." : "PDF ready.");
        });
      });
    }).catch(function (e) { busy(null); toast("Could not make the PDF: " + (e && e.message ? e.message : e)); });
  }
  function deliver(out, inv, share) {
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
      (p.status !== "closed" ? '<div class="row" style="margin-top:0.9rem"><a class="btn primary" href="#/new//' + p.id + '">' + I.plus + " New invoice on this project</a></div>" : "") + "</div>" +
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
      (iosSafariTab() ? '<div class="card" style="border-color:var(--amber)"><h3>Keep it safe</h3><p class="small" style="margin-top:0.4rem">In Safari, tap Share, then <b>Add to Home Screen</b>. As a home-screen app, Billhead opens full screen and works offline, and Safari stops counting the days toward clearing its stored data (it clears a site\'s data after seven days without a visit). Keep a backup file either way.</p></div>' : "") +
      '<div class="card"><h3>Backup</h3><p class="small muted" style="margin-top:0.4rem">Everything lives on this device only. A backup file holds your company, customers, projects and invoices; keep one somewhere safe, and use it to move to a new phone.</p><div class="row"><button type="button" class="btn" data-backup>Save a backup file</button><label class="btn file-btn">Restore from a backup<input type="file" accept=".json,application/json" data-restore></label>' + (S.invoices.length ? '<button type="button" class="btn" data-csv>Invoices as CSV</button>' : "") + "</div></div>" +
      '<div class="card"><h3>Pricing</h3><p class="small" style="margin-top:0.4rem">' + (M.PRICING.mode === "free" ? "Free while the app is in testing. " : "") + "The plan: " + M.priceText(M.PRICING.simple) + " for a simple invoice and " + M.priceText(M.PRICING.advanced) + " for an advanced one, paid once per invoice when you download it. Download it again any time. No subscription, no account, no ads.</p></div>" +
      '<div class="card"><h3>About</h3><p class="small" style="margin-top:0.4rem"><b>' + M.NAME + "</b> by Tompkins Software Systems. A billhead is what printers called a business's invoice form a century ago: the name at the top, the bill below. Nothing you type leaves this device; there is no server and no account. PDFs are drawn on the phone and locked against editing. Build " + esc(build) + '.</p><p class="small muted">Type: IBM Plex (SIL Open Font License). PDF: jsPDF (MIT). Signatures: signature_pad (MIT).</p>' +
      '<div class="row"><a class="btn small" href="https://' + M.SITE + '/support.html" target="_blank" rel="noopener">Support</a><a class="btn small" href="https://' + M.SITE + '/privacy.html" target="_blank" rel="noopener">Privacy</a>' + (S.invoices.length ? "" : '<button type="button" class="btn small" data-sample>Load a sample company</button>') + '<button type="button" class="btn-text danger" data-forget>Forget everything on this device</button></div></div></div>';
    onMain("click", function (e) {
      var b;
      if ((b = e.target.closest("[data-setlook]"))) { S.settings.look = b.getAttribute("data-setlook"); applyLook(); save(); viewMore(); return; }
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

  /* ---------- Start ---------- */
  applyLook();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { });
  var goParam = /[?&]go=([a-z-]+)/.exec(location.search);
  if (goParam && S.company) { history.replaceState(null, "", location.pathname + "#/new/" + goParam[1].replace("new-", "")); }
  route();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
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
