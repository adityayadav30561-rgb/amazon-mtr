#!/usr/bin/env node
/*
 * Checks every screen for every role, opened from disk (needs Playwright):
 *   1. at 1440, 1366 × 768 and 390 px: no page errors, no sideways page scroll, no table scrolling inside a card on
 *      desktop, no text under 13px;
 *   2. dead controls: clicks every distinct button, tab, dropdown, sortable heading and link on the default role and reports
 *      the ones with no observable effect (no change on the page, no dialog, no menu, no toast, no download, no navigation).
 * node tools/check.js            (both)     node tools/check.js layout | controls
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.window = {}; eval(fs.readFileSync(path.join(root, 'assets/registry.js'), 'utf8'));
const P = window.PORTAL;
const what = process.argv[2] || 'all';
const url = (s, r) => 'file://' + path.join(root, s.file) + (r !== s.roles[0] && r !== 'ALL' ? '?role=' + r : '');
let problems = 0;
(async () => {
  const b = await chromium.launch();
  if (what !== 'controls') for (const W of [1440, 1366, 390]) {
    const p = await b.newPage({ viewport: { width: W, height: W === 390 ? 844 : 768 } });
    let errs = [];
    p.on('pageerror', e => errs.push(e.message));
    for (const port of P.portals) for (const s of port.screens) for (const r of s.roles) {
      errs = [];
      await p.goto(url(s, r)); await p.waitForTimeout(120);
      const info = await p.evaluate((W) => {
        const de = document.documentElement;
        const wide = W < 800 ? [] : [...document.querySelectorAll('main .table-wrap')].filter(t => t.scrollWidth > t.clientWidth + 2).map(t => (t.closest('.card')?.querySelector('h2')?.textContent || 'table') + ' +' + (t.scrollWidth - t.clientWidth) + 'px');
        const small = [...document.querySelectorAll('main *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13 && e.offsetParent !== null).slice(0, 3).map(e => e.textContent.trim().slice(0, 30));
        return { scroll: de.scrollWidth - de.clientWidth, wide, small };
      }, W);
      const bad = [];
      if (errs.length) bad.push('errors: ' + errs.join(' | '));
      if (info.scroll > 1) bad.push('page scrolls sideways by ' + info.scroll + 'px');
      if (info.wide.length) bad.push('table scrolls inside card: ' + info.wide.join(', '));
      if (info.small.length) bad.push('text under 13px: ' + info.small.join(', '));
      if (bad.length) { problems++; console.log(W + ' ' + s.id + ' ' + r + ': ' + bad.join('; ')); }
    }
    await p.close();
    console.log('layout ' + W + 'px checked');
  }
  if (what !== 'layout') {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const p = await ctx.newPage();
    let dead = 0, total = 0;
    for (const port of P.portals) for (const s of port.screens) {
      const u = url(s, s.roles[0]);
      await p.goto(u); await p.waitForTimeout(120);
      const sigs = await p.evaluate(() => {
        const sel = 'main button:not([disabled]), main [data-tab], main th[data-h], main a[href], .top a[href], .top button, .side a[href]';
        const seen = {}, out = [];
        document.querySelectorAll(sel).forEach((e, i) => {
          if (e.offsetParent === null) return;
          const row = e.closest('tbody tr');
          const sig = e.tagName + '|' + (e.getAttribute('data-act') || e.getAttribute('data-bact') || e.getAttribute('data-cr') || e.getAttribute('data-ua') || '') + '|' + (row ? 'row' : '') + '|' + e.textContent.trim().replace(/\d+/g, '#').slice(0, 40) + '|' + (e.tagName === 'A' ? e.getAttribute('href').split('?')[0] : '');
          if (seen[sig]) return; seen[sig] = 1;
          e.setAttribute('data-ck', i); out.push({ i, label: e.textContent.trim().slice(0, 40) || e.getAttribute('aria-label') || e.tagName });
        });
        return out;
      });
      for (const c of sigs) {
        total++;
        await p.goto(u); await p.waitForTimeout(80);
        await p.evaluate(() => {
          const sel = 'main button:not([disabled]), main [data-tab], main th[data-h], main a[href], .top a[href], .top button, .side a[href]';
          document.querySelectorAll(sel).forEach((e, i) => e.setAttribute('data-ck', i));
          window.__chg = 0; window.__t0 = window.APP ? APP.toasts || 0 : 0;
          new MutationObserver(() => { window.__chg++; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        });
        const el = p.locator('[data-ck="' + c.i + '"]');
        if (!(await el.count())) continue;
        const start = p.url();
        let nav = false, dl = false;
        const onDl = () => { dl = true; };
        p.once('download', onDl);
        try { await el.click({ timeout: 1500 }); } catch (e) { /* a click that leaves the page */ }
        await p.waitForTimeout(250);
        if (p.url() !== start) nav = true;
        let effect = nav || dl;
        if (!effect) effect = await p.evaluate(() => window.__chg > 0 || !!document.querySelector('.modal, .pop') || (window.APP && APP.toasts > window.__t0)).catch(() => true);
        p.off('download', onDl);
        if (!effect) { dead++; console.log('DEAD ' + s.id + ': ' + c.label); }
      }
    }
    console.log('controls: ' + total + ' clicked, ' + dead + ' dead');
    problems += dead;
  }
  await b.close();
  process.exit(problems ? 1 : 0);
})();
