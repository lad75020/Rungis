# Feature Specification: Rungis Fee Bills

**Feature Branch**: `013-rungis-fee-bills`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "In the admin page, the admin user can set up a rate in %, called « Rungis fee ». It is persisted in the sqlite database. In the admin page, the admin sets up a VAT rate in %. A new button must be created in admin page called « Send Rungis bills ». When clicked, the following calculation is made: sum up all order gross amount before tax received by a vendor during the previous calendar month; sum up order gross amount before tax placed by a client during the previous calendar month; persist a document in a mongodb database new collection called rungisbills with the following information: applicable month and year, gross amount before tax, Rungis fee, user unique id, payable amount = Rungis fee * gross amount and finally a « paid » boolean flag, false by default. In the user dashboard, display a € icon. When clicked a modal pops up with a user invoice mentioning the applicable month, admin organization details at top left, user organization details at top right, monthly gross order amount before tax, payable amount before tax, admin VAT rate, payable amount including VAT, with PDF view and Factur-X download. In the admin page, search Rungis bills by user organization name and month using a year/month picker; mark a Rungis bill as paid so it disappears from search results and the paid boolean is persisted."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Rungis billing rates (Priority: P1)

As an admin, I want to set the Rungis fee percentage and the VAT percentage from the admin page so that monthly Rungis bills use current, explicit billing rates controlled by the marketplace.

**Why this priority**: Monthly bill generation cannot be correct unless the admin can define the fee and VAT rates before bills are sent.

**Independent Test**: Can be fully tested by entering valid Rungis fee and VAT percentages in the admin page, saving them, leaving the page, and returning to confirm both rates are still available for bill generation.

**Acceptance Scenarios**:

1. **Given** an authenticated admin opens the admin page, **When** the admin enters a valid Rungis fee percentage and saves, **Then** the system persists the Rungis fee and shows the saved value when the admin page is reopened.
2. **Given** an authenticated admin opens the admin page, **When** the admin enters a valid VAT percentage and saves, **Then** the system persists the VAT rate and shows the saved value when the admin page is reopened.
3. **Given** an admin enters an invalid percentage value, **When** the admin attempts to save, **Then** the system rejects the value with a clear validation message and keeps the previous valid setting.

---

### User Story 2 - Generate previous-month Rungis bills (Priority: P1)

As an admin, I want a "Send Rungis bills" button that creates monthly Rungis bills for the previous calendar month so that vendors and clients can be charged their marketplace fee based on eligible order activity.

**Why this priority**: This is the core billing workflow requested by the feature: calculating each vendor/client monthly gross amount before tax and creating persisted Rungis bill records.

**Independent Test**: Can be tested by preparing validated orders in the previous calendar month, clicking "Send Rungis bills", and confirming that one unpaid Rungis bill is created for each eligible vendor-side and client-side monthly total with correct gross amount, fee, payable before tax, applicable month/year, and user unique id.

**Acceptance Scenarios**:

1. **Given** orders received by a vendor during the previous calendar month, **When** the admin clicks "Send Rungis bills", **Then** the system creates a Rungis bill for that vendor using the sum of those orders' gross amount before tax.
2. **Given** orders placed by a client during the previous calendar month, **When** the admin clicks "Send Rungis bills", **Then** the system creates a Rungis bill for that client using the sum of those orders' gross amount before tax.
3. **Given** the Rungis fee is configured as a percentage, **When** a Rungis bill is generated, **Then** the payable amount before tax equals the gross amount before tax multiplied by the fee percentage and divided by 100, with documented currency rounding.
4. **Given** Rungis bills were already generated for the same user, role, and month, **When** the admin clicks "Send Rungis bills" again, **Then** the system does not create duplicate unpaid bills for the same billing scope.

---

### User Story 3 - View and export the user Rungis invoice (Priority: P2)

As a vendor or client, I want a € icon on my dashboard that opens my Rungis invoice so that I can understand the monthly gross amount, the Rungis fee, VAT, and the amount I owe, then view or download accounting documents.

**Why this priority**: Users need transparent access to the generated bill details and document exports after bills are created.

**Independent Test**: Can be tested by signing in as a vendor or client with an unpaid Rungis bill, clicking the dashboard € icon, and verifying the invoice modal displays the expected month, parties, amounts, VAT rate, VAT-inclusive amount, and both PDF viewing and Factur-X download actions.

**Acceptance Scenarios**:

