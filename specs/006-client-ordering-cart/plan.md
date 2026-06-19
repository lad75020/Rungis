# Implementation Plan: Client Ordering and Cart

**Branch**: `feature/time-machine-client-ordering-cart` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-client-ordering-cart/spec.md`

## Summary

Document and verify the client ordering workflow that exposes assigned-vendor catalog items, favorites, Redis-backed carts, delivery dates, and cart validation into persisted orders.

## Technical Context

**Language/Version**: JavaScript ES modules on Node.js; TypeScript with Angular 21

**Primary Dependencies**: Fastify route modules, Mongoose models, Redis-backed operational state where applicable, Angular standalone page components, Bootstrap styling, websocket and REST clients

**Storage**: MongoDB for persistent business entities; Redis for sessions, carts, rate/reminder state, and realtime operational data; SQLite for local app settings where applicable

**Testing**: Angular production build and Angular/Vitest frontend tests; Playwright and backend checks are documented where relevant

**Target Platform**: Browser-based B2B web portal

**Project Type**: Full-stack web application

**Performance Goals**: Interactive user operations should complete within normal web expectations, with realtime updates visible without manual refresh during connected sessions

**Constraints**: Role guards must enforce admin, vendor, and client boundaries on the server; generated artifacts are retrospective and must not expand the feature beyond the queued files

**Scale/Scope**: One Time Machine slice focused on Client Ordering and Cart

## Constitution Check

The constitution is template-only. Default gates all PASS: server-side authorization, validation before writes, safe payload handling, testability, generated artifact completeness, and scope control.

## Project Structure

```text
specs/006-client-ordering-cart/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/client-ordering-cart.websocket.md
└── tasks.md

backend/src/models/cart.model.js
backend/src/models/validated-order.model.js
backend/src/routes/modules/websocket.js
backend/src/services/cart-validation.service.js
frontend/src/app/pages/order-page.component.ts
frontend/src/app/pages/order-page.component.html
frontend/src/app/app.ts
frontend/src/app/app.types.ts
e2e/workflows-ux.functional.spec.js
```

## Design Summary

- [research.md](./research.md) records scope, security, and verification decisions.
- [data-model.md](./data-model.md) defines the feature entities and lifecycle constraints.
- [contracts/client-ordering-cart.websocket.md](./contracts/client-ordering-cart.websocket.md) documents the relevant external surface.
- [quickstart.md](./quickstart.md) lists verification commands.

## Post-Design Constitution Check

PASS — generated artifacts preserve role-scoped access, validation before persistence, and the Time Machine feature boundary.
