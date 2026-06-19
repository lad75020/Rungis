# Tasks: Client Ordering and Cart

**Input**: Design documents from `/specs/006-client-ordering-cart/`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Review ordering scope in specs/006-client-ordering-cart/spec.md and specs/006-client-ordering-cart/plan.md
- [x] T002 [P] Review websocket order contract in specs/006-client-ordering-cart/contracts/client-ordering-cart.websocket.md
- [x] T003 Review order page component files in frontend/src/app/pages/order-page.component.ts and frontend/src/app/pages/order-page.component.html

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Verify cart and validated-order schemas in backend/src/models/cart.model.js and backend/src/models/validated-order.model.js
- [x] T005 Verify Redis cart helpers in backend/src/routes/index.js
- [x] T006 Verify order frontend types in frontend/src/app/app.types.ts

---

## Phase 3: User Story 1 - Browse assigned-vendor catalog (Priority: P1)

- [x] T007 [US1] Verify order:catalog assigned-vendor filtering in backend/src/routes/modules/websocket.js
- [x] T008 [US1] Verify catalog rendering and empty states in frontend/src/app/pages/order-page.component.html

---

## Phase 4: User Story 2 - Manage favorites and cart (Priority: P2)

- [x] T009 [US2] Verify favorites and cart mutation actions in backend/src/routes/modules/websocket.js
- [x] T010 [US2] Verify cart and favorite UI behavior in frontend/src/app/app.ts and frontend/src/app/pages/order-page.component.html

---

## Phase 5: User Story 3 - Validate cart into order (Priority: P3)

- [x] T011 [US3] Verify order:cart:validate stock checks and persistence in backend/src/routes/modules/websocket.js
- [x] T012 [US3] Verify validation feedback and cart clearing in frontend/src/app/app.ts
- [x] T013 [US3] Review workflow coverage in e2e/workflows-ux.functional.spec.js

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T014 Check generated docs for unresolved placeholders in specs/006-client-ordering-cart/spec.md, specs/006-client-ordering-cart/plan.md, specs/006-client-ordering-cart/research.md, specs/006-client-ordering-cart/data-model.md, and specs/006-client-ordering-cart/quickstart.md

---

## Dependencies & Execution Order

Setup and foundational tasks precede user-story checks. User stories can be verified independently once shared guards, types, and data surfaces are in place.

---

## Implementation Evidence

- 2026-06-19: `npm run build` passed Angular production build (verified 2026-06-19T02:15Z).
- 2026-06-19: `npm --workspace frontend test -- --watch=false` passed 10/10 frontend tests (verified 2026-06-19T02:16Z).
- 2026-06-19: Source files listed in the Time Machine queue were inspected and matched to generated spec, plan, contract, data model, and task artifacts.
- 2026-06-19: All 14 tasks in this retrospective task list were marked complete after verification.
