/* Billhead's sample company for screenshots, the promo video and the store listing: Hart Electric, two projects
   billed in stages, invoices in every state. Dates count from today so it never ages. The logo is drawn, not a
   real company's. Used by tools/store_assets.py and the site's screens tool. Call seed(arg) with { logo, ask }
   on a page of the app's origin; it writes the app's storage. */
var SAMPLE_LOGO = "data:image/png;base64,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";
var seed = (arg) => {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const L = (desc, q, r, t, u) => ({ d: desc, q: q, u: u || '', r: r, t: t !== false });
  const base = { v: 1, terms: 'Net 30', dueAuto: true, po: '', ref: '', ship: '', desc: '', from: '', to: '', disc: '', discPct: false, tax: 7.25, taxLabel: 'Sales tax',
    freight: '', deposit: '', retain: '', prog: { on: false, contract: '', n: 1, m: 2, prev: '' },
    pay: { to: 'Hart Electric LLC', instr: 'Mail checks to the address above, or ask for our ACH letter.', link: '', late: '', notes: 'Thank you for the work.' },
    fine: '', sig: { on: false, png: '', name: '', title: '', date: '' }, accept: false, currency: 'USD', vatLabel: '', vat: '', showTaxid: false, show: {}, payments: [], unlock: null, fingerprint: '', paidAt: '' };
  const inv = (o) => Object.assign(JSON.parse(JSON.stringify(base)), o);
  const nl = String.fromCharCode(10);
  const dental = { id: 'c1', name: 'Lakeside Dental', attn: 'Accounts payable', addr: '42 Lakeview Dr' + nl + 'Prairie City, IL 60000', email: 'ap@lakesidedental.example', phone: '', terms: '', notes: '' };
  const library = { id: 'c2', name: 'Prairie City Public Library', attn: 'Facilities', addr: '100 Library Ln' + nl + 'Prairie City, IL 60000', email: 'facilities@pcpl.example', phone: '', terms: '', notes: '' };
  const bakery = { id: 'c3', name: 'Oak Street Bakery', attn: '', addr: '18 Oak St' + nl + 'Prairie City, IL 60000', email: 'hello@oakstreetbakery.example', phone: '', terms: '', notes: '' };
  const cust = (c) => ({ name: c.name, attn: c.attn, addr: c.addr, email: c.email, phone: '' });
  const invoices = [
    inv({ id: 'i1040', tier: 'simple', status: 'sent', clientId: 'c3', projectId: '', num: 'INV-1040', date: d(-38), due: d(-8), sentAt: d(-38), createdAt: d(-38), updatedAt: d(-38), cust: cust(bakery),
      lines: [L('Walk-in cooler: new 30 A circuit and disconnect', 1, 640), L('Wire, conduit, and fittings', 1, 118.4)] }),
    inv({ id: 'i1041', tier: 'advanced', status: 'sent', clientId: 'c2', projectId: 'p2', num: 'INV-1041', date: d(-30), due: d(0), sentAt: d(-30), createdAt: d(-30), updatedAt: d(-9), cust: cust(library), po: 'PCPL-118',
      lines: [L('Mobilization, lighting survey, and layout', 1, 4600, false)], retain: 5, prog: { on: true, contract: 18400, n: 1, m: 4, prev: 0 },
      payments: [{ id: 'pay1', date: d(-9), amount: 4370, method: 'ACH', note: '' }], paidAt: d(-9) }),
    inv({ id: 'i1042', tier: 'advanced', status: 'sent', clientId: 'c1', projectId: 'p1', num: 'INV-1042', date: d(-21), due: d(9), sentAt: d(-21), createdAt: d(-21), updatedAt: d(-4), cust: cust(dental), po: 'PO 4471',
      lines: [L('Demolition and rough-in, second floor', 1, 3200, false)], retain: 10, prog: { on: true, contract: 9600, n: 1, m: 3, prev: 0 },
      payments: [{ id: 'pay2', date: d(0), amount: 1500, method: 'Check', note: 'Check 2231' }] }),
    inv({ id: 'i1043', tier: 'simple', status: 'sent', clientId: 'c1', projectId: '', num: 'INV-1043', date: d(-2), due: d(28), sentAt: d(-2), createdAt: d(-2), updatedAt: d(-2), cust: cust(dental),
      lines: [L('Service call: replace failed GFCI outlets', 1, 285), L('GFCI outlets, 20 A', 3, 24.5)] }),
    inv({ id: 'i1045', tier: 'advanced', status: 'sent', clientId: 'c2', projectId: 'p2', num: 'INV-1045', date: d(-6), due: d(24), sentAt: d(-6), createdAt: d(-6), updatedAt: d(-6), cust: cust(library), po: 'PCPL-118',
      lines: [L('LED fixtures and labor, first floor', 1, 5520, false)], retain: 5, prog: { on: true, contract: 18400, n: 2, m: 4, prev: 4600 } }),
    inv({ id: 'i1044', tier: 'advanced', status: 'draft', clientId: 'c1', projectId: 'p1', num: 'INV-1044', date: d(0), due: d(30), sentAt: '', createdAt: d(0), updatedAt: d(0), cust: cust(dental), po: 'PO 4471',
      desc: 'Panel upgrade and six new 20 A circuits for the exam rooms. Inspected and passed.',
      lines: [L('200 A panel and breakers', 1, 1180, true, 'ea'), L('Labor, panel replacement', 8, 95, false, 'hr'), L('20 A circuit materials', 6, 85, true, 'ea'), L('Labor, circuits', 12, 95, false, 'hr')],
      retain: 10, prog: { on: true, contract: 9600, n: 2, m: 3, prev: 3200 },
      pay: { to: 'Hart Electric LLC', instr: 'Mail checks to the address above, or ask for our ACH letter.', link: '', late: '1.5% per month after the due date', notes: 'Thank you for the work.' } })
  ];
  if (arg.ask) invoices.push(inv({ id: 'i1046', tier: 'simple', status: 'draft', clientId: 'c3', projectId: '', num: 'INV-1046', date: d(0), due: d(30), sentAt: '', createdAt: d(0), updatedAt: d(0), cust: cust(bakery),
    lines: [L('Replace exterior sign lighting', 1, 420), L('LED sign modules', 2, 65)], _step: 2 }));
  const state = { v: 1, credits: { simple: 0, advanced: 0 }, pass: { until: '' }, settings: { look: 'light', sounds: false, onboarded: true }, savedAt: new Date().toISOString(),
    company: { name: 'Hart Electric LLC', logo: arg.logo, addr: '300 Main St, Suite 2' + nl + 'Prairie City, IL 60000', phone: '(555) 010-0142', email: 'office@hartelectric.example', web: 'hartelectric.example',
      taxid: '', vatLabel: '', vat: '', accent: '#1C3F7A', currency: 'USD', paper: 'letter', terms: 'Net 30', taxRate: 7.25, taxLabel: 'Sales tax', payTo: 'Hart Electric LLC',
      payInstr: 'Mail checks to the address above, or ask for our ACH letter.', payLink: '', late: '1.5% per month after the due date', notes: 'Thank you for the work.', fine: '',
      prefix: 'INV-', next: arg.ask ? 1047 : 1046, sig: { png: '', name: 'Dana Hart', title: 'Owner' }, createdAt: d(-60) },
    clients: [dental, library, bakery],
    projects: [
      { id: 'p1', clientId: 'c1', name: 'Second-floor exam rooms', kind: 'progress', contract: 9600, planned: 3, po: 'PO 4471', retain: 10, status: 'open', notes: '', changes: [], createdAt: d(-24) },
      { id: 'p2', clientId: 'c2', name: 'Library LED retrofit', kind: 'progress', contract: 18400, planned: 4, po: 'PCPL-118', retain: 5, status: 'open', notes: '', changes: [], createdAt: d(-32) }
    ],
    invoices: invoices };
  localStorage.clear();
  localStorage.setItem('billhead.v1', JSON.stringify(state));
};
