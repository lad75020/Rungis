# Rungis Architecture Decisions and Governance

Generated: 2026-06-21 03:29:57 CEST

## Evidence basis

- Codebase-memory project: `Volumes-WDBlack4TB-Code-rungis`
- Graph status: ready, 2962 nodes, 4520 edges
- `registerRoutes` trace confirms the module composition boundary.
- Package and source inspection confirms Fastify 5, Angular 22, MongoDB/Mongoose, Redis, SQLite settings, PDFKit, Factur-X, Playwright, Vitest, and k6.

## Decision log

### ADR-001: Modular monolith with explicit route-module registration

- Status: accepted by implementation
- Context: Rungis workflows share users, vendor-client relationships, orders, stock, bills, refunds, settings, and document exports.
- Decision: Keep the application in one Fastify process and register focused route modules from `registerRoutes`.
- Consequences:
  - Positive: domain helpers and transactions are easy to share; deployment is simple.
  - Negative: `routes/index.js` can grow into a high-change hub; care is needed to prevent helper sprawl.
- Governance: new reusable domain algorithms should move to `services/*` once they outgrow route-context helper status.

### ADR-002: Hybrid server shell plus Angular 22 frontend

- Status: accepted by implementation
- Context: The app needs server-side page guards, role-specific shells, translations, style profile selection, and session bootstrap.
- Decision: Fastify renders EJS shells with `window.__APP_CONFIG__`; Angular renders the interactive UI.
- Consequences:
  - Positive: access control and initial runtime context are established before Angular starts.
  - Negative: backend and frontend are coupled by build output and bootstrap payload shape.
- Governance: every bootstrap payload field should be typed in `AppBootstrapConfig` and tested when behavior changes.

### ADR-003: REST for conventional operations, WebSocket for live workflows

- Status: accepted by implementation
- Context: Stock, cart, catalog, order, and dashboard views need live updates and action responses. Account, admin settings, uploads, passkeys, and document downloads are conventional request/response operations.
- Decision: Use REST route modules for conventional APIs and `/ws` for action-multiplexed realtime workflows.
- Consequences:
  - Positive: live features can broadcast while preserving request ids for command responses.
  - Negative: WebSocket action names become an implicit API contract.
- Governance: add tests and documentation for new action namespaces; validate every action branch server-side.

### ADR-004: MongoDB, Redis, SQLite, and filesystem split by data lifecycle

- Status: accepted by implementation
- Context: Rungis stores durable entities, transient operational state, local settings, and uploaded/generated files.
- Decision: Use MongoDB for durable domain documents, Redis for sessions/carts/reminders/rate state, SQLite for app settings, and filesystem storage for uploads and Angular build output.
- Consequences:
  - Positive: each store matches its natural lifecycle.
  - Negative: local development and deployment require multiple dependencies and persistent SQLite path handling.
- Governance: every new data item must declare its lifecycle before choosing a store.

### ADR-005: Centralized Angular root state with thin lazy pages

- Status: accepted by implementation
- Context: The app has role pages that share session, websocket, dashboard, order, billing, and settings state.
- Decision: Keep most state and actions in root `App`; lazy page wrappers activate routes and delegate behavior.
- Consequences:
  - Positive: state survives page wrapper changes and websocket page registration is centralized.
  - Negative: `App` is large and must be managed carefully with helper modules and view-model extraction.
- Governance: extract pure view-model work into `app.view-models.ts` and payload contracts into `app.types.ts`; keep wrappers thin.

### ADR-006: Fail-closed invoice and billing exports

- Status: accepted by implementation
- Context: PDF and Factur-X documents are accounting artifacts and must not hide missing identity, total, VAT, or line data.
- Decision: Normalize and validate invoice data before generating PDF/Factur-X responses; return structured failures on missing required data.
- Consequences:
  - Positive: users see explicit data quality failures instead of invalid accounting documents.
  - Negative: old or incomplete records may be unable to export until corrected.
