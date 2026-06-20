# Implementation Plan: Bill Document Cleanup

**Branch**: `014-bill-document-cleanup` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-bill-document-cleanup/spec.md`

## Summary

Clean up daily vendor/client bill presentation by moving bill mentions to a bottom notes section in both PDF and readable Factur-X output, removing category columns from bill documents and bill detail popups, and auditing SIRET/businessRegistrationId validation so every entry/check uses a strict 14-digit numeric SIRET rule. The implementation should reuse the existing daily bill routes, PDF renderer, Factur-X normalizer/generator, Angular dashboard bill modals, translations, and current backend/frontend test suites rather than changing the underlying category data model or unrelated catalog/search views.

## Technical Context

**Language/Version**: JavaScript ES modules on Node.js v26.3.0; TypeScript ~6.0.3 with Angular 22 frontend

**Primary Dependencies**: Fastify route modules, Mongoose user/bill/order models, Angular standalone components/templates/signals/reactive forms, Bootstrap table/modal styling, existing i18n translations, PDFKit readable PDF rendering, `pdf-lib` Factur-X embedding, existing `factur-x` package/service for hybrid invoice generation

**Storage**: Existing MongoDB users, validated orders, and bill data only; no new persistence. Category remains stored for non-billing features. Existing SIRET/businessRegistrationId data may need validation/fixture cleanup if any 13-digit records are present.

**Testing**: Backend `node:test` via `npm --workspace backend test` for PDF/Factur-X normalization, route behavior, SIRET validation, fixtures, and scripts; frontend Vitest/Angular tests via `npm --workspace frontend test -- --watch=false`; production Angular build via `npm run build`; manual browser checks for vendor/client bill modals and PDF/Factur-X downloads

**Target Platform**: Browser-based B2B web portal for vendors, clients, and admins

**Project Type**: Full-stack web application

**Performance Goals**: Bill modal rendering remains immediate for representative bills; PDF/Factur-X generation stays within the existing 5-second user feedback target; validation changes do not add visible latency to account or admin forms

**Constraints**: Keep structured Factur-X XML consistent with readable invoice data; fail closed when required legal party data is invalid; do not delete or mutate category data used by catalog, stock, statistics, search, or ordering; preserve existing role authorization for bill views/downloads; avoid changing VAT ID's separate 13-character rule unless a different feature requests it

**Scale/Scope**: One focused cleanup slice across daily vendor/client bill PDF generation, daily vendor/client readable Factur-X generation, dashboard vendor/client bill detail modals, SIRET/businessRegistrationId validation surfaces, i18n labels where obsolete billing category labels remain, and regression tests. Out of scope: Rungis marketplace service-fee invoices, catalog/order category filters, VAT ID format changes, payment workflows, and new document export endpoints.

## Constitution Check

The project constitution is still the generated template and does not contain ratified project-specific rules. Default gates for this web application are applied:

- PASS — Authorization preservation: all bill PDF/Factur-X routes and dashboard modal data continue to use existing vendor/client role guards and websocket access rules.
- PASS — Financial/document integrity: removing a visible category column must not remove item identity, quantities, VAT rates, net/gross prices, totals, refunds, penalties, or structured Factur-X fiscal data.
- PASS — Legal identity validation: SIRET/businessRegistrationId checks enforce a strict 14-digit numeric rule and reject malformed values before they appear in generated documents.
- PASS — Data minimization by presentation: category data remains stored for legitimate non-billing workflows but is not displayed in bill documents or bill popups.
- PASS — Compliance-first Factur-X output: readable Factur-X presentation and structured XML remain generated from the same normalized bill data, with bill mentions retained as invoice notes.
- PASS — Testability: backend document/normalizer/route tests and frontend modal/form tests can independently verify each required surface.
- PASS — Existing behavior preservation: catalog, order, stock, statistics, Rungis fee bill features, and VAT ID behavior remain outside this change unless directly touched by shared validation tests.

## Project Structure

### Documentation (this feature)

```text
specs/014-bill-document-cleanup/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/bill-document-cleanup.contract.md
└── tasks.md              # created later by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── fixtures/
│   └── factur-x/bills.fixture.json              # update/extend document fixtures for notes, no category display, and valid 14-digit SIRET
├── scripts/
│   ├── seed-users.js                            # ensure seeded SIRET values satisfy 14-digit numeric rule
│   ├── migrate-users-profile-fields.js          # ensure migrated SIRET/businessRegistrationId values satisfy 14-digit numeric rule
│   └── populate-users-from-insee.js             # preserve 13-digit prefix helper only for generating 14-digit SIRET values; do not treat it as final validation
├── src/
│   ├── i18n/translations.json                   # remove/update billing-only category table labels and SIRET validation messages where needed
│   ├── models/user.model.js                     # confirm businessRegistrationId schema validation is strict 14-digit numeric
│   ├── routes/
│   │   ├── index.js                             # existing sendBillPdf implementation and shared bill detail helpers if still located here
│   │   └── modules/
│   │       ├── auth.js                          # account/profile validation messages for SIRET/businessRegistrationId
│   │       └── bills.js                         # PDF/Factur-X route labels and party/bill option mapping
│   └── services/
│       └── factur-x/
│           ├── invoice-data.js                  # keep bill mentions in included notes; enforce 14-digit party SIRET; stop using category for visible line descriptions when needed
│           ├── generator.js                     # move notes to bottom of readable Factur-X PDF and omit visible category column/field
│           └── validation.js                    # keep existing fail-closed validation path
└── test/
    ├── bills/bill-unique-id.test.js             # guard against confusing SIRET with five-digit user uniqueId invoice identifiers
    ├── factur-x/invoice-data.test.js            # 14-digit SIRET acceptance/rejection and included notes
    ├── factur-x/routes.test.js                  # vendor/client route behavior and no category presentation contract
    ├── rungis-bills/invoice-documents.test.js   # ensure unrelated Rungis fee bill docs are not regressed if shared helpers change
    └── scripts/populate-users-from-insee.test.js # preserve final 14-digit generated SIRET behavior

frontend/
└── src/app/
    ├── app.ts                                   # reactive form validators and bill modal state helpers
    ├── app.types.ts                             # businessRegistrationId typing remains compatible with 14-digit values
    ├── app.spec.ts                              # frontend validators and bill modal no-category assertions
    └── pages/
        └── dashboard-page.component.html        # remove category headers/cells from vendor and client bill detail modal tables
```

**Structure Decision**: Use the existing full-stack layout and current daily bill generation surfaces. No new backend endpoint, database collection, or frontend page is needed. The contract for this feature is a presentation/validation contract because the externally visible behavior is the shape of existing bill documents, bill popups, and validation outcomes rather than a new HTTP API.

## Design Summary

- [research.md](./research.md) resolves bill mention placement, category-column removal scope, SIRET validation, existing 13-digit prefix helper handling, and Factur-X consistency decisions.
- [data-model.md](./data-model.md) describes the affected existing entities and validation/display rules without introducing new persistent entities.
- [contracts/bill-document-cleanup.contract.md](./contracts/bill-document-cleanup.contract.md) defines observable acceptance contracts for PDF, readable Factur-X, bill popups, and SIRET/businessRegistrationId validation.
- [quickstart.md](./quickstart.md) lists implementation verification commands and manual acceptance checks.

## Post-Design Constitution Check

PASS — The design preserves existing authorization and data models, limits category removal to billing presentation surfaces, keeps Factur-X readable and structured data consistent, enforces strict SIRET/businessRegistrationId validation, and includes backend/frontend/document verification for vendor and client bill variants without expanding scope into unrelated Rungis fee invoices or catalog category workflows.
