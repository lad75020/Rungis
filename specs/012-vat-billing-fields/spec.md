# Feature Specification: VAT Billing Fields

**Feature Branch**: `012-vat-billing-fields`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "In vendor account settings screen add the following fields: VAT ID: a 13 character text field; bill mentions: a 4 line high text area. Use VAT ID and bill mentions to populate the corresponding fields when generating a Factur-X bill. Currently all prices on screen and in the database exclude VAT: add a VAT percentage value field to the merchandise creation form in vendor stocks screen; each merchandise has its own VAT value; store VAT value per merchandise in the database; in all screens and all PDF or Factur-X documents, add a price including VAT field."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain vendor invoice identity fields (Priority: P1)

As a vendor, I want to enter my VAT ID and reusable bill mentions in my account settings so that generated bills contain the legal and commercial text required for my organization.

**Why this priority**: Factur-X bills require reliable seller invoice identity data; without these vendor-level fields, generated e-invoices can be incomplete or unsuitable for accounting.

**Independent Test**: Can be fully tested by opening vendor account settings, saving a 13-character VAT ID and multi-line bill mentions, leaving and returning to the screen, and confirming the values are still present and ready for billing.

**Acceptance Scenarios**:

1. **Given** an authenticated vendor opens account settings, **When** the vendor enters a valid 13-character VAT ID and saves, **Then** the VAT ID is stored with the vendor account and visible again on the settings screen.
2. **Given** an authenticated vendor opens account settings, **When** the vendor enters bill mentions using up to four visible lines and saves, **Then** the bill mentions are stored with the vendor account and visible again on the settings screen.
3. **Given** a vendor enters a VAT ID that is not exactly 13 characters, **When** the vendor attempts to save, **Then** the system rejects the value with a clear validation message and does not silently alter it.

---

### User Story 2 - Apply vendor billing fields to Factur-X bills (Priority: P2)

As a vendor, I want my saved VAT ID and bill mentions to be included in generated Factur-X bills so that downloaded or shared invoices consistently contain the corresponding seller tax identifier and invoice notes.

**Why this priority**: The new account settings fields deliver business value only when bill generation uses them consistently in both the readable invoice and structured invoice data.

**Independent Test**: Can be tested by saving vendor VAT ID and bill mentions, generating a Factur-X bill for that vendor, and verifying the generated bill contains those values in the appropriate seller and invoice-note fields.

**Acceptance Scenarios**:

1. **Given** a vendor has a saved VAT ID, **When** a Factur-X bill is generated for that vendor, **Then** the bill includes that VAT ID in the seller tax identity information.
2. **Given** a vendor has saved bill mentions, **When** a Factur-X bill is generated for that vendor, **Then** the bill includes those mentions in the invoice notes or visible bill text intended for that purpose.
3. **Given** a vendor has not completed required billing identity data, **When** the system cannot produce a compliant Factur-X bill, **Then** it provides a clear failure reason instead of generating a misleading or incomplete bill.

---

### User Story 3 - Define merchandise VAT and gross prices (Priority: P3)

As a vendor, I want to assign a VAT percentage to each merchandise item and see prices including VAT throughout the product and billing experience so that vendors and clients understand both tax-exclusive and tax-inclusive amounts.

**Why this priority**: Prices currently exclude VAT; per-merchandise VAT is required to calculate and display tax-inclusive prices accurately across ordering, stock, PDF, and Factur-X billing flows.

**Independent Test**: Can be tested by creating merchandise with a VAT percentage, viewing that merchandise wherever prices appear, and confirming the price including VAT is shown and matches the tax-exclusive price plus the merchandise VAT.

**Acceptance Scenarios**:

1. **Given** a vendor creates merchandise in the stocks screen, **When** the vendor enters a valid VAT percentage and saves, **Then** the merchandise stores that VAT percentage as part of the item data.
2. **Given** merchandise has a tax-exclusive price and VAT percentage, **When** any screen displays that merchandise price, **Then** the screen displays both the existing tax-exclusive price and the calculated price including VAT.
3. **Given** a PDF bill or Factur-X bill contains merchandise lines, **When** the document is generated, **Then** each applicable line and total includes tax-exclusive amount, VAT percentage, VAT amount where relevant, and price including VAT.

---

### Edge Cases

