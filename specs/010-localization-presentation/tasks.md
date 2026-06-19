# Tasks: Localization and Presentation

**Input**: Design documents from `/specs/010-localization-presentation/`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Review localization scope in specs/010-localization-presentation/spec.md and specs/010-localization-presentation/plan.md
- [x] T002 [P] Review presentation contract notes in specs/010-localization-presentation/contracts/localization-presentation.md
- [x] T003 Review Angular style bundles in frontend/angular.json and frontend/src/styles.css

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Verify translation catalog and helpers in backend/src/i18n/translations.json and backend/src/lib/translations.js
- [x] T005 Verify Angular asset helper in backend/src/lib/angular-assets.js
- [x] T006 Verify language and profile constants in frontend/src/app/app.constants.ts

---

## Phase 3: User Story 1 - Render localized UI text (Priority: P1)

- [x] T007 [US1] Verify backend language selection and shell text in backend/src/routes/modules/pages.js
- [x] T008 [US1] Verify frontend translated labels in frontend/src/app/app.ts and frontend/src/app/app.html

---

## Phase 4: User Story 2 - Switch presentation style profile (Priority: P2)

- [x] T009 [US2] Verify app style profile setting endpoints in backend/src/routes/modules/management.js
- [x] T010 [US2] Verify profile-specific CSS bundle configuration in frontend/angular.json and frontend/src/styles-primary.css

---

## Phase 5: User Story 3 - Serve Angular assets through shared shells (Priority: P3)

- [x] T011 [US3] Verify generated Angular asset serving in backend/src/lib/angular-assets.js
- [x] T012 [US3] Verify shared shell bootstrap configuration in backend/src/routes/modules/pages.js and frontend/src/app/app.config.ts

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T013 Check generated docs for unresolved placeholders in specs/010-localization-presentation/spec.md, specs/010-localization-presentation/plan.md, specs/010-localization-presentation/research.md, specs/010-localization-presentation/data-model.md, and specs/010-localization-presentation/quickstart.md

---

## Dependencies & Execution Order

Setup and foundational tasks precede user-story checks. User stories can be verified independently once shared guards, types, and data surfaces are in place.

---

## Implementation Evidence

- 2026-06-19: `npm run build` passed Angular production build (verified 2026-06-19T02:15Z).
- 2026-06-19: `npm --workspace frontend test -- --watch=false` passed 10/10 frontend tests (verified 2026-06-19T02:16Z).
- 2026-06-19: Source files listed in the Time Machine queue were inspected and matched to generated spec, plan, contract, data model, and task artifacts.
- 2026-06-19: All 13 tasks in this retrospective task list were marked complete after verification.
