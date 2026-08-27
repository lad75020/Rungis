# Developer Guide

## Development Environment Setup

### Prerequisites

- Node.js that satisfies the Angular 22 toolchain engine range: `^22.22.3`, `^24.15.0`, or `>=26.0.0`. The current local verification used Node v26.3.0.
- npm workspaces. The root package uses npm workspaces for `backend` and `frontend`; `frontend/package.json` declares `npm@11.17.0`.
- MongoDB reachable from the backend through `MONGO_URL`.
- Redis reachable from the backend through `REDIS_URL`.
- A browser that supports the WebAuthn/passkey APIs if testing access keys.
- k6 if you run the performance scripts under `performance/k6/`.

### First-Time Setup

1. Enter the repository:

```bash
cd /Volumes/WDBlack4TB/Code/rungis
```

2. Install all workspace dependencies:

```bash
npm install
```

3. Create the backend environment file from the example:

```bash
cp backend/.env.example backend/.env
```

4. Edit `backend/.env` with local MongoDB, Redis, session, JWT, host, and port values. Do not commit real secret values.

5. Build the Angular frontend into the backend static directory:

```bash
npm run build
```

6. Start the backend:

```bash
npm run start
```

7. Open the login page in a browser. Use the configured host and port from the backend environment.

### Development Mode

Run frontend watch mode and backend watch mode together:

```bash
npm run dev
```

This runs:

- `npm --workspace frontend run watch`
- `npm --workspace backend run dev`

The Angular watch build writes into `backend/src/public/angular`, while Fastify serves that directory.

### Updating Your Environment

After pulling changes:

```bash
npm install
npm run build
npm --workspace backend test
npm --workspace frontend test -- --watch=false
```

## Project Structure

```text
rungis/
  package.json                      # npm workspace scripts and root dev tools
  backend/
    package.json                    # Fastify runtime dependencies and backend scripts
    scripts/                        # Seed, migration, and operational scripts
    test/                           # Node test runner tests for backend features
    data/                           # Local SQLite app settings storage
    src/
      server.js                     # Fastify bootstrap, plugin registration, store connections
      lib/                          # Runtime config, HTTP security, translations, Angular assets, app settings
      models/                       # Mongoose models for users, merchandise, orders, bills, refunds, carts
      routes/index.js               # Shared guards, mappers, billing helpers, cart helpers, route context
      routes/modules/               # Auth, management, bills, refunds, pages, websocket modules
      services/factur-x/            # Factur-X invoice data normalization, PDF/XML generation, validation
      utils/                        # Small shared utilities such as VAT calculations
      views/                        # EJS page shells and partials
      i18n/translations.json        # English and French copy
      public/                       # Static assets, uploads, and generated Angular build output
  frontend/
    angular.json                    # Angular 22 build, test, style bundles, and output path
    src/app/app.ts                  # Root standalone Angular component and page state orchestration
    src/app/app.html                # Main template for all role pages
    src/app/app.types.ts            # Frontend type definitions and payload shapes
    src/app/app.constants.ts        # Supported pages, languages, roles, defaults
    src/app/app.view-models.ts      # View-model builders for page data
    src/app/pages/                  # Thin lazy page wrappers that activate App-owned state
    src/app/webauthn-client.ts      # Lazy SimpleWebAuthn browser helpers
    src/app/app.spec.ts             # Angular/Vitest unit tests
  specs/                            # SDD feature specifications, one folder per feature
  .sdd/docs/                        # Generated and curated developer documentation
  e2e/                              # Playwright functional test fixtures and specs
  performance/k6/                   # k6 smoke, websocket, and load scripts
```

Start reading in this order:

1. `README.md` for product scope.
2. `backend/src/server.js` for runtime bootstrap.
3. `backend/src/routes/index.js` for shared guards, business helpers, billing logic, cart helpers, and route context.
4. `backend/src/routes/modules/*.js` for route surfaces.
5. `backend/src/models/*.js` for persistence structure.
6. `frontend/src/app/app.types.ts` for UI data shapes.
7. `frontend/src/app/app.ts` and `frontend/src/app/app.html` for UI behavior.
8. `backend/src/services/factur-x/*.js` for hybrid PDF and structured invoice generation.

## Coding Conventions

### Module Style

- Backend code uses ES modules through `"type": "module"` in `backend/package.json`.
- Frontend code uses TypeScript with Angular 22 standalone components.
- Shared backend helpers live in `backend/src/routes/index.js`, `backend/src/lib/*`, `backend/src/services/*`, or `backend/src/utils/*`.
- Route modules export one registration function, such as `registerAuthRoutes`, `registerManagementRoutes`, `registerBillRoutes`, `registerRefundRoutes`, or `registerWebsocketRoutes`.
- Lazy Angular page components stay thin. They inject `App`, call `activateRoutedPage`, and delegate stateful behavior to the root `App` component.

