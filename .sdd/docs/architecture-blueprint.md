# Rungis Architecture Blueprint

Generated: 2026-06-21 03:29:57 CEST

## Purpose

This blueprint is the implementation-ready reference for extending Rungis while preserving architectural consistency. It combines source inspection with `codebase-memory` evidence from project `Volumes-WDBlack4TB-Code-rungis`: ready index, 2962 nodes, 4520 edges, 305 Function nodes, 197 Method nodes, 72 Route nodes, and 25 HTTP_CALLS edges.

## Architectural style

Rungis is a full-stack modular monolith. The backend is a Fastify process with explicit module registration and a large shared route context. The frontend is an Angular 22 standalone application whose root `App` component owns most state and exposes methods consumed by thin lazy-loaded page wrappers.

The primary boundaries are runtime, transport, domain, persistence, and document generation. Fastify is the runtime boundary. REST and WebSocket are the transport boundaries. Domain boundaries follow account/admin, relationships, catalog/stock, ordering/cart, billing/settlement, refunds/reminders, reporting, Rungis platform bills, and localization/presentation. Persistence is split across MongoDB, Redis, SQLite, and filesystem assets. Document generation is isolated behind PDF and Factur-X services.

## Source evidence map

| Concern | Primary source files |
|---------|----------------------|
| Process boot | `backend/src/server.js` |
| Route composition | `backend/src/routes/index.js` |
| Page shells and guards | `backend/src/routes/modules/pages.js`, `backend/src/views/*.ejs` |
| Authentication and account APIs | `backend/src/routes/modules/auth.js`, `backend/src/models/user.model.js` |
| Admin and reporting APIs | `backend/src/routes/modules/management.js` |
| PDF and Factur-X bill APIs | `backend/src/routes/modules/bills.js`, `backend/src/services/factur-x/*` |
| Rungis platform bills | `backend/src/routes/modules/rungis-bills.js`, `backend/src/services/rungis-bills/*`, `backend/src/models/rungis-bill.model.js` |
| Refund APIs | `backend/src/routes/modules/refunds.js`, `backend/src/models/refund.model.js` |
| Realtime API | `backend/src/routes/modules/websocket.js`, `frontend/src/app/app.ts` |
| Frontend routing | `frontend/src/app/app.routes.ts`, `frontend/src/app/pages/*.component.ts` |
| Frontend state | `frontend/src/app/app.ts`, `frontend/src/app/app.types.ts`, `frontend/src/app/app.view-models.ts` |
| Build integration | `frontend/angular.json`, `backend/src/lib/angular-assets.js` |

## Runtime architecture

### Bootstrap sequence

1. `backend/src/server.js` loads environment configuration with `loadRuntimeConfig`.
2. Fastify is created with logger, body limit, and optional trust proxy.
3. Redis connects and is used for sessions and transient domain state.
4. Mongoose connects to MongoDB.
5. Legacy app settings may migrate from MongoDB into SQLite.
6. Fastify registers cookie, form-body, JWT, websocket, session, EJS view, static, and security header plugins.
7. Fastify decorates asset, translation, and websocket credential helpers.
8. `registerRoutes(app)` builds the route context and registers route modules.
9. `/health` and shutdown hooks are added before listen.

### Backend module composition

`registerRoutes` is the architectural join point. It builds a dependency object containing guards, models, services, validation helpers, mapping helpers, settings helpers, document functions, and connection maps. The route modules should stay focused on HTTP or WebSocket transport details. Domain logic that must be reused belongs in `backend/src/routes/index.js`, `backend/src/services/*`, `backend/src/lib/*`, or `backend/src/utils/*` rather than being copied between modules.

## Backend layers

### 1. Server and plugin layer

Responsibilities:

- Configure Fastify and runtime dependencies.
- Register persistence clients and session store.
- Register HTTP security headers, templates, static serving, and websocket support.
- Decorate helpers used by route modules.

Rules:

- Do not place domain workflow code in `server.js`.
- Keep secrets in environment variables, not documentation or examples.
- Preserve session cookie flags and production secure behavior.

