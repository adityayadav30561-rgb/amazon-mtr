/*
 * Invoice and Credit Memo Processing: Excel Upload Before Posting (AOP-BC-01), After Posting (02), Before Credit Memo (03),
 * After Credit Memo (04), Business Central Upload Details (05), Excel Upload BC Customer (06).
 * A Business Central upload is reconciled with the MTR: each document is found by its External Document No (the Amazon
 * invoice or credit note number) and its amount is compared with the MTR.
 */
(function () {
  var A = window.APP, D = window.MTRDATA;

  var KIND = {
    BP: { sid: 'AOP-BC-01', title: 'Excel Upload Before Posting', noun: 'sales orders', file: 'BC_Sales_Orders_Amazon_', sheet: 'Sales Orders', before: true, cm: false,
      head: ['Document No', 'External Document No', 'Sell-to Customer No', 'Posting Date', 'Location Code', 'No. of Lines', 'Amount Excl. GST', 'GST Amount', 'Amount Incl. GST', 'Status'] },
    AP: { sid: 'AOP-BC-02', title: 'Excel Upload After Posting', noun: 'posted invoices', file: 'BC_Posted_Sales_Invoices_Amazon_', sheet: 'Posted Sales Invoices', before: false, cm: false,
      head: ['Posted Invoice No', 'Order No', 'External Document No', 'Sell-to Customer No', 'Posting Date', 'Amount Excl. GST', 'GST Amount', 'Amount Incl. GST'] },
    BCM: { sid: 'AOP-BC-03', title: 'Excel Upload Before Credit Memo', noun: 'credit memos', file: 'BC_Sales_Credit_Memos_Amazon_', sheet: 'Sales Credit Memos', before: true, cm: true,
      head: ['Document No', 'External Document No', 'Applies-to Doc. No.', 'Sell-to Customer No', 'Posting Date', 'Location Code', 'Amount Excl. GST', 'GST Amount', 'Amount Incl. GST'] },
    ACM: { sid: 'AOP-BC-04', title: 'Excel Upload After Credit Memo', noun: 'posted credit memos', file: 'BC_Posted_Credit_Memos_Amazon_', sheet: 'Posted Credit Memos', before: false, cm: true,
      head: ['Posted Credit Memo No', 'Credit Memo No', 'External Document No', 'Sell-to Customer No', 'Posting Date', 'Amount Excl. GST', 'GST Amount', 'Amount Incl. GST'] }
  };
  A.BC_KIND = KIND;
  var BCU_HEAD = ['No.', 'Name', 'GST Registration No.', 'GST Customer Type', 'State Code', 'Customer Posting Group', 'Payment Terms Code', 'Blocked'];
  var kindLabel = { BP: 'Before Posting', AP: 'After Posting', BCM: 'Before Credit Memo', ACM: 'After Credit Memo', BCU: 'Business Central Customers' };
  A.bcKindLabel = kindLabel;
  var excl = function (amt, d) { var r = d && d.lines[0] ? d.lines[0].rate : 18; return Math.round(amt / (1 + r / 100) * 100) / 100; };

  // The extract Business Central would give now (used by "Use Sample File").
  var extract = function (M, kind, month) {
    var tmp = { id: 'TMP', kind: kind, month: month, at: A.state.k ? A.state.k + 60000 : D.TODAY + 36000000 };
    var rows = M.bcRows(tmp).filter(function (r) { return !/Missing in Business Central|Not Posted/.test(r.status); });
    var K = KIND[kind];
    return [K.head].concat(rows.map(function (r) {
      var d = r.doc, amt = r.bcAmount, ex = excl(Math.abs(amt), d) * (amt < 0 ? -1 : 1), gst = Math.round((amt - ex) * 100) / 100;
      var date = A.fmtDate(d ? d.date : D.dt(2026, 10, 30));
      if (kind === 'BP') return [r.bcNo, r.ext, r.customer, date, r.location, r.lines || 1, ex, gst, amt, 'Released'];
      if (kind === 'BCM') return [r.bcNo, r.ext, (A.M.postedInvoiceFor(d.ref) || {}).no || '', r.customer || A.M.custMap[d.custKey], date, r.location, ex, gst, amt];
      return [r.postedNo, r.bcNo, r.ext, A.M.custMap[d.custKey], A.fmtDate(r.postedAt || A.now()), ex, gst, amt];
    }));
  };
  var nextId = function (M, kind, month) {
    var mc = month ? month.slice(2).replace('-', '') : '2611';
    var n = M.bcUploads.filter(function (b) { return b.kind === kind && b.id.indexOf(kind + '-' + mc) === 0; }).length + 1;
    return kind + '-' + mc + '-' + D.pad(n, 2);
  };
  var nextJob = function (M, month) { var mc = month.slice(2).replace('-', ''); var n = M.jobs.filter(function (j) { return j.id.indexOf('JOB-' + mc) === 0; }).length + 1; return 'JOB-' + mc + '-' + D.pad(n, 2); };
  A.nextJob = nextJob;
  A.startJob = function (M, type, month, docIds, label) {
    var id = nextJob(M, month);
    (A.state.job = A.state.job || []).push([id, type, month, A.now(), A.role, docIds]);
    A.log('Job Started', id, type + ', ' + D.monthLabel(month) + ', ' + A.plural(docIds.length, 'document'));
    A.save();
    A.refreshModel();
    var j = A.M.job(id);
    A.notify(j.failed.length ? 'warn' : 'ok', id + ' ' + (j.failed.length ? 'finished with failures' : 'completed'), type + ': ' + A.fmtN(j.ok.length) + ' done' + (j.failed.length ? ', ' + j.failed.length + ' failed' : ''), 'AOP-INT-02', 'id=' + id, 'ADM FIN OPS');
    return j;
  };

  // ---------- row decisions ----------
  var decide = function (batch, row, action, note) {
    A.state.bpa = A.state.bpa || {};
    var t = A.now();
    A.state.bpa[batch.id + '|' + row.key] = [action, t, A.role, note || ''];
    if (action === 'accept') A.state.bpa['accd|' + row.key] = [action, t, A.role];
    if (action === 'correct') A.state.bpa['corr|' + row.key] = [action, t, A.role];
    if (action === 'ignore') A.state.bpa['ign|' + row.key] = [action, t, A.role];
    A.log({ accept: 'Difference Accepted', correct: 'Correction Requested', ignore: 'Document Ignored' }[action], row.key, (note || '') + ' (' + batch.id + ')');
    A.commit({ accept: 'Difference accepted for ', correct: 'Correction requested in Business Central for ', ignore: 'Ignored ' }[action] + (row.bcNo || row.key));
  };
  var rowActions = function (M, batch, r, latest) {
    if (!latest || !A.can('bc.upload')) return '';
    var b = function (l, act, pri) { return '<button class="btn sm' + (pri ? ' pri' : '') + '" type="button" data-bact="' + act + '" data-key="' + A.esc(r.key) + '">' + l + '</button>'; };
    if (r.status === 'Amount Difference') return '<span class="acts-cell">' + b('Accept Difference', 'accept', true) + b('Request Correction', 'correct') + '</span>';
    if (r.status === 'Posted with Difference') return b('Accept Difference', 'accept', true);
    if (r.status === 'Missing in Business Central') return b('Retry Creation', 'retry', true);
    if (r.status === 'Not Posted') return b('Retry Posting', 'retrypost', true);
    if (r.status === 'Not in MTR') return b('Ignore', 'ignore');
    return '';
  };
  var wireActions = function (M, batch, el) {
    A.qa('[data-bact]', el).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!A.need('bc.upload')) return;
        var r = M.bcRows(batch).filter(function (x) { return x.key === btn.getAttribute('data-key'); })[0], act = btn.getAttribute('data-bact');
        if (act === 'accept') A.dialog({ title: 'Accept Difference', ok: 'Accept Difference', body: A.kv([['Document', '<span class="mono">' + (r.bcNo || r.key) + '</span>'], ['Business Central Amount', A.fmtM2(r.bcAmount)], ['MTR Amount', A.fmtM2(r.mtrAmount)], ['Difference', '<b>' + A.fmtM2(r.diff) + '</b>']]) + '<div class="form-grid" style="margin-top:1rem">' + A.field('rn', 'Remark', '<textarea class="input" id="rn" placeholder="For example: rounding on promotion, posted to rounding account"></textarea>', true) + '</div>',
          onOk: function (box) { var n = A.q('#rn', box).value.trim(); if (n.length < 5) return A.invalid(box, 'rn', 'Enter a remark of at least 5 characters'); decide(batch, r, 'accept', n); } });
        else if (act === 'correct') A.confirm('Request Correction', 'Business Central document ' + r.bcNo + ' will be corrected to the MTR amount ' + A.fmtM2(r.mtrAmount) + '. Upload a new extract to confirm the correction.', 'Request Correction', function () { decide(batch, r, 'correct', 'Correct to ' + A.fmtM2(r.mtrAmount)); });
        else if (act === 'ignore') A.confirm('Ignore ' + r.bcNo, r.bcNo + ' (' + r.ext + ') is not in the MTR. It will be left out of reconciliation and posting.', 'Ignore', function () { decide(batch, r, 'ignore', r.reason); });
        else if (act === 'retry' || act === 'retrypost') {
          var type = act === 'retry' ? (batch.kind === 'BCM' ? 'Create Sales Credit Memos' : 'Create Sales Orders') : (batch.kind === 'ACM' ? 'Post Sales Credit Memos' : 'Post Sales Orders');
          var j = M.jobs.filter(function (x) { return x.type === type && x.fail[r.doc.id]; })[0];
          if (!j) { A.toast('No failed job holds this document', 'warn'); return; }
          if (!A.need('bc.post')) return;
          A.progress('Retrying ' + r.key, ['Sending ' + (act === 'retry' ? 'the document' : 'the posting request') + ' to Business Central', 'Waiting for the response'], function () {
            A.state.jr = A.state.jr || {}; A.state.jr[j.id + '|' + r.doc.id] = A.now();
            A.log('Retry Completed', j.id, r.key);
            A.commit((act === 'retry' ? 'Created in Business Central; upload a new extract to reconcile ' : 'Posted in Business Central; upload a new extract to verify ') + r.key);
          });
        }
      });
    });
  };

  var resultsTable = function (M, el, batch, latest, id) {
    var K = KIND[batch.kind];
    var rows = M.bcRows(batch);
    var bad = function (r) { return !/^(Matched|Posted and Matched|Difference Accepted|Posted, Difference Accepted|Ignored)/.test(r.status); };
    var cols = [
      { h: K.before ? 'Business Central Document' : 'Posted Document', v: function (r) { return K.before ? r.bcNo : r.postedNo || r.bcNo; }, f: function (r) { return '<b class="mono">' + A.esc((K.before ? r.bcNo : r.postedNo) || '—') + '</b>'; }, cls: 'nowrap' }
    ];
    if (!K.before) cols.push({ h: K.cm ? 'Credit Memo' : 'Sales Order', v: function (r) { return r.bcNo; }, cls: 'mono nowrap' });
    cols.push(
      { h: 'External Document No', v: function (r) { return r.ext; }, f: function (r) { return r.doc ? A.docLink(r.doc, r.ext) : '<span class="mono">' + A.esc(r.ext) + '</span>'; }, cls: 'nowrap' },
      { h: 'Business Central Amount', v: function (r) { return r.bcAmount; }, f: function (r) { return r.bcAmount == null ? '—' : A.fmtM2(r.bcAmount); }, num: true },
      { h: 'MTR Amount', v: function (r) { return r.mtrAmount; }, f: function (r) { return r.mtrAmount == null ? '—' : A.fmtM2(r.mtrAmount); }, num: true },
      { h: 'Difference', v: function (r) { return r.diff; }, f: function (r) { return r.diff == null ? '—' : '<span class="' + (Math.abs(r.diff) > 0.005 ? 'neg' : '') + '">' + A.fmtM2(r.diff) + '</span>'; }, num: true },
      { h: 'Result', v: function (r) { return r.status; }, f: function (r) { return A.chip(r.status) + (r.reason ? '' : ''); } },
      { h: 'Reason', v: function (r) { return r.reason || ''; } },
      { h: 'Action', nosort: true, noexport: true, f: function (r) { return rowActions(M, batch, r, latest); } }
    );
    return A.table(el, {
      id: id || 'bcres-' + batch.id, title: 'Reconciliation Result · ' + batch.id, noun: K.noun, rows: rows, key: function (r) { return r.key; }, exportName: batch.id + '_Reconciliation', sheet: 'Reconciliation', page: 15,
      tabs: [{ label: 'Needs Review', test: bad }, { label: 'Matched', test: function (r) { return !bad(r); } }, { label: 'All Documents' }],
      tab: rows.some(bad) ? 'Needs Review' : 'All Documents',
      search: { ph: 'Search by document or Amazon invoice number', text: function (r) { return (r.bcNo || '') + ' ' + (r.postedNo || '') + ' ' + r.ext; } },
      filters: [{ label: 'Result', get: function (r) { return r.status; } }],
      cols: cols,
      foot: function (rs) { var bt = rs.reduce(function (t, r) { return t + (r.bcAmount || 0); }, 0), mt = rs.reduce(function (t, r) { return t + (r.mtrAmount || 0); }, 0); return '<tr><td colspan="' + (K.before ? 2 : 3) + '">Total</td><td class="num">' + A.fmtM2(bt) + '</td><td class="num">' + A.fmtM2(mt) + '</td><td class="num">' + A.fmtM2(bt - mt) + '</td><td colspan="3"></td></tr>'; },
      after: function (e) { wireActions(M, batch, e); }
    });
  };

  var bcScreen = function (kind) {
    return function (M, main) {
      var K = KIND[kind], month = A.month;
      var latest = M.bcLatest(kind, month);
      var sum = latest ? M.bcSummary(latest) : null;
      var can = A.can('bc.upload');
      var postKind = kind === 'BP' ? 'SO' : kind === 'BCM' ? 'CM' : null;
      var ready = postKind ? M.readyToPost(postKind, month) : [];
      var postType = kind === 'BP' ? 'Post Sales Orders' : 'Post Sales Credit Memos';
      var expected = kind === 'AP' || kind === 'ACM' ? M.jobs.filter(function (j) { return j.type === (kind === 'AP' ? 'Post Sales Orders' : 'Post Sales Credit Memos') && j.month === month; }).reduce(function (t, j) { return t + j.docIds.length; }, 0) : 0;
      var acts = A.monthPick() + (postKind && A.can('bc.post') ? '<button class="btn pri" type="button" data-post' + (ready.length ? '' : '') + '>' + A.icon('play') + 'Send ' + A.plural(ready.length, kind === 'BP' ? 'Matched Order' : 'Matched Credit Memo') + ' for Posting</button>' : '<a class="btn pri" data-link="AOP-INT-01">Business Central Integration</a>');
      var issues = sum ? sum.rows.filter(function (r) { return !/^(Matched|Posted and Matched|Difference Accepted|Posted, Difference Accepted|Ignored)/.test(r.status); }).length : 0;
      main.innerHTML = A.head(K.title, acts, latest ? A.chip('Last upload ' + A.fmtDT(latest.at), 'plain') : A.chip('Not Uploaded for ' + A.monthLabel(), 'warn')) +
        '<div class="kpis">' +
        A.kpi('Documents in Latest File', sum ? A.fmtN(sum.total) : '0', latest ? A.a('AOP-BC-05', A.chip(latest.id, 'blue'), 'id=' + latest.id) : A.chip('No File', 'plain')) +
        A.kpi(K.before ? 'Matched with MTR' : 'Posted and Matched', sum ? A.fmtN(sum.ok + sum.warn) : '0', sum ? A.chip(A.pct(sum.ok + sum.warn, sum.total) + '%', issues ? 'warn' : 'ok') : A.chip('Waiting', 'plain')) +
        A.kpi('Needs Review', A.fmtN(issues), issues ? A.chip(K.before ? 'Differences and Missing' : 'Not Posted or Different', 'bad') : A.chip('None', 'ok')) +
        (postKind ? A.kpi('Ready for Posting', A.fmtN(ready.length), ready.length ? A.chip('Reconciled', 'blue') : A.chip(M.jobs.some(function (j) { return j.type === postType && j.month === month; }) ? 'Sent for Posting' : 'None Ready', 'plain')) : A.kpi('Sent for Posting', A.fmtN(expected), expected ? A.chip('Documents to Verify', 'blue') : A.chip('Nothing Sent', 'warn'), kind === 'AP' ? 'AOP-BC-01' : 'AOP-BC-03', 'm=' + month)) +
        '</div>' +
        (can ? '<section class="card"><header><h2>Upload Business Central File</h2></header><div class="body stack"><div id="bcup"></div><div id="bccheck"></div><div class="inline" style="justify-content:flex-end"><button class="btn" type="button" data-tpl>' + A.icon('download') + 'Download Template</button><button class="btn pri" type="button" data-go disabled>' + A.icon('upload') + 'Upload and Reconcile</button></div></div></section>' : '') +
        (latest ? '<section class="card flush list" id="res"></section>' : A.card('Reconciliation Result', '<div class="empty-block">No ' + A.esc(K.title.replace('Excel Upload ', '').toLowerCase()) + ' file uploaded for ' + A.monthLabel() + '</div>')) +
        '<section class="card flush list" id="hist"></section>';
      A.wireMonth(main);
      var file = null, go = A.q('[data-go]', main);
      if (can) {
        A.uploader(A.q('#bcup', main), {
          required: K.head.slice(0, 3).concat([K.head[K.head.length - (kind === 'BP' ? 2 : 1)]]),
          sample: function () {
            var rows = extract(A.M, kind, month);
            if (rows.length < 2) { A.toast(kind === 'AP' || kind === 'ACM' ? 'Nothing has been posted for ' + A.monthLabel() + ' yet; send reconciled documents for posting first' : 'No documents have been created in Business Central for ' + A.monthLabel(), 'warn', { label: 'Open ' + (kind === 'AP' ? 'Before Posting' : kind === 'ACM' ? 'Before Credit Memo' : 'Integration'), fn: function () { A.go(kind === 'AP' ? 'AOP-BC-01' : kind === 'ACM' ? 'AOP-BC-03' : 'AOP-INT-01', 'm=' + month); } }); return null; }
            return { name: K.file + A.monthLabel().replace(' ', '_') + '.xlsx', sheet: K.sheet, rows: rows };
          },
          check: function (f) {
            var ext = f.objects.map(function (o) { return o['external document no']; });
            var known = ext.filter(function (x) { return A.M.docs.some(function (d) { return d.key === x; }); }).length;
            var mm = D.MONTHS.filter(function (x) { return x.key === month; })[0];
            var off = f.objects.filter(function (o) { var p = String(o['posting date'] || '').split('/'); return kind !== 'AP' && kind !== 'ACM' && p.length === 3 && !(+p[1] === mm.m && +p[2] === mm.y); }).length;
            if (off > f.objects.length / 2) return { title: 'Most posting dates are outside ' + mm.label, items: ['Choose the month the file belongs to'] };
            if (!known && ext.length) return { title: 'No External Document No in the file matches an Amazon document in the MTR' };
            A.q('#bccheck', main).innerHTML = '<div class="stats four"><div><span>Rows in File</span><b>' + A.fmtN(f.objects.length) + '</b></div><div><span>Found in MTR</span><b>' + A.fmtN(known) + '</b></div><div><span>Not in MTR</span><b>' + A.fmtN(ext.length - known) + '</b></div><div><span>Month</span><b>' + A.esc(mm.label) + '</b></div></div>';
            return null;
          },
          onReady: function (f) { file = f; go.disabled = false; },
          onClear: function () { file = null; go.disabled = true; A.q('#bccheck', main).innerHTML = ''; }
        });
        A.q('[data-tpl]', main).addEventListener('click', function () { A.xlsx(K.file + 'Template.xlsx', K.sheet, [K.head]); A.toast('Template downloaded'); });
        go.addEventListener('click', function () {
          if (!file || !A.need('bc.upload')) return;
          var id = nextId(M, kind, month);
          A.progress('Reconciling ' + file.name, ['Reading ' + A.plural(file.objects.length, 'row'), 'Finding each External Document No in the MTR', 'Comparing amounts (tolerance ' + A.fmtM2(D.TOLERANCE) + ')', 'Saving the reconciliation result'], function () {
            (A.state.bcu = A.state.bcu || []).push([kind, id, A.now(), A.role, file.name, month]);
            A.log('Business Central Upload', id, kindLabel[kind] + ', ' + D.monthLabel(month) + ', ' + A.plural(file.objects.length, 'row'));
            A.save(); A.refreshModel();
            var s = A.M.bcSummary(A.M.bcUpload(id));
            A.notify(s.bad ? 'warn' : 'ok', kindLabel[kind] + ' reconciliation for ' + D.monthLabel(month), A.fmtN(s.ok + s.warn) + ' matched, ' + s.bad + ' need review', 'AOP-BC-05', 'id=' + id, 'ADM FIN');
            A.resetTable('bcres-' + id);
            A.commit(id + ' reconciled: ' + A.fmtN(s.ok + s.warn) + ' matched, ' + s.bad + ' need review', s.bad ? 'warn' : 'ok');
          });
        });
      }
      var pb = A.q('[data-post]', main);
      if (pb) pb.addEventListener('click', function () {
        if (!A.need('bc.post')) return;
        if (!latest) { A.toast('Upload the Business Central extract and reconcile it before posting', 'warn'); return; }
        if (!ready.length) { A.toast(issues ? 'Resolve the documents that need review, or upload a new extract' : 'Every reconciled document has been sent for posting', 'warn'); return; }
        var amt = ready.reduce(function (t, r) { return t + r.bcAmount; }, 0);
        A.dialog({ title: 'Send for Posting', ok: 'Send for Posting', body: A.kv([['Documents', A.fmtN(ready.length)], ['Amount', A.fmtM2(amt)], ['Month', A.monthLabel()], ['Reconciled In', '<span class="mono">' + latest.id + '</span>'], ['Left Out', A.fmtN(issues) + ' documents that need review']]),
          onOk: function () {
            A.progress('Posting in Business Central', ['Creating job', 'Posting ' + A.plural(ready.length, 'document'), 'Collecting results'], function () {
              var j = A.startJob(A.M, postType, month, ready.map(function (r) { return r.doc.id; }));
              A.commit(j.id + ': ' + A.fmtN(j.ok.length) + ' posted' + (j.failed.length ? ', ' + j.failed.length + ' failed' : '') + '; upload the posted extract in ' + (kind === 'BP' ? 'Excel Upload After Posting' : 'Excel Upload After Credit Memo'), j.failed.length ? 'warn' : 'ok');
            });
          } });
      });
      if (latest) resultsTable(M, A.q('#res', main), latest, true);
      A.table(A.q('#hist', main), {
        id: 'bchist-' + kind, title: 'Upload History', noun: 'uploads', rows: M.bcUploads.filter(function (b) { return b.kind === kind; }), key: function (b) { return b.id; },
        filters: [{ label: 'Month', get: function (b) { return D.monthLabel(b.month); } }],
        rowCls: function (b) { return b.fresh ? 'row-fresh' : ''; },
        cols: [
          { h: 'Upload ID', v: function (b) { return b.id; }, f: function (b) { return A.a('AOP-BC-05', '<b>' + b.id + '</b>', 'id=' + b.id); }, cls: 'nowrap' },
          { h: 'Month', v: function (b) { return b.month; }, f: function (b) { return D.monthLabel(b.month); } },
          { h: 'File', v: function (b) { return b.file; }, cls: 'brk' },
          { h: 'Documents', v: function (b) { return M.bcSummary(b).total; }, num: true },
          { h: 'Matched', v: function (b) { var s = M.bcSummary(b); return s.ok + s.warn; }, num: true },
          { h: 'Needs Review', v: function (b) { return M.bcSummary(b).bad; }, num: true },
          { h: 'Uploaded By', v: function (b) { return A.person(b.by); } },
          { h: 'Uploaded', v: function (b) { return b.at; }, f: function (b) { return '<span class="nowrap">' + A.fmtDT(b.at) + '</span>'; } },
          { h: 'Status', v: function (b) { return M.bcSummary(b).bad ? 'Needs Review' : 'Reconciled'; }, f: function (b) { return M.bcSummary(b).bad ? A.chip('Needs Review', 'warn') : A.chip('Reconciled'); } }
        ]
      });
    };
  };
  A.def('AOP-BC-01', bcScreen('BP'));
  A.def('AOP-BC-02', bcScreen('AP'));
  A.def('AOP-BC-03', bcScreen('BCM'));
  A.def('AOP-BC-04', bcScreen('ACM'));

  // ---------- Business Central Upload Details ----------
  A.def('AOP-BC-05', function (M, main) {
    var b = M.bcUpload(A.param('id')) || M.bcUploads.filter(function (x) { return x.kind === 'BP'; })[0];
    if (b.kind === 'BCU') { location.replace(A.link('AOP-BC-06')); return; }
    var K = KIND[b.kind], s = M.bcSummary(b), latest = M.bcLatest(b.kind, b.month) === b;
    main.innerHTML = A.head(b.id, A.btn('Download Result', 'data-dl', '', 'download') + '<a class="btn pri" data-link="' + K.sid + '" data-q="m=' + b.month + '">' + K.title + '</a>', A.chip(kindLabel[b.kind], 'blue') + (latest ? A.chip('Latest for ' + D.monthLabel(b.month), 'plain') : A.chip('Replaced by a Newer File', 'plain'))) +
      '<div class="kpis">' + A.kpi('Documents', A.fmtN(s.total), A.chip(D.monthLabel(b.month), 'plain')) + A.kpi('Matched', A.fmtN(s.ok), A.chip(A.pct(s.ok, s.total) + '%', 'ok')) + A.kpi('Within Tolerance or Corrected', A.fmtN(s.warn), A.chip('Up to ' + A.fmtM2(D.TOLERANCE), 'plain')) + A.kpi('Needs Review', A.fmtN(s.bad), s.bad ? A.chip('Action Needed', 'bad') : A.chip('None', 'ok')) + '</div>' +
      A.card('Upload', A.kv([['Upload ID', '<span class="mono">' + b.id + '</span>'], ['Type', kindLabel[b.kind]], ['Month', D.monthLabel(b.month)], ['File', A.esc(b.file)], ['Uploaded By', A.esc(A.person(b.by))], ['Uploaded', A.fmtDT(b.at)], ['Amount in File', A.fmtM2(s.amount)]], 'cols')) + '<section class="card flush list" id="res"></section>';
    resultsTable(M, A.q('#res', main), b, latest);
    A.q('[data-dl]', main).addEventListener('click', function () {
      A.xlsx(b.id + '_Result.xlsx', 'Result', [['Business Central Document', 'Posted Document', 'External Document No', 'Customer', 'Business Central Amount', 'MTR Amount', 'Difference', 'Result', 'Reason']].concat(s.rows.map(function (r) { return [r.bcNo || '', r.postedNo || '', r.ext, r.customer || '', r.bcAmount == null ? '' : r.bcAmount, r.mtrAmount == null ? '' : r.mtrAmount, r.diff == null ? '' : r.diff, r.status, r.reason || '']; })));
      A.toast(A.plural(s.total, 'row') + ' downloaded');
    });
  });

  // ---------- Excel Upload BC Customer ----------
  A.def('AOP-BC-06', function (M, main) {
    var can = A.can('bc.customer');
    var ups = M.bcUploads.filter(function (b) { return b.kind === 'BCU'; });
    var last = ups[0];
    var cs = M.bcCustomers;
    main.innerHTML = A.head('Excel Upload BC Customer', '<a class="btn pri" data-link="AOP-MAP-02">Missing Customer</a>', A.chip('Last upload ' + A.fmtDT(last.at), 'plain')) +
      '<div class="kpis">' + A.kpi('Customers in Business Central', A.fmtN(cs.length), A.chip(A.plural(cs.filter(function (c) { return c.blocked; }).length, 'blocked'), 'plain')) +
      A.kpi('Amazon B2C Customers', A.fmtN(cs.filter(function (c) { return c.group === 'AMAZON-B2C'; }).length), A.chip('One per state', 'plain')) +
      A.kpi('Amazon B2B Customers', A.fmtN(cs.filter(function (c) { return c.group === 'AMAZON-B2B'; }).length), A.chip('By GSTIN', 'plain')) +
      A.kpi('Created by the Portal', A.fmtN(cs.filter(function (c) { return c.byPortal; }).length), A.chip('From Missing Customer', 'blue'), 'AOP-MAP-02') + '</div>' +
      (can ? '<section class="card"><header><h2>Upload Customer Master</h2></header><div class="body stack"><div id="cuup"></div><div id="cucheck"></div><div class="inline" style="justify-content:flex-end"><button class="btn" type="button" data-tpl>' + A.icon('download') + 'Download Template</button><button class="btn pri" type="button" data-go disabled>' + A.icon('upload') + 'Upload and Save</button></div></div></section>' : '') +
      '<section class="card flush list" id="cus"></section><section class="card flush list" id="hist"></section>';
    var file = null, go = A.q('[data-go]', main);
    if (can) {
      A.uploader(A.q('#cuup', main), {
        required: ['No.', 'Name', 'GST Customer Type', 'State Code', 'Customer Posting Group'],
        sample: function () {
          var all = cs.concat(D.BC_CUSTOMERS_NEXT.filter(function (n) { return !cs.some(function (c) { return c.no === n.no; }); }));
          return { name: 'BC_Customers_' + A.fmtDate(D.TODAY).replace(/\//g, '-') + '.xlsx', sheet: 'Customers', rows: [BCU_HEAD].concat(all.map(function (c) { return [c.no, c.name, c.gstin, c.type, c.state, c.group, c.terms, c.blocked ? 'All' : '']; })) };
        },
        check: function (f) {
          var nos = {}, dup = 0;
          f.objects.forEach(function (o) { if (nos[o['no.']]) dup++; nos[o['no.']] = 1; });
          if (dup) return { title: dup + ' customer numbers appear more than once' };
          var newOnes = f.objects.filter(function (o) { return !M.bcCustomer(o['no.']); }).length;
          var gone = cs.filter(function (c) { return !nos[c.no]; }).length;
          A.q('#cucheck', main).innerHTML = '<div class="stats four"><div><span>Customers in File</span><b>' + A.fmtN(f.objects.length) + '</b></div><div><span>New</span><b>' + newOnes + '</b></div><div><span>Unchanged</span><b>' + A.fmtN(f.objects.length - newOnes) + '</b></div><div><span>Not in File</span><b>' + gone + '</b></div></div>';
          return null;
        },
        onReady: function (f) { file = f; go.disabled = false; },
        onClear: function () { file = null; go.disabled = true; A.q('#cucheck', main).innerHTML = ''; }
      });
      A.q('[data-tpl]', main).addEventListener('click', function () { A.xlsx('BC_Customers_Template.xlsx', 'Customers', [BCU_HEAD]); A.toast('Template downloaded'); });
      go.addEventListener('click', function () {
        if (!file || !A.need('bc.customer')) return;
        var id = nextId(M, 'BCU', '2026-11');
        var before = M.missingCustomers.filter(function (m) { return m.status === 'Missing' && m.suggestMode === 'Map to Existing'; }).length;
        A.progress('Saving ' + file.name, ['Reading ' + A.plural(file.objects.length, 'customer'), 'Checking duplicates', 'Saving the customer master'], function () {
          (A.state.bcu = A.state.bcu || []).push(['BCU', id, A.now(), A.role, file.name, '']);
          A.log('Business Central Upload', id, 'Customer master, ' + A.plural(file.objects.length, 'customer'));
          A.save(); A.refreshModel();
          var after = A.M.missingCustomers.filter(function (m) { return m.status === 'Missing' && m.suggestMode === 'Map to Existing'; }).length;
          A.commit('Customer master saved: ' + A.plural(file.objects.length, 'customer') + (after > before ? '; ' + (after - before) + ' missing customer can now be mapped to an existing customer' : ''));
        });
      });
    }
    A.table(A.q('#cus', main), {
      id: 'bccus', title: 'Business Central Customers', noun: 'customers', rows: cs, key: function (c) { return c.no; }, exportName: 'BC_Customers', sheet: 'Customers', page: 12,
      search: { ph: 'Search by number, name or GSTIN', text: function (c) { return c.no + ' ' + c.name + ' ' + c.gstin; } },
      filters: [{ label: 'Customer Posting Group', get: function (c) { return c.group; } }, { label: 'GST Customer Type', get: function (c) { return c.type; } }],
      rowCls: function (c) { return c.byPortal || D.BC_CUSTOMERS_NEXT.indexOf(c) >= 0 ? 'row-fresh' : ''; },
      cols: [
        { h: 'Customer No', v: function (c) { return c.no; }, f: function (c) { return '<b class="mono">' + c.no + '</b>'; }, cls: 'nowrap' },
        { h: 'Name', v: function (c) { return c.name; } },
        { h: 'GSTIN', v: function (c) { return c.gstin; }, cls: 'mono nowrap' },
        { h: 'GST Customer Type', v: function (c) { return c.type; } },
        { h: 'State', v: function (c) { return D.state(c.state).name; } },
        { h: 'Customer Posting Group', v: function (c) { return c.group; } },
        { h: 'Payment Terms', v: function (c) { return c.terms; } },
        { h: 'Created', v: function (c) { return c.created; }, f: function (c) { return A.fmtDate(c.created); } },
        { h: 'Source', v: function (c) { return c.byPortal ? 'Created by Portal' : 'Business Central'; }, f: function (c) { return c.byPortal ? A.chip('Created by Portal', 'blue') : A.chip('Business Central', 'plain'); } },
        { h: 'Status', v: function (c) { return c.blocked ? 'Blocked' : 'Active'; }, f: function (c) { return A.chip(c.blocked ? 'Blocked' : 'Active'); } }
      ]
    });
    A.table(A.q('#hist', main), {
      id: 'cuhist', title: 'Upload History', noun: 'uploads', rows: ups, key: function (b) { return b.id; },
      cols: [
        { h: 'Upload ID', v: function (b) { return b.id; }, f: function (b) { return '<b class="mono">' + b.id + '</b>'; } },
        { h: 'File', v: function (b) { return b.file; } },
        { h: 'Customers', v: function (b) { return M.bcRows(b).length; }, num: true },
        { h: 'Uploaded By', v: function (b) { return A.person(b.by); } },
        { h: 'Uploaded', v: function (b) { return b.at; }, f: function (b) { return A.fmtDT(b.at); } },
        { h: 'Status', v: function () { return 'Saved'; }, f: function () { return A.chip('Saved'); } }
      ]
    });
  });
})();
