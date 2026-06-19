# Implementation Plan: Download Factur-X

**Branch**: `011-download-factur-x` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-download-factur-x/spec.md`

## Summary

Add a dedicated "Download Factur-X" action beside the existing bill details "Display PDF" action for both vendor and client bill views. The implementation keeps current PDF display endpoints unchanged, adds role-guarded Factur-X download endpoints, and builds a backend Factur-X service that normalizes bill data once, renders the readable invoice view, embeds `factur-x.xml` into a PDF/A-3 carrier via the mandatory `factur-x` npm package, and validates the generated hybrid invoice before sending it as a download.

## Technical Context

**Language/Version**: JavaScript ES modules on Node.js v26.3.0; TypeScript 5.9 with Angular 21 frontend

**Primary Dependencies**: Fastify route modules, Mongoose models, `pdfkit` for existing PDF rendering, mandatory npm package `factur-x` v0.0.2 for Factur-X read/write, Angular standalone components/templates, Bootstrap styling, existing i18n translations

**Storage**: MongoDB for persisted users, validated orders, and bill records; Redis for session/operational state where existing bill flows need it; no new persistent collection required for the download itself

**Testing**: Add backend `node:test` coverage for Factur-X mapping/generation/route contracts, keep Angular/Vitest frontend tests, run Angular production build, and use Factur-X/XML/PDF metadata validation fixtures for generated downloads

**Target Platform**: Browser-based B2B web portal serving vendor and client bill details

**Project Type**: Full-stack web application

**Performance Goals**: Under normal operation, users receive a Factur-X file download or a clear failure message within 5 seconds; generation must not block or alter the existing `Display PDF` path

**Constraints**: Preserve existing `/api/bills/*/:key/pdf` inline display behavior; server-side role guards remain authoritative; do not download invalid or empty Factur-X files; all structured XML values must be represented in the readable PDF layer; avoid fabricating missing legal/tax data

**Scale/Scope**: One feature slice covering vendor and client bill details UI actions, two new REST download endpoints, shared Factur-X generation service, i18n labels, and automated validation/test coverage

## Constitution Check

The project constitution is still the generated template and does not contain ratified project-specific rules. Default gates for this web application are applied:

- PASS — Server-side authorization: vendor/client guards are required for each download endpoint.
- PASS — Compliance-first output: generated Factur-X files must be validated before successful response.
- PASS — Safe failure behavior: missing legal/tax data returns an explicit error instead of a non-compliant download.
- PASS — Existing behavior preservation: `Display PDF` remains unchanged and separate.
- PASS — Testability: mapper, generation, endpoint, frontend action, and validation scenarios are independently testable.
- PASS — Scope control: no billing workflow redesign or settlement-state change is included.

## Project Structure

### Documentation (this feature)

```text
specs/011-download-factur-x/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/factur-x-download.openapi.yml
└── tasks.md              # created later by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── package.json                         # add mandatory Factur-X dependency and backend test script if absent
├── src/
│   ├── models/
│   │   └── bill.model.js                # existing persisted bill/refund/penalty source
│   ├── routes/
│   │   ├── index.js                     # expose Factur-X deps in route context
│   │   └── modules/bills.js             # add vendor/client Factur-X download routes
│   └── services/
│       └── factur-x/
│           ├── invoice-data.js          # normalize vendor/client bill details into InvoiceFacturXData
│           ├── generator.js             # XML/readable PDF/PDF-A-3 hybrid invoice generation
│           └── validation.js            # XML, metadata, attachment, and PDF/A validation helpers
├── test/
│   └── factur-x/
│       ├── invoice-data.test.js
│       ├── generator.test.js
│       └── routes.test.js
└── fixtures/
    └── factur-x/                        # supported/missing-field/refund validation fixtures

frontend/
└── src/app/
    ├── app.ts                           # add Factur-X download methods and feedback state
    ├── app.spec.ts                      # cover vendor/client action behavior
    └── pages/dashboard-page.component.html
                                           # add buttons next to existing PDF buttons

backend/src/i18n/translations.json       # add localized labels and errors
```

**Structure Decision**: Use the current full-stack layout. Backend generation is isolated under `backend/src/services/factur-x/` so both vendor and client routes share identical validation and document-generation rules. Frontend changes remain in the existing dashboard modal template and app controller because bill details actions already live there.

## Design Summary

- [research.md](./research.md) resolves Factur-X profile, endpoint shape, validation, frontend download behavior, and missing-data strategy.
- [data-model.md](./data-model.md) defines the normalized invoice, party, line, totals, validation result, and UI action entities.
- [contracts/factur-x-download.openapi.yml](./contracts/factur-x-download.openapi.yml) documents the two new role-scoped download endpoints and expected error responses.
- [quickstart.md](./quickstart.md) lists implementation verification commands and manual checks.

## Post-Design Constitution Check

PASS — The design preserves existing PDF display behavior, adds server-side role-gated Factur-X endpoints, validates compliance before download, fails closed on missing legal/tax data, and remains bounded to bill details downloads for vendor and client views.
