# Implementation Plan: Admin User Management

**Branch**: `feature/time-machine-admin-user-management` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-admin-user-management/spec.md`

## Summary

Retrospectively document and verify the administrative management feature that lets administrators approve or remove pending vendor/client accounts and update core operational settings. The plan intentionally excludes vendor-client associations and analytics details, which are queued as separate features.

## Technical Context

**Language/Version**: JavaScript ES modules on Node.js; TypeScript with Angular 21

**Primary Dependencies**: Fastify route handlers, Mongoose User model, app-settings store, Angular standalone admin page and App state service, Playwright functional tests

**Storage**: MongoDB stores user activation state; app settings store persists overdue-days and style-profile values; validated-order/bill storage is used by the manual daily billing trigger

**Testing**: Backend Node test runner, Angular build, and Playwright role/admin functional checks

**Target Platform**: Browser-based B2B web portal

**Project Type**: Full-stack web application

**Performance Goals**: Admin list and setting operations should complete within normal interactive web expectations; activation decisions target under 30 seconds from page load

**Constraints**: Admin-only access is mandatory; active-user deletion is out of scope for pending-delete; association and analytics features are separate

**Scale/Scope**: One admin management slice covering pending account decisions, settings, and manual daily bill trigger

## Constitution Check

The constitution is template-only. Default gates all PASS: admin authorization, destructive-action safety, testability, scope control, and operational setting validation.

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
e2e/role-access.functional.spec.js
```

## Design Summary

- [research.md](./research.md) records scope and security decisions.
- [data-model.md](./data-model.md) defines Pending User, Admin Setting, and Billing Run Request.
- [contracts/admin-user-management.openapi.yml](./contracts/admin-user-management.openapi.yml) documents the relevant admin HTTP operations.
- [quickstart.md](./quickstart.md) lists verification commands.

## Post-Design Constitution Check

PASS — generated artifacts preserve admin-only scope, explicit setting validation, and separate feature boundaries.
