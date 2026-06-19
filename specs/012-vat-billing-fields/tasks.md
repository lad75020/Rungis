# Tasks: VAT Billing Fields

**Input**: Design documents from `/specs/012-vat-billing-fields/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vat-billing-fields.contract.md, quickstart.md

**Tests**: Included because the implementation plan requires backend `node:test`, Angular/Vitest coverage, document validation, and manual acceptance checks for this fiscal billing feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story after shared foundations are complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because the task touches different files or test fixtures and does not depend on another incomplete task in the same phase.
- **[Story]**: Maps task to the user story from `specs/012-vat-billing-fields/spec.md`.
- Each task names exact repository file paths.

## Path Conventions

- Backend source: `backend/src/`
- Backend tests and fixtures: `backend/test/`, `backend/fixtures/`
- Frontend source and tests: `frontend/src/app/`
- Feature artifacts: `specs/012-vat-billing-fields/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared VAT pricing helpers, reusable frontend helpers, and fiscal test fixture scaffolding before model and story work.

- [ ] T001 Create shared VAT and money rounding helpers in backend/src/lib/vat-pricing.js for net amount, VAT amount, gross amount, line totals, and VAT breakdown aggregation.
- [ ] T002 [P] Create frontend VAT display helper functions in frontend/src/app/vat-pricing.ts for non-authoritative form previews and gross price formatting.
- [ ] T003 [P] Create reusable VAT pricing fixtures in backend/test/fixtures/vat-pricing.fixture.js covering 20%, decimal VAT, 0%, mixed rates, and rounding edge cases.
- [x] T004 [P] Add VAT billing translation key placeholders in backend/src/i18n/translations.json for VAT ID, bill mentions, VAT percentage, net price, VAT amount, gross price, missing VAT, and document errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add persisted data fields and shared backend/frontend contracts that every user story needs.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Add vendor billing profile fields `vatId` and `billMentions` to backend/src/models/user.model.js with trimming, length limits, and defaults.
- [x] T006 Add per-merchandise `vatRate` storage to backend/src/models/merchandise.model.js while allowing legacy rows to remain null until edited.
- [ ] T007 Add VAT snapshot fields to validated order line schema in backend/src/models/validated-order.model.js for `vatRate`, `vatCategory`, unit VAT, unit gross price, line VAT, and line gross total.
- [ ] T008 Add VAT-aware persisted bill total fields and adjustment-line metadata to backend/src/models/bill.model.js for `totalVatAmount`, `totalPriceIncludingVat`, and VAT fields on refund and penalty lines.
- [ ] T009 Implement shared backend validation and mapping utilities in backend/src/routes/index.js for `normalizeVatRate`, `assertVatComplete`, `buildVatSnapshot`, `mapVatBreakdowns`, `mapMerchandise`, `mapOrderCatalogItem`, and `mapCart`.
- [ ] T010 Update shared frontend data interfaces in frontend/src/app/app.types.ts for vendor billing fields, merchandise VAT, cart VAT snapshots, bill VAT totals, and VAT breakdown rows.

**Checkpoint**: Database models, shared helpers, and typed payloads are ready for user story implementation.

---

## Phase 3: User Story 1 - Maintain vendor invoice identity fields (Priority: P1) MVP

**Goal**: Vendors can save and reload a 13-character VAT ID and multi-line bill mentions in account settings.

**Independent Test**: Open vendor account settings, save a valid VAT ID and bill mentions, reload the session, confirm values reappear, and confirm invalid VAT ID length is rejected without altering stored values.

### Tests for User Story 1

- [ ] T011 [P] [US1] Add backend account validation tests in backend/test/account-vat-fields.test.js for valid VAT ID, invalid VAT ID lengths, trimmed input, multiline bill mentions, and non-vendor field handling.
- [ ] T012 [P] [US1] Add frontend account form regression tests in frontend/src/app/app.spec.ts for VAT ID input binding, four-line bill mentions textarea, save payload, reload state, and validation feedback.

### Implementation for User Story 1

- [x] T013 [US1] Update account update handling in backend/src/routes/modules/auth.js to accept, validate, persist, and return vendor-only `vatId` and `billMentions` fields.
- [x] T014 [US1] Update session and user mapping in backend/src/routes/index.js so `mapSessionUser` returns `vatId` and `billMentions` for authenticated vendors.
- [x] T015 [US1] Update account form state, payload construction, reset logic, and client-side validation in frontend/src/app/app.ts for VAT ID and bill mentions.
- [x] T016 [US1] Add VAT ID text input and four-visible-line bill mentions textarea to vendor account settings markup in frontend/src/app/app.html.
- [x] T017 [US1] Add final localized account labels and validation messages in backend/src/i18n/translations.json for VAT ID and bill mentions.
- [ ] T018 [US1] Run the account-field verification commands documented in specs/012-vat-billing-fields/quickstart.md against backend/test/account-vat-fields.test.js and frontend/src/app/app.spec.ts.

