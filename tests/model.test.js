/* Checks on the invoice math and records, no browser needed. Run: node tests/model.test.js */
"use strict";
const assert = require("assert");
const M = require("../js/model.js");
let n = 0;
function t(name, fn) { fn(); n++; console.log("ok    " + name); }

const co = M.sampleCompany();

t("a simple invoice totals its lines and taxes them all", () => {
  const inv = M.blankInvoice(co, "simple");
  inv.lines = [{ d: "A", q: 2, r: 10 }, { d: "B", q: 1, r: 5.5, t: false }];
  inv.tax = 10;
  const x = M.totals(inv);
  assert.strictEqual(x.sub, 25.5);
  assert.strictEqual(x.taxBase, 25.5, "per-line tax is an advanced feature; simple taxes every line");
  assert.strictEqual(x.tax, 2.55);
  assert.strictEqual(x.total, 28.05);
  assert.strictEqual(x.due, 28.05);
});

t("a simple invoice takes a discount and a deposit but not freight or retainage", () => {
  const inv = M.blankInvoice(co, "simple");
  inv.lines = [{ d: "A", q: 1, r: 100 }];
  inv.disc = 10; inv.freight = 5; inv.deposit = 20; inv.retain = 10; inv.tax = "";
  assert.strictEqual(M.totals(inv).total, 90);
  assert.strictEqual(M.totals(inv).due, 70);
});

t("downloads unlock in order: testing, first invoice, year pass, pack credit, then pay", () => {
  const state = M.blankState(); const a = M.blankInvoice(co, "simple"), b = M.blankInvoice(co, "advanced"); state.invoices = [a, b];
  b.lines = [{ d: "Big job", q: 1, r: 2500 }];
  const saved = M.PRICING.mode;
  assert.strictEqual(M.unlockHow(state, a), "free");
  M.PRICING.mode = "paid";
  a.lines = [{ d: "Small job", q: 1, r: 60 }]; a.tax = 7.25;
  assert.strictEqual(M.unlockHow(state, a), "small", "under $100 with tax is free, before the first-invoice freebie is used");
  a.lines = [{ d: "Job", q: 1, r: 99.99 }]; a.tax = "";
  assert.strictEqual(M.unlockHow(state, a), "small", "$99.99 is under the limit");
  a.lines = [{ d: "Job", q: 1, r: 100 }];
  assert.strictEqual(M.unlockHow(state, a), "first", "$100.00 is not under the limit");
  const small = M.blankInvoice(co, "simple"); small.lines = [{ d: "S", q: 1, r: 20 }]; small.tax = ""; small.unlock = { how: "small" }; state.invoices.push(small);
  assert.strictEqual(M.unlockHow(state, a), "first", "a free small invoice does not use up the first free invoice");
  a.unlock = { how: "first" };
  assert.strictEqual(M.unlockHow(state, a), "unlocked");
  assert.strictEqual(M.unlockHow(state, b), "pay");
  state.credits.advanced = 1;
  assert.strictEqual(M.unlockHow(state, b), "credit");
  state.pass.until = M.addDays(M.today(), 10);
  assert.strictEqual(M.unlockHow(state, b), "pass");
  state.pass.until = M.addDays(M.today(), -1); state.credits.advanced = 0;
  assert.strictEqual(M.unlockHow(state, b), "pay");
  M.PRICING.mode = saved;
});

t("an advanced invoice applies discount, taxable lines, freight, retainage and deposit", () => {
  const inv = M.blankInvoice(co, "advanced");
  inv.lines = [{ d: "Parts", q: 1, r: 1000, t: true }, { d: "Labor", q: 10, r: 50, t: false }];
  inv.disc = 10; inv.discPct = true; inv.tax = 8; inv.freight = 30; inv.retain = 10; inv.deposit = 200;
  const x = M.totals(inv);
  assert.strictEqual(x.sub, 1500);
  assert.strictEqual(x.disc, 150);
  assert.strictEqual(x.taxBase, 900, "the discount comes off the taxable part in proportion");
  assert.strictEqual(x.tax, 72);
  assert.strictEqual(x.total, 1452);
  assert.strictEqual(x.retainAmt, 145.2);
  assert.strictEqual(x.due, 1106.8);
});

