# Tasks: Bill Document Cleanup

**Input**: Design documents from `/specs/014-bill-document-cleanup/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/bill-document-cleanup.contract.md`, `quickstart.md`

**Tests**: Included because the plan's default quality gates require deterministic backend/frontend validation for document rendering, SIRET validation, and popup presentation.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or independent test fixtures.
- **[Story]**: Maps the task to a user story from `spec.md`.
- Every task names the exact file path or repository command source to change or verify.

## Summary Counts

- **Total tasks**: 38
- **Setup**: 2
- **Foundational**: 5
- **User Story 1**: 9
- **User Story 2**: 11
- **User Story 3**: 7
- **Polish**: 4
- **Parallel tasks**: 15

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the active Spec Kit feature context and review the implementation contract before editing shared bill surfaces.

- [ ] T001 Verify the active branch and feature pointer match `014-bill-document-cleanup` in `.specify/feature.json` and `AGENTS.md`
- [ ] T002 [P] Review the acceptance scope and non-scope boundaries in `specs/014-bill-document-cleanup/contracts/bill-document-cleanup.contract.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared regression fixtures and identify validation/display touchpoints that block all user stories.

**Critical**: No user story implementation should begin until this phase is complete because the same bill data and validation surfaces are shared by documents, popups, and Factur-X generation.

- [ ] T003 Add or extend shared document rendering test helpers for extracting readable bill text in `backend/test/factur-x/routes.test.js`
- [ ] T004 [P] Add fixture coverage for bill mentions, empty mentions, category-bearing items, and valid 14-digit SIRET values in `backend/fixtures/factur-x/bills.fixture.json`
- [ ] T005 [P] Add reusable frontend test setup for dashboard bill modal template assertions in `frontend/src/app/app.spec.ts`
- [ ] T006 [P] Add shared SIRET validation fixture cases for 13-digit, 14-digit, and non-digit values in `backend/test/factur-x/invoice-data.test.js`
- [ ] T007 [P] Audit billing-only category labels and SIRET validation messages for required copy updates in `backend/src/i18n/translations.json`

**Checkpoint**: Shared fixtures and regression scaffolding are ready for story-specific implementation.

---

## Phase 3: User Story 1 - Generate cleaner bill documents (Priority: P1) - MVP

**Goal**: Vendor and client PDF and readable Factur-X bills show bill mentions at the bottom and omit category columns while preserving bill-critical financial details.

**Independent Test**: Generate one vendor bill and one client bill in both PDF and Factur-X formats, then confirm bill mentions appear at the bottom and no category column or category-only line field appears in the readable output.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add vendor and client PDF regression tests for bottom bill mentions and no visible category column in `backend/test/factur-x/routes.test.js`
- [ ] T009 [P] [US1] Add readable Factur-X renderer tests for bottom bill mentions, no visible category field, and retained XML notes in `backend/test/factur-x/invoice-data.test.js`
- [ ] T010 [P] [US1] Add document fixture variants for long multiline bill mentions and empty bill mentions in `backend/fixtures/factur-x/bills.fixture.json`

### Implementation for User Story 1

- [ ] T011 [US1] Update daily PDF generation so bill mentions render after line, VAT, and total sections and category is not rendered in `backend/src/routes/index.js`
- [ ] T012 [US1] Update vendor and client bill PDF route label/options wiring to stop passing billing category labels where no longer used in `backend/src/routes/modules/bills.js`
- [ ] T013 [US1] Update Factur-X line normalization to avoid using item category as a visible description fallback while preserving source category data in `backend/src/services/factur-x/invoice-data.js`
- [ ] T014 [US1] Update readable Factur-X PDF rendering to move `includedNotes` to a bottom notes section and avoid visible category output in `backend/src/services/factur-x/generator.js`
- [ ] T015 [US1] Update or remove obsolete billing document category translation keys and bottom notes labels in `backend/src/i18n/translations.json`
- [ ] T016 [US1] Run targeted document tests from `specs/014-bill-document-cleanup/quickstart.md` using `npm --workspace backend test -- test/factur-x/*.test.js test/bills/*.test.js`

**Checkpoint**: User Story 1 is complete when vendor/client PDF and readable Factur-X outputs satisfy the document presentation contract independently of popup changes.

---

## Phase 4: User Story 2 - Validate SIRET length consistently (Priority: P2)

**Goal**: Every final SIRET/businessRegistrationId validation surface rejects 13-digit or formatted values and accepts valid 14-digit numeric values without changing VAT ID validation.

**Independent Test**: Attempt to save or generate bill data with 13-digit, valid 14-digit, and non-digit SIRET/businessRegistrationId values across backend, frontend, scripts, and Factur-X preflight checks.

### Tests for User Story 2

- [ ] T017 [P] [US2] Add Mongoose user model validation tests for 13-digit rejection and 14-digit acceptance in `backend/test/models/user.model.test.js`
- [ ] T018 [P] [US2] Add account/profile route validation tests that distinguish SIRET from VAT ID behavior in `backend/test/auth/profile-validation.test.js`
- [ ] T019 [P] [US2] Add frontend reactive form validator tests for `businessRegistrationId` and unchanged `vatId` behavior in `frontend/src/app/app.spec.ts`
- [ ] T020 [P] [US2] Add script regression tests proving `completeLuhn` accepts only a 13-digit prefix and outputs a final 14-digit SIRET in `backend/test/scripts/populate-users-from-insee.test.js`

### Implementation for User Story 2

- [ ] T021 [US2] Confirm or update `businessRegistrationId` schema validation to require final 14-digit numeric SIRET values in `backend/src/models/user.model.js`
- [ ] T022 [US2] Update account/profile backend validation so SIRET/businessRegistrationId uses the 14-digit rule and VAT ID keeps its separate rule in `backend/src/routes/modules/auth.js`
- [ ] T023 [US2] Update frontend account/register form validators and user-facing SIRET errors while preserving VAT ID validation in `frontend/src/app/app.ts`
- [ ] T024 [US2] Update business registration typing and form payload expectations for safe 14-digit handling in `frontend/src/app/app.types.ts`
- [ ] T025 [US2] Update seeded and migrated user profile values so final stored businessRegistrationId values are 14 digits in `backend/scripts/seed-users.js` and `backend/scripts/migrate-users-profile-fields.js`
- [ ] T026 [US2] Keep the INSEE prefix helper documented as a prefix-to-final-SIRET generator without treating 13 digits as final validation in `backend/scripts/populate-users-from-insee.js`
- [ ] T027 [US2] Run targeted validation tests from `specs/014-bill-document-cleanup/quickstart.md` using `npm --workspace backend test -- test/factur-x/*.test.js test/scripts/*.test.js`

**Checkpoint**: User Story 2 is complete when 13-digit final SIRET/businessRegistrationId values are rejected everywhere, valid 14-digit numeric values are accepted, and VAT ID behavior is unchanged.

---

## Phase 5: User Story 3 - Simplify bill popups (Priority: P3)

**Goal**: Vendor and client bill detail modal tables omit the category column while preserving item identity, vendor context where needed, VAT, prices, quantities, totals, comments, settlement controls, and document actions.

**Independent Test**: Open a vendor bill popup and a client bill popup, then confirm neither table shows a category column and all bill-critical financial fields remain visible.

### Tests for User Story 3

- [ ] T028 [P] [US3] Add frontend regression assertions that vendor and client bill modal tables exclude category headers and cells in `frontend/src/app/app.spec.ts`
- [ ] T029 [US3] Add regression assertions that non-billing category filters and order catalog category display remain in scope outside bill popups in `frontend/src/app/app.spec.ts`

### Implementation for User Story 3

- [ ] T030 [US3] Remove the category header and category cell from the vendor bill detail modal table in `frontend/src/app/pages/dashboard-page.component.html`
- [ ] T031 [US3] Remove the category header and category cell from the client bill detail modal table while keeping the vendor column in `frontend/src/app/pages/dashboard-page.component.html`
- [ ] T032 [US3] Confirm bill modal state and download actions do not depend on visible category cells in `frontend/src/app/app.ts`
- [ ] T033 [US3] Update any affected modal copy or aria labels for the simplified bill tables in `backend/src/i18n/translations.json`
- [ ] T034 [US3] Run frontend validation from `specs/014-bill-document-cleanup/quickstart.md` using `npm --workspace frontend test -- --watch=false`

**Checkpoint**: User Story 3 is complete when both bill popups satisfy the popup contract and existing PDF/Factur-X actions still work.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Verify the full feature, guard adjacent billing flows, and document any remaining manual acceptance evidence.

- [ ] T035 [P] Verify Rungis marketplace service-fee bill tests still pass if shared Factur-X helpers changed in `backend/test/rungis-bills/invoice-documents.test.js`
- [ ] T036 [P] Verify bill UUID generation still uses five-digit `users.uniqueId` and not SIRET/businessRegistrationId in `backend/test/bills/bill-unique-id.test.js`
- [ ] T037 Run full verification commands from `specs/014-bill-document-cleanup/quickstart.md` using `npm --workspace backend test`, `npm --workspace frontend test -- --watch=false`, and `npm run build`
- [ ] T038 Record manual acceptance results for vendor/client popups and vendor/client PDF/Factur-X readable documents in `specs/014-bill-document-cleanup/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories because fixtures and shared helpers are reused.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; MVP because document output is the highest-priority accounting artifact.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; can proceed in parallel with US1 after shared fixtures are ready, but final Factur-X acceptance should consider US1 document behavior.
- **User Story 3 (Phase 5)**: Depends on Foundational completion; can proceed in parallel with US1 and US2 after frontend test scaffolding is ready.
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational; independent of popup changes.
- **User Story 2 (P2)**: Can start after Foundational; independent of document layout except for shared Factur-X legal party validation.
- **User Story 3 (P3)**: Can start after Foundational; independent of backend document rendering.

### Within Each User Story

- Write or update tests before implementation changes.
- Keep category data available in source objects while removing only scoped billing presentation.
- Preserve existing authorization and download actions when changing routes or templates.
- Run each story's targeted verification before moving to polish.

### Parallel Opportunities

- T002 can run while T001 confirms branch/pointer state.
- T004, T005, T006, and T007 touch independent fixture/test/i18n files and can run in parallel after T003 defines shared expectations.
- T008, T009, and T010 can run in parallel for US1 test coverage.
- T017, T018, T019, and T020 can run in parallel for US2 validation coverage.
- US3 has limited file-level parallelism because both modal and adjacent-scope assertions are in `frontend/src/app/app.spec.ts`; keep T028 and T029 sequenced unless the implementation splits tests across files.
- T035 and T036 can run in parallel during polish because they cover independent regression suites.

---

## Parallel Example: User Story 1

```bash
# Parallel test and fixture work for document cleanup:
Task: "T008 Add vendor and client PDF regression tests in backend/test/factur-x/routes.test.js"
Task: "T009 Add readable Factur-X renderer tests in backend/test/factur-x/invoice-data.test.js"
Task: "T010 Add document fixture variants in backend/fixtures/factur-x/bills.fixture.json"
```

## Parallel Example: User Story 2

```bash
# Parallel validation coverage across backend, frontend, and scripts:
Task: "T017 Add model validation tests in backend/test/models/user.model.test.js"
Task: "T018 Add route validation tests in backend/test/auth/profile-validation.test.js"
Task: "T019 Add frontend validator tests in frontend/src/app/app.spec.ts"
Task: "T020 Add script regression tests in backend/test/scripts/populate-users-from-insee.test.js"
```

## Sequenced Example: User Story 3

```bash
# Popup verification and adjacent-scope guardrails share frontend/src/app/app.spec.ts, so run them sequentially:
Task: "T028 Add bill modal no-category assertions in frontend/src/app/app.spec.ts"
Task: "T029 Add non-billing category preservation assertions in frontend/src/app/app.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 shared fixtures and regression scaffolding.
3. Complete Phase 3 document cleanup.
4. Stop and validate vendor/client PDF and Factur-X readable output independently.
5. Demo or review the generated bill documents before changing lower-priority validation and popup tasks if needed.

### Incremental Delivery

1. Deliver US1 to clean generated accounting documents.
2. Deliver US2 to enforce correct legal identity validation.
3. Deliver US3 to align bill popup presentation with generated documents.
4. Run polish checks and full quickstart verification.

### Parallel Team Strategy

With multiple workers:

1. One worker prepares backend document fixtures/tests while another prepares frontend modal assertions.
2. After foundational tasks, backend document rendering, SIRET validation, and frontend popup cleanup can proceed in parallel.
3. Integrate through the full quickstart verification commands and manual acceptance checks.

---

## Notes

- Do not remove category fields from catalog, stock, order, search, statistics, validated order, or bill item source data.
- Do not change VAT ID's distinct 13-character rule unless a separate approved requirement changes it.
- Preserve the `completeLuhn` 13-digit prefix helper only as a generator of final 14-digit SIRET values.
- Keep structured Factur-X XML and readable PDF output consistent for bill mentions and legal party identity.
- Commit only after successful targeted and full verification if following the optional Spec Kit git hook workflow.
