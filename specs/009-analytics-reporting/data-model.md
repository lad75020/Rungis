# Data Model: Analytics and Reporting

## Activated Order Report Row

A daily order count and amount aggregate.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Category Sales Row

A vendor category and total amount aggregate.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Client Sales Row

A vendor-client sales aggregate.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Monthly Summary Row

A bill-derived monthly total for vendor reconciliation.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.
