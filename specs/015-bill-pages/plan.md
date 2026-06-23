# Implementation Plan: Dedicated Bill Pages

**Branch**: `015-bill-pages` | **Date**: 2026-06-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-bill-pages/spec.md`

**Note**: This file is filled by the `/speckit-plan` workflow and stops after Phase 2 planning artifacts.

## Summary

Move role-specific vendor/client bill management out of the shared dashboard into two dedicated bill pages: `/vendor-bills` for vendors and `/client-bills` for clients. The implementation will remove the existing embedded bill sections from `frontend/src/app/pages/dashboard-page.component.html`, keep dashboard navigation entry points, add role-guarded server page routes and thin Angular page wrappers, reuse the existing bill detail modals, and introduce dedicated bill-list state/actions that expose scrollable 10-row lists, filters, VAT-inclusive totals, status icons, and row-level status checkboxes.

The plan deliberately reuses the existing `Bill` document fields: `vendorSettled` is the vendor-side paid status, and `clientSettled` is the client-side received/reception status. No new persistent collection is required; list view models derive payment lateness from existing overdue-day rules and order delivery context.

## Technical Context

**Language/Version**: Node.js with ES modules; Angular 22 TypeScript with strict template/type checking; local verification expects Node.js satisfying the Angular 22 engine range documented in `.sdd/docs/developer-guide.md`.

**Primary Dependencies**: Fastify page/routes stack, Mongoose/MongoDB `Bill`, `ValidatedOrder`, and `User` models, existing WebSocket request/response actions, Angular standalone components, signals, and existing translation catalog.

**Storage**: Existing MongoDB documents only. `Bill.vendorSettled` represents paid status for vendors; `Bill.clientSettled` represents received/reception status for clients; `Bill.totalPriceIncludingVat` provides VAT-inclusive amount; `ValidatedOrder.deliveryDate`/validated order grouping supports overdue calculation where needed. No schema migration is planned.

**Testing**: Backend Node test runner under `backend/test/**/*.test.js`; Angular/Vitest tests under `frontend/src/app/*.spec.ts`; production build through `npm run build`; focused functional verification can reuse existing role page and bill modal flows.

**Target Platform**: Authenticated browser web application served by Fastify with Angular assets generated into `backend/src/public/angular`.

**Project Type**: Full-stack web application with server-rendered page shells, WebSocket-backed state actions, and Angular role pages.

**Performance Goals**: Dedicated bill pages display 10 rows without page navigation and keep normal list/filter/status update interactions visibly responsive within 2 seconds under typical Rungis bill counts.

**Constraints**: Backend role guards remain authoritative; frontend role checks are only UX. Bill list and mutation actions must reject cross-role/cross-organization access. Monetary displays must use VAT-inclusive totals where specified. Checkbox clicks must not also open the row modal. Generated Angular output must remain under `backend/src/public/angular`. Dashboard bill sections must be removed without removing Rungis invoice or client message/dashboard navigation features.

**Scale/Scope**: Two dedicated role pages, two role-specific list view models, three filters per role, two row-level status updates, existing modal reuse, translations, and focused backend/frontend tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution at `.specify/memory/constitution.md` is still the generated template and is unratified/template-only. Because it does not define project-specific governance, this plan applies explicit default gates appropriate to the Rungis web application:

- **Platform UX gate**: Dedicated bill workflows must be reachable from dashboards, show empty/no-results states, keep 10 visible rows in a scrollable area, and preserve existing bill detail modal behavior. **Pass**.
- **Security and role-boundary gate**: Client/vendor bill list and mutation actions must enforce server-side role and organization ownership checks. **Pass**.
- **Financial data integrity gate**: Historical bills must use existing persisted bill/order values and shared rounding/VAT fields rather than recalculating from current merchandise. **Pass**.
- **Testability gate**: Plan identifies backend contract tests, frontend page/state tests, and build verification. **Pass**.
- **Scope control gate**: No new billing collection, no new payment processor integration, and no dashboard redesign beyond removing embedded bill sections and adding navigation. **Pass**.

No gate violations require complexity justification.

## Project Structure

### Documentation (this feature)

```text
specs/015-bill-pages/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-pages.openapi.yaml
│   └── bill-pages-websocket.yaml
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   └── bill.model.js
│   ├── routes/
│   │   ├── index.js
│   │   └── modules/
│   │       ├── pages.js
│   │       └── websocket.js
│   ├── views/
│   │   ├── client-bills.ejs
│   │   └── vendor-bills.ejs
│   └── i18n/
│       └── translations.json
└── test/
    └── billing or websocket-focused tests

frontend/
└── src/app/
    ├── app.ts
    ├── app.html
    ├── app.types.ts
    ├── app.constants.ts
    ├── app.spec.ts
    └── pages/
        ├── dashboard-page.component.html
        ├── client-bills-page.component.ts
        ├── client-bills-page.component.html
        ├── vendor-bills-page.component.ts
        └── vendor-bills-page.component.html
```

**Structure Decision**: Use the existing Rungis architecture: Fastify owns role-guarded page shells and WebSocket action registration, while Angular page wrappers activate App-owned state. Bill list state remains in `frontend/src/app/app.ts` and `app.types.ts` until a broader decomposition is planned.

## Phase 0: Research

Research output is captured in [research.md](research.md). All planning decisions are resolved with no open clarification markers.

## Phase 1: Design and Contracts

Design output is captured in:

- [data-model.md](data-model.md)
- [contracts/http-pages.openapi.yaml](contracts/http-pages.openapi.yaml)
- [contracts/bill-pages-websocket.yaml](contracts/bill-pages-websocket.yaml)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

After Phase 1 design, the default gates still pass:

- **Platform UX gate**: Page routes, navigation entry points, 10-row scroll list, filters, status icons, and modal interactions are represented in contracts and quickstart checks. **Pass**.
- **Security and role-boundary gate**: Contracts require role-scoped page guards and WebSocket actions that validate connected user role/ownership before reads or mutations. **Pass**.
- **Financial data integrity gate**: Data model maps paid/received state to existing bill fields and requires VAT-inclusive totals from persisted bill/order values. **Pass**.
- **Testability gate**: Quickstart enumerates backend tests, frontend tests, build, and focused manual role-flow verification. **Pass**.
- **Scope control gate**: No new persistent model or payment integration added to the design. **Pass**.

## Complexity Tracking

No constitution gate violations were identified, so no complexity exceptions are recorded.
