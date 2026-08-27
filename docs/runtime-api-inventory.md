# Runtime API Inventory

This file is an implementation-derived route and websocket inventory. It is not a formal contract. No `.sdd` API contract files were found, so `.sdd/docs/api-reference.md` was intentionally not generated.

## Page Routes

| Method | Path | Purpose | Source |
|--------|------|---------|--------|
| GET | `/` | Redirects to role-appropriate page or login. | `routes/modules/pages.js` |
| GET | `/login` | Login page shell. | `routes/modules/pages.js` |
| GET | `/subscribe` | Signup page shell. | `routes/modules/pages.js` |
| GET | `/dashboard` | Vendor/client dashboard shell. | `routes/modules/pages.js` |
| GET | `/admin` | Admin console shell. | `routes/modules/pages.js` |
| GET | `/statistics` | Admin statistics shell. | `routes/modules/pages.js` |
| GET | `/stocks` | Vendor stock shell. | `routes/modules/pages.js` |
| GET | `/vendor-statistics` | Vendor sales statistics shell. | `routes/modules/pages.js` |
| GET | `/vendor-monthly-summary` | Vendor monthly summary shell. | `routes/modules/pages.js` |
| GET | `/vendor-overdue-bills` | Vendor overdue bills shell. | `routes/modules/pages.js` |
| GET | `/vendor-refunds` | Vendor refund shell. | `routes/modules/pages.js` |
| GET | `/find-vendors` | Client vendor discovery shell. | `routes/modules/pages.js` |
| GET | `/order` | Client order shell. | `routes/modules/pages.js` |
| GET | `/account` | Shared account shell. | `routes/modules/pages.js` |

## Health

| Method | Path | Purpose | Source |
|--------|------|---------|--------|
| GET | `/health` | Returns process health data: `ok`, `uptime`, and `now`. | `backend/src/server.js` |

## Auth and Account REST Routes

| Method | Path | Purpose | Source |
|--------|------|---------|--------|
| POST | `/api/login` | Username/password login. | `routes/modules/auth.js` |
| POST | `/api/subscribe` | Vendor/client signup. | `routes/modules/auth.js` |
| POST | `/api/logout` | End the current session. | `routes/modules/auth.js` |
| PUT | `/api/account` | Update current account profile data. | `routes/modules/auth.js` |
| POST | `/api/vendor/item-image` | Upload vendor merchandise image. | `routes/modules/auth.js` |
| GET | `/api/session` | Return current session data. | `routes/modules/auth.js` |
| POST | `/api/webauthn/enrollment/options` | Create WebAuthn registration options. | `routes/modules/auth.js` |
| POST | `/api/webauthn/enrollment/verify` | Verify WebAuthn registration response. | `routes/modules/auth.js` |
| GET | `/api/webauthn/keys` | List registered passkeys. | `routes/modules/auth.js` |
| DELETE | `/api/webauthn/keys/:id` | Delete a registered passkey. | `routes/modules/auth.js` |
| POST | `/api/webauthn/authentication/options` | Create WebAuthn authentication options. | `routes/modules/auth.js` |
| POST | `/api/webauthn/authentication/verify` | Verify WebAuthn authentication response. | `routes/modules/auth.js` |

## Admin, Management, Statistics, and Reminder REST Routes

