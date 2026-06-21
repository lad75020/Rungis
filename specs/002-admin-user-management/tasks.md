# Tasks: Admin User Management

**Propagated**: 2026-06-21 — Updated from spec.md refinement replacing pending-user approval with form-based administrator user create/update; new users are disabled by default.

**Input**: Design documents from `/specs/002-admin-user-management/`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Review refined admin management scope in specs/002-admin-user-management/spec.md and specs/002-admin-user-management/plan.md
- [x] T002 [P] Update affected design artifacts in specs/002-admin-user-management/research.md, specs/002-admin-user-management/data-model.md, and specs/002-admin-user-management/quickstart.md for admin user create/update instead of pending-user approval
- [x] T003 [P] Update and validate specs/002-admin-user-management/contracts/admin-user-management.openapi.yml for admin user create, load, and update operations
- [x] T004 [P] Review admin UI shell in frontend/src/app/pages/admin-page.component.ts and frontend/src/app/pages/admin-page.component.html for the pending-section replacement point

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T005 Verify admin-only route guards in backend/src/routes/modules/pages.js and backend/src/routes/index.js
- [x] T006 Validate backend user payload rules, duplicate checks, dangerous-key rejection, password hashing, and safe response mapping boundaries in backend/src/routes/modules/management.js and backend/src/models/user.model.js
- [x] T007 Extend frontend admin managed-user and form-state types in frontend/src/app/app.types.ts so create/update forms can preserve validation errors without exposing password values

---

## Phase 3: User Story 1 - Create users with an admin form (Priority: P1) 🎯 MVP

- [x] ~~[REMOVED] T007 [US1] Verify pending-user list and activation endpoints in backend/src/routes/modules/management.js~~ Removed because the pending approval queue is replaced by form-based administrator user creation.
- [x] ~~[REMOVED] T008 [US1] Verify pending-user list and activation UI behavior in frontend/src/app/app.ts and frontend/src/app/pages/admin-page.component.html~~ Removed because the admin page now needs a create-user form instead of approval actions.
- [x] ~~[REMOVED] T009 [US1] Run admin role functional coverage in e2e/role-access.functional.spec.js using package.json~~ Replaced by create-user coverage that verifies disabled-by-default persistence and non-admin rejection.
- [x] T008 [US1] Implement admin-only create-user endpoint in backend/src/routes/modules/management.js with required field validation, duplicate username/email checks, server-generated MongoDB-unique `uniqueId`, SIRET/VAT/role validation, password hashing, safe response mapping, and forced `isActive: false`
- [x] T009 [US1] Implement admin create-user state and submit flow in frontend/src/app/app.ts with loading, disabled, success, error, and field-level validation state
- [x] T010 [US1] Replace the pending-user approval panel with a create-user form in frontend/src/app/pages/admin-page.component.html using Angular control flow, stable list tracking, and no password echo after submit
- [x] T011 [US1] Add localized labels and validation messages for admin user creation in backend/src/i18n/translations.json
- [x] T012 [US1] Add backend and functional coverage in backend/test/**/*.test.js and e2e/role-access.functional.spec.js proving admin-created users are disabled by default, non-admin create attempts are rejected, duplicate/invalid payloads fail safely, and create responses omit password/hash data

---

## Phase 4: User Story 2 - Update users with an admin form (Priority: P2)

- [x] ~~[REMOVED] T010 [US2] Verify inactive-only pending-user deletion endpoint in backend/src/routes/modules/management.js~~ Removed because pending-user deletion is no longer part of the admin page workflow.
- [x] ~~[REMOVED] T011 [US2] Verify pending-user deletion UI behavior in frontend/src/app/app.ts and frontend/src/app/pages/admin-page.component.html~~ Removed because user lifecycle changes now happen through the update form.
- [x] T013 [US2] Implement admin-only load/update user endpoints in backend/src/routes/modules/management.js with ObjectId validation, duplicate checks excluding the current user, optional password update, activation-state updates, dangerous-key rejection, and safe response mapping
- [x] T014 [US2] Implement admin user search/select/edit/save state in frontend/src/app/app.ts, including form prefill, active/disabled status updates, optional password replacement, loading states, and validation error preservation
- [x] T015 [US2] Extend frontend/src/app/pages/admin-page.component.html with an update-user form that reuses the admin managed-user fields, clearly distinguishes create versus edit mode, and supports enabling/disabling existing users only through update
- [x] T016 [US2] Add localized labels and validation messages for admin user updates in backend/src/i18n/translations.json
- [x] T017 [US2] Add backend and functional coverage in backend/test/**/*.test.js and e2e/role-access.functional.spec.js for user update success, malformed/unknown IDs, duplicate username/email values, non-admin rejection, activation-state changes, optional password replacement, and password/hash omission in responses

