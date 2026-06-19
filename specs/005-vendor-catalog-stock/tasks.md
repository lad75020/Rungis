# Tasks: Vendor Catalog and Stock

**Input**: Design documents from `/specs/005-vendor-catalog-stock/`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Review catalog scope in specs/005-vendor-catalog-stock/spec.md and specs/005-vendor-catalog-stock/plan.md
- [x] T002 [P] Review websocket stock contract in specs/005-vendor-catalog-stock/contracts/vendor-catalog-stock.websocket.md
- [x] T003 Review stock page component files in frontend/src/app/pages/stocks-page.component.ts and frontend/src/app/pages/stocks-page.component.html

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Verify merchandise schema and indexes in backend/src/models/merchandise.model.js
- [x] T005 Verify vendor guards and upload support in backend/src/routes/modules/auth.js
- [x] T006 Verify catalog/stock frontend types in frontend/src/app/app.types.ts

---

## Phase 3: User Story 1 - Maintain merchandise records (Priority: P1)

- [x] T007 [US1] Verify stocks:list, stocks:create, and stocks:update actions in backend/src/routes/modules/websocket.js
- [x] T008 [US1] Verify create and edit flows in frontend/src/app/app.ts and frontend/src/app/pages/stocks-page.component.html

---

## Phase 4: User Story 2 - Remove unavailable merchandise (Priority: P2)

- [x] T009 [US2] Verify stocks:delete ownership checks and broadcasts in backend/src/routes/modules/websocket.js
- [x] T010 [US2] Verify delete UI behavior in frontend/src/app/pages/stocks-page.component.html

---

## Phase 5: User Story 3 - Attach product images and stock alerts (Priority: P3)

- [x] T011 [US3] Verify item-image upload route in backend/src/routes/modules/auth.js
- [x] T012 [US3] Verify minimum stock and image rendering in frontend/src/app/app.ts and frontend/src/app/pages/stocks-page.component.html

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T013 Check generated docs for unresolved placeholders in specs/005-vendor-catalog-stock/spec.md, specs/005-vendor-catalog-stock/plan.md, specs/005-vendor-catalog-stock/research.md, specs/005-vendor-catalog-stock/data-model.md, and specs/005-vendor-catalog-stock/quickstart.md

---

## Dependencies & Execution Order

Setup and foundational tasks precede user-story checks. User stories can be verified independently once shared guards, types, and data surfaces are in place.

---

## Implementation Evidence

- 2026-06-19: `npm run build` passed Angular production build (verified 2026-06-19T02:15Z).
- 2026-06-19: `npm --workspace frontend test -- --watch=false` passed 10/10 frontend tests (verified 2026-06-19T02:16Z).
- 2026-06-19: Source files listed in the Time Machine queue were inspected and matched to generated spec, plan, contract, data model, and task artifacts.
- 2026-06-19: All 13 tasks in this retrospective task list were marked complete after verification.
