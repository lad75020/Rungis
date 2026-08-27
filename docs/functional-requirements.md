# Functional Requirements

## 1. Account and Authentication

- FR-001: The system SHALL allow users to sign up only as `vendor` or `client`. [INFERRED: HIGH] Source: `frontend/src/app/app.constants.ts`, `backend/src/models/user.model.js`, `routes/modules/auth.js`.
  - Precondition: The user submits the subscription form.
  - Postcondition: A new inactive user record is created.
  - Error behavior: Invalid or duplicate identity fields are rejected.

- FR-002: The system SHALL require admin activation before vendor and client accounts can use normal application workflows. [INFERRED: HIGH] Source: `User.isActive`, `routes/modules/management.js`.
  - Precondition: A pending user exists.
  - Postcondition: Admin activation sets the account active.
  - Error behavior: Non-admin users cannot activate accounts.

- FR-003: The system SHALL support username/password login and passkey/WebAuthn login. [INFERRED: HIGH] Source: `routes/modules/auth.js`, `routes/index.js`, `frontend/src/app/webauthn-client.ts`.
  - Precondition: Account exists and login method is valid.
  - Postcondition: A session is established and the user is redirected by role.
  - Error behavior: Invalid credentials or inactive users are rejected.

- FR-004: The system SHALL rate-limit page requests and failed login attempts. [INFERRED: MEDIUM] Source: `requirePageRateLimit`, `registerFailedLoginAttempt`, `getLoginCooldownRemainingMs` in `routes/index.js`.
  - Precondition: Multiple requests or failed login attempts occur from the same IP.
  - Postcondition: Excess attempts are denied temporarily.
  - Error behavior: Page requests receive HTTP 429 or login receives cooldown feedback.

## 2. Roles and Permissions

- FR-005: The system SHALL enforce admin-only access for user approval, association management, settings, and admin statistics. [INFERRED: HIGH] Source: `requireAdminApi`, `requireAdminPage`, `routes/modules/management.js`.

- FR-006: The system SHALL enforce vendor-only access for stock management, vendor statistics, vendor refunds, vendor bills, overdue bills, penalties, and reminders. [INFERRED: HIGH] Source: `requireVendorApi`, `requireVendorPage`, `websocket.js` action checks.

- FR-007: The system SHALL enforce client-only access for ordering, vendor discovery, client bill views, client comments, and client reminders. [INFERRED: HIGH] Source: `requireClientApi`, `requireClientPage`, `websocket.js` action checks.

- FR-008: The system SHALL reject API and websocket payloads containing dangerous keys such as keys starting with `$`, keys containing `.`, `__proto__`, `prototype`, or `constructor`. [INFERRED: HIGH] Source: `hasDangerousInputKeys` in `routes/index.js` and `websocket.js`.

## 3. Vendor and Client Relationships

- FR-009: The system SHALL store vendor-client relationships symmetrically on client `vendorIds` and vendor `clientIds`. [INFERRED: HIGH] Source: `User` schema and `assignVendorClientAssociation`.

- FR-010: The system SHALL let admins assign and remove vendor-client relationships in either direction. [INFERRED: HIGH] Source: `routes/modules/management.js` association endpoints.

- FR-011: The system SHALL let clients discover active vendors and assign a vendor from the Find Vendors page. [INFERRED: HIGH] Source: `/api/client/find-vendors`, `/api/client/find-vendors/:vendorId/assign`.

## 4. Stock and Catalog

- FR-012: The system SHALL let vendors create, update, list, and delete merchandise. [INFERRED: HIGH] Source: websocket actions `stocks:list`, `stocks:create`, `stocks:update`, `stocks:delete`.
  - Data: name, reference, price, stock, minimum stock threshold, category, image filename, vendor id.
  - Error behavior: Non-vendors cannot use stock actions.

- FR-013: The system SHALL validate merchandise stock and price as non-negative values and quantity fields as positive where applicable. [INFERRED: HIGH] Source: `merchandise.model.js`, `cart.model.js`, `validated-order.model.js`.

- FR-014: The system SHALL broadcast catalog and stock updates to connected order and stock pages. [INFERRED: MEDIUM] Source: `broadcastOrderCatalogUpsert`, `broadcastOrderCatalogRemove`, `broadcastOrderPriceUpdate`, `broadcastStocksSnapshot`.

- FR-015: The system SHALL let vendors upload supported item images. [INFERRED: MEDIUM] Source: `/api/vendor/item-image`, `allowedImageMimeTypes`, `frontend/src/app/app.utils.ts`.

## 5. Ordering and Carts

- FR-016: The system SHALL show clients catalog items only from assigned vendors. [INFERRED: HIGH] Source: `getClientWithVendors`, `order:catalog`, README behavior.

- FR-017: The system SHALL let clients mark and unmark favorite merchandise. [INFERRED: MEDIUM] Source: `favoriteMerchandiseIds` in `User`, websocket action `order:favorites:toggle`.