**Checkpoint**: User Story 1 is independently functional and can ship as the MVP for vendor billing profile data.

---

## Phase 4: User Story 2 - Apply vendor billing fields to Factur-X bills (Priority: P2)

**Goal**: Generated Factur-X bills and readable bill PDFs use the vendor VAT ID and bill mentions from account settings, or fail clearly when required billing identity data is missing.

**Independent Test**: Save vendor VAT ID and bill mentions, generate vendor and client Factur-X bills, extract/read the bill, and verify seller VAT ID plus invoice-note text appear in both structured Factur-X data and the readable PDF layer.

### Tests for User Story 2

- [x] T019 [P] [US2] Extend Factur-X route tests in backend/test/factur-x/routes.test.js for selecting vendor `vatId` and `billMentions` in `/api/bills/vendor/:key/factur-x` and `/api/bills/client/:key/factur-x` generation.
- [ ] T020 [P] [US2] Extend Factur-X invoice data tests in backend/test/factur-x/invoice-data.test.js for seller VAT ID, invoice notes, missing vendor VAT ID failures, and XML escaping of bill mentions.
- [ ] T021 [P] [US2] Extend Factur-X generator tests in backend/test/factur-x/generator.test.js to assert visible PDF content and embedded XML both carry vendor VAT ID and bill mentions.

### Implementation for User Story 2

- [x] T022 [US2] Update bill route vendor/client party selection in backend/src/routes/modules/bills.js to select `vatId` and `billMentions` for document generation.
- [x] T023 [US2] Update Factur-X normalization in backend/src/services/factur-x/invoice-data.js to map seller VAT ID and bill mentions into the normalized invoice object and reject required missing seller tax identity data.
- [x] T024 [US2] Update Factur-X XML/PDF generation in backend/src/services/factur-x/generator.js to serialize invoice notes, seller VAT ID, and matching readable bill text.
- [x] T025 [US2] Update existing PDF party block rendering in backend/src/routes/index.js so `/pdf` bill endpoints visibly show seller VAT ID and vendor bill mentions.
- [ ] T026 [US2] Update Factur-X validation helpers in backend/src/services/factur-x/validation.js to include seller VAT ID and invoice-note consistency checks where extraction permits.
- [x] T027 [US2] Update Factur-X bill fixtures in backend/fixtures/factur-x/bills.fixture.json with seller VAT ID, bill mentions, and missing-field cases.
- [x] T028 [US2] Run the document-generation verification commands documented in specs/012-vat-billing-fields/quickstart.md against backend/test/factur-x/routes.test.js, backend/test/factur-x/invoice-data.test.js, and backend/test/factur-x/generator.test.js.

**Checkpoint**: User Story 2 is independently functional for vendor billing identity propagation into Factur-X and PDF documents.

---

## Phase 5: User Story 3 - Define merchandise VAT and gross prices (Priority: P3)

**Goal**: Vendors assign VAT percentage per merchandise item, and every price-bearing screen plus PDF/Factur-X document shows VAT-inclusive values alongside existing VAT-exclusive prices.

**Independent Test**: Create merchandise with a VAT percentage, place and validate a cart with single and mixed VAT rates, then confirm stock, catalog, cart, dashboard bill details, PDF bills, and Factur-X bills show matching net, VAT, and gross amounts.

### Tests for User Story 3

- [ ] T029 [P] [US3] Add merchandise VAT validation and mapping tests in backend/test/merchandise-vat.test.js for create/update/list, legacy missing VAT, decimal VAT, zero VAT, and gross unit price derivation.
- [ ] T030 [P] [US3] Add order VAT snapshot tests in backend/test/order-vat-pricing.test.js for cart add/update/validate, mixed VAT rates, historical snapshot stability, and missing VAT validation failures.
- [ ] T031 [P] [US3] Extend bill and Factur-X VAT tests in backend/test/factur-x/vat-billing-fields.test.js for line VAT, VAT breakdowns, gross totals, refund/penalty behavior, and PDF/XML consistency.
- [ ] T032 [P] [US3] Add frontend stock/order/dashboard display tests in frontend/src/app/app.spec.ts for VAT percentage form input, net/gross columns, cart gross totals, bill gross totals, and missing VAT warnings.

