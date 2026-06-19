# Tasks: Admin User Management

**Input**: Design documents from `/specs/002-admin-user-management/`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Review admin management scope in specs/002-admin-user-management/spec.md and specs/002-admin-user-management/plan.md
- [x] T002 [P] Validate contract YAML in specs/002-admin-user-management/contracts/admin-user-management.openapi.yml
- [x] T003 [P] Review admin UI shell in frontend/src/app/pages/admin-page.component.ts and frontend/src/app/pages/admin-page.component.html

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Verify admin-only route guards in backend/src/routes/modules/pages.js and backend/src/routes/index.js
- [x] T005 Verify pending-user and setting storage surfaces in backend/src/models/user.model.js and backend/src/lib/app-settings-store.js
- [x] T006 Verify App admin state and types in frontend/src/app/app.ts and frontend/src/app/app.types.ts

---

## Phase 3: User Story 1 - Review and activate pending users (Priority: P1) 🎯 MVP

- [x] T007 [US1] Verify pending-user list and activation endpoints in backend/src/routes/modules/management.js
- [x] T008 [US1] Verify pending-user list and activation UI behavior in frontend/src/app/app.ts and frontend/src/app/pages/admin-page.component.html
- [x] T009 [US1] Run admin role functional coverage in e2e/role-access.functional.spec.js using package.json

---

## Phase 4: User Story 2 - Remove invalid pending users (Priority: P2)

- [x] T010 [US2] Verify inactive-only pending-user deletion endpoint in backend/src/routes/modules/management.js
- [x] T011 [US2] Verify pending-user deletion UI behavior in frontend/src/app/app.ts and frontend/src/app/pages/admin-page.component.html

---

## Phase 5: User Story 3 - Configure core admin settings (Priority: P3)

- [x] T012 [US3] Verify overdue-days, style-profile, and manual billing endpoints in backend/src/routes/modules/management.js
- [x] T013 [US3] Verify overdue-days, style-profile, and manual billing UI behavior in frontend/src/app/app.ts and frontend/src/app/pages/admin-page.component.html
- [x] T014 [US3] Run build and backend regression commands from specs/002-admin-user-management/quickstart.md using package.json and backend/package.json

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T015 [P] Check generated docs for unresolved placeholders in specs/002-admin-user-management/spec.md, specs/002-admin-user-management/plan.md, specs/002-admin-user-management/research.md, specs/002-admin-user-management/data-model.md, and specs/002-admin-user-management/quickstart.md

---

## Dependencies & Execution Order

T001 before all phases; T004-T006 before user stories; US1 before US2; US3 can run after foundational checks.


---

## Implementation Evidence

- 2026-06-19: `python3 /Volumes/WDBlack4TB/.hermes/skills/local/speckit-tasks/scripts/validate_tasks.py /Volumes/WDBlack4TB/Code/rungis/specs/002-admin-user-management/tasks.md` passed; 15 tasks, 3 parallel opportunities.
- 2026-06-19: `specs/002-admin-user-management/contracts/admin-user-management.openapi.yml` parsed successfully as YAML with 6 paths.
- 2026-06-19: Planning artifacts were checked for unresolved placeholders; none were found.
- 2026-06-19: `npm --workspace backend test` passed 9/9 backend tests.
- 2026-06-19: `npm run build` passed Angular production build and emitted assets to `backend/src/public/angular`.
- 2026-06-19: `npm run test:functional -- e2e/role-access.functional.spec.js e2e/auth.functional.spec.js` passed 16/16 Playwright tests across desktop Chrome and mobile Chrome.
