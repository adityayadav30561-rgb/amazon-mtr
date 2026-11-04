/*
 * Shared domain helpers, the three dashboards (AOP-ADM-01, AOP-OPS-01, AOP-FIN-01), Notifications (AOP-NTF-01)
 * and My Profile (AOP-PRO-02).
 */
(function () {
  var A = window.APP, P = window.PORTAL, D = window.MTRDATA;

  // ---------- domain helpers used by every screen ----------
  A.month = (function () { var m = A.param('m'); return D.MONTHS.some(function (x) { return x.key === m; }) ? m : '2026-10'; })();
  A.monthLabel = function (k) { return D.monthLabel(k || A.month); };
  A.monthPick = function () { return A.pick('month', 'Month', A.monthLabel()); };
  A.wireMonth = function (el, keep) {
    A.onPick(el, 'month', D.MONTHS.slice().reverse().map(function (m) { return { label: m.label, value: m.key, hint: m.key === '2026-10' ? 'In progress' : 'Closed' }; }), A.month, function (it) {
      location.href = A.link(A.screen, 'm=' + it.value + (keep ? '&' + keep : ''));
    });
  };
  A.typeLabel = function (t) { return t === 'FreeReplacement' ? 'Free Replacement' : t; };
  A.gstLabel = function (g) { var x = A.M.gstin(g); return x ? g + ' · ' + x.fc : g; };
  A.stats = function (M, month) {
    var docs = M.docs.filter(function (d) { return d.month === month; });
    var s = { docs: docs, ship: 0, refund: 0, cancel: 0, fr: 0, sales: 0, refunds: 0, lines: 0 };
    docs.forEach(function (d) {
      s.lines += d.lines.length;
      if (d.type === 'Shipment') { s.ship++; s.sales += d.amount; }
      else if (d.type === 'Refund') { s.refund++; s.refunds += -d.amount; }
      else if (d.type === 'Cancel') s.cancel++; else s.fr++;
    });
    s.openH = M.headerErrors.filter(function (e) { return e.month === month && e.status === 'Open'; }).length;
    s.openI = M.itemErrors.filter(function (e) { return e.month === month && e.status === 'Open'; }).length;
    s.stage = {};
    docs.forEach(function (d) { var st = M.stage(d); s.stage[st] = (s.stage[st] || 0) + 1; });
    var inv = docs.filter(function (d) { return (d.type === 'Shipment' || d.type === 'FreeReplacement') && !M.netZero(d) && !M.excluded(d); });
    var cms = docs.filter(function (d) { return d.type === 'Refund' && !M.excluded(d); });
    s.invTotal = inv.length;
    s.invCreated = inv.filter(function (d) { return M.inJob('Create Sales Orders', d.id); }).length;
    s.invPosted = inv.filter(function (d) { return M.inJob('Post Sales Orders', d.id); }).length;
    s.cmTotal = cms.length;
    s.cmCreated = cms.filter(function (d) { return M.inJob('Create Sales Credit Memos', d.id); }).length;
    s.cmPosted = cms.filter(function (d) { return M.inJob('Post Sales Credit Memos', d.id); }).length;
    var bp = M.bcLatest('BP', month), ap = M.bcLatest('AP', month), bcm = M.bcLatest('BCM', month), acm = M.bcLatest('ACM', month);
    s.bp = bp ? M.bcSummary(bp) : null; s.ap = ap ? M.bcSummary(ap) : null; s.bcm = bcm ? M.bcSummary(bcm) : null; s.acm = acm ? M.bcSummary(acm) : null;
    s.verified = s.ap ? s.ap.rows.filter(function (r) { return /^Posted and Matched|Posted, Difference/.test(r.status); }).length : 0;
    s.cmVerified = s.acm ? s.acm.rows.filter(function (r) { return /^Posted and Matched|Posted, Difference/.test(r.status); }).length : 0;
    s.reports = ['B2C', 'B2B'].filter(function (r) { return M.uploaded(month, r); }).length;
    return s;
  };
  A.salesTrend = function (M) {
    var labels = ['May', 'June', 'July', 'August', 'September', 'October'];
    var base = [612400, 668900, 702300, 741800];
    var s9 = A.stats(M, '2026-09'), s10 = A.stats(M, '2026-10');
    return { labels: labels, sales: base.concat([Math.round(s9.sales), Math.round(s10.sales)]), refunds: [31200, 35800, 33900, 38400, Math.round(s9.refunds), Math.round(s10.refunds)] };
  };
  // the six steps of the month close, used by the System Administrator and Finance dashboards
  A.closeSteps = function (M, month) {
    var s = A.stats(M, month);
    var errs = s.openH + s.openI;
    var steps = [
      { n: 1, t: 'MTR Uploaded', v: s.reports + ' of 2', st: s.reports === 2 ? 'done' : 'now', link: 'AOP-MTR-01', chip: s.reports === 2 ? A.chip('B2C and B2B', 'ok') : A.chip('B2B Not Uploaded', 'warn') },
      { n: 2, t: 'Reconciled', v: A.fmtN(s.docs.length), st: 'done', link: 'AOP-MTR-03', q: 'm=' + month, chip: A.chip(A.plural(s.docs.length, 'document'), 'plain') },
      { n: 3, t: 'Errors Resolved', v: errs ? A.fmtN(errs) + ' open' : 'None open', st: errs ? 'blocked' : 'done', link: 'AOP-MTR-05', q: 'm=' + month, chip: errs ? A.chip(s.openH + ' header, ' + s.openI + ' item', 'bad') : A.chip('No Errors', 'ok') },
      { n: 4, t: 'Created in Business Central', v: A.fmtN(s.invCreated + s.cmCreated) + ' of ' + A.fmtN(s.invTotal + s.cmTotal), st: s.invCreated + s.cmCreated === s.invTotal + s.cmTotal ? 'done' : 'now', link: 'AOP-INT-01', chip: A.chip(A.pct(s.invCreated + s.cmCreated, s.invTotal + s.cmTotal) + '%', s.invCreated + s.cmCreated === s.invTotal + s.cmTotal ? 'ok' : 'warn') },
      { n: 5, t: 'Reconciled Before Posting', v: s.bp ? A.fmtN(s.bp.ok + s.bp.warn) + ' of ' + A.fmtN(s.bp.total) : 'Not uploaded', st: s.bp && !s.bp.bad ? 'done' : s.bp ? 'now' : 'todo', link: 'AOP-BC-01', q: 'm=' + month, chip: s.bp ? (s.bp.bad ? A.chip(s.bp.bad + ' to Review', 'warn') : A.chip('All Matched', 'ok')) : A.chip('Waiting', 'plain') },
      { n: 6, t: 'Posted and Verified', v: A.fmtN(s.verified + s.cmVerified) + ' of ' + A.fmtN(s.invTotal + s.cmTotal), st: s.verified + s.cmVerified >= s.invTotal + s.cmTotal && s.invTotal ? 'done' : s.ap || s.acm ? 'now' : 'todo', link: 'AOP-BC-02', q: 'm=' + month, chip: s.ap ? A.chip(A.pct(s.verified, s.invTotal) + '% of Invoices', 'blue') : A.chip('Not Posted', 'plain') }
    ];
    return { s: s, steps: steps };
  };
  A.closeTrack = function (steps) {
    return '<div class="close-track">' + steps.map(function (x) {
      return '<a class="close-step ' + x.st + '" data-link="' + x.link + '"' + (x.q ? ' data-q="' + x.q + '"' : '') + '><span class="n">' + (x.st === 'done' ? A.icon('check').replace('class="ic"', 'class="ic" style="width:.875rem;height:.875rem"') : x.n) + '</span><b>' + A.esc(x.t) + '</b><span class="v">' + x.v + '</span>' + x.chip + '</a>';
    }).join('') + '</div>';
  };
  A.feed = function (items) {
    return '<ul class="tl">' + items.map(function (a) {
      var k = /Failed|Deactivated/.test(a.action) ? 'bad' : /Uploaded|Mapped|Created|Resolved|Completed|Set Up|Cancelled|Posted/.test(a.action) ? 'ok' : /Started|Run|Requested|Retry/.test(a.action) ? 'blue' : 'warn';
      return '<li><span class="dot ' + k + '">' + A.icon(k === 'ok' ? 'check' : k === 'bad' ? 'warn' : k === 'blue' ? 'sync' : 'clip') + '</span><div><b>' + A.esc(a.action) + '</b> · ' + A.esc(a.ref) + '<p>' + A.esc(a.detail) + '</p><div class="meta"><span>' + A.esc(A.person(a.by)) + '</span><span>' + A.fmtDT(a.at) + '</span></div></div></li>';
    }).join('') + '</ul>';
  };
  A.jobsTable = function (jobs) {
    return '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Job</th><th>Type</th><th>Started</th><th class="num">Documents</th><th class="num">Failed</th><th>Status</th></tr></thead><tbody>' +
      jobs.map(function (j) { return '<tr><td class="nowrap">' + A.a('AOP-INT-02', '<b>' + j.id + '</b>', 'id=' + j.id) + '</td><td class="nowrap">' + A.esc(j.type) + '</td><td class="nowrap">' + A.fmtDT(j.at) + '</td><td class="num">' + A.fmtN(j.docIds.length) + '</td><td class="num">' + A.fmtN(j.failed.length) + '</td><td>' + A.chip(j.status) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  };
  A.stageDonut = function (s) {
    var C = { Error: '#d43a2f', Validated: '#7c8cff', 'Sales Order Created': '#0b8fa8', 'Credit Memo Created': '#0b8fa8', 'Reconciled in Business Central': '#0a48fd', 'Amount Difference in Business Central': '#b7791f', Posted: '#0c9b6a', 'Creation Failed': '#f08a80', 'Posting Failed': '#f08a80' };
    var groups = {};
    Object.keys(s.stage).forEach(function (k) {
      var g = /Cancel/.test(k) ? 'Cancellations' : k === 'Excluded' ? 'Excluded' : k === 'Credit Memo Created' ? 'Sales Order Created' : k;
      groups[g] = (groups[g] || 0) + s.stage[k];
    });
    var order = ['Posted', 'Reconciled in Business Central', 'Sales Order Created', 'Validated', 'Amount Difference in Business Central', 'Creation Failed', 'Posting Failed', 'Error', 'Cancellations', 'Excluded'];
    var series = order.filter(function (k) { return groups[k]; }).map(function (k) { return { name: k === 'Sales Order Created' ? 'Created in Business Central' : k, value: groups[k], color: C[k] || (k === 'Cancellations' ? '#9aa3b5' : '#c9ced8') }; });
    return A.chart('donut', [], series, { center: A.fmtN(s.docs.length), caption: 'documents' });
  };
  A.attention = function (M, month, role) {
    var out = [];
    var s = A.stats(M, month);
    if (s.reports < 2 && month === '2026-10' && A.can('mtr.upload')) out.push(['October 2026 B2B MTR not uploaded', 'AOP-MTR-01', '', A.chip('Due', 'warn')]);
    var gst = M.headerErrors.filter(function (e) { return e.month === month && e.status === 'Open' && e.how === 'gstin'; }).length;
    if (gst) out.push(['Seller GSTIN 33AAHCC4821K1Z4 not set up', A.canOpen('AOP-SET-01') ? 'AOP-SET-01' : 'AOP-MTR-05', A.canOpen('AOP-SET-01') ? '' : 'type=Seller GSTIN Not Configured', A.chip(gst + ' invoices', 'bad')]);
    var sku = M.listings.filter(function (l) { return !l.item && M.itemErrors.some(function (e) { return e.line.sku === l.sku && e.status === 'Open'; }); }).length;
    if (sku) out.push(['Amazon SKUs without a Business Central item', 'AOP-MAP-01', '', A.chip(sku + ' SKUs', 'bad')]);
    var mc = M.missingCustomers.filter(function (m) { return m.status === 'Missing'; }).length;
    if (mc) out.push(['Customers missing in Business Central', 'AOP-MAP-02', '', A.chip(mc + ' customers', 'bad')]);
    if (s.bp) { var diff = s.bp.rows.filter(function (r) { return r.status === 'Amount Difference' || r.status === 'Missing in Business Central' || r.status === 'Not in MTR'; }).length; if (diff) out.push(['Before posting differences to review', 'AOP-BC-05', 'id=' + M.bcLatest('BP', month).id, A.chip(diff + ' documents', 'warn')]); }
    var fj = M.jobs.filter(function (j) { return j.month === month && j.failed.length; });
    fj.forEach(function (j) { out.push([j.id + ' ' + j.type + ' failures', 'AOP-INT-02', 'id=' + j.id, A.chip(j.failed.length + ' failed', 'bad')]); });
    var fc = M.cancels.filter(function (r) { return r.status === 'Failed'; }).length;
    if (fc) out.push(['Cancellation requests failed', 'AOP-CAN-01', 'tab=Failed', A.chip(fc + ' requests', 'bad')]);
    var rc = M.readyToCreate('SO', month).length + M.readyToCreate('CM', month).length;
    if (rc) out.push(['Validated documents not sent to Business Central', 'AOP-INT-01', '', A.chip(rc + ' documents', 'blue')]);
    var rp = M.readyToPost('SO', month).length;
    if (rp && s.bp) out.push(['Reconciled sales orders ready for posting', 'AOP-BC-01', 'm=' + month, A.chip(rp + ' orders', 'blue')]);
    return out;
  };
  A.attentionList = function (items) {
    if (!items.length) return '<div class="empty-block">Nothing needs attention</div>';
    return '<ul class="list">' + items.map(function (x) { return '<li><span class="grow">' + A.a(x[1], A.esc(x[0]), x[2]) + '</span>' + x[3] + '</li>'; }).join('') + '</ul>';
  };

  // ---------- System Administrator dashboard ----------
  A.def('AOP-ADM-01', function (M, main) {
    var c = A.closeSteps(M, A.month), s = c.s, t = A.salesTrend(M);
    var errs = s.openH + s.openI;
    var openCan = M.cancels.filter(function (r) { return /Queued|Sent to API|Failed/.test(r.status); }).length;
    var types = {};
    M.headerErrors.concat(M.itemErrors).forEach(function (e) { if (e.month === A.month && e.status === 'Open') types[e.type] = (types[e.type] || 0) + 1; });
    main.innerHTML = A.head('Dashboard', A.monthPick() + '<a class="btn" data-link="AOP-INT-01">Business Central Integration</a><a class="btn pri" data-link="AOP-MTR-03" data-q="m=' + A.month + '">MTR Reconciliation</a>') +
      '<div class="kpis">' +
      A.kpi('Sales in MTR', A.fmtML(s.sales), A.chip(A.plural(s.ship, 'invoice'), 'plain'), 'AOP-MTR-03', 'm=' + A.month) +
      A.kpi('Open Errors', A.fmtN(errs), errs ? A.chip(s.openH + ' header, ' + s.openI + ' item', 'bad') : A.chip('None Open', 'ok'), 'AOP-MTR-05', 'm=' + A.month) +
      A.kpi('Invoices Posted in Business Central', A.fmtN(s.invPosted), A.chip(A.pct(s.invPosted, s.invTotal) + '% of ' + A.fmtN(s.invTotal), s.invPosted === s.invTotal ? 'ok' : 'warn'), 'AOP-BC-02', 'm=' + A.month) +
      A.kpi('Open Cancellation Requests', A.fmtN(openCan), A.chip(M.cancels.filter(function (r) { return r.status === 'Failed'; }).length + ' failed', openCan ? 'warn' : 'ok'), 'AOP-CAN-01') +
      '</div>' +
      A.card(A.monthLabel() + ' Close', A.closeTrack(c.steps)) +
      '<div class="grid g-chart">' +
      A.card('Sales and Refunds by Month', A.chart('bars', t.labels, [{ name: 'Sales', values: t.sales, color: 'var(--accent)' }, { name: 'Refunds', values: t.refunds, color: 'var(--warn)' }], { money: true, height: 280 })) +
      A.card('Documents by Stage', A.stageDonut(s), { cls: 'center' }) +
      '</div>' +
      '<div class="grid g-2">' +
      A.card('Needs Attention', A.attentionList(A.attention(M, A.month))) +
      A.card('Open Errors by Type', Object.keys(types).length ? '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Error</th><th>Level</th><th class="num">Open</th></tr></thead><tbody>' + Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).map(function (k) { var item = M.itemErrors.some(function (e) { return e.type === k; }); return '<tr><td>' + A.a(item ? 'AOP-MTR-06' : 'AOP-MTR-05', '<b>' + A.esc(k) + '</b>', 'type=' + encodeURIComponent(k) + '&m=' + A.month) + '</td><td>' + A.chip(item ? 'Item' : 'Header', 'plain') + '</td><td class="num">' + types[k] + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty-block">No open errors</div>', { flush: true }) +
      '</div>' +
      A.card('Recent Business Central Jobs', A.jobsTable(M.jobs.slice(0, 5)), { flush: true, more: '<a class="more" data-link="AOP-INT-01">All jobs</a>' }) +
      A.card('Recent Activity', A.feed(M.audit.slice(0, 6)), { more: '<a class="more" data-link="AOP-AUD-01">Audit activity</a>' });
    A.wireMonth(main);
  });

  // ---------- Marketplace Operations dashboard ----------
  A.def('AOP-OPS-01', function (M, main) {
    var s = A.stats(M, A.month);
    var unm = M.listings.filter(function (l) { return !l.item && M.itemErrors.some(function (e) { return e.line.sku === l.sku && e.month === A.month; }); });
    var miss = M.missingCustomers.filter(function (m) { return m.status === 'Missing'; });
    var due = M.pending.filter(function (p) { return p.month === A.month; });
    var byG = {};
    M.gstins.forEach(function (g) { byG[g.gstin] = { h: 0, i: 0 }; });
    M.headerErrors.forEach(function (e) { if (e.month === A.month && e.status === 'Open') byG[e.doc.gstin].h++; });
    M.itemErrors.forEach(function (e) { if (e.month === A.month && e.status === 'Open') byG[e.doc.gstin].i++; });
    var files = ['B2C', 'B2B'].map(function (r) {
      var u = M.uploads.filter(function (x) { return x.month === A.month && x.report === r; })[0];
      return '<tr><td><b>' + A.esc(A.monthLabel() + ' ' + r) + '</b></td><td>' + (u ? A.a('AOP-MTR-02', A.esc(u.file), 'id=' + u.id) : '<span class="muted">Not uploaded</span>') + '</td><td class="num">' + (u ? A.fmtN(u.rows) : '') + '</td><td class="nowrap">' + (u ? A.fmtDT(u.at) : '') + '</td><td>' + (u ? A.chip('Saved') : A.chip('Due', 'warn')) + '</td><td>' + (u ? '' : '<a class="btn sm pri" data-link="AOP-MTR-01" data-q="report=' + r + '">Upload</a>') + '</td></tr>';
    }).join('');
    main.innerHTML = A.head('Dashboard', A.monthPick() + '<a class="btn" data-link="AOP-MTR-03" data-q="m=' + A.month + '">MTR Reconciliation</a><a class="btn pri" data-link="AOP-MTR-01">Upload MTR</a>') +
      '<div class="kpis">' +
      A.kpi('MTR Files Due', A.fmtN(due.length), due.length ? A.chip(due.map(function (d) { return d.report; }).join(', ') + ' Report', 'warn') : A.chip('All Uploaded', 'ok'), 'AOP-MTR-01') +
      A.kpi('Open Header Errors', A.fmtN(s.openH), s.openH ? A.chip('Needs Action', 'bad') : A.chip('None Open', 'ok'), 'AOP-MTR-05', 'm=' + A.month) +
      A.kpi('Open Item Errors', A.fmtN(s.openI), s.openI ? A.chip('Needs Action', 'bad') : A.chip('None Open', 'ok'), 'AOP-MTR-06', 'm=' + A.month) +
      A.kpi('Missing Mappings', A.fmtN(unm.length + miss.length), A.chip(unm.length + ' SKUs, ' + miss.length + ' customers', unm.length + miss.length ? 'warn' : 'ok'), 'AOP-MAP-01') +
      '</div>' +
      A.card('MTR Files for ' + A.monthLabel(), '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Report</th><th>File</th><th class="num">Rows</th><th>Uploaded</th><th>Status</th><th></th></tr></thead><tbody>' + files + '</tbody></table></div>', { flush: true }) +
      '<div class="grid g-chart">' +
      A.card('Transactions by Type', A.chart('bars', ['Shipment', 'Refund', 'Cancel', 'Free Replacement'], [{ name: A.monthLabel(), values: [s.ship, s.refund, s.cancel, s.fr], color: 'var(--accent)' }], { height: 260 })) +
      A.card('Open Errors by Seller GSTIN', '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Seller GSTIN</th><th>Centre</th><th class="num">Header</th><th class="num">Item</th></tr></thead><tbody>' + M.gstins.map(function (g) { return '<tr><td class="mono nowrap">' + A.a('AOP-MTR-05', g.gstin, 'gstin=' + g.gstin + '&m=' + A.month) + '</td><td>' + g.fc + '</td><td class="num">' + byG[g.gstin].h + '</td><td class="num">' + byG[g.gstin].i + '</td></tr>'; }).join('') + '</tbody></table></div>', { flush: true }) +
      '</div>' +
      '<div class="grid g-2">' +
      A.card('Amazon SKUs Without Mapping', unm.length ? '<ul class="list">' + unm.map(function (l) { var n = M.itemErrors.filter(function (e) { return e.line.sku === l.sku && e.status === 'Open'; }).length; return '<li><span class="grow">' + A.a('AOP-MAP-01', '<b>' + A.esc(l.sku) + '</b>', 'q=' + encodeURIComponent(l.sku)) + '</span>' + A.chip(n + ' lines', 'bad') + '</li>'; }).join('') + '</ul>' : '<div class="empty-block">Every Amazon SKU is mapped</div>', { more: '<a class="more" data-link="AOP-MAP-01">Amazon SKU mapping</a>' }) +
      A.card('Missing Customers', miss.length ? '<ul class="list">' + miss.map(function (m) { return '<li><span class="grow">' + A.a('AOP-MAP-02', '<b>' + A.esc(m.name) + '</b>') + '</span>' + A.chip(m.kind, 'plain') + A.chip(m.docs.length + ' documents', 'bad') + '</li>'; }).join('') + '</ul>' : '<div class="empty-block">No missing customers</div>', { more: '<a class="more" data-link="AOP-MAP-02">Missing customer</a>' }) +
      '</div>';
    A.wireMonth(main);
  });

  // ---------- Finance and Accounts dashboard ----------
  A.def('AOP-FIN-01', function (M, main) {
    var c = A.closeSteps(M, A.month), s = c.s;
    var readyCreate = M.readyToCreate('SO', A.month).length + M.readyToCreate('CM', A.month).length;
    var readyPost = M.readyToPost('SO', A.month).length + M.readyToPost('CM', A.month).length;
    var diffs = (s.bp ? s.bp.bad : 0) + (s.bcm ? s.bcm.bad : 0);
    var canF = M.cancels.filter(function (r) { return r.status === 'Failed'; }).length;
    var row = function (name, total, created, recon, posted, verified, link) {
      return '<tr><td><b>' + name + '</b></td><td class="num">' + A.fmtN(total) + '</td><td class="num">' + A.fmtN(created) + '</td><td class="num">' + A.fmtN(recon) + '</td><td class="num">' + A.fmtN(posted) + '</td><td class="num">' + A.fmtN(verified) + '</td><td style="min-width:9rem">' + A.meter(A.pct(verified, total)) + '</td><td>' + A.a(link, 'Open', 'm=' + A.month) + '</td></tr>';
    };
    var canRows = M.cancels;
    main.innerHTML = A.head('Dashboard', A.monthPick() + '<a class="btn" data-link="AOP-INT-01">Business Central Integration</a><a class="btn pri" data-link="AOP-BC-01" data-q="m=' + A.month + '">Excel Upload Before Posting</a>') +
      '<div class="kpis">' +
      A.kpi('Ready to Send to Business Central', A.fmtN(readyCreate), A.chip(readyCreate ? 'Validated' : 'None Waiting', readyCreate ? 'blue' : 'ok'), 'AOP-INT-01') +
      A.kpi('Differences to Review', A.fmtN(diffs), diffs ? A.chip('Before Posting', 'warn') : A.chip('None', 'ok'), s.bp ? 'AOP-BC-05' : 'AOP-BC-01', s.bp ? 'id=' + M.bcLatest('BP', A.month).id : 'm=' + A.month) +
      A.kpi('Ready for Posting', A.fmtN(readyPost), A.chip(readyPost ? 'Reconciled' : 'None Waiting', readyPost ? 'blue' : 'ok'), 'AOP-BC-01', 'm=' + A.month) +
      A.kpi('Failed Cancellations', A.fmtN(canF), canF ? A.chip('Needs Action', 'bad') : A.chip('None', 'ok'), 'AOP-CAN-01', 'tab=Failed') +
      '</div>' +
      A.card(A.monthLabel() + ' in Business Central', '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Documents</th><th class="num">In MTR</th><th class="num">Created</th><th class="num">Reconciled</th><th class="num">Posted</th><th class="num">Verified</th><th>Progress</th><th></th></tr></thead><tbody>' +
        row('Sales Invoices', s.invTotal, s.invCreated, s.bp ? s.bp.rows.filter(function (r) { return r.doc && /^(Matched|Difference Accepted)/.test(r.status); }).length : 0, s.invPosted, s.verified, 'AOP-BC-02') +
        row('Credit Memos', s.cmTotal, s.cmCreated, s.bcm ? s.bcm.rows.filter(function (r) { return r.doc && /^(Matched|Difference Accepted)/.test(r.status); }).length : 0, s.cmPosted, s.cmVerified, 'AOP-BC-04') +
        '</tbody></table></div>', { flush: true }) +
      '<div class="grid g-2">' +
      A.card('Needs Attention', A.attentionList(A.attention(M, A.month).filter(function (x) { return !/SKUs|Customers missing|B2B MTR|GSTIN/.test(x[0]); }))) +
      A.card('Cancellation Requests', '<div class="stats four"><div><span>Queued</span><b>' + canRows.filter(function (r) { return r.status === 'Queued'; }).length + '</b></div><div><span>Sent to API</span><b>' + canRows.filter(function (r) { return r.status === 'Sent to API'; }).length + '</b></div><div><span>Cancelled</span><b>' + canRows.filter(function (r) { return r.status === 'Cancelled'; }).length + '</b></div><div><span>Failed</span><b>' + canF + '</b></div></div>' +
        '<a class="btn block" data-link="AOP-CAN-01" style="margin-top:1rem">Excel Cancel Invoice</a>') +
      '</div>' +
      A.card('Recent Business Central Jobs', A.jobsTable(M.jobs.slice(0, 6)), { flush: true, more: '<a class="more" data-link="AOP-INT-01">All jobs</a>' });
    A.wireMonth(main);
  });

  // ---------- Notifications ----------
  A.def('AOP-NTF-01', function (M, main) {
    var mine = M.notifications.filter(function (n) { return n.roles.split(' ').indexOf(A.role) >= 0; });
    var unread = mine.filter(function (n) { return !n.read; }).length;
    main.innerHTML = A.head('Notifications', A.btn('Mark All as Read', 'data-all' + (unread ? '' : ''), '', 'check'), unread ? A.chip(unread + ' unread', 'blue') : '') + '<section class="card flush list" id="nt"></section>';
    A.table(A.q('#nt', main), {
      id: 'ntf', rows: mine, key: function (n) { return n.id; }, noun: 'notifications', page: 12,
      tabs: [{ label: 'All' }, { label: 'Unread', test: function (n) { return !n.read; } }],
      search: { ph: 'Search notifications', text: function (n) { return n.title + ' ' + n.text; } },
      cols: [
        { h: 'Notification', v: function (n) { return n.title; }, f: function (n) { return '<div class="inline">' + A.chip(n.kind === 'ok' ? 'Done' : n.kind === 'bad' ? 'Failed' : n.kind === 'warn' ? 'Needs Review' : 'Information', n.kind === 'blue' ? 'blue' : n.kind) + '<a data-open="' + n.id + '"' + (n.link && A.canOpen(n.link) ? ' href="' + A.link(n.link, n.q) + '"' : '') + '><b>' + A.esc(n.title) + '</b></a></div>'; } },
        { h: 'Detail', v: function (n) { return n.text; } },
        { h: 'Received', v: function (n) { return n.at; }, x: function (n) { return A.fmtDT(n.at); }, f: function (n) { return '<span class="nowrap">' + A.fmtDT(n.at) + '</span>'; } },
        { h: 'Status', v: function (n) { return n.read ? 'Read' : 'Unread'; }, f: function (n) { return n.read ? A.chip('Read', 'plain') : '<button class="btn sm" type="button" data-read="' + n.id + '">Mark as Read</button>'; } }
      ],
      after: function (el) {
        A.qa('[data-read]', el).forEach(function (b) { b.addEventListener('click', function () { (A.state.n = A.state.n || []).push(b.getAttribute('data-read')); A.commit('Marked as read'); }); });
        A.qa('[data-open]', el).forEach(function (a) { a.addEventListener('click', function () { var id = a.getAttribute('data-open'); A.state.n = A.state.n || []; if (A.state.n.indexOf(id) < 0) A.state.n.push(id); a.setAttribute('href', A.withState(a.getAttribute('href'))); }); });
      }
    });
    A.q('[data-all]', main).addEventListener('click', function () {
      if (!unread) { A.toast('Every notification is already read', 'warn'); return; }
      A.state.n = A.state.n || [];
      mine.forEach(function (n) { if (A.state.n.indexOf(n.id) < 0) A.state.n.push(n.id); });
      A.commit(A.plural(unread, 'notification') + ' marked as read');
    });
  });

  // ---------- My Profile ----------
  A.def('AOP-PRO-02', function (M, main) {
    var u = M.users.filter(function (x) { return x.role === A.role; })[0];
    var pref = A.state.pref || {};
    var prefs = [['upload', 'Upload results'], ['errors', 'New header and item errors'], ['jobs', 'Business Central job failures'], ['cancel', 'Cancellation updates'], ['daily', 'Daily summary email']];
    main.innerHTML = A.head('My Profile', A.btn('Change Password', 'data-pw', '', 'lock') + A.btn('Edit Details', 'data-edit', 'pri', 'edit')) +
      '<div class="grid g-main-side" style="--side:24rem">' +
      '<div class="stack">' +
      A.card('Details', A.kv([['Name', '<b>' + A.esc(u.name) + '</b>'], ['Email', A.esc(u.email)], ['Phone', A.esc(u.phone)], ['Role', A.esc(D.ROLE_NAMES[u.role])], ['User ID', '<span class="mono">' + u.id + '</span>'], ['Status', A.chip(u.status)], ['Last Sign-In', A.fmtDT(u.last)]])) +
      A.card('Notification Preferences', '<div class="table-wrap"><table class="tbl wrap pref"><thead><tr><th>Notification</th><th class="c">Portal</th><th class="c">Email</th></tr></thead><tbody>' + prefs.map(function (p) {
        var v = pref[p[0]] || (p[0] === 'daily' ? '01' : '11');
        return '<tr><td><b>' + p[1] + '</b></td><td class="c"><input type="checkbox" data-pref="' + p[0] + '" data-i="0"' + (v[0] === '1' ? ' checked' : '') + ' aria-label="' + p[1] + ' in the portal"></td><td class="c"><input type="checkbox" data-pref="' + p[0] + '" data-i="1"' + (v[1] === '1' ? ' checked' : '') + ' aria-label="' + p[1] + ' by email"></td></tr>';
      }).join('') + '</tbody></table></div>', { flush: true }) +
      '</div>' +
      A.card('My Permissions', '<ul class="list">' + M.perms.map(function (p) { var ok = p.roles.indexOf(A.role) >= 0; return '<li><span class="grow">' + A.esc(p.name) + '</span>' + A.chip(ok ? 'Allowed' : 'Not Allowed', ok ? 'ok' : 'plain') + '</li>'; }).join('') + '</ul>') +
      '</div>';
    A.qa('[data-pref]', main).forEach(function (c) {
      c.addEventListener('change', function () {
        var k = c.getAttribute('data-pref'), i = +c.getAttribute('data-i');
        A.state.pref = A.state.pref || {};
        var v = (A.state.pref[k] || (k === 'daily' ? '01' : '11')).split('');
        v[i] = c.checked ? '1' : '0'; A.state.pref[k] = v.join('');
        A.save(); A.toast('Notification preference saved');
      });
    });
    A.q('[data-edit]', main).addEventListener('click', function () {
      A.dialog({ title: 'Edit Details', ok: 'Save Changes', body: '<div class="form-grid">' + A.field('pn', 'Name', A.input('pn', u.name), true) + A.field('pp', 'Phone', A.input('pp', u.phone), true) + '</div>',
        onOk: function (box) {
          var n = A.q('#pn', box).value.trim(), ph = A.q('#pp', box).value.trim();
          if (n.length < 3) return A.invalid(box, 'pn', 'Enter your full name');
          if (!/^\+?[0-9 ]{10,16}$/.test(ph)) return A.invalid(box, 'pp', 'Enter a phone number with 10 digits or more');
          A.state.usr = A.state.usr || {}; A.state.usr[u.id] = A.state.usr[u.id] || {};
          A.state.usr[u.id].name = n; A.state.usr[u.id].phone = ph;
          A.log('Profile Updated', u.id, n);
          A.commit('Details saved');
        } });
    });
    A.q('[data-pw]', main).addEventListener('click', function () {
      A.dialog({ title: 'Change Password', ok: 'Change Password', body: '<div class="form-grid">' + A.field('p0', 'Current Password', '<input class="input" id="p0" type="password">', true) + A.field('p1', 'New Password', '<input class="input" id="p1" type="password">', true) + A.field('p2', 'Confirm New Password', '<input class="input" id="p2" type="password">', true) + '</div>',
        onOk: function (box) {
          var a = A.q('#p0', box).value, b = A.q('#p1', box).value, c = A.q('#p2', box).value;
          if (!a) return A.invalid(box, 'p0', 'Enter your current password');
          if (b.length < 10 || !/[0-9]/.test(b) || !/[A-Za-z]/.test(b)) return A.invalid(box, 'p1', 'Use at least 10 characters with letters and numbers');
          if (b !== c) return A.invalid(box, 'p2', 'The passwords do not match');
          A.log('Password Changed', u.id, u.name);
          A.commit('Password changed');
        } });
    });
  });
})();
