#!/usr/bin/env node
/*
 * End-to-end walk through the October 2026 close, opened from disk (needs Playwright):
 * upload the B2B MTR, reconcile, map SKUs, resolve customers from Excel, set up the Seller GSTIN, resolve header and item
 * errors, create sales orders, reconcile before posting, post, verify after posting, credit memos, cancellations.
 * Prints each step and fails on a page error or an expectation that is not met.  node tools/e2e.js
 */
const { chromium } = require('playwright');
const path = require('path');
const root = 'file://' + path.join(__dirname, '..') + '/screens/operations/';
let failed = 0;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) failed++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  let st = '';
  const go = async (file, q) => { await p.goto(root + file + '?' + [q, st ? 'st=' + st : ''].filter(Boolean).join('&')); await p.waitForTimeout(200); };
  const keep = () => { const u = new URL(p.url()); st = u.searchParams.get('st') || st; };
  let seen = 0;
  p.on('load', () => { seen = 0; });
  // waits for the next toast after the last one read on this page
  const toast = async () => { await p.waitForFunction(n => (window.APP && APP.toasts || 0) > n, seen, { timeout: 10000 }); seen = await p.evaluate(() => APP.toasts); return p.locator('.toast .tt').last().textContent(); };
  const btn = (label) => p.locator('button', { hasText: label }).first();
  const kpi = async (label) => (await p.locator('.kpi', { has: p.locator('label', { hasText: label }) }).first().locator('strong').textContent()).trim();

  // 1. Upload the October B2B MTR as the Marketplace Operations Executive
  await go('amazon-excel-csv-upload.html', 'role=OPS');
  await p.selectOption('#ur', 'B2B');
  await btn('Use Sample File').click(); await p.waitForTimeout(300);
  await btn('Upload and Save').click();
  await p.locator('.modal h2', { hasText: 'MTR Saved' }).waitFor({ timeout: 8000 });
  ok(true, 'B2B MTR uploaded and saved');
  await p.locator('.modal [data-ok]').click(); await p.waitForURL(/mtr-reconciliation/);
  console.log('     ' + await toast()); keep();
  const docs = await kpi('Documents Reconciled');
  ok(docs.replace(/,/g, '') > 684, 'reconciliation includes B2B documents: ' + docs);

  // 2. Map one SKU
  await go('amazon-sku-mapping.html', 'role=OPS');
  const before = await kpi('Not Mapped');
  await p.locator('[data-map]').first().click(); await btn('Save Mapping').click();
  console.log('     ' + await toast()); keep();
  ok(+(await kpi('Not Mapped')) === before - 1, 'SKU mapped: ' + before + ' → ' + await kpi('Not Mapped'));
  // and the rest from the mapping file
  await btn('Upload Mapping File').click(); await p.locator('.modal').locator('button', { hasText: 'Use Completed Sample' }).click(); await p.waitForTimeout(300);
  await p.locator('.modal [data-ok]').click(); console.log('     ' + await toast()); keep();
  ok(await kpi('Not Mapped') === '0', 'all SKUs mapped from the Excel file');

  // 3. Missing customers through the Excel round trip
  await go('missing-customer.html', 'role=OPS');
  const miss = await kpi('Missing Customers');
  await btn('Use Completed Sample').click(); await p.waitForTimeout(300);
  await p.locator('[data-apply]').click(); console.log('     ' + await toast()); keep();
  ok(await kpi('Missing Customers') === '0', 'missing customers resolved from Excel: ' + miss + ' → 0');

  // 4. Set up the Seller GSTIN as the System Administrator
  await go('seller-gstin-setup.html', 'add=33AAHCC4821K1Z4');
  await p.locator('.modal [data-ok]').click(); console.log('     ' + await toast()); keep();
  ok(await kpi('Not Set Up') === '0', 'Seller GSTIN set up');

  // 5. Remaining header and item errors
  await go('amazon-inventory-header-error.html', 'role=OPS');
  for (let i = 0; i < 12; i++) {
    const a = p.locator('[data-act]').first();
    if (!(await a.count())) break;
    const act = await a.getAttribute('data-act');
    await a.click();
    if (act === 'accept') { await p.fill('#rn', 'Amazon rounding on promotion'); await p.locator('.modal [data-ok]').click(); }
    else if (act === 'link') { await p.fill('#pi', 'PSI-2608-17462'); await p.locator('.modal [data-ok]').click(); }
    else await p.locator('.modal [data-ok]').click();
    await toast(); await p.waitForTimeout(100);
  }
  keep();
  ok((await p.locator('.head .chip').first().textContent()).includes('None Open'), 'header errors: ' + await p.locator('.head .chip').first().textContent());
  await go('amazon-inventory-item-error.html', 'role=OPS');
  for (let i = 0; i < 12; i++) {
    const a = p.locator('[data-act]').first();
    if (!(await a.count())) break;
    const act = await a.getAttribute('data-act');
    await a.click();
    if (act === 'unblock') await p.locator('.modal [data-ok]').click();
    await p.waitForTimeout(150); await toast();
  }
  keep();
  ok((await p.locator('.head .chip').first().textContent()).includes('None Open'), 'item errors: ' + await p.locator('.head .chip').first().textContent());

  // 6. Create sales orders and credit memos as Finance
  await go('business-central-integration.html', 'role=FIN');
  for (const k of ['SO', 'CM']) {
    const r = p.locator('[data-run="' + k + '"]');
    if (await r.isDisabled()) continue;
    await r.click(); await p.locator('.modal [data-ok]').click(); console.log('     ' + await toast()); keep();
  }
  console.log('     ready: ' + await p.evaluate(() => { const M = APP.M; return M.readyToCreate('SO','2026-10').map(d=>d.id+':'+d.type+':'+M.stage(d)).slice(0,5).join(', ') + ' / CM ' + M.readyToCreate('CM','2026-10').map(d=>d.id+':'+M.stage(d)).slice(0,5).join(', '); }));
  ok(await kpi('Waiting to Send') === '0', 'every validated document sent to Business Central');
  await p.locator('a', { hasText: 'JOB-2610-01' }).first().click(); await p.waitForURL(/integration-job/);
  await btn('Retry').click(); console.log('     ' + await toast()); keep();

  // 7. Before posting: upload, resolve differences, upload again, send for posting
  await go('excel-upload-before-posting.html', 'role=FIN');
  await btn('Use Sample File').click(); await p.waitForTimeout(400);
  await btn('Upload and Reconcile').click(); console.log('     ' + await toast()); keep();
  for (let i = 0; i < 14; i++) {
    const a = p.locator('[data-bact]').first(); if (!(await a.count())) break;
    const act = await a.getAttribute('data-bact'); await a.click();
    if (act === 'accept') await p.fill('#rn', 'Rounding difference accepted');
    if (act !== 'retry') await p.locator('.modal [data-ok]').click();
    await toast(); await p.waitForTimeout(100);
  }
  keep();
  console.log('     review: ' + await p.evaluate(() => { const M = APP.M, b = M.bcLatest('BP','2026-10'); return M.bcRows(b).filter(r => !/^(Matched|Difference Accepted|Ignored)/.test(r.status)).map(r => r.key + ':' + r.status + ':' + (r.reason||'') + ':' + r.diff).join(' ; '); }));
  ok(await kpi('Needs Review') === '0', 'before posting: nothing left to review');
  await p.locator('[data-post]').click(); await p.locator('.modal [data-ok]').click(); console.log('     ' + await toast()); keep();

  // 8. After posting
  await go('excel-upload-after-posting.html', 'role=FIN');
  await btn('Use Sample File').click(); await p.waitForTimeout(400);
  await btn('Upload and Reconcile').click(); console.log('     ' + await toast()); keep();
  const posted = await kpi('Posted and Matched');
  ok(+posted.replace(/,/g, '') > 500, 'after posting verified: ' + posted + ', needs review ' + await kpi('Needs Review'));
  const rp = p.locator('[data-bact="retrypost"]').first();
  if (await rp.count()) {
    await rp.click(); console.log('     ' + await toast()); keep();
    ok(await kpi('Needs Review') === '1', 'a retry does not change the file already uploaded');
    await btn('Use Sample File').click(); await p.waitForTimeout(400);
    await btn('Upload and Reconcile').click(); console.log('     ' + await toast()); keep();
    ok(await kpi('Needs Review') === '0', 'the new extract shows the retried invoice as posted');
  }

  // 9. Credit memos
  await go('excel-upload-before-credit-memo.html', 'role=FIN');
  await btn('Use Sample File').click(); await p.waitForTimeout(400);
  await btn('Upload and Reconcile').click(); await toast(); keep();
  const acc = p.locator('[data-bact="accept"]').first();
  if (await acc.count()) { await acc.click(); await p.fill('#rn', 'Refund rounding'); await p.locator('.modal [data-ok]').click(); await toast(); keep(); }
  await p.locator('[data-post]').click(); await p.locator('.modal [data-ok]').click(); console.log('     ' + await toast()); keep();
  await go('excel-upload-after-credit-memo.html', 'role=FIN');
  await btn('Use Sample File').click(); await p.waitForTimeout(400);
  await btn('Upload and Reconcile').click(); console.log('     ' + await toast()); keep();

  // 10. Cancellations
  await go('excel-cancel-invoice.html', 'role=FIN');
  const reqs = await kpi('Cancellation Requests');
  await btn('Use Sample File').click(); await p.waitForTimeout(400);
  await p.locator('[data-sub]').click(); console.log('     ' + await toast()); keep();
  ok(+(await kpi('Cancellation Requests')) > +reqs, 'cancellation requests uploaded: ' + reqs + ' → ' + await kpi('Cancellation Requests'));
  for (let i = 0; i < 2; i++) { await btn('Refresh Status').click(); console.log('     ' + await toast()); keep(); }
  await p.locator('[data-cr="convert"]').first().click(); await p.locator('.modal [data-ok]').click(); console.log('     ' + await toast()); keep();
  await p.locator('[data-cr="retry"]').first().click(); await toast(); keep();
  for (let i = 0; i < 2; i++) { await btn('Refresh Status').click(); console.log('     ' + await toast()); keep(); }
  ok(await kpi('Failed') === '0', 'cancellations: ' + await kpi('Cancelled in Business Central') + ' cancelled, failed ' + await kpi('Failed'));

  // 11. Dashboard after the close
  await go('finance-and-accounts-manager-dashboard.html', '');
  console.log('     ' + (await p.locator('main table').first().innerText()).replace(/\n/g, ' | ').slice(0, 300));
  await go('system-administrator-dashboard.html', '');
  ok(await kpi('Open Errors') === '0', 'dashboard: open errors ' + await kpi('Open Errors') + ', invoices posted ' + await kpi('Invoices Posted in Business Central'));
  await go('audit-activity.html', 'tab=This Session');
  console.log('     audit entries this session: ' + await p.locator('.tabs [data-tab="This Session"] b').textContent());
  console.log('     state size in the address: ' + st.length + ' characters');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
