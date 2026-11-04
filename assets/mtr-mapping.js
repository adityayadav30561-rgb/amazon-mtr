/*
 * Missing Data and Mapping: Amazon SKU Mapping (AOP-MAP-01) and Missing Customer (AOP-MAP-02).
 * A.mapSkuDialog is also used by the item error list.
 */
(function () {
  var A = window.APP, D = window.MTRDATA;

  var linesFor = function (M, sku, openOnly) { return M.itemErrors.filter(function (e) { return e.line.sku === sku && (e.how === 'sku' || e.how === 'blocked') && (!openOnly || e.status === 'Open'); }).length; };
  var mtrLines = function (M, sku) { var n = 0; M.docs.forEach(function (d) { if (d.month === '2026-10') d.lines.forEach(function (l) { if (l.sku === sku) n++; }); }); return n; };

  A.mapSkuDialog = function (sku, remap) {
    if (!A.need('map.sku')) return;
    var M = A.M, L = M.listing(sku);
    var items = D.ITEMS.slice().sort(function (a, b) { return (b.no === L.suggest) - (a.no === L.suggest) || (a.no < b.no ? -1 : 1); });
    var cur = remap ? (L.suggest || 'FG-10025') : (L.item || L.suggest || items[0].no);
    if (remap && cur === L.base) cur = 'FG-10025';
    A.dialog({ title: (L.item && !remap ? 'Change Mapping' : 'Map Amazon SKU'), ok: 'Save Mapping', wide: false,
      body: A.kv([['Amazon SKU', '<span class="mono">' + A.esc(sku) + '</span>'], ['ASIN', '<span class="mono">' + L.asin + '</span>'], ['Listing', A.esc(L.title)], ['Lines Waiting', A.fmtN(linesFor(M, sku, true))]]) +
        '<div class="form-grid" style="margin-top:1rem">' +
        A.field('mi', 'Business Central Item', A.select('mi', items.map(function (i) { return { value: i.no, label: i.no + ' · ' + i.name + (i.no === L.suggest ? ' (suggested)' : '') + (M.itemBlocked(i.no) ? ' (blocked)' : '') }; }), cur), true) +
        A.field('mf', 'Quantity per Amazon Unit', A.input('mf', L.factor || 1, '', ' type="number" min="1" max="50" step="1"')) +
        A.field('mu', 'Unit of Measure', '<input class="input" id="mu" readonly value="' + A.esc(D.item(cur).uom) + '">') +
        '</div>',
      onOpen: function (box) { A.q('#mi', box).addEventListener('change', function () { A.q('#mu', box).value = D.item(A.q('#mi', box).value).uom; }); },
      onOk: function (box) {
        var no = A.q('#mi', box).value, f = +A.q('#mf', box).value;
        if (M.itemBlocked(no)) return A.invalid(box, 'mi', 'Item ' + no + ' is blocked in Business Central; choose another item');
        if (!(f >= 1 && f <= 50 && Math.round(f) === f)) return A.invalid(box, 'mf', 'Enter a whole number from 1 to 50');
        var waiting = linesFor(M, sku, true);
        A.state.map = A.state.map || {};
        A.state.map[sku] = [no, f, A.now(), A.role];
        A.log('SKU Mapped', sku, 'Mapped to ' + no + (f > 1 ? ' × ' + f : ''));
        A.commit(sku + ' mapped to ' + no + (waiting ? '; ' + A.plural(waiting, 'item error') + ' resolved' : ''));
      } });
  };

  // ---------- Amazon SKU Mapping ----------
  A.def('AOP-MAP-01', function (M, main) {
    var rows = M.listings.map(function (l) { return { l: l, open: linesFor(M, l.sku, true), lines: mtrLines(M, l.sku) }; });
    var unm = rows.filter(function (r) { return !r.l.item; });
    var can = A.can('map.sku');
    main.innerHTML = A.head('Amazon SKU Mapping', (can ? A.btn('Upload Mapping File', 'data-upmap', '', 'upload') : '') + '<a class="btn pri" data-link="AOP-MTR-06" data-q="type=SKU Not Mapped">Item Errors</a>') +
      '<div class="kpis">' +
      A.kpi('Amazon SKUs', A.fmtN(rows.length), A.chip(A.plural(D.ITEMS.length, 'Business Central item'), 'plain')) +
      A.kpi('Mapped', A.fmtN(rows.length - unm.length), A.chip(A.pct(rows.length - unm.length, rows.length) + '%', 'ok')) +
      A.kpi('Not Mapped', A.fmtN(unm.length), unm.length ? A.chip('Blocks Posting', 'bad') : A.chip('None', 'ok'), A.screen, 'tab=Not Mapped') +
      A.kpi('October Lines Waiting', A.fmtN(unm.reduce(function (t, r) { return t + r.open; }, 0)), A.chip('SKU Not Mapped', 'plain'), 'AOP-MTR-06', 'type=SKU Not Mapped') +
      '</div><section class="card flush list" id="skus"></section>';
    var t = A.table(A.q('#skus', main), {
      id: 'skus', noun: 'SKUs', rows: rows, key: function (r) { return r.l.sku; }, exportName: 'Amazon_SKU_Mapping', sheet: 'SKU Mapping',
      tabs: [{ label: unm.length ? 'Not Mapped' : 'All SKUs', test: unm.length ? function (r) { return !r.l.item; } : null }].concat(unm.length ? [{ label: 'Mapped', test: function (r) { return !!r.l.item; } }, { label: 'All SKUs' }] : [{ label: 'Not Mapped', test: function (r) { return !r.l.item; } }, { label: 'Mapped', test: function (r) { return !!r.l.item; } }]),
      search: { ph: 'Search by SKU, ASIN, item or listing', text: function (r) { return r.l.sku + ' ' + r.l.asin + ' ' + (r.l.item || '') + ' ' + r.l.title; } },
      filters: [{ label: 'Business Central Item', get: function (r) { return r.l.item || 'Not Mapped'; } }],
      rowCls: function (r) { return r.l.fresh ? 'row-fresh' : ''; },
      cols: [
        { h: 'Amazon SKU', v: function (r) { return r.l.sku; }, f: function (r) { return '<b class="mono">' + A.esc(r.l.sku) + '</b>'; }, cls: 'nowrap' },
        { h: 'ASIN', v: function (r) { return r.l.asin; }, cls: 'mono' },
        { h: 'Listing', v: function (r) { return r.l.title; } },
        { h: 'Business Central Item', v: function (r) { return r.l.item || ''; }, f: function (r) { return r.l.item ? '<span class="mono">' + r.l.item + '</span>' + (M.itemBlocked(r.l.item) ? ' ' + A.chip('Blocked', 'bad') : '') : A.chip('Not Mapped', 'bad'); }, cls: 'nowrap' },
        { h: 'Item Description', v: function (r) { return r.l.item ? D.item(r.l.item).name : ''; } },
        { h: 'Quantity per Unit', v: function (r) { return r.l.factor; }, num: true },
        { h: 'October Lines', v: function (r) { return r.lines; }, f: function (r) { return A.fmtN(r.lines); }, num: true },
        { h: 'Mapped By', v: function (r) { return r.l.mappedBy ? A.person(r.l.mappedBy) : ''; } },
        { h: 'Mapped On', v: function (r) { return r.l.mappedOn || 0; }, x: function (r) { return r.l.mappedOn ? A.fmtDate(r.l.mappedOn) : ''; }, f: function (r) { return r.l.mappedOn ? A.fmtDate(r.l.mappedOn) : ''; } },
        { h: 'Action', nosort: true, noexport: true, f: function (r) { return can ? '<button class="btn sm' + (r.l.item ? '' : ' pri') + '" type="button" data-map="' + A.esc(r.l.sku) + '">' + (r.l.item ? 'Change' : 'Map SKU') + '</button>' : A.chip('View Only', 'plain'); } }
      ],
      after: function (el) { A.qa('[data-map]', el).forEach(function (b) { b.addEventListener('click', function () { A.mapSkuDialog(b.getAttribute('data-map')); }); }); }
    });
    if (A.param('q')) { t.state.q = A.param('q'); t.state.tab = 'All SKUs'; t.draw(); A.params.delete('q'); }
    var ub = A.q('[data-upmap]', main);
    if (ub) ub.addEventListener('click', function () {
      var ready = null;
      var d = A.dialog({ title: 'Upload Mapping File', ok: 'Apply Mappings', wide: true, body: '<div id="mup"></div><div id="mres" style="margin-top:1rem"></div>',
        extra: [{ label: 'Download Template', fn: function () { A.xlsx('Amazon_SKU_Mapping_Template.xlsx', 'SKU Mapping', [['Amazon SKU', 'ASIN', 'Business Central Item No', 'Quantity per Amazon Unit']].concat(unm.map(function (r) { return [r.l.sku, r.l.asin, '', 1]; }))); A.toast('Template downloaded with ' + A.plural(unm.length, 'unmapped SKU')); return false; } }],
        onOk: function (box) {
          if (!ready) { A.toast('Choose a mapping file first', 'warn'); return false; }
          var good = ready.filter(function (r) { return r.ok; });
          if (!good.length) { A.toast('No rows can be applied', 'bad'); return false; }
          A.state.map = A.state.map || {};
          var t0 = A.now();
          good.forEach(function (r) { A.state.map[r.sku] = [r.item, r.f, t0, A.role]; });
          A.log('SKU Mapping File Uploaded', A.plural(good.length, 'SKU'), good.map(function (r) { return r.sku + ' → ' + r.item; }).join(', '));
          A.commit(A.plural(good.length, 'SKU') + ' mapped from the file');
        } });
      A.uploader(A.q('#mup', d.box), {
        required: ['Amazon SKU', 'Business Central Item No', 'Quantity per Amazon Unit'],
        sample: function () { return { name: 'Amazon_SKU_Mapping_Completed.xlsx', sheet: 'SKU Mapping', rows: [['Amazon SKU', 'ASIN', 'Business Central Item No', 'Quantity per Amazon Unit']].concat(unm.map(function (r) { return [r.l.sku, r.l.asin, r.l.suggest, 1]; })) }; },
        sampleLabel: 'Use Completed Sample',
        onReady: function (f) {
          ready = f.objects.map(function (o) {
            var sku = o['amazon sku'], no = String(o['business central item no']).toUpperCase(), fq = +(o['quantity per amazon unit'] || 1), L = M.listing(sku), r = { sku: sku, item: no, f: fq };
            if (!L) r.err = 'Amazon SKU not found';
            else if (!no) r.err = 'Business Central Item No is empty';
            else if (!D.item(no)) r.err = 'Item ' + no + ' is not in Business Central';
            else if (M.itemBlocked(no)) r.err = 'Item ' + no + ' is blocked';
            else if (!(fq >= 1 && fq <= 50)) r.err = 'Quantity per Amazon Unit must be 1 to 50';
            r.ok = !r.err; return r;
          });
          A.q('#mres', d.box).innerHTML = '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Amazon SKU</th><th>Business Central Item</th><th class="num">Quantity</th><th>Result</th></tr></thead><tbody>' + ready.map(function (r) { return '<tr><td class="mono">' + A.esc(r.sku) + '</td><td class="mono">' + A.esc(r.item) + '</td><td class="num">' + r.f + '</td><td>' + (r.ok ? A.chip('Ready') : A.chip(r.err, 'bad')) + '</td></tr>'; }).join('') + '</tbody></table></div>';
        },
        onClear: function () { ready = null; A.q('#mres', d.box).innerHTML = ''; }
      });
    });
  });

  // ---------- Missing Customer ----------
  var CUST_HEAD = ['Customer Key', 'Customer Type', 'Customer in MTR', 'Buyer GSTIN', 'State', 'State Code', 'Documents', 'Amount', 'Action', 'Business Central Customer No', 'Customer Name', 'Customer Posting Group', 'Payment Terms'];
  var custRow = function (m, filled) {
    return [m.key, m.kind, m.name, m.gstinNo, m.stateName, m.stateCode, m.docs.length, Math.round(m.amount * 100) / 100,
      filled ? m.suggestMode : '', filled ? m.suggestNo : '', filled ? (m.kind === 'B2C' ? 'Amazon B2C Customer — ' + m.stateName : m.name) : '', m.kind === 'B2C' ? 'AMAZON-B2C' : 'AMAZON-B2B', m.kind === 'B2C' ? 'Immediate' : '30 Days'];
  };
  var applyCustomer = function (M, m, mode, no, name) {
    A.state.cus = A.state.cus || {};
    A.state.cus[m.key] = [mode, no, name, A.now(), A.role];
    A.log(mode === 'N' ? 'Customer Created' : 'Customer Mapped', no, m.name);
  };
  var checkCustomer = function (M, m, mode, no, name) {
    if (!no) return 'Business Central Customer No is empty';
    var c = M.bcCustomer(no);
    if (mode === 'E') {
      if (!c) return 'Customer ' + no + ' is not in the Business Central customer list; upload the latest list or choose Create New';
      if (c.blocked) return 'Customer ' + no + ' is blocked in Business Central';
      if (m.kind === 'B2B' && c.gstin !== m.gstinNo) return 'GSTIN of ' + no + ' (' + (c.gstin || 'none') + ') does not match ' + m.gstinNo;
      if (m.kind === 'B2C' && c.type !== 'Unregistered') return 'Customer ' + no + ' is a registered business, not a B2C customer';
    } else {
      if (c) return 'Customer ' + no + ' already exists in Business Central; choose Map to Existing';
      if (!/^[A-Z0-9-]{4,20}$/.test(no)) return 'Use 4 to 20 capital letters, numbers or hyphens';
      if (!name || name.length < 3) return 'Customer Name is empty';
    }
    return '';
  };
  var custDialog = function (M, m) {
    if (!A.need('map.customer')) return;
    var group = m.kind === 'B2C' ? 'AMAZON-B2C' : 'AMAZON-B2B';
    var candidates = M.bcCustomers.filter(function (c) { return c.group === group && !c.blocked; });
    var mode = m.suggestMode === 'Map to Existing' ? 'E' : 'N';
    A.dialog({ title: 'Resolve ' + m.name, ok: 'Save', wide: true,
      body: A.kv([['Customer in MTR', A.esc(m.name)], ['Type', m.kind], m.gstinNo ? ['Buyer GSTIN', '<span class="mono">' + m.gstinNo + '</span>'] : null, ['State', A.esc(m.stateName) + ' (' + m.stateCode + ')'], ['Documents Waiting', A.fmtN(m.docs.length) + ' · ' + A.fmtM2(m.amount)]]) +
        '<div class="hint-row" style="margin:1rem 0" role="radiogroup"><label class="radio' + (mode === 'E' ? ' on' : '') + '"><input type="radio" name="cm" value="E"' + (mode === 'E' ? ' checked' : '') + '> Map to Existing Customer</label><label class="radio' + (mode === 'N' ? ' on' : '') + '"><input type="radio" name="cm" value="N"' + (mode === 'N' ? ' checked' : '') + '> Create New Customer</label></div>' +
        '<div class="form-grid" data-mode="E"' + (mode === 'E' ? '' : ' hidden') + '>' + A.field('ce', 'Business Central Customer', A.select('ce', candidates.map(function (c) { return { value: c.no, label: c.no + ' · ' + c.name + (c.gstin ? ' · ' + c.gstin : '') }; }), M.bcCustomer(m.suggestNo) ? M.bcCustomer(m.suggestNo).no : (candidates[0] || {}).no), true) + '</div>' +
        '<div class="form-grid" data-mode="N"' + (mode === 'N' ? '' : ' hidden') + '>' + A.field('cn', 'Customer No', A.input('cn', m.suggestNo)) + A.field('cg', 'GST Registration Type', '<input class="input" id="cg" readonly value="' + (m.kind === 'B2B' ? 'Registered' : 'Unregistered') + '">') +
        A.field('cnm', 'Customer Name', A.input('cnm', m.kind === 'B2C' ? 'Amazon B2C Customer — ' + m.stateName : m.name), true) + A.field('cpg', 'Customer Posting Group', '<input class="input" id="cpg" readonly value="' + group + '">') + A.field('cpt', 'Payment Terms', A.select('cpt', ['Immediate', '15 Days', '30 Days', '45 Days'], m.kind === 'B2C' ? 'Immediate' : '30 Days')) + '</div>',
      onOpen: function (box) {
        A.qa('input[name=cm]', box).forEach(function (r) { r.addEventListener('change', function () { A.qa('.radio', box).forEach(function (l) { l.classList.toggle('on', A.q('input', l).checked); }); A.qa('[data-mode]', box).forEach(function (g) { g.hidden = g.getAttribute('data-mode') !== r.value; }); }); });
      },
      onOk: function (box) {
        var md = A.q('input[name=cm]:checked', box).value;
        var no = md === 'E' ? A.q('#ce', box).value : A.q('#cn', box).value.trim().toUpperCase();
        var nm = md === 'E' ? (M.bcCustomer(no) || {}).name : A.q('#cnm', box).value.trim();
        if (md === 'E' && !no) { A.toast('There is no Business Central customer of this type to map to; choose Create New', 'bad'); return false; }
        var er = checkCustomer(M, m, md, no, nm);
        if (er) return md === 'E' ? A.invalid(box, 'ce', er) : A.invalid(box, /Name/.test(er) ? 'cnm' : 'cn', er);
        applyCustomer(M, m, md, no, nm);
        if (md === 'N') A.notify('ok', 'Customer ' + no + ' created in Business Central', nm + ' was created through the integration', 'AOP-BC-06', '', 'ADM OPS FIN');
        A.commit(m.name + (md === 'N' ? ' created as ' : ' mapped to ') + no + '; ' + A.plural(m.docs.length, 'document') + ' released');
      } });
  };

  A.def('AOP-MAP-02', function (M, main) {
    var miss = M.missingCustomers;
    var open = miss.filter(function (m) { return m.status === 'Missing'; });
    var rows = miss.map(function (m) { return { m: m, month: 'October 2026', key: m.key }; }).concat(M.resolvedCustomerHistory.map(function (h) { return { h: h, month: h.at < D.dt(2026, 10, 1) ? 'August 2026' : 'September 2026', key: h.key + '|h' }; }));
    var can = A.can('map.customer');
    var waiting = open.reduce(function (t, m) { return t + m.docs.length; }, 0), amt = open.reduce(function (t, m) { return t + m.amount; }, 0);
    main.innerHTML = A.head('Missing Customer', A.btn('Download Missing Customers', 'data-dlm', '', 'download') + '<a class="btn pri" data-link="AOP-BC-06">Business Central Customers</a>', open.length ? A.chip(open.length + ' missing', 'bad') : A.chip('None Missing', 'ok')) +
      '<div class="kpis">' + A.kpi('Missing Customers', A.fmtN(open.length), A.chip(open.filter(function (m) { return m.kind === 'B2C'; }).length + ' B2C, ' + open.filter(function (m) { return m.kind === 'B2B'; }).length + ' B2B', 'plain')) +
      A.kpi('Documents Waiting', A.fmtN(waiting), A.chip('Customer Not Mapped', waiting ? 'bad' : 'ok'), 'AOP-MTR-05', 'type=Customer Not Mapped') + A.kpi('Amount Waiting', A.fmtML(amt), A.chip('October 2026', 'plain')) +
      A.kpi('Resolved in October 2026', A.fmtN(miss.length - open.length), A.chip(miss.filter(function (m) { return m.status === 'Created'; }).length + ' created, ' + miss.filter(function (m) { return m.status === 'Mapped'; }).length + ' mapped', 'plain')) + '</div>' +
      (can ? '<section class="card"><header><h2>Upload Completed File</h2></header><div class="body stack"><ol class="steps"><li class="done"><i>1</i>Download Missing Customers</li><li class="now"><i>2</i>Fill In Action and Customer</li><li><i>3</i>Upload and Apply</li></ol><div id="cup"></div><div id="cres"></div></div></section>' : '') +
      '<section class="card flush list" id="cust"></section>';
    A.q('[data-dlm]', main).addEventListener('click', function () {
      if (!open.length) { A.toast('No customers are missing', 'warn'); return; }
      A.xlsx('Missing_Customers_October_2026.xlsx', 'Missing Customers', [CUST_HEAD].concat(open.map(function (m) { return custRow(m, false); })));
      A.toast(A.plural(open.length, 'missing customer') + ' downloaded; fill in Action, Business Central Customer No and Customer Name');
    });
    var pending = null;
    var resBox = A.q('#cres', main);
    var drawRes = function () {
      if (!pending) { resBox.innerHTML = ''; return; }
      var ok = pending.filter(function (r) { return r.ok; }).length;
      resBox.innerHTML = '<div class="table-wrap"><table class="tbl wrap"><thead><tr><th>Row</th><th>Customer in MTR</th><th>Action</th><th>Business Central Customer</th><th>Result</th></tr></thead><tbody>' +
        pending.map(function (r) { return '<tr><td class="num">' + r.row + '</td><td>' + A.esc(r.name) + '</td><td>' + A.esc(r.action || '—') + '</td><td class="mono">' + A.esc(r.no || '') + '</td><td>' + (r.ok ? A.chip('Ready') : A.chip(r.err, r.skip ? 'plain' : 'bad')) + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="inline" style="justify-content:flex-end;margin-top:1rem">' + A.chip(ok + ' of ' + pending.length + ' rows ready', ok ? 'ok' : 'bad') + '<button class="btn pri" type="button" data-apply' + (ok ? '' : ' disabled') + '>Apply ' + A.plural(ok, 'Row') + '</button></div>';
      var ap = A.q('[data-apply]', resBox);
      ap.addEventListener('click', function () {
        if (!A.need('map.customer')) return;
        var good = pending.filter(function (r) { return r.ok; });
        A.progress('Applying ' + A.plural(good.length, 'customer'), ['Checking Business Central customers', 'Creating new customers through the integration', 'Saving customer mappings', 'Releasing documents waiting for a customer'], function () {
          var created = 0;
          good.forEach(function (r) { applyCustomer(M, r.m, r.mode, r.no, r.cname); if (r.mode === 'N') created++; });
          if (created) A.notify('ok', A.plural(created, 'customer') + ' created in Business Central', 'Created from the missing customer file', 'AOP-BC-06', '', 'ADM OPS FIN');
          A.log('Missing Customer File Uploaded', A.plural(good.length, 'customer'), created + ' created, ' + (good.length - created) + ' mapped');
          pending = null;
          A.commit(A.plural(good.length, 'customer') + ' resolved: ' + created + ' created, ' + (good.length - created) + ' mapped');
        });
      });
    };
    if (can) A.uploader(A.q('#cup', main), {
      required: ['Customer Key', 'Action', 'Business Central Customer No', 'Customer Name'],
      sampleLabel: 'Use Completed Sample',
      sample: function () {
        if (!open.length) { A.toast('No customers are missing', 'warn'); return null; }
        return { name: 'Missing_Customers_October_2026_Completed.xlsx', sheet: 'Missing Customers', rows: [CUST_HEAD].concat(open.map(function (m) { return custRow(m, true); })) };
      },
      onReady: function (f) {
        pending = f.objects.map(function (o, i) {
          var key = o['customer key'], m = M.missingCustomers.filter(function (x) { return x.key === key; })[0];
          var act = o['action'], no = String(o['business central customer no'] || '').toUpperCase(), nm = o['customer name'];
          var r = { row: i + 2, name: m ? m.name : (o['customer in mtr'] || key), action: act, no: no, cname: nm, m: m };
          if (!m) r.err = 'Not a missing customer in October 2026';
          else if (m.status !== 'Missing') r.err = 'Already ' + m.status.toLowerCase() + ' as ' + m.bcNo;
          else if (!act) { r.err = 'Skipped: Action is empty'; r.skip = true; }
          else if (act !== 'Map to Existing' && act !== 'Create New') r.err = 'Action must be Map to Existing or Create New';
          else { r.mode = act === 'Create New' ? 'N' : 'E'; if (r.mode === 'E' && M.bcCustomer(no)) r.cname = M.bcCustomer(no).name; r.err = checkCustomer(M, m, r.mode, no, r.cname); }
          r.ok = !r.err; return r;
        });
        // the same Business Central number twice in one file
        var seen = {};
        pending.forEach(function (r) { if (r.ok && r.mode === 'N') { if (seen[r.no]) { r.ok = false; r.err = 'Customer No ' + r.no + ' is used twice in the file'; } seen[r.no] = 1; } });
        drawRes();
      },
      onClear: function () { pending = null; drawRes(); }
    });
    var ct = A.table(A.q('#cust', main), {
      id: 'cust', noun: 'customers', rows: rows, key: function (r) { return r.key; }, exportName: 'Missing_Customers', sheet: 'Customers',
      tabs: [{ label: 'Missing', test: function (r) { return r.m && r.m.status === 'Missing'; } }, { label: 'Resolved', test: function (r) { return !r.m || r.m.status !== 'Missing'; } }, { label: 'All Customers' }],
      search: { ph: 'Search by customer, GSTIN or Business Central number', text: function (r) { var x = r.m || r.h; return x.name + ' ' + (x.gstinNo || '') + ' ' + (x.bcNo || ''); } },
      filters: [{ label: 'Type', get: function (r) { return (r.m || r.h).kind; } }, { label: 'Month', get: function (r) { return r.month; } }],
      cols: [
        { h: 'Customer in MTR', v: function (r) { return (r.m || r.h).name; }, f: function (r) { return '<b>' + A.esc((r.m || r.h).name) + '</b>'; } },
        { h: 'Type', v: function (r) { return (r.m || r.h).kind; }, f: function (r) { return A.chip((r.m || r.h).kind, 'plain'); } },
        { h: 'Buyer GSTIN', v: function (r) { return r.m ? r.m.gstinNo : ''; }, cls: 'mono nowrap' },
        { h: 'State', v: function (r) { return r.m ? r.m.stateName : D.state(r.h.key.split('|')[1].slice(0, 2)).name; } },
        { h: 'Month', v: function (r) { return r.month; } },
        { h: 'Documents', v: function (r) { return r.m ? r.m.docs.length : r.h.docs; }, num: true },
        { h: 'Amount', v: function (r) { return r.m ? r.m.amount : 0; }, f: function (r) { return r.m ? A.fmtM2(r.m.amount) : ''; }, num: true },
        { h: 'Business Central Customer', v: function (r) { return r.m ? r.m.bcNo : r.h.bcNo; }, f: function (r) { var no = r.m ? r.m.bcNo : r.h.bcNo; return no ? '<span class="mono">' + no + '</span>' : (r.m ? A.chip(r.m.suggestMode === 'Map to Existing' ? 'Exists: ' + r.m.suggestNo : 'Not in Business Central', r.m.suggestMode === 'Map to Existing' ? 'blue' : 'warn') : ''); } },
        { h: 'Status', v: function (r) { return (r.m || r.h).status; }, f: function (r) { var s = (r.m || r.h).status; return A.chip(s, s === 'Missing' ? 'bad' : 'ok'); } },
        { h: 'Action', nosort: true, noexport: true, f: function (r) { if (!r.m) return '<span class="muted">' + A.esc(A.person(r.h.by)) + ' · ' + A.fmtDate(r.h.at) + '</span>'; if (r.m.status !== 'Missing') return '<span class="muted">' + A.esc(A.person(r.m.resolvedBy)) + ' · ' + A.fmtDate(r.m.resolvedAt) + '</span>'; return can ? '<button class="btn sm pri" type="button" data-res="' + A.esc(r.m.key) + '">' + (r.m.suggestMode === 'Map to Existing' ? 'Map Customer' : 'Create Customer') + '</button>' : A.chip('View Only', 'plain'); } }
      ],
      after: function (el) { A.qa('[data-res]', el).forEach(function (b) { b.addEventListener('click', function () { custDialog(M, M.missingCustomers.filter(function (m) { return m.key === b.getAttribute('data-res'); })[0]); }); }); }
    });
    if (A.param('q')) { ct.state.q = A.param('q'); ct.state.tab = 'All Customers'; ct.draw(); A.params.delete('q'); }
  });
})();
