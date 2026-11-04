# Amazon Operations Portal: screen prototype

A clickable HTML prototype of the Amazon Operations Portal: the layer between the Amazon MTR (Monthly Transaction
Report), the portal database and Microsoft Dynamics 365 Business Central. It uses the same design language as the
Laminates Customer Portal (`portals` repository): the same fonts, colours, sidebar, top bar, review bar, cards, stat
tiles, tables, chips, dialogs and charts.

## Open it

Double-click **`index.html`**. You don't need a server, install or build step, and every screen file also opens on its
own. To share it, zip the whole folder. All 32 screens are built.

1. `index.html` is the **Screen Directory**: one card per role (System Administrator, Marketplace Operations Executive,
   Finance and Accounts Manager) and the sign-in screens.
2. Every screen has the dark **review bar** on top: **Screen Directory**, the screen ID and full name, **Reset Data**,
   **Previous** and **Next** for the role. Add `?review=off` to the address to hide the bar.
3. Use the sidebar, the top-bar search (invoice numbers, order IDs, SKUs, requests, jobs, screens), notifications and the
   profile menu like a real application.
4. **Switching roles:** add `?role=OPS`, `?role=FIN` or `?role=ADM` to the address, or sign in as another user on the
   Sign In screen. Each role sees its own menu, and actions it has no permission for are hidden or refused.

The prototype's "today" is **Friday 6 November 2026**: the October 2026 MTR came out on 5 November and is partly
processed. September 2026 is fully closed.

## What works

Everything is clickable and does what its label says, entirely in the browser. Nothing is sent anywhere.

- **Uploads read real files.** Every upload box takes a real `.xlsx` or `.csv` file (drag it in or choose it), checks the
  columns, periods and values, and shows row-level results. **Use Sample File** writes the file the source system would
  give you right now and uploads it. **Download Template** and **Download Excel** write real `.xlsx` files.
- **Amazon Excel/CSV Upload:** upload the October B2B MTR. It is checked for report type, period, transaction types and
  duplicates, then saved, and reconciliation runs.
- **MTR Reconciliation:** filter by year, month, Seller GSTIN and transaction type. Each document's amount is
  recalculated and nine checks run.
- **Header and Item Errors:** each error has its own fix: set up the Seller GSTIN, resolve the customer, accept or
  exclude an amount, exclude a duplicate, link the original invoice, map the SKU, use the item's HSN or tax rate, or
  confirm the item is unblocked. You can also revalidate, act on selected rows, and download the list in Excel.
- **Amazon SKU Mapping:** map one SKU, or upload a mapping file. Item errors resolve as soon as their SKU is mapped.
- **Missing Customer:** download the list, fill in the action ("Map to Existing" or "Create New") and the Business
  Central customer, then upload it. Every row is validated against the Business Central customer list. You can also
  resolve customers one at a time.
- **Business Central Integration:** create sales orders and credit memos for validated documents, retry failures, and
  test the connection.
- **Excel Upload Before Posting and Before Credit Memo:** each document in the Business Central extract is matched to
  the MTR by its External Document No. You can accept a difference, request a correction, retry creation or ignore a
  document, then send the matched documents for posting.
- **Excel Upload After Posting and After Credit Memo:** checks that every posted document matches the MTR. You can
  retry a document that failed to post.
- **Excel Cancel Invoice:** upload posted invoice numbers. Each one becomes a request that moves Queued → Sent to API →
  Cancelled or Failed. **Refresh Status** reads the cancellation API's answers. You can retry or withdraw a request, or
  post a credit memo instead when the invoice is applied to a payment.
- **Administration:** Seller GSTIN setup, inviting and deactivating users, changing a user's role, a role permissions
  matrix that changes what each role can do, and audit activity for every action.
- What you change travels in the address (the `st` part), never in browser storage, so it survives moving between
  screens and reloading. **Reset Data** in the review bar starts again.

All data is fictional (the company and the people are the same as in the customer portal). It is a prototype of the
screens only: there is no backend, real sign-in, database, Amazon or Business Central connection.

## Checks (optional, need Node and Playwright)

| Command | What it checks |
|---|---|
| `node tools/build.js` | Writes every screen's HTML shell from `assets/registry.js` |
| `node tools/check.js` | Every screen and role at 1440, 1366 and 390 px: no errors, no sideways scrolling, no tables scrolling inside cards on desktop, no text under 13px; then clicks every control and reports any that do nothing |
| `node tools/e2e.js` | The whole October close: upload, reconcile, map, resolve, create, reconcile before posting, post, verify, credit memos, cancellations |

## Folders

| Path | What |
|---|---|
| `index.html`, `directory/` | Screen Directory |
| `screens/operations/`, `screens/authentication/` | One HTML file per screen (written by `tools/build.js`) |
| `assets/fonts.css`, `styles.css`, `app.css`, `behaviour.css`, `charts.js`, `shell.js`, `chrome.js`, `directory.js`, `brand/` | Design system and frame, taken from the customer portal |
| `assets/registry.js` | Every screen: ID, name, roles, menu section, description |
| `assets/mtr-data.js` | The dataset (seeded, the same every time) and the model that applies what you did |
| `assets/mtr-core.js` | State, formats, toast, dialog, dropdown, lists, upload box, Excel and CSV reading and writing |
| `assets/mtr-*.js` | Screen renderers, one file per menu section |
| `assets/mtr.css` | Additions to the design system |
| `docs/` | Plan, status, decisions |