| Method | Path | Purpose | Source |
|--------|------|---------|--------|
| GET | `/api/admin/pending-users` | List inactive pending users. | `routes/modules/management.js` |
| POST | `/api/admin/users/:id/activate` | Activate a pending user. | `routes/modules/management.js` |
| DELETE | `/api/admin/users/:id` | Delete a pending user. | `routes/modules/management.js` |
| GET | `/api/admin/associations` | List client/vendor association state. | `routes/modules/management.js` |
| POST | `/api/admin/associations/client/:clientId/vendor/:vendorId` | Assign vendor to client. | `routes/modules/management.js` |
| DELETE | `/api/admin/associations/client/:clientId/vendor/:vendorId` | Remove vendor from client. | `routes/modules/management.js` |
| POST | `/api/admin/associations/vendor/:vendorId/client/:clientId` | Assign client to vendor. | `routes/modules/management.js` |
| DELETE | `/api/admin/associations/vendor/:vendorId/client/:clientId` | Remove client from vendor. | `routes/modules/management.js` |
| GET | `/api/admin/settings/bill-overdue-days` | Read overdue-day setting. | `routes/modules/management.js` |
| PUT | `/api/admin/settings/bill-overdue-days` | Update overdue-day setting. | `routes/modules/management.js` |
| GET | `/api/admin/settings/app-style-profile` | Read active style profile setting. | `routes/modules/management.js` |
| PUT | `/api/admin/settings/app-style-profile` | Update active style profile. | `routes/modules/management.js` |
| POST | `/api/admin/bills/run-daily-generation` | Trigger daily bill generation for a chosen day. | `routes/modules/management.js` |
| GET | `/api/admin/statistics/activated-orders` | List activated order statistics. | `routes/modules/management.js` |
| GET | `/api/vendor/statistics/sales-by-category` | Vendor sales totals by category. | `routes/modules/management.js` |
| GET | `/api/vendor/statistics/sales-by-client` | Vendor sales totals by client. | `routes/modules/management.js` |
| GET | `/api/vendor/monthly-summary/clients` | List clients for monthly summary filters. | `routes/modules/management.js` |
| GET | `/api/vendor/monthly-summary` | Return vendor monthly bill summary. | `routes/modules/management.js` |
| GET | `/api/vendor/bills/overdue-unsettled` | List overdue unsettled bills grouped by client. | `routes/modules/management.js` |
| POST | `/api/vendor/bills/penalty-lines` | Add a late-payment penalty line. | `routes/modules/management.js` |
| POST | `/api/vendor/unpaid-reminders` | Send unpaid-payment reminder to a client. | `routes/modules/management.js` |
| GET | `/api/client/unpaid-reminders` | List reminders for the current client. | `routes/modules/management.js` |
| GET | `/api/client/find-vendors` | List active vendors for discovery. | `routes/modules/management.js` |
| POST | `/api/client/find-vendors/:vendorId/assign` | Client assigns a discovered vendor. | `routes/modules/management.js` |

## Refund and Bill Export REST Routes

| Method | Path | Purpose | Source |
|--------|------|---------|--------|
| GET | `/api/vendor/refunds/clients` | List vendor clients eligible for refunds. | `routes/modules/refunds.js` |
| POST | `/api/vendor/refunds` | Create a vendor refund. | `routes/modules/refunds.js` |
| GET | `/api/bills/vendor/:key/pdf` | Export vendor-side bill PDF. | `routes/modules/bills.js` |
| GET | `/api/bills/client/:key/pdf` | Export client-side bill PDF. | `routes/modules/bills.js` |

## WebSocket Endpoint

| Path | Authentication | Purpose | Source |
|------|----------------|---------|--------|
| `/ws` | Short-lived JWT passed in a query parameter named `token` | Realtime API multiplexing and broadcast channel. | `routes/modules/websocket.js` |

Connection behavior:

- The backend verifies the websocket JWT.
- The backend sends a `welcome` event with user id, role, page, and timestamp.
- The backend registers the socket in role/page-specific maps for order, stocks, admin, client dashboard, or vendor dashboard broadcasts.
- The backend sends ping frames every 25 seconds.
- Client `ping` payloads receive `pong` responses.
- Client API payloads use type `api`, a `requestId`, an `action`, and an action payload.
- Responses use type `api:result` with `requestId`, `action`, `ok`, and either `data` or `message`.

## WebSocket API Actions

### Auth

| Action | Purpose | Source |
|--------|---------|--------|
| `auth:username-available` | Check whether a username is available during signup. | `websocket.js` |

### Vendor Dashboard

