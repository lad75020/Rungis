# Tasks: Download Factur-X

**Input**: Design documents from `/specs/011-download-factur-x/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/factur-x-download.openapi.yml, quickstart.md

**Tests**: Included because the plan requires mapper, generator, route, frontend, and compliance validation before a Factur-X download can be considered successful.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare dependencies, test entry points, and fixture locations used by all stories.

- [X] T001 Verify `factur-x` dependency, package-lock entry, and add a backend `test` script if absent in backend/package.json and package-lock.json
- [X] T002 [P] Create fixture catalog notes for supported, refund, and missing-data cases in backend/fixtures/factur-x/README.md
- [X] T003 [P] Create backend Factur-X test directory scaffolding notes in backend/test/factur-x/README.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared Factur-X service boundaries and UI vocabulary that must exist before user-story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create shared Factur-X invoice data module exports and constants in backend/src/services/factur-x/invoice-data.js
- [X] T005 [P] Create shared Factur-X validation result helpers and required metadata constants in backend/src/services/factur-x/validation.js
- [X] T006 [P] Create shared Factur-X generator orchestration skeleton with explicit dependency on the `factur-x` package in backend/src/services/factur-x/generator.js
- [X] T007 Add reusable `sendFacturXBill` route dependency wiring in backend/src/routes/index.js
- [X] T008 Add shared English and French `common.downloadFacturX` label plus generic Factur-X alert keys in backend/src/i18n/translations.json
- [X] T009 Add vendor/client Factur-X download state signals and method placeholders in frontend/src/app/app.ts

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Download Factur-X from bill details (Priority: P1) 🎯 MVP

**Goal**: Authorized vendors and clients can click "Download Factur-X" next to "Display PDF" and receive a Factur-X PDF download without changing the existing PDF display path.

**Independent Test**: Open vendor and client bill details views, confirm both actions are adjacent, click `Display PDF` to confirm existing inline behavior, then click `Download Factur-X` to confirm a `.pdf` attachment is downloaded for each role.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T010 [P] [US1] Add route contract tests for successful vendor and client `GET /api/bills/{role}/{key}/factur-x` downloads in backend/test/factur-x/routes.test.js
- [X] T011 [P] [US1] Add frontend tests that render vendor/client `Download Factur-X` buttons next to PDF buttons and keep PDF clicks unchanged in frontend/src/app/app.spec.ts

### Implementation for User Story 1

- [X] T012 [US1] Implement vendor/client Factur-X fetch-and-blob download methods while preserving `openVendorBillPdf` and `openClientBillPdf` in frontend/src/app/app.ts
- [X] T013 [US1] Add vendor and client `Download Factur-X` buttons next to existing PDF buttons in frontend/src/app/pages/dashboard-page.component.html
- [X] T014 [US1] Implement happy-path `InvoiceFacturXData` normalization for existing vendor/client bill details in backend/src/services/factur-x/invoice-data.js
- [X] T015 [US1] Implement happy-path Factur-X PDF generation and attachment filename output in backend/src/services/factur-x/generator.js
- [X] T016 [US1] Add vendor and client `/factur-x` Fastify routes using existing role guards in backend/src/routes/modules/bills.js
- [X] T017 [US1] Wire successful Factur-X downloads to `Content-Type: application/pdf`, attachment disposition, and `Cache-Control: no-store` in backend/src/routes/modules/bills.js
- [X] T018 [US1] Expose the Factur-X sender dependencies from route context to bill routes in backend/src/routes/index.js

**Checkpoint**: User Story 1 is independently testable as the MVP download flow.

---

## Phase 4: User Story 2 - Preserve bill-specific and role-specific content (Priority: P2)

**Goal**: Downloaded Factur-X bills match the bill details the current vendor or client is authorized to see, including parties, totals, refund lines, penalty lines, and role-specific perspective.

**Independent Test**: Compare generated vendor and client Factur-X fixture downloads against visible bill details, including normal lines, refunds, penalties, parties, dates, totals, and role-specific bill keys.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T019 [P] [US2] Add mapper tests for parties, refunds, penalties, VAT fields, totals, and role-specific bill keys in backend/test/factur-x/invoice-data.test.js
- [X] T020 [P] [US2] Add generator tests for embedded `factur-x.xml`, `text/xml`, XMP fields, profile consistency, and readable PDF content in backend/test/factur-x/generator.test.js
- [X] T021 [P] [US2] Add fixture data for simple, refund/negative-line, and missing-legal-field bills in backend/fixtures/factur-x/bills.fixture.json

### Implementation for User Story 2

- [X] T022 [US2] Complete seller and buyer `Party` mapping, legal registration checks, country defaults, and placeholder rejection in backend/src/services/factur-x/invoice-data.js
- [X] T023 [US2] Complete merchandise, refund, penalty, unit-code, VAT category, VAT rate, and total reconciliation mapping in backend/src/services/factur-x/invoice-data.js
- [X] T024 [US2] Render every structured invoice field into the readable PDF layer before embedding XML in backend/src/services/factur-x/generator.js
- [X] T025 [US2] Enforce embedded filename, MIME type, XMP metadata, conformance level, and XML/profile consistency checks in backend/src/services/factur-x/validation.js
- [X] T026 [US2] Expand vendor/client party selections for legal and tax fields needed by the mapper in backend/src/routes/modules/bills.js
- [X] T027 [US2] Keep persisted bill UUID, refund lines, penalty lines, and role-specific filenames consistent between existing PDF and Factur-X paths in backend/src/routes/modules/bills.js

**Checkpoint**: User Stories 1 and 2 work independently and produce role-accurate Factur-X downloads.

---

## Phase 5: User Story 3 - Handle unavailable downloads clearly (Priority: P3)

**Goal**: Unauthorized, missing, incomplete, or generation-failed downloads fail closed with clear user feedback and no invalid or partial file.

**Independent Test**: Attempt invalid key, missing bill, unauthorized role, missing legal/tax data, and generation failure cases; verify no file is saved and the user sees a clear failure message.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T028 [P] [US3] Add route tests for invalid key, not found, unauthorized, missing invoice data, and validation failure responses in backend/test/factur-x/routes.test.js
- [X] T029 [P] [US3] Add frontend tests for failed Factur-X response handling and repeated-click in-progress guarding in frontend/src/app/app.spec.ts

### Implementation for User Story 3

- [X] T030 [US3] Implement safe `FacturXError` categories and JSON error responses for `/factur-x` routes in backend/src/routes/modules/bills.js
- [X] T031 [US3] Implement missing legal/tax data validation messages without sensitive internal traces in backend/src/services/factur-x/validation.js
- [X] T032 [US3] Implement frontend response parsing, in-progress disabling, and alert feedback for Factur-X failures in frontend/src/app/app.ts
- [X] T033 [US3] Add English and French missing-data, denied, and generation-failed Factur-X messages in backend/src/i18n/translations.json
- [X] T034 [US3] Ensure validation and generation errors are logged server-side without sending partial PDF bytes in backend/src/services/factur-x/generator.js

**Checkpoint**: All user stories are independently functional with safe failure behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, documentation, and compliance checks across all stories.

- [X] T035 [P] Document the Factur-X service boundaries and package caveats in backend/src/services/factur-x/README.md
- [X] T036 Run `npm --workspace backend test` and record backend evidence in specs/011-download-factur-x/quickstart.md
- [X] T037 Run `npm --workspace frontend test -- --watch=false` and record frontend evidence in specs/011-download-factur-x/quickstart.md
- [X] T038 Run `npm run build` and record production build evidence in specs/011-download-factur-x/quickstart.md
- [X] T039 Manually validate vendor and client fixture downloads against Factur-X XML, XMP, attachment, and PDF/A expectations and record evidence in specs/011-download-factur-x/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — blocks all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundation and delivers the MVP download action and endpoint.
- **User Story 2 (P2)**: Starts after Foundation; can be developed alongside US1 but final validation depends on the shared generator/mapper contracts from US1.
- **User Story 3 (P3)**: Starts after Foundation; can be developed alongside US1/US2 but must be validated after route and frontend download flows exist.

### Within Each User Story

- Tests should be written first and fail before implementation.
- Shared service contracts before route integration.
- Backend endpoint behavior before frontend happy-path verification.
- Error handling before final manual validation.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001.
- T005 and T006 can run in parallel after T004.
- T010 and T011 can run in parallel before US1 implementation.
- T019, T020, and T021 can run in parallel before US2 implementation.
- T028 and T029 can run in parallel before US3 implementation.
- T035 can run in parallel with final verification commands after implementation.

---

## Parallel Example: User Story 1

```bash
Task: "Add route contract tests for successful vendor and client GET /api/bills/{role}/{key}/factur-x downloads in backend/test/factur-x/routes.test.js"
Task: "Add frontend tests that render vendor/client Download Factur-X buttons next to PDF buttons and keep PDF clicks unchanged in frontend/src/app/app.spec.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add mapper tests for parties, refunds, penalties, VAT fields, totals, and role-specific bill keys in backend/test/factur-x/invoice-data.test.js"
Task: "Add generator tests for embedded factur-x.xml, text/xml, XMP fields, profile consistency, and readable PDF content in backend/test/factur-x/generator.test.js"
Task: "Add fixture data for simple, refund/negative-line, and missing-legal-field bills in backend/fixtures/factur-x/bills.fixture.json"
```

## Parallel Example: User Story 3

```bash
Task: "Add route tests for invalid key, not found, unauthorized, missing invoice data, and validation failure responses in backend/test/factur-x/routes.test.js"
Task: "Add frontend tests for failed Factur-X response handling and repeated-click in-progress guarding in frontend/src/app/app.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational service boundaries and labels.
3. Complete Phase 3: User Story 1.
4. Stop and validate vendor and client happy-path downloads independently.
5. Demo the UI with both `Display PDF` and `Download Factur-X` actions visible.

