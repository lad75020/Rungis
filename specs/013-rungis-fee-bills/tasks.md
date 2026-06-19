# Tasks: Rungis Fee Bills

**Input**: Design documents from `/specs/013-rungis-fee-bills/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/rungis-fee-bills.openapi.yml`, `quickstart.md`

**Tests**: Included because the plan requires isolated backend/frontend/document regression coverage and the feature handles financial invoices and paid-state persistence.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Summary Counts

- **Total tasks**: 64
- **Parallelizable tasks**: 25
- **Setup tasks**: 4
- **Foundational tasks**: 8
- **US1 Configure Rungis billing rates**: 9
- **US2 Generate previous-month Rungis bills**: 11
- **US3 View and export user Rungis invoice**: 13
- **US4 Search and mark unpaid bills paid**: 11
- **Polish tasks**: 8

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or independent test surfaces
- **[Story]**: Maps the task to a user story phase (`US1`, `US2`, `US3`, `US4`)
- Every task names exact file paths or repository config files

## Phase 1: Setup (Shared Infrastructure)

**Goal**: Create the feature-specific backend/frontend skeleton without changing runtime behavior.

- [X] T001 [P] Create Rungis bill backend service directory in backend/src/services/rungis-bills/ with settings.js, generation.js, invoice-data.js, and pdf.js module stubs
- [X] T002 [P] Create Rungis bill route module stub in backend/src/routes/modules/rungis-bills.js and export registration shape matching backend/src/routes/modules/bills.js
- [X] T003 [P] Create backend test directory backend/test/rungis-bills/ with placeholder-free settings.test.js, generation.test.js, routes.test.js, and invoice-documents.test.js files
- [X] T004 Review translations namespace placement for Rungis billing labels in backend/src/i18n/translations.json

**Checkpoint**: Feature skeleton exists and can be filled by foundational and story tasks.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Goal**: Implement shared model, helpers, wiring, and types required by every user story.

**Critical**: This phase blocks all user story implementation.

- [X] T005 Add RungisBill Mongoose schema, unique scope index, search index, and user access index in backend/src/models/rungis-bill.model.js
- [X] T006 Export/import RungisBill and registerRungisBillRoutes dependency wiring in backend/src/routes/index.js
- [X] T007 [P] Implement shared money rounding, percentage normalization, and previous UTC calendar month helpers in backend/src/services/rungis-bills/settings.js
- [X] T008 [P] Implement PartySnapshot normalization for admin and billed users in backend/src/services/rungis-bills/invoice-data.js
- [X] T009 [P] Add TypeScript types for RungisBillingSettings, RungisBillSummary, RungisInvoice, and RungisBillRole in frontend/src/app/app.types.ts
- [X] T010 Add shared frontend signals and empty state containers for Rungis billing settings, search rows, current bills, and invoice modal in frontend/src/app/app.ts
- [X] T011 [P] Add initial i18n keys for shared Rungis billing errors, labels, and document actions in backend/src/i18n/translations.json
- [X] T012 [P] Add model and helper fixture builders for Rungis users, previous-month orders, and bill documents in backend/test/rungis-bills/generation.test.js

**Checkpoint**: Foundation ready: shared data structures, helpers, and wiring are available before story-specific work.

---

## Phase 3: User Story 1 - Configure Rungis billing rates (Priority: P1)

**Goal**: Admins can save and reload Rungis fee and VAT percentage settings from the admin page.

**Independent Test**: Open the admin page, save valid Rungis fee/VAT percentages, refresh, and confirm values persist; invalid percentages are rejected without replacing prior values.

### Tests for this user story

