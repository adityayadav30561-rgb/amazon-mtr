# Amazon Operations Portal: screen prototype

Clickable HTML prototype for stakeholder review. It uses the same design language as the Laminates Customer Portal
(`portals` repository); the design system files in `assets/` come from there. Every control works in the browser, with
no backend, and state lives in the URL (`st`), never in browser storage.

Read first: docs/STATUS.md, docs/DECISIONS.md, docs/PLAN.md.

Rules:
- Opens by double-click (`file://`): relative paths, classic scripts, no build step to view.
- Screen HTML files are written by `node tools/build.js` from `assets/registry.js`; content is drawn by the renderers in
  `assets/mtr-*.js` (one `A.def(screenId, fn)` per screen). Data and every derived value come from `assets/mtr-data.js`.
- No dead controls: `node tools/check.js` must report 0 dead controls and no layout problems; `node tools/e2e.js` must pass.
- Full names on screens; no helper sentences under titles; compact money in tiles, exact (with paise) in tables.
- Fictional data only. Logo: `brand/` and `assets/brand/`, never redrawn.
