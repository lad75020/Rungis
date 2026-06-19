# Feature Specification: Client Ordering and Cart

**Feature Branch**: `feature/time-machine-client-ordering-cart`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Client Ordering and Cart. Description: Clients browse assigned-vendor catalog items, manage favorites and Redis-backed carts, then validate carts into persisted orders. Relevant files: backend/src/models/cart.model.js, backend/src/models/validated-order.model.js, backend/src/routes/modules/websocket.js, backend/src/services/cart-validation.service.js, frontend/src/app/pages/order-page.component.ts, frontend/src/app/pages/order-page.component.html, frontend/src/app/app.ts, frontend/src/app/app.types.ts, backend/test/cart-validation.service.test.js, e2e/workflows-ux.functional.spec.js. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse assigned-vendor catalog (Priority: P1)

As a client, I want to browse items from my assigned vendors so I can choose products I am allowed to order.

**Why this priority**: Catalog visibility is the entry point for client ordering.

**Independent Test**: Log in as a client with assigned vendors and load the order catalog.

**Acceptance Scenarios**:

1. **Given the client has assigned vendors**, **When** the order catalog loads, **Then** only those vendors items are shown.
2. **Given no vendors are assigned**, **When** the catalog loads, **Then** an empty state explains that assignment is needed.

---

### User Story 2 - Manage favorites and cart (Priority: P2)

As a client, I want to favorite items and manage quantities in a cart for a chosen delivery date so I can prepare an order.

**Why this priority**: Cart management turns catalog browsing into a concrete order.

**Independent Test**: Toggle a favorite, add an item, change quantity, remove it, and reload the cart for the same delivery date.

**Acceptance Scenarios**:

1. **Given an item is available**, **When** the client adds it to the cart, **Then** the cart total updates.
2. **Given a favorite toggle succeeds**, **When** the catalog reloads, **Then** favorite state is preserved.

---

### User Story 3 - Validate cart into order (Priority: P3)

As a client, I want to validate my cart so the selected items become a persisted order and stock is decremented.

**Why this priority**: Validation is the business handoff from shopping to billing.

**Independent Test**: Validate a cart with available stock and verify an order is persisted and the cart clears.

**Acceptance Scenarios**:

1. **Given a valid cart exists**, **When** the client validates it, **Then** a validated order is created and stock is decremented.
2. **Given stock is insufficient**, **When** validation runs, **Then** the system rejects the cart with a clear message.

---

### Edge Cases

- Unassigned vendor items must not be orderable.
- Delivery dates must be valid calendar days.
- Cart quantities must be positive integers.
- Cart validation must re-check current stock and price-sensitive fields.
- Validation must clear only the validated cart for the current client/date.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST load catalog items only for vendors associated with the current client.
- **FR-002**: The system MUST let clients toggle favorite merchandise.
- **FR-003**: The system MUST store carts by client and delivery date in Redis.
- **FR-004**: The system MUST let clients add, update, remove, and reload cart items.
- **FR-005**: The system MUST validate carts into persisted validated orders.
- **FR-006**: The system MUST decrement stock when a cart is validated.
- **FR-007**: The system MUST clear the Redis cart after successful validation.
- **FR-008**: The system MUST broadcast stock and catalog updates after validation.

### Key Entities *(include if feature involves data)*

- **Cart**: A Redis-backed client and delivery-date basket containing item lines and totals.
- **Cart Item**: A selected merchandise line with frozen unit price and quantity.
- **Validated Order**: A persisted order created from a validated cart.
- **Favorite Merchandise**: A client preference list of merchandise identifiers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Clients can add an available item to the cart and see totals update in under 2 seconds during normal operation.
- **SC-002**: 100% of cart validation attempts re-check stock before creating an order.
- **SC-003**: Successful validation creates one persisted order and clears the matching Redis cart.
- **SC-004**: Insufficient stock or invalid quantity errors do not decrement stock.

## Assumptions

- Vendor-client associations determine catalog eligibility.
- Validated orders are billed later by the daily billing workflow.
- Carts are transient until validation succeeds.
