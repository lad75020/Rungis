# Tasks: Account Authentication

**Input**: Design documents from `/specs/001-account-authentication/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/account-authentication.openapi.yml, quickstart.md

**Tests**: Existing functional and backend tests are used as retrospective implementation verification. New tests should be added only if a task uncovers a behavioral gap.

**Organization**: Tasks are grouped by user story to enable independent validation of signup, login/session, and profile/passkey workflows.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase when file ownership does not overlap
- **[Story]**: Which user story the task validates or implements
- Each task names exact repository paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the retrospective implementation context and verify the existing feature boundary.

- [x] T001 Review account authentication scope in specs/001-account-authentication/spec.md and specs/001-account-authentication/plan.md
- [x] T002 [P] Verify backend authentication dependencies and scripts in backend/package.json
- [x] T003 [P] Verify frontend authentication dependencies and scripts in frontend/package.json
- [x] T004 [P] Review public contract coverage in specs/001-account-authentication/contracts/account-authentication.openapi.yml

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm shared identity, session, and security surfaces before validating user stories.

**⚠️ CRITICAL**: No user story validation should be marked complete until this phase is complete.

- [x] T005 Verify user identity fields, uniqueness, activation, and passkey storage constraints in backend/src/models/user.model.js
- [x] T006 Verify runtime session, JWT, Redis, MongoDB, cookie, and security-header setup in backend/src/server.js and backend/src/lib/runtime-config.js
- [x] T007 Verify shared authentication helpers, rate limiting, WebAuthn origin/RP handling, and route registration in backend/src/routes/index.js
- [x] T008 [P] Verify Angular account/authentication state types in frontend/src/app/app.types.ts
- [x] T009 [P] Verify Angular authentication constants, validators, and utility assumptions in frontend/src/app/app.constants.ts and frontend/src/app/app.utils.ts

**Checkpoint**: Foundation ready - user story validation can now begin.

---

## Phase 3: User Story 1 - Sign up for approval (Priority: P1) 🎯 MVP

**Goal**: Visitors can submit vendor/client signup requests that create inactive accounts for admin activation.

**Independent Test**: Submit valid and invalid signup data through the UI and verify pending-account, duplicate, and validation behavior.

### Implementation for User Story 1

- [x] T010 [US1] Verify signup request validation, inactive account creation, duplicate handling, SIRET validation, and logo handling in backend/src/routes/modules/auth.js
- [x] T011 [US1] Verify signup page routing and unauthenticated access behavior in backend/src/routes/modules/pages.js
- [x] T012 [US1] Verify signup form state, role choices, field validation, submission handling, and confirmation messaging in frontend/src/app/app.ts and frontend/src/app/app.html
- [x] T013 [US1] Run signup functional coverage defined by package.json against e2e/auth.functional.spec.js

**Checkpoint**: User Story 1 can be demonstrated independently.

---

## Phase 4: User Story 2 - Authenticate into the correct role experience (Priority: P2)

**Goal**: Activated users can log in, inactive users are blocked, and sessions route users to their role-specific destination.

**Independent Test**: Use activated and inactive fixture users to verify login success, rejection, logout, session lookup, and role routing.

### Implementation for User Story 2

- [x] T014 [US2] Verify password login, failed-attempt cooldown, inactive-account rejection, logout, and session response handling in backend/src/routes/modules/auth.js
- [x] T015 [US2] Verify role-specific page guards and redirects in backend/src/routes/modules/pages.js
- [x] T016 [US2] Verify frontend login, logout, session bootstrap, alert, and navigation behavior in frontend/src/app/app.ts and frontend/src/app/app.html
- [x] T017 [US2] Run role and authentication functional coverage defined by package.json against e2e/auth.functional.spec.js and e2e/role-access.functional.spec.js

**Checkpoint**: User Stories 1 and 2 work independently.

---

## Phase 5: User Story 3 - Manage account profile and access keys (Priority: P3)

**Goal**: Authenticated users can maintain account profile data and manage optional passkey authentication.

**Independent Test**: Log in as an activated user, update profile details, enroll/list/delete a passkey on a supported browser, and confirm password login still works.

### Implementation for User Story 3

- [x] T018 [US3] Verify account profile update validation, duplicate checks, business-registration handling, logo handling, and session refresh in backend/src/routes/modules/auth.js
- [x] T019 [US3] Verify WebAuthn enrollment, access-key listing, access-key deletion, authentication options, and verification handlers in backend/src/routes/modules/auth.js
- [x] T020 [P] [US3] Verify browser WebAuthn support detection and registration/authentication wrappers in frontend/src/app/webauthn-client.ts
- [x] T021 [US3] Verify account profile UI, passkey UI, and access-key state transitions in frontend/src/app/app.ts and frontend/src/app/app.html
- [x] T022 [US3] Run backend and functional regression coverage defined by package.json against backend/test/system-maintenance.service.test.js and e2e/auth.functional.spec.js

**Checkpoint**: All user stories are independently functional.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Validate documentation, contracts, and regression readiness for the retrospective feature.

- [x] T023 [P] Validate generated OpenAPI YAML parses and matches feature scope in specs/001-account-authentication/contracts/account-authentication.openapi.yml
- [x] T024 [P] Validate generated documentation has no unresolved placeholders in specs/001-account-authentication/spec.md, specs/001-account-authentication/plan.md, specs/001-account-authentication/research.md, specs/001-account-authentication/data-model.md, and specs/001-account-authentication/quickstart.md
- [x] T025 Run the account-authentication quickstart commands documented in specs/001-account-authentication/quickstart.md or record the exact blocker in specs/001-account-authentication/tasks.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user story validation
- **User Stories (Phase 3+)**: Depend on Foundational completion; run in priority order for this retrospective pass
- **Polish (Final Phase)**: Depends on all selected user stories being verified

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational; no dependency on US2 or US3
- **User Story 2 (P2)**: Can start after Foundational; depends on activated account data but not on passkeys
- **User Story 3 (P3)**: Can start after Foundational and login/session behavior from US2

### Within Each User Story

- Backend behavior verification before frontend behavior verification
- Frontend verification before functional test execution
- Test failures must be investigated before marking the related user story complete

### Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001
- T008 and T009 can run in parallel with backend foundational review
- T020 can run in parallel with backend passkey review in T019
- T023 and T024 can run in parallel during polish

---

## Parallel Example: User Story 3

```bash
# Validate frontend WebAuthn helper while backend passkey route review is in progress:
Task: "Verify browser WebAuthn support detection and registration/authentication wrappers in frontend/src/app/webauthn-client.ts"

