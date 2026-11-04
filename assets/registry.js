/*
 * Screen registry: the single list of every screen in the Amazon Operations Portal prototype.
 * The Screen Directory, the review bar, the sidebar and the breadcrumbs all read it. Classic script (no imports,
 * no fetch) so pages open straight from disk. Same shape as the Laminates Customer Portal registry.
 *
 * Row: [code, name, roles, group, kind, description, parent]
 *   code    unique within the portal; the screen ID is PORTALCODE-code (for example AOP-MTR-03)
 *   roles   space-separated role codes that see the screen; the first is the default when the file is opened alone
 *   group   menu section in the sidebar; a string, or { ROLE: 'Section' } when roles group it differently
 *   kind    'm' appears in the sidebar menu; 'd' is reached from another screen (details)
 *   parent  code of the screen it is opened from (breadcrumbs), a string or { ROLE: 'code' }
 * A dashboard is named 'Dashboard' and belongs to exactly one role; its file is <role>-dashboard.html.
 */
(function () {
  var PORTALS = [
    { id: 'operations', code: 'AOP', label: 'Amazon Operations Portal', card: 'Amazon Operations Portal', directory: 'Amazon Operations Portal', org: 'Crestline Laminates', portalName: 'Amazon Operations Portal',
      roles: [['ADM', 'System Administrator', 'Rohit Bansal'], ['OPS', 'Marketplace Operations Executive', 'Sneha Patil'], ['FIN', 'Finance and Accounts Manager', 'Karan Mehta']] },
    { id: 'authentication', code: 'AUT', label: 'Shared Authentication', card: 'Sign-In Screens', directory: 'Sign-In Screens', org: '', portalName: '',
      roles: [['ALL', 'All Users', '']] }
  ];

  var S = {};
  var BCG = { ADM: 'Invoice and Credit Memo Processing', FIN: 'Invoice and Credit Memo Processing', OPS: 'Missing Data and Mapping' };

  S.operations = [
    ['ADM-01', 'Dashboard', 'ADM', 'Overview', 'm', 'Month close progress across MTR upload, reconciliation, errors, Business Central posting and cancellations'],
    ['OPS-01', 'Dashboard', 'OPS', 'Overview', 'm', 'MTR work queue: uploads due, reconciliation result, open header and item errors, missing mappings'],
    ['FIN-01', 'Dashboard', 'FIN', 'Overview', 'm', 'Posting progress: documents ready, reconciled, posted, credit memos and cancellation requests'],

    ['MTR-01', 'Amazon Excel/CSV Upload', 'ADM OPS', 'MTR Processing', 'm', 'Upload the monthly Amazon MTR (B2C and B2B) in Excel or CSV; columns, duplicates and periods are checked before saving'],
    ['MTR-02', 'MTR Upload Details', 'ADM OPS FIN', 'MTR Processing', 'd', 'One uploaded MTR file: rows saved, transaction types, Seller GSTINs and the rows themselves', { ADM: 'MTR-01', OPS: 'MTR-01', FIN: 'MTR-03' }],
    ['MTR-03', 'MTR Reconciliation', 'ADM OPS FIN', 'MTR Processing', 'm', 'Reconcile by month, year, Seller GSTIN and transaction type: amounts, GSTINs, customers and item mappings'],
    ['MTR-04', 'MTR Transaction Details', 'ADM OPS FIN', 'MTR Processing', 'd', 'One Amazon invoice or credit note: lines, tax, checks, errors and its Business Central documents', 'MTR-03'],
    ['MTR-05', 'Amazon Inventory Header Error', 'ADM OPS FIN', 'MTR Processing', 'm', 'Invoice-level errors with resolution actions; download in Excel'],
    ['MTR-06', 'Amazon Inventory Item Error', 'ADM OPS FIN', 'MTR Processing', 'm', 'Line-level errors (SKU, HSN, tax rate, blocked item) with resolution actions; download in Excel'],

    ['MAP-01', 'Amazon SKU Mapping', 'ADM OPS', 'Missing Data and Mapping', 'm', 'Map Amazon SKUs to Business Central items; missing SKUs first'],
    ['MAP-02', 'Missing Customer', 'ADM OPS', 'Missing Data and Mapping', 'm', 'Customers in the MTR with no Business Central customer: download, fill in, upload and map or create'],

    ['BC-01', 'Excel Upload Before Posting', 'ADM FIN', 'Invoice and Credit Memo Processing', 'm', 'Upload the Business Central sales order extract and reconcile it with the MTR before posting'],
    ['BC-02', 'Excel Upload After Posting', 'ADM FIN', 'Invoice and Credit Memo Processing', 'm', 'Upload posted sales invoices from Business Central and verify every invoice was posted correctly'],
    ['BC-03', 'Excel Upload Before Credit Memo', 'ADM FIN', 'Invoice and Credit Memo Processing', 'm', 'Upload the Business Central credit memo extract for refunds and reconcile it with the MTR'],
    ['BC-04', 'Excel Upload After Credit Memo', 'ADM FIN', 'Invoice and Credit Memo Processing', 'm', 'Upload posted credit memos and verify them against the MTR refunds'],
    ['BC-05', 'Business Central Upload Details', 'ADM FIN', 'Invoice and Credit Memo Processing', 'd', 'One Business Central upload: every document with its reconciliation result', 'BC-01'],
    ['BC-06', 'Excel Upload BC Customer', 'ADM FIN OPS', BCG, 'm', 'Upload the Business Central customer master; the list that customer mapping checks against'],

    ['CAN-01', 'Excel Cancel Invoice', 'ADM FIN', 'Invoice Cancellation', 'm', 'Upload posted invoice numbers to cancel; track each request through the cancellation API to Business Central'],
    ['CAN-02', 'Cancellation Request Details', 'ADM FIN', 'Invoice Cancellation', 'd', 'One cancellation request: invoice, API calls, responses and the result in Business Central', 'CAN-01'],

    ['INT-01', 'Business Central Integration', 'ADM FIN OPS', 'Business Central', 'm', 'Jobs sent to Business Central: create sales orders and credit memos, post, cancel; results and retries'],
    ['INT-02', 'Integration Job Details', 'ADM FIN OPS', 'Business Central', 'd', 'One job: every document sent, Business Central response and failure reason', 'INT-01'],

    ['SET-01', 'Seller GSTIN Setup', 'ADM', 'Administration', 'm', 'Seller GSTINs and fulfilment centres with their Business Central location and posting setup'],
    ['USR-01', 'User Management', 'ADM', 'Administration', 'm', 'Portal users with role, status and last sign-in'],
    ['USR-02', 'User Details', 'ADM', 'Administration', 'd', 'One user: role, permissions and recent activity', 'USR-01'],
    ['USR-03', 'Roles and Permissions', 'ADM', 'Administration', 'm', 'What each role may do: upload, reconcile, map, post, cancel, manage users'],
    ['AUD-01', 'Audit Activity', 'ADM FIN', 'Administration', 'm', 'Every upload, mapping, posting and cancellation with user and time'],

    ['NTF-01', 'Notifications', 'ADM OPS FIN', 'Account', 'd', 'Upload results, new errors, job failures and cancellation updates'],
    ['PRO-02', 'My Profile', 'ADM OPS FIN', 'Account', 'd', 'Your details, role, permissions and notification preferences']
  ];

  S.authentication = [
    ['01', 'Sign In', 'ALL', 'Sign-In', 'm', 'Email and password sign-in to the Amazon Operations Portal'],
    ['02', 'Forgot Password', 'ALL', 'Sign-In', 'm', 'Request a password reset link', '01'],
    ['03', 'Password Reset Sent', 'ALL', 'Sign-In', 'm', 'Confirmation that the reset link was sent', '02'],
    ['04', 'Access Denied', 'ALL', 'Sign-In', 'm', 'Shown when a role opens a screen it has no permission for']
  ];

  function slug(text) { return text.toLowerCase().replace(/\//g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function pick(value, role) { return value && typeof value === 'object' ? value[role] : value; }

  var portals = PORTALS.map(function (p) {
    var roleName = {};
    p.roles.forEach(function (r) { roleName[r[0]] = r[1]; });
    var screens = S[p.id].map(function (row, i) {
      var roles = row[2].split(' ');
      var id = p.code + '-' + row[0];
      return {
        id: id, portal: p.id, code: row[0], name: row[1], roles: roles, group: row[3], kind: row[4], description: row[5],
        parent: row[6] || null, order: i, built: true,
        file: 'screens/' + p.id + '/' + (row[1] === 'Dashboard' ? slug(roleName[roles[0]]) + '-dashboard' : slug(row[1])) + '.html'
      };
    });
    return { id: p.id, code: p.code, label: p.label, card: p.card, directory: p.directory, org: p.org, portalName: p.portalName, roles: p.roles.map(function (r) { return { code: r[0], label: r[1], person: r[2] }; }), screens: screens };
  });

  function P_parent(p, s, role) {
    var code = pick(s.parent, role);
    return code ? p.screens.filter(function (x) { return x.code === code; })[0] : null;
  }
  function portal(id) { return portals.filter(function (p) { return p.id === id; })[0]; }
  function roleLabel(p, role) { return p.roles.filter(function (r) { return r.code === role; })[0].label; }

  window.PORTAL = {
    portals: portals,
    portal: portal,
    roleLabel: roleLabel,
    slug: slug,
    forRole: function (p, role) { return p.screens.filter(function (s) { return s.roles.indexOf(role) >= 0; }); },
    // "Amazon Operations Portal — Finance and Accounts Manager — MTR Reconciliation"
    fullName: function (p, s, role) {
      return p.id === 'authentication' ? p.label + ' — ' + s.name : p.label + ' — ' + roleLabel(p, role) + ' — ' + s.name;
    },
    group: function (s, role) { return pick(s.group, role); },
    parent: P_parent,
    href: function (root, s, role) { return root + s.file + (role && role !== s.roles[0] && role !== 'ALL' ? '?role=' + role : ''); },
    chain: function (p, s, role) {
      var out = [s], seen = {};
      seen[s.id] = true;
      for (var up = P_parent(p, s, role); up && !seen[up.id] && out.length < 8; up = P_parent(p, up, role)) { seen[up.id] = true; out.unshift(up); }
      return out;
    },
    menuScreen: function (p, s, role) {
      var c = this.chain(p, s, role);
      for (var i = c.length - 1; i >= 0; i--) if (c[i].kind === 'm') return c[i];
      return s;
    },
    find: function (id) {
      for (var i = 0; i < portals.length; i++) for (var j = 0; j < portals[i].screens.length; j++)
        if (portals[i].screens[j].id === id) return { portal: portals[i], screen: portals[i].screens[j] };
      return null;
    },
    dashboard: function (p, role) {
      return p.screens.filter(function (s) { return s.name === 'Dashboard' && s.roles[0] === role; })[0] || null;
    },
    count: function () { return portals.reduce(function (n, p) { return n + p.screens.length; }, 0); },
    built: function () { return portals.reduce(function (n, p) { return n + p.screens.filter(function (s) { return s.built; }).length; }, 0); }
  };
})();
