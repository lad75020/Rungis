# Tasks: Billing Settlement and PDF Export

**Input**: Design documents from `/specs/007-billing-settlement-pdf-export/`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Review billing scope in specs/007-billing-settlement-pdf-export/spec.md and specs/007-billing-settlement-pdf-export/plan.md
- [x] T002 [P] Validate contract YAML in specs/007-billing-settlement-pdf-export/contracts/billing-settlement-pdf.openapi.yml
- [x] T003 Review dashboard page component files in frontend/src/app/pages/dashboard-page.component.ts and frontend/src/app/pages/dashboard-page.component.html

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Verify bill schema and line fields in backend/src/models/bill.model.js
- [x] T005 Verify bill helper functions in backend/src/routes/index.js
- [x] T006 Verify dashboard frontend types in frontend/src/app/app.types.ts

---

## Phase 3: User Story 1 - Generate daily bills (Priority: P1)

- [x] T007 [US1] Verify daily generation endpoint and helper call in backend/src/routes/modules/management.js
- [x] T008 [US1] Verify bill generation grouping and refund inclusion in backend/src/routes/index.js

---

## Phase 4: User Story 2 - Settle and comment on bills (Priority: P2)

- [x] T009 [US2] Verify vendor/client settlement and comment websocket actions in backend/src/routes/modules/websocket.js
- [x] T010 [US2] Verify dashboard settlement and message UI behavior in frontend/src/app/app.ts and frontend/src/app/pages/dashboard-page.component.html

---

## Phase 5: User Story 3 - Export bill PDFs (Priority: P3)

- [x] T011 [US3] Verify PDF routes in backend/src/routes/modules/bills.js
- [x] T012 [US3] Verify PDF link behavior in frontend/src/app/pages/dashboard-page.component.html

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T013 Check generated docs for unresolved placeholders in specs/007-billing-settlement-pdf-export/spec.md, specs/007-billing-settlement-pdf-export/plan.md, specs/007-billing-settlement-pdf-export/research.md, specs/007-billing-settlement-pdf-export/data-model.md, and specs/007-billing-settlement-pdf-export/quickstart.md

---

## Dependencies & Execution Order

Setup and foundational tasks precede user-story checks. User stories can be verified independently once shared guards, types, and data surfaces are in place.

---

## Implementation Evidence

- 2026-06-19: `npm run build` passed Angular production build (verified 2026-06-19T02:15Z).
- 2026-06-19: `npm --workspace frontend test -- --watch=false` passed 10/10 frontend tests (verified 2026-06-19T02:16Z).
- 2026-06-19: Source files listed in the Time Machine queue were inspected and matched to generated spec, plan, contract, data model, and task artifacts.
- 2026-06-19: All 13 tasks in this retrospective task list were marked complete after verification.
