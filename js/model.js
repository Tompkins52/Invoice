/* Billhead model: everything about invoices that has no screen.
   Runs in the browser (window.BH) and in Node (tests/model.test.js). No DOM in here. */
(function (root) {
  "use strict";
  var M = {};
  M.NAME = "Billhead";
  M.TAGLINE = "Invoices from your phone. Nothing leaves it.";
  M.SITE = "tompkinssoftwaresystems.com";
  M.DATA_VERSION = 1;

  /* Pricing. mode "free" means every download is unlocked (testing). mode "paid" routes a download
     through the checkout (not wired yet: needs a Stripe account and a small worker, see README). */
  M.PRICING = {
    mode: "free", currency: "USD",
    simple: 0.99, advanced: 1.99,
    firstFree: true,
    packs: [{ tier: "simple", count: 10, price: 7.99 }, { tier: "advanced", count: 10, price: 14.99 }, { tier: "advanced", count: 50, price: 49 }],
    pass: { price: 99, days: 365 }
  };

  M.TERMS = ["Due on receipt", "Net 7", "Net 10", "Net 15", "Net 30", "Net 45", "Net 60", "Net 90"];
  M.CURRENCIES = {
    USD: { symbol: "$", name: "US dollar" }, CAD: { symbol: "CA$", name: "Canadian dollar" }, EUR: { symbol: "€", name: "Euro" },
    GBP: { symbol: "£", name: "British pound" }, AUD: { symbol: "A$", name: "Australian dollar" }, MXN: { symbol: "MX$", name: "Mexican peso" }
  };
  M.PAPER = { letter: "Letter", a4: "A4" };

  /* The parts of an invoice that belong to the advanced tier. A simple invoice never shows them;
     adding one to a simple invoice moves it to advanced (the app asks first). */
  M.ADVANCED = {
    attn: "Attention line", po: "Purchase order number", ref: "Reference or quote number", ship: "Ship to or job site",
    period: "Service period", units: "Units on line items", linetax: "Tax per line", freight: "Freight or shipping",
    late: "Late fee or early-pay terms", retain: "Retainage", prog: "Progress billing on a project",
    sig: "Signature", accept: "Customer acceptance line", taxid: "Tax ID on the invoice", vat: "VAT, GST or registration number",
    currency: "A currency other than US dollars", fine: "Terms and conditions text"
  };

  /* ---------- Small helpers ---------- */
  M.num = function (v) { if (typeof v === "number") return isFinite(v) ? v : 0; var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; };
  M.round2 = function (n) { return Math.round((M.num(n) + Number.EPSILON) * 100) / 100; };
  M.money = function (n, currency) {
    var c = M.CURRENCIES[currency] || M.CURRENCIES.USD; n = M.num(n);
    var s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? "-" : "") + c.symbol + s;
  };
  M.iso = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  M.today = function () { return M.iso(new Date()); };
  M.parseIso = function (s) { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; var p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  M.addDays = function (isoDate, n) { var d = M.parseIso(isoDate) || new Date(); d.setDate(d.getDate() + n); return M.iso(d); };
  M.daysBetween = function (a, b) { var da = M.parseIso(a), db = M.parseIso(b); if (!da || !db) return 0; return Math.round((db - da) / 86400000); };
  M.longDate = function (isoDate) { var d = M.parseIso(isoDate); return d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""; };
  M.shortDate = function (isoDate) { var d = M.parseIso(isoDate); return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""; };
  M.termDays = function (t) { var m = /Net (\d+)/.exec(t || ""); return m ? Number(m[1]) : 0; };
  M.dueFor = function (date, terms) { return M.addDays(date, M.termDays(terms)); };
  M.nextNumber = function (n) { var m = /^(.*?)(\d+)(\D*)$/.exec(n || ""); if (!m) return (n || "INV") + "-2"; return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0") + m[3]; };
  M.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  M.get = function (o, path) { return path.split(".").reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); };
  M.set = function (o, path, v) { var ks = path.split("."), last = ks.pop(), t = ks.reduce(function (a, k) { if (a[k] == null) a[k] = {}; return a[k]; }, o); t[last] = v; };
  M.merge = function (base, over) {
    Object.keys(over || {}).forEach(function (k) {
      if (over[k] && typeof over[k] === "object" && !Array.isArray(over[k]) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) base[k] = M.merge(base[k], over[k]);
      else base[k] = over[k];
    });
    return base;
  };
  M.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  M.safeName = function (s) { return String(s || "invoice").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "invoice"; };

  /* ---------- Blank records ---------- */
  M.blankCompany = function () {
    return { name: "", logo: "", addr: "", phone: "", email: "", web: "", taxid: "", vatLabel: "", vat: "", accent: "#1C3F7A",
      currency: "USD", paper: "letter", terms: "Net 30", taxRate: "", taxLabel: "Sales tax", payTo: "", payInstr: "", payLink: "", late: "", notes: "", fine: "",
      prefix: "INV-", next: 1001, sig: { png: "", name: "", title: "" }, createdAt: "" };
  };
  M.blankClient = function () { return { id: M.uid(), name: "", attn: "", addr: "", email: "", phone: "", terms: "", notes: "", createdAt: M.today() }; };
  M.blankProject = function () { return { id: M.uid(), clientId: "", name: "", kind: "once", contract: "", planned: 1, po: "", retain: "", status: "open", notes: "", changes: [], createdAt: M.today() }; };
  /* Contract amount plus approved change orders. */
  M.contractToDate = function (project) { return M.round2(M.num(project.contract) + (project.changes || []).reduce(function (s, ch) { return s + M.num(ch.amount); }, 0)); };
  M.blankLine = function () { return { d: "", q: 1, u: "", r: "", t: true }; };
  M.blankInvoice = function (company, tier) {
    var c = company || M.blankCompany(), date = M.today();
    return { id: M.uid(), v: M.DATA_VERSION, tier: tier === "advanced" ? "advanced" : "simple", status: "draft", clientId: "", projectId: "",
      num: (c.prefix || "") + (c.next || 1), date: date, terms: c.terms || "Net 30", due: M.dueFor(date, c.terms || "Net 30"), dueAuto: true,
      po: "", ref: "", cust: { name: "", attn: "", addr: "", email: "", phone: "" }, ship: "", desc: "", from: "", to: "",
      lines: [M.blankLine()], disc: "", discPct: false, tax: c.taxRate === "" || c.taxRate == null ? "" : c.taxRate, taxLabel: c.taxLabel || "Sales tax", freight: "", deposit: "", retain: "",
      prog: { on: false, contract: "", n: 1, m: 2, prev: "" }, pay: { to: c.payTo || "", instr: c.payInstr || "", link: c.payLink || "", late: c.late || "", notes: c.notes || "" }, fine: c.fine || "",
      sig: { on: false, png: "", name: "", title: "", date: "" }, accept: false, currency: c.currency || "USD", vatLabel: c.vatLabel || "", vat: c.vat || "", showTaxid: false,
      show: {}, payments: [], unlock: null, sentAt: "", paidAt: "", fingerprint: "", createdAt: date, updatedAt: date };
  };

  /* ---------- Math ---------- */
  M.lineAmount = function (l) { return M.round2(M.num(l.q) * M.num(l.r)); };
  M.totals = function (inv) {
    var adv = inv.tier === "advanced", sub = 0, taxable = 0;
    (inv.lines || []).forEach(function (l) { var a = M.lineAmount(l); sub += a; if (adv ? l.t !== false : true) taxable += a; });
    sub = M.round2(sub);
    var disc = inv.discPct ? M.round2(sub * M.num(inv.disc) / 100) : M.num(inv.disc);
    disc = Math.min(sub, Math.max(0, M.round2(disc)));
    var taxBase = sub ? Math.max(0, M.round2(taxable - disc * (taxable / sub))) : 0;
    var tax = M.round2(taxBase * M.num(inv.tax) / 100);
    var freight = adv ? M.num(inv.freight) : 0;
    var total = M.round2(sub - disc + tax + freight);
    var retainPct = adv ? Math.max(0, Math.min(100, M.num(inv.retain))) : 0, retainAmt = M.round2(total * retainPct / 100);
    var deposit = M.num(inv.deposit);
    var paid = M.round2((inv.payments || []).reduce(function (s, p) { return s + M.num(p.amount); }, 0));
    var due = M.round2(total - retainAmt - deposit - paid);
    return { sub: sub, disc: disc, taxBase: taxBase, tax: tax, freight: freight, total: total, retainPct: retainPct, retainAmt: retainAmt, deposit: deposit, paid: paid, due: due, owed: M.round2(total - retainAmt - deposit) };
  };

  /* Which advanced parts an invoice is using (empty for a plain simple invoice). */
  M.advancedUsed = function (inv) {
    var u = [], has = function (v) { return v != null && String(v).trim() !== "" && M.num(v) !== 0; };
    if (inv.cust && inv.cust.attn) u.push("attn");
    if (inv.po) u.push("po");
    if (inv.ref) u.push("ref");
    if (inv.ship) u.push("ship");
    if (inv.from || inv.to) u.push("period");
    if ((inv.lines || []).some(function (l) { return l.u; })) u.push("units");
    if ((inv.lines || []).some(function (l) { return l.t === false; })) u.push("linetax");
    if (has(inv.freight)) u.push("freight");
    if (inv.pay && inv.pay.late) u.push("late");
    if (has(inv.retain)) u.push("retain");
    if (inv.prog && inv.prog.on) u.push("prog");
    if (inv.sig && inv.sig.on) u.push("sig");
    if (inv.accept) u.push("accept");
    if (inv.showTaxid) u.push("taxid");
    if (inv.vat) u.push("vat");
    if (inv.currency && inv.currency !== "USD") u.push("currency");
    if (inv.fine) u.push("fine");
    return u;
  };
  M.price = function (inv) { return inv.tier === "advanced" ? M.PRICING.advanced : M.PRICING.simple; };
  M.priceText = function (n) { return n < 1 ? Math.round(n * 100) + "¢" : "$" + n.toFixed(2); };

  /* Status as the app shows it. Draft until the PDF is made; then sent, partial, paid, or overdue by the due date. */
  M.status = function (inv, todayIso) {
    if (inv.status === "void") return "void";
    if (inv.status === "draft" || !inv.status) return "draft";
    var t = M.totals(inv), today = todayIso || M.today();
    if (inv.status === "paid" || (t.owed > 0 && t.paid >= t.owed - 0.004)) return "paid";
    if (t.paid > 0) return inv.due && inv.due < today ? "overdue" : "partial";
    return inv.due && inv.due < today ? "overdue" : "sent";
  };
  M.STATUS_LABEL = { draft: "Draft", sent: "Sent", partial: "Partly paid", paid: "Paid", overdue: "Overdue", void: "Void" };
  M.daysLate = function (inv, todayIso) { var s = M.status(inv, todayIso); return s === "overdue" ? M.daysBetween(inv.due, todayIso || M.today()) : 0; };

  /* ---------- Projects ---------- */
  M.projectInvoices = function (project, invoices) {
    return (invoices || []).filter(function (i) { return i.projectId === project.id && i.status !== "void"; })
      .sort(function (a, b) { return (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || "") || a.num.localeCompare(b.num, undefined, { numeric: true }); });
  };
  M.projectSummary = function (project, invoices, todayIso) {
    var list = M.projectInvoices(project, invoices), billed = 0, paid = 0, retained = 0, outstanding = 0, sent = 0;
    list.forEach(function (i) {
      var t = M.totals(i), st = M.status(i, todayIso);
      if (st === "draft") return;
      sent++; billed = M.round2(billed + t.total); retained = M.round2(retained + t.retainAmt); paid = M.round2(paid + t.paid + t.deposit);
      if (st !== "paid") outstanding = M.round2(outstanding + Math.max(0, t.due));
    });
    var contract = M.contractToDate(project);
    return { invoices: list, count: list.length, sent: sent, billed: billed, paid: paid, retained: retained, outstanding: outstanding, contract: contract, changes: M.round2(contract - M.num(project.contract)),
      remaining: contract ? M.round2(contract - billed) : 0, pct: contract ? Math.max(0, Math.min(100, billed / contract * 100)) : 0, planned: Math.max(1, M.num(project.planned) || 1) };
  };
  /* Fills the progress block of an invoice from its project: contract, what was billed before it, and which invoice it is. */
  M.applyProject = function (inv, project, invoices) {
    if (!project) return inv;
    inv.projectId = project.id;
    if (project.clientId && !inv.clientId) inv.clientId = project.clientId;
    if (project.po && !inv.po && inv.tier === "advanced") inv.po = project.po;
    if (project.kind === "progress" && inv.tier === "advanced") {
      var others = M.projectInvoices(project, invoices).filter(function (i) { return i.id !== inv.id && i.status !== "draft"; });
      var before = others.filter(function (i) { return (i.date || "") <= (inv.date || "") && i.id !== inv.id; });
      var prev = before.reduce(function (s, i) { return s + M.totals(i).total; }, 0);
      var n = before.length + 1, planned = Math.max(n, M.num(project.planned) || 1);
      inv.prog = { on: true, contract: M.contractToDate(project) || "", n: n, m: planned, prev: M.round2(prev) };
      if (project.retain && (inv.retain === "" || inv.retain == null)) inv.retain = project.retain;
    } else if (inv.prog) inv.prog.on = false;
    return inv;
  };
  M.progress = function (inv) {
    if (!inv.prog || !inv.prog.on) return null;
    var t = M.totals(inv), contract = M.num(inv.prog.contract), prev = M.num(inv.prog.prev), billed = M.round2(prev + t.total);
    return { contract: contract, prev: prev, thisInvoice: t.total, billed: billed, remaining: M.round2(contract - billed), pct: contract ? Math.max(0, Math.min(100, billed / contract * 100)) : 0, n: M.num(inv.prog.n) || 1, m: M.num(inv.prog.m) || 1 };
  };

  /* ---------- Fingerprint: a short code of what the invoice says, printed on the PDF and kept with the record. ---------- */
  M.canonical = function (inv, company) {
    var t = M.totals(inv);
    return JSON.stringify({ n: inv.num, d: inv.date, due: inv.due, from: (company && company.name) || "", to: inv.cust && inv.cust.name, cur: inv.currency,
      lines: (inv.lines || []).map(function (l) { return [l.d, M.num(l.q), M.num(l.r)]; }), total: t.total, due_amt: t.due });
  };
  M.codeFromHex = function (hex) {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", out = "", i;
    for (i = 0; i < 8; i++) out += alphabet[parseInt(hex.substr(i * 2, 2), 16) % 32];
    return out.slice(0, 4) + "-" + out.slice(4);
  };
  M.fingerprint = function (inv, company) {
    var text = M.canonical(inv, company);
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
        return M.codeFromHex(Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""));
      });
    }
    try { var h = require("crypto").createHash("sha256").update(text).digest("hex"); return Promise.resolve(M.codeFromHex(h)); } catch (e) { return Promise.resolve(""); }
  };

  /* ---------- Storage (one JSON document in localStorage; a backup file is the same document) ---------- */
  M.KEY = "billhead.v1";
  M.blankState = function () { return { v: M.DATA_VERSION, company: null, clients: [], projects: [], invoices: [], credits: { simple: 0, advanced: 0 }, pass: { until: "" }, settings: { look: "auto", sounds: false, onboarded: false }, savedAt: "" }; };
  /* How a download gets unlocked, in order: already unlocked, testing, the first invoice, a year pass, a pack credit, or pay. */
  M.unlockHow = function (state, inv, todayIso) {
    if (inv.unlock) return "unlocked";
    if (M.PRICING.mode === "free") return "free";
    if (M.PRICING.firstFree && !(state.invoices || []).some(function (i) { return i.unlock && i.id !== inv.id; })) return "first";
    if (state.pass && state.pass.until && state.pass.until >= (todayIso || M.today())) return "pass";
    if (state.credits && M.num(state.credits[inv.tier]) > 0) return "credit";
    return "pay";
  };
  M.normalize = function (data) {
    var s = M.merge(M.blankState(), data || {});
    if (s.company) s.company = M.merge(M.blankCompany(), s.company);
    s.clients = (s.clients || []).map(function (c) { return M.merge(M.blankClient(), c); });
    s.projects = (s.projects || []).map(function (p) { return M.merge(M.blankProject(), p); });
    s.invoices = (s.invoices || []).map(function (i) { var b = M.blankInvoice(s.company || M.blankCompany(), i.tier); var m = M.merge(b, i); if (!m.lines || !m.lines.length) m.lines = [M.blankLine()]; return m; });
    return s;
  };
  M.load = function () {
    if (typeof localStorage === "undefined") return M.blankState();
    try { var raw = localStorage.getItem(M.KEY); return raw ? M.normalize(JSON.parse(raw)) : M.blankState(); } catch (e) { return M.blankState(); }
  };
  M.save = function (state) {
    if (typeof localStorage === "undefined") return false;
    state.savedAt = new Date().toISOString();
    try { localStorage.setItem(M.KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  };

  /* ---------- Sample ---------- */
  M.sampleCompany = function () {
    var c = M.blankCompany();
    c.name = "Hart Electric LLC"; c.addr = "300 Main St, Suite 2\nPrairie City, IL 60000"; c.phone = "(555) 010-0142"; c.email = "office@hartelectric.example"; c.web = "hartelectric.example";
    c.terms = "Net 30"; c.taxRate = 7.25; c.payTo = "Hart Electric LLC"; c.payInstr = "Mail checks to the address above, or ask for our ACH letter. Card payments add 3%."; c.late = "1.5% per month after the due date";
    c.notes = "Thank you for the work."; c.next = 1043; return c;
  };
  M.sampleInvoice = function (company, tier) {
    var s = M.blankInvoice(company, tier); s.num = "INV-1043"; s.cust = { name: "Lakeside Dental", attn: tier === "advanced" ? "Accounts payable" : "", addr: "42 Lakeview Dr\nPrairie City, IL 60000", email: "ap@lakesidedental.example", phone: "" };
    s.desc = "Panel upgrade and six new 20 A circuits for the second-floor exam rooms. Inspected and passed.";
    s.lines = [{ d: "200 A panel and breakers (parts)", q: 1, u: "", r: 1180, t: true }, { d: "Labor, panel replacement", q: 8, u: "hr", r: 95, t: false }, { d: "20 A circuit materials", q: 6, u: "", r: 85, t: true }, { d: "Labor, circuits", q: 12, u: "hr", r: 95, t: false }, { d: "Permit and inspection", q: 1, u: "", r: 180, t: false }];
    s.tax = 7.25;
    if (tier === "advanced") { s.po = "PO 4471"; s.ref = "Quote 1042"; s.ship = "Same as billing"; s.from = M.addDays(s.date, -16); s.to = M.addDays(s.date, -3); s.freight = 48.5; s.deposit = 1500; s.prog = { on: true, contract: 9600, n: 2, m: 3, prev: 3200 }; }
    else s.lines.forEach(function (l) { l.u = ""; l.t = true; });
    return s;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = M; else root.BH = M;
})(typeof window !== "undefined" ? window : this);