1. **Given** a vendor or client has a Rungis bill, **When** they click the dashboard € icon, **Then** a modal opens with the Rungis invoice for the applicable month.
2. **Given** the invoice modal is shown, **When** the user reviews the header, **Then** admin organization name, logo, city, zipcode, physical address, phone number, and businessRegistrationId appear at the top left, and the user's corresponding organization information appears at the top right.
3. **Given** the invoice modal is shown, **When** the user reviews totals, **Then** it displays the monthly gross order amount before tax, payable amount before tax, admin VAT rate, and payable amount including VAT in euros.
4. **Given** the invoice modal is shown, **When** the user selects "View PDF" or "Download Factur-X", **Then** the system provides the same Rungis invoice content in the selected document format.

---

### User Story 4 - Search and mark unpaid Rungis bills paid (Priority: P3)

As an admin, I want to search unpaid Rungis bills by user organization name and billing month, then mark a bill as paid so that paid invoices are removed from the working list and remain recorded as paid.

**Why this priority**: Admins need operational follow-up after bills are generated, but this depends on bills existing first.

**Independent Test**: Can be tested by generating multiple unpaid bills, filtering by organization name and a year/month picker, marking one result as paid, and confirming it no longer appears in unpaid search results while its paid status remains saved.

**Acceptance Scenarios**:

1. **Given** unpaid Rungis bills exist for multiple users and months, **When** the admin searches by a partial or full user organization name and selected year/month, **Then** only unpaid matching bills are shown.
2. **Given** an unpaid Rungis bill appears in admin search results, **When** the admin marks it as paid, **Then** the bill is saved as paid and disappears from the unpaid search results.
3. **Given** a Rungis bill has already been marked paid, **When** the admin repeats or refreshes the search, **Then** the bill remains excluded from unpaid results.

---

### Edge Cases

- The admin clicks "Send Rungis bills" before a valid Rungis fee or VAT rate has been configured.
- The previous calendar month has no eligible orders for a vendor or client.
- A user acts as both vendor and client in the same month, requiring role-specific bill totals to avoid mixing received and placed order amounts.
- The admin clicks "Send Rungis bills" multiple times for the same applicable month.
- A Rungis fee or VAT rate changes after bills have already been generated for a month.
- Currency rounding affects payable before tax, VAT amount, or payable including VAT.
- Required admin or user organization details are missing when displaying or exporting an invoice.
- A user without a Rungis bill clicks the dashboard € icon.
- An admin marks a bill paid while another admin is viewing the same search result.
- A paid bill must remain auditable even though it is hidden from unpaid search results.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an admin-editable "Rungis fee" percentage setting.
- **FR-002**: The system MUST persist the Rungis fee setting so it remains available across admin sessions and bill generation runs.
- **FR-003**: The system MUST provide an admin-editable VAT percentage setting for Rungis bills.
- **FR-004**: The system MUST persist the VAT setting so it remains available across admin sessions and bill generation runs.
- **FR-005**: The system MUST validate Rungis fee and VAT settings as numeric percentages that are not negative and are suitable for invoice calculation.
- **FR-006**: The admin page MUST include a "Send Rungis bills" action available to authorized admin users.
- **FR-007**: When "Send Rungis bills" is triggered, the system MUST determine the previous calendar month and use that as the applicable billing month and year.
- **FR-008**: For each vendor with eligible orders received during the previous calendar month, the system MUST sum the orders' gross amount before tax and generate an unpaid Rungis bill for that vendor.
- **FR-009**: For each client with eligible orders placed during the previous calendar month, the system MUST sum the orders' gross amount before tax and generate an unpaid Rungis bill for that client.
- **FR-010**: Each Rungis bill MUST record the applicable month and year, gross amount before tax, Rungis fee percentage used, user unique id, payable amount before tax, and a paid flag that defaults to false.
- **FR-011**: Each Rungis bill SHOULD record whether it represents the vendor-side or client-side monthly total so that a user who has both roles can receive distinct bills without ambiguity.
- **FR-012**: The payable amount before tax MUST equal the bill's gross amount before tax multiplied by the bill's Rungis fee percentage and divided by 100, after applying documented currency rounding.
- **FR-013**: Rungis bill generation MUST avoid creating duplicate unpaid bills for the same user, role, and applicable month/year.
- **FR-014**: Rungis bill generation MUST preserve already-paid bills and MUST NOT reset a paid bill back to unpaid.
- **FR-015**: Vendor and client dashboards MUST display a € icon that lets users access their Rungis invoice when a Rungis bill is available to them.
- **FR-016**: The € icon MUST open a modal invoice view for the user's applicable Rungis bill without exposing another user's invoice.
- **FR-017**: The modal invoice MUST show the applicable month, the monthly gross order amount before tax in euros, the payable amount before tax in euros, the admin VAT rate, and the payable amount including VAT in euros.
- **FR-018**: The payable amount including VAT MUST equal the payable amount before tax plus VAT calculated from the admin VAT rate, after applying documented currency rounding.
- **FR-019**: The modal invoice MUST show the admin organization's name, logo, city, zipcode, physical address, phone number, and businessRegistrationId at the top left.
- **FR-020**: The modal invoice MUST show the user's organization name, logo, city, zipcode, physical address, phone number, and businessRegistrationId at the top right.
- **FR-021**: Users MUST be able to view the Rungis invoice as a PDF from the invoice modal.
- **FR-022**: Users MUST be able to download the Rungis invoice as a Factur-X file from the invoice modal.
- **FR-023**: PDF and Factur-X invoice outputs MUST contain the same parties, applicable month, gross amount before tax, Rungis fee, payable before tax, VAT rate, and payable including VAT shown in the modal.
- **FR-024**: The admin page MUST let admins search unpaid Rungis bills by user organization name.
- **FR-025**: The admin page MUST let admins filter unpaid Rungis bills by applicable billing month using a year/month picker.
- **FR-026**: Admin search results MUST exclude bills whose paid flag is true.
- **FR-027**: Authorized admins MUST be able to mark an unpaid Rungis bill as paid from the admin page.
- **FR-028**: When an admin marks a Rungis bill as paid, the system MUST persist the paid flag as true and remove the bill from unpaid search results.
- **FR-029**: The system MUST provide clear feedback when bill generation, invoice display, PDF viewing, Factur-X download, searching, or marking paid cannot be completed.