- A vendor attempts to save a VAT ID with fewer or more than 13 characters, leading/trailing spaces, or unsupported characters.
- Bill mentions are empty, contain multiple lines, or exceed the visible four-line editing area.
- A merchandise VAT percentage is missing for an existing merchandise item created before this feature.
- A merchandise VAT percentage is zero or uses a decimal value common for VAT rates.
- A vendor attempts to save a negative VAT percentage or a VAT percentage above a reasonable maximum.
- Price including VAT calculations create rounding differences at line, subtotal, and grand-total level.
- Bills contain multiple merchandise lines with different VAT percentages.
- Bills contain refund, adjustment, zero-quantity, or negative lines that must remain consistent with VAT-inclusive totals.
- A document is generated for a vendor whose VAT ID or bill mentions changed after older merchandise or orders were created.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a VAT ID field on the vendor account settings screen.
- **FR-002**: The VAT ID field MUST accept only values that are exactly 13 characters after normal text entry trimming.
- **FR-003**: The system MUST provide a bill mentions text area on the vendor account settings screen with a visible editing height of four text lines.
- **FR-004**: The system MUST persist each vendor's VAT ID and bill mentions so the values remain available across sessions and future bill generation.
- **FR-005**: The system MUST use the vendor's saved VAT ID to populate the corresponding seller VAT/tax identifier field when generating a Factur-X bill for that vendor.
- **FR-006**: The system MUST use the vendor's saved bill mentions to populate the corresponding invoice note or bill mention field when generating a Factur-X bill for that vendor.
- **FR-007**: The system MUST add a VAT percentage field to merchandise creation in the vendor stocks screen.
- **FR-008**: The system MUST persist a VAT percentage independently for each merchandise item.
- **FR-009**: The system MUST validate merchandise VAT percentages as numeric percentages that are not negative and are suitable for VAT calculation.
- **FR-010**: The system MUST preserve existing tax-exclusive prices as the base price while adding a calculated price including VAT.
- **FR-011**: The system MUST calculate each merchandise price including VAT from the merchandise tax-exclusive price and that merchandise's own VAT percentage.
- **FR-012**: The system MUST display price including VAT wherever merchandise or bill prices are shown on screen, while keeping the existing tax-exclusive price visible.
- **FR-013**: The system MUST include price including VAT in every generated PDF bill and Factur-X bill wherever merchandise line prices, subtotals, or totals are presented.
- **FR-014**: The system MUST include per-merchandise VAT percentages and VAT-inclusive amounts in bill generation so bills with multiple VAT rates remain accurate.
- **FR-015**: The system MUST clearly handle merchandise that lacks a VAT percentage, either by requiring the vendor to provide one before affected actions proceed or by applying an explicit documented default shown to the user.
- **FR-016**: The system MUST keep VAT-exclusive, VAT amount, and VAT-inclusive totals internally consistent across screens, PDFs, and Factur-X bills for the same bill.
- **FR-017**: The system MUST prevent generated Factur-X bills from claiming VAT data that is missing, invalid, or inconsistent with the visible bill.

### Key Entities *(include if feature involves data)*

- **Vendor Billing Profile**: Vendor-owned billing identity and document text settings, including VAT ID and bill mentions used during invoice generation.
- **Merchandise**: A vendor-owned catalog item with a tax-exclusive price and its own VAT percentage used to derive price including VAT.
- **Price Presentation**: The user-facing display of tax-exclusive price, VAT percentage or VAT amount where relevant, and price including VAT.
- **Bill Document**: A generated PDF or Factur-X bill containing seller billing data, merchandise lines, VAT details, tax-exclusive totals, VAT amounts, and VAT-inclusive totals.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of vendor account settings screens show editable VAT ID and bill mentions fields to authenticated vendors.
- **SC-002**: 100% of invalid VAT ID save attempts with a length other than 13 characters are rejected with a clear message.
- **SC-003**: A vendor can save or update VAT ID and bill mentions in under 30 seconds during normal operation.
- **SC-004**: 100% of newly created merchandise items require or store a VAT percentage before they can be used for VAT-inclusive price display.
- **SC-005**: Across representative merchandise examples, displayed price including VAT equals the tax-exclusive price plus the item's VAT amount after documented currency rounding.
- **SC-006**: 100% of screens that display merchandise or bill prices also display the price including VAT after the feature is available.
- **SC-007**: 100% of generated PDF and Factur-X bills for merchandise with VAT data include VAT-inclusive line and total amounts consistent with on-screen bill data.
- **SC-008**: In acceptance testing, vendors and clients can identify the VAT-inclusive price in all primary catalog, order, stock, bill detail, and document views without external instructions.

## Assumptions

- Existing prices remain tax-exclusive and continue to be stored and shown for auditability and continuity.
- VAT ID is treated as a strict 13-character seller identifier because the feature request specified that length.
- Bill mentions are vendor-defined invoice text and may be empty unless the business later makes them mandatory.
- VAT percentage is merchandise-specific and may differ between items on the same bill.
- Price including VAT is a derived amount calculated from tax-exclusive price and VAT percentage, not a replacement for the existing tax-exclusive price.
- Generated Factur-X bills must keep structured invoice data and the human-readable bill representation consistent.
- Existing authorization rules continue to determine which vendors can edit account settings, create merchandise, and generate or view bill documents.