### Incremental Delivery

1. Setup + Foundation establish shared service and UI vocabulary.
2. US1 adds the user-visible download flow.
3. US2 makes generated files bill-accurate and compliance-oriented.
4. US3 makes all failure paths safe and understandable.
5. Polish runs automated and manual validation before implementation is reported complete.

### Parallel Team Strategy

With multiple developers:

1. One developer handles backend Factur-X service and route tests.
2. One developer handles frontend buttons, fetch/blob behavior, and UI tests.
3. One developer handles fixture/compliance validation and quickstart evidence.
4. Integrate only after foundational service boundaries and error categories are agreed.

---

## Summary Counts

- **Total tasks**: 39
- **Setup**: 3 tasks
- **Foundation**: 6 tasks
- **US1**: 9 tasks
- **US2**: 9 tasks
- **US3**: 7 tasks
- **Polish**: 5 tasks
- **Parallel tasks**: 12 tasks marked `[P]`

## Notes

- Keep existing `/api/bills/vendor/:key/pdf` and `/api/bills/client/:key/pdf` behavior unchanged.
- New download endpoints are `/api/bills/vendor/:key/factur-x` and `/api/bills/client/:key/factur-x`.
- The implementation must use the npm `factur-x` package and still validate generated output before sending a successful response.
- Missing legal/tax data must fail closed; do not fabricate invoice data.
- Commit after each completed phase or logical group.