### Implementation for User Story 3

- [ ] T033 [US3] Update stock payload sanitization and merchandise/catalog mapping in backend/src/routes/index.js to include `vatRate`, `vatAmount`, `priceIncludingVat`, and incomplete VAT state.
- [x] T034 [US3] Update vendor stock websocket actions in backend/src/routes/modules/websocket.js so `stocks:create`, `stocks:update`, and `stocks:list` validate, persist, and broadcast merchandise VAT data.
- [ ] T035 [US3] Update client ordering websocket actions in backend/src/routes/modules/websocket.js so `order:catalog`, `order:cart:add`, `order:cart:update`, and `order:cart:validate` snapshot VAT data, block missing VAT, and return cart gross totals.
- [ ] T036 [US3] Update bill aggregation in backend/src/routes/index.js for `getVendorBillDetails`, `getClientBillDetails`, refund mapping, penalty mapping, VAT breakdowns, `totalVatAmount`, and `totalPriceIncludingVat`.
- [ ] T037 [US3] Update PDF bill table and totals rendering in backend/src/routes/index.js to show VAT rate, VAT amount, gross line price, net total, VAT total, and gross total.
- [x] T038 [US3] Update Factur-X line and totals mapping in backend/src/services/factur-x/invoice-data.js for VAT category/rate, VAT breakdowns, BT-109 net total, BT-110 VAT total, BT-112 gross total, and amount due.
- [x] T039 [US3] Update Factur-X readable rendering and XML serialization in backend/src/services/factur-x/generator.js for line VAT, VAT breakdowns, and gross totals matching `invoice-data.js`.
- [x] T040 [US3] Update frontend application state, form payloads, websocket response handling, and gross price helpers in frontend/src/app/app.ts for merchandise VAT, cart totals, and bill VAT totals.
- [ ] T041 [US3] Update vendor stock screen markup in frontend/src/app/pages/stocks-page.component.html with VAT percentage create/edit input, net price column, price including VAT column, and legacy missing VAT warning.
- [ ] T042 [US3] Update client order screen markup in frontend/src/app/pages/order-page.component.html with catalog gross unit price, cart VAT amount, line gross totals, cart VAT total, and cart gross total.
- [ ] T043 [US3] Update dashboard bill list and detail markup in frontend/src/app/pages/dashboard-page.component.html with gross totals, VAT breakdowns, line VAT values, and net/VAT/gross footer totals.
- [ ] T044 [US3] Add final localized stock, order, dashboard, bill, and document VAT labels in backend/src/i18n/translations.json for all net, VAT, and gross price fields.
- [ ] T045 [US3] Run VAT pricing verification commands documented in specs/012-vat-billing-fields/quickstart.md against backend/test/merchandise-vat.test.js, backend/test/order-vat-pricing.test.js, backend/test/factur-x/vat-billing-fields.test.js, and frontend/src/app/app.spec.ts.

**Checkpoint**: User Story 3 completes per-merchandise VAT storage and VAT-inclusive price display across screens, PDFs, and Factur-X documents.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full-suite verification, documentation alignment, and release readiness across all stories.

- [x] T046 [P] Update feature verification notes in specs/012-vat-billing-fields/quickstart.md with any final commands, fixture names, or manual browser paths discovered during implementation.
- [ ] T047 [P] Update developer context in AGENTS.md if implementation changes the primary files or commands beyond specs/012-vat-billing-fields/plan.md.
- [x] T048 Run full backend test suite using backend/package.json with `npm --workspace backend test` and record any failing VAT or Factur-X cases in specs/012-vat-billing-fields/quickstart.md.
- [x] T049 Run frontend test and production build using frontend/package.json with `npm --workspace frontend test -- --watch=false` and `npm --workspace frontend run build`.
- [ ] T050 Perform manual acceptance checks from specs/012-vat-billing-fields/quickstart.md for vendor account settings, stock creation/editing, client ordering, dashboard bill views, PDF bills, and Factur-X downloads.
- [ ] T051 Review final source diff against specs/012-vat-billing-fields/plan.md to confirm net prices remain VAT-exclusive and every gross value is derived from stored VAT data.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; tasks T002, T003, and T004 can run in parallel after T001 scope is agreed.
- **Foundational (Phase 2)**: Depends on Phase 1 completion and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2; delivers MVP account storage and validation.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and benefits from US1 for saved vendor values, but document mapping can be developed against fixtures independently.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and can be implemented independently after shared VAT helpers and models exist.
- **Polish (Phase 6)**: Depends on the selected user stories being complete.

### User Story Dependencies

