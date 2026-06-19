# Implementation Plan: Vendor Catalog and Stock

**Branch**: `feature/time-machine-vendor-catalog-stock` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-vendor-catalog-stock/spec.md`

## Summary

Document and verify the vendor merchandise management slice covering stock CRUD, pricing, categories, minimum thresholds, image upload, and client catalog broadcasts.

## Technical Context

**Language/Version**: JavaScript ES modules on Node.js; TypeScript with Angular 21

**Primary Dependencies**: Fastify route modules, Mongoose models, Redis-backed operational state where applicable, Angular standalone page components, Bootstrap styling, websocket and REST clients

**Storage**: MongoDB for persistent business entities; Redis for sessions, carts, rate/reminder state, and realtime operational data; SQLite for local app settings where applicable

**Testing**: Angular production build and Angular/Vitest frontend tests; Playwright and backend checks are documented where relevant

**Target Platform**: Browser-based B2B web portal

**Project Type**: Full-stack web application

**Performance Goals**: Interactive user operations should complete within normal web expectations, with realtime updates visible without manual refresh during connected sessions

**Constraints**: Role guards must enforce admin, vendor, and client boundaries on the server; generated artifacts are retrospective and must not expand the feature beyond the queued files

**Scale/Scope**: One Time Machine slice focused on Vendor Catalog and Stock

## Constitution Check

The constitution is template-only. Default gates all PASS: server-side authorization, validation before writes, safe payload handling, testability, generated artifact completeness, and scope control.

## Project Structure

```text
specs/005-vendor-catalog-stock/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/vendor-catalog-stock.websocket.md
└── tasks.md

backend/src/models/merchandise.model.js
backend/src/routes/modules/websocket.js
backend/src/routes/modules/auth.js
backend/src/lib/angular-assets.js
frontend/src/app/pages/stocks-page.component.ts
frontend/src/app/pages/stocks-page.component.html
frontend/src/app/app.ts
frontend/src/app/app.types.ts
```

## Design Summary

- [research.md](./research.md) records scope, security, and verification decisions.
- [data-model.md](./data-model.md) defines the feature entities and lifecycle constraints.
- [contracts/vendor-catalog-stock.websocket.md](./contracts/vendor-catalog-stock.websocket.md) documents the relevant external surface.
- [quickstart.md](./quickstart.md) lists verification commands.

## Post-Design Constitution Check

PASS — generated artifacts preserve role-scoped access, validation before persistence, and the Time Machine feature boundary.
