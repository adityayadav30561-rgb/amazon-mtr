/*
 * Behaviour layer for the Amazon Operations Portal prototype. Classic script, no imports.
 * Load after registry.js, shell.js, chrome.js and mtr-data.js; screen files (mtr-*.js) register renderers with A.def().
 *
 * The state, toast, dialog and dropdown follow the Laminates Customer Portal (assets/app-core.js there): state lives in
 * the URL (`st`), never in browser storage; every internal link carries it; Reset Data in the review bar clears it.
 * Keys (all optional):
 *   up  [[uploadId, at, role, file, size]]              MTR files uploaded
 *   rr  [[month, at, role, filters]]                    reconciliation runs
 *   res {errorId: [action, at, role, note]}             header and item errors resolved or excluded
 *   map {sku: [itemNo, factor, at, role]}               SKU mappings
 *   cus {customerKey: [mode E|N, bcNo, name, at, role]} missing customers mapped or created
 *   gst {gstin: [location, at, role, dimension]}        Seller GSTINs set up
 *   ub  {itemNo: [at, role]}                            items confirmed unblocked in Business Central
 *   bcu [[kind, id, at, role, file, month]]             Business Central uploads
 *   bpa {"batch|key" | "corr|key" | "accd|key": [action, at, role]}   reconciliation decisions
 *   job [[id, type, month, at, role, [docIds]]]         Business Central jobs started
 *   jr  {"job|doc": at}                                 failed documents retried
 *   cn  [[requestId, invoiceNo, reason, at, role, batch]]   cancellation requests uploaded
 *   cev {requestId: [[status, at, role, note]]}         cancellation status changes
 *   usr {userId: {field: value}}  nu [[id, name, role, email, phone, at]]   users
 *   perm {permissionKey: "ADM OPS"}                     role permissions changed
 *   lg  [[at, role, action, ref, detail]]               audit entries   nt [[at, kind, title, text, link, query, roles]] notifications
 *   n   [notificationId]  read                          k   last time used (keeps session times in order)
 */
