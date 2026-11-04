/*
 * MTR Processing: Amazon Excel/CSV Upload (AOP-MTR-01), MTR Upload Details (02), MTR Reconciliation (03),
 * MTR Transaction Details (04), Amazon Inventory Header Error (05), Amazon Inventory Item Error (06).
 */
(function () {
  var A = window.APP, D = window.MTRDATA;

  // ---------- the Amazon MTR file format ----------
  A.MTR_HEADERS = ['Seller Gstin', 'Invoice Number', 'Invoice Date', 'Transaction Type', 'Order Id', 'Shipment Id', 'Shipment Date', 'Order Date', 'Shipment Item Id', 'Quantity', 'Item Description', 'Asin', 'Hsn/sac', 'Sku', 'Product Tax Code',
    'Bill From City', 'Bill From State', 'Bill From Country', 'Bill From Postal Code', 'Ship From City', 'Ship From State', 'Ship From Country', 'Ship From Postal Code', 'Ship To City', 'Ship To State', 'Ship To Country', 'Ship To Postal Code',
    'Invoice Amount', 'Tax Exclusive Gross', 'Total Tax Amount', 'Cgst Rate', 'Sgst Rate', 'Utgst Rate', 'Igst Rate', 'Compensatory Cess Rate', 'Principal Amount', 'Principal Amount Basis', 'Cgst Tax', 'Sgst Tax', 'Utgst Tax', 'Igst Tax', 'Compensatory Cess Tax',
    'Shipping Amount', 'Shipping Amount Basis', 'Shipping Cgst Tax', 'Shipping Sgst Tax', 'Shipping Utgst Tax', 'Shipping Igst Tax', 'Shipping Cess Tax Amount', 'Gift Wrap Amount', 'Gift Wrap Amount Basis', 'Gift Wrap Cgst Tax', 'Gift Wrap Sgst Tax', 'Gift Wrap Utgst Tax', 'Gift Wrap Igst Tax', 'Gift Wrap Compensatory Cess Tax',
    'Item Promo Discount', 'Item Promo Discount Basis', 'Item Promo Tax', 'Shipping Promo Discount', 'Shipping Promo Discount Basis', 'Shipping Promo Tax', 'Gift Wrap Promo Discount', 'Gift Wrap Promo Discount Basis', 'Gift Wrap Promo Tax',
    'Tcs Cgst Rate', 'Tcs Cgst Amount', 'Tcs Sgst Rate', 'Tcs Sgst Amount', 'Tcs Utgst Rate', 'Tcs Utgst Amount', 'Tcs Igst Rate', 'Tcs Igst Amount', 'Warehouse Id', 'Fulfillment Channel', 'Payment Method Code', 'Credit Note No', 'Credit Note Date'];
  A.MTR_B2B = ['Customer Bill To Gstid', 'Customer Ship To Gstid', 'Buyer Name'];
  A.MTR_REQUIRED = ['Seller Gstin', 'Invoice Number', 'Invoice Date', 'Transaction Type', 'Order Id', 'Quantity', 'Sku', 'Hsn/sac', 'Ship To State', 'Invoice Amount', 'Tax Exclusive Gross', 'Total Tax Amount'];
  var two = function (n) { return Math.round(n * 100) / 100; };
  A.mtrRows = function (month, report) {
    var head = A.MTR_HEADERS.concat(report === 'B2B' ? A.MTR_B2B : []);
    var rows = [head];
    D.DOCS.filter(function (d) { return d.month === month && d.report === report; }).forEach(function (d) {
      var seller = D.gstin(d.gstin), from = D.state(seller.state), to = D.state(d.inv.shipTo);
      d.lines.forEach(function (l, i) {
        var r = [d.gstin, d.type === 'Refund' || d.type === 'Cancel' ? d.ref : d.key, A.fmtDate(d.type === 'Refund' ? d.inv.invoiceDate || d.date : d.inv.invoiceDate || d.date), d.type, d.inv.orderId, d.inv.shipmentId || '', A.fmtDate(d.date), A.fmtDate(d.inv.orderDate), l.itemId, l.qty, l.desc, l.asin, l.hsn, l.sku, 'A_GEN_STANDARD',
          from.city, from.name.toUpperCase(), 'IN', from.pin, d.fc === 'BHW1' ? 'Bhiwandi' : seller.fcName, from.name.toUpperCase(), 'IN', from.pin, d.inv.city, to.name.toUpperCase(), 'IN', d.inv.pin,
          two(l.amount + (i === 0 && d.mismatch ? d.mismatch : 0)), l.excl, l.tax, l.intra ? l.rate / 200 : 0, l.intra ? l.rate / 200 : 0, 0, l.intra ? 0 : l.rate / 100, 0, l.principal, two(l.principal / (1 + l.rate / 100)), l.cgst, l.sgst, 0, l.igst, 0,
          l.shipping, two(l.shipping / (1 + l.rate / 100)), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          l.promo, two(l.promo / (1 + l.rate / 100)), two(l.promo - l.promo / (1 + l.rate / 100)), 0, 0, 0, 0, 0, 0,
          l.intra ? 0.0025 : 0, l.intra ? two(l.tcs / 2) : 0, l.intra ? 0.0025 : 0, l.intra ? two(l.tcs / 2) : 0, 0, 0, l.intra ? 0 : 0.005, l.intra ? 0 : l.tcs, d.fc, d.inv.channel || 'AFN', d.inv.payment === 'Cash on Delivery' ? 'COD' : 'Prepaid',
          d.type === 'Refund' ? d.key : '', d.type === 'Refund' ? A.fmtDate(d.date) : ''];
        if (report === 'B2B') r.push(d.inv.buyer ? d.inv.buyer.gstin : '', d.inv.buyer ? d.inv.buyer.gstin : '', d.inv.buyer ? d.inv.buyer.name : '');
        rows.push(r);
      });
    });
    return rows;
  };
  var fileName = function (month, report) { return 'MTR_' + report + '-' + D.monthLabel(month).toUpperCase().replace(' ', '-') + '-A1CRESTLINE'; };

  // ---------- Amazon Excel/CSV Upload ----------
  A.def('AOP-MTR-01', function (M, main) {
    var sel = { month: A.param('m') || '2026-10', report: A.param('report') || (M.pending[0] ? M.pending[0].report : 'B2B') };
    var file = null;
    var statusFor = function (m, r) { return M.uploaded(m, r) ? 'Uploaded' : 'Not Uploaded'; };
    var canUp = A.can('mtr.upload');
    main.innerHTML = A.head('Amazon Excel/CSV Upload', '<a class="btn" data-link="AOP-MTR-03">MTR Reconciliation</a>') +
      '<div class="kpis">' +
      A.kpi('Files Uploaded for October 2026', M.uploads.filter(function (u) { return u.month === '2026-10'; }).length + ' of 2', M.pending.length ? A.chip('B2B Due', 'warn') : A.chip('Complete', 'ok')) +
      A.kpi('Rows in Database', A.fmtN(M.uploads.reduce(function (t, u) { return t + u.rows; }, 0)), A.chip(A.plural(M.uploads.length, 'file'), 'plain')) +
      A.kpi('Last Upload', A.fmtDate(M.uploads.slice().sort(function (a, b) { return b.at - a.at; })[0].at), A.chip(A.person(M.uploads.slice().sort(function (a, b) { return b.at - a.at; })[0].by), 'plain')) +
      A.kpi('Next MTR Release', '5 December 2026', A.chip('November 2026', 'plain')) +
      '</div>' +
      '<div class="grid g-main-side" style="--side:24rem">' +
      '<section class="card"><header><h2>Upload MTR File</h2></header><div class="body stack">' +
      '<div class="form-grid">' + A.field('um', 'Month', A.select('um', D.MONTHS.map(function (m) { return { value: m.key, label: m.label }; }), sel.month)) + A.field('ur', 'Report Type', A.select('ur', [{ value: 'B2C', label: 'B2C (consumer orders)' }, { value: 'B2B', label: 'B2B (business orders with GSTIN)' }], sel.report)) + '</div>' +
      '<div id="upbox"></div>' +
      '<div class="inline" style="justify-content:flex-end"><button class="btn" type="button" data-template>' + A.icon('download') + 'Download Template</button><button class="btn pri" type="button" data-go disabled>' + A.icon('upload') + 'Upload and Save</button></div>' +
      '</div></section>' +
      A.card('Reports by Month', '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Month</th><th>Report</th><th>Status</th></tr></thead><tbody>' + D.MONTHS.slice().reverse().map(function (m) { return ['B2C', 'B2B'].map(function (r) { var st = statusFor(m.key, r); return '<tr><td>' + m.label + '</td><td>' + r + '</td><td>' + A.chip(st, st === 'Uploaded' ? 'ok' : 'warn') + '</td></tr>'; }).join(''); }).join('') + '</tbody></table></div>', { flush: true }) +
      '</div>' +
      '<section class="card flush list" id="hist"></section>';
    var go = A.q('[data-go]', main);
    var sync = function () { sel.month = A.q('#um', main).value; sel.report = A.q('#ur', main).value; go.disabled = !file || !canUp; };
    A.q('#um', main).addEventListener('change', function () { sync(); up.clear(); file = null; sync(); });
    A.q('#ur', main).addEventListener('change', function () { sync(); up.clear(); file = null; sync(); });
    var up = A.uploader(A.q('#upbox', main), {
      required: A.MTR_REQUIRED,
      disabled: function () { return canUp ? '' : 'Uploading the MTR is not allowed for your role'; },
      sample: function () {
        sync();
        return { name: fileName(sel.month, sel.report) + '.csv', rows: A.mtrRows(sel.month, sel.report) };
      },
      check: function (f) {
        sync();
        var hasB2B = f.headers.map(function (h) { return h.toLowerCase(); }).indexOf('buyer name') >= 0;
        if (sel.report === 'B2C' && hasB2B) return { title: 'This is a B2B report (it has Buyer Name and Customer GSTIN columns); choose Report Type B2B' };
        if (sel.report === 'B2B' && !hasB2B) return { title: 'This is a B2C report: Buyer Name and Customer Bill To Gstid are missing; choose Report Type B2C' };
        var m = D.MONTHS.filter(function (x) { return x.key === sel.month; })[0];
        var out = f.objects.filter(function (o) { var p = String(o['invoice date'] || '').split('/'); return p.length === 3 && !(+p[1] === m.m && +p[2] === m.y) && o['transaction type'] === 'Shipment'; }).length;
        if (out) return { title: out + ' shipment rows are dated outside ' + m.label, items: ['Check that the file is the ' + m.label + ' MTR'] };
        var badType = f.objects.filter(function (o) { return ['Shipment', 'Refund', 'Cancel', 'FreeReplacement'].indexOf(o['transaction type']) < 0; }).length;
        if (badType) return { title: badType + ' rows have an unknown Transaction Type', items: ['Allowed: Shipment, Refund, Cancel, FreeReplacement'] };
        return null;
      },
      onReady: function (f) { file = f; sync(); },
      onClear: function () { file = null; sync(); }
    });
    A.q('[data-template]', main).addEventListener('click', function () {
      sync();
      A.xlsx('MTR_' + sel.report + '_Template.xlsx', 'MTR ' + sel.report, [A.MTR_HEADERS.concat(sel.report === 'B2B' ? A.MTR_B2B : [])]);
      A.toast('Template downloaded with ' + (A.MTR_HEADERS.length + (sel.report === 'B2B' ? 3 : 0)) + ' columns');
    });
    go.addEventListener('click', function () {
      if (!A.need('mtr.upload') || !file) return;
      sync();
      var ex = M.uploads.filter(function (u) { return u.month === sel.month && u.report === sel.report; })[0];
      if (ex) {
        A.dialog({ title: 'Already Uploaded', ok: 'Open Upload Details', body: '<p>The ' + D.monthLabel(sel.month) + ' ' + sel.report + ' MTR was uploaded on ' + A.fmtDT(ex.at) + ' by ' + A.esc(A.person(ex.by)) + ' and its documents are already in reconciliation. Replacing it is blocked.</p>', onOk: function () { A.go('AOP-MTR-02', 'id=' + ex.id); } });
        return;
      }
      var pend = M.pending.filter(function (p) { return p.month === sel.month && p.report === sel.report; })[0];
      var dupes = file.objects.filter(function (o) { return o['transaction type'] === 'Shipment' && M.docs.some(function (d) { return d.type === 'Shipment' && d.key === o['invoice number'] && d.report !== sel.report; }); }).length;
      A.progress('Uploading ' + file.name, ['Reading ' + A.plural(file.rows.length - 1, 'row'), 'Checking ' + file.headers.length + ' columns', 'Checking periods and Seller GSTINs', 'Checking duplicate invoice numbers', 'Saving rows to the database'], function () {
        var id = pend ? pend.id : 'UPL-' + sel.month.slice(2).replace('-', '') + '-' + sel.report;
        (A.state.up = A.state.up || []).push([id, A.now(), A.role, file.name, file.size]);
        A.log('MTR Uploaded', id, D.monthLabel(sel.month) + ' ' + sel.report + ', ' + A.fmtN(file.rows.length - 1) + ' rows');
        A.notify('ok', D.monthLabel(sel.month) + ' ' + sel.report + ' MTR saved', A.fmtN(file.rows.length - 1) + ' rows saved from ' + file.name, 'AOP-MTR-02', 'id=' + id);
        A.save();
        A.refreshModel();
        var docs = A.M.docs.filter(function (d) { return d.month === sel.month && d.report === sel.report; });
        var cnt = {}; docs.forEach(function (d) { cnt[d.type] = (cnt[d.type] || 0) + 1; });
        var newCust = A.M.missingCustomers.filter(function (m) { return m.kind === sel.report && m.status === 'Missing'; }).length;
        A.dialog({ title: 'MTR Saved', ok: 'Run Reconciliation', cancel: 'Close', wide: false,
          body: '<div class="stats four"><div><span>Rows Saved</span><b>' + A.fmtN(file.rows.length - 1) + '</b></div><div><span>Documents</span><b>' + A.fmtN(docs.length) + '</b></div><div><span>Duplicate Rows</span><b>' + dupes + '</b></div><div><span>New Customers</span><b>' + newCust + '</b></div></div>' +
            A.kv(Object.keys(cnt).map(function (k) { return [A.typeLabel(k), A.fmtN(cnt[k])]; }).concat([['File', A.esc(file.name)], ['Upload ID', '<span class="mono">' + id + '</span>']])),
          extra: [{ label: 'Open Upload Details', fn: function () { A.go('AOP-MTR-02', 'id=' + id); } }],
          onOk: function () { A.go('AOP-MTR-03', 'm=' + sel.month + '&run=1'); } });
        A.rerender();
      });
    });
    A.table(A.q('#hist', main), {
      id: 'uploads', title: 'Upload History', noun: 'uploads', rows: M.uploads.slice().sort(function (a, b) { return b.at - a.at; }), key: function (u) { return u.id; }, exportName: 'MTR_Upload_History',
      search: { ph: 'Search by upload ID or file name' },
      filters: [{ label: 'Report', get: function (u) { return u.report; } }, { label: 'Month', get: function (u) { return D.monthLabel(u.month); } }],
      rowCls: function (u) { return u.fresh ? 'row-fresh' : ''; },
      cols: [
        { h: 'Upload ID', v: function (u) { return u.id; }, f: function (u) { return A.a('AOP-MTR-02', '<b>' + u.id + '</b>', 'id=' + u.id); }, cls: 'nowrap' },
        { h: 'Month', v: function (u) { return u.month; }, x: function (u) { return D.monthLabel(u.month); }, f: function (u) { return D.monthLabel(u.month); } },
        { h: 'Report', v: function (u) { return u.report; } },
        { h: 'File', v: function (u) { return u.file; }, cls: 'brk' },
        { h: 'Format', v: function (u) { return u.format; } },
        { h: 'Size', v: function (u) { return u.size; }, x: function (u) { return A.fmtSize(u.size); }, f: function (u) { return A.fmtSize(u.size); }, num: true },
        { h: 'Rows', v: function (u) { return u.rows; }, f: function (u) { return A.fmtN(u.rows); }, num: true },
        { h: 'Uploaded By', v: function (u) { return A.person(u.by); } },
        { h: 'Uploaded', v: function (u) { return u.at; }, x: function (u) { return A.fmtDT(u.at); }, f: function (u) { return '<span class="nowrap">' + A.fmtDT(u.at) + '</span>'; } },
        { h: 'Status', v: function () { return 'Saved'; }, f: function () { return A.chip('Saved'); } }
      ]
    });
  });

  // ---------- MTR Upload Details ----------
  A.def('AOP-MTR-02', function (M, main) {
    var u = M.upload(A.param('id')) || M.uploads[M.uploads.length - 1];
    var docs = M.docs.filter(function (d) { return d.month === u.month && d.report === u.report; });
    var lines = [];
    docs.forEach(function (d) { d.lines.forEach(function (l, i) { lines.push({ d: d, l: l, id: d.id + '#' + i }); }); });
    var sales = docs.filter(function (d) { return d.type === 'Shipment'; }).reduce(function (t, d) { return t + d.amount; }, 0);
    var refunds = docs.filter(function (d) { return d.type === 'Refund'; }).reduce(function (t, d) { return t - d.amount; }, 0);
    var gst = {};
    docs.forEach(function (d) { var k = d.gstin; gst[k] = gst[k] || { Shipment: 0, Refund: 0, Cancel: 0, FreeReplacement: 0, amt: 0 }; gst[k][d.type]++; gst[k].amt += d.amount; });
    var newG = Object.keys(gst).filter(function (g) { return !D.gstin(g).base; });
    main.innerHTML = A.head(u.file, A.btn('Download File', 'data-dl', '', 'download') + '<a class="btn pri" data-link="AOP-MTR-03" data-q="m=' + u.month + '">MTR Reconciliation</a>', A.chip('Saved') + A.chip(u.report, 'blue')) +
      '<div class="kpis">' + A.kpi('Rows Saved', A.fmtN(u.rows), A.chip(A.plural(docs.length, 'document'), 'plain')) + A.kpi('Sales', A.fmtML(sales), A.chip(A.plural(docs.filter(function (d) { return d.type === 'Shipment'; }).length, 'invoice'), 'plain')) +
      A.kpi('Refunds', A.fmtML(refunds), A.chip(A.plural(docs.filter(function (d) { return d.type === 'Refund'; }).length, 'credit note'), 'plain')) + A.kpi('Seller GSTINs', Object.keys(gst).length, newG.length ? A.chip(newG.length + ' not set up', 'bad') : A.chip('All Set Up', 'ok')) + '</div>' +
      '<div class="grid g-main-side" style="--side:24rem">' +
      A.card('Documents by Seller GSTIN', '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Seller GSTIN</th><th>Centre</th><th class="num">Shipment</th><th class="num">Refund</th><th class="num">Cancel</th><th class="num">Free Replacement</th><th class="num">Net Amount</th></tr></thead><tbody>' +
        Object.keys(gst).sort().map(function (g) { var x = gst[g]; return '<tr><td class="mono nowrap">' + g + '</td><td>' + (A.M.gstin(g) || {}).fc + '</td><td class="num">' + x.Shipment + '</td><td class="num">' + x.Refund + '</td><td class="num">' + x.Cancel + '</td><td class="num">' + x.FreeReplacement + '</td><td class="num"><b>' + A.fmtM2(x.amt) + '</b></td></tr>'; }).join('') +
        '</tbody></table></div>', { flush: true }) +
      A.card('Upload', A.kv([['Upload ID', '<span class="mono">' + u.id + '</span>'], ['Month', D.monthLabel(u.month)], ['Report', u.report], ['Format', u.format], ['Size', A.fmtSize(u.size)], ['Uploaded By', A.esc(A.person(u.by))], ['Uploaded', A.fmtDT(u.at)]])) +
      '</div>' +
      A.card('Checks at Upload', '<ul class="checks">' + [
        ['All ' + (A.MTR_HEADERS.length + (u.report === 'B2B' ? 3 : 0)) + ' columns present', 'ok', A.chip('Pass')],
        ['Every row dated in ' + D.monthLabel(u.month), 'ok', A.chip('Pass')],
        ['Transaction types recognised', 'ok', A.chip('4 types', 'ok')],
        ['Duplicate rows in the file', 'ok', A.chip('None', 'ok')],
        ['Seller GSTINs set up in the portal', newG.length ? 'warn' : 'ok', newG.length ? A.chip(newG.join(', ') + ' not set up', 'warn') : A.chip('Pass')]
      ].map(function (c) { return '<li><span class="ci ' + c[1] + '">' + A.icon(c[1] === 'ok' ? 'check' : 'warn') + '</span><b>' + A.esc(c[0]) + '</b><span class="r">' + c[2] + '</span></li>'; }).join('') + '</ul>') +
      '<section class="card flush list" id="rows"></section>';
    A.q('[data-dl]', main).addEventListener('click', function () {
      var rows = A.mtrRows(u.month, u.report);
      if (u.format === 'Excel') A.xlsx(u.file.replace(/\.\w+$/, '') + '.xlsx', 'MTR ' + u.report, rows); else A.download(u.file.replace(/\.\w+$/, '') + '.csv', A.csvBlob(rows));
      A.toast(A.plural(rows.length - 1, 'row') + ' downloaded');
    });
    A.table(A.q('#rows', main), {
      id: 'uprows', title: 'Rows Saved', noun: 'rows', rows: lines, key: function (r) { return r.id; }, exportName: u.id + '_Rows', page: 20,
      search: { ph: 'Search by invoice number, order ID or SKU', text: function (r) { return r.d.key + ' ' + r.d.inv.orderId + ' ' + r.l.sku + ' ' + (r.d.ref || ''); } },
      filters: [{ label: 'Transaction Type', get: function (r) { return A.typeLabel(r.d.type); } }, { label: 'Seller GSTIN', get: function (r) { return r.d.gstin; } }],
      cols: [
        { h: 'Document', v: function (r) { return r.d.key; }, f: function (r) { return A.docLink(r.d); }, cls: 'nowrap' },
        { h: 'Transaction Type', v: function (r) { return A.typeLabel(r.d.type); } },
        { h: 'Date', v: function (r) { return r.d.date; }, x: function (r) { return A.fmtDate(r.d.date); }, f: function (r) { return A.fmtDate(r.d.date); } },
        { h: 'Order ID', v: function (r) { return r.d.inv.orderId; }, cls: 'mono nowrap' },
        { h: 'SKU', v: function (r) { return r.l.sku; }, cls: 'mono nowrap' },
        { h: 'Quantity', v: function (r) { return r.l.qty; }, num: true },
        { h: 'Ship To State', v: function (r) { return D.state(r.d.inv.shipTo).name; } },
        { h: 'Invoice Amount', v: function (r) { return r.l.amount; }, f: function (r) { return A.fmtM2(r.l.amount); }, num: true }
      ]
    });
  });

  // ---------- reconciliation helpers ----------
  A.docResult = function (M, d) {
    if (M.excluded(d)) return 'Excluded';
    if (M.netZero(d)) return 'Cancelled in Same Month';
    var o = M.openErrors(d);
    if (o.length) return o.length > 1 ? o.length + ' Errors' : o[0].type;
    return 'Matched';
  };
  A.resultCls = function (t) { return t === 'Matched' ? 'ok' : t === 'Excluded' || t === 'Cancelled in Same Month' ? 'plain' : 'bad'; };

  // ---------- MTR Reconciliation ----------
  A.def('AOP-MTR-03', function (M, main) {
    var f = { y: '2026', m: A.month, g: A.param('g') || 'All', t: A.param('t') || 'All' };
    var docs = M.docs.filter(function (d) { return d.month === f.m && (f.g === 'All' || d.gstin === f.g) && (f.t === 'All' || A.typeLabel(d.type) === f.t); });
    var inDocs = {}; docs.forEach(function (d) { inDocs[d.id] = 1; });
    var hE = M.headerErrors.filter(function (e) { return inDocs[e.doc.id]; }), iE = M.itemErrors.filter(function (e) { return inDocs[e.doc.id]; });
    var open = function (list, how) { return list.filter(function (e) { return e.status === 'Open' && (!how || e.how === how); }).length; };
    var mtrAmt = docs.reduce(function (t, d) { return t + d.amount; }, 0), calc = docs.reduce(function (t, d) { return t + d.calc; }, 0);
    var diffDocs = docs.filter(function (d) { return Math.abs(d.amount - d.calc) > 0.005; });
    var run = M.lastRun(f.m);
    var lineCount = docs.reduce(function (t, d) { return t + d.lines.length; }, 0);
    var fq = 'm=' + f.m + (f.g !== 'All' ? '&gstin=' + f.g : '');
    var checks = [
      ['Seller GSTIN available and set up', open(hE, 'gstin'), 'documents', 'AOP-MTR-05', 'type=Seller GSTIN Not Configured&' + fq],
      ['Transaction amounts match', open(hE, 'amount'), 'documents', 'AOP-MTR-05', 'type=Invoice Amount Mismatch&' + fq],
      ['Transaction types recognised', 0, 'documents'],
      ['Customer details available', open(hE, 'customer'), 'documents', 'AOP-MAP-02', ''],
      ['Item mappings exist', open(iE, 'sku'), 'lines', 'AOP-MAP-01', ''],
      ['HSN codes and tax rates match the items', open(iE, 'hsn') + open(iE, 'rate'), 'lines', 'AOP-MTR-06', fq],
      ['Items active in Business Central', open(iE, 'blocked'), 'lines', 'AOP-MTR-06', 'type=Item Blocked in Business Central&' + fq],
      ['No duplicate invoice numbers', open(hE, 'duplicate'), 'documents', 'AOP-MTR-05', 'type=Duplicate Invoice Number&' + fq],
      ['Refunds linked to an original invoice', open(hE, 'orphan'), 'documents', 'AOP-MTR-05', 'type=Refund Without Original Invoice&' + fq]
    ];
    var failed = checks.filter(function (c) { return c[1]; }).length;
    // summary by Seller GSTIN and transaction type
    var sum = {};
    docs.forEach(function (d) {
      var k = d.gstin + '|' + d.type;
      var s = sum[k] = sum[k] || { g: d.gstin, t: d.type, n: 0, lines: 0, excl: 0, tax: 0, amt: 0, calc: 0, err: 0 };
      s.n++; s.lines += d.lines.length; s.excl += d.excl; s.tax += d.tax; s.amt += d.amount; s.calc += d.calc; if (M.openErrors(d).length) s.err++;
    });
    var order = ['Shipment', 'FreeReplacement', 'Refund', 'Cancel'];
    var srows = Object.keys(sum).map(function (k) { return sum[k]; }).sort(function (a, b) { return a.g < b.g ? -1 : a.g > b.g ? 1 : order.indexOf(a.t) - order.indexOf(b.t); });
    main.innerHTML = A.head('MTR Reconciliation', (A.can('mtr.reconcile') ? A.btn('Run Reconciliation', 'data-run', 'pri', 'play') : ''), run ? A.chip('Last run ' + A.fmtDT(run.at) + ' by ' + A.person(run.by), 'plain') : A.chip('Not Run', 'warn')) +
      '<section class="card"><div class="body"><div class="filters" style="padding:0">' +
      A.pick('y', 'Year', f.y) + A.pick('m', 'Month', D.monthLabel(f.m)) + A.pick('g', 'Seller GSTIN', f.g === 'All' ? 'All' : A.gstLabel(f.g)) + A.pick('t', 'Transaction Type', f.t) +
      '<span class="grow"></span>' + (f.g !== 'All' || f.t !== 'All' ? A.btn('Clear Filters', 'data-clear') : '') + '</div></div></section>' +
      '<div class="kpis">' +
      A.kpi('Documents Reconciled', A.fmtN(docs.length), A.chip(A.plural(lineCount, 'line'), 'plain')) +
      A.kpi('MTR Invoice Amount', A.fmtML(mtrAmt), A.chip('Net of refunds and cancellations', 'plain')) +
      A.kpi('Calculated Amount', A.fmtML(calc), A.chip('Tax exclusive plus tax', 'plain')) +
      A.kpi('Difference', A.fmtM2(mtrAmt - calc), diffDocs.length ? A.chip(A.plural(diffDocs.length, 'document'), 'bad') : A.chip('None', 'ok'), 'AOP-MTR-05', 'type=Invoice Amount Mismatch&' + fq) +
      '</div>' +
      '<div class="grid g-2">' +
      A.card('Checks', '<ul class="checks">' + checks.map(function (c) {
        var ok = !c[1];
        return '<li><span class="ci ' + (ok ? 'ok' : 'bad') + '">' + A.icon(ok ? 'check' : 'x') + '</span><b>' + A.esc(c[0]) + '</b><span class="r">' + (ok ? A.chip('Pass') : (c[3] && A.canOpen(c[3]) ? A.a(c[3], A.chip(A.plural(c[1], c[2] === 'lines' ? 'line' : 'document'), 'bad'), c[4]) : A.chip(A.plural(c[1], c[2] === 'lines' ? 'line' : 'document'), 'bad'))) + '</span></li>';
      }).join('') + '</ul>', { more: failed ? A.chip(failed + ' of ' + checks.length + ' failed', 'bad') : A.chip('All Passed', 'ok') }) +
      A.card('Reconciliation Runs', '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Month</th><th>Run</th><th>By</th><th>Filters</th></tr></thead><tbody>' + M.reconRuns.slice(0, 9).map(function (r) { return '<tr><td>' + D.monthLabel(r.month) + '</td><td class="nowrap">' + A.fmtDT(r.at) + '</td><td>' + A.esc(A.person(r.by)) + '</td><td>' + A.esc(r.filters || 'All Seller GSTINs, all transaction types') + '</td></tr>'; }).join('') + '</tbody></table></div>', { flush: true }) +
      '</div>' +
      A.card('Summary by Seller GSTIN and Transaction Type', '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Seller GSTIN</th><th>Transaction Type</th><th class="num">Documents</th><th class="num">Tax Exclusive</th><th class="num">Tax</th><th class="num">MTR Amount</th><th class="num">Difference</th><th>Status</th></tr></thead><tbody>' +
        (srows.length ? srows.map(function (s) { var df = Math.round((s.amt - s.calc) * 100) / 100; var gs = A.M.gstin(s.g); return '<tr><td class="mono nowrap">' + s.g + '</td><td>' + A.typeLabel(s.t) + '</td><td class="num">' + A.fmtN(s.n) + '</td><td class="num">' + A.fmtM2(s.excl) + '</td><td class="num">' + A.fmtM2(s.tax) + '</td><td class="num"><b>' + A.fmtM2(s.amt) + '</b></td><td class="num' + (Math.abs(df) > 0.005 ? ' neg' : '') + '">' + A.fmtM2(df) + '</td><td>' + (!gs.configured ? A.chip('GSTIN Not Set Up', 'bad') : s.err ? A.chip(s.err + ' with errors', 'bad') : A.chip('Reconciled')) + '</td></tr>'; }).join('') : '<tr class="empty-row"><td colspan="8">No documents for these filters</td></tr>') +
        '</tbody>' + (srows.length ? '<tfoot><tr><td colspan="2">Total</td><td class="num">' + A.fmtN(docs.length) + '</td><td class="num">' + A.fmtM2(srows.reduce(function (t, s) { return t + s.excl; }, 0)) + '</td><td class="num">' + A.fmtM2(srows.reduce(function (t, s) { return t + s.tax; }, 0)) + '</td><td class="num">' + A.fmtM2(mtrAmt) + '</td><td class="num">' + A.fmtM2(mtrAmt - calc) + '</td><td></td></tr></tfoot>' : '') + '</table></div>', { flush: true }) +
      '<section class="card flush list" id="docs"></section>';
    var reload = function (k, v) { var q = { m: f.m, g: f.g, t: f.t }; q[k] = v; location.href = A.link(A.screen, 'm=' + q.m + (q.g !== 'All' ? '&g=' + q.g : '') + (q.t !== 'All' ? '&t=' + encodeURIComponent(q.t) : '')); };
    A.onPick(main, 'y', [{ label: '2026', value: '2026', hint: '2 months' }], '2026', function () { A.toast('2026 is the only year with uploaded MTR data', 'warn'); });
    A.onPick(main, 'm', D.MONTHS.slice().reverse().map(function (m) { return { label: m.label, value: m.key }; }), f.m, function (it) { reload('m', it.value); });
    A.onPick(main, 'g', [{ label: 'All', value: 'All' }].concat(M.gstins.map(function (g) { return { label: g.gstin, value: g.gstin, hint: g.fc + (g.configured ? '' : ' · not set up') }; })), f.g, function (it) { reload('g', it.value); });
    A.onPick(main, 't', ['All', 'Shipment', 'Refund', 'Cancel', 'Free Replacement'].map(function (t) { return { label: t, value: t }; }), f.t, function (it) { reload('t', it.value); });
    var cl = A.q('[data-clear]', main); if (cl) cl.addEventListener('click', function () { location.href = A.link(A.screen, 'm=' + f.m); });
    var doRun = function () {
      if (!A.need('mtr.reconcile')) return;
      A.progress('Reconciling ' + D.monthLabel(f.m), ['Loading ' + A.plural(docs.length, 'document'), 'Checking Seller GSTINs and transaction types', 'Recalculating tax-exclusive values and tax', 'Checking customers and item mappings', 'Writing header and item errors'], function () {
        var filt = (f.g === 'All' ? 'All Seller GSTINs' : f.g) + ', ' + (f.t === 'All' ? 'all transaction types' : f.t);
        (A.state.rr = A.state.rr || []).push([f.m, A.now(), A.role, filt]);
        A.log('Reconciliation Run', D.monthLabel(f.m), filt);
        var oh = open(hE), oi = open(iE);
        if (oh + oi) A.notify('warn', 'Reconciliation found errors in ' + D.monthLabel(f.m), oh + ' header errors and ' + oi + ' item errors are open', 'AOP-MTR-05', 'm=' + f.m, 'ADM OPS FIN');
        A.commit('Reconciliation complete: ' + A.plural(docs.length, 'document') + ', ' + (oh + oi ? (oh + oi) + ' open errors' : 'no open errors'), oh + oi ? 'warn' : 'ok');
      });
    };
    var rb = A.q('[data-run]', main); if (rb) rb.addEventListener('click', doRun);
    if (A.param('run') === '1' && !A.ranOnce) { A.ranOnce = true; var u = new URL(location.href); u.searchParams.delete('run'); try { history.replaceState(null, '', u.toString()); } catch (e) { /* ignore */ } A.params.delete('run'); setTimeout(doRun, 200); }
    A.table(A.q('#docs', main), {
      id: 'recdocs', title: 'Documents', noun: 'documents', rows: docs, key: function (d) { return d.id; }, exportName: 'MTR_Reconciliation_' + D.monthLabel(f.m).replace(' ', '_'), page: 15,
      tabs: [{ label: 'All Documents' }, { label: 'With Errors', test: function (d) { return M.openErrors(d).length > 0; } }, { label: 'Matched', test: function (d) { return A.docResult(M, d) === 'Matched'; } }, { label: 'Excluded', test: function (d) { return M.excluded(d) || M.netZero(d); } }],
      search: { ph: 'Search by document, order ID or SKU', text: function (d) { return d.key + ' ' + d.inv.orderId + ' ' + d.lines.map(function (l) { return l.sku; }).join(' '); } },
      filters: [{ label: 'Seller GSTIN', get: function (d) { return d.gstin; } }, { label: 'Result', get: function (d) { return A.docResult(M, d); } }],
      cols: [
        { h: 'Document', v: function (d) { return d.type === 'Cancel' ? d.ref : d.key; }, f: function (d) { return A.docLink(d); }, cls: 'nowrap' },
        { h: 'Transaction Type', v: function (d) { return A.typeLabel(d.type); } },
        { h: 'Date', v: function (d) { return d.date; }, x: function (d) { return A.fmtDate(d.date); }, f: function (d) { return A.fmtDate(d.date); } },
        { h: 'Ship To State', v: function (d) { return D.state(d.inv.shipTo).name; } },
        { h: 'MTR Amount', v: function (d) { return d.amount; }, f: function (d) { return A.fmtM2(d.amount); }, num: true },
        { h: 'Calculated', v: function (d) { return d.calc; }, f: function (d) { return A.fmtM2(d.calc); }, num: true },
        { h: 'Difference', v: function (d) { return Math.round((d.amount - d.calc) * 100) / 100; }, f: function (d) { var x = d.amount - d.calc; return '<span class="' + (Math.abs(x) > 0.005 ? 'neg' : '') + '">' + A.fmtM2(x) + '</span>'; }, num: true },
        { h: 'Result', v: function (d) { return A.docResult(M, d); }, f: function (d) { var r = A.docResult(M, d); return A.chip(r, A.resultCls(r)); } }
      ]
    });
  });

  // ---------- MTR Transaction Details ----------
  A.def('AOP-MTR-04', function (M, main) {
    var d = M.doc(A.param('id')) || M.docs.filter(function (x) { return x.month === '2026-10' && M.openErrors(x).length; })[0];
    var errs = M.docErrors(d);
    var stage = M.stage(d);
    var seller = M.gstin(d.gstin);
    var to = D.state(d.inv.shipTo);
    var cust = M.custMap[d.custKey];
    var isCM = d.type === 'Refund';
    var so = isCM ? M.cmNo(d) : M.soNo(d), posted = isCM ? M.pcmNo(d) : M.siNo(d);
    var related = M.docs.filter(function (x) { return x !== d && (x.ref === d.key || d.ref === x.key || (x.inv.orderId === d.inv.orderId && x.type !== 'Cancel')); });
    var bpB = M.bcLatest(isCM ? 'BCM' : 'BP', d.month), bpRow = bpB ? M.bcRows(bpB).filter(function (r) { return r.key === d.key; })[0] : null;
    var apB = M.bcLatest(isCM ? 'ACM' : 'AP', d.month), apRow = apB ? M.bcRows(apB).filter(function (r) { return r.key === d.key; })[0] : null;
    var cr = d.type === 'Cancel' ? M.cancelFor(d.ref) : null;
    var steps;
    if (d.type === 'Cancel') {
      steps = [['MTR Uploaded', A.fmtDate(M.uploads.filter(function (u) { return u.month === d.month && u.report === d.report; })[0].at), 'done'], ['Original Invoice Posted', (M.postedInvoiceFor(d.ref) || {}).no || 'Same month', M.netZero(d) ? 'todo' : 'done'], ['Cancellation Requested', cr ? cr.id : 'Not requested', cr ? 'done' : M.netZero(d) ? 'todo' : 'now'], ['Cancelled in Business Central', cr ? cr.status : '', cr && cr.status === 'Cancelled' ? 'done' : cr ? 'now' : 'todo']];
    } else {
      var created = !!so, rec = bpRow && /^(Matched|Difference Accepted)/.test(bpRow.status), pst = !!posted, ver = apRow && /^Posted and Matched|Posted, Difference/.test(apRow.status);
      steps = [['MTR Uploaded', A.fmtDate(M.uploads.filter(function (u) { return u.month === d.month && u.report === d.report; })[0].at), 'done'], ['Validated', errs.filter(function (e) { return e.status === 'Open'; }).length ? 'Errors open' : 'No open errors', M.openErrors(d).length ? 'now' : 'done'],
        [isCM ? 'Credit Memo Created' : 'Sales Order Created', so || '', created ? 'done' : !M.openErrors(d).length ? 'now' : 'todo'], ['Reconciled Before Posting', bpRow ? bpRow.status : '', rec ? 'done' : created ? 'now' : 'todo'], ['Posted', posted || '', pst ? 'done' : rec ? 'now' : 'todo'], ['Verified After Posting', apRow ? apRow.status : '', ver ? 'done' : pst ? 'now' : 'todo']];
    }
    var checks = [
      ['Seller GSTIN set up', seller.configured],
      ['Customer mapped', !!cust],
      ['Amount matches tax-exclusive value plus tax', Math.abs(d.amount - d.calc) < 0.005 || errs.some(function (e) { return e.how === 'amount' && e.status !== 'Open'; })],
      ['Every SKU mapped', d.lines.every(function (l) { return M.listing(l.sku).item; })],
      ['HSN codes and tax rates match', !errs.some(function (e) { return (e.how === 'hsn' || e.how === 'rate') && e.status === 'Open'; })],
      ['Invoice number unique', !errs.some(function (e) { return e.how === 'duplicate' && e.status === 'Open'; })]
    ];
    main.innerHTML = A.head(d.key, A.btn('Download Lines', 'data-dl', '', 'download') + (M.openErrors(d).length ? '<a class="btn pri" data-link="' + (errs.some(function (e) { return e.line && e.status === 'Open'; }) ? 'AOP-MTR-06' : 'AOP-MTR-05') + '" data-q="q=' + encodeURIComponent(d.key) + '&m=' + d.month + '">Resolve Errors</a>' : ''), A.chip(A.typeLabel(d.type), 'blue') + A.chip(stage)) +
      '<div class="kpis">' + A.kpi('Invoice Amount', A.fmtM2(d.amount), A.chip(d.lines.length + (d.lines.length === 1 ? ' line' : ' lines'), 'plain')) + A.kpi('Tax Exclusive Value', A.fmtM2(d.excl), A.chip(d.lines[0].intra ? 'CGST and SGST' : 'IGST', 'plain')) + A.kpi('Tax', A.fmtM2(d.tax), A.chip(d.lines[0].rate + '% GST', 'plain')) + A.kpi('Open Errors', M.openErrors(d).length, M.openErrors(d).length ? A.chip('Needs Action', 'bad') : A.chip('None', 'ok')) + '</div>' +
      A.card('Business Central Progress', '<ol class="track">' + steps.map(function (s) { return '<li class="' + s[2] + '"><i></i><b>' + A.esc(s[0]) + '</b><span>' + A.esc(s[1] || '—') + '</span></li>'; }).join('') + '</ol>') +
      '<div class="grid g-2">' +
      A.card('Document', A.kv([['Document Number', '<span class="mono">' + A.esc(d.key) + '</span>'], ['Transaction Type', A.typeLabel(d.type)], ['Date', A.fmtDate(d.date)], d.ref ? ['Original Invoice', (M.docs.some(function (x) { return x.key === d.ref && x.type === 'Shipment'; }) ? A.a('AOP-MTR-04', '<span class="mono">' + A.esc(d.ref) + '</span>', 'id=' + encodeURIComponent(d.ref)) : '<span class="mono">' + A.esc(d.ref) + '</span>')] : null,
        ['Order ID', '<span class="mono">' + A.esc(d.inv.orderId) + '</span>'], ['Order Date', A.fmtDate(d.inv.orderDate)], ['Fulfilment Channel', d.inv.channel === 'MFN' ? 'Seller Fulfilled (MFN)' : 'Fulfilled by Amazon (AFN)'], ['Payment Method', A.esc(d.inv.payment)], ['Report', d.report]])) +
      A.card('Seller and Customer', A.kv([['Seller GSTIN', '<span class="mono">' + d.gstin + '</span> ' + (seller.configured ? '' : A.chip('Not Set Up', 'bad'))], ['Fulfilment Centre', d.fc + ' · ' + (d.fc === 'BHW1' ? D.MFN.fcName : seller.fcName)], ['Business Central Location', seller.configured ? (d.fc === 'BHW1' ? D.MFN.location : seller.location) : '—'], ['Ship To', A.esc(d.inv.city + ', ' + to.name + ' ' + d.inv.pin)],
        d.inv.buyer ? ['Buyer', A.esc(d.inv.buyer.name)] : null, d.inv.buyer ? ['Buyer GSTIN', '<span class="mono">' + d.inv.buyer.gstin + '</span>'] : null, ['Customer', A.esc(D.custLabel(d.custKey))], ['Business Central Customer', cust ? '<span class="mono">' + cust + '</span>' : A.chip('Not Mapped', 'bad')]])) +
      '</div>' +
      A.card('Lines', '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>SKU</th><th>ASIN</th><th>Business Central Item</th><th>HSN</th><th class="num">Quantity</th><th class="num">Tax Exclusive</th><th class="num">GST Rate</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">IGST</th><th class="num">Amount</th></tr></thead><tbody>' +
        d.lines.map(function (l) { var L = M.listing(l.sku); return '<tr><td class="mono nowrap"><b>' + A.esc(l.sku) + '</b></td><td class="mono">' + l.asin + '</td><td>' + (L.item ? '<span class="mono">' + L.item + '</span>' + (L.factor > 1 ? ' ' + A.chip('× ' + L.factor, 'plain') : '') : A.chip('Not Mapped', 'bad')) + '</td><td>' + l.hsn + '</td><td class="num">' + l.qty + '</td><td class="num">' + A.fmtM2(l.excl) + '</td><td class="num">' + l.rate + '%</td><td class="num">' + A.fmtM2(l.cgst) + '</td><td class="num">' + A.fmtM2(l.sgst) + '</td><td class="num">' + A.fmtM2(l.igst) + '</td><td class="num"><b>' + A.fmtM2(l.amount) + '</b></td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td colspan="4">Total</td><td class="num">' + d.qty + '</td><td class="num">' + A.fmtM2(d.excl) + '</td><td></td><td class="num">' + A.fmtM2(d.lines.reduce(function (t, l) { return t + l.cgst; }, 0)) + '</td><td class="num">' + A.fmtM2(d.lines.reduce(function (t, l) { return t + l.sgst; }, 0)) + '</td><td class="num">' + A.fmtM2(d.lines.reduce(function (t, l) { return t + l.igst; }, 0)) + '</td><td class="num">' + A.fmtM2(d.amount) + '</td></tr></tfoot></table></div>', { flush: true }) +
      '<div class="grid g-2">' +
      A.card('Checks', '<ul class="checks">' + checks.map(function (c) { return '<li><span class="ci ' + (c[1] ? 'ok' : 'bad') + '">' + A.icon(c[1] ? 'check' : 'x') + '</span><b>' + A.esc(c[0]) + '</b><span class="r">' + A.chip(c[1] ? 'Pass' : 'Fail') + '</span></li>'; }).join('') + '</ul>') +
      A.card('Errors', errs.length ? '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Error ID</th><th>Error</th><th>Status</th></tr></thead><tbody>' + errs.map(function (e) { return '<tr><td class="mono nowrap">' + A.a(e.line ? 'AOP-MTR-06' : 'AOP-MTR-05', '<b>' + e.id + '</b>', 'q=' + e.id + '&m=' + e.month + '&tab=All Errors') + '</td><td>' + A.esc(e.type) + '</td><td>' + A.chip(e.status, e.status === 'Open' ? 'bad' : e.status === 'Excluded' ? 'plain' : 'ok') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty-block">No errors on this document</div>', { flush: !!errs.length }) +
      '</div>' +
      (related.length ? A.card('Related Documents', '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Document</th><th>Transaction Type</th><th>Date</th><th class="num">Amount</th><th>Stage</th></tr></thead><tbody>' + related.map(function (x) { return '<tr><td class="nowrap">' + A.docLink(x) + '</td><td>' + A.typeLabel(x.type) + '</td><td>' + A.fmtDate(x.date) + '</td><td class="num">' + A.fmtM2(x.amount) + '</td><td>' + A.chip(M.stage(x)) + '</td></tr>'; }).join('') + '</tbody></table></div>', { flush: true }) : '');
    A.q('[data-dl]', main).addEventListener('click', function () {
      A.xlsx(d.key.replace(/\|/g, '-') + '_Lines.xlsx', 'Lines', [['Document', 'SKU', 'ASIN', 'HSN', 'Quantity', 'Tax Exclusive', 'GST Rate', 'CGST', 'SGST', 'IGST', 'Amount']].concat(d.lines.map(function (l) { return [d.key, l.sku, l.asin, l.hsn, l.qty, l.excl, l.rate, l.cgst, l.sgst, l.igst, l.amount]; })));
      A.toast('Lines downloaded');
    });
  });

  // ---------- error lists ----------
  var resolve = function (ids, action, note, label) {
    A.state.res = A.state.res || {};
    var t = A.now();
    ids.forEach(function (id) { A.state.res[id] = [action, t, A.role, note || '']; });
    A.log(action === 'exclude' ? 'Errors Excluded' : 'Errors Resolved', ids.length === 1 ? ids[0] : A.plural(ids.length, 'error'), label + (note ? ': ' + note : ''));
    A.commit(A.plural(ids.length, 'error') + (action === 'exclude' ? ' excluded' : ' resolved'));
  };
  A.resolveErrors = resolve;
  var reopen = function (e) {
    if (!A.state.res || !A.state.res[e.id]) { A.toast('This error was resolved by a mapping or setup; change that to reopen it', 'warn'); return; }
    delete A.state.res[e.id];
    A.log('Error Reopened', e.id, e.type);
    A.commit(e.id + ' reopened', 'warn');
  };
  var noteDialog = function (title, ok, ids, action, label, ph) {
    A.dialog({ title: title, ok: ok, body: (ids.length > 1 ? '<p>' + A.plural(ids.length, 'error') + ' selected.</p>' : '') + A.field('rn', 'Remark', '<textarea class="input" id="rn" placeholder="' + A.esc(ph || 'Why this is correct') + '"></textarea>', true),
      onOk: function (box) { var n = A.q('#rn', box).value.trim(); if (n.length < 5) return A.invalid(box, 'rn', 'Enter a remark of at least 5 characters'); resolve(ids, action, n, label); } });
  };
  var revalidate = function (M, list, label) {
    if (!A.need('err.resolve')) return;
    var open = list.filter(function (e) { return e.status === 'Open'; }).length;
    A.progress('Revalidating ' + label, ['Loading ' + A.plural(list.length, 'error'), 'Reading Seller GSTINs, customers and SKU mappings', 'Checking Business Central items', 'Updating error status'], function () {
      A.log('Revalidation Run', label, open + ' open after revalidation');
      A.commit('Revalidation complete: ' + A.plural(open, 'error') + ' still open, ' + A.fmtN(list.length - open) + ' resolved or excluded', open ? 'warn' : 'ok');
    });
  };
  var errTable = function (M, main, item) {
    var list = (item ? M.itemErrors : M.headerErrors).filter(function (e) { return e.month === A.month; });
    var types = {};
    list.forEach(function (e) { types[e.type] = types[e.type] || { open: 0, all: 0 }; types[e.type].all++; if (e.status === 'Open') types[e.type].open++; });
    var can = A.can('err.resolve');
    var title = item ? 'Amazon Inventory Item Error' : 'Amazon Inventory Header Error';
    var openN = list.filter(function (e) { return e.status === 'Open'; }).length;
    main.innerHTML = A.head(title, A.monthPick() + (can ? A.btn('Revalidate', 'data-reval', '', 'sync') : '') + '<a class="btn pri" data-link="' + (item ? 'AOP-MTR-05' : 'AOP-MTR-06') + '" data-q="m=' + A.month + '">' + (item ? 'Header Errors' : 'Item Errors') + '</a>', openN ? A.chip(openN + ' open', 'bad') : A.chip('None Open', 'ok')) +
      '<div class="kpis">' + Object.keys(types).sort(function (a, b) { return types[b].all - types[a].all; }).slice(0, 5).map(function (k) { return A.kpi(k, A.fmtN(types[k].open), types[k].open ? A.chip('of ' + types[k].all + ' open', 'bad') : A.chip('All ' + types[k].all + ' Resolved', 'ok'), A.screen, 'm=' + A.month + '&type=' + encodeURIComponent(k)); }).join('') + '</div>' +
      '<section class="card flush list" id="errs"></section>';
    A.wireMonth(main);
    var rb = A.q('[data-reval]', main); if (rb) rb.addEventListener('click', function () { revalidate(M, list, title.replace('Amazon Inventory ', '') + 's, ' + A.monthLabel()); });
    var actions = function (e) {
      if (!can) return A.chip('View Only', 'plain');
      if (e.status !== 'Open') return e.action === 'gstin' || e.action === 'customer' || e.action === 'sku' || e.action === 'blocked' ? '<span class="muted">' + A.esc(e.note) + '</span>' : '<button class="btn sm" type="button" data-reopen="' + e.id + '">Reopen</button>';
      var b = function (l, act, pri) { return '<button class="btn sm' + (pri ? ' pri' : '') + '" type="button" data-act="' + act + '" data-id="' + e.id + '">' + l + '</button>'; };
      switch (e.how) {
        case 'gstin': return A.canOpen('AOP-SET-01') ? '<a class="btn sm pri" data-link="AOP-SET-01" data-q="add=' + e.doc.gstin + '">Set Up GSTIN</a>' : A.chip('System Administrator Sets Up', 'warn');
        case 'customer': return '<a class="btn sm pri" data-link="AOP-MAP-02" data-q="q=' + encodeURIComponent(D.custLabel(e.doc.custKey)) + '">Resolve Customer</a>';
        case 'amount': return '<span class="acts-cell">' + b('Accept Amazon Amount', 'accept', true) + b('Exclude', 'exclude') + '</span>';
        case 'duplicate': return b('Exclude Duplicate', 'exclude', true);
        case 'orphan': return '<span class="acts-cell">' + b('Link Original Invoice', 'link', true) + b('Exclude', 'exclude') + '</span>';
        case 'sku': return b('Map SKU', 'map', true);
        case 'hsn': return '<span class="acts-cell">' + b('Use Item HSN', 'item', true) + b('Accept MTR HSN', 'mtr') + '</span>';
        case 'rate': return '<span class="acts-cell">' + b('Use Item Rate', 'item', true) + b('Accept MTR Rate', 'mtr') + '</span>';
        case 'blocked': return '<span class="acts-cell">' + b('Confirm Unblocked', 'unblock', true) + b('Map to Another Item', 'remap') + '</span>';
      }
      return '';
    };
    var cols = [
      { h: 'Error ID', v: function (e) { return e.id; }, f: function (e) { return '<b class="mono">' + e.id + '</b>'; }, cls: 'nowrap' },
      { h: 'Document', v: function (e) { return e.doc.key; }, f: function (e) { return A.docLink(e.doc); }, cls: 'nowrap' }
    ];
    if (item) cols.push({ h: 'SKU', v: function (e) { return e.line.sku; }, cls: 'mono nowrap' }, { h: 'HSN', v: function (e) { return e.line.hsn; } }, { h: 'GST Rate', v: function (e) { return e.line.rate; }, x: function (e) { return e.line.rate + '%'; }, f: function (e) { return e.line.rate + '%'; }, num: true });
    else cols.push({ h: 'Amount', v: function (e) { return e.doc.amount; }, f: function (e) { return A.fmtM2(e.doc.amount); }, num: true });
    cols.push(
      { h: 'Error', v: function (e) { return e.type; }, f: function (e) { return '<b>' + A.esc(e.type) + '</b>'; } },
      { h: 'Detail', v: function (e) { return e.detail; } },
      { h: 'Status', v: function (e) { return e.status; }, x: function (e) { return e.status + (e.by ? ' by ' + A.person(e.by) + ' ' + A.fmtDT(e.at) : ''); }, f: function (e) { return A.chip(e.status, e.status === 'Open' ? 'bad' : e.status === 'Excluded' ? 'plain' : 'ok'); } },
      { h: 'Action', nosort: true, noexport: true, f: actions }
    );
    var fi = {}; if (A.param('type')) fi['Error'] = A.param('type'); if (A.param('gstin')) fi['Seller GSTIN'] = A.param('gstin');
    var tableObj = A.table(A.q('#errs', main), {
      id: item ? 'itm' : 'hdr', noun: 'errors', rows: list, key: function (e) { return e.id; }, exportName: (item ? 'Amazon_Inventory_Item_Error_' : 'Amazon_Inventory_Header_Error_') + A.monthLabel().replace(' ', '_'), sheet: item ? 'Item Errors' : 'Header Errors', page: 15,
      tabs: [{ label: 'Open', test: function (e) { return e.status === 'Open'; } }, { label: 'Resolved', test: function (e) { return e.status === 'Resolved'; } }, { label: 'Excluded', test: function (e) { return e.status === 'Excluded'; } }, { label: 'All Errors' }],
      search: { ph: 'Search by error ID, document, SKU or detail', text: function (e) { return e.id + ' ' + e.doc.key + ' ' + e.detail + ' ' + (e.line ? e.line.sku : '') + ' ' + D.custLabel(e.doc.custKey); } },
      filters: [{ label: 'Error', get: function (e) { return e.type; } }].concat(item ? [{ label: 'SKU', get: function (e) { return e.line.sku; } }] : [{ label: 'Seller GSTIN', get: function (e) { return e.doc.gstin; } }, { label: 'Transaction Type', get: function (e) { return A.typeLabel(e.doc.type); } }]),
      cols: cols,
      filterInit: fi,
      select: can ? [
        { label: 'Revalidate Selected', fn: function (rows, done) { done(); revalidate(M, rows, A.plural(rows.length, 'selected error')); } },
        { label: 'Exclude Selected', danger: true, fn: function (rows, done) { var ok = rows.filter(function (e) { return e.status === 'Open' && (e.how === 'duplicate' || e.how === 'orphan' || e.how === 'amount'); }); if (!ok.length) { A.toast('Only open amount, duplicate and refund errors can be excluded', 'warn'); return; } A.confirm('Exclude ' + A.plural(ok.length, 'Error'), 'The documents of ' + A.plural(ok.length, 'error') + ' will not be sent to Business Central.' + (ok.length < rows.length ? ' ' + (rows.length - ok.length) + ' selected errors cannot be excluded and stay as they are.' : ''), 'Exclude', function () { done(); resolve(ok.map(function (e) { return e.id; }), 'exclude', 'Excluded from posting', 'Excluded'); }, true); } }
      ] : null,
      selectable: function (e) { return e.status === 'Open'; },
      after: function (el) {
        A.qa('[data-reopen]', el).forEach(function (b) { b.addEventListener('click', function () { reopen(M.error(b.getAttribute('data-reopen'))); }); });
        A.qa('[data-act]', el).forEach(function (b) {
          b.addEventListener('click', function () {
            var e = M.error(b.getAttribute('data-id')), act = b.getAttribute('data-act');
            if (!A.need('err.resolve')) return;
            if (act === 'accept') noteDialog('Accept Amazon Amount', 'Accept Amount', [e.id], 'accept', 'Amazon invoice amount accepted', 'For example: Amazon rounding on promotion; difference posted to rounding account');
            else if (act === 'exclude') A.confirm('Exclude ' + e.doc.key, 'Document ' + e.doc.key + ' will not be sent to Business Central.', 'Exclude', function () { resolve([e.id], 'exclude', e.how === 'duplicate' ? 'Duplicate of ' + e.doc.duplicateOf : 'Excluded from posting', 'Excluded'); }, true);
            else if (act === 'link') {
              A.dialog({ title: 'Link Original Invoice', ok: 'Link Invoice', body: A.kv([['Credit Note', '<span class="mono">' + e.doc.key + '</span>'], ['Original Invoice in MTR', '<span class="mono">' + e.doc.ref + '</span>']]) + '<div class="form-grid" style="margin-top:1rem">' + A.field('pi', 'Posted Sales Invoice in Business Central', A.input('pi', '', 'PSI-2608-17xxx'), true) + '</div>',
                onOk: function (box) { var v = A.q('#pi', box).value.trim().toUpperCase(); if (!/^PSI-\d{4}-\d{5}$/.test(v)) return A.invalid(box, 'pi', 'Enter a posted sales invoice number such as PSI-2608-17462'); if (!/^PSI-(2604|2605|2606|2607|2608)-/.test(v)) return A.invalid(box, 'pi', 'The invoice must be from April to August 2026 (earlier months are not uploaded)'); resolve([e.id], 'link', 'Linked to ' + v, 'Original invoice linked'); } });
            }
            else if (act === 'map' || act === 'remap') A.mapSkuDialog(e.line.sku, act === 'remap');
            else if (act === 'item') resolve([e.id], 'item', e.how === 'hsn' ? 'Item HSN used' : 'Item GST rate used', e.how === 'hsn' ? 'Business Central item HSN used' : 'Business Central item GST rate used');
            else if (act === 'mtr') noteDialog(e.how === 'hsn' ? 'Accept MTR HSN' : 'Accept MTR Rate', 'Accept', [e.id], 'mtr', e.how === 'hsn' ? 'MTR HSN accepted' : 'MTR GST rate accepted', 'For example: confirmed with tax team');
            else if (act === 'unblock') {
              var no = D.listing(e.line.sku).base;
              A.confirm('Confirm Item Unblocked', 'Item ' + no + ' (' + D.item(no).name + ') was unblocked in Business Central. All ' + M.itemErrors.filter(function (x) { return x.how === 'blocked' && x.status === 'Open'; }).length + ' open errors for this item will be resolved.', 'Confirm Unblocked', function () {
                A.state.ub = A.state.ub || {}; A.state.ub[no] = [A.now(), A.role];
                A.log('Item Unblocked', no, D.item(no).name);
                A.commit('Item ' + no + ' confirmed unblocked');
              });
            }
          });
        });
      }
    });
    if (A.param('q')) { tableObj.state.q = A.param('q'); tableObj.draw(); A.params.delete('q'); }
  };
  A.def('AOP-MTR-05', function (M, main) { errTable(M, main, false); });
  A.def('AOP-MTR-06', function (M, main) { errTable(M, main, true); });
})();