### Naming

- JavaScript and TypeScript variables and functions use camelCase.
- TypeScript types and Mongoose model exports use PascalCase.
- Route modules use lowercase domain file names, for example `auth.js`, `management.js`, and `websocket.js`.
- MongoDB model names use PascalCase exports such as `User`, `Merchandise`, `ValidatedOrder`, `Bill`, `Refund`, and `Cart`.
- WebSocket action names use colon-separated namespaces, such as `order:cart:add` and `dashboard:client-bills:comment`.
- Generated or persisted business identifiers use explicit helper names, for example `buildVendorDayOrderKey`, `buildClientVendorDayBillKey`, and `buildBillUniqueId`.

### State and Data Patterns

- Backend request handlers normalize strings through shared helpers before validation.
- API access control is role-specific: admin, vendor, client, or authenticated user.
- Dangerous object keys are rejected in API and websocket payloads to reduce NoSQL and prototype-pollution risks.
- Active carts are Redis-backed JSON documents keyed by client and delivery date.
- Persistent domain data is represented by Mongoose schemas.
- Application settings use key/value rows in SQLite rather than environment variables.
- Angular state is mostly signal-based inside the `App` component.
- Currency and tax calculations should pass through shared rounding and VAT helpers before being persisted or displayed.

### Error Handling

- REST API handlers return JSON objects with `ok: false` and a human-readable `message` for expected errors.
- Page guards redirect unauthenticated users to `/login` and role mismatches to the appropriate page.
- WebSocket API actions return `api:result` with `ok`, `data`, or `message`.
- Invalid WebSocket payloads and missing or invalid websocket JWTs are rejected early.
- Factur-X generation throws domain errors for incomplete invoice data and returns safe JSON failures from bill routes.

### Formatting and Strictness