### 2. Route registration and context layer

Responsibilities:

- Centralize guards, mappers, billing helpers, websocket connection maps, Redis cart helpers, app settings access, and broadcast helpers.
- Provide route modules with explicit dependencies.
- House reusable domain functions when a separate service module does not yet exist.

Rules:

- New route modules should receive dependencies rather than importing sibling route modules.
- New shared helpers should be named for their business invariant, for example `buildClientVendorDayBillKey` or `normalizeBillOverdueDays`.
- Dangerous object key checks must remain available to REST and WebSocket paths.

### 3. Route modules

| Module | Responsibility |
|--------|----------------|
| `pages.js` | Server-rendered page routes, role page guards, bootstrap payload selection |
| `auth.js` | Login, signup, account updates, passkeys, image upload, session, websocket token refresh |
| `management.js` | Admin users, associations, settings, reports, overdue bills, Rungis bill admin operations, reminders |
| `bills.js` | Vendor/client bill PDF and Factur-X endpoints |
| `rungis-bills.js` | User-facing Rungis platform bill document endpoints |
| `refunds.js` | Vendor refund creation and refund client discovery |
| `websocket.js` | Authenticated realtime API actions and broadcasts |

Rules:

- Choose the strictest `preHandler` guard that matches the route.
- Validate object ids, roles, dates, amounts, and dangerous keys before touching persistence.
- Return JSON `{ ok: false, message }` for expected API failures.
- Keep file download routes fail-closed if invoice data cannot be normalized.

### 4. Service layer

Current service families:

- `factur-x`: turns normalized bill data into readable PDF, Factur-X XML/XMP, embedded PDF/A-3 output, and validates generated documents.
- `rungis-bills`: owns platform fee settings, monthly generation, party snapshots, invoice view data, Factur-X input, and PDF output.

Rules:

- Put document and invoice algorithms in services, not route handlers.
- Keep money and VAT calculations centralized and deterministic.
- Include structured error details for missing legal or financial invoice data.

### 5. Model layer

| Model | Domain use |
|-------|------------|
| `User` | Admin, vendor, client identity, activation, passkeys, relationships, legal fields |
| `Merchandise` | Vendor catalog and stock items |
| `ValidatedOrder` | Frozen order history and billing source data |
| `Bill` | Daily vendor/client bill, settlement, comments, penalties, refunds |
| `Refund` | Vendor refund requests and applied refund lines |
| `RungisBill` | Monthly platform fee invoices for vendors and clients |
| `Cart` | Legacy model; active carts are stored in Redis |

Rules:

- Freeze historical order/bill monetary values at validation/generation time.
- Do not recompute historical bills from current merchandise prices.
- Keep role relationship arrays in `User` consistent when assignments change.

## Frontend architecture

Angular route components are intentionally thin. `frontend/src/app/app.routes.ts` lazy-loads standalone page components for dashboard, admin, statistics, stocks, order, and legacy fallback. Each wrapper injects `App` and calls `activateRoutedPage` so the root component can preserve state and announce the active page over the websocket.

The root `App` component owns session, language, theme, toast, websocket, account, signup, passkey, admin, stock, order, dashboard, bill, Rungis bill, chart, and download state. REST `fetch` is used for account/session, admin settings, reporting, uploads, PDF/Factur-X files, Rungis bill documents, refunds, and passkeys. WebSocket `sendWsApi` is used for live actions with request ids and `api:result` responses.

Rules:

- Add TypeScript payload/view types in `app.types.ts` when adding backend responses.
- Keep page wrappers thin; put behavior in `App` or smaller helper modules.
- Mock `sendWsApi` in unit tests for websocket-driven UI behavior.
- Avoid adding long-lived state to page wrappers unless it is strictly DOM-local.

## Data architecture

MongoDB stores users, merchandise, validated orders, daily bills, refunds, and Rungis platform bills. Redis stores Fastify sessions, active client carts, login cooldown/rate state, and unpaid reminder payloads. SQLite stores local app settings such as overdue bill days, style profile, and Rungis billing rates/processed months. Filesystem storage under `backend/src/public` stores static assets, uploaded logos/images, and generated Angular bundles.

