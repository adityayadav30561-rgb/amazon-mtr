# Status

_Updated 2026-11-04._

## Where we are

All phases in [PLAN.md](PLAN.md) are built: 32 screens (4 sign-in, 28 in the portal), three roles.

Checks run before hand-over:

- `node tools/check.js`: every screen and role at 1440, 1366 × 768 and 390 px with no page errors, no sideways page
  scroll, no table scrolling inside a card on desktop, and no text under 13px; every distinct control clicked.
- `node tools/e2e.js`: the October close end to end (B2B upload → reconciliation → SKU mapping → missing customers from
  Excel → Seller GSTIN → header and item errors → sales orders and credit memos → before posting → posting → after
  posting → credit memos → cancellations), ending with no open errors and every invoice posted and verified.

## The starting data (6 November 2026)

| Area | State |
|---|---|
| September 2026 | B2C and B2B uploaded, reconciled, created, posted and verified |
| October 2026 B2C | Uploaded 05/11; 44 header errors and 61 item errors open |
| October 2026 B2B | Not uploaded (the first thing to do) |
| Seller GSTIN 33AAHCC4821K1Z4 (MAA4) | Shipping since 20 October, not set up |
| Amazon SKUs | 6 new listings not mapped |
| Missing customers | 4 B2C states (Sikkim is already in Business Central); 5 B2B buyers after the B2B upload |
| JOB-2610-01 | 2 sales orders timed out |
| BP-2610-01 | 2 amount differences, 2 missing orders, 1 test order not in the MTR |
| Cancellations | 12 requests: 7 cancelled, 2 sent to the API, 2 failed, 1 queued; 4 more required by the MTR |

## Known limits

- The results of a Business Central upload are worked out from the prototype's dataset. A file you supply yourself is
  checked (columns, months, External Document Nos found in the MTR), but its rows are not stored.
- Only September and October 2026 have documents; May to August appear as monthly totals on the dashboard chart.
- Shopify integration screens are not included (the brief does not explain them yet).
- Firefox and Safari have not been checked. Reading compressed `.xlsx` files needs `DecompressionStream`, which all
  current browsers support.

## Open questions for the business

1. Shopify to Business Central: which screens, and does it share the reconciliation?
2. Should cancellation requests need a second approval before they reach the API?
3. Is ₹1.00 the right tolerance for Business Central amount differences?
