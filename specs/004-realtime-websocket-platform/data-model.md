# Data Model: Realtime WebSocket Platform

## WebSocket Connection

A live authenticated socket with role, user id, and page metadata.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## API Action

A typed realtime request containing requestId, action, and payload.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.

## Broadcast Event

A server-originated update sent to a scoped connection set.

- Identity: Existing application identifiers or scoped composite keys.
- Validation: Role, ownership, and input bounds are checked before writes.
- Lifecycle: Created or updated by the feature workflow and consumed by downstream role-specific pages.