## Transport architecture

### REST families

- Auth/account: login, signup, session, account update, websocket credential refresh, passkeys, logo/image upload.
- Admin: pending users, active user search/status, associations, settings, reports, Rungis bill controls.
- Vendor/client bills: PDF and Factur-X downloads.
- Rungis bill documents: user-facing PDF and Factur-X downloads for platform invoices.
- Refunds/reminders: vendor refund creation and reminder endpoints.

### WebSocket action families

- `auth:*` for live username availability.
- `dashboard:vendor-*` for vendor bill/order/message workflows.
- `dashboard:client-*` for client bill/cart/comment workflows.
- `stocks:*` for vendor stock CRUD.
- `order:*` for client catalog, favorites, cart mutation, and validation.

WebSocket connections are registered by page and role after the credential is verified. The frontend refreshes the websocket credential before reconnecting after expiration and sends page pings to keep the server-side registration aligned with the active route.

## Cross-cutting concerns

### Authentication and authorization

- Session cookies authorize page and REST requests.
- JWT credentials authorize WebSocket connections.
- Role guards exist for admin, vendor, client, authenticated user, and Rungis bill users.
- Passkeys use SimpleWebAuthn option generation and response verification.

### Validation

- Backend normalizes strings and rejects dangerous object keys.
- Mongoose ObjectIds are validated before query or mutation.
- SIRET/businessRegistrationId validation requires exactly 14 digits for business identity fields.
- VAT and money values pass through shared VAT helpers.
- Factur-X export validates party identity, totals, line items, VAT, document id, and dates.

### Resilience and observability

- Expected API errors return `ok: false` with a clear message.
- WebSocket action errors return `api:result` failures tied to request ids.
- Factur-X and PDF generation fail closed rather than returning misleading documents.
- WebSocket reconnect uses exponential backoff and refreshed credentials.
- Fastify logger and `/health` provide runtime observability.

## Extension patterns

### Add a new REST feature

1. Start from `specs/<feature>/spec.md` and identify role, persistence, and response contracts.
2. Add or extend Mongoose models only if durable state is required.
3. Place shared validation/mapping helpers in `routes/index.js`, `services/*`, `lib/*`, or `utils/*`.
4. Register endpoints in the closest route module or a new focused module.
5. Add frontend fetch methods and types.
6. Add focused backend tests, frontend tests if UI state changes, and docs updates.

### Add a new WebSocket action

1. Add the backend action branch under the correct namespace in `websocket.js`.
2. Validate role, ids, dates, values, and dangerous keys inside the branch.
3. Reuse route context helpers for persistence and broadcasts.
4. Return through the existing `api:result` responder.
5. Add `sendWsApi` use in `App` and update `app.types.ts`.
6. Add tests for role rejection, success response, and broadcast behavior.

### Add a document export

1. Normalize source data into a transport-independent invoice view.
2. Validate party identity, identifiers, dates, line totals, VAT, and amounts due.
3. Keep PDF and Factur-X outputs based on the same normalized data.
4. Return structured JSON errors for missing invoice data.
5. Add tests that read generated output where feasible.

## Common pitfalls

- Do not rely on frontend-only role checks.
- Do not copy billing calculations into multiple route handlers.
- Do not store new operational settings only in memory if users expect persistence.
- Do not add WebSocket actions without request id handling and role validation.
- Do not return PDFs or Factur-X files when normalized invoice data is incomplete.
- Do not move Angular build output away from `backend/src/public/angular` without updating Fastify asset resolution.
- Do not treat generated build files as architecture source.

## Blueprint maintenance

Update this blueprint when a route module, Mongoose model, service family, store responsibility, WebSocket namespace, document generation path, Angular route, or root state ownership pattern changes. Before updating, re-index `codebase-memory`, inspect `registerRoutes`, inspect affected route/service/model files, and run markdown validation after writing.