| Action | Purpose | Source |
|--------|---------|--------|
| `dashboard:vendor-orders:list` | List vendor order summaries by date range. | `websocket.js` |
| `dashboard:vendor-bills:list` | List vendor bill summaries. | `websocket.js` |
| `dashboard:vendor-bills:clients` | List clients for vendor bill filters. | `websocket.js` |
| `dashboard:vendor-bills:list-by-client-range` | List vendor bills for a selected client and date range. | `websocket.js` |
| `dashboard:vendor-bills:details` | Load vendor bill details. | `websocket.js` |
| `dashboard:vendor-bills:settle` | Mark vendor side settled. | `websocket.js` |
| `dashboard:vendor-bill-messages:list` | List bill comment messages sent by clients. | `websocket.js` |
| `dashboard:vendor-bill-messages:read` | Mark a vendor bill message as read. | `websocket.js` |
| `dashboard:vendor-bill-messages:dismiss` | Dismiss a vendor bill message from dashboard list. | `websocket.js` |

### Client Dashboard

| Action | Purpose | Source |
|--------|---------|--------|
| `dashboard:client-carts:list` | List client cart/order summaries. | `websocket.js` |
| `dashboard:client-bills:list` | List client bill summaries. | `websocket.js` |
| `dashboard:client-bills:vendors` | List vendors for unpaid bill filters. | `websocket.js` |
| `dashboard:client-bills:unpaid-by-vendor` | List unpaid client bills for a selected vendor. | `websocket.js` |
| `dashboard:client-carts:details` | Load client cart details. | `websocket.js` |
| `dashboard:client-bills:details` | Load client bill details. | `websocket.js` |
| `dashboard:client-bills:comment` | Save a client comment on a bill. | `websocket.js` |
| `dashboard:client-bills:settle` | Mark client side settled. | `websocket.js` |

### Stocks

| Action | Purpose | Source |
|--------|---------|--------|
| `stocks:list` | List current vendor merchandise. | `websocket.js` |
| `stocks:create` | Create merchandise. | `websocket.js` |
| `stocks:update` | Update merchandise. | `websocket.js` |
| `stocks:delete` | Delete merchandise. | `websocket.js` |

### Order

| Action | Purpose | Source |
|--------|---------|--------|
| `order:catalog` | Load order catalog for assigned vendors. | `websocket.js` |
| `order:favorites:toggle` | Add or remove favorite merchandise. | `websocket.js` |
| `order:cart:get` | Load cart for client and delivery date. | `websocket.js` |
| `order:cart:set-delivery-date` | Change active cart delivery date. | `websocket.js` |
| `order:cart:add` | Add catalog item to cart. | `websocket.js` |
| `order:cart:update` | Update cart item quantity. | `websocket.js` |
| `order:cart:remove` | Remove item from cart. | `websocket.js` |
| `order:cart:validate` | Validate cart into a persisted order. | `websocket.js` |

## WebSocket Broadcast Events

| Event type | Purpose | Source |
|------------|---------|--------|
| `order:catalog:update` | Upsert or remove catalog item on client order pages. | `routes/index.js` |
| `order:price:update` | Notify order pages about price changes. | `routes/index.js` |
| `stocks:snapshot` | Update stock pages after stock changes. | `routes/index.js` |
| `client:unpaid-reminders:update` | Update client dashboard reminder list. | `routes/index.js` |
| `dashboard:vendor-bill-message:update` | Update vendor dashboard bill message state. | `websocket.js` / route context |
| `dashboard:vendor-bill-message:remove` | Remove dismissed vendor bill message from dashboard list. | `websocket.js` / route context |

## Shared Response Shape

Most REST endpoints and websocket actions use an object with these conventions:

```json
{
  "ok": true,
  "data": {}
}
```

or:

```json
{
  "ok": false,
  "message": "Human-readable error message."
}
```

The exact shape is implementation-derived and should be formalized in contract files before being treated as stable external API documentation.
