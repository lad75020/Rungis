# Feature Specification: Dedicated Bill Pages

**Feature Branch**: `015-bill-pages`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "In client dashboard page, remove the bills section. In vendor dashboard page, remove the bills section. Create a new client bill page, accessible from the client dashboard, showing all bills for the connected client with 10 visible bills in a scrollable area. Each client bill line shows the vendor organization name, bill date, bill amount with VAT, and bill payment status. Payment status appears as a green check mark when paid, an orange circle when unpaid but not late, and a red alert icon when late. Each client bill line has a received icon checkbox that sets whether the related order has been received. The client bill page filters bills by date range, vendor, and payment status. Clicking a bill line opens the existing client bill modal. Create a new vendor bill page, accessible from the vendor dashboard, showing all bills for the connected vendor with 10 visible bills in a scrollable area. Each vendor bill line shows the client organization name, bill date, bill amount with VAT, and bill reception status. Reception status appears as a grey check mark when the order has not been received and a green check mark when received. Each vendor bill line has a paid icon checkbox that sets whether the bill has been paid. The vendor bill page filters bills by date range, client, and reception status. Clicking a bill line opens the existing vendor bill modal."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Client reviews and manages bills (Priority: P1)

As a connected client, I want a dedicated bill page that lists my bills, shows who billed me, highlights payment urgency, and lets me mark orders as received so that I can manage billing follow-up without cluttering my dashboard.

**Why this priority**: Client bill visibility and received-order confirmation are the primary user value for this feature and replace the bill section currently embedded in the client dashboard.

**Independent Test**: Can be fully tested by signing in as a client, opening the bill page from the dashboard, reviewing the visible bill list, filtering it, marking an order received, and opening a bill detail modal.

**Acceptance Scenarios**:

1. **Given** a connected client with more than 10 bills, **When** the client opens the bill page from the dashboard, **Then** the page shows a scrollable bill list with 10 bill rows visible at once.
2. **Given** a client bill is paid, unpaid but not late, or late, **When** the bill appears in the list, **Then** its payment status is shown respectively as a green check mark, orange circle, or red alert icon.
3. **Given** a client bill is displayed, **When** the client activates the received icon checkbox on that row, **Then** the related order reception status is updated and the row reflects the new state.
4. **Given** the client needs to narrow the list, **When** the client applies a date range, vendor, or payment status filter, **Then** only matching bills remain visible.
5. **Given** the client clicks a bill row outside the received checkbox, **When** the row is selected, **Then** the existing client bill modal opens for that bill.

---

### User Story 2 - Vendor reviews and manages bills (Priority: P2)

As a connected vendor, I want a dedicated bill page that lists the bills I issued, shows which clients received their orders, and lets me mark bills as paid so that I can track settlement work outside the dashboard.

**Why this priority**: Vendors need the symmetric workflow to track receivables, reception status, and payment state after bills are removed from the vendor dashboard.

**Independent Test**: Can be fully tested by signing in as a vendor, opening the bill page from the dashboard, reviewing the visible bill list, filtering it, marking a bill paid, and opening a bill detail modal.

**Acceptance Scenarios**:

1. **Given** a connected vendor with more than 10 bills, **When** the vendor opens the bill page from the dashboard, **Then** the page shows a scrollable bill list with 10 bill rows visible at once.
2. **Given** a vendor bill's related order has or has not been received, **When** the bill appears in the list, **Then** its reception status is shown respectively as a green check mark or grey check mark icon.
3. **Given** a vendor bill is displayed, **When** the vendor activates the paid icon checkbox on that row, **Then** the bill payment status is updated and the row reflects the new state.
4. **Given** the vendor needs to narrow the list, **When** the vendor applies a date range, client, or reception status filter, **Then** only matching bills remain visible.
5. **Given** the vendor clicks a bill row outside the paid checkbox, **When** the row is selected, **Then** the existing vendor bill modal opens for that bill.

---

### User Story 3 - Dashboards stay focused (Priority: P3)

As a client or vendor, I want the dashboard to provide access to bills without embedding the full bill section so that the dashboard remains focused on summary actions while detailed bill work happens on a dedicated page.

**Why this priority**: This completes the information-architecture change by removing duplicate bill management from both dashboards while preserving discoverability.

**Independent Test**: Can be tested by opening each dashboard and confirming that the previous bills section is absent and a clear entry point to the dedicated bill page is available.

**Acceptance Scenarios**:

1. **Given** a connected client opens the client dashboard, **When** the dashboard is displayed, **Then** the previous bills section is no longer shown and a bill page entry point is available.
2. **Given** a connected vendor opens the vendor dashboard, **When** the dashboard is displayed, **Then** the previous bills section is no longer shown and a bill page entry point is available.

---

### Edge Cases