- Frontend TypeScript is strict: `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `strictInjectionParameters`, `strictInputAccessModifiers`, and `strictTemplates` are enabled.
- Frontend includes Prettier as a dev dependency and `.prettierrc` exists.
- No backend linter or formatter script is defined in `backend/package.json`.

## Testing

### Test Structure

- Backend unit and route tests live in `backend/test/**/*.test.js` and run with the Node test runner.
- Frontend unit tests live in `frontend/src/app/app.spec.ts` and run with Angular build tooling plus Vitest.
- Playwright functional tests live in `e2e/*.functional.spec.js` and use helpers from `e2e/support/rungis-fixtures.js`.
- k6 performance scripts live in `performance/k6/`.
- Backend tests currently cover Factur-X package usage, invoice data normalization, hybrid PDF generation, Factur-X routes, and websocket token behavior.
- Frontend tests cover component creation, toast behavior, websocket reconnect alert handling, admin statistics sorting and pagination, vendor bill message handling, and client bill comment submission behavior.

### Running Tests

```bash
# Backend unit and route tests
npm --workspace backend test

# Frontend unit tests without watch mode
npm --workspace frontend test -- --watch=false

# Production frontend build
npm run build

# Playwright functional tests
npm run test:functional

# k6 smoke and websocket checks
npm run perf:test
```

### Writing New Tests

- Add backend tests under `backend/test/<domain>/*.test.js` and prefer direct function or route-module tests where external services can be avoided.
- Add component behavior tests to `frontend/src/app/app.spec.ts` or split into new `*.spec.ts` files if the app is decomposed later.
- Prefer testing signal state and public component methods rather than DOM internals when the behavior is state-driven.
- Mock `sendWsApi` for websocket-driven UI behavior.
- Use representative admin, vendor, and client roles in test data because many UI paths are role-specific.
- For billing and invoice features, include both role perspectives and adjustment lines such as refunds or penalties.

## Adding New Features

### Development Workflow

1. Start from the relevant `specs/<feature>/spec.md` file and identify the role, entities, route surface, and UI pages.
2. Update or add Mongoose schemas in `backend/src/models/` when the feature needs persistent domain data.
3. Add shared validation, mapping, and calculation helpers in `backend/src/routes/index.js`, `backend/src/lib/`, `backend/src/services/`, or `backend/src/utils/`.
4. Register REST endpoints in the focused route module or WebSocket actions in `backend/src/routes/modules/websocket.js`.
5. Wire UI state, forms, and websocket/fetch calls through `frontend/src/app/app.ts` and the relevant page template or lazy wrapper.
6. Add or update translations in `backend/src/i18n/translations.json` when user-facing labels or messages change.
7. Add tests at the lowest level that exercises the behavior and run backend, frontend, build, and focused smoke commands.

### File Checklist

When adding a new domain feature, check these files first:

- [ ] `specs/<feature>/spec.md` - functional requirements and scenarios.
- [ ] `backend/src/models/*.js` - persistent schema changes.
- [ ] `backend/src/routes/index.js` - shared helpers, guards, route context, mappers.
- [ ] `backend/src/routes/modules/*.js` - REST or websocket route registration.
- [ ] `frontend/src/app/app.types.ts` - frontend payload and view types.
- [ ] `frontend/src/app/app.ts` - root state, actions, fetch, websocket calls.
- [ ] `frontend/src/app/app.html` and `frontend/src/app/pages/*.component.html` - visible UI.
- [ ] `backend/src/i18n/translations.json` - localized strings.
- [ ] `backend/test/**/*.test.js` and `frontend/src/app/*.spec.ts` - verification.
- [ ] `.sdd/docs/*.md` - documentation affected by the change.

### Example: Adding a WebSocket-backed Page Action

1. Add the action branch in `backend/src/routes/modules/websocket.js` under the correct namespace.
2. Validate role, object identifiers, dates, amounts, and dangerous keys before touching state.
3. Reuse route-context helpers for database access and broadcasts.
4. Return an `api:result` response using the existing `respond` helper.
5. Add the matching `sendWsApi` call in `frontend/src/app/app.ts`.
6. Add or update TypeScript types in `frontend/src/app/app.types.ts`.
7. Update the page template and tests.

### Patterns to Follow

- Keep server page and API guards authoritative. Frontend role checks are only a UX layer.
- Keep bill, cart, stock, and report keys parseable through shared helpers instead of ad hoc string parsing.
- Keep monetary values rounded at write boundaries and again at document generation boundaries.
- Keep generated Angular output under `backend/src/public/angular` so backend shells can serve current assets.
- Avoid reading or documenting real secret values from `backend/.env`.

## Technical Implementation by Feature

This section maps the feature specifications under `specs/*/spec.md` to the current implementation. It is grounded in the refreshed codebase-memory project `Volumes-WDBlack4TB-Code-rungis`, which was re-indexed for this update and reported `ready` with 2630 nodes and 4159 edges. The graph identified the main implementation packages as backend `src`, scripts, performance `k6`, e2e `support`, and backend tests, with route evidence for pages, management APIs, refund APIs, bill export APIs, and `/ws`.

### 001 - Account Authentication

Spec source: `specs/001-account-authentication/spec.md`.

Implementation entry points:

- Backend REST module: `backend/src/routes/modules/auth.js` via `registerAuthRoutes`.
- Shared helpers: `backend/src/routes/index.js` functions such as `requireAuth`, `mapSessionUser`, `buildLoginAttemptKey`, `getLoginAttemptState`, `registerFailedLoginAttempt`, `clearLoginAttempts`, `mapStoredPasskeyToCredential`, `mapAccessKeySummary`, and `buildUniqueAccessKeyName`.
- WebAuthn browser helpers: `frontend/src/app/webauthn-client.ts` functions `startAccessKeyAuthentication` and `startAccessKeyRegistration`.
- Frontend methods: `submitLogin`, `signInWithAccessKey`, `submitAccount`, `enrollAccessKey`, and `removeAccessKey` in `frontend/src/app/app.ts`.
- Data model: `backend/src/models/user.model.js`.

Technical flow:

- Public signup posts to `/api/subscribe`. The auth module normalizes identity fields, validates the role as vendor or client, checks duplicate username/email constraints, validates the 13-digit business registration id, hashes the password with bcrypt, and stores an inactive `User` document.
- Username/password login posts to `/api/login`. The backend uses Redis-backed attempt state to enforce cooldowns, rejects inactive accounts, verifies bcrypt hashes, and stores a safe user summary in the Fastify session.
- Profile management uses `/api/account`. The same User document stores organization, contact fields, business description, logo filename, vendor VAT ID, and bill mentions. The session summary is refreshed after a successful update.
- Logo upload uses `/api/vendor/item-image` for merchandise images and user logo helpers for account images. Keep image validation in backend code; do not trust MIME hints from the browser alone.
- Passkey enrollment and login use SimpleWebAuthn. The server creates challenge options, stores challenges in the session, verifies registration or authentication responses against configured RP/origin values, persists passkey credential records in the User document, and updates counters/last-used metadata.

Implementation notes:

- `User` has role, username, uniqueId, organization/contact fields, `businessRegistrationId`, `passwordHash`, role relationship arrays, favorite merchandise ids, passkeys, activation state, `vatId`, and `billMentions`.
- Login, passkey, and websocket token code depend on a current session summary. Keep `mapSessionUser` updated whenever User fields become visible in the frontend.
- The frontend account form must stay aligned with `/api/account`; missing fields there create silent feature gaps.

### 002 - Admin User Management

Spec source: `specs/002-admin-user-management/spec.md`.

Implementation entry points:

- Backend REST module: `backend/src/routes/modules/management.js`.
- Shared guards and settings helpers: `requireAdminApi`, `requireAdminPage`, `normalizeBillOverdueDays`, `getBillOverdueDaysSetting`, `setBillOverdueDaysSetting`, `normalizeAppStyleProfile`, `getAppStyleProfileSetting`, and `setAppStyleProfileSetting` in `backend/src/routes/index.js`.
- SQLite settings store: `backend/src/lib/app-settings-store.js`.
- Frontend methods: admin pending-user, association, statistics, style-profile, overdue-days, and daily-billing methods in `frontend/src/app/app.ts`.

Technical flow:

- Admin pages and APIs use server-side admin guards. Non-admin callers should fail before domain logic executes.
- Pending-user management operates on inactive vendor/client User documents. Activation flips `isActive`; pending deletion must not delete active accounts.
- Core settings are persisted through SQLite key/value helpers. Current settings include bill overdue days and app style profile.
- Manual daily billing is triggered through `/api/admin/bills/run-daily-generation`, which calls `generateBillsForDay` with an admin-provided ISO day.

Implementation notes:

- SQLite app settings are runtime data. Preserve `backend/data` or the configured SQLite path across restarts if settings matter.
- Admin UI actions should expose loading, disabled, success, and error states because many operations mutate shared business state.
- When adding a new admin setting, implement a normalizer, a get/set wrapper around the settings store, REST endpoints, UI state, and tests.

### 003 - Vendor Client Relationships

Spec source: `specs/003-vendor-client-relationships/spec.md`.

Implementation entry points:

- Backend REST module: `backend/src/routes/modules/management.js`.
- Shared helper: `assignVendorClientAssociation` in `backend/src/routes/index.js` and the route context returned by `createRouteContext`.
- Data model: `User.vendorIds` and `User.clientIds` arrays in `backend/src/models/user.model.js`.
- Frontend pages: admin association controls and client find-vendors flows in `frontend/src/app/app.ts` and templates.

Technical flow:

- Admin association endpoints list active vendors and clients with current relationship ids.
- Assignment and removal are symmetric. A client receives the vendor id and the vendor receives the client id, or both sides remove the ids.
- Client discovery endpoints let clients list active vendors and assign one to their own account without admin involvement.
- Catalog visibility and order eligibility read these relationship arrays, so relationship consistency is a precondition for order and stock flows.

Implementation notes:

- Use MongoDB object id validation before querying or mutating relationship arrays.
- Treat duplicate assignment as idempotent. Do not push duplicate ids into relationship arrays.
- Do not show inactive accounts as association targets.

### 004 - Realtime WebSocket Platform

Spec source: `specs/004-realtime-websocket-platform/spec.md`.

Implementation entry points:

- Backend WebSocket route: `backend/src/routes/modules/websocket.js` via `registerWebsocketRoutes`.
- Context and connection maps: `createRouteContext` in `backend/src/routes/index.js`.
- Frontend WebSocket state and request map: `frontend/src/app/app.ts`.
- Runtime API inventory: `.sdd/docs/runtime-api-inventory.md`.

Technical flow:

- Page routes inject a short-lived websocket JWT into `window.__APP_CONFIG__`.
- `/ws` verifies the JWT from the query parameter named `token`, sends a `welcome` payload, and registers the socket in a page/role connection map: order, stocks, admin, client dashboard, or vendor dashboard.
- Client payloads with `type: "ping"` receive `pong`. Payloads with `type: "api"` must include `requestId`, `action`, and `payload`.
- WebSocket responses use `api:result` with the same request id and action.
- Broadcast helpers send scoped updates such as `order:catalog:update`, `order:price:update`, `stocks:snapshot`, `client:unpaid-reminders:update`, and vendor bill message updates.

Implementation notes:

- `registerWebsocketRoutes` is large and action-driven. Keep new action names namespaced by page/domain.
- Always validate role and id inside the action branch. The connection role is a guard, not a substitute for domain validation.
- Keep cleanup paths updated when adding connection maps. Close/error handlers must remove sockets and clear keepalive timers.
- The action names are application contracts even though the project does not yet have formal OpenAPI/WebSocket contract files.

### 005 - Vendor Catalog and Stock

Spec source: `specs/005-vendor-catalog-stock/spec.md`.

Implementation entry points:

- WebSocket actions: `stocks:list`, `stocks:create`, `stocks:update`, and `stocks:delete` in `backend/src/routes/modules/websocket.js`.
- Shared helpers: `sanitizeStockPayload`, `mapMerchandise`, `getMerchandiseImageUrl`, `broadcastStocksSnapshot`, `broadcastOrderCatalogUpsert`, `broadcastOrderCatalogRemove`, and `broadcastOrderPriceUpdate` in `backend/src/routes/index.js`.
- Image upload: `/api/vendor/item-image` in `backend/src/routes/modules/auth.js`.
- Data model: `backend/src/models/merchandise.model.js`.
- Frontend methods: `submitStock`, `deleteStock`, `startStockEdition`, `uploadStockImage`, and stock sorting helpers in `frontend/src/app/app.ts`.

Technical flow:

- Vendor stock actions are WebSocket-backed. The backend enforces vendor role and ownership before creating, updating, or deleting merchandise.
- Merchandise stores name, reference, category, net price, VAT rate, stock, minimum stock threshold, optional image filename, and vendor id.
- `sanitizeStockPayload` normalizes price, VAT rate, stock, threshold, strings, and image names before persistence.
- `mapMerchandise` projects database records to the frontend and includes VAT-inclusive price data.
- Stock mutations broadcast current stock snapshots to the vendor stock page and catalog/price updates to eligible client order pages.

Implementation notes:

- The unique index is `{ category, name, reference, vendorId }`; use that same uniqueness concept in UI validation messages.
- Keep image upload and merchandise save separate. The uploaded image filename is stored on the merchandise record only after the stock action succeeds.
- Stock and catalog display logic must keep net price, VAT rate, and gross price together.

### 006 - Client Ordering and Cart

Spec source: `specs/006-client-ordering-cart/spec.md`.

Implementation entry points:

- WebSocket actions: `order:catalog`, `order:favorites:toggle`, `order:cart:get`, `order:cart:set-delivery-date`, `order:cart:add`, `order:cart:update`, `order:cart:remove`, and `order:cart:validate` in `backend/src/routes/modules/websocket.js`.
- Shared helpers: `mapOrderCatalogItem`, `cartRedisKey`, `getRedisCart`, `saveRedisCart`, `clearRedisCart`, `normalizeCartDocument`, `normalizeCartItem`, and `mapCart` in `backend/src/routes/index.js`.
- Data model: `backend/src/models/validated-order.model.js`; active carts are stored in Redis.
- Frontend methods: `loadOrderCatalog`, `loadOrderCart`, `addToCart`, `updateCartQuantity`, `removeFromCart`, `setOrderDeliveryDate`, and `validateCart` in `frontend/src/app/app.ts`.

Technical flow:

- Catalog loading reads the client's assigned vendor ids and returns only in-stock merchandise from those vendors.
- Favorites are stored on the User document as `favoriteMerchandiseIds`.
- Active carts are Redis JSON documents keyed by client and delivery date. They freeze selected merchandise id, vendor id, name, reference, unit price, VAT rate, gross unit price, quantity, and line totals.
- Cart validation persists a `ValidatedOrder`, decrements merchandise stock, clears the Redis cart, and broadcasts stock/catalog changes.
- Validated order items keep both net and VAT-inclusive money fields so later billing can reproduce the same amounts.

Implementation notes:

- Validate delivery dates and object ids before cart reads/writes.
- Never derive billing totals from current merchandise prices once an order is validated. Use frozen validated order item values.
- Keep Redis cart serialization compatible with `normalizeCartDocument` so old cart payloads do not crash the UI.

### 007 - Billing Settlement and PDF Export

Spec source: `specs/007-billing-settlement-pdf-export/spec.md`.

Implementation entry points:

- Billing helpers: `generateBillsForDay`, `buildBillUniqueId`, `mapBillSettlement`, `getVendorBillDetails`, `getClientBillDetails`, `setBillSettlement`, `setBillClientComment`, `listVendorBillMessages`, `markVendorBillMessageRead`, `dismissVendorBillMessage`, and `sendBillPdf` in `backend/src/routes/index.js`.
- Bill routes: `backend/src/routes/modules/bills.js` for `/api/bills/vendor/:key/pdf`, `/api/bills/client/:key/pdf`, `/api/bills/vendor/:key/factur-x`, and `/api/bills/client/:key/factur-x`.
- WebSocket dashboard actions: `dashboard:vendor-bills:*` and `dashboard:client-bills:*` in `backend/src/routes/modules/websocket.js`.
- Data model: `backend/src/models/bill.model.js`.

Technical flow:

- Daily bill generation aggregates `ValidatedOrder` documents by UTC day, vendor, and client.
- The bill upsert key is `{ date, vendorId, clientId }`. The persisted `uuid` uses user `uniqueId` values in the generated business identifier format.
- Refund lines and penalty lines are stored on the Bill document as embedded arrays.
- Vendor and client settlement are independent booleans so one side can mark paid/settled without overwriting the other side.
- Client comments are stored on the Bill document and projected as vendor dashboard messages.
- PDF export uses PDFKit and the same role-scoped bill detail helpers as the dashboard modal.

Implementation notes:

- Keep role-specific bill keys separate: vendor bill keys are parsed with vendor/client/day context, and client bill keys reverse the visible perspective.
- Do not recalculate line details from live merchandise for existing bills. Use validated order and persisted bill lines.
- Bill details, PDFs, and Factur-X exports should share the same source fields for totals and party identity.

### 008 - Refunds, Overdue Bills, and Reminders

Spec source: `specs/008-refunds-overdue-bills-reminders/spec.md`.

Implementation entry points:

- Refund REST module: `backend/src/routes/modules/refunds.js`.
- Management endpoints: overdue bills, penalty lines, unpaid reminders, and client reminder list in `backend/src/routes/modules/management.js`.
- Shared helpers: `normalizeRefundAmount`, `mapRefundToBillLine`, `normalizeBillPenaltyPercentage`, `mapPenaltyToBillLine`, `addBillPenaltyLine`, `getVendorClientOverdueUnsettledTotal`, `upsertUnpaidReminder`, `listClientUnpaidReminders`, and `removeUnpaidReminder` in `backend/src/routes/index.js`.
- Data model: `backend/src/models/refund.model.js` and embedded bill refund/penalty lines in `backend/src/models/bill.model.js`.
- Frontend methods: refund, overdue bill, penalty, and reminder flows in `frontend/src/app/app.ts`.

Technical flow:

- Vendors list assigned clients eligible for refunds and create positive refund credits with bounded comments.
- `generateBillsForDay` includes unapplied or day-applicable refund lines and marks newly applied refunds.
- Overdue bills are detected from delivery/date context plus the admin-configured overdue-day threshold.
- Vendors can add bounded penalty percentages to overdue bills. Penalty lines are embedded in the bill and included in totals.
- Payment reminders are Redis-backed by client and vendor, indexed per client, and broadcast to connected client dashboards.

Implementation notes:

- Refunds and penalties are financial adjustments. Keep signs explicit: refunds reduce totals and penalties increase totals.
- Reminder state is transient Redis state, not MongoDB. If Redis is flushed, reminders disappear but bills remain.
- Recompute client reminder totals after settlement changes so stale reminders are removed when no overdue amount remains.

### 009 - Analytics and Reporting

Spec source: `specs/009-analytics-reporting/spec.md`.

Implementation entry points:

- Backend REST module: `backend/src/routes/modules/management.js`.
- Routes: `/api/admin/statistics/activated-orders`, `/api/vendor/statistics/sales-by-category`, `/api/vendor/statistics/sales-by-client`, `/api/vendor/monthly-summary/clients`, and `/api/vendor/monthly-summary`.
- Shared date helpers: `parseIsoDayUtc`, `buildValidatedAtFilter`, and `roundToTwoDecimals` in `backend/src/routes/index.js`.
- Data sources: `ValidatedOrder` and `Bill` collections.
- Frontend methods and pages: statistics, vendor statistics, and monthly summary state in `frontend/src/app/app.ts` plus lazy page wrappers under `frontend/src/app/pages/`.

Technical flow:

- Admin activated-order statistics aggregate validated orders by UTC day over a validated date range.
- Vendor category and client sales reports unwind validated order items and filter by current vendor id.
- Monthly summaries read bill data for the selected month and optional client filter.
- Empty periods return empty row arrays rather than errors.

Implementation notes:

- Keep all report filters role-scoped. Vendor reports must never aggregate another vendor's items.
- Reject malformed or inverted date ranges before running MongoDB aggregations.
- Round reported amounts to two decimals at response boundaries.

### 010 - Localization and Presentation

Spec source: `specs/010-localization-presentation/spec.md`.

Implementation entry points:

- Translation helpers: `backend/src/lib/translations.js` and `backend/src/i18n/translations.json`.
- Page shell helpers: `backend/src/lib/angular-assets.js`, `backend/src/views/*.ejs`, and `backend/src/routes/modules/pages.js`.
- Style settings: `getAppStyleProfileSetting` and `setAppStyleProfileSetting` in `backend/src/routes/index.js` backed by SQLite.
- Angular build config: `frontend/angular.json` with primary and secondary CSS bundles and output path `../backend/src/public/angular`.
- Frontend constants and header/theme state: `frontend/src/app/app.constants.ts`, `frontend/src/app/app-header.component.ts`, and `frontend/src/app/app.ts`.

Technical flow:

- Fastify page routes select language, page name, session user, active style profile, Angular assets, and websocket token, then render EJS shells.
- Shells inject `window.__APP_CONFIG__`; Angular reads it to choose the active page, role-specific navigation, translations, style profile, and websocket connection.
- English and French copy live in a single translation catalog and is reused by page shells and document generation where applicable.
- The active app style profile is an admin setting persisted in SQLite and read during page bootstrap.

Implementation notes:

- Add translation keys before adding template labels. Missing keys should have safe fallback text.
- Angular asset filenames are hashed in production. Always run `npm run build` after dependency or frontend changes so backend shells point at current files.
- Keep server-side page guards in `pages.js`; do not rely on Angular routes alone for role security.

### 011 - Download Factur-X

Spec source: `specs/011-download-factur-x/spec.md`.

Implementation entry points:

- Bill routes: `/api/bills/vendor/:key/factur-x` and `/api/bills/client/:key/factur-x` in `backend/src/routes/modules/bills.js`.
- Invoice data normalization: `backend/src/services/factur-x/invoice-data.js` function `normalizeBillToFacturXData`.
- Hybrid document generation: `backend/src/services/factur-x/generator.js` functions `generateFacturXBill`, `renderFacturXReadablePdf`, `buildFacturXXml`, `buildFacturXXmp`, `embedFacturXXmlInPdfA3`, and `sendFacturXBill`.
- Validation tests/helpers: `backend/src/services/factur-x/validation.js`.
- Frontend methods: `downloadVendorFacturX`, `downloadClientFacturX`, `downloadFacturX`, and `facturXErrorMessage` in `frontend/src/app/app.ts`.

Technical flow:

- The bill details UI exposes "Download Factur-X" next to the PDF action.
- The frontend calls the role-specific Factur-X endpoint and handles both binary downloads and structured JSON failures.
- The backend reuses role-scoped bill detail helpers, normalizes parties, lines, VAT breakdowns, totals, and identifiers into an invoice data object, renders a readable PDF with PDFKit, builds Cross Industry Invoice XML, attaches XML and XMP metadata, and returns a Factur-X PDF attachment.
- Factur-X generation fails closed when required bill, party, legal, or tax data is incomplete.

Implementation notes:

- Keep vendor and client authorization identical to existing bill details/PDF access.
- Keep file names safe and descriptive by using sanitized bill identifiers.
- Do not let the Factur-X route return an empty or misleading PDF when invoice normalization fails.

### 012 - VAT Billing Fields

Spec source: `specs/012-vat-billing-fields/spec.md`.

Implementation entry points:

- Vendor billing profile fields: `vatId` and `billMentions` in `backend/src/models/user.model.js`.
- Merchandise VAT field: `vatRate` in `backend/src/models/merchandise.model.js`.
- Validated order VAT fields: `vatRate`, `unitPriceIncludingVat`, `lineTotalIncludingVat`, `vatCategory`, `vatExemptionReason`, and `grandTotalIncludingVat` in `backend/src/models/validated-order.model.js`.
- Bill VAT fields: `totalPriceIncludingVat`, line-level VAT fields, refund VAT fields, and penalty VAT fields in `backend/src/models/bill.model.js`.
- VAT helpers: `backend/src/utils/vat.js` functions for normalizing VAT rates and calculating VAT-inclusive amounts.
- Factur-X invoice data: VAT id, bill mentions, VAT breakdowns, and gross totals in `backend/src/services/factur-x/invoice-data.js`.

Technical flow:

- Vendor VAT ID is stored uppercase, trimmed, and must be exactly 13 characters when provided.
- Vendor bill mentions are stored on the User document and are intended to flow into visible and structured invoice notes.
- Merchandise keeps the existing net `price` and adds a required per-item `vatRate`. Mappers compute `priceIncludingVat` for stock and order views.
- Cart and validated order flows freeze VAT rates and gross amounts at order validation time.
- Bills aggregate net totals, VAT-inclusive totals, refund lines, penalty lines, and per-rate VAT breakdowns so invoices with multiple VAT rates remain internally consistent.

Implementation notes:

- Treat missing VAT as a data-quality problem. If the code applies a default, the UI and docs must make that default explicit.
- Any UI that creates or edits merchandise must send `vatRate`; otherwise backend defaults can hide incomplete tax data.
- PDF, Factur-X, dashboard, stock, and order displays must keep net, VAT, and gross values aligned for the same source line.

### 013 - Rungis Fee Bills

Spec source: `specs/013-rungis-fee-bills/spec.md`.

Current implementation status:

- This spec is present, but the current indexed codebase and source search do not show a dedicated Rungis bill model, Rungis billing settings helpers, Rungis invoice endpoints, or admin search/mark-paid routes yet.
- The existing implementation provides reusable pieces for this feature: SQLite app settings, admin-only management routes, monthly aggregation patterns, bill/PDF/Factur-X generation patterns, organization identity fields on User, and frontend dashboard modal patterns.

Target implementation entry points:

- Add persistent Rungis bills under `backend/src/models/`, likely as a dedicated monthly bill collection because these bills are marketplace fees rather than vendor-client daily bills.
- Add Rungis fee and Rungis VAT settings to SQLite through `backend/src/lib/app-settings-store.js` wrappers and admin endpoints in `backend/src/routes/modules/management.js`.
- Add generation logic near existing billing helpers or in a new service. It should aggregate previous-month `ValidatedOrder` rows separately for vendor-side received orders and client-side placed orders.
- Add dashboard invoice retrieval plus PDF and Factur-X export routes. Reuse Factur-X normalization/generation only after defining a Rungis invoice data adapter.
- Add admin unpaid bill search and mark-paid endpoints with month and organization filters.
- Add frontend admin controls and dashboard invoice modal state in `frontend/src/app/app.ts`, templates, and types.

Technical rules from the spec:

- Rungis fee and VAT settings are percentages and must be validated as non-negative numeric percentages.
- Generation uses the previous calendar month and avoids duplicate unpaid bills for the same user, role perspective, month, and year.
- Paid bills must never be reset to unpaid by a later generation run.
- Rungis bill records need month/year, user unique id, role perspective, gross amount before tax, fee percentage, payable before tax, VAT rate, payable including VAT, and paid flag.
- User-facing invoice output needs admin organization identity on the left and billed user organization identity on the right.
- PDF and Factur-X outputs must match the modal values exactly.

## Cross-Cutting Implementation Details

### Page Bootstrap and Role Guards

- `backend/src/routes/modules/pages.js` owns server-rendered routes and redirects.
- Page payload construction includes language, session user, active page, style profile, Angular assets, and websocket token.
- Route guards in `backend/src/routes/index.js` are the security boundary. Frontend role-based rendering is supplemental only.

### Data Stores

- MongoDB stores users, merchandise, validated orders, bills, refunds, and the legacy cart model.
- Redis stores Fastify session data, active cart JSON, login cooldown state, and unpaid reminder payloads.
- SQLite stores app settings such as overdue days and style profile; it is the correct place for additional local admin settings.
- Filesystem storage under `backend/src/public` stores uploaded assets and generated Angular files.

### Money, VAT, and Rounding

- Use `roundToTwoDecimals` for money persisted or returned by backend route helpers.
- Use `normalizeVatRate` and `calculatePriceIncludingVat` for VAT calculations.
- Keep net values, VAT rates, VAT amount, and VAT-inclusive values together in mappers and documents.
- Do not recalculate historical order or bill values from current merchandise data.

### Security and Input Validation

- Reject dangerous object keys for REST and websocket payloads.
- Validate MongoDB object ids before querying.
- Enforce role guards on every backend endpoint and websocket action branch.
- Validate upload types and filenames before persisting image references.
- Do not read or copy real values from `backend/.env` into docs, tests, or examples.

## Important Pitfalls

- Do not read or copy real values from `backend/.env` into docs, tests, or examples.
- Do not rely on frontend role checks alone. Enforce role checks in backend handlers.
- Keep Angular build output pointed at `backend/src/public/angular`; otherwise the backend page shells will not find current assets.
- Keep app settings persistent by preserving the SQLite data path across backend restarts.
- If scaling beyond one backend process, review the in-process daily billing scheduler to avoid multiple processes running the same scheduled job.
- Avoid adding token-like credential placeholders to docs or logs. Describe secret values in prose instead.
- Treat `/ws` action names and REST paths as contracts even when no formal contract file exists.
- Re-index codebase-memory after large structural changes so documentation and graph-based analysis stay current.