- [X] T013 [P] [US1] Add failing backend tests for valid, invalid, and persisted Rungis billing settings in backend/test/rungis-bills/settings.test.js
- [X] T014 [P] [US1] Add failing frontend tests for admin settings form binding and invalid-value feedback in frontend/src/app/app.spec.ts
- [X] T015 [US1] Implement SQLite getters/setters for rungisFeeRate and rungisVatRate in backend/src/services/rungis-bills/settings.js
- [X] T016 [US1] Add GET and PUT /api/admin/settings/rungis-billing handlers in backend/src/routes/modules/management.js
- [X] T017 [US1] Wire Rungis settings service dependencies into registerManagementRoutes in backend/src/routes/index.js
- [X] T018 [US1] Implement admin settings load/save methods and validation feedback in frontend/src/app/app.ts
- [X] T019 [US1] Add Rungis fee and VAT inputs to the admin page in frontend/src/app/pages/admin-page.component.html
- [X] T020 [P] [US1] Add admin settings translations for labels, hints, success messages, and validation errors in backend/src/i18n/translations.json
- [X] T021 [US1] Verify User Story 1 with backend/test/rungis-bills/settings.test.js and frontend/src/app/app.spec.ts

**Checkpoint**: User Story 1 complete: billing settings are independently usable and persisted.

---

## Phase 4: User Story 2 - Generate previous-month Rungis bills (Priority: P1)

**Goal**: Admins can generate idempotent vendor/client Rungis bills for the previous calendar month.

**Independent Test**: Seed previous-month validated orders, click Send Rungis bills, and verify one unpaid bill per eligible user/role with correct net gross amount, fee, payable before tax, month/year, and user unique id; rerunning does not duplicate or reset paid bills.

### Tests for this user story

- [X] T022 [P] [US2] Add failing generation tests for vendor/client monthly aggregation, zero-activity skip, idempotent rerun, and paid preservation in backend/test/rungis-bills/generation.test.js
- [X] T023 [P] [US2] Add failing admin send-button frontend tests for running state and result summary in frontend/src/app/app.spec.ts
- [X] T024 [US2] Implement previous-month period calculation and eligible vendor/client aggregation over ValidatedOrder in backend/src/services/rungis-bills/generation.js
- [X] T025 [US2] Implement RungisBill upsert generation with rate snapshots, party snapshots, payable calculations, duplicate prevention, and paid preservation in backend/src/services/rungis-bills/generation.js
- [X] T026 [US2] Add POST /api/admin/rungis-bills/send handler with admin authorization and missing-settings errors in backend/src/routes/modules/management.js
- [X] T027 [US2] Wire Rungis bill generation dependencies into registerManagementRoutes in backend/src/routes/index.js
- [X] T028 [US2] Replace or complement existing daily bill run admin action with Send Rungis bills action in frontend/src/app/pages/admin-page.component.html
- [X] T029 [US2] Implement send Rungis bills method, running state, and generation summary toast in frontend/src/app/app.ts
- [X] T030 [P] [US2] Add generation response and admin action types in frontend/src/app/app.types.ts
- [X] T031 [P] [US2] Add generation button and result translations in backend/src/i18n/translations.json
- [X] T032 [US2] Verify User Story 2 with backend/test/rungis-bills/generation.test.js and frontend/src/app/app.spec.ts

**Checkpoint**: User Story 2 complete: previous-month Rungis bills can be generated safely.

---

## Phase 5: User Story 3 - View and export the user Rungis invoice (Priority: P2)

**Goal**: Vendors and clients can open a dashboard € invoice modal and export the same invoice as PDF or Factur-X.

**Independent Test**: Sign in as a billed vendor or client, click the dashboard € icon, verify party headers and fee/VAT totals, view the PDF, and download a Factur-X hybrid PDF with matching invoice data.

### Tests for this user story

