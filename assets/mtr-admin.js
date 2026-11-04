/*
 * Administration: Seller GSTIN Setup (AOP-SET-01), User Management (AOP-USR-01), User Details (02),
 * Roles and Permissions (03), Audit Activity (AOP-AUD-01).
 */
(function () {
  var A = window.APP, D = window.MTRDATA, P = window.PORTAL;
  var PAN = 'AAHCC4821K';
  var LOCS = ['AMZ-BOM7', 'AMZ-BLR8', 'AMZ-DEL4', 'AMZ-HYD8', 'AMZ-MAA4', 'BHW-MAIN'];
  var DIMS = ['AMAZON-NORTH', 'AMAZON-SOUTH', 'AMAZON-WEST', 'AMAZON-EAST'];

  // ---------- Seller GSTIN Setup ----------
  var gstDialog = function (M, g) {
    if (!A.need('setup.gstin')) return;
    var known = g ? M.gstin(g) : null;
    A.dialog({ title: known && known.configured ? 'Edit Seller GSTIN' : 'Set Up Seller GSTIN', ok: 'Save', wide: true,
      body: '<div class="form-grid">' + A.field('gg', 'Seller GSTIN', A.input('gg', g || '', '33AAHCC4821K1Z4', known ? ' readonly' : '')) + A.field('gs', 'State', '<input class="input" id="gs" readonly value="' + A.esc(known ? D.state(known.state).name : '') + '">') +
        A.field('gf', 'Fulfilment Centre Code', A.input('gf', known ? known.fc : '', 'MAA4', known ? ' readonly' : '')) + A.field('gn', 'Fulfilment Centre Name', A.input('gn', known ? known.fcName : '', 'Sriperumbudur', known ? ' readonly' : '')) +
        A.field('gl', 'Business Central Location', A.select('gl', LOCS, known ? known.location : 'AMZ-MAA4')) + A.field('gd', 'Dimension', A.select('gd', DIMS, known ? known.dimension : 'AMAZON-SOUTH')) + '</div>',
      onOpen: function (box) { var i = A.q('#gg', box); i.addEventListener('input', function () { var s = D.state(i.value.slice(0, 2)); A.q('#gs', box).value = s ? s.name : ''; }); },
      onOk: function (box) {
        var v = A.q('#gg', box).value.trim().toUpperCase(), fc = A.q('#gf', box).value.trim().toUpperCase(), fn = A.q('#gn', box).value.trim();
        if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) return A.invalid(box, 'gg', 'Enter a 15-character GSTIN, for example 33AAHCC4821K1Z4');
        if (!D.state(v.slice(0, 2))) return A.invalid(box, 'gg', 'The first two digits are not an Indian state code');
        if (v.slice(2, 12) !== PAN) return A.invalid(box, 'gg', 'The PAN in the GSTIN must be Crestline Laminates’ PAN ' + PAN);
        if (!known && M.gstin(v)) return A.invalid(box, 'gg', 'This GSTIN is already set up');
        if (!/^[A-Z0-9]{3,6}$/.test(fc)) return A.invalid(box, 'gf', 'Enter the fulfilment centre code, for example MAA4');
        if (fn.length < 3) return A.invalid(box, 'gn', 'Enter the fulfilment centre name');
        var waiting = M.headerErrors.filter(function (e) { return e.how === 'gstin' && e.doc.gstin === v && e.status === 'Open'; }).length;
        A.state.gst = A.state.gst || {};
        A.state.gst[v] = [A.q('#gl', box).value, A.now(), A.role, A.q('#gd', box).value, fc, fn];
        A.log('Seller GSTIN Set Up', v, fc + ' ' + fn + ', location ' + A.q('#gl', box).value);
        var u = new URL(location.href); u.searchParams.delete('add'); try { history.replaceState(null, '', u.toString()); } catch (e) { /* ignore */ }
        A.commit(v + ' saved' + (waiting ? '; ' + A.plural(waiting, 'header error') + ' resolved' : ''));
      } });
  };
  A.def('AOP-SET-01', function (M, main) {
    var rows = M.gstins;
    var count = function (g) { return M.docs.filter(function (d) { return d.gstin === g && d.month === '2026-10'; }).length; };
    main.innerHTML = A.head('Seller GSTIN Setup', A.btn('Add Seller GSTIN', 'data-add', 'pri', 'plus')) +
      '<div class="kpis">' + A.kpi('Seller GSTINs', A.fmtN(rows.length), A.chip(A.plural(new Set(rows.map(function (g) { return g.state; })).size, 'state'), 'plain')) + A.kpi('Set Up', A.fmtN(rows.filter(function (g) { return g.configured; }).length), A.chip('Posting Allowed', 'ok')) +
      A.kpi('Not Set Up', A.fmtN(rows.filter(function (g) { return !g.configured; }).length), rows.some(function (g) { return !g.configured; }) ? A.chip('Blocks Posting', 'bad') : A.chip('None', 'ok')) + A.kpi('Seller-Fulfilled Warehouse', D.MFN.fc, A.chip(D.MFN.location, 'plain')) + '</div>' +
      '<section class="card flush list" id="gst"></section>';
    A.q('[data-add]', main).addEventListener('click', function () { gstDialog(M, null); });
    A.table(A.q('#gst', main), {
      id: 'gst', noun: 'Seller GSTINs', rows: rows, key: function (g) { return g.gstin; }, exportName: 'Seller_GSTINs',
      rowCls: function (g) { return !g.configured ? '' : g.configuredAt ? 'row-fresh' : ''; },
      cols: [
        { h: 'Seller GSTIN', v: function (g) { return g.gstin; }, f: function (g) { return '<b class="mono">' + g.gstin + '</b>'; }, cls: 'nowrap' },
        { h: 'State', v: function (g) { return D.state(g.state).name; } },
        { h: 'Fulfilment Centre', v: function (g) { return g.fc; }, f: function (g) { return '<span class="mono">' + g.fc + '</span>'; } },
        { h: 'Centre Name', v: function (g) { return g.fcName; } },
        { h: 'Business Central Location', v: function (g) { return g.configured ? g.location : ''; }, f: function (g) { return g.configured ? '<span class="mono">' + g.location + '</span>' : '—'; } },
        { h: 'Dimension', v: function (g) { return g.configured ? g.dimension : ''; } },
        { h: 'Shipping Since', v: function (g) { return g.since; }, f: function (g) { return A.fmtDate(g.since); } },
        { h: 'October Documents', v: function (g) { return count(g.gstin); }, num: true },
        { h: 'Status', v: function (g) { return g.configured ? 'Set Up' : 'Not Set Up'; }, f: function (g) { return A.chip(g.configured ? 'Configured' : 'Not Configured'); } },
        { h: 'Action', nosort: true, noexport: true, f: function (g) { return '<button class="btn sm' + (g.configured ? '' : ' pri') + '" type="button" data-g="' + g.gstin + '">' + (g.configured ? 'Edit' : 'Set Up') + '</button>'; } }
      ],
      after: function (el) { A.qa('[data-g]', el).forEach(function (b) { b.addEventListener('click', function () { gstDialog(M, b.getAttribute('data-g')); }); }); }
    });
    var add = A.param('add');
    if (add && M.gstin(add) && !M.gstin(add).configured) setTimeout(function () { gstDialog(M, add); }, 150);
  });

  // ---------- User Management ----------
  var setUser = function (u, k, v) { A.state.usr = A.state.usr || {}; A.state.usr[u.id] = A.state.usr[u.id] || {}; A.state.usr[u.id][k] = v; };
  var userAction = function (M, u, act) {
    if (!A.need('users.manage')) return;
    var me = M.users.filter(function (x) { return x.role === A.role && x.name === A.person(A.role); })[0];
    if (act === 'deactivate') {
      if (me && me.id === u.id) { A.toast('You cannot deactivate your own account', 'bad'); return; }
      A.confirm('Deactivate ' + u.name, u.name + ' will no longer be able to sign in. Their uploads and actions stay in the audit activity.', 'Deactivate User', function () { setUser(u, 'status', 'Deactivated'); A.log('User Deactivated', u.id, u.name); A.commit(u.name + ' deactivated', 'warn'); }, true);
    } else if (act === 'reactivate') { setUser(u, 'status', 'Active'); A.log('User Reactivated', u.id, u.name); A.commit(u.name + ' reactivated'); }
    else if (act === 'resend') { A.log('Invitation Resent', u.id, u.email); A.commit('Invitation sent again to ' + u.email); }
    else if (act === 'role') {
      A.dialog({ title: 'Change Role', ok: 'Change Role', body: A.kv([['User', A.esc(u.name)], ['Current Role', A.esc(D.ROLE_NAMES[u.role])]]) + '<div class="form-grid" style="margin-top:1rem">' + A.field('nr', 'New Role', A.select('nr', ['ADM', 'OPS', 'FIN'].map(function (r) { return { value: r, label: D.ROLE_NAMES[r] }; }), u.role), true) + '</div>',
        onOk: function (box) { var r = A.q('#nr', box).value; if (r === u.role) return A.invalid(box, 'nr', 'Choose a different role'); setUser(u, 'role', r); A.log('Role Changed', u.id, u.name + ': ' + D.ROLE_NAMES[u.role] + ' to ' + D.ROLE_NAMES[r]); A.commit(u.name + ' is now ' + D.ROLE_NAMES[r]); } });
    }
  };
  var inviteDialog = function (M) {
    if (!A.need('users.manage')) return;
    A.dialog({ title: 'Invite User', ok: 'Send Invitation', body: '<div class="form-grid">' + A.field('un', 'Full Name', A.input('un', '', 'For example: Nikhil Joshi'), true) + A.field('ue', 'Email Address', A.input('ue', '', 'name@crestlinelaminates.example'), true) + A.field('ur', 'Role', A.select('ur', ['OPS', 'FIN', 'ADM'].map(function (r) { return { value: r, label: D.ROLE_NAMES[r] }; }), 'OPS')) + A.field('up', 'Phone', A.input('up', '', '+91 98xxx xxxxx')) + '</div>',
      onOk: function (box) {
        var n = A.q('#un', box).value.trim(), e = A.q('#ue', box).value.trim().toLowerCase(), r = A.q('#ur', box).value, ph = A.q('#up', box).value.trim();
        if (n.split(' ').filter(Boolean).length < 2) return A.invalid(box, 'un', 'Enter the first and last name');
        if (!/^[^@\s]+@crestlinelaminates\.example$/.test(e)) return A.invalid(box, 'ue', 'Use a @crestlinelaminates.example address');
        if (M.users.some(function (u) { return u.email === e; })) return A.invalid(box, 'ue', 'A user with this email already exists');
        if (ph && !/^\+?[0-9 ]{10,16}$/.test(ph)) return A.invalid(box, 'up', 'Enter a phone number with 10 digits or more');
        var id = 'USR-' + D.pad(M.users.length + 1, 3);
        (A.state.nu = A.state.nu || []).push([id, n, r, e, ph, A.now()]);
        A.log('User Invited', id, n + ', ' + D.ROLE_NAMES[r]);
        A.commit('Invitation sent to ' + e);
      } });
  };
  A.def('AOP-USR-01', function (M, main) {
    var us = M.users;
    var by = function (s) { return us.filter(function (u) { return u.status === s; }).length; };
    main.innerHTML = A.head('User Management', '<a class="btn" data-link="AOP-USR-03">Roles and Permissions</a>' + A.btn('Invite User', 'data-inv', 'pri', 'plus')) +
      '<div class="kpis">' + A.kpi('Users', A.fmtN(us.length), A.chip('1 service account', 'plain')) + A.kpi('Active', A.fmtN(by('Active')), A.chip('Can Sign In', 'ok'), A.screen, 'tab=Active') + A.kpi('Invited', A.fmtN(by('Invited')), A.chip('Not Accepted Yet', by('Invited') ? 'warn' : 'ok'), A.screen, 'tab=Invited') + A.kpi('Deactivated', A.fmtN(by('Deactivated')), A.chip('Cannot Sign In', 'plain'), A.screen, 'tab=Deactivated') + '</div>' +
      '<section class="card flush list" id="us"></section>';
    A.q('[data-inv]', main).addEventListener('click', function () { inviteDialog(M); });
    A.table(A.q('#us', main), {
      id: 'users', noun: 'users', rows: us, key: function (u) { return u.id; }, exportName: 'Portal_Users',
      tabs: [{ label: 'All Users' }, { label: 'Active', test: function (u) { return u.status === 'Active'; } }, { label: 'Invited', test: function (u) { return u.status === 'Invited'; } }, { label: 'Deactivated', test: function (u) { return u.status === 'Deactivated'; } }],
      search: { ph: 'Search by name or email', text: function (u) { return u.name + ' ' + u.email; } },
      filters: [{ label: 'Role', get: function (u) { return D.ROLE_NAMES[u.role]; } }],
      rowCls: function (u) { return u.fresh ? 'row-fresh' : ''; },
      cols: [
        { h: 'Name', v: function (u) { return u.name; }, f: function (u) { return A.a('AOP-USR-02', '<b>' + A.esc(u.name) + '</b>', 'id=' + u.id); } },
        { h: 'User ID', v: function (u) { return u.id; }, cls: 'mono' },
        { h: 'Email', v: function (u) { return u.email; } },
        { h: 'Role', v: function (u) { return D.ROLE_NAMES[u.role]; } },
        { h: 'Last Sign-In', v: function (u) { return u.last || 0; }, x: function (u) { return u.last ? A.fmtDT(u.last) : ''; }, f: function (u) { return u.last ? '<span class="nowrap">' + A.fmtDT(u.last) + '</span>' : '—'; } },
        { h: 'Status', v: function (u) { return u.status; }, f: function (u) { return A.chip(u.status); } },
        { h: 'Action', nosort: true, noexport: true, f: function (u) { if (u.role === 'SVC') return A.chip('Service Account', 'plain'); return u.status === 'Active' ? '<button class="btn sm" type="button" data-ua="deactivate" data-id="' + u.id + '">Deactivate</button>' : u.status === 'Invited' ? '<button class="btn sm" type="button" data-ua="resend" data-id="' + u.id + '">Resend Invitation</button>' : '<button class="btn sm pri" type="button" data-ua="reactivate" data-id="' + u.id + '">Reactivate</button>'; } }
      ],
      after: function (el) { A.qa('[data-ua]', el).forEach(function (b) { b.addEventListener('click', function () { userAction(M, M.user(b.getAttribute('data-id')), b.getAttribute('data-ua')); }); }); }
    });
  });

  A.def('AOP-USR-02', function (M, main) {
    var u = M.user(A.param('id')) || M.users[1];
    var acts = M.audit.filter(function (a) { return A.person(a.by) === u.name; });
    main.innerHTML = A.head(u.name, (u.role !== 'SVC' ? A.btn('Change Role', 'data-ua="role"', '', 'shield') + (u.status === 'Active' ? A.btn('Deactivate User', 'data-ua="deactivate"', 'danger') : u.status === 'Invited' ? A.btn('Resend Invitation', 'data-ua="resend"', 'pri') : A.btn('Reactivate User', 'data-ua="reactivate"', 'pri')) : ''), A.chip(u.status)) +
      '<div class="grid g-main-side" style="--side:26rem"><div class="stack">' +
      A.card('Details', A.kv([['Name', '<b>' + A.esc(u.name) + '</b>'], ['User ID', '<span class="mono">' + u.id + '</span>'], ['Email', A.esc(u.email)], ['Phone', A.esc(u.phone || '—')], ['Role', A.esc(D.ROLE_NAMES[u.role])], ['Status', A.chip(u.status)], ['Created', A.fmtDate(u.created)], ['Last Sign-In', u.last ? A.fmtDT(u.last) : '—']])) +
      A.card('Recent Activity', acts.length ? A.feed(acts.slice(0, 8)) : '<div class="empty-block">No activity yet</div>') +
      '</div>' +
      A.card('Permissions', '<ul class="list">' + M.perms.map(function (p) { var ok = p.roles.indexOf(u.role) >= 0 || u.role === 'SVC' && /bc\.post|can\./.test(p.key); return '<li><span class="grow">' + A.esc(p.name) + '</span>' + A.chip(ok ? 'Allowed' : 'Not Allowed', ok ? 'ok' : 'plain') + '</li>'; }).join('') + '</ul>', { more: '<a class="more" data-link="AOP-USR-03">Roles and permissions</a>' }) +
      '</div>';
    A.qa('[data-ua]', main).forEach(function (b) { b.addEventListener('click', function () { userAction(M, u, b.getAttribute('data-ua')); }); });
  });

  // ---------- Roles and Permissions ----------
  A.def('AOP-USR-03', function (M, main) {
    var draft = {};
    M.perms.forEach(function (p) { draft[p.key] = p.roles.slice(); });
    var roles = ['ADM', 'OPS', 'FIN'];
    var changed = function () { return M.perms.some(function (p) { return draft[p.key].slice().sort().join(' ') !== p.roles.slice().sort().join(' '); }); };
    main.innerHTML = A.head('Roles and Permissions', A.btn('Discard Changes', 'data-discard') + A.btn('Save Changes', 'data-save', 'pri', 'check')) +
      '<div class="kpis">' + roles.map(function (r) { var n = M.users.filter(function (u) { return u.role === r && u.status !== 'Deactivated'; }).length; return A.kpi(D.ROLE_NAMES[r], A.plural(M.perms.filter(function (p) { return p.roles.indexOf(r) >= 0; }).length, 'permission'), A.chip(A.plural(n, 'user'), 'plain'), 'AOP-USR-01', 'tab=All Users'); }).join('') + '</div>' +
      A.card('Permissions by Role', '<div class="table-wrap"><table class="tbl wrap perm"><thead><tr><th>Permission</th><th>Area</th>' + roles.map(function (r) { return '<th class="c">' + A.esc(D.ROLE_NAMES[r]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        M.perms.map(function (p) { return '<tr><td><b>' + A.esc(p.name) + '</b></td><td>' + A.esc(p.area) + '</td>' + roles.map(function (r) { var lock = r === 'ADM' && p.key === 'users.manage'; return '<td class="c"><input type="checkbox" data-p="' + p.key + '" data-r="' + r + '"' + (p.roles.indexOf(r) >= 0 ? ' checked' : '') + (lock ? ' disabled title="The System Administrator always manages users"' : '') + ' aria-label="' + A.esc(p.name) + ' for ' + A.esc(D.ROLE_NAMES[r]) + '"></td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div>', { flush: true });
    var sv = A.q('[data-save]', main), ds = A.q('[data-discard]', main);
    var sync = function () { sv.disabled = !changed(); ds.disabled = !changed(); };
    sync();
    A.qa('[data-p]', main).forEach(function (c) {
      c.addEventListener('change', function () {
        var k = c.getAttribute('data-p'), r = c.getAttribute('data-r'), list = draft[k];
        if (c.checked && list.indexOf(r) < 0) list.push(r); if (!c.checked) draft[k] = list.filter(function (x) { return x !== r; });
        sync();
      });
    });
    ds.addEventListener('click', function () { A.rerender(); A.toast('Changes discarded', 'warn'); });
    sv.addEventListener('click', function () {
      if (!A.need('users.manage')) return;
      var diffs = M.perms.filter(function (p) { return draft[p.key].slice().sort().join(' ') !== p.roles.slice().sort().join(' '); });
      A.confirm('Save Permissions', A.plural(diffs.length, 'permission') + ' will change for everyone with the affected roles: ' + diffs.map(function (p) { return p.name; }).join(', ') + '.', 'Save Changes', function () {
        A.state.perm = A.state.perm || {};
        diffs.forEach(function (p) { A.state.perm[p.key] = draft[p.key].join(' '); });
        A.log('Permissions Changed', A.plural(diffs.length, 'permission'), diffs.map(function (p) { return p.name + ': ' + (draft[p.key].map(function (r) { return D.ROLE_NAMES[r]; }).join(', ') || 'nobody'); }).join('; '));
        A.commit('Permissions saved');
      });
    });
  });

  // ---------- Audit Activity ----------
  A.def('AOP-AUD-01', function (M, main) {
    var rows = M.audit;
    main.innerHTML = A.head('Audit Activity', '', A.chip(A.plural(rows.length, 'entry', 'entries'), 'plain')) +
      '<div class="kpis">' + A.kpi('Uploads', A.fmtN(rows.filter(function (a) { return /Upload/.test(a.action); }).length), A.chip('MTR and Business Central', 'plain')) +
      A.kpi('Mappings and Resolutions', A.fmtN(rows.filter(function (a) { return /Mapped|Created|Resolved|Excluded|Set Up|Accepted|Unblocked/.test(a.action); }).length), A.chip('Errors and Master Data', 'plain')) +
      A.kpi('Business Central Jobs', A.fmtN(rows.filter(function (a) { return /Job|Retry/.test(a.action); }).length), A.chip('Create, Post, Retry', 'plain')) +
      A.kpi('Cancellations', A.fmtN(rows.filter(function (a) { return /Cancellation/.test(a.action); }).length), A.chip('Requests and Updates', 'plain')) + '</div>' +
      '<section class="card flush list" id="aud"></section>';
    A.table(A.q('#aud', main), {
      id: 'aud', noun: 'entries', rows: rows, key: function (a) { return a.id; }, exportName: 'Audit_Activity', sheet: 'Audit', page: 20,
      search: { ph: 'Search by action, reference or detail', text: function (a) { return a.action + ' ' + a.ref + ' ' + a.detail + ' ' + A.person(a.by); } },
      filters: [{ label: 'Action', get: function (a) { return a.action; } }, { label: 'User', get: function (a) { return A.person(a.by); } }, { label: 'Date', get: function (a) { return A.fmtDate(a.at); } }],
      tabs: [{ label: 'All Activity' }, { label: 'This Session', test: function (a) { return a.fresh; } }],
      rowCls: function (a) { return a.fresh ? 'row-fresh' : ''; },
      cols: [
        { h: 'Time', v: function (a) { return a.at; }, x: function (a) { return A.fmtDT(a.at); }, f: function (a) { return '<span class="nowrap">' + A.fmtDT(a.at) + '</span>'; } },
        { h: 'User', v: function (a) { return A.person(a.by); } },
        { h: 'Role', v: function (a) { return D.ROLE_NAMES[a.by.replace(/\d$/, '')] || 'Service Account'; } },
        { h: 'Action', v: function (a) { return a.action; }, f: function (a) { return '<b>' + A.esc(a.action) + '</b>'; } },
        { h: 'Reference', v: function (a) { return a.ref; }, cls: 'mono nowrap' },
        { h: 'Detail', v: function (a) { return a.detail; } }
      ]
    });
  });
})();
