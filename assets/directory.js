/*
 * Screen Directory pages. Reads assets/registry.js (load it first). Classic script: no imports, no fetch.
 *   index.html                <body data-page="index">                          four portal cards
 *   directory/<portal>.html   <body data-page="portal" data-portal="primary">    roles, grouped screens, Preview
 */
(function () {
  var P = window.PORTAL;
  var root = new URL('../', document.currentScript.src).href;
  P.root = root;
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

  var ICON = {
    company: '<path d="M3.5 21V6.5L12 3l8.5 3.5V21M3.5 21h17M8 10h2M14 10h2M8 14h2M14 14h2M10.5 21v-3.5h3V21"/>',
    primary: '<path d="M2.5 8.5 12 4l9.5 4.5M4.5 10v8.5h15V10M9 18.5v-5h6v5"/>',
    secondary: '<path d="M3 9.5 4.5 4h15L21 9.5M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12.5V20h14v-7.5M10 20v-4.5h4V20"/>',
    tertiary: '<path d="M3 4h2.5l2 11h10l2-8H7M10 19.5a1 1 0 1 0 0 .01M17 19.5a1 1 0 1 0 0 .01"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    key: '<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H21M18 12v3M15 12v2"/>'
  };
  var icon = function (n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + '</svg>'; };

  var page = document.body.getAttribute('data-page');
  var app = $('#app');
  var total = P.count(), built = P.built();
  var appPortals = P.portals.filter(function (p) { return p.id !== 'authentication'; });
  var roleCount = appPortals.reduce(function (n, p) { return n + p.roles.length; }, 0);

  var header = function (crumb) {
    return '<header class="topbar"><div class="in"><a href="' + root + 'index.html" aria-label="Amazon Operations Portal — Screen Directory">' +
      '<img class="logo" src="' + root + 'assets/brand/logo-480.webp" srcset="' + root + 'assets/brand/logo-480.webp 480w, ' + root + 'assets/brand/logo-960.webp 960w" sizes="10rem" width="150" height="28" alt="MAVRO.AI"></a>' +
      '<span style="margin-left:auto"></span>' + (crumb || '') + '</div></header>';
  };

  if (page === 'index') {
    // One portal: a card per role, each opening that role's part of the portal directory.
    var op = appPortals[0];
    var roleIcon = { ADM: 'company', OPS: 'secondary', FIN: 'primary' };
    var cards = op.roles.map(function (r) {
      var list = P.forRole(op, r.code), groups = [];
      list.forEach(function (x) { var g = P.group(x, r.code); if (groups.indexOf(g) < 0 && g !== 'Account') groups.push(g); });
      return '<a class="portal-card" href="directory/' + op.id + '.html#role-' + r.code + '">' +
        '<div class="ico">' + icon(roleIcon[r.code] || 'company') + '</div>' +
        '<div><h2>' + esc(r.label) + '</h2><div class="roles">' +
        groups.map(function (g) { return '<span>' + esc(g) + '</span>'; }).join('') + '</div></div>' +
        '<div class="foot"><span><b>' + list.length + '</b> screens</span><span>Open screen directory</span>' + icon('arrow') + '</div></a>';
    }).join('');
    var auth = P.portal('authentication');
    app.innerHTML = header() +
      '<main class="dir"><div class="dir-head"><div><h1>Amazon Operations Portal — Screen Directory</h1>' +
      '<div class="facts"><span class="chip blue plain">' + total + ' screens</span><span class="chip plain">' + op.roles.length + ' roles</span>' +
      '<span class="chip ok">' + built + ' of ' + total + ' screens built</span></div></div></div>' +
      '<div class="portal-cards three">' + cards + '</div>' +
      '<a class="signin-link" href="directory/authentication.html"><span><b>' + esc(auth.card) + '</b> &nbsp;<span class="dim">' + auth.screens.length + ' screens</span></span>' + icon('key') + '</a></main>';
    document.title = 'Amazon Operations Portal — Screen Directory';
    return;
  }

  // ---------- One portal ----------
  var p = P.portal(document.body.getAttribute('data-portal'));
  var onlyBuilt = false, query = '';
  var isAuth = p.id === 'authentication';

  var rows = function (role) {
    var list = P.forRole(p, role.code).filter(function (s) {
      if (onlyBuilt && !s.built) return false;
      if (!query) return true;
      return (s.id + ' ' + P.fullName(p, s, role.code) + ' ' + s.description).toLowerCase().indexOf(query) >= 0;
    });
    var order = [];
    list.forEach(function (s) { var g = P.group(s, role.code); if (order.indexOf(g) < 0) order.push(g); });
    var out = '';
    order.forEach(function (g) {
      out += '<tr class="grp"><td colspan="5">' + esc(g) + '</td></tr>';
      list.filter(function (s) { return P.group(s, role.code) === g; }).forEach(function (s) {
        var name = P.fullName(p, s, role.code);
        out += '<tr><td class="sid">' + esc(s.id) + '</td><td class="nm">' + esc(name) + '</td><td class="rl">' + esc(role.label) + '</td>' +
          '<td class="ds">' + esc(s.description) + '</td><td class="act">' +
          (s.built ? '<a class="btn sm pri" href="' + P.href(root, s, role.code) + '" aria-label="Preview ' + esc(name) + '">Preview</a>'
                   : '<span class="btn sm" aria-disabled="true" title="Not built yet">Preview</span>') + '</td></tr>';
      });
    });
    return { html: out, count: list.length };
  };

  var draw = function () {
    var sections = p.roles.map(function (role) {
      var r = rows(role);
      if (!r.count) return '';
      return '<section class="role-sec" id="role-' + role.code + '"><header><h2>' + esc(isAuth ? p.card : p.label + ' — ' + role.label) + '</h2><span class="count">' +
        plural(r.count, 'screen', 'screens') + '</span></header>' +
        '<div class="card table-wrap"><table class="dir-table"><thead><tr><th>Screen ID</th><th>Screen name</th><th>Role</th><th>Description</th><th></th></tr></thead><tbody>' +
        r.html + '</tbody></table></div></section>';
    }).join('');
    $('#sections').innerHTML = sections || '<div class="card empty">No screens match.</div>';
  };

  var jump = isAuth ? '' : '<nav class="jump" aria-label="Roles">' + p.roles.map(function (r) {
    return '<a href="#role-' + r.code + '">' + esc(r.label) + ' <b>' + P.forRole(p, r.code).length + '</b></a>';
  }).join('') + '</nav>';
  var pBuilt = p.screens.filter(function (s) { return s.built; }).length;

  app.innerHTML = header('<a class="btn sm" href="' + root + 'index.html">All roles</a>') +
    '<main class="dir"><div class="dir-head"><div><h1>' + esc(p.directory) + ' — Screen Directory</h1>' +
    '<div class="facts"><span class="chip blue plain">' + plural(p.screens.length, 'screen', 'screens') + '</span>' +
    (isAuth ? '' : '<span class="chip plain">' + plural(p.roles.length, 'role', 'roles') + '</span>') +
    '<span class="chip ok">' + pBuilt + ' of ' + p.screens.length + ' built</span></div></div></div>' +
    '<div class="tools">' + jump +
    '<input class="input" id="q" type="search" placeholder="Search by ID, name or description" aria-label="Search screens">' +
    '<div class="seg" role="group" aria-label="Filter"><button type="button" aria-pressed="true" data-f="all">All screens</button><button type="button" aria-pressed="false" data-f="built">Built only</button></div></div>' +
    '<div id="sections"></div></main>';
  document.title = p.directory + ' — Screen Directory';

  $('#q').addEventListener('input', function (e) { query = e.target.value.trim().toLowerCase(); draw(); });
  Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (b) {
    b.addEventListener('click', function () {
      onlyBuilt = b.getAttribute('data-f') === 'built';
      Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      draw();
    });
  });
  draw();
  if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
})();