- **US1 Maintain vendor invoice identity fields**: Start after Foundation; no dependency on US2 or US3.
- **US2 Apply vendor billing fields to Factur-X bills**: Start after Foundation; uses persisted values from US1 in production but can be tested with fixture vendor data.
- **US3 Define merchandise VAT and gross prices**: Start after Foundation; independent from account field editing but must integrate with bill document paths that US2 also touches.

### Within Each User Story

- Write story tests before implementation and confirm they fail for the missing behavior.
- Complete model/schema changes before route or websocket persistence logic.
- Complete backend payload changes before frontend display integration.
- Complete document data mapping before PDF/XML rendering.
- Validate the story independently before moving to the next priority checkpoint.

### Summary Counts

- Total tasks: 51
- Setup tasks: 4
- Foundational tasks: 6
- US1 tasks: 8
- US2 tasks: 10
- US3 tasks: 17
- Polish tasks: 6
- Parallel-marked tasks: 14

---

## Parallel Opportunities

- Setup tasks T002, T003, and T004 can run in parallel after T001 defines the shared backend helper contract.
- Foundational model tasks T005, T006, T007, and T008 can be drafted in parallel, then reconciled through T009 and T010.
- US1 tests T011 and T012 can run in parallel before account implementation begins.
- US2 tests T019, T020, and T021 can run in parallel because they target separate Factur-X route, mapper, and generator files.
- US3 tests T029, T030, T031, and T032 can run in parallel because they cover separate backend and frontend surfaces.
- US1 and US3 can be implemented by different developers after Phase 2 because they touch mostly separate account versus stock/order surfaces.
- US2 and US3 both touch Factur-X files, so coordinate T023/T024 with T038/T039 before merging.

## Parallel Example: User Story 1

```bash
Task: "T011 [P] [US1] Add backend account validation tests in backend/test/account-vat-fields.test.js"
Task: "T012 [P] [US1] Add frontend account form regression tests in frontend/src/app/app.spec.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T019 [P] [US2] Extend Factur-X route tests in backend/test/factur-x/routes.test.js"
Task: "T020 [P] [US2] Extend Factur-X invoice data tests in backend/test/factur-x/invoice-data.test.js"
Task: "T021 [P] [US2] Extend Factur-X generator tests in backend/test/factur-x/generator.test.js"
```

## Parallel Example: User Story 3

```bash
Task: "T029 [P] [US3] Add merchandise VAT validation and mapping tests in backend/test/merchandise-vat.test.js"
Task: "T030 [P] [US3] Add order VAT snapshot tests in backend/test/order-vat-pricing.test.js"
Task: "T031 [P] [US3] Extend bill and Factur-X VAT tests in backend/test/factur-x/vat-billing-fields.test.js"
Task: "T032 [P] [US3] Add frontend stock/order/dashboard display tests in frontend/src/app/app.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 shared VAT helper setup.
2. Complete Phase 2 persistence and shared contracts.
3. Complete Phase 3 account fields and validation.
4. Validate US1 independently with account settings tests and manual account save/reload.
5. Demo vendor VAT ID and bill mentions persistence before moving to document integration.

### Incremental Delivery

1. Setup and Foundation create the shared schema/helper base.
2. US1 ships vendor billing profile storage.
3. US2 ships vendor billing profile usage in Factur-X and PDF documents.
4. US3 ships merchandise VAT, gross-price display, order snapshots, and bill VAT totals.
5. Polish runs full regression, manual acceptance, and final consistency review.

### Parallel Team Strategy

1. Team completes Phase 1 and Phase 2 together.
2. Developer A implements US1 account settings.
3. Developer B implements US2 Factur-X and PDF vendor billing identity.
4. Developer C implements US3 merchandise VAT and gross-price screens.
5. Coordinate shared files backend/src/routes/index.js, backend/src/routes/modules/websocket.js, backend/src/services/factur-x/invoice-data.js, backend/src/services/factur-x/generator.js, frontend/src/app/app.ts, frontend/src/app/app.spec.ts, and backend/src/i18n/translations.json before final integration.

---

## Notes

- Preserve existing VAT-exclusive fields such as `price`, `unitPrice`, `lineTotal`, `grandTotal`, and `totalPrice`.
- Treat VAT-inclusive values as derived fields based on stored `vatRate` snapshots.
- Do not auto-backfill legacy merchandise with fabricated VAT rates.
- Factur-X XML, readable PDF, and on-screen bill totals must reconcile for net, VAT, and gross values.
- Verify tests fail before implementing each story where tests are introduced.
- Commit after each completed phase or logical group if using the optional git extension hook.
