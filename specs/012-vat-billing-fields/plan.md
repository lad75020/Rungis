# Implementation Plan: VAT Billing Fields

**Branch**: `012-vat-billing-fields` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-vat-billing-fields/spec.md`

## Summary

Extend vendor billing profiles with VAT ID and reusable bill mentions, add per-merchandise VAT percentage storage, and propagate derived VAT-inclusive price data through stock management, client ordering, cart validation, bill summaries/details, PDF rendering, and Factur-X generation. The implementation preserves all existing VAT-exclusive prices as the stored base price, snapshots VAT data onto cart/validated-order/bill lines so historical documents remain stable, and fails closed for invoice generation when VAT or vendor billing identity data is missing or inconsistent.

## Technical Context

**Language/Version**: JavaScript ES modules on Node.js v24.8.0; TypeScript 5.9 with Angular 21 frontend

**Primary Dependencies**: Fastify route modules, Mongoose models, Redis cart state, Angular standalone components/templates, Bootstrap styling, existing i18n translations, `pdfkit` visual PDF rendering, existing `factur-x` package/service for Factur-X hybrid invoices

**Storage**: MongoDB for users, merchandise, validated orders, persisted bills, refunds, and penalties; Redis JSON for in-progress carts that must carry VAT snapshots while the cart exists

**Testing**: Backend `node:test` coverage for account validation, merchandise VAT validation/mapping, cart/order VAT snapshots, bill aggregation, PDF/Factur-X invoice data; Angular/Vitest component/service tests; production Angular build; targeted manual browser checks for stock, order, account, and bill views

**Target Platform**: Browser-based B2B web portal for vendors, clients, and admins

**Project Type**: Full-stack web application

**Performance Goals**: VAT-inclusive prices render alongside existing net prices without perceptible delay; account and stock saves remain under normal form-submit latency; bill and Factur-X generation still return a file or clear failure within the existing 5-second target

**Constraints**: Existing prices remain VAT-exclusive; VAT-inclusive price is derived, rounded, and displayed in addition to net price; each merchandise item owns its VAT percentage; order and bill history must use the VAT rate captured at validation time, not a later merchandise edit; Factur-X structured XML and readable PDF values must match; missing VAT data blocks affected order validation or invoice generation instead of fabricating tax data

**Scale/Scope**: One feature slice covering vendor account settings, merchandise create/update/list, client catalog/cart/order validation, vendor/client bill summaries and details, PDF/Factur-X document output, shared price/VAT helpers, i18n labels/errors, and automated regression coverage

## Constitution Check

The project constitution is still the generated template and does not contain ratified project-specific rules. Default gates for this web application are applied:

- PASS — Server-side authorization: only authenticated vendors can edit their vendor billing fields and owned merchandise VAT rates; client/vendor bill access remains role-gated.
- PASS — Compliance-first output: Factur-X bills must not include missing or inconsistent VAT, VAT ID, or bill mention data; structured XML and readable output must agree.
- PASS — Data integrity: VAT rate is stored per merchandise and snapshotted into cart/validated-order/bill lines to preserve historical invoice accuracy.
- PASS — Existing behavior preservation: net prices remain visible and stored; existing PDF and Factur-X flows are extended rather than replaced.
- PASS — Safe failure behavior: legacy merchandise without VAT is clearly flagged and blocks affected order validation or document generation until resolved.
- PASS — Testability: validation, derived-price math, UI forms, realtime payloads, bill aggregation, and document rendering are independently testable.
- PASS — Scope control: no tax-rate catalog, automated VAT classification, accounting export redesign, or settlement workflow redesign is included.

## Project Structure

### Documentation (this feature)

```text
specs/012-vat-billing-fields/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/vat-billing-fields.contract.md
└── tasks.md              # created later by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   ├── user.model.js                 # add vendor VAT ID and bill mentions fields
│   │   ├── merchandise.model.js          # add per-item VAT percentage
│   │   ├── validated-order.model.js      # snapshot VAT rate, VAT amount, and gross totals per validated line
│   │   └── bill.model.js                 # persist VAT-aware totals/refund/penalty metadata where bill records store totals
│   ├── routes/
│   │   ├── index.js                      # shared validation/mapping/price helpers, PDF rendering, bill aggregation
│   │   └── modules/
│   │       ├── auth.js                   # account update payload and session user mapping for vendor billing profile
│   │       ├── bills.js                  # select VAT ID/bill mentions for PDF and Factur-X parties
│   │       └── websocket.js              # stock/order/cart/dashboard payloads with VAT and gross prices
│   ├── services/
│   │   └── factur-x/
│   │       ├── invoice-data.js           # include seller VAT ID, notes, line VAT, VAT breakdowns, gross totals
│   │       ├── generator.js              # render readable VAT fields and bill mentions
│   │       └── validation.js             # keep metadata/XML/PDF checks aligned with VAT totals
│   └── i18n/translations.json            # labels and validation messages for VAT ID, bill mentions, VAT rate, gross price
└── test/
    ├── account-vat-fields.test.js
    ├── merchandise-vat.test.js
    ├── order-vat-pricing.test.js
    └── factur-x/vat-billing-fields.test.js

frontend/
└── src/app/
    ├── app.ts                            # account/stock forms, derived price helpers, websocket payload handling
    ├── app.types.ts                      # VAT-aware user, stock, catalog, cart, bill, and validation types
    ├── app.html                          # account settings VAT ID and bill mentions controls
    ├── pages/
    │   ├── stocks-page.component.html    # VAT percentage input and net/gross price columns
    │   ├── order-page.component.html     # catalog/cart VAT-inclusive price display
    │   └── dashboard-page.component.html # bill summary/detail gross totals and document actions
    └── app.spec.ts                       # frontend regression coverage for forms and display values
```

**Structure Decision**: Use the current full-stack layout. The backend remains the source of truth for validation, persisted VAT fields, line snapshots, and invoice/document totals. The frontend displays server-provided net/VAT/gross values and may calculate immediate form previews, but persisted and billable totals come from backend helpers so all screens, PDFs, and Factur-X documents use one pricing model.

## Design Summary

- [research.md](./research.md) resolves VAT storage, legacy merchandise handling, rounding/snapshot policy, Factur-X mapping, UI display, and testing strategy.
- [data-model.md](./data-model.md) defines vendor billing profile, merchandise VAT fields, VAT-aware cart/order/bill lines, bill totals, and document generation inputs.
- [contracts/vat-billing-fields.contract.md](./contracts/vat-billing-fields.contract.md) documents changed REST and websocket payloads for account, session, stock, catalog/cart, and bill data.
- [quickstart.md](./quickstart.md) lists implementation verification commands and manual acceptance checks.

## Post-Design Constitution Check

PASS — The design keeps role-gated account, stock, order, and bill access; preserves VAT-exclusive prices; snapshots VAT data for historical correctness; blocks missing tax data instead of fabricating it; and extends existing document generation with matching readable and structured VAT values.
