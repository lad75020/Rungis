# Tasks: Dedicated Bill Pages

**Input**: Design documents from `/specs/015-bill-pages/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-pages.openapi.yaml, contracts/bill-pages-websocket.yaml, quickstart.md

**Tests**: Included because the implementation plan requires backend `node:test`, Angular/Vitest coverage, build verification, and manual role-flow checks for a role-guarded billing workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing after shared foundations are complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because the task touches different files or test fixtures and does not depend on another incomplete task in the same phase.
- **[Story]**: Maps task to the user story from `specs/015-bill-pages/spec.md`.
- Each task names exact repository file paths.

## Path Conventions

- Backend source: `backend/src/`
- Backend tests and fixtures: `backend/test/`
- Frontend source and tests: `frontend/src/app/`
- Feature artifacts: `specs/015-bill-pages/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared fixtures, test entry points, and localized labels before role-specific implementation.

- [ ] T001 Create reusable bill-page backend test fixtures in backend/test/fixtures/bill-pages.fixture.js for client/vendor users, bills, paid/unpaid/late cases, received/not-received cases, and counterparty names.
- [x] T002 [P] Add initial dedicated bill page translation keys in backend/src/i18n/translations.json for page titles, dashboard entry buttons, filters, empty states, status icons, checkboxes, and update messages.
- [x] T003 [P] Record any implementation-specific fixture or local data assumptions in specs/015-bill-pages/quickstart.md without adding secrets from backend/.env.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add page routing, shared contracts, list mapping, and frontend state scaffolding required by all user stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Extend page-name and bill-page filter/list row TypeScript types in frontend/src/app/app.types.ts for `client-bills`, `vendor-bills`, `ClientBillListRow`, `VendorBillListRow`, and their filter states.
- [x] T005 Register dedicated bill pages in frontend/src/app/app.constants.ts and frontend/src/app/app.routes.ts so Angular can activate `client-bills` and `vendor-bills` page wrappers.
- [x] T006 [P] Add role-guarded Fastify page routes for `/client-bills` and `/vendor-bills` in backend/src/routes/modules/pages.js following existing `requireClientPage` and `requireVendorPage` patterns.
- [x] T007 [P] Create Angular shell EJS views in backend/src/views/client-bills.ejs and backend/src/views/vendor-bills.ejs matching existing role page shells.
- [x] T008 Implement shared date-range parsing, counterparty lookup, VAT-inclusive amount selection, and status mapping helpers in backend/src/routes/modules/websocket.js for bill page list actions.
- [x] T009 Add server-side paid/received update helper reuse in backend/src/routes/modules/websocket.js so bill page status actions update only `vendorSettled` or `clientSettled` for the connected role.
- [x] T010 Add dedicated client/vendor bill page signals, filter defaults, loading flags, and derived label helpers in frontend/src/app/app.ts without removing existing modal state.
- [x] T011 [P] Add scrollable 10-row bill list, status icon, and icon-checkbox styling in frontend/src/app/app.css for the dedicated bill pages.
- [x] T012 Add route/page-shell regression coverage in backend/test/websocket/page-registration.test.js for `/client-bills`, `/vendor-bills`, and role mismatch behavior.

**Checkpoint**: Dedicated bill page shells, shared row/status mapping, and frontend state scaffolding are ready for user story implementation.

---

## Phase 3: User Story 1 - Client reviews and manages bills (Priority: P1) MVP

**Goal**: A connected client can open a dedicated bill page, view all accessible bills with vendor/payment/amount details, filter them, mark received status, and open the existing client bill modal.

**Independent Test**: Sign in as a client, open `/client-bills` from the dashboard, verify a 10-visible-row scroll list, apply date/vendor/payment filters, toggle a received checkbox, and open the existing client bill modal from a row click.

### Tests for User Story 1

- [ ] T013 [P] [US1] Add backend client bill page WebSocket tests in backend/test/websocket/bill-pages-client.test.js for `bill-pages:client:list`, vendor/date/payment filters, paid/unpaid/late status mapping, and role/ownership rejection.
- [ ] T014 [P] [US1] Add frontend client bill page tests in frontend/src/app/app.spec.ts for row rendering, 10-row scroll container, filter payloads, status icons, received checkbox propagation, and modal opening.

