# Amazon Operations Portal: screen prototype plan

_Drafted 2026-11-04. Live status: [STATUS.md](STATUS.md)._

This is a clickable HTML prototype of the Amazon Operations Portal: the layer between the Amazon MTR (Monthly
Transaction Report), the portal database and Microsoft Dynamics 365 Business Central. It uses the **same design
language as the Laminates Customer Portal** (`portals` repository): the same tokens, fonts, sidebar, top bar, review bar,
cards, stat tiles, tables, chips, dialogs, toasts and charts. Those files are copied here unchanged where possible.

It is a prototype: there is no backend. Every control still works in the browser. Uploads read real CSV and Excel
files, and "Download Excel" writes real `.xlsx` files. Reconciliation results, error counts, mappings, Business Central
jobs and cancellations are worked out live from one dataset. What you change travels in the address (`st`
parameter), never in browser storage, as in the customer portal.

## 1. Portal, roles and people

| Code | Role | Person | Works on |
|---|---|---|---|
| ADM | System Administrator | Rohit Bansal | Everything, plus users, roles, Seller GSTIN setup, audit |
| OPS | Marketplace Operations Executive | Sneha Patil | MTR upload, reconciliation, header and item errors, SKU and customer mapping |
| FIN | Finance and Accounts Manager | Karan Mehta | Business Central uploads before and after posting, credit memos, cancellations, Business Central customers |

Organisation: **Crestline Laminates** (the same fictional company as the customer portal). It sells self-adhesive
laminate rolls, edge band tapes, adhesives, sample kits and wall panels on Amazon from five fulfilment centres, each
under its own Seller GSTIN.

The prototype's "today" is **Friday 6 November 2026**. The October 2026 MTR came out on 5 November and is partly
processed. September 2026 is fully closed.

## 2. Screens (32)

| ID | Screen | Roles | Section |
|---|---|---|---|
| AUT-01 | Sign In | all | Sign-in screens |
| AUT-02 | Forgot Password | all | Sign-in screens |
| AUT-03 | Password Reset Sent | all | Sign-in screens |
| AUT-04 | Access Denied | all | Sign-in screens |
| AOP-ADM-01 | Dashboard (System Administrator) | ADM | Overview |
| AOP-OPS-01 | Dashboard (Marketplace Operations) | OPS | Overview |
| AOP-FIN-01 | Dashboard (Finance and Accounts) | FIN | Overview |
| AOP-MTR-01 | Amazon Excel/CSV Upload | ADM OPS | MTR Processing |
| AOP-MTR-02 | MTR Upload Details | ADM OPS FIN | MTR Processing |
| AOP-MTR-03 | MTR Reconciliation | ADM OPS FIN | MTR Processing |
| AOP-MTR-04 | MTR Transaction Details | ADM OPS FIN | MTR Processing |
| AOP-MTR-05 | Amazon Inventory Header Error | ADM OPS FIN | MTR Processing |
| AOP-MTR-06 | Amazon Inventory Item Error | ADM OPS FIN | MTR Processing |
| AOP-MAP-01 | Amazon SKU Mapping | ADM OPS | Missing Data and Mapping |
| AOP-MAP-02 | Missing Customer | ADM OPS | Missing Data and Mapping |
| AOP-BC-01 | Excel Upload Before Posting | ADM FIN | Invoice and Credit Memo Processing |
| AOP-BC-02 | Excel Upload After Posting | ADM FIN | Invoice and Credit Memo Processing |
| AOP-BC-03 | Excel Upload Before Credit Memo | ADM FIN | Invoice and Credit Memo Processing |
| AOP-BC-04 | Excel Upload After Credit Memo | ADM FIN | Invoice and Credit Memo Processing |
| AOP-BC-05 | Business Central Upload Details | ADM FIN | Invoice and Credit Memo Processing |
| AOP-BC-06 | Excel Upload BC Customer | ADM FIN OPS | Invoice and Credit Memo Processing |
| AOP-CAN-01 | Excel Cancel Invoice | ADM FIN | Invoice Cancellation |
| AOP-CAN-02 | Cancellation Request Details | ADM FIN | Invoice Cancellation |
| AOP-INT-01 | Business Central Integration | ADM FIN OPS | Business Central |
| AOP-INT-02 | Integration Job Details | ADM FIN OPS | Business Central |
| AOP-SET-01 | Seller GSTIN Setup | ADM | Administration |
| AOP-USR-01 | User Management | ADM | Administration |
| AOP-USR-02 | User Details | ADM | Administration |
| AOP-USR-03 | Roles and Permissions | ADM | Administration |
| AOP-AUD-01 | Audit Activity | ADM FIN | Administration |
| AOP-NTF-01 | Notifications | all | (top bar) |
| AOP-PRO-02 | My Profile | all | (top bar) |