# Then run the combined regression check after UI/backend verification:
Task: "Run backend and functional regression coverage defined by package.json against backend/test/system-maintenance.service.test.js and e2e/auth.functional.spec.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup checks.
2. Complete Phase 2 foundational identity/session checks.
3. Complete Phase 3 signup validation and run signup functional coverage.
4. Stop and validate that signup remains isolated from admin activation.

### Incremental Delivery

1. Add Phase 4 login/session behavior after signup is verified.
2. Add Phase 5 profile/passkey behavior after baseline password sessions are verified.
3. Finish with OpenAPI, documentation placeholder, and quickstart validation.

### Verification Notes

- Mark tasks complete only after the named file or command has actually been inspected or executed.
- If a quickstart command cannot run because MongoDB, Redis, browser, or fixture prerequisites are unavailable, record the blocker in this tasks file and leave affected behavior tasks unchecked until verified another way.


---

## Implementation Evidence

- 2026-06-19: `npm --workspace backend test` passed 9/9 backend tests.
- 2026-06-19: `npm run build` passed Angular production build and emitted assets to `backend/src/public/angular`.
- 2026-06-19: `npm run test:functional -- e2e/auth.functional.spec.js e2e/role-access.functional.spec.js` passed 16/16 Playwright tests across desktop Chrome and mobile Chrome.
- 2026-06-19: `specs/001-account-authentication/contracts/account-authentication.openapi.yml` parsed successfully as YAML with 11 paths and 14 schemas.
- 2026-06-19: Planning artifacts were checked for unresolved placeholders; the only clarification-marker text is the completed checklist validation item.