- FR-018: The system SHALL store active carts by client and delivery date in Redis. [INFERRED: HIGH] Source: `cartRedisKey`, `getRedisCart`, `saveRedisCart`, `clearRedisCart`.

- FR-019: The system SHALL freeze unit prices in cart and validated order lines at the time of adding/validation. [INFERRED: MEDIUM] Source: cart and validated order item schemas, README behavior.

- FR-020: The system SHALL validate a cart into a persistent `ValidatedOrder`, decrement stock, and clear the Redis cart. [INFERRED: HIGH] Source: `order:cart:validate`, `ValidatedOrder` schema, stock broadcast helpers.

## 6. Billing, Settlement, Comments, and PDF Export

- FR-021: The system SHALL generate daily bills by grouping validated orders by UTC day, vendor, and client. [INFERRED: HIGH] Source: `generateBillsForDay`.
  - Precondition: Validated orders exist for the target day.
  - Postcondition: One bill exists per vendor/client/day group.

- FR-022: The system SHALL include queued refunds as negative bill lines and mark newly applied refunds. [INFERRED: HIGH] Source: `generateBillsForDay`, `mapRefundToBillLine`, `Refund` schema.

- FR-023: The system SHALL track vendor settlement and client settlement independently. [INFERRED: HIGH] Source: `Bill.vendorSettled`, `Bill.clientSettled`, dashboard settle actions.

- FR-024: The system SHALL allow clients to attach one comment to a bill and SHALL show that comment to vendors as dashboard messages. [INFERRED: HIGH] Source: `Bill.clientComment`, `dashboard:client-bills:comment`, vendor bill message actions.

- FR-025: The system SHALL allow vendor and client PDF bill export through separate endpoints. [INFERRED: HIGH] Source: `routes/modules/bills.js`.

## 7. Refunds, Penalties, Overdue Bills, and Reminders

- FR-026: The system SHALL let vendors create refunds for assigned clients with positive amount and a short comment. [INFERRED: HIGH] Source: `Refund` schema, `routes/modules/refunds.js`.

- FR-027: The system SHALL consider a bill overdue based on the admin-configured overdue-day threshold. [INFERRED: HIGH] Source: `billOverdueDays`, `getVendorClientOverdueUnsettledTotal`, overdue endpoints.

- FR-028: The system SHALL let vendors add a late-payment penalty between 1 and 50 percent to an overdue bill. [INFERRED: HIGH] Source: `BILL_PENALTY_MIN_PERCENT`, `BILL_PENALTY_MAX_PERCENT`, `Bill.penaltyLines`.

- FR-029: The system SHALL let vendors send unpaid-payment reminders and SHALL show those reminders on the client dashboard. [INFERRED: HIGH] Source: `upsertUnpaidReminder`, `listClientUnpaidReminders`, `client:unpaid-reminders:update`.

## 8. Settings, Internationalization, and Presentation

- FR-030: The system SHALL support English and French translations. [INFERRED: HIGH] Source: `AVAILABLE_LANGUAGES`, `translations.json`, `getRequestLanguage`.

- FR-031: The system SHALL support a primary and secondary global style profile selected by admins. [INFERRED: HIGH] Source: `APP_STYLE_PROFILE_PRIMARY`, `APP_STYLE_PROFILE_SECONDARY`, `frontend/angular.json` style bundles.

- FR-032: The system SHALL expose a health endpoint returning process status. [INFERRED: HIGH] Source: `backend/src/server.js` `/health` route.

## 9. User Stories

### US-01: Admin approves new users

As an admin, I want to review and activate pending vendor and client accounts so that only approved businesses can use the portal. [INFERRED: HIGH]

Acceptance scenarios:

1. Given a pending user exists, when an admin activates the user, then the user becomes active.
2. Given a non-admin user, when they call an admin approval endpoint, then the backend rejects the request.

### US-02: Vendor maintains catalog

As a vendor, I want to create and update merchandise so that clients see accurate prices, stock, and images. [INFERRED: HIGH]

Acceptance scenarios:

1. Given a vendor is logged in, when they create stock, then assigned clients can see catalog updates.
2. Given stock reaches zero, when the update is broadcast, then ordering clients should no longer see the item as orderable.

### US-03: Client places an order

As a client, I want to add assigned-vendor items to a cart and validate it so that my order is persisted for billing. [INFERRED: HIGH]

Acceptance scenarios:

1. Given assigned vendors with available merchandise, when a client validates a cart, then a validated order is created.
2. Given insufficient or changed stock, when validation occurs, then the client must adjust the cart.

### US-04: Vendor and client settle bills independently

As a vendor or client, I want to mark my side of a bill settled so that each party can track its own settlement state. [INFERRED: HIGH]

Acceptance scenarios:

1. Given a bill exists, when a vendor settles it, then only the vendor settlement flag changes.
2. Given a bill exists, when a client settles it, then only the client settlement flag changes.