### Implementation for User Story 1

- [x] T015 [US1] Implement `bill-pages:client:list` in backend/src/routes/modules/websocket.js using connected-client scoping, inclusive date range filtering, vendor filtering, payment status filtering, and VAT-inclusive row amounts.
- [x] T016 [US1] Implement `bill-pages:client:set-received` in backend/src/routes/modules/websocket.js so only the connected client's `clientSettled` state changes and the response returns updated settlement data.
- [x] T017 [US1] Wire client bill list loading, filter setters, received status updates, and optimistic/error-safe state reconciliation in frontend/src/app/app.ts.
- [x] T018 [US1] Create the client bill page wrapper and template in frontend/src/app/pages/client-bills-page.component.ts and frontend/src/app/pages/client-bills-page.component.html.
- [x] T019 [US1] Add the client dashboard entry point to `/client-bills` in frontend/src/app/pages/dashboard-page.component.html while preserving non-bill client dashboard sections.
- [x] T020 [US1] Connect client bill row clicks to existing `openClientCartDetails` modal flow and stop checkbox click propagation in frontend/src/app/pages/client-bills-page.component.html.
- [x] T021 [US1] Finalize client bill page localized labels and alerts in backend/src/i18n/translations.json for vendor filter, payment status options, paid/unpaid/late icons, received checkbox, and update outcomes.
- [ ] T022 [US1] Run the client manual and automated verification steps from specs/015-bill-pages/quickstart.md against backend/test/websocket/bill-pages-client.test.js and frontend/src/app/app.spec.ts.

**Checkpoint**: User Story 1 is independently functional and can ship as the MVP client bill page.

---

## Phase 4: User Story 2 - Vendor reviews and manages bills (Priority: P2)

**Goal**: A connected vendor can open a dedicated bill page, view all issued bills with client/reception/amount details, filter them, mark paid status, and open the existing vendor bill modal.

**Independent Test**: Sign in as a vendor, open `/vendor-bills` from the dashboard, verify a 10-visible-row scroll list, apply date/client/reception filters, toggle a paid checkbox, and open the existing vendor bill modal from a row click.

### Tests for User Story 2

- [ ] T023 [P] [US2] Add backend vendor bill page WebSocket tests in backend/test/websocket/bill-pages-vendor.test.js for `bill-pages:vendor:list`, client/date/reception filters, received/not-received status mapping, paid updates, and role/ownership rejection.
- [ ] T024 [P] [US2] Add frontend vendor bill page tests in frontend/src/app/app.spec.ts for row rendering, 10-row scroll container, filter payloads, reception icons, paid checkbox propagation, and modal opening.

### Implementation for User Story 2

- [x] T025 [US2] Implement `bill-pages:vendor:list` in backend/src/routes/modules/websocket.js using connected-vendor scoping, inclusive date range filtering, client filtering, reception status filtering, and VAT-inclusive row amounts.
- [x] T026 [US2] Implement `bill-pages:vendor:set-paid` in backend/src/routes/modules/websocket.js so only the connected vendor's `vendorSettled` state changes and the response returns updated settlement data.
- [x] T027 [US2] Wire vendor bill list loading, filter setters, paid status updates, and optimistic/error-safe state reconciliation in frontend/src/app/app.ts.
- [x] T028 [US2] Create the vendor bill page wrapper and template in frontend/src/app/pages/vendor-bills-page.component.ts and frontend/src/app/pages/vendor-bills-page.component.html.
- [x] T029 [US2] Add the vendor dashboard entry point to `/vendor-bills` in frontend/src/app/pages/dashboard-page.component.html while preserving non-bill vendor dashboard sections.
- [x] T030 [US2] Connect vendor bill row clicks to existing `openVendorOrderDetails` modal flow and stop checkbox click propagation in frontend/src/app/pages/vendor-bills-page.component.html.
- [x] T031 [US2] Finalize vendor bill page localized labels and alerts in backend/src/i18n/translations.json for client filter, reception status options, received/not-received icons, paid checkbox, and update outcomes.
- [ ] T032 [US2] Run the vendor manual and automated verification steps from specs/015-bill-pages/quickstart.md against backend/test/websocket/bill-pages-vendor.test.js and frontend/src/app/app.spec.ts.