t("status follows the due date and the payments", () => {
  const inv = M.blankInvoice(co, "simple");
  inv.lines = [{ d: "A", q: 1, r: 100 }]; inv.tax = "";
  assert.strictEqual(M.status(inv, "2026-11-03"), "draft");
  inv.status = "sent"; inv.date = "2026-10-01"; inv.due = "2026-10-31";
  assert.strictEqual(M.status(inv, "2026-10-20"), "sent");
  assert.strictEqual(M.status(inv, "2026-11-03"), "overdue");
  inv.payments = [{ amount: 40 }];
  assert.strictEqual(M.status(inv, "2026-10-20"), "partial");
  inv.payments = [{ amount: 40 }, { amount: 60 }];
  assert.strictEqual(M.status(inv, "2026-11-03"), "paid");
  assert.strictEqual(M.daysLate({ ...inv, payments: [] }, "2026-11-03"), 3);
});

t("terms set the due date and numbers advance", () => {
  assert.strictEqual(M.dueFor("2026-11-03", "Net 30"), "2026-12-03");
  assert.strictEqual(M.dueFor("2026-11-03", "Due on receipt"), "2026-11-03");
  assert.strictEqual(M.nextNumber("INV-0099"), "INV-0100");
  assert.strictEqual(M.nextNumber("2026-7"), "2026-8");
});

t("a progress project fills in the next invoice from the ones before it", () => {
  const p = M.blankProject(); p.kind = "progress"; p.contract = 9600; p.planned = 3; p.po = "PO 1"; p.retain = 5;
  const a = M.blankInvoice(co, "advanced"); a.date = "2026-10-01"; a.status = "sent"; a.lines = [{ d: "Phase 1", q: 1, r: 3200, t: false }]; a.tax = ""; a.projectId = p.id;
  const b = M.blankInvoice(co, "advanced"); b.date = "2026-11-01"; b.lines = [{ d: "Phase 2", q: 1, r: 3000, t: false }]; b.tax = "";
  M.applyProject(b, p, [a, b]);
  assert.strictEqual(b.prog.on, true);
  assert.strictEqual(b.prog.n, 2);
  assert.strictEqual(b.prog.m, 3);
  assert.strictEqual(b.prog.prev, 3200);
  assert.strictEqual(b.po, "PO 1");
  assert.strictEqual(b.retain, 5);
  const pg = M.progress(b);
  assert.strictEqual(pg.billed, 6200);
  assert.strictEqual(pg.remaining, 3400);
  const s = M.projectSummary(p, [a, b]);
  assert.strictEqual(s.billed, 3200, "a draft does not count as billed");
  assert.strictEqual(s.sent, 1);
  p.changes = [{ d: "Extra outlet", amount: 400 }];
  assert.strictEqual(M.contractToDate(p), 10000);
  assert.strictEqual(M.projectSummary(p, [a, b]).remaining, 6800);
});

t("a simple invoice on a progress project tracks without printing progress", () => {
  const p = M.blankProject(); p.kind = "progress"; p.contract = 1000;
  const a = M.blankInvoice(co, "simple"); M.applyProject(a, p, [a]);
  assert.strictEqual(a.projectId, p.id);
  assert.strictEqual(a.prog.on, false);
});

t("advanced parts are detected", () => {
  const inv = M.blankInvoice(M.blankCompany(), "advanced");
  assert.deepStrictEqual(M.advancedUsed(inv), []);
  inv.po = "PO 9"; inv.freight = 5; inv.sig.on = true; inv.disc = 5; inv.deposit = 5;
  assert.deepStrictEqual(M.advancedUsed(inv), ["po", "freight", "sig"], "discount and deposit are simple-tier parts");
  assert.strictEqual(M.price(inv), M.PRICING.advanced);
});

