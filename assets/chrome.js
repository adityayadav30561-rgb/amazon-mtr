/*
 * Application chrome: sidebar, top bar, breadcrumbs and icons. Load after shell.js, on screens with <body data-layout="app">.
 * The sidebar lists the role's menu screens grouped by menu section (registry.js); screens that are not built yet are
 * shown muted. Icons: <i data-icon="plus"></i> anywhere on a page becomes an inline icon.
 */
(function () {
  var P = window.PORTAL;
  var cur = P.current;
  var p = cur.portal, s = cur.screen, role = cur.role, root = P.root;
  var person = p.roles.filter(function (r) { return r.code === role; })[0];

  var ICONS = {
    home: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
    box: '<path d="M2.5 5 8 2.5 13.5 5v6L8 13.5 2.5 11z"/><path d="M2.5 5 8 7.5 13.5 5M8 7.5v6"/>',
    cart: '<path d="M2 3h1.8l1.4 7h6.6l1.2-5H4.6"/><circle cx="6" cy="12.6" r=".9"/><circle cx="11" cy="12.6" r=".9"/>',
    stack: '<path d="M8 2.5 14 5.5 8 8.5 2 5.5z"/><path d="M2 8.5 8 11.5l6-3M2 11.2 8 14.2l6-3"/>',
    truck: '<path d="M1.8 4h7.4v6.5H1.8zM9.2 6.3h2.9l2.1 2.2v2H9.2"/><circle cx="4.6" cy="11.6" r="1.2"/><circle cx="11.4" cy="11.6" r="1.2"/>',
    users: '<circle cx="6" cy="5.5" r="2.2"/><path d="M2.2 13c.4-2.3 1.9-3.6 3.8-3.6S9.4 10.7 9.8 13"/><circle cx="11.2" cy="6.3" r="1.7"/><path d="M10.6 9.5c1.6 0 2.8 1.1 3.2 3"/>',
    chart: '<path d="M2.5 13.5h11M4 11V6.5M8 11V3M12 11V8"/>',
    trend: '<path d="M2 12 6 7.5l3 2.5 5-6.5M10 3.5h4V7.5"/>',
    receipt: '<path d="M3.5 2h9v12l-1.8-1.2L8.9 14 7.1 12.8 5.3 14 3.5 12.8z"/><path d="M6 5.5h4M6 8h4"/>',
    tag: '<path d="M2.5 8.5V2.5h6l5 5-6 6z"/><circle cx="5.7" cy="5.7" r=".9"/>',
    ret: '<path d="M6 4 3 7l3 3"/><path d="M3 7h6.5a3.5 3.5 0 0 1 0 7H7"/>',
    help: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.2"/><path d="M4.1 4.1l2.3 2.3M9.6 9.6l2.3 2.3M11.9 4.1 9.6 6.4M6.4 9.6l-2.3 2.3"/>',
    building: '<path d="M3 14V3h7v11M10 6.5h3V14M1.5 14h13M5.5 5.5h2M5.5 8h2M5.5 10.5h2"/>',
    user: '<circle cx="8" cy="5.5" r="2.6"/><path d="M3 13.5c.5-2.7 2.5-4.2 5-4.2s4.5 1.5 5 4.2"/>',
    map: '<path d="M8 14s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>',
    clip: '<rect x="3.5" y="2.5" width="9" height="11.5" rx="1.5"/><path d="M6 2.5h4v2H6zM5.8 8h4.4M5.8 10.5h4.4"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 2v1.6M8 12.4V14M2 8h1.6M12.4 8H14M3.8 3.8l1.1 1.1M11.1 11.1l1.1 1.1M3.8 12.2l1.1-1.1M11.1 4.9l1.1-1.1"/>',
    bell: '<path d="M4 11.5V7.5a4 4 0 0 1 8 0v4l1.2 1.3H2.8zM6.6 14h2.8"/>',
    search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2 13.5 13.5"/>',
    menu: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
    down: '<path d="m4 6 4 4 4-4"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    minus: '<path d="M3 8h10"/>',
    download: '<path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10"/>',
    upload: '<path d="M8 10.5v-8M4.5 6 8 2.5 11.5 6M3 13.5h10"/>',
    filter: '<path d="M2.5 3.5h11L9.5 8.5v4l-3 1.5V8.5z"/>',
    grid: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
    list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.1M2.5 8h.1M2.5 12h.1"/>',
    more: '<circle cx="3.5" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12.5" cy="8" r="1.1"/>',
    check: '<circle cx="8" cy="8" r="5.6"/><path d="M5.6 8.2l1.7 1.7 3.2-3.5"/>',
    edit: '<path d="M10 3.5 12.5 6 6 12.5l-3 .5.5-3z"/>',
    trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>',
    calendar: '<rect x="2.5" y="3" width="11" height="10.5" rx="1.5"/><path d="M2.5 6.2h11M5.5 1.8v2.4M10.5 1.8v2.4"/>',
    doc: '<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.3 1.8V5h3.2M6 8h4.5M6 10.6h4.5"/>',
    cash: '<rect x="1.5" y="4" width="13" height="8" rx="1.5"/><circle cx="8" cy="8" r="2"/>',
    arrow: '<path d="M3 8h10M9 4l4 4-4 4"/>',
    back: '<path d="M10 3 5 8l5 5"/>',
    x: '<path d="M4 4l8 8M12 4l-8 8"/>',
    repeat: '<path d="M3 7a5 5 0 0 1 9-2.5M13 2.5v2.5h-2.5M13 9a5 5 0 0 1-9 2.5M3 13.5V11h2.5"/>',
    warn: '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.3v.1"/>',
    logout: '<path d="M6.5 2.5h-3v11h3M10 5l3 3-3 3M13 8H6.5"/>',
    pin: '<path d="M8 14s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>',
    phone: '<path d="M4 2.5h2.2l1 3-1.5 1a8 8 0 0 0 3.8 3.8l1-1.5 3 1V12a1.5 1.5 0 0 1-1.6 1.5A10.5 10.5 0 0 1 2.5 4.1 1.5 1.5 0 0 1 4 2.5z"/>',
    mail: '<rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="m2.5 5 5.5 4 5.5-4"/>',
    lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    print: '<path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z"/>',
    link: '<path d="M6.8 9.2 9.2 6.8M7.4 4.6l1.2-1.2a2.6 2.6 0 0 1 3.7 3.7l-1.2 1.2M8.6 11.4l-1.2 1.2a2.6 2.6 0 0 1-3.7-3.7l1.2-1.2"/>',
    shield: '<path d="M8 2 13 4v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4z"/><path d="M5.8 8.1 7.3 9.6l3-3.2"/>',
    sync: '<path d="M3 7a5 5 0 0 1 9-2.5M13 2.5v2.5h-2.5M13 9a5 5 0 0 1-9 2.5M3 13.5V11h2.5"/>',
    table: '<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M2.5 10h11M6.5 6.5V13"/>',
    ban: '<circle cx="8" cy="8" r="5.5"/><path d="M4.2 11.8 11.8 4.2"/>',
    sheet: '<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.3 1.8V5h3.2M6 8l3 3.5M9 8l-3 3.5"/>',
    play: '<path d="M5 3.5v9l7-4.5z"/>',
    eye: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>'
  };
  var PREFIX = { MTR: 'sheet', MAP: 'link', BC: 'receipt', CAN: 'ban', INT: 'sync', USR: 'user', SET: 'building', AUD: 'clip', NTF: 'bell', PRO: 'user' };
  var svg = function (n) { return '<svg viewBox="0 0 16 16" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; };
  P.icon = svg;
  // Sign-in screens use the icons only; the frame below is for application screens.
  if (!cur || document.body.getAttribute('data-layout') !== 'app') return;
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var initials = function (name) { return name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2); };
  var NAME_ICON = { 'Amazon Excel/CSV Upload': 'upload', 'MTR Reconciliation': 'check', 'Amazon Inventory Header Error': 'warn', 'Amazon Inventory Item Error': 'warn', 'Amazon SKU Mapping': 'link', 'Missing Customer': 'users',
    'Excel Upload Before Posting': 'upload', 'Excel Upload After Posting': 'receipt', 'Excel Upload Before Credit Memo': 'ret', 'Excel Upload After Credit Memo': 'ret', 'Excel Upload BC Customer': 'users', 'Excel Cancel Invoice': 'ban',
    'Business Central Integration': 'sync', 'Seller GSTIN Setup': 'building', 'User Management': 'user', 'Roles and Permissions': 'shield', 'Audit Activity': 'clip' };
  var iconFor = function (x) { return x.name === 'Dashboard' ? 'home' : (NAME_ICON[x.name] || PREFIX[x.code.split('-')[0]] || 'doc'); };

  // ---------- Sidebar ----------
  var active = P.menuScreen(p, s, role);
  var list = P.forRole(p, role).filter(function (x) { return x.kind === 'm'; });
  var groups = [];
  list.forEach(function (x) { var g = P.group(x, role); if (groups.indexOf(g) < 0) groups.push(g); });
  groups.sort(function (a, b) { return (b === 'Overview') - (a === 'Overview'); });
  // The Operations Manager's and the Sales Manager's menus follow the order of their work.
  var ORDER = ['Overview', 'MTR Processing', 'Missing Data and Mapping', 'Invoice and Credit Memo Processing', 'Invoice Cancellation', 'Business Central', 'Administration'];
  if (ORDER) groups.sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); });   // the dashboard section is always first, whatever the registry order
  var nav = groups.map(function (g) {
    var members = list.filter(function (x) { return P.group(x, role) === g; });
    var items = members.map(function (x) {
      var on = x === active;
      return '<a class="nv"' + (on ? ' aria-current="page"' : '') + ' data-nav="' + x.id + '">' + svg(iconFor(x)) + '<span>' + esc(x.name) + '</span></a>';
    }).join('');
    // A heading over a single item would repeat it, so only groups of two or more get one.
    return '<div class="grp">' + (members.length > 1 ? '<h6>' + esc(g) + '</h6>' : '') + items + '</div>';
  }).join('');

  var logo = '<img class="logo" src="' + root + 'assets/brand/logo-480.webp" width="161" height="30" alt="MAVRO.AI">';
  var side = '<aside class="side" id="side"><a class="brand" href="' + root + 'index.html" aria-label="Screen Directory">' + logo + '</a>' +
    '<div class="org"><i>' + esc(initials(p.org)) + '</i><div><b>' + esc(p.org) + '</b><small>' + esc(p.portalName) + '</small></div></div>' +
    '<nav class="nav" aria-label="Menu">' + nav + '</nav></aside>';

  // ---------- Top bar ----------
  var crumbs = [];
  if (s.name !== 'Dashboard') {
    crumbs.push({ text: P.group(s, role) });
    P.chain(p, s, role).forEach(function (x) { crumbs.push({ screen: x, text: x.name }); });
  } else crumbs.push({ text: 'Dashboard' });
  var crumb = crumbs.map(function (c, i) {
    var last = i === crumbs.length - 1;
    var inner = last ? '<b>' + esc(c.text) + '</b>' : c.screen ? '<a data-crumb="' + c.screen.id + '">' + esc(c.text) + '</a>' : '<span>' + esc(c.text) + '</span>';
    return inner + (last ? '' : '<span class="sep">/</span>');
  }).join('');
  var placeholder = 'Search invoices, orders, SKUs and screens';
  var top = '<header class="top"><button class="icon-btn menu-btn" type="button" aria-label="Open menu" data-menu>' + svg('menu') + '</button>' +
    (crumbs.length > 1 ? '<nav class="crumb" aria-label="Breadcrumb">' + crumb + '</nav>' : '') +
    '<label class="search">' + svg('search') + '<input type="search" placeholder="' + placeholder + '" aria-label="Search"></label>' +
    '<a class="icon-btn" data-ntf aria-label="Notifications">' + svg('bell') + '<span class="dot" data-ntf-count hidden></span></a>' +
    '<div class="who"><button type="button" aria-haspopup="true" data-who><span class="av">' + esc(initials(person.person)) + '</span>' +
    '<span class="tx"><span class="nm">' + esc(person.person) + '</span><span class="rl">' + esc(person.label) + '</span></span>' + svg('down') + '</button>' +
    '<div class="menu" id="who-menu"><a data-profile>' + svg('user') + 'My Profile</a><a data-ntf-item>' + svg('bell') + 'Notifications</a><a data-signout>' + svg('logout') + 'Sign Out</a></div></div></header>';

  // ---------- Assemble ----------
  var main = document.querySelector('main');
  var page = document.createElement('div');
  page.className = 'page';
  var app = document.createElement('div');
  app.className = 'app';
  app.innerHTML = side + '<div class="scrim" data-menu></div>';
  page.insertAdjacentHTML('beforeend', top);
  main.parentNode.insertBefore(app, main);
  page.appendChild(main);
  app.appendChild(page);

  // ---------- Links (all through P.setLink, so unbuilt or role-restricted targets are inert) ----------
  var q = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  q('[data-nav]').forEach(function (a) { P.setLink(a, P.find(a.getAttribute('data-nav'))); });
  q('[data-crumb]').forEach(function (a) { P.setLink(a, P.find(a.getAttribute('data-crumb'))); });
  var ntf = P.find(p.code + '-NTF-01');
  var prof = P.find(p.code + '-PRO-02');
  if (ntf) { q('[data-ntf]').forEach(function (a) { P.setLink(a, ntf); }); P.setLink(document.querySelector('[data-ntf-item]'), ntf); }
  if (prof) P.setLink(document.querySelector('[data-profile]'), prof);
  var out = P.find('AUT-01');
  document.querySelector('[data-signout]').setAttribute('href', P.href(root, out.screen, 'ALL'));

  // ---------- Behaviour: drawer on small screens, profile menu ----------
  q('[data-menu]').forEach(function (b) { b.addEventListener('click', function () { app.classList.toggle('open'); }); });
  var menu = document.getElementById('who-menu');
  document.querySelector('[data-who]').addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', function () { menu.classList.remove('open'); });

  // ---------- Inline icons ----------
  q('[data-icon]').forEach(function (i) { i.outerHTML = svg(i.getAttribute('data-icon')).replace('<svg ', '<svg class="ic" '); });
})();