### Key Entities *(include if feature involves data)*

- **Rungis Billing Settings**: Admin-controlled percentages for the Rungis fee and VAT rate used to calculate monthly Rungis bills.
- **Eligible Order Total**: The sum of gross order amounts before tax for a specific user, role, and previous calendar month; vendor totals use received orders, client totals use placed orders.
- **Rungis Bill**: A persisted monthly fee invoice record for a user, including applicable month/year, user unique id, user role perspective, gross amount before tax, Rungis fee percentage, payable amount before tax, VAT rate used for invoice display, payable amount including VAT, and paid status.
- **Rungis Invoice Modal**: The dashboard view opened from the € icon that presents a user's Rungis bill with admin and user organization identity details and document export actions.
- **Organization Identity**: The legal/display information used on invoices for the admin organization and billed user organization: name, logo, city, zipcode, physical address, phone number, and businessRegistrationId.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of authorized admin users can save valid Rungis fee and VAT percentages and see the same values after reopening the admin page.
- **SC-002**: 100% of invalid percentage saves are rejected with a clear message and do not replace the previous valid settings.
- **SC-003**: For representative previous-month data, generated vendor and client Rungis bills match the expected gross amount before tax and payable before tax totals in 100% of checked cases.
- **SC-004**: Re-running "Send Rungis bills" for the same month does not create duplicate unpaid bills for the same user and role in 100% of tested repeat runs.
- **SC-005**: Authorized vendors and clients can open their Rungis invoice from the dashboard € icon and see all required party and amount fields within 5 seconds during normal operation.
- **SC-006**: 100% of Rungis invoice PDFs and Factur-X downloads for valid bills contain totals and party information consistent with the on-screen invoice.
- **SC-007**: Admin unpaid bill search returns only unpaid bills matching the chosen organization-name query and year/month filter in 100% of tested search cases.
- **SC-008**: After an admin marks a bill paid, the bill disappears from unpaid search results immediately and remains paid after page refresh in 100% of tested cases.
- **SC-009**: Unauthorized users cannot view, export, search, or mark paid Rungis bills outside their permitted role in 100% of access-control tests.

## Assumptions

- The previous calendar month is calculated relative to the date on which the admin clicks "Send Rungis bills".
- Only users with a positive eligible monthly gross order amount before tax receive generated Rungis bills; zero-activity users are not billed.
- Bills are role-specific: a user who both receives orders as a vendor and places orders as a client can receive separate Rungis bills for the same applicable month.
- The Rungis fee and VAT percentages captured on a generated bill remain the rates used for that bill even if the admin changes settings later.
- The feature request explicitly requires the Rungis fee setting to be persisted in SQLite and Rungis bill records to be persisted in a MongoDB collection named `rungisbills`; these are implementation constraints for planning, while this specification describes the user-visible behavior and data semantics.
- The user's existing `uniqueId` is the billed user identifier recorded on each Rungis bill.
- Existing organization profile fields provide the admin and user invoice identity values; if required fields are missing, the system should block document generation or display a clear completion request rather than producing an incomplete invoice.
- "Paid" is the persisted bill status flag; admin UI labels may say "paid" even if existing copy elsewhere uses "payed".
