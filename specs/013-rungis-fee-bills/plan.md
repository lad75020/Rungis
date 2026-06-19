# Implementation Plan: Rungis Fee Bills

**Branch**: `013-rungis-fee-bills` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-rungis-fee-bills/spec.md`

## Summary

Add marketplace-level Rungis fee billing on top of the existing order, billing, PDF, and Factur-X foundations. Admins configure a Rungis fee percentage and VAT percentage in the existing SQLite-backed app settings store, then trigger previous-calendar-month generation of role-specific Rungis bill records in the new MongoDB `rungisbills` collection. Vendors and clients access their Rungis invoice from a dashboard € icon, see admin/user organization identity and fee/VAT totals, and export the invoice as readable PDF or Factur-X. Admins can search unpaid Rungis bills by organization/month and mark them paid without losing audit history.

## Technical Context

**Language/Version**: JavaScript ES modules on Node.js v26.3.0; TypeScript 6.0.3 with Angular 22 frontend

**Primary Dependencies**: Fastify route modules, Mongoose models, Node `node:sqlite` app settings store, Angular standalone components/templates/signals, Bootstrap styling, existing i18n translations, PDFKit visual PDF rendering, existing `factur-x` service/package for hybrid invoice downloads

**Storage**: SQLite `app_settings` table for admin Rungis fee and VAT settings; MongoDB `validatedorders`, `users`, and new `rungisbills` collection for generated Rungis bill records; existing upload storage for organization logos referenced in invoice output

**Testing**: Backend `node:test` coverage for settings validation, previous-month aggregation, idempotent generation, paid-state transitions, user authorization, PDF/Factur-X invoice data; Angular `ng test` coverage via `npm --workspace frontend test -- --watch=false`; production Angular build; targeted manual browser checks for admin and user dashboard flows

**Target Platform**: Browser-based B2B web portal for vendors, clients, and admins

**Project Type**: Full-stack web application

**Performance Goals**: Admin settings saves and unpaid bill searches complete within normal form/list latency; previous-month generation completes with a clear success/failure message for representative monthly order volume; user invoice modal and document actions meet the existing 5-second user feedback target

**Constraints**: Rungis fee and VAT rates must be snapshotted onto generated bills; existing validated-order net totals remain the calculation source; role-specific vendor/client totals must not be mixed; paid bills must not reappear in unpaid search or be reset by regeneration; user/admin invoice data must remain access-controlled; Factur-X output must use the existing compliance guardrails and fail closed when required legal/tax data is missing

**Scale/Scope**: One feature slice covering admin settings and generation actions, a new Rungis bill model/service/routes, user dashboard invoice modal and exports, admin unpaid search/paid action, i18n labels/errors, and automated regression coverage. Out of scope: payment provider integration, automated reminders, accounting reconciliation beyond the paid flag, and redesigning existing daily vendor-client bills.

## Constitution Check

The project constitution is still the generated template and does not contain ratified project-specific rules. Default gates for this web application are applied:

- PASS — Server-side authorization: only admins can configure rates, generate/search bills, and mark paid; vendors/clients can only view/export their own Rungis bills.
- PASS — Financial data integrity: percentages, order totals, payable before tax, VAT amount, payable including VAT, and paid state are validated and persisted with deterministic rounding.
- PASS — Auditability: generated bills snapshot fee/VAT rates and organization identity needed to reproduce invoices; paid bills remain stored even when hidden from unpaid search.
- PASS — Idempotency and race safety: monthly generation avoids duplicate unpaid bills and never resets paid bills; mark-paid handles already-paid/concurrent states safely.
- PASS — Compliance-first output: PDF and Factur-X exports are generated from one normalized Rungis invoice model and fail closed when legal/tax fields are incomplete.
- PASS — Existing behavior preservation: daily bill generation, existing bill PDF/Factur-X endpoints, and dashboard billing flows remain intact.
- PASS — Testability: settings, aggregation, document normalization, route contracts, UI state, and paid transitions have isolated acceptance checks.

## Project Structure

### Documentation (this feature)

```text
specs/013-rungis-fee-bills/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/rungis-fee-bills.openapi.yml
└── tasks.md              # created later by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── lib/
│   │   └── app-settings-store.js          # reuse SQLite-backed app_settings for Rungis fee/VAT settings
│   ├── models/
│   │   ├── rungis-bill.model.js           # new MongoDB collection `rungisbills`
│   │   ├── user.model.js                  # source of uniqueId and organization invoice identity
│   │   └── validated-order.model.js       # source for monthly gross order amounts before tax
│   ├── routes/
│   │   ├── index.js                       # wire new model/services and shared helpers into route dependencies
│   │   └── modules/
│   │       ├── management.js              # admin settings, Send Rungis bills, search, mark-paid routes
│   │       └── rungis-bills.js            # user invoice detail, PDF, and Factur-X routes
│   ├── services/
│   │   ├── factur-x/                      # extend existing generator/normalizer for Rungis service-fee invoices
│   │   └── rungis-bills/
│   │       ├── settings.js                # normalize/get/set Rungis fee and VAT rates
│   │       ├── generation.js              # previous-month aggregation and idempotent upsert logic
│   │       ├── invoice-data.js            # normalize admin/user bill data for modal/PDF/Factur-X
│   │       └── pdf.js                     # readable Rungis invoice PDF renderer or adapter around existing PDF helpers
│   └── i18n/translations.json             # admin/user labels, errors, buttons, modal text, document labels
└── test/
    ├── rungis-bills/settings.test.js
    ├── rungis-bills/generation.test.js
    ├── rungis-bills/routes.test.js
    └── rungis-bills/invoice-documents.test.js

frontend/
└── src/app/
    ├── app.ts                             # signals/forms/fetch methods for admin settings/search and user invoice modal
    ├── app.types.ts                       # Rungis settings, bill, invoice, search, and response types
    ├── app.spec.ts                        # frontend regression tests for admin/user flows
    └── pages/
        ├── admin-page.component.html      # settings, Send Rungis bills, search, mark-paid UI
        └── dashboard-page.component.html  # € icon and Rungis invoice modal for vendors/clients
```

**Structure Decision**: Use the current full-stack layout. Keep persisted rate settings in the existing SQLite `app_settings` helper because the feature explicitly requires SQLite persistence for Rungis fee settings and existing admin settings already use that path. Create a dedicated MongoDB `RungisBill` model for monthly fee invoices instead of overloading daily vendor-client `Bill`, because Rungis bills are marketplace service-fee invoices with one billed user/role/month rather than vendor-client-day order bills.

## Design Summary

- [research.md](./research.md) resolves settings persistence, previous-month boundaries, role-specific aggregation, idempotency, paid-state behavior, invoice party snapshots, and PDF/Factur-X strategy.
- [data-model.md](./data-model.md) defines Rungis billing settings, monthly eligible totals, Rungis bill records, invoice party snapshots, admin search state, and paid transitions.
- [contracts/rungis-fee-bills.openapi.yml](./contracts/rungis-fee-bills.openapi.yml) documents the REST API surface for admin settings/generation/search/mark-paid and user invoice/PDF/Factur-X access.
- [quickstart.md](./quickstart.md) lists implementation verification commands and manual acceptance checks.

## Post-Design Constitution Check

PASS — The design keeps admin-only write operations and user-only invoice reads server-side; persists financial settings and bill records in the required stores; snapshots rates and identity for auditability; prevents duplicate unpaid monthly bills and paid reset; reuses existing Factur-X compliance guardrails; and includes backend/frontend/document verification for the complete admin and user workflows.
