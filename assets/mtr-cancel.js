/*
 * Invoice Cancellation and Business Central: Excel Cancel Invoice (AOP-CAN-01), Cancellation Request Details (02),
 * Business Central Integration (AOP-INT-01), Integration Job Details (02).
 * A cancellation request moves Uploaded → Queued → Sent to API → Cancelled or Failed. Uploading the numbers does not cancel
 * anything: the separate cancellation API reads the queue and calls Business Central; "Refresh Status" reads its answers.
 */
(function () {
  var A = window.APP, D = window.MTRDATA;
  var CAN_HEAD = ['Posted Invoice No', 'Amazon Invoice Number', 'Amazon Order Id', 'Invoice Amount', 'Reason'];
  var APPLIED = 'The posted invoice is applied to a customer payment. Unapply the entries or post a credit memo.';

  var addEvent = function (r, status, note, who) { A.state.cev = A.state.cev || {}; (A.state.cev[r.id] = A.state.cev[r.id] || []).push([status, A.now(), who || A.role, note || '']); };
  var cmCount = function () { var n = 0; Object.keys(A.state.cev || {}).forEach(function (k) { A.state.cev[k].forEach(function (e) { if (e[0] === 'Cancelled') n++; }); }); return n; };
  // One answer from the cancellation API for every request that is waiting.
  A.refreshCancellations = function (M) {
    var moved = { sent: 0, done: 0, failed: 0 };
    M.cancels.forEach(function (r) {
      if (r.status === 'Queued') { addEvent(r, 'Sent to API', 'POST /api/crestline/v1/cancelPostedInvoice', 'SYS'); moved.sent++; }
      else if (r.status === 'Sent to API') {
        if (r.kind === 'applied') { addEvent(r, 'Failed', APPLIED, 'SYS'); moved.failed++; }
        else { addEvent(r, 'Cancelled', 'Corrective credit memo PSCM-2610-' + D.pad(2300 + cmCount(), 5) + ' posted and applied', 'SYS'); moved.done++; }
      }
    });
    return moved;
  };
  var retry = function (rs) {
    rs.forEach(function (r) { addEvent(r, 'Retry Requested', 'Retried by ' + A.person(A.role)); });
    A.log('Cancellation Retried', rs.length === 1 ? rs[0].id : A.plural(rs.length, 'request'), rs.map(function (r) { return r.postedNo; }).join(', '));
    A.commit(A.plural(rs.length, 'request') + ' queued again; use Refresh Status to read the API answer');
  };
  var withdraw = function (r) {
    A.confirm('Withdraw ' + r.id, 'The request to cancel ' + r.postedNo + ' will be withdrawn and will not be sent to the cancellation API.', 'Withdraw Request', function () {
      addEvent(r, 'Withdrawn', 'Withdrawn by ' + A.person(A.role));
      A.log('Cancellation Withdrawn', r.id, r.postedNo);
      A.commit(r.id + ' withdrawn', 'warn');
    }, true);
  };
  var convert = function (r) {
    A.confirm('Post Credit Memo Instead', r.postedNo + ' is applied to a customer payment, so it cannot be cancelled. A sales credit memo for ' + A.fmtM2(r.doc ? r.doc.inv && Math.abs(r.doc.amount) : 0) + ' will be created in Business Central and applied to the invoice instead.', 'Create Credit Memo', function () {
      addEvent(r, 'Converted to Credit Memo', 'Sales credit memo SCM-AMZ-2611-' + D.pad(1 + Object.keys(A.state.cev || {}).length, 4) + ' created for ' + r.postedNo);
      A.log('Cancellation Converted', r.id, 'Credit memo instead of cancellation for ' + r.postedNo);
      A.commit(r.id + ': credit memo created instead of cancellation');
    });
  };
  A.cancelActions = function (r, big) {
    if (!A.can('can.request')) return '';
    var c = big ? 'btn' : 'btn sm';
    if (r.status === 'Failed') return '<span class="acts-cell"><button class="' + c + ' pri" type="button" data-cr="retry" data-id="' + r.id + '">Retry</button>' + (r.kind === 'applied' ? '<button class="' + c + '" type="button" data-cr="convert" data-id="' + r.id + '">Credit Memo Instead</button>' : '') + '</span>';
    if (r.status === 'Queued') return '<button class="' + c + '" type="button" data-cr="withdraw" data-id="' + r.id + '">Withdraw</button>';
    return '';
  };
  A.wireCancelActions = function (M, el) {
    A.qa('[data-cr]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        if (!A.need('can.request')) return;
        var r = M.cancel(b.getAttribute('data-id')), a = b.getAttribute('data-cr');
        if (a === 'retry') retry([r]); else if (a === 'withdraw') withdraw(r); else convert(r);
      });
    });
  };

  // ---------- Excel Cancel Invoice ----------
  A.def('AOP-CAN-01', function (M, main) {
    var rs = M.cancels;
    var by = function (s) { return rs.filter(function (r) { return r.status === s; }).length; };
    var notReq = M.cancelCandidates.filter(function (d) { return !M.cancelFor(d.ref); });
    var can = A.can('can.request');
    main.innerHTML = A.head('Excel Cancel Invoice', A.btn('Download Pending Cancellations', 'data-dlp', '', 'download') + A.btn('Refresh Status', 'data-refresh', 'pri', 'sync')) +
      '<div class="kpis">' + A.kpi('Cancellation Requests', A.fmtN(rs.length), A.chip(A.plural(M.cancelBatches().length, 'upload'), 'plain')) +
      A.kpi('Cancelled in Business Central', A.fmtN(by('Cancelled')), A.chip(A.pct(by('Cancelled'), rs.length) + '%', 'ok'), A.screen, 'tab=Cancelled') +
      A.kpi('Waiting for the API', A.fmtN(by('Queued') + by('Sent to API')), A.chip(by('Queued') + ' queued, ' + by('Sent to API') + ' sent', by('Queued') + by('Sent to API') ? 'warn' : 'ok'), A.screen, 'tab=In Progress') +
      A.kpi('Failed', A.fmtN(by('Failed')), by('Failed') ? A.chip('Needs Action', 'bad') : A.chip('None', 'ok'), A.screen, 'tab=Failed') + '</div>' +
      '<div class="grid g-main-side" style="--side:26rem">' +
      (can ? '<section class="card"><header><h2>Upload Invoices to Cancel</h2></header><div class="body stack"><div id="caup"></div><div id="cares"></div></div></section>' : A.card('Upload Invoices to Cancel', '<div class="empty-block">Requesting cancellations is not allowed for your role</div>')) +
      A.card('Cancellations Required by the MTR', '<div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><span>Cancel Transactions for Posted Invoices</span><b>' + M.cancelCandidates.length + '</b></div><div><span>Not Requested Yet</span><b>' + notReq.length + '</b></div></div>' +
        (notReq.length ? '<ul class="list" style="margin-top:1rem">' + notReq.map(function (d) { return '<li><span class="grow">' + A.docLink(d, d.ref) + '</span>' + A.chip((M.postedInvoiceFor(d.ref) || {}).no || 'Not Posted', 'plain') + '</li>'; }).join('') + '</ul>' : '')) +
      '</div>' +
      '<section class="card flush list" id="reqs"></section>';
    A.q('[data-dlp]', main).addEventListener('click', function () {
      if (!notReq.length) { A.toast('Every cancellation in the MTR has been requested', 'warn'); return; }
      A.xlsx('Pending_Cancellations_October_2026.xlsx', 'Cancellations', [CAN_HEAD].concat(notReq.map(function (d) { var p = M.postedInvoiceFor(d.ref); return [p ? p.no : '', d.ref, d.inv.orderId, Math.abs(d.amount), 'Order cancelled by customer after invoicing']; })));
      A.toast(A.plural(notReq.length, 'invoice') + ' downloaded');
    });
    A.q('[data-refresh]', main).addEventListener('click', function () {
      var waiting = rs.filter(function (r) { return r.status === 'Queued' || r.status === 'Sent to API'; }).length;
      if (!waiting) { A.toast('No request is waiting for the cancellation API', 'warn'); return; }
      A.progress('Reading the cancellation API', ['Connecting to the cancellation API', 'Reading ' + A.plural(waiting, 'request'), 'Updating statuses'], function () {
        var mv = A.refreshCancellations(M);
        A.log('Cancellation Status Refreshed', A.plural(waiting, 'request'), mv.sent + ' sent, ' + mv.done + ' cancelled, ' + mv.failed + ' failed');
        if (mv.failed) A.notify('bad', 'Cancellation request failed', mv.failed + ' request could not be cancelled in Business Central', 'AOP-CAN-01', 'tab=Failed', 'ADM FIN');
        A.commit(mv.sent + ' sent to the API, ' + mv.done + ' cancelled, ' + mv.failed + ' failed', mv.failed ? 'warn' : 'ok');
      });
    });
    var pending = null;
    if (can) A.uploader(A.q('#caup', main), {
      required: ['Posted Invoice No', 'Reason'],
      sample: function () {
        if (!notReq.length) { A.toast('Every cancellation in the MTR has been requested; there is nothing to upload', 'warn'); return null; }
        return { name: 'Cancel_Invoices_' + A.fmtDate(D.TODAY).replace(/\//g, '-') + '.xlsx', sheet: 'Cancellations', rows: [CAN_HEAD].concat(notReq.map(function (d) { var p = M.postedInvoiceFor(d.ref); return [p ? p.no : '', d.ref, d.inv.orderId, Math.abs(d.amount), 'Order cancelled by customer after invoicing']; })) };
      },
      onReady: function (f) {
        var seen = {};
        pending = f.objects.map(function (o, i) {
          var no = String(o['posted invoice no']).toUpperCase(), amz = o['amazon invoice number'] || '', reason = o['reason'];
          var r = { row: i + 2, no: no, amz: amz, reason: reason };
          var d = D.DOCS.filter(function (x) { return x.type === 'Shipment' && !x.duplicateOf && M.siNo(x) === no; })[0];
          if (!/^PSI-\d{4}-\d{5}$/.test(no)) r.err = 'Not a posted sales invoice number';
          else if (!d) r.err = 'Posted invoice not found';
          else if (amz && amz !== d.key) r.err = 'Belongs to ' + d.key + ', not ' + amz;
          else if (M.cancelFor(d.key)) r.err = 'Already requested in ' + M.cancelFor(d.key).id;
          else if (seen[no]) r.err = 'Appears twice in the file';
          else if (!reason) r.err = 'Reason is empty';
          if (d) { r.amz = d.key; r.amount = d.amount; }
          seen[no] = 1;
          r.ok = !r.err; return r;
        });
        var ok = pending.filter(function (r) { return r.ok; }).length;
        A.q('#cares', main).innerHTML = '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Row</th><th>Posted Invoice</th><th>Amazon Invoice</th><th class="num">Amount</th><th>Result</th></tr></thead><tbody>' + pending.map(function (r) { return '<tr><td class="num">' + r.row + '</td><td class="mono">' + A.esc(r.no) + '</td><td class="mono">' + A.esc(r.amz) + '</td><td class="num">' + (r.amount ? A.fmtM2(r.amount) : '') + '</td><td>' + (r.ok ? A.chip('Ready') : A.chip(r.err, 'bad')) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<div class="inline" style="justify-content:flex-end;margin-top:1rem">' + A.chip(ok + ' of ' + pending.length + ' ready', ok ? 'ok' : 'bad') + '<button class="btn pri" type="button" data-sub' + (ok ? '' : ' disabled') + '>Submit ' + A.plural(ok, 'Request') + '</button></div>';
        A.q('[data-sub]', main).addEventListener('click', function () {
          if (!A.need('can.request')) return;
          var good = pending.filter(function (r) { return r.ok; });
          var n0 = M.cancels.length, batchNo = M.cancelBatches().length + 1, batch = 'CAN-2611-' + D.pad(batchNo, 2), t = A.now();
          A.state.cn = A.state.cn || [];
          good.forEach(function (r, i) { A.state.cn.push(['CR-2611-' + D.pad(n0 + i + 1, 4), r.amz, r.reason, t, A.role, batch]); });
          A.log('Cancellation Requested', batch, A.plural(good.length, 'posted invoice'));
          A.notify('blue', A.plural(good.length, 'cancellation request') + ' queued', 'Uploaded in ' + batch + '; the cancellation API picks them up next', 'AOP-CAN-01', 'tab=In Progress', 'ADM FIN');
          pending = null;
          A.resetTable('cancels');
          A.commit(A.plural(good.length, 'request') + ' queued in ' + batch + '. Nothing is cancelled until the API answers.');
        });
      },
      onClear: function () { pending = null; A.q('#cares', main).innerHTML = ''; }
    });
    A.table(A.q('#reqs', main), {
      id: 'cancels', title: 'Cancellation Requests', noun: 'requests', rows: rs, key: function (r) { return r.id; }, exportName: 'Cancellation_Requests', sheet: 'Requests',
      tabs: [{ label: 'All Requests' }, { label: 'In Progress', test: function (r) { return r.status === 'Queued' || r.status === 'Sent to API'; } }, { label: 'Cancelled', test: function (r) { return r.status === 'Cancelled' || r.status === 'Converted to Credit Memo'; } }, { label: 'Failed', test: function (r) { return r.status === 'Failed'; } }, { label: 'Withdrawn', test: function (r) { return r.status === 'Withdrawn'; } }],
      search: { ph: 'Search by request, posted invoice or Amazon invoice', text: function (r) { return r.id + ' ' + r.postedNo + ' ' + r.invoiceNo; } },
      filters: [{ label: 'Upload', get: function (r) { return r.batch; } }],
      rowCls: function (r) { return r.fresh ? 'row-fresh' : ''; },
      select: can ? [{ label: 'Retry Selected', fn: function (sel, done) { var f = sel.filter(function (r) { return r.status === 'Failed'; }); if (!f.length) { A.toast('Only failed requests can be retried', 'warn'); return; } done(); retry(f); } }] : null,
      selectable: function (r) { return r.status === 'Failed'; },
      cols: [
        { h: 'Request', v: function (r) { return r.id; }, f: function (r) { return A.a('AOP-CAN-02', '<b>' + r.id + '</b>', 'id=' + r.id); }, cls: 'nowrap' },
        { h: 'Posted Invoice', v: function (r) { return r.postedNo; }, cls: 'mono nowrap' },
        { h: 'Amazon Invoice', v: function (r) { return r.invoiceNo; }, f: function (r) { return r.doc ? A.docLink(r.doc, r.invoiceNo) : A.esc(r.invoiceNo); }, cls: 'nowrap' },
        { h: 'Reason', v: function (r) { return r.reason; } },
        { h: 'Requested', v: function (r) { return r.events[0][1]; }, x: function (r) { return A.fmtDT(r.events[0][1]); }, f: function (r) { return A.fmtDT(r.events[0][1]); } },
        { h: 'Status', v: function (r) { return r.status; }, f: function (r) { return A.chip(r.status); } },
        { h: 'Action', nosort: true, noexport: true, f: function (r) { return A.cancelActions(r); } }
      ],
      after: function (el) { A.wireCancelActions(M, el); }
    });
  });

  // ---------- Cancellation Request Details ----------
  A.def('AOP-CAN-02', function (M, main) {
    var r = M.cancel(A.param('id')) || M.cancels.filter(function (x) { return x.status === 'Failed'; })[0] || M.cancels[0];
    var api = r.events.filter(function (e) { return e[0] === 'Sent to API'; });
    var last = r.events[r.events.length - 1];
    var amount = r.doc ? Math.abs(r.doc.amount) : 0;
    var resp = r.status === 'Cancelled' ? { status: 200, result: 'Cancelled', postedInvoiceNo: r.postedNo, correctiveCreditMemoNo: (last[3].match(/PSCM-\d{4}-\d{5}/) || [''])[0], applied: true } :
      r.status === 'Failed' ? { status: /timed out/.test(last[3]) ? 504 : 409, error: { code: /timed out/.test(last[3]) ? 'GatewayTimeout' : 'Application_InvoiceApplied', message: last[3] } } :
      r.status === 'Sent to API' ? { status: 202, result: 'Accepted', message: 'Cancellation is being processed' } : null;
    var icon = { Uploaded: ['upload', 'blue'], Queued: ['clip', 'warn'], 'Sent to API': ['sync', 'blue'], Cancelled: ['check', 'ok'], Failed: ['warn', 'bad'], 'Retry Requested': ['repeat', 'warn'], Withdrawn: ['x', 'plain'], 'Converted to Credit Memo': ['receipt', 'ok'] };
    main.innerHTML = A.head(r.id, A.cancelActions(r, true) + '<a class="btn" data-link="AOP-CAN-01">Excel Cancel Invoice</a>', A.chip(r.status)) +
      '<div class="kpis">' + A.kpi('Invoice Amount', A.fmtM2(amount), A.chip(r.invoiceNo, 'plain')) + A.kpi('API Calls', A.fmtN(api.length), A.chip(api.length ? 'Last ' + A.fmtDT(api[api.length - 1][1]) : 'Not Sent', 'plain')) + A.kpi('Status', A.esc(r.status), A.chip(A.fmtDT(r.updated), 'plain')) + A.kpi('Upload', A.esc(r.batch), A.chip(A.person(r.events[0][2]), 'plain')) + '</div>' +
      '<div class="grid g-main-side" style="--side:26rem">' +
      '<div class="stack">' +
      A.card('Status History', '<ul class="tl">' + r.events.slice().reverse().map(function (e) { var ic = icon[e[0]] || ['clip', 'plain']; return '<li><span class="dot ' + ic[1] + '">' + A.icon(ic[0]) + '</span><div><b>' + A.esc(e[0]) + '</b><p>' + A.esc(e[3]) + '</p><div class="meta"><span>' + A.esc(A.person(e[2])) + '</span><span>' + A.fmtDT(e[1]) + '</span></div></div></li>'; }).join('') + '</ul>') +
      (api.length ? A.card('Last API Call', '<div class="stack"><div><span class="label">Request</span><pre class="json">' + A.esc(JSON.stringify({ method: 'POST', url: '/api/crestline/v1/cancelPostedInvoice', body: { requestId: r.id, postedInvoiceNo: r.postedNo, externalDocumentNo: r.invoiceNo, reason: r.reason, company: 'Crestline Laminates Private Limited' } }, null, 2)) + '</pre></div>' + (resp ? '<div><span class="label">Response</span><pre class="json">' + A.esc(JSON.stringify(resp, null, 2)) + '</pre></div>' : '') + '</div>') : '') +
      '</div>' +
      A.card('Request', A.kv([['Request ID', '<span class="mono">' + r.id + '</span>'], ['Posted Invoice', '<span class="mono">' + A.esc(r.postedNo) + '</span>'], ['Amazon Invoice', r.doc ? A.docLink(r.doc, r.invoiceNo) : A.esc(r.invoiceNo)], ['Amazon Order', '<span class="mono">' + (r.doc ? r.doc.inv.orderId : '') + '</span>'],
        ['Cancel Transaction in MTR', r.doc && r.doc.type === 'Cancel' ? A.docLink(r.doc, A.fmtDate(r.doc.date)) : '—'], ['Reason', A.esc(r.reason)], ['Requested By', A.esc(A.person(r.events[0][2]))], ['Requested', A.fmtDT(r.events[0][1])], ['Business Central Result', r.status === 'Cancelled' ? A.esc(last[3]) : r.status === 'Converted to Credit Memo' ? A.esc(last[3]) : A.chip(r.status)]])) +
      '</div>';
    A.wireCancelActions(M, main);
  });

  // ---------- Business Central Integration ----------
  A.def('AOP-INT-01', function (M, main) {
    var month = A.month;
    var so = M.readyToCreate('SO', month), cm = M.readyToCreate('CM', month);
    var postSO = M.readyToPost('SO', month), postCM = M.readyToPost('CM', month);
    var queued = M.cancels.filter(function (r) { return r.status === 'Queued'; }).length;
    var mj = M.jobs.filter(function (j) { return j.month === month; });
    var failedDocs = mj.reduce(function (t, j) { return t + j.failed.length; }, 0);
    var canRun = A.can('bc.post');
    var line = function (title, n, unit, btn) { return '<tr><td><b>' + title + '</b></td><td class="num">' + A.fmtN(n) + '</td><td>' + A.esc(unit) + '</td><td>' + btn + '</td></tr>'; };
    var runBtn = function (attr, n) { return canRun ? '<button class="btn sm pri" type="button" ' + attr + (n ? '' : ' disabled') + '>Send to Business Central</button>' : A.chip('Finance Sends', 'plain'); };
    main.innerHTML = A.head('Business Central Integration', A.monthPick() + A.btn('Test Connection', 'data-test', '', 'link')) +
      '<div class="kpis">' + A.kpi('Jobs in ' + A.monthLabel(), A.fmtN(mj.length), A.chip(A.plural(mj.reduce(function (t, j) { return t + j.docIds.length; }, 0), 'document'), 'plain')) +
      A.kpi('Waiting to Send', A.fmtN(so.length + cm.length), A.chip(so.length + ' orders, ' + cm.length + ' credit memos', so.length + cm.length ? 'blue' : 'ok')) +
      A.kpi('Failed Documents', A.fmtN(failedDocs), failedDocs ? A.chip('Retry Needed', 'bad') : A.chip('None', 'ok'), A.screen, 'tab=With Failures&m=' + month) +
      A.kpi('Connection', 'Connected', A.chip('CRESTLINE-PROD', 'ok')) + '</div>' +
      '<div class="grid g-main-side" style="--side:24rem">' +
      A.card('Send to Business Central', '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Job</th><th class="num">Ready</th><th>Documents</th><th></th></tr></thead><tbody>' +
        line('Create Sales Orders', so.length, 'Validated shipments and free replacements', runBtn('data-run="SO"', so.length)) +
        line('Create Sales Credit Memos', cm.length, 'Validated refunds', runBtn('data-run="CM"', cm.length)) +
        line('Post Sales Orders', postSO.length, 'Reconciled before posting', '<a class="btn sm" data-link="AOP-BC-01" data-q="m=' + month + '">Excel Upload Before Posting</a>') +
        line('Post Sales Credit Memos', postCM.length, 'Reconciled before credit memo', '<a class="btn sm" data-link="AOP-BC-03" data-q="m=' + month + '">Excel Upload Before Credit Memo</a>') +
        line('Cancel Posted Invoices', queued, 'Queued cancellation requests', '<a class="btn sm" data-link="AOP-CAN-01">Excel Cancel Invoice</a>') +
        '</tbody></table></div>', { flush: true }) +
      A.card('Connection', A.kv([['Environment', 'CRESTLINE-PROD'], ['Company', 'Crestline Laminates Private Limited'], ['API', 'Business Central API v2.0'], ['Cancellation API', '/api/crestline/v1'], ['Service Account', 'bc-integration@crestlinelaminates.example'], ['Last Call', A.fmtDT(M.jobs[0].at)], ['Status', A.chip('Connected')]])) +
      '</div>' +
      '<section class="card flush list" id="jobs"></section>';
    A.wireMonth(main);
    A.q('[data-test]', main).addEventListener('click', function () { A.progress('Testing the connection', ['Requesting a token for the service account', 'Calling GET /companies', 'Calling the cancellation API health check'], function () { A.toast('Connected to CRESTLINE-PROD: 3 of 3 checks passed'); }); });
    A.qa('[data-run]', main).forEach(function (b) {
      b.addEventListener('click', function () {
        if (!A.need('bc.post')) return;
        var k = b.getAttribute('data-run'), list = k === 'SO' ? so : cm, type = k === 'SO' ? 'Create Sales Orders' : 'Create Sales Credit Memos';
        A.dialog({ title: type, ok: 'Send to Business Central', body: A.kv([['Documents', A.fmtN(list.length)], ['Amount', A.fmtM2(list.reduce(function (t, d) { return t + d.amount; }, 0))], ['Month', A.monthLabel()], ['Reports', ['B2C', 'B2B'].filter(function (r) { return list.some(function (d) { return d.report === r; }); }).join(', ')]]),
          onOk: function () {
            A.progress(type, ['Creating job', 'Sending ' + A.plural(list.length, 'document'), 'Reading Business Central responses'], function () {
              var j = A.startJob(A.M, type, month, list.map(function (d) { return d.id; }));
              A.commit(j.id + ': ' + A.fmtN(j.ok.length) + ' created in Business Central; upload the extract in ' + (k === 'SO' ? 'Excel Upload Before Posting' : 'Excel Upload Before Credit Memo') + ' to reconcile them');
            });
          } });
      });
    });
    A.table(A.q('#jobs', main), {
      id: 'jobs', title: 'Jobs', noun: 'jobs', rows: M.jobs, key: function (j) { return j.id; }, exportName: 'Business_Central_Jobs', sheet: 'Jobs',
      tabs: [{ label: 'All Jobs' }, { label: 'With Failures', test: function (j) { return j.failed.length > 0; } }],
      search: { ph: 'Search by job or type' },
      filters: [{ label: 'Type', get: function (j) { return j.type; } }, { label: 'Month', get: function (j) { return D.monthLabel(j.month); } }],
      rowCls: function (j) { return j.fresh ? 'row-fresh' : ''; },
      cols: [
        { h: 'Job', v: function (j) { return j.id; }, f: function (j) { return A.a('AOP-INT-02', '<b>' + j.id + '</b>', 'id=' + j.id); }, cls: 'nowrap' },
        { h: 'Type', v: function (j) { return j.type; } },
        { h: 'Month', v: function (j) { return j.month; }, x: function (j) { return D.monthLabel(j.month); }, f: function (j) { return D.monthLabel(j.month); } },
        { h: 'Started By', v: function (j) { return A.person(j.by); } },
        { h: 'Started', v: function (j) { return j.at; }, x: function (j) { return A.fmtDT(j.at); }, f: function (j) { return '<span class="nowrap">' + A.fmtDT(j.at) + '</span>'; } },
        { h: 'Documents', v: function (j) { return j.docIds.length; }, f: function (j) { return A.fmtN(j.docIds.length); }, num: true },
        { h: 'Succeeded', v: function (j) { return j.ok.length; }, f: function (j) { return A.fmtN(j.ok.length); }, num: true },
        { h: 'Failed', v: function (j) { return j.failed.length; }, num: true },
        { h: 'Status', v: function (j) { return j.status; }, f: function (j) { return A.chip(j.status); } }
      ]
    });
  });

  // ---------- Integration Job Details ----------
  A.def('AOP-INT-02', function (M, main) {
    var j = M.job(A.param('id')) || M.jobs.filter(function (x) { return x.failed.length; })[0] || M.jobs[0];
    var isCM = /Credit Memo/.test(j.type), isPost = /^Post/.test(j.type);
    var rows = j.docIds.map(function (id) { var d = D.doc(id); return { id: id, d: d, fail: j.fail[id], retried: j.retried && j.retried[id] }; });
    var num = function (r) { return isPost ? (isCM ? M.pcmNo(r.d) : M.siNo(r.d)) : (isCM ? M.cmNo(r.d) : M.soNo(r.d)); };
    var secs = Math.round(j.docIds.length * 0.42 + 6);
    var canRun = A.can('bc.post');
    main.innerHTML = A.head(j.id, (j.failed.length && canRun ? A.btn('Retry ' + A.plural(j.failed.length, 'Failed Document'), 'data-retry', 'pri', 'repeat') : '') + A.btn('Download Result', 'data-dl', '', 'download'), A.chip(j.type, 'blue') + A.chip(j.status)) +
      '<div class="kpis">' + A.kpi('Documents Sent', A.fmtN(j.docIds.length), A.chip(D.monthLabel(j.month), 'plain')) + A.kpi('Succeeded', A.fmtN(j.ok.length), A.chip(A.pct(j.ok.length, j.docIds.length) + '%', 'ok')) + A.kpi('Failed', A.fmtN(j.failed.length), j.failed.length ? A.chip('Retry Needed', 'bad') : A.chip('None', 'ok')) + A.kpi('Duration', Math.floor(secs / 60) + ' min ' + (secs % 60) + ' s', A.chip(A.fmtDT(j.at), 'plain')) + '</div>' +
      A.card('Job', A.kv([['Job ID', '<span class="mono">' + j.id + '</span>'], ['Type', A.esc(j.type)], ['Month', D.monthLabel(j.month)], ['Started By', A.esc(A.person(j.by))], ['Started', A.fmtDT(j.at)], ['Finished', A.fmtDT(j.at + secs * 1000)], ['Endpoint', isPost ? (isCM ? 'POST salesCreditMemos({id})/Microsoft.NAV.post' : 'POST salesOrders({id})/Microsoft.NAV.shipAndInvoice') : (isCM ? 'POST salesCreditMemos' : 'POST salesOrders')], ['Status', A.chip(j.status)]], 'cols')) + '<section class="card flush list" id="jd"></section>';
    A.table(A.q('#jd', main), {
      id: 'jd-' + j.id, title: 'Documents', noun: 'documents', rows: rows, key: function (r) { return r.id; }, exportName: j.id + '_Documents', sheet: 'Documents',
      tabs: [{ label: 'All Documents' }, { label: 'Failed', test: function (r) { return !!r.fail; } }, { label: 'Succeeded', test: function (r) { return !r.fail; } }],
      tab: j.failed.length ? 'Failed' : 'All Documents',
      search: { ph: 'Search by Amazon document or Business Central number', text: function (r) { return r.d.key + ' ' + (num(r) || ''); } },
      cols: [
        { h: 'Amazon Document', v: function (r) { return r.d.key; }, f: function (r) { return A.docLink(r.d); }, cls: 'nowrap' },
        { h: 'Transaction Type', v: function (r) { return A.typeLabel(r.d.type); } },
        { h: 'Business Central Document', v: function (r) { return r.fail ? '' : num(r) || ''; }, cls: 'mono nowrap' },
        { h: 'Customer', v: function (r) { return M.custMap[r.d.custKey] || ''; }, cls: 'mono nowrap' },
        { h: 'Amount', v: function (r) { return r.d.amount; }, f: function (r) { return A.fmtM2(r.d.amount); }, num: true },
        { h: 'Result', v: function (r) { return r.fail ? 'Failed' : r.retried ? 'Succeeded on Retry' : 'Succeeded'; }, f: function (r) { return r.fail ? A.chip('Failed') : r.retried ? A.chip('Succeeded on Retry', 'ok') : A.chip('Completed'); } },
        { h: 'Message', v: function (r) { return r.fail || (r.retried ? 'Retried ' + A.fmtDT(r.retried) : ''); } }
      ]
    });
    var rb = A.q('[data-retry]', main);
    if (rb) rb.addEventListener('click', function () {
      if (!A.need('bc.post')) return;
      A.progress('Retrying ' + A.plural(j.failed.length, 'document'), ['Sending the failed documents again', 'Reading Business Central responses'], function () {
        A.state.jr = A.state.jr || {};
        var t = A.now();
        j.failed.forEach(function (id) { A.state.jr[j.id + '|' + id] = t; });
        A.log('Retry Completed', j.id, A.plural(j.failed.length, 'document') + ' sent again');
        A.notify('ok', j.id + ' retry completed', A.plural(j.failed.length, 'document') + ' succeeded on retry', 'AOP-INT-02', 'id=' + j.id, 'ADM FIN OPS');
        A.commit(A.plural(j.failed.length, 'document') + ' succeeded on retry');
      });
    });
    A.q('[data-dl]', main).addEventListener('click', function () {
      A.xlsx(j.id + '_Result.xlsx', 'Documents', [['Amazon Document', 'Transaction Type', 'Business Central Document', 'Customer', 'Amount', 'Result', 'Message']].concat(rows.map(function (r) { return [r.d.key, A.typeLabel(r.d.type), r.fail ? '' : num(r) || '', M.custMap[r.d.custKey] || '', r.d.amount, r.fail ? 'Failed' : 'Succeeded', r.fail || '']; })));
      A.toast(A.plural(rows.length, 'document') + ' downloaded');
    });
  });
})();
