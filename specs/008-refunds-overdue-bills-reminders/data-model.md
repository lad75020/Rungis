# Data Model: Refunds Overdue Bills and Reminders

## Refund

A vendor-client credit with amount, comment, currency, and applied bill metadata.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Overdue Bill

A bill considered late based on date and settlement state.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Penalty Line

A bill adjustment representing late-payment penalty amount.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Unpaid Reminder

A Redis-backed client-facing payment reminder keyed by vendor and client.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.