**Checkpoint**: User Story 2 is independently functional and completes the vendor bill page workflow.

---

## Phase 5: User Story 3 - Dashboards stay focused (Priority: P3)

**Goal**: Client and vendor dashboards no longer embed full bill sections; they expose only clear navigation to the dedicated bill pages while preserving unrelated dashboard content.

**Independent Test**: Open the client and vendor dashboards and confirm the old embedded bills sections are absent, dedicated bill page entry points remain visible, and unrelated dashboard content still renders.

### Tests for User Story 3

- [x] T033 [P] [US3] Add dashboard focus regression tests in frontend/src/app/app.spec.ts confirming old client/vendor bill panels are absent and `/client-bills` plus `/vendor-bills` entry points remain visible.
- [x] T034 [P] [US3] Add backend page access tests in backend/test/websocket/page-registration.test.js confirming dashboard users can navigate to the correct dedicated bill page route for their role.

### Implementation for User Story 3

- [x] T035 [US3] Remove the embedded vendor bills management section from frontend/src/app/pages/dashboard-page.component.html while preserving vendor statistics, monthly summary, overdue bills, refunds, and client messages links/sections.
- [x] T036 [US3] Remove the embedded client bills management section from frontend/src/app/pages/dashboard-page.component.html while preserving order, find-vendors, unpaid reminders, and Rungis invoice sections.
- [x] T037 [US3] Remove or stop dashboard-triggered loading of old embedded bill list data in frontend/src/app/app.ts so `/dashboard` no longer calls the obsolete dashboard bill list loaders for client or vendor sections.
- [x] T038 [US3] Keep existing client and vendor bill detail modal templates in frontend/src/app/pages/dashboard-page.component.html accessible to the new dedicated page wrappers or move them only if required by the implemented component structure.
- [ ] T039 [US3] Clean up obsolete dashboard-only bill labels in backend/src/i18n/translations.json only after confirming no existing modal, Rungis invoice, or reminder label still uses them.
- [ ] T040 [US3] Run the dashboard acceptance checks from specs/015-bill-pages/quickstart.md for both roles and record any final manual notes in specs/015-bill-pages/quickstart.md.

**Checkpoint**: User Story 3 completes the dashboard information-architecture change without removing unrelated dashboard capabilities.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full verification, documentation alignment, and release readiness across all stories.

- [x] T041 [P] Update specs/015-bill-pages/quickstart.md with any final commands, fixture names, browser paths, or manual role-flow findings discovered during implementation.
- [x] T042 Run the backend test suite using backend/package.json with `npm --workspace backend test` and record any failing bill-page cases in specs/015-bill-pages/quickstart.md.
- [x] T043 Run the frontend test suite using frontend/package.json with `npm --workspace frontend test -- --watch=false` and record any failing bill-page cases in specs/015-bill-pages/quickstart.md.
- [x] T044 Run the production build using package.json with `npm run build` and confirm generated Angular assets still target backend/src/public/angular.
- [ ] T045 Perform full manual acceptance checks from specs/015-bill-pages/quickstart.md for client bill page, vendor bill page, dashboard navigation, filters, status toggles, and existing modals.
- [x] T046 Review final source diff against specs/015-bill-pages/plan.md to confirm no new persistent collection was added, VAT-inclusive totals are used, and role-scoped access checks remain server-side.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T002 and T003 can run in parallel after T001 fixture needs are understood.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2; delivers the MVP client bill page.
- **User Story 2 (Phase 4)**: Depends on Phase 2; can be implemented after or alongside US1 but shares WebSocket and App state files.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and should be reconciled after the US1/US2 dashboard entry links are present.
- **Polish (Phase 6)**: Depends on the selected user stories being complete.

### User Story Dependencies

- **US1 Client reviews and manages bills**: Start after Foundation; no dependency on US2 and only requires its client dashboard entry point for discoverability.
- **US2 Vendor reviews and manages bills**: Start after Foundation; no dependency on US1 and only requires its vendor dashboard entry point for discoverability.
- **US3 Dashboards stay focused**: Start after Foundation, preferably after US1 and US2 link tasks so it can remove embedded sections while preserving dedicated page navigation.