- [X] T033 [P] [US3] Add failing invoice normalization tests for admin/user party snapshots, service-fee line totals, missing identity errors, and role-scoped access in backend/test/rungis-bills/invoice-documents.test.js
- [X] T034 [P] [US3] Add failing user Rungis bill route tests for current list, invoice detail, PDF, Factur-X, unauthorized access, and missing document data in backend/test/rungis-bills/routes.test.js
- [X] T035 [P] [US3] Add failing dashboard modal frontend tests for € icon, invoice fields, PDF action, Factur-X action, and empty state in frontend/src/app/app.spec.ts
- [X] T036 [US3] Implement normalized RungisInvoiceView and Factur-X service invoice mapper in backend/src/services/rungis-bills/invoice-data.js
- [X] T037 [US3] Implement readable Rungis invoice PDF rendering with admin top-left and user top-right identity in backend/src/services/rungis-bills/pdf.js
- [X] T038 [US3] Extend existing Factur-X generator adapter for Rungis service-fee invoices in backend/src/services/factur-x/generator.js
- [X] T039 [US3] Implement GET /api/rungis-bills/current, GET /api/rungis-bills/:billId, GET /api/rungis-bills/:billId/pdf, and GET /api/rungis-bills/:billId/factur-x in backend/src/routes/modules/rungis-bills.js
- [X] T040 [US3] Wire registerRungisBillRoutes and user logo helpers into backend/src/routes/index.js
- [X] T041 [US3] Implement current bill loading, invoice modal state, PDF opening, and Factur-X blob download methods in frontend/src/app/app.ts
- [X] T042 [US3] Add dashboard € icon, invoice modal layout, admin/user party columns, totals, PDF button, and Factur-X button in frontend/src/app/pages/dashboard-page.component.html
- [X] T043 [P] [US3] Add invoice modal and document download types in frontend/src/app/app.types.ts
- [X] T044 [P] [US3] Add dashboard invoice modal, PDF, Factur-X, and error translations in backend/src/i18n/translations.json
- [X] T045 [US3] Verify User Story 3 with backend/test/rungis-bills/invoice-documents.test.js, backend/test/rungis-bills/routes.test.js, and frontend/src/app/app.spec.ts

**Checkpoint**: User Story 3 complete: users can view and export their Rungis invoice independently.

---

## Phase 6: User Story 4 - Search and mark unpaid Rungis bills paid (Priority: P3)

**Goal**: Admins can find unpaid Rungis bills by organization/month and mark a bill paid so it disappears from unpaid results.

**Independent Test**: Generate multiple unpaid bills, search with a year/month picker and organization query, mark one result paid, and confirm it is persisted as paid and excluded after refresh.

### Tests for this user story

- [X] T046 [P] [US4] Add failing admin search and mark-paid backend route tests in backend/test/rungis-bills/routes.test.js
- [X] T047 [P] [US4] Add failing admin search table and mark-paid frontend tests in frontend/src/app/app.spec.ts
- [X] T048 [US4] Implement unpaid Rungis bill search by month and organization in backend/src/services/rungis-bills/generation.js
- [X] T049 [US4] Implement atomic mark-paid service with paidAt and paidByAdminId persistence in backend/src/services/rungis-bills/generation.js
- [X] T050 [US4] Add GET /api/admin/rungis-bills and PATCH /api/admin/rungis-bills/:billId/paid handlers in backend/src/routes/modules/management.js
- [X] T051 [US4] Wire search and mark-paid dependencies into registerManagementRoutes in backend/src/routes/index.js
- [X] T052 [US4] Implement admin search filters, result loading, and mark-paid methods in frontend/src/app/app.ts
- [X] T053 [US4] Add year/month picker, organization search input, unpaid results table, and mark-paid buttons to frontend/src/app/pages/admin-page.component.html
- [X] T054 [P] [US4] Add admin search result and mark-paid response types in frontend/src/app/app.types.ts
- [X] T055 [P] [US4] Add search, empty-state, paid, and concurrency feedback translations in backend/src/i18n/translations.json
- [X] T056 [US4] Verify User Story 4 with backend/test/rungis-bills/routes.test.js and frontend/src/app/app.spec.ts

**Checkpoint**: User Story 4 complete: unpaid bill search and paid transition work independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: Run full verification, update docs, and harden edge cases across all stories.

