# Tasks: Vendor Client Relationships

**Input**: Design documents from `/specs/003-vendor-client-relationships/`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Review association scope in specs/003-vendor-client-relationships/spec.md and specs/003-vendor-client-relationships/plan.md
- [x] T002 [P] Validate contract YAML in specs/003-vendor-client-relationships/contracts/vendor-client-relationships.openapi.yml
- [x] T003 Review admin and client relationship UI surfaces in frontend/src/app/pages/admin-page.component.html and frontend/src/app/app.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Verify role guards and id validation helpers in backend/src/routes/index.js
- [x] T005 Verify relationship fields in backend/src/models/user.model.js
- [x] T006 Verify association view models in frontend/src/app/app.types.ts

---

## Phase 3: User Story 1 - Manage associations as admin (Priority: P1)

- [x] T007 [US1] Verify admin association list and assign endpoints in backend/src/routes/modules/management.js
- [x] T008 [US1] Verify admin association UI behavior in frontend/src/app/pages/admin-page.component.html and frontend/src/app/app.ts

---

## Phase 4: User Story 2 - Remove obsolete associations (Priority: P2)

- [x] T009 [US2] Verify symmetric removal endpoints in backend/src/routes/modules/management.js
- [x] T010 [US2] Verify removal feedback and disabled states in frontend/src/app/pages/admin-page.component.html

---

## Phase 5: User Story 3 - Let clients discover vendors (Priority: P3)

- [x] T011 [US3] Verify client vendor discovery endpoints in backend/src/routes/modules/management.js
- [x] T012 [US3] Verify client discovery workflow in frontend/src/app/app.ts

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T013 Check generated docs for unresolved placeholders in specs/003-vendor-client-relationships/spec.md, specs/003-vendor-client-relationships/plan.md, specs/003-vendor-client-relationships/research.md, specs/003-vendor-client-relationships/data-model.md, and specs/003-vendor-client-relationships/quickstart.md

---

## Dependencies & Execution Order

Setup and foundational tasks precede user-story checks. User stories can be verified independently once shared guards, types, and data surfaces are in place.

---

## Implementation Evidence

- 2026-06-19: `npm run build` passed Angular production build (verified 2026-06-19T02:15Z).
- 2026-06-19: `npm --workspace frontend test -- --watch=false` passed 10/10 frontend tests (verified 2026-06-19T02:16Z).
- 2026-06-19: Source files listed in the Time Machine queue were inspected and matched to generated spec, plan, contract, data model, and task artifacts.
- 2026-06-19: All 13 tasks in this retrospective task list were marked complete after verification.
