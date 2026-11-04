/*
 * Review bar for every screen. Reads assets/registry.js (load it first). Classic script: no imports, no fetch.
 *   <body data-screen="PRI-ORD-02">  <script src="../../assets/registry.js"></script>  <script src="../../assets/shell.js"></script>
 * The role comes from ?role=MGR, otherwise the screen's first role. ?review=off hides the bar for clean screenshots.
 */
(function () {
  var P = window.PORTAL;
  var me = document.currentScript;
  var root = new URL('../', me.src).href;          // folder that holds index.html
  P.root = root;

  var ICON = {
    back: '<path d="M10 3 5 8l5 5"/>',
    next: '<path d="m6 3 5 5-5 5"/>'
  };
  var svg = function (n) { return '<svg viewBox="0 0 16 16" aria-hidden="true">' + ICON[n] + '</svg>'; };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var id = document.body.getAttribute('data-screen');
  if (!id) return;
  var found = null;
  P.portals.forEach(function (p) { p.screens.forEach(function (s) { if (s.id === id) found = { p: p, s: s }; }); });
  if (!found) { console.error('shell.js: unknown screen ' + id); return; }
  var p = found.p, s = found.s;

  var params = new URLSearchParams(location.search);
  var withKeep = function (h) { return h + (params.get('review') === 'off' ? (h.indexOf('?') >= 0 ? '&review=off' : '?review=off') : ''); };
  var role = params.get('role');
  if (s.roles.indexOf(role) < 0) role = s.roles[0];
  var off = params.get('review') === 'off';

  P.current = { portal: p, screen: s, role: role };
  document.title = P.fullName(p, s, role) + ' (' + s.id + ')';

  // Links between screens, resolved from the registry so no page hard-codes a file name:
  //   data-link="PRI-ORD-02"  that screen (in the same portal as this page when the ID has no prefix, see P.find)
  //   data-signin="primary"   the portal's first role dashboard once built, otherwise the portal's directory
  //   data-directory="index"  the Screen Directory
  // The one place that decides whether a link is live. A link is live when the target is built and, inside the
  // same portal, available to the signed-in role; otherwise it is shown inert (no href, muted, with a reason) so
  // nobody lands on a missing file and a link never changes who is signed in.
  P.setLink = function (a, target) {
    var sameRole = target.portal.id !== p.id || target.screen.roles.indexOf(role) >= 0;
    var ok = target.screen.built && sameRole;
    if (ok) {
      var r = target.portal.id === p.id ? role : target.screen.roles[0];
      a.setAttribute('href', withKeep(P.href(root, target.screen, r)));
      a.removeAttribute('aria-disabled'); a.removeAttribute('title');
    } else {
      a.removeAttribute('href');
      a.setAttribute('aria-disabled', 'true');
      a.setAttribute('title', target.screen.built ? 'Not available for this role' : 'This screen is not built yet');
    }
    return ok;
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-link]'), function (a) {
    var t = P.find(a.getAttribute('data-link'));
    if (t) P.setLink(a, t); else console.error('shell.js: data-link to unknown screen ' + a.getAttribute('data-link'));
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-signin]'), function (a) {
    var tp = P.portal(a.getAttribute('data-signin'));
    var d = P.dashboard(tp, tp.roles[0].code);
    a.setAttribute('href', withKeep(d && d.built ? P.href(root, d, tp.roles[0].code) : root + 'directory/' + tp.id + '.html'));
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-directory]'), function (a) {
    var k = a.getAttribute('data-directory');
    a.setAttribute('href', withKeep(root + (k === 'index' ? 'index.html' : 'directory/' + k + '.html')));
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-toggle-password]'), function (b) {
    b.addEventListener('click', function () {
      var i = document.getElementById(b.getAttribute('data-toggle-password'));
      i.type = i.type === 'password' ? 'text' : 'password';
    });
  });
  // Role-aware content on screens shared by several roles:
  //   data-role="OWN MGR"   shown only to those roles
  //   data-me="name|role|email|initials"   filled in with the signed-in person
  //   data-count="selector" the number of visible elements that match (inside <main>)
  var self = p.roles.filter(function (r) { return r.code === role; })[0];
  Array.prototype.forEach.call(document.querySelectorAll('[data-role]'), function (e) {
    if (e.getAttribute('data-role').split(' ').indexOf(role) < 0) e.hidden = true;
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-me]'), function (e) {
    var k = e.getAttribute('data-me');
    e.textContent = k === 'name' ? self.person : k === 'role' ? self.label : k === 'initials' ? self.person.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2)
      : self.person.toLowerCase().replace(/ /g, '.') + '@' + p.org.toLowerCase().replace(/[^a-z]/g, '') + '.example';
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-count]'), function (e) {
    e.textContent = Array.prototype.filter.call(document.querySelectorAll('main ' + e.getAttribute('data-count')), function (x) { return !x.closest('[hidden]'); }).length;
  });
  // data-expand="all" / "none" on a button opens or closes every <details class="node"> (Customer Hierarchy Explorer)
  Array.prototype.forEach.call(document.querySelectorAll('[data-expand]'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('details.node'), function (d) { d.open = b.getAttribute('data-expand') === 'all'; });
    });
  });
  if (off) { document.documentElement.style.setProperty('--review-h', '0px'); return; }

  // Previous and next built screen for this role, in the order of the directory.
  var list = P.forRole(p, role).filter(function (x) { return x.built; });
  var at = list.indexOf(s);
  var link = function (x) { return withKeep(P.href(root, x, role)); };
  var prev = at > 0 ? list[at - 1] : null;
  var next = at >= 0 && at < list.length - 1 ? list[at + 1] : null;

  var bar = document.createElement('div');
  bar.className = 'review';
  bar.innerHTML =
    '<a class="back" href="' + root + 'directory/' + p.id + '.html#role-' + role + '">' + svg('back') + 'Screen Directory</a>' +
    '<div class="title"><span class="id">' + esc(s.id) + '</span><span>' + esc(P.fullName(p, s, role)) + '</span></div>' +
    '<nav class="pager" aria-label="Screens in this role">' +
    (prev ? '<a href="' + link(prev) + '" title="' + esc(prev.name) + '">' + svg('back') + 'Previous</a>' : '<span>' + svg('back') + 'Previous</span>') +
    (next ? '<a href="' + link(next) + '" title="' + esc(next.name) + '">Next' + svg('next') + '</a>' : '<span>Next' + svg('next') + '</span>') +
    '</nav>';
  document.body.insertBefore(bar, document.body.firstChild);
})();