- When a connected client or vendor has no bills, the bill page shows an empty-state message and still displays the available filters.
- When filters produce no matches, the page shows a no-results state and allows the user to clear or change filters.
- When there are exactly 10 bills, all bills are visible without needing to scroll; when there are more than 10, scrolling reveals the remaining bills.
- When a bill is unpaid and its payment due date has passed, it is considered late and uses the red alert payment status.
- When a bill lacks an expected organization display name, the row uses a safe fallback label rather than hiding the bill.
- When the user activates a row checkbox, the checkbox action updates status without also opening the bill modal.
- When a status update cannot be completed, the user sees a failure message and the row remains consistent with the last confirmed status.
- When a date range has only a start date or only an end date, the filter applies the provided bound only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST remove the embedded bills section from the client dashboard.
- **FR-002**: The system MUST remove the embedded bills section from the vendor dashboard.
- **FR-003**: The client dashboard MUST provide a clear entry point to a dedicated client bill page.
- **FR-004**: The vendor dashboard MUST provide a clear entry point to a dedicated vendor bill page.
- **FR-005**: The client bill page MUST show all bills associated with the connected client.
- **FR-006**: The vendor bill page MUST show all bills associated with the connected vendor.
- **FR-007**: Each dedicated bill page MUST display its bill list in a scrollable area with 10 bill rows visible at once when at least 10 bills exist.
- **FR-008**: Each client bill row MUST show the vendor organization name, bill date, VAT-inclusive bill amount, and payment status.
- **FR-009**: Client bill payment status MUST be represented as a green check mark when paid, an orange circle when unpaid and not late, and a red alert icon when unpaid and late.
- **FR-010**: Each client bill row MUST include a received icon checkbox that lets the client set whether the related order was received.
- **FR-011**: The client bill page MUST allow filtering by bill date range, vendor, and payment status.
- **FR-012**: Selecting a client bill row outside its received checkbox MUST open the existing client bill detail modal for that bill.
- **FR-013**: Each vendor bill row MUST show the client organization name, bill date, VAT-inclusive bill amount, and reception status.
- **FR-014**: Vendor bill reception status MUST be represented as a grey check mark when the related order has not been received and a green check mark when it has been received.
- **FR-015**: Each vendor bill row MUST include a paid icon checkbox that lets the vendor set whether the bill has been paid.
- **FR-016**: The vendor bill page MUST allow filtering by bill date range, client, and reception status.
- **FR-017**: Selecting a vendor bill row outside its paid checkbox MUST open the existing vendor bill detail modal for that bill.
- **FR-018**: Filter controls MUST support returning to an unfiltered list without requiring the user to leave the page.
- **FR-019**: Status changes made from a bill row MUST provide clear feedback for success or failure.
- **FR-020**: The bill pages MUST prevent users from viewing or changing bills that do not belong to their connected organization role.

### Key Entities *(include if feature involves data)*

- **Bill**: A billing record associated with a vendor and a client, including bill date, VAT-inclusive amount, payment status, due/late status, and detail content shown in the existing bill modal.
- **Organization**: The client or vendor organization displayed on bill rows so users can identify the counterparty for each bill.
- **Reception Status**: Whether the order related to a bill has been received by the client; visible to both roles and editable by the connected client from the client bill page.
- **Payment Status**: Whether the bill has been paid and, when unpaid, whether payment is late; visible to both roles and editable by the connected vendor from the vendor bill page.
- **Bill Filters**: The active date range, organization selector, and status selector that determine which bills are displayed on a dedicated bill page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of client and vendor users can reach their dedicated bill page from their dashboard in one visible action.
- **SC-002**: Users with more than 10 bills can see exactly 10 bill rows at once and can reach additional bills by scrolling the list area.
- **SC-003**: 100% of bill rows on the client page display vendor name, bill date, VAT-inclusive amount, payment status icon, and received checkbox.
- **SC-004**: 100% of bill rows on the vendor page display client name, bill date, VAT-inclusive amount, reception status icon, and paid checkbox.
- **SC-005**: Users can reduce a bill list by date range and counterparty/status filters in under 30 seconds for a typical review task.
- **SC-006**: At least 95% of status update attempts during normal operation complete with a visible success or failure outcome within 2 seconds.
- **SC-007**: Users can open the detail modal for any visible bill with a single row selection.
- **SC-008**: Dashboard bill-management space is reduced to navigation only while preserving access to all existing bill detail information.

## Assumptions

- The connected user already has an authenticated client or vendor role and belongs to exactly one active organization for the relevant dashboard.
- "All bills" means all existing bills associated with the connected organization, subject to the same role-based access boundaries already used for bill details.
- Bill date filters apply inclusively to the displayed bill date.
- A late bill is an unpaid bill whose due date or existing overdue rule marks it as past due.
- Vendor and client dropdowns list only counterparties present in the connected user's accessible bill set.
- The existing client and vendor bill modals remain the source of detailed bill viewing behavior.
- The received checkbox changes the reception status of the order related to the bill; the paid checkbox changes the payment status of the bill.