t("the fingerprint is stable for the same content and changes with it", async () => {
  const inv = M.blankInvoice(co, "simple"); inv.num = "INV-1"; inv.date = "2026-11-03"; inv.lines = [{ d: "A", q: 1, r: 100 }];
  const one = await M.fingerprint(inv, co), two = await M.fingerprint(inv, co);
  assert.strictEqual(one, two);
  assert.match(one, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  inv.lines[0].r = 101;
  assert.notStrictEqual(await M.fingerprint(inv, co), one);
});

t("money formats with the currency and rounds to cents", () => {
  assert.strictEqual(M.money(1234.5, "USD"), "$1,234.50");
  assert.strictEqual(M.money(-3, "GBP"), "-£3.00");
  assert.strictEqual(M.round2(0.1 + 0.2), 0.3);
  assert.strictEqual(M.round2(1.005), 1.01);
});

t("a backup normalizes into a full state", () => {
  const s = M.normalize({ company: { name: "X" }, invoices: [{ num: "A-1", lines: [] }] });
  assert.strictEqual(s.company.prefix, "INV-");
  assert.strictEqual(s.invoices[0].lines.length, 1);
  assert.strictEqual(s.invoices[0].tier, "simple");
});

t("an invoice from TSS Invoice Creator comes over with its company, and the tier it needs", () => {
  const old = { biz: { name: "Hart Electric LLC", addr: "300 Main St", phone: "555", email: "o@h.example", web: "", taxid: "", accent: "#12352b", logo: "" },
    num: "INV-1043", date: "2026-11-01", terms: "Net 15", due: "2026-11-16", po: "", ref: "", cust: { name: "Lakeside Dental", attn: "", addr: "42 Lakeview Dr", email: "ap@l.example" },
    ship: "", desc: "Panel work", from: "", to: "", lines: [{ d: "Parts", q: 1, r: 1180, t: true }, { d: "Labor", q: 8, r: 95, t: false }],
    disc: 50, tax: "", freight: "", paid: 500, prog: { on: false, contract: "", n: 1, m: 3, prev: "" }, pay: { to: "Hart Electric LLC", late: "", instr: "Mail a check", notes: "Thanks" } };
  const got = M.fromCreator(old, null);
  assert.strictEqual(got.company.name, "Hart Electric LLC");
  assert.strictEqual(got.company.accent, "#1C3F7A", "the old default evergreen becomes the navy");
  assert.strictEqual(got.company.prefix, "INV-"); assert.strictEqual(got.company.next, 1044); assert.strictEqual(got.company.terms, "Net 15");
  assert.strictEqual(got.invoice.tier, "simple", "no tax, so the untaxed line does not make it advanced");
  assert.strictEqual(M.totals(got.invoice).due, 1180 + 8 * 95 - 50 - 500);
  old.po = "PO 4471"; old.tax = 7.25; old.prog = { on: true, contract: 9600, n: 2, m: 3, prev: 3200 };
  const adv = M.fromCreator(old, null).invoice;
  assert.strictEqual(adv.tier, "advanced"); assert.strictEqual(adv.prog.prev, 3200); assert.strictEqual(adv.lines[1].t, false);
  assert.deepStrictEqual(M.decodeImport(M.encodeImport(old)), old, "the address round-trips, accents and all");
  assert.strictEqual(M.decodeImport("not-base64!"), null);
});

t("the email to the customer carries the number, the amount due, the due date, the PO and how to pay", () => {
  const c = M.sampleCompany(); const inv = M.sampleInvoice(c, "advanced");
  inv.num = "INV-1050"; inv.due = "2026-12-07"; inv.po = "4471"; inv.cust.email = "ap@lakesidedental.example"; inv.cust.attn = "";
  inv.lines = [{ d: "Panel", q: 1, u: "", r: 1000, t: false }]; inv.tax = ""; inv.disc = ""; inv.deposit = ""; inv.freight = ""; inv.retain = ""; inv.payments = [{ id: "p", date: "2026-11-01", amount: 250, method: "Check", note: "" }];
  inv.prog = { on: true, contract: 9600, n: 2, m: 3, prev: 3200 }; inv.pay.link = "https://pay.example/hart";
  const d = M.emailDraft(inv, c);
  assert.strictEqual(d.to, "ap@lakesidedental.example");
  assert.strictEqual(d.subject, "Invoice INV-1050 from Hart Electric LLC (PO 4471)");
  assert.ok(d.body.startsWith("Hello Lakeside Dental,"), "greets the customer when there is no attention line");
  assert.ok(d.body.includes("for $750.00, due December 7, 2026"), "the balance after the payment, and the due date: " + d.body);
  assert.ok(d.body.includes("invoice 2 of 3 on the project ($9,600.00 contract)"));
  assert.ok(d.body.includes("Your PO 4471.") && d.body.includes("Pay online: https://pay.example/hart") && d.body.endsWith("(555) 010-0142  office@hartelectric.example"));
  inv.po = "P.O. 9"; inv.cust.attn = "Dana";
  const d2 = M.emailDraft(inv, c);
  assert.ok(d2.subject.endsWith("(P.O. 9)") && d2.body.startsWith("Hi Dana,"), "a PO written with the letters already is not doubled");
  assert.ok(Array.isArray(M.blankInvoice(c, "simple").sends), "a new invoice has an empty send log");
});

setTimeout(() => console.log("\n" + n + " checks passed"), 50);
