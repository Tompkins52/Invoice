/* Billhead PDF: draws the invoice from its data (no screenshot of the page), with the app's own type,
   the company logo and the signature, then locks it: the file opens anywhere with no password, prints and
   copies, but refuses editing in viewers that honor PDF permissions. jsPDF and the fonts load on first use. */
(function (root) {
  "use strict";
  var P = {}, M = root.BH, loading = null, fonts = null;

  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Could not load " + src)); }; document.head.appendChild(s); });
  }
  function fetchB64(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("Could not load " + url); return r.arrayBuffer(); }).then(function (buf) {
      var bytes = new Uint8Array(buf), bin = "", i, chunk = 0x8000;
      for (i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      return btoa(bin);
    });
  }
  P.load = function () {
    if (loading) return loading;
    loading = Promise.all([
      root.jspdf ? Promise.resolve() : loadScript("vendor/jspdf.umd.min.js"),
      fetchB64("fonts/plex-sans-400.ttf"), fetchB64("fonts/plex-sans-600.ttf"), fetchB64("fonts/plex-mono-500.ttf")
    ]).then(function (r) { fonts = { sans: r[1], sansB: r[2], mono: r[3] }; return true; }).catch(function (e) { loading = null; throw e; });
    return loading;
  };

  function hexRgb(h) { var m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return [28, 63, 122]; var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function onColor(rgb) { var l = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255; return l > 0.6 ? [26, 35, 48] : [255, 255, 255]; }
  function lines(s) { return String(s || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function randomPassword() { var a = new Uint8Array(24); if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a); else for (var i = 0; i < 24; i++) a[i] = Math.random() * 256; return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }

  /* Builds the PDF. Returns a Promise of { bytes: ArrayBuffer, pages: n, name: "invoice-inv-1043.pdf" }. */
  P.make = function (inv, company, opts) {
    opts = opts || {};
    return P.load().then(function () {
      var jsPDF = root.jspdf.jsPDF, adv = inv.tier === "advanced", c = company || {}, t = M.totals(inv), cur = inv.currency || "USD";
      var paper = c.paper === "a4" ? "a4" : "letter";
      var doc = new jsPDF({ unit: "pt", format: paper, compress: true, encryption: opts.unlocked === false ? undefined : { userPassword: "", ownerPassword: randomPassword(), userPermissions: ["print", "copy"] } });
      doc.addFileToVFS("PlexSans-400.ttf", fonts.sans); doc.addFont("PlexSans-400.ttf", "PlexSans", "normal");
      doc.addFileToVFS("PlexSans-600.ttf", fonts.sansB); doc.addFont("PlexSans-600.ttf", "PlexSans", "bold");
      doc.addFileToVFS("PlexMono-500.ttf", fonts.mono); doc.addFont("PlexMono-500.ttf", "PlexMono", "normal");
      var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), m = 44, cw = W - 2 * m, y = m;
      var accent = hexRgb(c.accent), onAccent = onColor(accent), ink = [26, 35, 48], gray = [90, 101, 115], light = [154, 163, 174], rule = [228, 232, 238];
      var footerH = 30, bottom = H - m - footerH;
      var money = function (n) { return M.money(n, cur); };

      function font(style, size, color) { doc.setFont(style === "mono" ? "PlexMono" : "PlexSans", style === "bold" ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor.apply(doc, color || ink); }
      function wrap(text, width) { return doc.splitTextToSize(String(text || ""), width); }
      function textAt(s, x, yy, align) { doc.text(String(s), x, yy, align ? { align: align } : undefined); }
      function pageBreak(need) {
        if (y + need <= bottom) return;
        doc.addPage(); y = m;
        font("normal", 8, light); textAt("Invoice " + inv.num + (c.name ? ", " + c.name : ""), m, y); textAt("continued", W - m, y, "right"); y += 14;
      }
      function heading(label, x) { font("bold", 7, gray); textAt(String(label).toUpperCase(), x, y); }
      function para(text, x, width, size, color, style) { var ls = wrap(text, width); font(style || "normal", size || 9, color || ink); ls.forEach(function (l) { textAt(l, x, y); y += size ? size * 1.32 : 12; }); return ls.length; }

      /* ---------- Header ---------- */
      var leftY = y, rightY = y, logoDrawn = false;
      if (c.logo) {
        try {
          var ip = doc.getImageProperties(c.logo), maxW = 160, maxH = 58, sc = Math.min(maxW / ip.width, maxH / ip.height, 1), lw = ip.width * sc, lh = ip.height * sc;
          doc.addImage(c.logo, ip.fileType || "PNG", m, leftY, lw, lh); leftY += lh + 8; logoDrawn = true;
        } catch (e) { logoDrawn = false; }
      }
      if (!logoDrawn) { font("bold", 16, accent); wrap(c.name || "Your business", cw * 0.55).forEach(function (l) { textAt(l, m, leftY + 12); leftY += 19; }); leftY += 2; }
      else if (c.name) { font("bold", 9.5, ink); textAt(c.name, m, leftY + 8); leftY += 13; }
      font("normal", 8.5, gray);
      var contact = lines(c.addr).concat([c.phone, c.email, c.web].filter(Boolean));
      if (adv && inv.showTaxid && c.taxid) contact.push("Tax ID " + c.taxid);
      if (adv && inv.vat) contact.push((inv.vatLabel || "VAT") + " " + inv.vat);
      contact.forEach(function (l) { textAt(l, m, leftY + 8); leftY += 11.5; });

      font("bold", 22, accent); textAt("INVOICE", W - m, rightY + 18, "right"); rightY += 30;
      var pg = M.progress(inv);
      var meta = [["Invoice no.", inv.num], ["Date", M.longDate(inv.date)], ["Terms", inv.terms], ["Due", M.longDate(inv.due) || inv.terms]];
      if (adv && inv.po) meta.push(["Customer PO", inv.po]);
      if (adv && inv.ref) meta.push(["Reference", inv.ref]);
      if (adv && pg) meta.push(["This is invoice", pg.n + " of " + pg.m]);
      meta.forEach(function (r) { font("normal", 8.5, gray); textAt(r[0], W - m - 112, rightY + 8, "right"); font("mono", 8.5, ink); textAt(r[1] || "", W - m, rightY + 8, "right"); rightY += 12.5; });
      y = Math.max(leftY, rightY) + 10;
      doc.setDrawColor.apply(doc, accent); doc.setLineWidth(2); doc.line(m, y, W - m, y); y += 16;

      /* ---------- Parties ---------- */
      var cols = [];
      var billLines = [];
      if (inv.cust.name) billLines.push({ t: inv.cust.name, b: true });
      if (adv && inv.cust.attn) billLines.push({ t: "Attn: " + inv.cust.attn });
      lines(inv.cust.addr).forEach(function (l) { billLines.push({ t: l }); });
      if (inv.cust.email) billLines.push({ t: inv.cust.email });
      if (adv && inv.cust.phone) billLines.push({ t: inv.cust.phone });
      cols.push({ h: "Bill to", lines: billLines });
      if (adv && inv.ship) cols.push({ h: "Ship to / job site", lines: lines(inv.ship).map(function (l) { return { t: l }; }) });
      var svc = [];
      if (inv.desc) svc.push({ t: inv.desc, wrap: true });
      if (adv && (inv.from || inv.to)) svc.push({ t: "Service period: " + [M.shortDate(inv.from), M.shortDate(inv.to)].filter(Boolean).join(" to "), gray: true });
      if (svc.length) cols.push({ h: "Services", lines: svc });
      if (cols.length) {
        var gutter = 14, colW = (cw - gutter * (cols.length - 1)) / cols.length, startY = y, maxY = y;
        cols.forEach(function (col, i) {
          var x = m + i * (colW + gutter); y = startY; heading(col.h, x); y += 11;
          col.lines.forEach(function (l) {
            if (l.wrap) { para(l.t, x, colW, 9, l.gray ? gray : ink); return; }
            font(l.b ? "bold" : "normal", 9.2, l.gray ? gray : ink); wrap(l.t, colW).forEach(function (s) { textAt(s, x, y); y += 12; });
          });
          maxY = Math.max(maxY, y);
        });
        y = maxY + 10;
      }

      /* ---------- Line items ---------- */
      var useUnits = adv && inv.lines.some(function (l) { return l.u; }), mixedTax = adv && M.num(inv.tax) > 0 && inv.lines.some(function (l) { return l.t === false; }) && inv.lines.some(function (l) { return l.t !== false; });
      var wAmt = 84, wRate = 80, wQty = 50, wUnit = useUnits ? 48 : 0, wDesc = cw - wAmt - wRate - wQty - wUnit;
      var xDesc = m + 6, xQty = m + wDesc + wQty, xUnit = xQty + wUnit, xRate = xUnit + wRate, xAmt = W - m - 6;
      function tableHead() {
        doc.setFillColor.apply(doc, accent); doc.rect(m, y, cw, 18, "F");
        font("bold", 7, onAccent); textAt("DESCRIPTION", xDesc, y + 12); textAt("QTY", xQty, y + 12, "right"); if (useUnits) textAt("UNIT", xUnit, y + 12, "right"); textAt("RATE", xRate, y + 12, "right"); textAt("AMOUNT", xAmt, y + 12, "right");
        y += 18;
      }
      pageBreak(60); tableHead();
      var items = inv.lines.filter(function (l) { return l.d || M.num(l.r) || (M.num(l.q) && M.num(l.q) !== 1); });
      if (!items.length) items = [{ d: "", q: "", r: "" }];
      items.forEach(function (l) {
        font("normal", 9.2, ink); var dl = wrap(l.d || " ", wDesc - 12), rh = Math.max(1, dl.length) * 12 + 8;
        if (y + rh > bottom) { pageBreak(rh + 20); tableHead(); }
        dl.forEach(function (s, i) { textAt(s, xDesc, y + 12 + i * 12); });
        font("mono", 8.8, ink);
        var qty = l.q === "" || l.q == null ? "" : String(M.num(l.q)).replace(/\.0+$/, "");
        textAt(qty, xQty, y + 12, "right"); if (useUnits) textAt(l.u || "", xUnit, y + 12, "right");
        textAt(l.r === "" || l.r == null ? "" : money(l.r), xRate, y + 12, "right");
        var amt = money(M.lineAmount(l)); textAt(amt + (mixedTax && l.t !== false ? " T" : (mixedTax ? "  " : "")), xAmt, y + 12, "right");
        y += rh; doc.setDrawColor.apply(doc, rule); doc.setLineWidth(0.5); doc.line(m, y, W - m, y);
      });
      if (mixedTax) { font("normal", 7, light); textAt("T: " + (inv.taxLabel || "sales tax") + " applies to this line", m, y + 10); }
      y += 14;

      /* ---------- Totals (right) and progress (left) ---------- */
      pageBreak(150);
      var totW = 228, tx = W - m - totW, ty = y;
      var rows = [["Subtotal", money(t.sub)]];
      if (adv && t.disc) rows.push(["Discount" + (inv.discPct ? " (" + M.num(inv.disc) + "%)" : ""), "-" + money(t.disc)]);
      if (M.num(inv.tax)) { if (adv && (t.disc || mixedTax || t.taxBase !== t.sub)) rows.push(["Taxable subtotal", money(t.taxBase)]); rows.push([(inv.taxLabel || "Sales tax") + " " + M.num(inv.tax) + "%", money(t.tax)]); }
      if (adv && t.freight) rows.push(["Freight", money(t.freight)]);
      var showTotalRow = rows.length > 1 || t.retainAmt || t.deposit || t.paid;
      if (showTotalRow) rows.push(["Total", money(t.total), "total"]);
      if (adv && t.retainAmt) rows.push(["Less retainage (" + t.retainPct + "%)", "-" + money(t.retainAmt)]);
      if (adv && t.deposit) rows.push(["Deposit received", "-" + money(t.deposit)]);
      if (t.paid) rows.push(["Payments received", "-" + money(t.paid)]);
      rows.forEach(function (r) {
        if (r[2] === "total") { doc.setDrawColor.apply(doc, [201, 207, 216]); doc.setLineWidth(0.6); doc.line(tx, ty + 2, W - m, ty + 2); ty += 6; font("bold", 9.5, ink); }
        else font("normal", 9, ink);
        textAt(r[0], tx + 6, ty + 11); font(r[2] === "total" ? "mono" : "mono", 9, ink); textAt(r[1], W - m - 6, ty + 11, "right"); ty += 15;
      });
      ty += 4; doc.setFillColor.apply(doc, accent); doc.rect(tx, ty, totW, 24, "F");
      font("bold", 10, onAccent); textAt("Balance due", tx + 8, ty + 16); font("mono", 11, onAccent); textAt(money(t.due), W - m - 8, ty + 16, "right"); ty += 24;
      var leftEnd = y;
      if (adv && pg) {
        var px = m, pw = cw - totW - 20, py = y;
        doc.setDrawColor.apply(doc, rule); doc.setLineWidth(0.6); doc.roundedRect(px, py, pw, 96, 4, 4, "S");
        y = py + 14; heading("Progress on " + (inv.po ? inv.po : "the contract"), px + 10); y += 6;
        [["Contract amount", money(pg.contract)], ["Previously billed", money(pg.prev)], ["This invoice (" + pg.n + " of " + pg.m + ")", money(pg.thisInvoice)], ["Billed to date", money(pg.billed)], ["Remaining", money(pg.remaining)]].forEach(function (r) {
          font("normal", 8.5, ink); textAt(r[0], px + 10, y + 9); font("mono", 8.5, ink); textAt(r[1], px + pw - 10, y + 9, "right"); y += 12;
        });
        doc.setFillColor.apply(doc, rule); doc.roundedRect(px + 10, y + 3, pw - 20, 5, 2.5, 2.5, "F");
        if (pg.pct > 0) { doc.setFillColor.apply(doc, accent); doc.roundedRect(px + 10, y + 3, Math.max(5, (pw - 20) * pg.pct / 100), 5, 2.5, 2.5, "F"); }
        leftEnd = py + 96;
      }
      y = Math.max(ty, leftEnd) + 18;

      /* ---------- Payment and notes ---------- */
      var payBits = [], noteBits = [];
      if (inv.pay.to) payBits.push({ t: "Make checks payable to " + inv.pay.to });
      if (inv.pay.instr) payBits.push({ t: inv.pay.instr });
      if (inv.pay.link) payBits.push({ t: "Pay online: " + inv.pay.link, link: inv.pay.link });
      if (adv && inv.pay.late) payBits.push({ t: inv.pay.late });
      if (inv.pay.notes) noteBits.push({ t: inv.pay.notes });
      if (payBits.length || noteBits.length) {
        pageBreak(70);
        doc.setDrawColor.apply(doc, rule); doc.setLineWidth(0.5); doc.line(m, y - 6, W - m, y - 6); y += 6;
        var two = payBits.length && noteBits.length, pcw = two ? (cw - 16) / 2 : cw, sy = y, ey = y;
        if (payBits.length) {
          heading("Payment", m); y += 12;
          payBits.forEach(function (b) {
            if (b.link) { font("normal", 8.6, accent); var ll = wrap(b.t, pcw); ll.forEach(function (s, i) { if (i === 0) doc.textWithLink(s, m, y, { url: b.link }); else textAt(s, m, y); y += 11.5; }); }
            else { para(b.t, m, pcw, 8.6, ink); }
            y += 2;
          });
          ey = y;
        }
        if (noteBits.length) {
          var nx = two ? m + pcw + 16 : m; y = two ? sy : ey + 4; heading("Notes", nx); y += 12;
          noteBits.forEach(function (b) { para(b.t, nx, pcw, 8.6, ink); });
          ey = Math.max(ey, y);
        }
        y = ey + 10;
      }

      /* ---------- Signature ---------- */
      if (adv && ((inv.sig && inv.sig.on) || inv.accept)) {
        pageBreak(90);
        var sgw = (cw - 16) / 2, sy2 = y;
        if (inv.sig && inv.sig.on) {
          if (inv.sig.png) { try { var sp = doc.getImageProperties(inv.sig.png), sw = 150, sh = sw * sp.height / sp.width; if (sh > 52) { sh = 52; sw = sh * sp.width / sp.height; } doc.addImage(inv.sig.png, "PNG", m, y, sw, sh); } catch (e) { } }
          y += 56; doc.setDrawColor.apply(doc, ink); doc.setLineWidth(0.6); doc.line(m, y, m + sgw, y); y += 10;
          font("normal", 8, gray); textAt([inv.sig.name, inv.sig.title].filter(Boolean).join(", ") || "Authorized signature", m, y); y += 10;
          if (inv.sig.date) { textAt("Signed electronically in " + M.NAME + " on " + M.longDate(inv.sig.date), m, y); y += 10; }
        }
        if (inv.accept) {
          var ax = m + sgw + 16, ay = sy2 + 56; doc.setDrawColor.apply(doc, ink); doc.setLineWidth(0.6); doc.line(ax, ay, ax + sgw, ay);
          font("normal", 8, gray); textAt("Accepted by (customer)", ax, ay + 10); textAt("Date", ax + sgw - 80, ay + 10);
          y = Math.max(y, ay + 14);
        }
        y += 8;
      }

      /* ---------- Fine print ---------- */
      if (adv && inv.fine) { pageBreak(40); y += 4; para(inv.fine, m, cw, 7, gray); }

      /* ---------- Footer on every page ---------- */
      var pages = doc.getNumberOfPages(), i;
      for (i = 1; i <= pages; i++) {
        doc.setPage(i); var fy = H - m - 8;
        doc.setDrawColor.apply(doc, rule); doc.setLineWidth(0.5); doc.line(m, fy - 10, W - m, fy - 10);
        font("normal", 7.2, light);
        var q = c.name ? "Questions? " + [c.phone, c.email].filter(Boolean).join(" or ") : "";
        textAt(q, m, fy);
        var right = (inv.fingerprint ? "Invoice ID " + inv.fingerprint + "   " : "") + (pages > 1 ? "Page " + i + " of " + pages + "   " : "") + "Made with " + M.NAME + ", " + M.SITE;
        textAt(right, W - m, fy, "right");
      }
      doc.setProperties({ title: "Invoice " + inv.num + (c.name ? " from " + c.name : ""), subject: inv.cust.name ? "Invoice for " + inv.cust.name : "Invoice", author: c.name || "", creator: M.NAME + " (" + M.SITE + ")" });
      return { bytes: doc.output("arraybuffer"), pages: pages, name: "invoice-" + M.safeName(inv.num) + ".pdf" };
    });
  };

  root.BHPDF = P;
})(window);