Screens added beyond the brief, and why:

- **MTR Upload Details, MTR Transaction Details, Business Central Upload Details, Cancellation Request Details,
  Integration Job Details, User Details**: each list needs a screen that opens one record.
- **Seller GSTIN Setup**: the header error "Seller GSTIN Not Configured" needs somewhere to be fixed.
- **Business Central Integration**: the brief's step "Create or post orders, invoices, credit memos and
  cancellations" needs a screen that shows each job sent to Business Central, its result and its failures.
- **Roles and Permissions, Audit Activity**: the brief's section 4 (who can upload, post, cancel and manage users),
  and a record of who did what to financial documents.
- **Three dashboards, Notifications, My Profile**: the same frame as the customer portal.

Shopify is **not** included: the brief says that integration has not been explained yet (open question in STATUS.md).

## 3. The workflow the data follows

```
Amazon MTR (B2C, B2B)  ->  Amazon Excel/CSV Upload  ->  MTR Reconciliation
   -> Header errors (Seller GSTIN, customer, amount, duplicate, refund without invoice)
   -> Item errors (SKU not mapped, HSN, tax rate, item blocked)
   -> fixed in Seller GSTIN Setup, Amazon SKU Mapping, Missing Customer, or on the error itself
-> Business Central Integration: Create Sales Orders / Create Credit Memos for validated documents
-> Excel Upload Before Posting / Before Credit Memo: Business Central extract reconciled with the MTR
-> Send for Posting (job) -> Excel Upload After Posting / After Credit Memo: posted results verified
Cancel transactions for invoices already posted -> Excel Cancel Invoice -> Cancellation API -> Business Central
```

Every document carries its stage: Error, Validated, Order Created, Reconciled, Sent for Posting, Posted.

## 4. Build approach

- `assets/fonts.css`, `styles.css`, `app.css`, `behaviour.css`, `charts.js`, `shell.js`, `chrome.js`,
  `directory.js` and the logo are taken from the customer portal (charts, chrome and directory lightly adapted).
- `assets/registry.js`: every screen (ID, name, roles, menu section, description), drives the sidebar, the
  breadcrumbs, the review bar and the Screen Directory.
- `assets/mtr-core.js`: URL state, formats, toast, dialog, dropdown, lists (search, filters, tabs, sorting,
  pages, selection), upload box, CSV and Excel reading and writing.
- `assets/mtr-data.js`: the dataset (seeded, so it is the same every time) and the model that applies the state.
- `assets/mtr-*.js`: one renderer file per menu section.
- `tools/build.js` writes the HTML shell of every screen from the registry. `tools/check.js` opens every screen
  for every role at 1440, 1366 and 390 px, clicks every control and fails on errors, dead controls or sideways scrolling.

## 5. Phases

| Phase | Content | Status |
|---|---|---|
| 0 | Plan, design system copied, registry, directory, review bar, core behaviour, dataset | Done |
| 1 | Sign-in screens, three dashboards, Notifications, My Profile | Done |
| 2 | MTR Processing: upload, upload details, reconciliation, transaction details, header and item errors | Done |
| 3 | Missing Data and Mapping: Amazon SKU Mapping, Missing Customer (Excel round trip) | Done |
| 4 | Invoice and Credit Memo Processing: four Business Central uploads, upload details, BC customers | Done |
| 5 | Cancellation and Business Central Integration: Excel Cancel Invoice, request details, jobs | Done |
| 6 | Administration: Seller GSTIN Setup, users, roles and permissions, audit activity | Done |
| 7 | Checks at three widths, dead-control audit, end-to-end walk through the October close | Done |
