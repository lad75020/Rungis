# Feature Specification: Analytics and Reporting

**Feature Branch**: `feature/time-machine-analytics-reporting`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Analytics and Reporting. Description: Admins and vendors view activated-order, category sales, client sales, and monthly summary reports. Relevant files: backend/src/routes/modules/management.js, backend/src/models/validated-order.model.js, backend/src/models/bill.model.js, frontend/src/app/pages/statistics-page.component.ts, frontend/src/app/pages/statistics-page.component.html, frontend/src/app/app.view-models.ts, frontend/src/app/app.ts, frontend/src/app/app.types.ts. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View admin activated-order reports (Priority: P1)

As an administrator, I want activated-order statistics by date range so I can monitor overall order activity.

**Why this priority**: Admin reporting gives global operational visibility.

**Independent Test**: Load admin statistics for a valid date range and verify daily order count and amount rows.

**Acceptance Scenarios**:

1. **Given validated orders exist**, **When** an admin queries a date range, **Then** daily order totals are returned.
2. **Given an invalid date range is supplied**, **When** statistics are requested, **Then** the system rejects it.

---

### User Story 2 - View vendor sales breakdowns (Priority: P2)

As a vendor, I want sales by category and by client so I can understand demand and customer contribution.

**Why this priority**: Vendor breakdowns support inventory and sales decisions.

**Independent Test**: Load vendor category and client sales reports and verify only that vendor items are included.

**Acceptance Scenarios**:

1. **Given vendor orders exist**, **When** sales by category loads, **Then** totals are grouped by item category.
2. **Given vendor orders exist**, **When** sales by client loads, **Then** totals are grouped by client.

---

### User Story 3 - Review monthly summaries (Priority: P3)

As a vendor, I want monthly bill summaries by client so I can reconcile billed revenue over time.

**Why this priority**: Monthly summaries support back-office reconciliation.

**Independent Test**: Select a month and optional client filter and verify the summary totals match bills.

**Acceptance Scenarios**:

1. **Given bills exist for a month**, **When** the monthly summary loads, **Then** totals are grouped as configured.
2. **Given a client filter is used**, **When** the summary loads, **Then** unrelated clients are excluded.

---

### Edge Cases

- Date filters must reject malformed dates and inverted ranges.
- Vendor reports must include only items owned by the current vendor.
- Empty report periods must return empty rows rather than errors.
- Amounts must be rounded consistently to two decimals.
- Client filters must be limited to clients associated with the vendor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let admins query activated order statistics by date range.
- **FR-002**: The system MUST let vendors query sales totals by category.
- **FR-003**: The system MUST let vendors query sales totals by client.
- **FR-004**: The system MUST let vendors list clients eligible for monthly summary filters.
- **FR-005**: The system MUST let vendors query monthly bill summaries.
- **FR-006**: The system MUST enforce admin and vendor roles on reporting endpoints.
- **FR-007**: The system MUST reject invalid date filters with clear messages.

### Key Entities *(include if feature involves data)*

- **Activated Order Report Row**: A daily order count and amount aggregate.
- **Category Sales Row**: A vendor category and total amount aggregate.
- **Client Sales Row**: A vendor-client sales aggregate.
- **Monthly Summary Row**: A bill-derived monthly total for vendor reconciliation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can retrieve a valid activated-order report in under 3 seconds during normal operation.
- **SC-002**: Vendor reports never include another vendors item totals.
- **SC-003**: Invalid date filters are rejected consistently across report endpoints.
- **SC-004**: Empty report periods return successful empty datasets.

## Assumptions

- Reports are implementation-derived aggregates over validated orders and bills.
- Amounts are expressed in EUR.
- Charts and tables consume the same endpoint data.