### Within Each User Story

- Write story tests before implementation and confirm they fail for missing behavior.
- Complete backend list/status actions before wiring frontend state.
- Complete frontend state before page templates that bind to it.
- Complete page templates before manual role-flow verification.
- Validate the story independently before moving to the next priority checkpoint.

### Summary Counts

- Total tasks: 46
- Setup tasks: 3
- Foundational tasks: 9
- US1 tasks: 10
- US2 tasks: 10
- US3 tasks: 8
- Polish tasks: 6
- Parallel-marked tasks: 12

---

## Parallel Opportunities

- Setup tasks T002 and T003 can run in parallel with fixture preparation once translation and documentation needs are clear.
- Foundational page-route and view tasks T006 and T007 can run in parallel because they touch backend route and view files separately.
- Foundational styling task T011 can run in parallel with backend mapping tasks T008 and T009.
- US1 tests T013 and T014 can run in parallel before client implementation begins.
- US2 tests T023 and T024 can run in parallel before vendor implementation begins.
- US3 tests T033 and T034 can run in parallel because they target frontend dashboard rendering and backend page access separately.
- US1 and US2 can be implemented by different developers after Phase 2, with coordination around backend/src/routes/modules/websocket.js, frontend/src/app/app.ts, frontend/src/app/app.spec.ts, and backend/src/i18n/translations.json.

## Parallel Example: User Story 1

```bash
Task: "T013 [P] [US1] Add backend client bill page WebSocket tests in backend/test/websocket/bill-pages-client.test.js"
Task: "T014 [P] [US1] Add frontend client bill page tests in frontend/src/app/app.spec.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T023 [P] [US2] Add backend vendor bill page WebSocket tests in backend/test/websocket/bill-pages-vendor.test.js"
Task: "T024 [P] [US2] Add frontend vendor bill page tests in frontend/src/app/app.spec.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T033 [P] [US3] Add dashboard focus regression tests in frontend/src/app/app.spec.ts"
Task: "T034 [P] [US3] Add backend page access tests in backend/test/websocket/page-registration.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 shared setup.
2. Complete Phase 2 page shells, route registration, shared list mapping, and frontend state scaffolding.
3. Complete Phase 3 client bill page tests and implementation.
4. Validate US1 independently with backend client WebSocket tests, frontend client page tests, and the client manual flow in quickstart.md.
5. Demo the client bill page before moving to vendor symmetry or dashboard cleanup.

### Incremental Delivery

1. Setup and Foundation establish dedicated bill page infrastructure.
2. US1 ships the client bill page MVP.
3. US2 ships the vendor bill page workflow.
4. US3 removes embedded dashboard bill sections while preserving navigation and unrelated dashboard content.
5. Polish runs full backend/frontend/build checks and manual acceptance.

### Parallel Team Strategy

1. Team completes Phase 1 and Phase 2 together.
2. Developer A implements US1 client bill list and received status workflow.
3. Developer B implements US2 vendor bill list and paid status workflow.
4. Developer C implements US3 dashboard cleanup after entry links are available.
5. Coordinate shared files backend/src/routes/modules/websocket.js, frontend/src/app/app.ts, frontend/src/app/app.spec.ts, frontend/src/app/pages/dashboard-page.component.html, backend/src/i18n/translations.json, and frontend/src/app/app.css before final integration.

---

## Notes

- Do not add a new persistent bill status collection; reuse `Bill.vendorSettled` and `Bill.clientSettled`.
- Use `totalPriceIncludingVat` as the primary visible row amount and only fall back defensively for legacy rows.
- Derive client late payment status from the existing overdue rule rather than storing a manual late flag.
- Checkbox clicks must not bubble into row-click modal opening.
- Backend role and organization ownership checks are authoritative; frontend role checks are only UX.
- Preserve existing client and vendor bill detail modal behavior, PDF, and Factur-X actions.
- Verify tests fail before implementing each story where new tests are introduced.
- Commit after each completed phase or logical group if using the optional git extension hook.
