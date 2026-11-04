/*
 * Sign-in screens: Sign In, Forgot Password, Password Reset Sent, Access Denied (AUT-01 to AUT-04).
 * Layout and classes as the customer portal's sign-in screens (.auth, .auth-form, .auth-box, .auth-panel).
 */
(function () {
  var A = window.APP, P = window.PORTAL;
  var logo = function () { return '<img class="logo" src="' + P.root + 'assets/brand/logo-480.webp" srcset="' + P.root + 'assets/brand/logo-480.webp 480w, ' + P.root + 'assets/brand/logo-960.webp 960w" sizes="10rem" width="172" height="32" alt="MAVRO.AI">'; };
  var panel = function () {
    return '<aside class="auth-panel" aria-label="How the portal connects the systems"><div class="pipe">' +
      '<div class="node"><i>' + A.icon('sheet') + '</i><div><b>Amazon Seller Central</b><span>Monthly Transaction Report, B2C and B2B</span></div></div><div class="arrow"></div>' +
      '<div class="node hl"><i>' + A.icon('check') + '</i><div><b>Amazon Operations Portal</b><span>Upload, reconcile, map, resolve</span></div></div><div class="arrow"></div>' +
      '<div class="node"><i>' + A.icon('receipt') + '</i><div><b>Microsoft Dynamics 365 Business Central</b><span>Sales orders, invoices, credit memos, cancellations</span></div></div>' +
      '</div></aside>';
  };
  var page = function (main, inner, wide) { main.innerHTML = '<div class="auth-form"><div class="auth-box' + (wide ? ' wide' : '') + '">' + logo() + inner + '</div></div>' + panel(); };
  var dash = function (role) { var p = P.portal('operations'); return P.href(P.root, P.dashboard(p, role), role); };

  A.def('AUT-01', function (M, main) {
    var users = M.users.filter(function (u) { return u.role !== 'SVC'; });
    var email = A.param('email') || 'sneha.patil@crestlinelaminates.example';
    page(main, '<div><h1>Sign in to the Amazon Operations Portal</h1></div>' +
      '<form novalidate>' +
      '<div class="field"><label for="email">Email address</label><input class="input" id="email" type="email" value="' + A.esc(email) + '" autocomplete="off"></div>' +
      '<div class="field"><label for="password">Password</label><div class="input-wrap"><input class="input" id="password" type="password" value="prototype-password" autocomplete="off"><button type="button" data-toggle aria-label="Show password">' + A.icon('eye') + '</button></div></div>' +
      '<div class="row"><label class="check"><input type="checkbox" id="keep" checked> Keep me signed in</label><a data-link="AUT-02">Forgot password?</a></div>' +
      '<button class="btn pri block" type="submit">Sign In</button></form>' +
      '<div class="field"><span class="label">Sign in as</span><div class="hint-row">' + users.filter(function (u) { return ['USR-001', 'USR-002', 'USR-003'].indexOf(u.id) >= 0; }).map(function (u) { return '<button type="button" class="btn sm" data-as="' + A.esc(u.email) + '">' + A.esc(u.name) + ' · ' + A.esc(A.M && window.MTRDATA.ROLE_NAMES[u.role]) + '</button>'; }).join('') + '</div></div>');
    var f = A.q('form', main), em = A.q('#email', main), pw = A.q('#password', main);
    A.q('[data-toggle]', main).addEventListener('click', function () { pw.type = pw.type === 'password' ? 'text' : 'password'; });
    var mark = function () { A.qa('[data-as]', main).forEach(function (x) { var on = x.getAttribute('data-as') === em.value.trim().toLowerCase(); x.setAttribute('aria-pressed', String(on)); x.classList.toggle('pri', on); }); };
    A.qa('[data-as]', main).forEach(function (b) { b.addEventListener('click', function () { em.value = b.getAttribute('data-as'); mark(); em.focus(); }); });
    em.addEventListener('input', mark);
    mark();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = em.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return A.invalid(main, 'email', 'Enter a valid email address');
      if (!pw.value) return A.invalid(main, 'password', 'Enter your password');
      if (pw.value.length < 8) return A.invalid(main, 'password', 'The password is incorrect');
      var u = M.users.filter(function (x) { return x.email.toLowerCase() === v; })[0];
      if (!u || u.role === 'SVC') return A.invalid(main, 'email', 'No portal account uses this email address');
      if (u.status === 'Deactivated') return A.invalid(main, 'email', 'This account is deactivated; ask your System Administrator');
      if (u.status === 'Invited') return A.invalid(main, 'email', 'This account has not accepted its invitation yet');
      (A.state.lg = A.state.lg || []).push([A.now(), u.role, 'Signed In', u.id, u.name]);
      location.href = A.withState(dash(u.role));
    });
  });

  A.def('AUT-02', function (M, main) {
    page(main, '<div><h1>Reset your password</h1></div><form novalidate><div class="field"><label for="email">Email address</label><input class="input" id="email" type="email" value="" placeholder="name@crestlinelaminates.example" autocomplete="off"></div>' +
      '<button class="btn pri block" type="submit">Send Reset Link</button></form><a class="btn block" data-link="AUT-01">Back to Sign In</a>');
    A.q('form', main).addEventListener('submit', function (e) {
      e.preventDefault();
      var v = A.q('#email', main).value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return A.invalid(main, 'email', 'Enter a valid email address');
      location.href = A.link('AUT-03', 'email=' + encodeURIComponent(v));
    });
  });

  A.def('AUT-03', function (M, main) {
    var em = A.param('email') || 'sneha.patil@crestlinelaminates.example';
    page(main, '<div><h1>Check your email</h1></div><p class="small">We sent a password reset link to <b>' + A.esc(em) + '</b>. The link expires in 30 minutes.</p>' +
      '<button class="btn block" type="button" data-resend>Resend Link</button><a class="btn pri block" data-link="AUT-01" data-q="email=' + encodeURIComponent(em) + '">Back to Sign In</a>');
    A.q('[data-resend]', main).addEventListener('click', function () { A.toast('A new reset link was sent to ' + em); });
  });

  A.def('AUT-04', function (M, main) {
    page(main, '<div><h1>Access denied</h1></div><p class="small">Your role does not have permission to open this screen. Ask your System Administrator to change your role in Roles and Permissions.</p>' +
      '<div class="field"><span class="label">Go to your dashboard</span><div class="hint-row">' + ['ADM', 'OPS', 'FIN'].map(function (r) { return '<a class="btn sm" href="' + A.withState(dash(r)) + '">' + A.esc(window.MTRDATA.ROLE_NAMES[r]) + '</a>'; }).join('') + '</div></div>' +
      '<a class="btn pri block" data-link="AUT-01">Sign In as Another User</a>');
  });
})();
