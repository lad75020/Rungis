# Rungis Portal

Rungis Portal is a multi-role B2B ordering and billing application for vendors, clients, and administrators.

It covers the full operational flow:

- vendor onboarding and approval
- client onboarding and approval
- vendor/client assignment management
- vendor stock and catalog management
- client ordering with live catalog updates
- daily bill generation
- bill settlement tracking
- client-to-vendor bill messaging
- vendor refunds and late-payment penalties
- overdue-bill monitoring and reminders
- vendor sales statistics
- PDF bill export
- passkey/WebAuthn support
- application-wide style profile switching

## Roles

### Admin

Admins can:

- review and activate pending vendor and client accounts
- delete pending accounts
- manage vendor/client associations in both directions
- configure the overdue-bill threshold in days
- trigger a one-time run of the daily billing routine for a chosen day
- switch the application between the primary and secondary global style profiles
- view activated-order statistics

### Vendor

Vendors can:

- manage their account information, logo, and business description
- manage passkeys on their account
- maintain merchandise: name, reference, category, price, stock, image, minimum stock threshold
- see live catalog effects when prices or stock change
- review bills from the dashboard by date
- review bills for a selected client over a selected period
- open bill details and export vendor-side PDF bills
- mark bills as settled on their side
- read client messages attached to bills
- dismiss dashboard message entries without deleting the underlying bill comment
- see unread client-message indicators on the dashboard
- issue refunds for a client, queued for the next daily bill
- view overdue unsettled bills grouped by client
- add one late-payment penalty line per overdue bill
- send unpaid-payment reminders to clients
- view sales statistics by category and by client

### Client

Clients can:

- manage their account information, logo, and passkeys
- browse and filter merchandise from their assigned vendors only
- keep favorite catalog items
- add items to a cart for a chosen delivery date
- validate a cart and create persisted validated orders
- see bills from the dashboard by date
- see unpaid bills filtered by vendor
- open bill details and export client-side PDF bills
- mark bills as received/settled on their side
- send comments on bills to vendors
- receive overdue-payment reminders from vendors
- discover all vendors on the dedicated “Find vendors” page
- inspect vendor logo and business description in a modal
- add a vendor to their assigned vendor list directly from that page

## Functional Overview

### Account lifecycle

- Users sign up as `vendor` or `client`.
- New subscriptions are inactive by default.
- Admin approval is required before normal access.
- Admin users themselves are expected to exist directly in MongoDB with `role: "admin"` and `isActive: true`.

### Vendor/client relationships

- Vendor/client associations are explicit and persisted on user documents.
- A client only sees vendors assigned to that client.
- A vendor can work with multiple clients and a client can work with multiple vendors.
- Clients can also add vendors to their own list from the “Find vendors” page.

### Catalog, stock, and ordering

- Merchandise belongs to one vendor.
- Catalog lines include pricing, stock, category, reference, and optional image.
- Clients only see merchandise from assigned vendors.
- Price and stock updates are pushed live to connected ordering pages.
- Low-stock items can be highlighted with a minimum threshold.
- Cart lines freeze unit prices at add time.
- Validating a cart consumes stock and persists a validated order.

### Billing model

- Bills are generated daily from validated orders.
- A bill aggregates one vendor/client pair for one UTC day.
- Vendor and client settlement states are tracked independently.
- Both sides can export PDFs for the same bill from their own perspective.
- Clients can attach a comment to a bill.
- Vendors see those comments as dashboard messages and in bill details.

### Refunds and penalties

- A vendor refund creates a record in the `refunds` collection with vendor, client, amount, and comment.
- During the daily billing routine, unapplied refunds are added as negative bill lines and then marked as applied so they are not reused.
- Vendors can add a late-payment penalty to an overdue bill.
- Only one penalty line can be applied per bill.

### Overdue bills and reminders

- An admin-configured number of overdue days determines when a bill is considered overdue.
- Vendors can review overdue unsettled bills grouped by client.
- Vendors can send unpaid-payment reminders.
- Clients receive those reminders on their dashboard.

### Styles and presentation

- The application has two global style profiles: `primary` and `secondary`.
- The admin chooses which profile is active for future page loads.
- The secondary profile starts as a copy of the primary profile and can diverge safely.

## Main Pages

- `/login`: username/password login and passkey login
- `/subscribe`: vendor/client sign-up
- `/dashboard`: role-specific dashboard for vendor or client
- `/admin`: administrator console
- `/statistics`: admin activated-order statistics
- `/stocks`: vendor merchandise management
- `/vendor-statistics`: vendor sales statistics
- `/vendor-overdue-bills`: vendor overdue billing and reminders
- `/vendor-refunds`: vendor refund creation
- `/find-vendors`: client vendor discovery and assignment
- `/order`: client ordering page
- `/account`: shared account management page

## Data Stored

Main MongoDB collections:

- `users`: vendors, clients, admins, associations, favorites, passkeys, logos, business description
- `merchandises`: vendor catalog and stock
- `validatedorders`: validated carts turned into immutable order records
- `bills`: daily aggregated bills, settlement flags, comments, refund lines, penalty lines
- `refunds`: queued vendor refunds and application status
- `carts`: persisted cart document model exists, while active carts are primarily handled through Redis-backed JSON storage

Application settings are stored separately in a local SQLite database file for values such as:

- overdue-bill threshold
- active application style profile

Redis is used for:

- session storage
- live carts
- login/rate-limit related ephemeral state
- client unpaid-payment reminders

## Quick Start

### Prerequisites

- Node.js
- MongoDB
- Redis

### Environment

Create `backend/.env` from the example values:

```env
PORT=3000
HOST=0.0.0.0
MONGO_URL=mongodb://127.0.0.1:27017/rungis
REDIS_URL=redis://127.0.0.1:6379
SESSION_SECRET=replace-with-a-long-random-value
JWT_SECRET=replace-with-another-long-random-value
NODE_ENV=development
```

### Install

```bash
npm install
```

### Build and run

```bash
npm run build
npm run start
```

Open:

```text
http://localhost:3000/login
```

### Development mode

Run frontend watch mode and backend watch mode together:

```bash
npm run dev
```

Useful workspace scripts:

- root: `npm run build`, `npm run start`, `npm run dev`
- frontend: `npm --workspace frontend run build`, `npm --workspace frontend run watch`, `npm --workspace frontend run test`
- backend: `npm --workspace backend run start`, `npm --workspace backend run dev`

## Basic Technical Notes

- Frontend: Angular 21 with Bootstrap
- Backend: Fastify 5 with EJS server-rendered page shells
- Database: MongoDB via Mongoose
- Local settings store: SQLite
- Session store: Redis-backed Fastify sessions
- Live updates: authenticated WebSocket channel with JWT-based socket token issuance
- Auth: username/password plus WebAuthn/passkeys
- PDF generation: PDFKit
- Frontend build output is written into `backend/src/public/angular`

High-level runtime model:

- Fastify renders the page shell and injects `window.__APP_CONFIG__`.
- Angular handles the interactive application inside `<app-root>`.
- REST endpoints are used for account/admin/bill-management flows.
- WebSocket actions are used for live catalog, cart, dashboard, and stock interactions.
- Global style profile selection is server-driven on page load; local light/dark/system theme remains client-side.