- Governance: document-export changes require tests for successful documents and missing-data failures.

### ADR-007: In-process scheduled daily billing

- Status: accepted by implementation
- Context: Daily bill generation is close to order and refund domain logic, and admins also need manual triggering.
- Decision: Keep daily generation inside the Fastify route context and expose admin generation endpoints.
- Consequences:
  - Positive: implementation is simple and uses existing models/helpers.
  - Negative: horizontal scaling needs duplicate-run protection and scheduler awareness.
- Governance: if the backend is scaled to multiple instances, move scheduling to a singleton worker or external scheduler while preserving idempotent upserts.

## Architecture invariants

1. Server-side role guards are mandatory for protected pages, REST APIs, WebSocket actions, and document downloads.
2. WebSocket action handlers must validate role, ids, dates, amounts, and dangerous keys independently of the connection role.
3. Historical order and bill amounts must be frozen; do not recalculate old billing from current catalog data.
4. VAT and money calculations must use shared helpers.
5. PDF and Factur-X documents must share normalized source data.
6. Angular page wrappers remain thin; root state lives in `App` or extracted helpers.
7. Route modules do not import sibling route modules.
8. User-facing copy belongs in `backend/src/i18n/translations.json`.
9. Generated Angular output stays under `backend/src/public/angular`.
10. Real secrets from `backend/.env` must never be copied into docs or tests.

## Governance checklist for new work

### Backend route or service changes

- [ ] Correct role guard selected.
- [ ] Dangerous object keys rejected for JSON payloads.
- [ ] Object ids validated before Mongoose access.
- [ ] Date and amount ranges validated.
- [ ] Shared helpers used for money, VAT, keys, and mapping.
- [ ] Expected errors return JSON with `ok: false` and `message`.
- [ ] Tests cover success and authorization failure.

### WebSocket changes

- [ ] Action name is namespaced.
- [ ] Action validates role inside the branch.
- [ ] Action uses request id responder.
- [ ] Connection maps are updated and cleaned up if a new page/role registration exists.
- [ ] Broadcast events are documented and tested.
- [ ] Frontend reconnection and page ping behavior still works.

### Frontend changes

- [ ] Types in `app.types.ts` match backend payloads.
- [ ] Long-lived state is in `App`, not page wrappers.
- [ ] Pure data shaping is in `app.view-models.ts` when practical.
- [ ] Toast/alert behavior is user-meaningful and not spammy.
- [ ] Tests mock `sendWsApi` or `fetch` at the boundary.

### Billing and document changes

- [ ] Line totals, VAT, net/gross amounts, and amount due reconcile.
- [ ] Party identity and business registration fields are present and valid.
- [ ] Vendor and client perspectives use the same source fields.
- [ ] PDF and Factur-X readable content stay aligned.
- [ ] Structured Factur-X data remains consistent with visible document data.
- [ ] Missing data fails closed with actionable errors.

## Review questions

1. Does this change add a new durable entity, transient state, local setting, or file artifact?
2. Which role owns the operation, and where is that enforced server-side?
3. Is this a REST endpoint, WebSocket action, document export, or background operation?
4. Does the feature need broadcasts or is request/response enough?
5. Can the logic be tested without a browser or external services?
6. Are money/VAT values frozen at the correct time?
7. Does the frontend need a new type, view-model helper, or route wrapper?
8. Does this update affect `.sdd/docs/runtime-api-inventory.md` or this architecture set?

## Maintenance workflow

1. Re-index `codebase-memory` for `/Volumes/WDBlack4TB/Code/rungis`.
2. Capture `index_status`, graph schema, `get_architecture`, and `trace_path(function_name="registerRoutes", direction="outbound")`.
3. Cross-check graph findings against source files.
4. Update architecture docs in `.sdd/docs/`.
5. Run markdown validation and `git diff --check`.
6. Re-index again after major structural source changes, not after doc-only edits unless graph docs need new file nodes.
