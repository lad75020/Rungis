# Data Model: Vendor Client Relationships

## Vendor

An active user with role vendor and a clientIds relationship list.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Client

An active user with role client and a vendorIds relationship list.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Vendor Client Association

A bidirectional relationship that controls catalog visibility and workflow eligibility.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.
