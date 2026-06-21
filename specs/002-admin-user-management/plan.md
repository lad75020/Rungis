# Implementation Plan: Admin User Management

**Propagated**: 2026-06-21 — Updated from spec.md refinement replacing pending-user approval with form-based administrator user create/update; new users are disabled by default.

**Branch**: `feature/time-machine-admin-user-management` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-admin-user-management/spec.md`

## Summary

Retrospectively document and verify the administrative management feature after refinement: the admin page must replace the pending-user approval/delete section with full form-based user creation and update for vendor, client, and admin accounts. Administrator-created users are always persisted disabled by default; later activation or deactivation happens through the user update form. Core operational settings remain in scope, while vendor-client associations and analytics remain separate features.

## Technical Context

**Language/Version**: JavaScript ES modules on Node.js; TypeScript with Angular standalone components

**Primary Dependencies**: Fastify route handlers, Mongoose User model, password hashing utilities, app-settings store, Angular standalone admin page and App state service, Playwright functional tests

**Storage**: MongoDB stores user profile, role, credential hash, unique ID, and activation state; app settings store persists overdue-days and style-profile values; validated-order/bill storage is used by the manual daily billing trigger

**Testing**: Backend Node test runner, Angular build, and Playwright role/admin functional checks

**Target Platform**: Browser-based B2B web portal

**Project Type**: Full-stack web application

**Performance Goals**: Admin user create/update flows should complete within normal interactive web expectations; create and update completion each target under 60 seconds from page load or user selection

**Constraints**: Admin-only access is mandatory; user create requests must always persist disabled users; password hashes and raw passwords must never be returned; unsafe object keys and protected internal fields must be rejected; association and analytics features are separate

**Scale/Scope**: One admin management slice covering administrator-managed user create/update, settings, and manual daily bill trigger

## Constitution Check

The constitution is template-only. Default gates all PASS: admin authorization, destructive-action safety, testability, scope control, form validation, password-hash secrecy, and operational setting validation.

## Project Structure

```text
specs/002-admin-user-management/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/admin-user-management.openapi.yml
└── tasks.md

backend/src/routes/modules/management.js
backend/src/models/user.model.js
backend/src/lib/app-settings-store.js
frontend/src/app/pages/admin-page.component.ts
frontend/src/app/pages/admin-page.component.html
frontend/src/app/app.ts
frontend/src/app/app.types.ts
backend/src/i18n/translations.json
backend/test/**/*.test.js
e2e/role-access.functional.spec.js
```

## Design Summary

- [research.md](./research.md) records scope and security decisions; the refined flow keeps administrator activation separate by creating admin-managed users disabled by default.
- [data-model.md](./data-model.md) is affected by the refinement and should define Admin Managed User and Admin User Form instead of the removed Pending User queue.
- [contracts/admin-user-management.openapi.yml](./contracts/admin-user-management.openapi.yml) is affected by the refinement and should replace pending-user list/activate/delete operations with admin user create, load, and update operations.
- [quickstart.md](./quickstart.md) should smoke-test admin user create/update, disabled-by-default persistence, non-admin rejection, and retained settings workflows.

## Post-Design Constitution Check

PASS — propagated artifacts preserve admin-only scope, disabled-by-default user creation, explicit backend validation, password secrecy, operational setting validation, and separate feature boundaries.
