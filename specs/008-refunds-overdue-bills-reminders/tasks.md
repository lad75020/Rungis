# Tasks: Refunds Overdue Bills and Reminders

**Input**: Design documents from `/specs/008-refunds-overdue-bills-reminders/`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Review refunds and overdue scope in specs/008-refunds-overdue-bills-reminders/spec.md and specs/008-refunds-overdue-bills-reminders/plan.md
- [x] T002 [P] Validate contract YAML in specs/008-refunds-overdue-bills-reminders/contracts/refunds-overdue-reminders.openapi.yml
- [x] T003 Review dashboard UI files in frontend/src/app/pages/dashboard-page.component.ts and frontend/src/app/pages/dashboard-page.component.html

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Verify refund and bill schemas in backend/src/models/refund.model.js and backend/src/models/bill.model.js
- [x] T005 Verify overdue threshold setting access in backend/src/routes/modules/management.js
- [x] T006 Verify reminder helper functions in backend/src/routes/index.js

---

## Phase 3: User Story 1 - Queue refunds for clients (Priority: P1)

- [x] T007 [US1] Verify refund clients and create endpoints in backend/src/routes/modules/refunds.js
- [x] T008 [US1] Verify refund form behavior in frontend/src/app/app.ts

---

## Phase 4: User Story 2 - Manage overdue bills and penalties (Priority: P2)

- [x] T009 [US2] Verify overdue bill and penalty endpoints in backend/src/routes/modules/management.js
- [x] T010 [US2] Verify overdue and penalty UI behavior in frontend/src/app/pages/dashboard-page.component.html

---

## Phase 5: User Story 3 - Send payment reminders (Priority: P3)

- [x] T011 [US3] Verify reminder endpoints and broadcasts in backend/src/routes/modules/management.js
- [x] T012 [US3] Verify client reminder handling in backend/src/routes/modules/websocket.js and frontend/src/app/app.ts

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T013 Check generated docs for unresolved placeholders in specs/008-refunds-overdue-bills-reminders/spec.md, specs/008-refunds-overdue-bills-reminders/plan.md, specs/008-refunds-overdue-bills-reminders/research.md, specs/008-refunds-overdue-bills-reminders/data-model.md, and specs/008-refunds-overdue-bills-reminders/quickstart.md

---

## Dependencies & Execution Order

Setup and foundational tasks precede user-story checks. User stories can be verified independently once shared guards, types, and data surfaces are in place.

---

## Implementation Evidence

- 2026-06-19: `npm run build` passed Angular production build (verified 2026-06-19T02:15Z).
- 2026-06-19: `npm --workspace frontend test -- --watch=false` passed 10/10 frontend tests (verified 2026-06-19T02:16Z).
- 2026-06-19: Source files listed in the Time Machine queue were inspected and matched to generated spec, plan, contract, data model, and task artifacts.
- 2026-06-19: All 13 tasks in this retrospective task list were marked complete after verification.