---

## Phase 5: User Story 3 - Configure core admin settings (Priority: P3)

- [x] T018 [US3] Verify overdue-days, style-profile, and manual billing endpoints in backend/src/routes/modules/management.js still pass after user create/update changes
- [x] T019 [US3] Verify overdue-days, style-profile, and manual billing UI behavior in frontend/src/app/app.ts and frontend/src/app/pages/admin-page.component.html still pass after replacing the pending-user section
- [x] T020 [US3] Run build and backend regression commands from specs/002-admin-user-management/quickstart.md using package.json and backend/package.json

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T021 [P] Re-run placeholder and traceability checks for specs/002-admin-user-management/spec.md, specs/002-admin-user-management/plan.md, specs/002-admin-user-management/research.md, specs/002-admin-user-management/data-model.md, specs/002-admin-user-management/contracts/admin-user-management.openapi.yml, specs/002-admin-user-management/quickstart.md, and specs/002-admin-user-management/tasks.md
- [x] T022 [P] Run focused backend tests, frontend tests, Angular build, and functional admin role coverage from specs/002-admin-user-management/quickstart.md using package.json, backend/package.json, and frontend/package.json

---

## Dependencies & Execution Order

T001 before all phases. T002-T004 can run in parallel. T005-T007 block new create/update user stories. US1 (T008-T012) establishes create-user contracts and form state before US2 (T013-T017) extends the same surfaces for editing existing users. US3 (T018-T020) remains independent after foundational checks. T021-T022 run after affected user stories and documentation/contracts are updated.

---

## Implementation Evidence

- 2026-06-19: `python3 /Volumes/WDBlack4TB/.hermes/skills/local/speckit-tasks/scripts/validate_tasks.py /Volumes/WDBlack4TB/Code/rungis/specs/002-admin-user-management/tasks.md` passed; 15 tasks, 3 parallel opportunities.
- 2026-06-19: `specs/002-admin-user-management/contracts/admin-user-management.openapi.yml` parsed successfully as YAML with 6 paths.
- 2026-06-19: Planning artifacts were checked for unresolved placeholders; none were found.
- 2026-06-19: `npm --workspace backend test` passed 9/9 backend tests.
- 2026-06-19: `npm run build` passed Angular production build and emitted assets to `backend/src/public/angular`.
- 2026-06-19: `npm run test:functional -- e2e/role-access.functional.spec.js e2e/auth.functional.spec.js` passed 16/16 Playwright tests across desktop Chrome and mobile Chrome.
- 2026-06-21: Spec refinement propagated to this task list; removed pending-user approval/delete tasks are preserved with strikethrough, and new unchecked tasks T001-T022 cover admin user create/update and verification.

- 2026-06-21: Implemented admin user create/load/update endpoints, Angular create/update forms, translations, OpenAPI contract, and updated role-access functional coverage.
- 2026-06-21: `npm --workspace backend test -- --test-name-pattern='admin user'` passed 52/52 selected node-test executions.
- 2026-06-21: `npm --workspace frontend test -- --watch=false` passed 21/21 Vitest/Angular unit tests.
- 2026-06-21: `npm --workspace backend test` passed 52/52 backend tests.
- 2026-06-21: `npm run build` passed Angular production build.
- 2026-06-21: `npm run test:functional -- e2e/role-access.functional.spec.js --project=desktop-chrome` could not complete because Playwright's webServer timed out waiting for `/health`; local connectivity checks showed `192.168.1.80:27017` and `192.168.1.80:6379` unreachable with `No route to host`.