(function () {
  var P = window.PORTAL;
  var D = window.MTRDATA;
  var A = window.APP = window.APP || {};
  A.q = function (sel, el) { return (el || document).querySelector(sel); };
  A.qa = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  A.esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  A.screen = document.body.getAttribute('data-screen') || '';
  A.role = P && P.current ? P.current.role : null;
  A.portal = P && P.current ? P.current.portal : null;
  A.icon = function (n) { return P && P.icon ? P.icon(n).replace('<svg ', '<svg class="ic" ') : ''; };
  A.params = new URLSearchParams(location.search);
  A.param = function (k) { return A.params.get(k); };

  // ---------- State in the URL ----------
  var enc = function (o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  var dec = function (s) { try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return {}; } };
  A.state = A.param('st') ? dec(A.param('st')) : {};
  var clean = function () {
    var o = {};
    Object.keys(A.state).forEach(function (k) {
      var v = A.state[k];
      if (v == null || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) return;
      o[k] = v;
    });
    return o;
  };
  A.encoded = function () { var c = clean(); return Object.keys(c).length ? enc(c) : ''; };
  A.save = function () {
    var u = new URL(location.href), e = A.encoded();
    if (e) u.searchParams.set('st', e); else u.searchParams.delete('st');
    try { history.replaceState(null, '', u.toString()); } catch (x) { /* links still carry the state */ }
  };
  A.withState = function (href) {
    var e = A.encoded();
    if (!href || /^(mailto:|tel:|#|javascript:|blob:|data:)/.test(href)) return href;
    var u;
    try { u = new URL(href, location.href); } catch (x) { return href; }
    if (u.protocol !== 'file:' && u.origin !== location.origin) return href;
    if (!/\.html$/.test(u.pathname)) return href;
    if (e) u.searchParams.set('st', e); else u.searchParams.delete('st');
    return u.toString();
  };
  // href of a screen for the signed-in role, with extra query (for example "id=UPL-2610-B2C") and the state
  A.link = function (sid, query) {
    var t = P.find(sid); if (!t) return '#';
    var r = t.portal.id === A.portal.id && t.screen.roles.indexOf(A.role) >= 0 ? A.role : t.screen.roles[0];
    var h = P.href(P.root, t.screen, r);
    var extra = [];
    if (query) extra.push(query);
    if (A.param('review') === 'off') extra.push('review=off');
    if (extra.length) h += (h.indexOf('?') >= 0 ? '&' : '?') + extra.join('&');
    return A.withState(h);
  };
  A.canOpen = function (sid) { var t = P.find(sid); return !!t && (t.portal.id !== A.portal.id || t.screen.roles.indexOf(A.role) >= 0); };
  A.go = function (sid, query) { location.href = A.link(sid, query); };
  var refreshLink = function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.getAttribute('href'), n = A.withState(h);
    if (n && n !== h) a.setAttribute('href', n);
  };
  ['mousedown', 'click', 'auxclick', 'keydown', 'focusin', 'mouseover', 'touchstart'].forEach(function (t) { document.addEventListener(t, refreshLink, true); });

  // ---------- Time: the prototype's today is 6 November 2026; session actions get today's date and the clock time ----------
  A.now = function () {
    var d = new Date(), tod = (d.getHours() * 60 + d.getMinutes()) * 60000 + d.getSeconds() * 1000;
    var t = D.TODAY + Math.max(tod, (10 * 60 + 5) * 60000);
    if (A.state.k && t <= A.state.k) t = A.state.k + 60000;
    A.state.k = t;
    return t;
  };

  // ---------- Formatting (rules of the customer portal: Indian grouping; compact in tiles, exact in tables) ----------
  var group = function (s) {
    if (s.length <= 3) return s;
    var head = s.slice(0, -3), tail = s.slice(-3), parts = [];
    while (head.length > 2) { parts.unshift(head.slice(-2)); head = head.slice(0, -2); }
    if (head) parts.unshift(head);
    return parts.join(',') + ',' + tail;
  };
  A.fmtN = function (n) { return (n < 0 ? '−' : '') + group(String(Math.abs(Math.round(n)))); };
  A.fmtM = function (n) { return (n < 0 ? '−' : '') + '₹' + group(String(Math.abs(Math.round(n)))); };
  A.fmtM2 = function (n) {
    if (n == null || isNaN(n)) return '';
    var neg = n < 0, a = Math.abs(n), r = Math.round(a * 100), whole = Math.floor(r / 100), p = r % 100;
    return (neg ? '−' : '') + '₹' + group(String(whole)) + '.' + (p < 10 ? '0' : '') + p;
  };
  var q2 = function (v) { return (Math.floor(v * 100 + 0.5 + 1e-9) / 100).toFixed(2); };
  A.fmtML = function (n) {
    var neg = n < 0; n = Math.abs(n);
    var s = n >= 10000000 ? '₹' + q2(n / 10000000) + ' crore' : n >= 100000 ? '₹' + q2(n / 100000) + ' lakh' : A.fmtM(n);
    return (neg ? '−' : '') + s;
  };
  A.fmtDate = function (ms) { if (!ms) return ''; var d = new Date(ms); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); };
  A.fmtDT = function (ms) { if (!ms) return ''; var d = new Date(ms); return A.fmtDate(ms) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
  A.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  A.fmtLong = function (ms) { var d = new Date(ms); return d.getDate() + ' ' + A.MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
  A.fmtSize = function (b) { return b >= 1048576 ? (b / 1048576).toFixed(2) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' bytes'; };
  A.plural = function (n, one, many) { return A.fmtN(n) + ' ' + (n === 1 ? one : (many || one + 's')); };
  A.pct = function (a, b) { return b ? Math.round((a / b) * 1000) / 10 : 0; };
  A.person = function (k) { return D.person(k); };
  A.slug = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };

  // ---------- Chips ----------
  A.chipClass = function (t) {
    var l = String(t).toLowerCase();
    if (/^(matched|resolved|completed$|posted and matched|posted, difference accepted|posted$|cancelled$|cancelled in business central|saved|configured|active|mapped|created|pass|reconciled|uploaded|success|difference accepted|confirmed|ok|done|allowed|no errors|closed|ready|on time|credit memo instead)/.test(l)) return 'ok';
    if (/^(failed|fail|error|errors open|missing|amount difference|not posted|not configured|not mapped|deactivated|blocked|creation failed|posting failed|cancellation failed|rejected|open$|posted with difference|not in mtr|invalid|duplicate)/.test(l)) return 'bad';
    if (/^(queued|pending|sent to api|processing|correction requested|matched within tolerance|invited|waiting|completed with failures|partly|not uploaded|due|warning|cancellation required|cancellation queued|cancellation in progress|running|retry|review|amount difference in business central|needs review)/.test(l)) return 'warn';
    if (/^(validated|new|sales order created|credit memo created|reconciled in business central|in progress|sent|available|b2b|b2c|scheduled|this session)/.test(l)) return 'blue';
    return 'plain';
  };
  A.chip = function (t, cls) { return '<span class="chip ' + (cls || A.chipClass(t)) + (String(t).length > 24 ? ' long' : '') + '">' + A.esc(t) + '</span>'; };

  // ---------- Toast (same as the customer portal) ----------
  var stack = null;
  A.toast = function (text, kind, action) {
    if (!stack) { stack = document.createElement('div'); stack.className = 'toasts'; stack.setAttribute('role', 'status'); stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
    A.toasts = (A.toasts || 0) + 1;
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || 'ok');
    t.innerHTML = '<span class="tt">' + A.esc(text) + '</span>';
    if (action) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ta'; b.textContent = action.label;
      b.addEventListener('click', function () { action.fn(); t.remove(); });
      t.appendChild(b);
    }
    var x = document.createElement('button'); x.type = 'button'; x.className = 'tx'; x.setAttribute('aria-label', 'Dismiss'); x.innerHTML = A.icon('x');
    x.addEventListener('click', function () { t.remove(); });
    t.appendChild(x);
    stack.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 250); }, action ? 6500 : 4200);
    return t;
  };
  // a toast shown on the next screen (after a navigation)
  A.toastNext = function (text, kind) { A.state.t = [text, kind || 'ok']; };

  // ---------- Dialog ----------
  // A.dialog({ title, body (html), ok, cancel | false, danger, wide, onOk(box) -> false keeps it open, onOpen(box) })
  A.dialog = function (o) {
    var prev = document.activeElement;
    var wrap = document.createElement('div'); wrap.className = 'modal';
    wrap.innerHTML = '<div class="box' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><header><h2 id="dlg-t">' + A.esc(o.title) + '</h2><button type="button" class="icon-btn" data-x aria-label="Close">' + A.icon('x') + '</button></header>' +
      '<div class="dbody">' + (o.body || '') + '</div><footer>' + (o.extra || []).map(function (e, i) { return '<button type="button" class="btn' + (i ? '' : ' left') + '" data-e="' + i + '">' + A.esc(e.label) + '</button>'; }).join('') +
      (o.cancel === false ? '' : '<button type="button" class="btn" data-c>' + A.esc(o.cancel || 'Cancel') + '</button>') +
      (o.ok === false ? '' : '<button type="button" class="btn ' + (o.danger ? 'danger' : 'pri') + '" data-ok>' + A.esc(o.ok || 'OK') + '</button>') + '</footer></div>';
    document.body.appendChild(wrap);
    var box = wrap.firstChild;
    var close = function () { wrap.remove(); document.removeEventListener('keydown', key, true); if (prev && prev.focus) prev.focus(); };
    var key = function (e) {
      if (e.key === 'Escape') { if (A.q('.pop')) return; e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        var f = A.qa('button, input, select, textarea, a[href]', box).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    A.qa('[data-x], [data-c]', box).forEach(function (b) { b.addEventListener('click', close); });
    A.qa('[data-e]', box).forEach(function (b) { b.addEventListener('click', function () { var e = o.extra[+b.getAttribute('data-e')]; if (e.fn(box) !== false) close(); }); });
    var okb = A.q('[data-ok]', box);
    if (okb) okb.addEventListener('click', function () { if (o.onOk && o.onOk(box) === false) return; close(); });
    A.hydrate(box);
    if (o.onOpen) o.onOpen(box, close);
    var f0 = A.q('input:not([type=checkbox]):not([readonly]), select, textarea', box) || okb || A.q('[data-x]', box); if (f0) f0.focus();
    return { box: box, close: close };
  };
  A.confirm = function (title, body, ok, fn, danger) { return A.dialog({ title: title, body: '<p>' + body + '</p>', ok: ok, danger: danger, onOk: function () { fn(); } }); };
  // Field helpers for dialogs and forms
  A.field = function (id, label, input, full) { return '<div class="field' + (full ? ' full' : '') + '"><label for="' + id + '">' + A.esc(label) + '</label>' + input + '</div>'; };
  A.input = function (id, value, ph, extra) { return '<input class="input" id="' + id + '" value="' + A.esc(value == null ? '' : value) + '" placeholder="' + A.esc(ph || '') + '"' + (extra || '') + '>'; };
  A.select = function (id, options, selected, extra) {
    return '<select class="input" id="' + id + '"' + (extra || '') + '>' + options.map(function (o) { var v = typeof o === 'object' ? o.value : o, l = typeof o === 'object' ? o.label : o; return '<option value="' + A.esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + A.esc(l) + '</option>'; }).join('') + '</select>';
  };
  A.invalid = function (box, id, msg) {
    var i = A.q('#' + id, box), f = i.closest('.field');
    f.classList.add('invalid');
    var e = A.q('.err', f); if (!e) { e = document.createElement('div'); e.className = 'err'; f.appendChild(e); }
    e.textContent = msg; i.focus();
    i.addEventListener('input', function () { f.classList.remove('invalid'); if (e) e.remove(); }, { once: true });
    return false;
  };

  // ---------- Dropdown (popover list) ----------
  var openMenu = null;
  A.closeMenu = function () { if (openMenu) { openMenu.el.remove(); openMenu.anchor.setAttribute('aria-expanded', 'false'); openMenu = null; } };
  A.menu = function (anchor, items, o) {
    o = o || {};
    if (openMenu && openMenu.anchor === anchor) { A.closeMenu(); return; }
    A.closeMenu();
    var el = document.createElement('div'); el.className = 'pop'; el.setAttribute('role', 'listbox');
    el.innerHTML = items.map(function (it, i) {
      var sel = o.selected !== undefined && it.value === o.selected;
      return '<button type="button" role="option" class="opt' + (sel ? ' on' : '') + '" data-i="' + i + '" aria-selected="' + sel + '"' + (it.disabled ? ' disabled' : '') + '><span class="ck">' + (sel ? A.icon('check') : '') + '</span><span>' + A.esc(it.label) + '</span>' + (it.hint != null ? '<small>' + A.esc(it.hint) + '</small>' : '') + '</button>';
    }).join('');
    document.body.appendChild(el);
    var r = anchor.getBoundingClientRect(), w = Math.max(r.width, 13 * 16);
    el.style.minWidth = w + 'px';
    var left = Math.min(r.left, window.innerWidth - el.offsetWidth - 8);
    el.style.left = Math.max(8, left) + 'px';
    var below = window.innerHeight - r.bottom, h = el.offsetHeight;
    if (below < h + 12 && r.top > below) { el.style.bottom = (window.innerHeight - r.top + 6) + 'px'; el.style.maxHeight = Math.max(160, r.top - 16) + 'px'; }
    else { el.style.top = (r.bottom + 6) + 'px'; el.style.maxHeight = Math.max(160, below - 16) + 'px'; }
    anchor.setAttribute('aria-expanded', 'true');
    openMenu = { el: el, anchor: anchor };
    var btns = A.qa('.opt:not([disabled])', el);
    var cur = btns.filter(function (b) { return b.classList.contains('on'); })[0] || btns[0];
    if (cur) cur.focus();
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.opt'); if (!b) return;
      var it = items[+b.getAttribute('data-i')];
      A.closeMenu(); anchor.focus();
      if (o.onPick) o.onPick(it);
    });
    el.addEventListener('keydown', function (e) {
      var i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[Math.min(btns.length - 1, i + 1)].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); btns[Math.max(0, i - 1)].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); A.closeMenu(); anchor.focus(); }
      else if (e.key === 'Tab') A.closeMenu();
    });
  };
  document.addEventListener('mousedown', function (e) { if (openMenu && !openMenu.el.contains(e.target) && !openMenu.anchor.contains(e.target)) A.closeMenu(); });
  window.addEventListener('scroll', function (e) { if (openMenu && !openMenu.el.contains(e.target)) A.closeMenu(); }, true);
  window.addEventListener('resize', A.closeMenu);

  // ---------- Model, audit, notifications, permissions ----------
  A.refreshModel = function () { A.M = D.model(A.state); return A.M; };
  A.refreshModel();
  A.log = function (action, ref, detail) { (A.state.lg = A.state.lg || []).push([A.now(), A.role, action, ref, detail || '']); };
  A.notify = function (kind, title, text, link, query, roles) { (A.state.nt = A.state.nt || []).push([A.now(), kind, title, text, link || '', query || '', roles || 'ADM OPS FIN']); };
  A.can = function (key) { return A.M.can(A.role, key); };
  A.need = function (key) {
    if (A.can(key)) return true;
    var p = A.M.perms.filter(function (x) { return x.key === key; })[0];
    A.toast((p ? p.name : 'This action') + ' is not allowed for ' + P.roleLabel(A.portal, A.role), 'bad');
    return false;
  };
  A.commit = function (toast, kind) { A.save(); A.rerender(); if (toast) A.toast(toast, kind); };

  // ---------- Links, icons and charts inside rendered markup ----------
  A.hydrate = function (el) {
    A.qa('[data-link]', el).forEach(function (a) {
      var sid = a.getAttribute('data-link'), q = a.getAttribute('data-q');
      if (A.canOpen(sid)) { a.setAttribute('href', A.link(sid, q)); a.removeAttribute('aria-disabled'); }
      else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.setAttribute('title', 'Not available for ' + P.roleLabel(A.portal, A.role)); }
    });
    A.qa('i[data-icon]', el).forEach(function (i) { i.outerHTML = A.icon(i.getAttribute('data-icon')); });
  };
  A.a = function (sid, text, q, cls) { return '<a data-link="' + sid + '"' + (q ? ' data-q="' + A.esc(q) + '"' : '') + (cls ? ' class="' + cls + '"' : '') + '>' + text + '</a>'; };
  A.docLink = function (d, text) { return A.a('AOP-MTR-04', '<b>' + A.esc(text || (d.type === 'Cancel' ? d.ref : d.key)) + '</b>', 'id=' + encodeURIComponent(d.id)); };

  // ---------- Page pieces ----------
  A.head = function (title, acts, chips) { return '<div class="head"><div class="title-row"><h1>' + A.esc(title) + '</h1>' + (chips || '') + '</div><div class="acts">' + (acts || '') + '</div></div>'; };
  A.btn = function (label, attrs, cls, icon) { return '<button class="btn' + (cls ? ' ' + cls : '') + '" type="button" ' + (attrs || '') + '>' + (icon ? A.icon(icon) : '') + A.esc(label) + '</button>'; };
  A.kpi = function (label, value, chip, link, q) {
    var inner = '<label>' + A.esc(label) + '</label><strong>' + value + '</strong><div class="foot">' + (chip || '') + '</div>';
    return link ? '<a class="card kpi kpi-link" data-link="' + link + '"' + (q ? ' data-q="' + A.esc(q) + '"' : '') + '>' + inner + '</a>' : '<div class="card kpi">' + inner + '</div>';
  };
  A.card = function (title, body, o) {
    o = o || {};
    return '<section class="card' + (o.flush ? ' flush' : '') + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '>' + (title ? '<header><h2>' + A.esc(title) + '</h2>' + (o.more || '') + '</header>' : '') + '<div class="body">' + body + '</div></section>';
  };
  A.kv = function (pairs, cls) { return '<dl class="kv' + (cls ? ' ' + cls : '') + '">' + pairs.filter(Boolean).map(function (p) { return '<dt>' + A.esc(p[0]) + '</dt><dd>' + p[1] + '</dd>'; }).join('') + '</dl>'; };
  A.meter = function (pct, cls) { return '<span class="meter ' + (cls || (pct >= 99.9 ? 'ok' : pct >= 80 ? 'warn' : 'bad')) + '"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></span>'; };
  A.chart = function (type, labels, series, o) {
    o = o || {};
    return '<div class="chart" data-type="' + type + '" data-labels=\'' + JSON.stringify(labels).replace(/'/g, '&#39;') + '\' data-series=\'' + JSON.stringify(series).replace(/'/g, '&#39;') + '\'' + (o.money ? ' data-money="true"' : '') + ' data-height="' + (o.height || 260) + '"' + (o.center ? ' data-center="' + A.esc(o.center) + '"' : '') + (o.caption ? ' data-caption="' + A.esc(o.caption) + '"' : '') + '></div>';
  };
  // month and filter dropdown in a page head: A.pick(id, label, value, options)
  A.pick = function (id, label, value, cls) { return '<button type="button" class="sel' + (cls ? ' ' + cls : '') + '" aria-haspopup="listbox" data-pick="' + id + '"><small>' + A.esc(label) + '</small> <span class="v">' + A.esc(value) + '</span>' + A.icon('down') + '</button>'; };
  A.onPick = function (el, id, items, selected, fn) {
    var b = A.q('[data-pick="' + id + '"]', el);
    if (b) b.addEventListener('click', function () { A.menu(b, items, { selected: selected, onPick: fn }); });
  };

  // ---------- Renderers ----------
  var renderers = {};
  A.def = function (sid, fn) { renderers[sid] = fn; };
  A.main = null;
  A.rerender = function () {
    var fn = renderers[A.screen]; if (!fn || !A.main) return;
    var y = window.scrollY;
    A.refreshModel();
    A.main.innerHTML = '';
    fn(A.M, A.main);
    A.hydrate(A.main);
    if (window.CHARTS) window.CHARTS.draw();
    updateBell();
    window.scrollTo(0, y);
  };
  var updateBell = function () {
    var n = A.M.notifications.filter(function (x) { return !x.read && x.roles.split(' ').indexOf(A.role) >= 0; }).length;
    A.qa('[data-ntf-count]').forEach(function (d) { d.textContent = n; d.hidden = !n; });
  };

  // ---------- Lists: search, dropdown filters, tabs, sorting, pages, selection, Excel download ----------
  var tableState = {};
  A.table = function (el, o) {
    var S = tableState[o.id] = tableState[o.id] || { q: '', f: {}, tab: null, sort: o.sort || null, page: 1, sel: {} };
    if (S.tab == null) { var want = A.param('tab'); S.tab = o.tabs ? (o.tabs.filter(function (t) { return t.label === want; })[0] || o.tabs.filter(function (t) { return t.label === o.tab; })[0] || o.tabs[0]).label : null; }
    if (o.filterInit && !S.inited) { S.inited = true; for (var k in o.filterInit) S.f[k] = o.filterInit[k]; }
    var key = o.key || function (r) { return r.id; };
    var size = o.page || 15;
    var all = typeof o.rows === 'function' ? o.rows() : o.rows;
    var cellText = function (c, r) { var v = c.x ? c.x(r) : c.v ? c.v(r) : ''; return v == null ? '' : v; };
    var pass = function (r, skipTab) {
      if (S.q) { var t = (o.search && o.search.text ? o.search.text(r) : o.cols.map(function (c) { return cellText(c, r); }).join(' ')).toLowerCase(); if (t.indexOf(S.q.toLowerCase()) < 0) return false; }
      for (var i = 0; o.filters && i < o.filters.length; i++) { var f = o.filters[i], v = S.f[f.label]; if (v && v !== 'All' && String(f.get(r)) !== v) return false; }
      if (!skipTab && o.tabs && S.tab) { var tb = o.tabs.filter(function (t) { return t.label === S.tab; })[0]; if (tb && tb.test && !tb.test(r)) return false; }
      return true;
    };
    var draw = function () {
      var base = all.filter(function (r) { return pass(r, true); });
      var rows = base.filter(function (r) { return pass(r); });
      if (S.sort) {
        var c = o.cols.filter(function (x) { return x.h === S.sort.h; })[0];
        if (c) {
          var g = c.v || c.x || function () { return ''; };
          rows = rows.slice().sort(function (a, b) { var x = g(a), y = g(b); if (x == null) x = ''; if (y == null) y = ''; var r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true }); return S.sort.d === 'desc' ? -r : r; });
        }
      }
      var pages = Math.max(1, Math.ceil(rows.length / size));
      if (S.page > pages) S.page = pages;
      var start = (S.page - 1) * size, view = rows.slice(start, start + size);
      var selKeys = Object.keys(S.sel).filter(function (k) { return S.sel[k] && all.some(function (r) { return key(r) === k; }); });
      var h = '';
      if (o.title) h += '<header><h2>' + A.esc(o.title) + '</h2>' + (o.more || '') + '</header>';
      if (o.tabs) h += '<div class="tabwrap"><div class="tabs" role="tablist">' + o.tabs.map(function (t) { var n = base.filter(function (r) { return !t.test || t.test(r); }).length; return '<span role="tab" tabindex="0" data-tab="' + A.esc(t.label) + '" aria-selected="' + (t.label === S.tab) + '" class="' + (t.label === S.tab ? 'on' : '') + '">' + A.esc(t.label) + '<b>' + A.fmtN(n) + '</b></span>'; }).join('') + '</div></div>';
      if (o.search || o.filters || o.exportName || o.tools) {
        h += '<div class="filters">' + (o.search ? '<label class="finder grow">' + A.icon('search') + '<input type="search" value="' + A.esc(S.q) + '" placeholder="' + A.esc(o.search.ph) + '" aria-label="' + A.esc(o.search.ph) + '"></label>' : '<span class="grow"></span>') +
          (o.filters || []).map(function (f) { return '<button type="button" class="sel" aria-haspopup="listbox" data-filter="' + A.esc(f.label) + '"><small>' + A.esc(f.label) + '</small> <span class="v">' + A.esc(S.f[f.label] || 'All') + '</span>' + A.icon('down') + '</button>'; }).join('') +
          (o.tools || '') + (o.exportName ? '<button type="button" class="btn" data-export>' + A.icon('download') + 'Download Excel</button>' : '') + '</div>';
      }
      if (o.select && selKeys.length) {
        h += '<div class="bulk"><b>' + A.plural(selKeys.length, 'row') + ' selected</b>' + o.select.map(function (a, i) { return '<button type="button" class="btn sm' + (a.danger ? ' danger' : i === 0 ? ' pri' : '') + '" data-bulk="' + i + '">' + A.esc(a.label) + '</button>'; }).join('') + '<button type="button" class="btn sm" data-clear>Clear Selection</button></div>';
      }
      h += '<div class="body"><div class="table-wrap"><table class="tbl wrap' + (o.cls ? ' ' + o.cls : '') + '"><thead><tr>' + (o.select ? '<th class="c"><input type="checkbox" aria-label="Select all rows on this page" data-all' + (view.length && view.every(function (r) { return S.sel[key(r)]; }) ? ' checked' : '') + '></th>' : '') +
        o.cols.map(function (c) { return '<th' + (c.num ? ' class="num"' : '') + (c.nosort ? '' : ' data-sort="' + (S.sort && S.sort.h === c.h ? S.sort.d : '') + '" data-h="' + A.esc(c.h) + '" tabindex="0"') + '>' + A.esc(c.h) + '</th>'; }).join('') + '</tr></thead><tbody>';
      if (!view.length) h += '<tr class="empty-row"><td colspan="' + (o.cols.length + (o.select ? 1 : 0)) + '">' + A.esc(o.empty || 'No rows match') + '</td></tr>';
      view.forEach(function (r) {
        var k = key(r);
        h += '<tr' + (o.rowCls ? ' class="' + (o.rowCls(r) || '') + '"' : '') + ' data-key="' + A.esc(k) + '">' + (o.select ? '<td class="c"><input type="checkbox" aria-label="Select row" data-row="' + A.esc(k) + '"' + (S.sel[k] ? ' checked' : '') + (o.selectable && !o.selectable(r) ? ' disabled' : '') + '></td>' : '') +
          o.cols.map(function (c) { var cls = [c.num ? 'num' : '', c.cls || ''].join(' ').trim(); return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + (c.f ? c.f(r) : A.esc(cellText(c, r))) + '</td>'; }).join('') + '</tr>';
      });
      h += '</tbody>' + (o.foot && rows.length ? '<tfoot>' + o.foot(rows) + '</tfoot>' : '') + '</table></div>';
      var pgn = '';
      if (pages > 1) {
        var nums = [], p;
        for (p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - S.page) <= 1) nums.push(p); else if (nums[nums.length - 1] !== '…') nums.push('…');
        pgn = '<button type="button" data-pg="' + (S.page - 1) + '"' + (S.page === 1 ? ' disabled' : '') + ' aria-label="Previous page">' + A.icon('back') + '</button>' +
          nums.map(function (n) { return n === '…' ? '<span class="gap">…</span>' : '<button type="button" data-pg="' + n + '" class="' + (n === S.page ? 'on' : '') + '">' + n + '</button>'; }).join('') +
          '<button type="button" data-pg="' + (S.page + 1) + '"' + (S.page === pages ? ' disabled' : '') + ' aria-label="Next page">' + A.icon('arrow') + '</button>';
      }
      h += '<div class="pg"><span>' + (rows.length ? 'Showing ' + A.fmtN(start + 1) + ' to ' + A.fmtN(start + view.length) + ' of ' + A.fmtN(rows.length) + ' ' + (o.noun || 'rows') : 'No ' + (o.noun || 'rows')) + '</span><div class="pages">' + pgn + '</div></div></div>';
      el.innerHTML = h;
      A.hydrate(el);
      // wiring
      var inp = A.q('.finder input', el);
      if (inp) inp.addEventListener('input', function () { S.q = inp.value; S.page = 1; var pos = inp.selectionStart; draw(); var n = A.q('.finder input', el); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* search inputs in some browsers */ } });
      A.qa('[data-tab]', el).forEach(function (t) { var go = function () { S.tab = t.getAttribute('data-tab'); S.page = 1; draw(); }; t.addEventListener('click', go); t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
      A.qa('[data-filter]', el).forEach(function (b) {
        b.addEventListener('click', function () {
          var f = o.filters.filter(function (x) { return x.label === b.getAttribute('data-filter'); })[0];
          var counts = {};
          all.forEach(function (r) { var v = String(f.get(r)); counts[v] = (counts[v] || 0) + 1; });
          var vals = f.options || Object.keys(counts).sort(function (a, c) { return a.localeCompare(c, 'en', { numeric: true }); });
          A.menu(b, [{ label: 'All', value: 'All', hint: A.fmtN(all.length) }].concat(vals.map(function (v) { return { label: v, value: v, hint: A.fmtN(counts[v] || 0) }; })), { selected: S.f[f.label] || 'All', onPick: function (it) { S.f[f.label] = it.value; S.page = 1; draw(); } });
        });
      });
      A.qa('th[data-h]', el).forEach(function (th) {
        var go = function () { var hh = th.getAttribute('data-h'); S.sort = S.sort && S.sort.h === hh ? { h: hh, d: S.sort.d === 'asc' ? 'desc' : 'asc' } : { h: hh, d: 'asc' }; draw(); };
        th.addEventListener('click', go); th.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      });
      A.qa('[data-pg]', el).forEach(function (b) { b.addEventListener('click', function () { S.page = +b.getAttribute('data-pg'); draw(); el.scrollIntoView({ block: 'nearest' }); }); });
      var ex = A.q('[data-export]', el);
      if (ex) ex.addEventListener('click', function () {
        var cols = o.cols.filter(function (c) { return !c.noexport; });
        var data = [cols.map(function (c) { return c.h; })].concat(rows.map(function (r) { return cols.map(function (c) { var v = c.x ? c.x(r) : c.v ? c.v(r) : ''; return v == null ? '' : v; }); }));
        A.xlsx(o.exportName + '.xlsx', o.sheet || 'Sheet1', data);
        A.toast(A.plural(rows.length, 'row') + ' downloaded to ' + o.exportName + '.xlsx');
      });
      A.qa('[data-row]', el).forEach(function (c) { c.addEventListener('change', function () { S.sel[c.getAttribute('data-row')] = c.checked; draw(); }); });
      var ca = A.q('[data-all]', el);
      if (ca) ca.addEventListener('change', function () { view.forEach(function (r) { if (!o.selectable || o.selectable(r)) S.sel[key(r)] = ca.checked; }); draw(); });
      A.qa('[data-bulk]', el).forEach(function (b) { b.addEventListener('click', function () { var act = o.select[+b.getAttribute('data-bulk')]; var chosen = all.filter(function (r) { return S.sel[key(r)]; }); act.fn(chosen, function () { S.sel = {}; }); }); });
      var cl = A.q('[data-clear]', el);
      if (cl) cl.addEventListener('click', function () { S.sel = {}; draw(); });
      if (o.after) o.after(el, view);
    };
    draw();
    return { draw: draw, state: S };
  };
  A.resetTable = function (id) { delete tableState[id]; };

  // ---------- Files: download, Excel writer, Excel and CSV reader ----------
  A.download = function (name, blob) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  };
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  var crc32 = function (b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  var utf8 = function (s) { return new TextEncoder().encode(s); };
  var zip = function (files) {    // stored (no compression) zip
    var parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = utf8(f.name), data = f.data, c = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x5421, true);
      h.setUint32(14, c, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var e = new DataView(new ArrayBuffer(46));
      e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint16(8, 0x0800, true); e.setUint16(10, 0, true); e.setUint16(12, 0, true); e.setUint16(14, 0x5421, true);
      e.setUint32(16, c, true); e.setUint32(20, data.length, true); e.setUint32(24, data.length, true); e.setUint16(28, name.length, true);
      e.setUint32(42, off, true);
      central.push(new Uint8Array(e.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (t, p) { return t + p.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };
  var xesc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); };
  var colName = function (i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  A.xlsxBlob = function (sheet, rows) {
    var widths = [];
    rows.forEach(function (r) { r.forEach(function (v, i) { widths[i] = Math.min(60, Math.max(widths[i] || 8, String(v == null ? '' : v).length + 2)); }); });
    var sd = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' +
      widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>' +
      rows.map(function (r, ri) {
        return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) {
          var ref = colName(ci) + (ri + 1), s = ri === 0 ? ' s="1"' : '';
          if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + s + '><v>' + v + '</v></c>';
          return '<c r="' + ref + '" t="inlineStr"' + s + '><is><t xml:space="preserve">' + xesc(v == null ? '' : v) + '</t></is></c>';
        }).join('') + '</row>';
      }).join('') + '</sheetData>' + (rows.length > 1 ? '<autoFilter ref="A1:' + colName(Math.max(0, rows[0].length - 1)) + rows.length + '"/>' : '') + '</worksheet>';
    var files = [
      { name: '[Content_Types].xml', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>') },
      { name: '_rels/.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xesc(sheet.slice(0, 31)) + '" sheetId="1" r:id="rId1"/></sheets></workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
      { name: 'xl/styles.xml', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F4FF"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs></styleSheet>') },
      { name: 'xl/worksheets/sheet1.xml', data: utf8(sd) }
    ];
    return zip(files);
  };
  A.xlsx = function (name, sheet, rows) { A.download(name, A.xlsxBlob(sheet, rows)); };
  A.csvBlob = function (rows) {
    var t = rows.map(function (r) { return r.map(function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
    return new Blob(['﻿' + t], { type: 'text/csv' });
  };
  A.parseCSV = function (text) {
    text = text.replace(/^﻿/, '');
    var rows = [], row = [], f = '', q = false, i, c, delim = text.split('\n')[0].split('\t').length > text.split('\n')[0].split(',').length ? '\t' : ',';
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f.length || row.length) { row.push(f.replace(/\r$/, '')); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
  };
  var unzip = function (buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf), i, out = {};
    for (i = buf.byteLength - 22; i >= 0 && dv.getUint32(i, true) !== 0x06054b50; i--);
    if (i < 0) return Promise.reject(new Error('The file is not a valid Excel workbook'));
    var n = dv.getUint16(i + 10, true), p = dv.getUint32(i + 16, true), jobs = [];
    var dec = new TextDecoder();
    for (var k = 0; k < n; k++) {
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      var ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
      var data = u8.subarray(ds, ds + csize);
      (function (name, method, data) {
        if (!/\.xml$|\.rels$/.test(name)) return;
        if (method === 0) { out[name] = dec.decode(data); return; }
        if (typeof DecompressionStream === 'undefined') { jobs.push(Promise.reject(new Error('This browser cannot read compressed Excel files; save the file as CSV and upload it'))); return; }
        jobs.push(new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text().then(function (t) { out[name] = t; }));
      })(name, method, data);
      p += 46 + nl + xl + cl;
    }
    return Promise.all(jobs).then(function () { return out; });
  };
  A.parseXLSX = function (buf) {
    return unzip(buf).then(function (files) {
      var parse = function (s) { return new DOMParser().parseFromString(s, 'application/xml'); };
      var ss = [];
      if (files['xl/sharedStrings.xml']) A.qa('si', parse(files['xl/sharedStrings.xml'])).forEach(function (si) { ss.push(A.qa('t', si).map(function (t) { return t.textContent; }).join('')); });
      var sheetName = Object.keys(files).filter(function (k) { return /^xl\/worksheets\/sheet\d*\.xml$/.test(k); }).sort()[0];
      if (!sheetName) throw new Error('The workbook has no worksheet');
      var doc = parse(files[sheetName]), rows = [];
      A.qa('sheetData row', doc).forEach(function (r) {
        var row = [];
        A.qa('c', r).forEach(function (c) {
          var ref = c.getAttribute('r') || '', col = 0, m = ref.match(/^[A-Z]+/);
          if (m) { for (var i = 0; i < m[0].length; i++) col = col * 26 + (m[0].charCodeAt(i) - 64); col--; } else col = row.length;
          var t = c.getAttribute('t'), v = A.q('v', c), val;
          if (t === 's') val = ss[+v.textContent] || '';
          else if (t === 'inlineStr') val = A.qa('t', c).map(function (x) { return x.textContent; }).join('');
          else val = v ? v.textContent : '';
          row[col] = val;
        });
        for (var j = 0; j < row.length; j++) if (row[j] == null) row[j] = '';
        rows.push(row);
      });
      return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
    });
  };
  // Reads a File (CSV, TXT or XLSX) into rows of text.
  A.readTable = function (file) {
    var isX = /\.xlsx$/i.test(file.name);
    if (!isX && !/\.(csv|txt|tsv)$/i.test(file.name)) return Promise.reject(new Error('Only Excel (.xlsx) and CSV files can be uploaded; ' + file.name + ' is neither'));
    return file.arrayBuffer().then(function (buf) { return isX ? A.parseXLSX(buf) : A.parseCSV(new TextDecoder().decode(buf)); });
  };

  // ---------- Upload box ----------
  // A.uploader(el, { id, accept, required: [headers], sample(): {name, rows, csv}, template(): {name, rows}, onReady(file), onClear(), disabled: 'reason' })
  // file = { name, size, rows (with header), headers, objects: [{Header: value}], sample: bool }
  A.uploader = function (el, o) {
    var cur = null, problem = null;
    var draw = function () {
      var h = '<div class="drop up" data-drop>';
      if (!cur) {
        h += '<span class="up-ico">' + A.icon('upload') + '</span><div class="grow up-tx"><b>Drag a file here or choose one</b><span class="up-fmt">' + A.chip('Excel (.xlsx)', 'plain') + A.chip('CSV', 'plain') + '</span></div>' +
          '<input type="file" accept="' + (o.accept || '.xlsx,.csv') + '" hidden data-file>' +
          (o.sample ? '<button type="button" class="btn" data-sample>' + A.icon('doc') + (o.sampleLabel || 'Use Sample File') + '</button>' : '') +
          '<button type="button" class="btn pri" data-choose>' + A.icon('upload') + 'Choose File</button>';
      } else {
        h += '<span class="file">' + A.icon(/xlsx$/i.test(cur.name) ? 'sheet' : 'doc') + A.esc(cur.name) + '</span>' + A.chip(A.fmtSize(cur.size), 'plain') + A.chip(A.plural(cur.rows.length - 1, 'row'), problem ? 'bad' : 'ok') +
          '<span class="grow"></span><button type="button" class="btn" data-remove>' + A.icon('x') + 'Remove File</button>';
      }
      h += '</div>';
      if (problem) h += '<div class="up-err">' + A.icon('warn') + '<div><b>' + A.esc(problem.title) + '</b>' + (problem.items ? '<ul>' + problem.items.map(function (x) { return '<li>' + A.esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>';
      el.innerHTML = h;
      var fi = A.q('[data-file]', el);
      var ch = A.q('[data-choose]', el);
      if (ch) ch.addEventListener('click', function () { if (o.disabled && o.disabled()) { A.toast(o.disabled(), 'warn'); return; } fi.click(); });
      if (fi) fi.addEventListener('change', function () { if (fi.files[0]) take(fi.files[0]); });
      var sm = A.q('[data-sample]', el);
      if (sm) sm.addEventListener('click', function () {
        if (o.disabled && o.disabled()) { A.toast(o.disabled(), 'warn'); return; }
        var s = o.sample();
        if (!s) return;
        var blob = /\.csv$/i.test(s.name) ? A.csvBlob(s.rows) : A.xlsxBlob(s.sheet || 'Sheet1', s.rows);
        var f = new File([blob], s.name, { type: blob.type });
        take(f, true);
      });
      var rm = A.q('[data-remove]', el);
      if (rm) rm.addEventListener('click', function () { cur = null; problem = null; draw(); if (o.onClear) o.onClear(); });
      var dz = A.q('[data-drop]', el);
      dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.setAttribute('data-over', 'true'); });
      dz.addEventListener('dragleave', function () { dz.removeAttribute('data-over'); });
      dz.addEventListener('drop', function (e) { e.preventDefault(); dz.removeAttribute('data-over'); if (o.disabled && o.disabled()) { A.toast(o.disabled(), 'warn'); return; } if (e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); });
    };
    var take = function (file, sample) {
      A.readTable(file).then(function (rows) {
        problem = null;
        var headers = (rows[0] || []).map(function (h) { return String(h).trim(); });
        cur = { name: file.name, size: file.size, rows: rows, headers: headers, sample: !!sample, file: file };
        var lower = headers.map(function (h) { return h.toLowerCase(); });
        var missing = (o.required || []).filter(function (h) { return lower.indexOf(h.toLowerCase()) < 0; });
        if (rows.length < 2) problem = { title: 'The file has no data rows' };
        else if (missing.length) problem = { title: missing.length + ' required ' + (missing.length === 1 ? 'column is' : 'columns are') + ' missing', items: missing.slice(0, 8).concat(missing.length > 8 ? ['and ' + (missing.length - 8) + ' more'] : []) };
        cur.objects = rows.slice(1).map(function (r) { var ob = {}; headers.forEach(function (h, i) { ob[h] = r[i] == null ? '' : String(r[i]).trim(); }); lower.forEach(function (h, i) { ob[h] = r[i] == null ? '' : String(r[i]).trim(); }); return ob; });
        if (!problem && o.check) { var c = o.check(cur); if (c) problem = c; }
        draw();
        if (!problem && o.onReady) o.onReady(cur); else if (o.onClear) o.onClear();
      }).catch(function (e) { cur = null; problem = { title: e.message || String(e) }; draw(); if (o.onClear) o.onClear(); });
    };
    draw();
    return { clear: function () { cur = null; problem = null; draw(); }, get: function () { return problem ? null : cur; } };
  };

  // Progress dialog: steps tick one after another, then done() runs.
  A.progress = function (title, steps, done) {
    var d = A.dialog({ title: title, body: '<ol class="prog">' + steps.map(function (s) { return '<li>' + A.esc(s) + '</li>'; }).join('') + '</ol>', ok: false, cancel: false });
    A.q('[data-x]', d.box).hidden = true;
    var li = A.qa('.prog li', d.box), i = 0;
    var tick = function () {
      if (i > 0) { li[i - 1].className = 'done'; }
      if (i < li.length) { li[i].className = 'now'; i++; setTimeout(tick, 380); }
      else setTimeout(function () { d.close(); done(); }, 260);
    };
    tick();
  };

  // ---------- Top-bar search: screens, invoices, orders, SKUs, requests ----------
  var setupSearch = function () {
    var inp = A.q('.top .search input'); if (!inp) return;
    var results = function (q) {
      q = q.trim().toLowerCase(); if (q.length < 2) return [];
      var out = [];
      P.forRole(A.portal, A.role).forEach(function (s) { if (s.kind === 'm' && s.name.toLowerCase().indexOf(q) >= 0) out.push({ label: s.name, hint: 'Screen', go: function () { A.go(s.id); } }); });
      A.M.docs.forEach(function (d) {
        if (out.length > 12) return;
        if (d.key.toLowerCase().indexOf(q) >= 0 || d.inv.orderId.indexOf(q) >= 0 || (d.ref && d.ref.toLowerCase().indexOf(q) >= 0)) out.push({ label: d.key + ' · ' + d.inv.orderId, hint: d.type === 'FreeReplacement' ? 'Free Replacement' : d.type, go: function () { A.go('AOP-MTR-04', 'id=' + encodeURIComponent(d.id)); } });
      });
      A.M.listings.forEach(function (l) { if ((l.sku + ' ' + l.asin).toLowerCase().indexOf(q) >= 0 && A.canOpen('AOP-MAP-01')) out.push({ label: l.sku, hint: 'Amazon SKU', go: function () { A.go('AOP-MAP-01', 'q=' + encodeURIComponent(l.sku)); } }); });
      A.M.cancels.forEach(function (r) { if ((r.id + ' ' + r.postedNo).toLowerCase().indexOf(q) >= 0 && A.canOpen('AOP-CAN-02')) out.push({ label: r.id + ' · ' + r.postedNo, hint: 'Cancellation Request', go: function () { A.go('AOP-CAN-02', 'id=' + r.id); } }); });
      A.M.jobs.forEach(function (j) { if (j.id.toLowerCase().indexOf(q) >= 0) out.push({ label: j.id + ' · ' + j.type, hint: 'Job', go: function () { A.go('AOP-INT-02', 'id=' + j.id); } }); });
      return out.slice(0, 12);
    };
    var t;
    var show = function () {
      var r = results(inp.value);
      if (!r.length) { A.closeMenu(); if (inp.value.trim().length >= 2) A.menu(inp.parentNode, [{ label: 'Nothing found for “' + inp.value.trim() + '”', value: 0, disabled: true }], {}); inp.focus(); return; }
      A.closeMenu();
      A.menu(inp.parentNode, r.map(function (x, i) { return { label: x.label, hint: x.hint, value: i }; }), { onPick: function (it) { r[it.value].go(); } });
      inp.focus();
    };
    inp.addEventListener('input', function () { clearTimeout(t); t = setTimeout(show, 180); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var r = results(inp.value); if (r[0]) r[0].go(); } if (e.key === 'ArrowDown') { var b = A.q('.pop .opt:not([disabled])'); if (b) { e.preventDefault(); b.focus(); } } });
  };

  // ---------- Reset Data (review bar) ----------
  var bar = A.q('.review .pager');
  if (bar) {
    var rb = document.createElement('button'); rb.type = 'button'; rb.className = 'reset'; rb.textContent = 'Reset Data';
    rb.title = 'Clear everything changed in this session';
    rb.addEventListener('click', function () {
      A.dialog({ title: 'Reset Data', body: '<p>This clears every upload, mapping, resolution, job and cancellation made in this session and restores the starting data of 6 November 2026.</p>', ok: 'Reset Data', danger: true,
        onOk: function () { A.state = {}; var u = new URL(location.href); u.searchParams.delete('st'); location.href = u.toString(); } });
    });
    bar.insertBefore(rb, bar.firstChild);
  }

  // ---------- Start-up ----------
  A.boot = function () {
    A.main = A.q('main');
    var fn = renderers[A.screen];
    if (fn && A.main) { A.main.innerHTML = ''; fn(A.M, A.main); A.hydrate(A.main); }
    if (window.CHARTS) window.CHARTS.draw();
    updateBell();
    setupSearch();
    if (A.state.t) { var t = A.state.t; delete A.state.t; A.save(); A.toast(t[0], t[1]); }
    if (A.encoded()) A.qa('a[href]').forEach(function (a) { var h = a.getAttribute('href'), n = A.withState(h); if (n && n !== h) a.setAttribute('href', n); });
    document.documentElement.classList.add('app-ready');
  };
})();
