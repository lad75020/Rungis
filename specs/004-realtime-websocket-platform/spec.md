# Feature Specification: Realtime WebSocket Platform

**Feature Branch**: `feature/time-machine-realtime-websocket-platform`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Realtime WebSocket Platform. Description: Role-scoped websocket connections power live APIs, broadcasts, stock snapshots, dashboard messages, and system status updates. Relevant files: backend/src/routes/modules/websocket.js, backend/src/routes/index.js, backend/src/server.js, backend/src/services/system-maintenance.service.js, frontend/src/app/app.ts, frontend/src/app/app.types.ts, backend/test/system-maintenance.service.test.js. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect with role-scoped identity (Priority: P1)

As an authenticated user, I want realtime connections to be bound to my role and active page so updates reach only eligible sessions.

**Why this priority**: All realtime workflows depend on safe connection registration.

**Independent Test**: Open a websocket with a valid page token and verify the welcome payload and registry behavior for that role.

**Acceptance Scenarios**:

1. **Given a valid websocket token**, **When** a connection opens, **Then** a welcome event includes user id, role, page, and timestamp.
2. **Given a missing or invalid token**, **When** connection is attempted, **Then** the socket closes without registering.
3. **Given a user connects from order, stocks, admin, or dashboard pages**, **When** registration succeeds, **Then** the socket is stored in the matching role/page registry.

---

### User Story 2 - Execute websocket API actions (Priority: P2)

As a page component, I want to send typed API action payloads and receive correlated results so realtime workflows can share one transport.

**Why this priority**: Multiplexed actions keep ordering, stocks, and dashboards responsive without polling.

**Independent Test**: Send supported api actions with request ids and verify matching api:result responses.

**Acceptance Scenarios**:

1. **Given an api payload with a requestId and action**, **When** processing succeeds, **Then** the response includes the same requestId and action.
2. **Given a payload contains dangerous keys**, **When** it is received, **Then** the system returns an error and does not execute the action.

---

### User Story 3 - Broadcast live updates (Priority: P3)

As a user on an active page, I want relevant stock, catalog, reminder, and dashboard changes to appear without manual refresh.

**Why this priority**: Broadcasts are the visible value of the realtime platform.

**Independent Test**: Trigger catalog, stock, reminder, or bill-message changes and verify connected eligible pages receive only relevant event types.

**Acceptance Scenarios**:

1. **Given stock changes**, **When** a vendor update completes, **Then** stocks and order clients receive scoped updates.
2. **Given an unpaid reminder or bill message changes**, **When** the change is stored, **Then** the affected dashboard connections receive an update.

---

### Edge Cases

- Sockets must be removed from all registries on close or error.
- Ping timers must stop during cleanup.
- Unknown actions must return a structured error response.
- Role mismatches must be rejected inside each action family.
- Dangerous payload keys must be rejected before business logic runs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST authenticate websocket connections with short-lived JWT tokens.
- **FR-002**: The system MUST register connections by page and role for order, stock, admin, client dashboard, and vendor dashboard channels.
- **FR-003**: The system MUST respond to client ping messages with pong messages.
- **FR-004**: The system MUST multiplex API actions with requestId correlation.
- **FR-005**: The system MUST reject unknown, unauthorized, malformed, or dangerous websocket payloads.
- **FR-006**: The system MUST broadcast catalog, stock, reminder, and dashboard message updates only to relevant connected clients.
- **FR-007**: The system MUST clean up connection registries and keepalive timers when sockets close or fail.

### Key Entities *(include if feature involves data)*

- **WebSocket Connection**: A live authenticated socket with role, user id, and page metadata.
- **API Action**: A typed realtime request containing requestId, action, and payload.
- **Broadcast Event**: A server-originated update sent to a scoped connection set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Valid websocket clients receive a welcome event within 2 seconds during normal operation.
- **SC-002**: 100% of api responses preserve the requestId supplied by the caller.
- **SC-003**: Unauthorized role/action combinations are rejected before data is returned.
- **SC-004**: Closed sockets are removed from all registries immediately after cleanup.

## Assumptions

- Websocket tokens are generated by the existing page-shell bootstrap flow.
- REST endpoints remain responsible for conventional account, admin, upload, refund, and PDF operations.
- Realtime messages use JSON payloads.
