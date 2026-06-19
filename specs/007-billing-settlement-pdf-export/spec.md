# Feature Specification: Billing Settlement and PDF Export

**Feature Branch**: `feature/time-machine-billing-settlement-pdf`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Billing Settlement and PDF Export. Description: Daily bills are generated from validated orders and both vendors and clients can review, settle, comment on, and export them as PDFs. Relevant files: backend/src/models/bill.model.js, backend/src/routes/modules/bills.js, backend/src/routes/modules/management.js, backend/src/routes/modules/websocket.js, backend/src/routes/index.js, frontend/src/app/pages/dashboard-page.component.ts, frontend/src/app/pages/dashboard-page.component.html, frontend/src/app/app.ts, frontend/src/app/app.types.ts. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate daily bills (Priority: P1)

As an administrator or scheduled process, I want validated orders grouped into daily bills so billing records are available for vendors and clients.

**Why this priority**: Bills are required before settlement, comments, and export workflows can operate.

**Independent Test**: Trigger generation for a valid day and verify bills are grouped by vendor, client, and day.

**Acceptance Scenarios**:

1. **Given validated orders exist for a day**, **When** bill generation runs, **Then** one bill per vendor-client-day group is upserted.
2. **Given queued refunds apply to the day**, **When** generation runs, **Then** refund lines are included.

---

### User Story 2 - Settle and comment on bills (Priority: P2)

As a vendor or client, I want to mark my side of a bill settled and exchange bill comments so both parties can track payment status.

**Why this priority**: Independent settlement and comments are daily operational workflows.

**Independent Test**: Settle a bill as vendor and client separately, then send a client comment and verify vendor dashboard message state.

**Acceptance Scenarios**:

1. **Given a bill exists**, **When** a vendor settles it, **Then** only vendor settlement changes.
2. **Given a client adds a comment**, **When** the vendor dashboard loads, **Then** the message is visible.

---

### User Story 3 - Export bill PDFs (Priority: P3)

As a vendor or client, I want to export a bill as a PDF so I can share or archive an invoice-like document.

**Why this priority**: PDF export supports back-office workflows but depends on bill details already existing.

**Independent Test**: Download vendor and client bill PDFs for a valid bill key and verify the response is a PDF attachment.

**Acceptance Scenarios**:

1. **Given a vendor bill key is valid**, **When** the vendor exports PDF, **Then** a PDF file with bill details is returned.
2. **Given a client bill key is valid**, **When** the client exports PDF, **Then** a PDF file with bill details is returned.

---

### Edge Cases

- Invalid bill generation dates must be rejected.
- Bill keys must be validated before details or PDFs are returned.
- Vendor and client settlement flags must not overwrite each other.
- Client comments must respect maximum length limits.
- PDF export must not expose bills to unrelated users.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST generate daily bills from validated orders grouped by UTC day, vendor, and client.
- **FR-002**: The system MUST include applicable refund lines during bill generation.
- **FR-003**: The system MUST track vendor settlement and client settlement independently.
- **FR-004**: The system MUST let clients add one bounded comment to a bill.
- **FR-005**: The system MUST show client bill comments as vendor dashboard messages.
- **FR-006**: The system MUST let vendors mark bill messages read or dismissed.
- **FR-007**: The system MUST export vendor and client bill PDFs with role-appropriate bill details.

### Key Entities *(include if feature involves data)*

- **Bill**: A persisted vendor-client-day billing record with order lines, refund lines, penalty lines, settlement flags, and optional client comment.
- **Bill Line**: A bill detail row sourced from orders, refunds, or penalties.
- **Bill Message**: A vendor dashboard projection of a client bill comment.
- **PDF Export Request**: A role-scoped request for a bill document.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Daily generation creates or updates bills for 100% of eligible validated order groups.
- **SC-002**: Vendor and client settlement changes remain independent in all bill states.
- **SC-003**: PDF export returns a downloadable document for authorized users in under 5 seconds during normal operation.
- **SC-004**: Unauthorized users cannot access unrelated bill details or PDF exports.

## Assumptions

- Validated orders and refunds are produced by separate features.
- Billing dates are interpreted as UTC calendar days.
- PDF layout uses existing organization and logo profile fields.
