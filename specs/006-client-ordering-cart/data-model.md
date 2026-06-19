# Data Model: Client Ordering and Cart

## Cart

A Redis-backed client and delivery-date basket containing item lines and totals.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Cart Item

A selected merchandise line with frozen unit price and quantity.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Validated Order

A persisted order created from a validated cart.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Favorite Merchandise

A client preference list of merchandise identifiers.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.