- [X] T057 Run backend Rungis-focused tests documented in specs/013-rungis-fee-bills/quickstart.md against backend/test/rungis-bills/*.test.js
- [X] T058 Run existing Factur-X regression tests documented in specs/013-rungis-fee-bills/quickstart.md against backend/test/factur-x/*.test.js
- [X] T059 Run full backend test suite with npm --workspace backend test from package.json
- [X] T060 Run Angular tests with npm --workspace frontend test -- --watch=false from frontend/package.json
- [X] T061 Run production frontend build with npm --workspace frontend run build from frontend/package.json
- [X] T062 Run whitespace validation with git diff --check for /Volumes/WDBlack4TB/Code/rungis
- [ ] T063 Perform manual admin and user acceptance checks from specs/013-rungis-fee-bills/quickstart.md
- [X] T064 [P] Update implementation notes or discovered caveats in specs/013-rungis-fee-bills/quickstart.md

**Checkpoint**: All feature verification and documentation handoff complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; can start immediately.
- **Phase 2 Foundational**: Depends on setup completion; blocks all user stories.
- **Phase 3 / US1**: Depends on foundational completion and delivers the MVP settings workflow.
- **Phase 4 / US2**: Depends on foundational completion and US1 settings availability for real generation; tests can be prepared in parallel with US1 implementation.
- **Phase 5 / US3**: Depends on foundational completion and generated RungisBill records from US2 for end-to-end validation; invoice/document tests can be prepared earlier with fixtures.
- **Phase 6 / US4**: Depends on foundational completion and RungisBill records from US2 for end-to-end validation; search and paid tests can be prepared earlier with fixtures.
- **Phase 7 Polish**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 Configure Rungis billing rates**: Independent after foundation; MVP entry point.
- **US2 Generate previous-month Rungis bills**: Requires persisted settings from US1 for production use, but service tests can run with injected settings fixtures.
- **US3 View and export user Rungis invoice**: Requires RungisBill records from US2 for real users, but route/document tests can use direct fixtures.
- **US4 Search and mark unpaid bills paid**: Requires RungisBill records from US2 for real admin operations, but route tests can use direct fixtures.

### Within Each User Story

- Write the listed tests first and confirm they fail before implementation.
- Models and helpers precede services.
- Services precede routes.
- Routes precede frontend fetch/UI wiring.
- Story-specific verification completes before advancing to the next story checkpoint.

## Parallel Opportunities

- Setup files T001, T002, and T003 can be created independently.
- Foundation tasks T007, T008, T009, and T012 touch separate helper/type/i18n/test files.
- US1 backend tests T013 and frontend tests T014 can be written in parallel; translations T020 can be done alongside frontend wiring.
- US2 generation tests T022 and frontend button tests T023 can be written in parallel; response types T030 and translations T031 can proceed alongside UI work.
- US3 invoice, route, and frontend tests T034-T036 can be written in parallel; types T044 and translations T045 can proceed alongside UI work.
- US4 backend and frontend tests T047-T048 can be written in parallel; types T055 and translations T056 can proceed alongside UI work.
- Polish verification commands T058-T062 can run after implementation in the order shown, while documentation update T065 can proceed after manual findings are known.

## Parallel Example: User Story 3

```bash
# Parallel test-writing tasks before implementation:
Task T034: "Add failing invoice normalization tests in backend/test/rungis-bills/invoice-documents.test.js"
Task T035: "Add failing user Rungis bill route tests in backend/test/rungis-bills/routes.test.js"
Task T036: "Add failing dashboard modal frontend tests in frontend/src/app/app.spec.ts"

# Parallel support tasks after service interfaces are stable:
Task T044: "Add invoice modal and document download types in frontend/src/app/app.types.ts"
Task T045: "Add dashboard invoice modal translations in backend/src/i18n/translations.json"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation.
3. Complete Phase 3 / US1 so admins can persist Rungis fee and VAT settings.
4. Validate US1 independently with settings tests and admin page behavior.

### Incremental Delivery

1. Deliver US1 settings persistence.
2. Deliver US2 monthly bill generation using those settings.
3. Deliver US3 user invoice modal and document exports.
4. Deliver US4 unpaid search and mark-paid workflow.
5. Run Phase 7 verification before reporting implementation complete.

### Quality Gates

- Do not mark any task complete without touching or verifying the named file path.
- Do not mark Factur-X tasks complete based only on visual PDF output; validate embedded `factur-x.xml`, metadata, and error handling.
- Preserve the pre-existing `backend/.env` modification; do not include it in this feature implementation unless explicitly instructed.
