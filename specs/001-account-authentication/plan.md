# Implementation Plan: Account Authentication

**Branch**: `feature/time-machine-account-authentication` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-account-authentication/spec.md`

## Summary

Retroactively document and validate the account authentication feature that lets vendors and clients request inactive accounts, lets activated users authenticate with password or optional passkeys, and lets authenticated users manage profile and access-key state. The implementation already spans the Fastify backend, MongoDB user model, Redis-backed sessions, SimpleWebAuthn passkey flows, and Angular UI; this plan formalizes the feature boundaries, contracts, data model, and validation tasks without expanding into admin activation, catalog image management, or downstream role workflows.

## Technical Context

**Language/Version**: JavaScript ES modules on Node.js for backend; TypeScript with Angular 21 for frontend

**Primary Dependencies**: Fastify, @fastify/session, @fastify/jwt, @fastify/cookie, Mongoose, Redis, @simplewebauthn/server, @simplewebauthn/browser, Angular forms/router/common, Playwright, Node test runner

**Storage**: MongoDB stores user accounts and passkeys; Redis stores sessions and transient runtime state; filesystem stores uploaded account logos under backend public uploads

**Testing**: Node `node --test` backend tests and Playwright functional tests; existing relevant coverage includes `e2e/auth.functional.spec.js` and role-access checks

**Target Platform**: Browser-based B2B web portal served by the Node/Fastify backend

**Project Type**: Full-stack web application with backend REST/session endpoints and Angular frontend pages

**Performance Goals**: Account form validation and authentication responses should be perceived as immediate under normal network conditions; login completion target is under 10 seconds per spec success criteria

**Constraints**: Password login remains available even when passkeys are unsupported; public signup is limited to vendor/client roles; all profile/passkey operations are scoped to the authenticated user; WebAuthn origin/RP checks must match runtime configuration

**Scale/Scope**: One account-authentication slice covering signup, password login/logout/session, profile updates, and passkey lifecycle; admin activation and broader role workflows are separate Time Machine features

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution is still the generated template and does not define project-specific governance. Default gates for this retrospective web feature:

- **Secure identity handling**: PASS — feature scope requires hashed passwords, session cookies, passkey verification, duplicate checks, and self-only account operations.
- **Role boundary clarity**: PASS — signup is vendor/client only; admin activation is explicitly outside this feature.
- **Testability**: PASS — user stories map to functional and backend tests with clear independent acceptance paths.
- **Contract traceability**: PASS — REST endpoint behavior is captured in OpenAPI-style contract artifacts.
- **Scope control**: PASS — catalog item image upload and admin activation are not included even though nearby code exists in the same backend module.

## Project Structure

### Documentation (this feature)

```text
specs/001-account-authentication/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── account-authentication.openapi.yml
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── package.json
├── src/
│   ├── server.js
│   ├── lib/
│   │   ├── runtime-config.js
│   │   └── http-security.js
│   ├── models/
│   │   └── user.model.js
│   └── routes/
│       ├── index.js
│       └── modules/
│           ├── auth.js
│           └── pages.js
└── test/

frontend/
├── package.json
└── src/app/
    ├── app.ts
    ├── app.html
    ├── app.types.ts
    ├── app.routes.ts
    └── webauthn-client.ts

e2e/
├── auth.functional.spec.js
├── role-access.functional.spec.js
└── support/rungis-fixtures.js
```

**Structure Decision**: Use the existing full-stack web application layout. The authentication slice is route/model heavy on the backend, with Angular form and WebAuthn helper surfaces on the frontend, and Playwright coverage for the user-visible authentication journeys.

## Phase 0: Research Summary

Research decisions are recorded in [research.md](./research.md). Key outcomes:

- Keep sessions cookie-based with Redis persistence for browser workflows.
- Treat WebAuthn passkeys as optional access keys layered on top of baseline password login.
- Preserve admin approval as a dependency instead of merging it into account authentication.
- Capture REST/session contracts with reusable schemas and explicit error responses.

## Phase 1: Design Summary

Design artifacts produced for the feature:

- [data-model.md](./data-model.md): user account, passkey, session, signup request, and validation state entities.
- [contracts/account-authentication.openapi.yml](./contracts/account-authentication.openapi.yml): consumer-readable contract for auth/account/passkey endpoints.
- [quickstart.md](./quickstart.md): setup and validation commands for this feature.

## Post-Design Constitution Check

- **Secure identity handling**: PASS — contracts include authenticated and unauthenticated boundaries, error paths, and challenge verification flows.
- **Role boundary clarity**: PASS — self-service signup remains vendor/client only.
- **Testability**: PASS — quickstart names Playwright and backend validation paths.
- **Contract traceability**: PASS — operation IDs and schemas are explicit.
- **Scope control**: PASS — no tasks are planned for admin activation or non-account catalog workflows.

## Complexity Tracking

No constitution violations or intentional complexity exceptions are required.