### US-05: Vendor follows up on overdue bills

As a vendor, I want to see overdue unsettled bills, add penalties, and send reminders so that I can manage late payments. [INFERRED: HIGH]

Acceptance scenarios:

1. Given bills exceed the overdue threshold, when the vendor opens overdue bills, then grouped overdue bills appear by client.
2. Given a reminder is sent, when the client opens the dashboard, then the reminder appears.

## 10. User Flows

### Flow 1: Account onboarding

Actor: Vendor or client, then admin.

1. User signs up as vendor or client.
2. System stores inactive user record.
3. Admin reviews pending users.
4. Admin activates or deletes the pending user.
5. Activated user logs in and reaches role-specific pages.

Error paths:

- Duplicate username or email is rejected.
- Invalid SIRET is rejected.
- Inactive user cannot complete normal login.

### Flow 2: Order to bill

Actor: Client, system scheduler, vendor/client.

1. Client selects a delivery date and adds items to cart.
2. System stores cart in Redis.
3. Client validates cart.
4. System creates `ValidatedOrder` and decrements stock.
5. Daily billing routine groups validated orders into bills.
6. Vendor and client review the bill on dashboards.
7. Each side marks settlement when appropriate.

Error paths:

- Unassigned vendor catalog items are not available.
- Invalid cart quantities or stock conflicts prevent validation.
- Billing generation rejects invalid day input.

### Flow 3: Refund application

Actor: Vendor and billing scheduler.

1. Vendor creates a refund for a client.
2. System stores the refund as unapplied.
3. Daily billing routine loads unapplied refunds.
4. System adds refund lines to the relevant bill group.
5. System marks newly applied refunds with bill date and timestamp.

Error paths:

- Refund amount below the positive minimum is invalid.
- Refund comment longer than 32 characters is invalid.

### Flow 4: Client bill comment to vendor message

Actor: Client and vendor.

1. Client opens bill details.
2. Client writes and sends a bill comment.
3. System stores the comment and sent timestamp on the bill.
4. Vendor dashboard receives or loads a message summary.
5. Vendor reads or dismisses the message.

Error paths:

- Unauthorized role cannot send or read the message.
- Invalid bill key is rejected.

## 11. Business Rules and Invariants

- BR-001: `businessRegistrationId` must be a 13-digit integer. [INFERRED: HIGH] Source: `user.model.js`, `parseSiretValue`.
- BR-002: Merchandise `(category, name, reference, vendorId)` must be unique. [INFERRED: HIGH] Source: `merchandise.model.js` unique index.
- BR-003: Bill `(date, vendorId, clientId)` must be unique. [INFERRED: HIGH] Source: `bill.model.js` unique index.
- BR-004: Refund amount must be at least 0.01. [INFERRED: HIGH] Source: `refund.model.js`.
- BR-005: Refund comment and refund bill-line comment maximum length is 32 characters. [INFERRED: HIGH] Source: `refund.model.js`, `bill.model.js`, `REFUND_COMMENT_MAX_LENGTH`.
- BR-006: Penalty percentage must be between 1 and 50. [INFERRED: HIGH] Source: `BILL_PENALTY_MIN_PERCENT`, `BILL_PENALTY_MAX_PERCENT`, `bill.model.js`.
- BR-007: Cart and validated order quantities must be at least 1. [INFERRED: HIGH] Source: `cart.model.js`, `validated-order.model.js`.
- BR-008: Currency is normalized to `EUR` for carts, orders, bills, refunds, reports, and reminders. [INFERRED: MEDIUM] Source: schemas and helper return values.
- BR-009: WebSocket connections are registered by page and role, so broadcasts target only relevant users. [INFERRED: MEDIUM] Source: `websocket.js` connection registration.

## 12. Computed Values and Side Effects

- CV-001: Bill total price equals grouped order line totals plus refund line totals and later penalty line totals where applicable. [INFERRED: HIGH] Source: `generateBillsForDay`, bill line helpers.
- CV-002: Overdue state is derived from bill date/delivery date, settlement state, and the configured overdue-day threshold. [INFERRED: MEDIUM] Source: overdue helper and endpoints.
- CV-003: Cart and validated order line total equals unit price multiplied by quantity, rounded to two decimals where helper output is used. [INFERRED: MEDIUM] Source: cart/order helpers.
- SE-001: Successful cart validation decrements stock and broadcasts stock/catalog updates. [INFERRED: MEDIUM] Source: `websocket.js`, route context broadcast helpers.
- SE-002: Daily billing writes/upserts `Bill` documents and updates `Refund` documents. [INFERRED: HIGH] Source: `generateBillsForDay`.
- SE-003: Client bill comments broadcast vendor dashboard message updates. [INFERRED: MEDIUM] Source: vendor dashboard connection helpers.
- SE-004: Unpaid reminder updates write Redis reminder keys and broadcast client reminder updates. [INFERRED: HIGH] Source: reminder helpers and management endpoints.
