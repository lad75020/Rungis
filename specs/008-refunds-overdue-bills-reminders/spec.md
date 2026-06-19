# Feature Specification: Refunds Overdue Bills and Reminders

**Feature Branch**: `feature/time-machine-refunds-overdue-reminders`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Refunds Overdue Bills and Reminders. Description: Vendors queue refunds, monitor overdue unpaid bills, add penalties, and send payment reminders to clients. Relevant files: backend/src/models/refund.model.js, backend/src/models/bill.model.js, backend/src/routes/modules/refunds.js, backend/src/routes/modules/management.js, backend/src/routes/modules/websocket.js, frontend/src/app/app.ts, frontend/src/app/app.types.ts, frontend/src/app/pages/dashboard-page.component.ts. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Queue refunds for clients (Priority: P1)

As a vendor, I want to create refunds for assigned clients so future bills can include agreed credits.

**Why this priority**: Refunds affect bill totals and must be captured before generation.

**Independent Test**: Create a refund for an assigned client and verify it remains unapplied until bill generation.

**Acceptance Scenarios**:

1. **Given an assigned client exists**, **When** the vendor submits a positive refund with a comment, **Then** the refund is stored as unapplied.
2. **Given an unassigned client is selected**, **When** refund creation is attempted, **Then** the system rejects it.

---

### User Story 2 - Manage overdue bills and penalties (Priority: P2)

As a vendor, I want to see overdue unsettled bills and add permitted penalties so late payments can be tracked.

**Why this priority**: Overdue follow-up is a key vendor financial workflow.

**Independent Test**: Load overdue bills, add a penalty in bounds, and verify the bill total changes.

**Acceptance Scenarios**:

1. **Given a bill is older than the configured threshold and unsettled**, **When** the vendor loads overdue bills, **Then** it appears grouped by client.
2. **Given a valid penalty percent is submitted**, **When** it is applied, **Then** a penalty line is added.

---

### User Story 3 - Send payment reminders (Priority: P3)

As a vendor, I want to send payment reminders so clients receive timely unpaid-bill follow-up on their dashboards.

**Why this priority**: Reminders improve collection without altering bill data.

**Independent Test**: Send a reminder and verify the client reminder list updates.

**Acceptance Scenarios**:

1. **Given a client has unpaid overdue totals**, **When** the vendor sends a reminder, **Then** a reminder is stored and broadcast.
2. **Given the client opens the dashboard**, **When** reminders are loaded, **Then** the reminder appears.

---

### Edge Cases

- Refund amounts must be positive values with at most two decimals.
- Refund comments must be present and within the configured length.
- Penalty percentages must remain within the allowed 1 to 50 range.
- Overdue calculations must use the configured overdue-day threshold.
- Reminders must be scoped to the vendor and client involved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST list assigned clients eligible for vendor refunds.
- **FR-002**: The system MUST let vendors create positive refunds with bounded comments for assigned clients.
- **FR-003**: The system MUST apply queued refunds during daily bill generation.
- **FR-004**: The system MUST identify overdue unsettled bills using the admin-configured threshold.
- **FR-005**: The system MUST let vendors add bounded late-payment penalty lines to overdue bills.
- **FR-006**: The system MUST let vendors send unpaid-payment reminders to clients.
- **FR-007**: The system MUST let clients list their unpaid-payment reminders and receive realtime updates.

### Key Entities *(include if feature involves data)*

- **Refund**: A vendor-client credit with amount, comment, currency, and applied bill metadata.
- **Overdue Bill**: A bill considered late based on date and settlement state.
- **Penalty Line**: A bill adjustment representing late-payment penalty amount.
- **Unpaid Reminder**: A Redis-backed client-facing payment reminder keyed by vendor and client.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Vendors can create a valid refund in under 30 seconds during normal operation.
- **SC-002**: Invalid refund and penalty inputs are rejected before persistence.
- **SC-003**: Overdue bill lists reflect the configured threshold on each request.
- **SC-004**: Clients receive reminder updates without manual refresh when connected.

## Assumptions

- Daily billing owns the moment when unapplied refunds become bill lines.
- Penalty lines are applied only to bills the vendor is allowed to manage.
- Reminder storage is operational state and may be backed by Redis.
