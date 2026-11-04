# Decisions and user preferences

| Preference | Detail | Date |
|---|---|---|
| Same design language as the customer portal | Tokens, Inter, sidebar, top bar, review bar, cards, stat tiles, tables, chips, dialogs, toasts and charts are copied from the `portals` repository, so both products read as one software family. | 2026-11-04 |
| Every button works | No control is for show; `tools/check.js` must report 0 dead controls. Data looks real and reacts to every action. | 2026-11-04 |
| HTML prototypes only | No backend; opens by double-click from disk; state in the URL, never in browser storage. | 2026-11-04 |
| All phases in one go | Phases are planned in PLAN.md and were all built in one session. | 2026-11-04 |
| Screen text rules (inherited) | Full names, no abbreviations except SKU, GST, GSTIN, HSN, MTR, B2B, B2C, API and the brief's own screen name "Excel Upload BC Customer"; no sentences under titles; compact money in tiles, exact in tables. | 2026-11-04 |

## Decisions Claude made where the brief was open

| Question | Decision |
|---|---|
| Does Missing Customer only map, or also create? | Both. Each row is **Map to Existing** (the customer must be in the uploaded Business Central customer list, with a matching GSTIN for B2B) or **Create New** (created in Business Central through the integration). |
| How are B2C customers modelled? | One Business Central customer per state (`AMZB2C-MH`, ...), because the place of supply decides the GST. B2B buyers are customers by GSTIN. |
| Who can do what? | System Administrator: everything. Marketplace Operations Executive: MTR upload, reconciliation, errors, SKU and customer mapping. Finance and Accounts Manager: Business Central uploads, posting, credit memos, cancellations, audit. Editable on Roles and Permissions. |
| What does Before Posting mean? | The Business Central sales order (or credit memo) extract, reconciled with the MTR by External Document No before posting. Only matched or accepted documents can be sent for posting. |
| Cancellation status | Uploading numbers only queues requests. The cancellation API reports Sent to API, Cancelled or Failed; failures can be retried, and an invoice applied to a payment can take a credit memo instead. |
| Amount tolerance | ₹1.00: a smaller difference is "Matched within Tolerance". |
| Shopify | Not built: the brief says that flow has not been explained yet. |
