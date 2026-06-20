# Feature Specification: Bill Document Cleanup

**Feature Branch**: `014-bill-document-cleanup`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "When creating a pdf or factur-x bill, for both clients and vendors, put the bill mentions at the bottom of the document. Remove the category column from pdf and factur-x documents. The SIRET (or businessRegistrationId) number must be 14 digits long. Change the 13 digit checks in the application. In the bill popup, for both vendors and clients, remove category column from the table."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate cleaner bill documents (Priority: P1)

As a vendor or client receiving a PDF or Factur-X bill, I want the bill mentions to appear at the bottom of the readable document and unnecessary category columns removed so that the bill is easier to read and keeps legal or commercial notes in a consistent document location.

**Why this priority**: Bill documents are the primary accounting artifacts. Incorrect note placement or extra columns can make generated bills look unprofessional or harder to use for vendors, clients, and accountants.

**Independent Test**: Can be fully tested by generating one vendor bill and one client bill in both PDF and Factur-X formats, then confirming the readable document puts bill mentions at the bottom and does not show a category column.

**Acceptance Scenarios**:

1. **Given** a vendor bill has bill mentions available, **When** the vendor PDF bill is generated, **Then** the bill mentions appear at the bottom of the readable document and no category column appears in the bill line table.
2. **Given** a client bill has bill mentions available, **When** the client PDF bill is generated, **Then** the bill mentions appear at the bottom of the readable document and no category column appears in the bill line table.
3. **Given** a vendor or client Factur-X bill is generated, **When** the readable invoice portion is opened, **Then** its bill mentions appear at the bottom and its line table does not include a category column.

---

### User Story 2 - Validate SIRET length consistently (Priority: P2)

As an administrator, vendor, or client account owner entering French business registration details, I want SIRET or business registration numbers to require 14 digits so that account and invoice data matches the expected French SIRET format.

**Why this priority**: A 13-digit check accepts invalid French SIRET values and can lead to incorrect party identity data on generated billing documents.

**Independent Test**: Can be tested by attempting to save or use business registration values with 13 digits, 14 digits, and non-digit characters wherever the application validates SIRET or businessRegistrationId values.

**Acceptance Scenarios**:

1. **Given** a user enters a 13-digit SIRET or businessRegistrationId value, **When** the value is validated, **Then** the system rejects it with a clear validation outcome.
2. **Given** a user enters a 14-digit numeric SIRET or businessRegistrationId value, **When** the value is validated, **Then** the system accepts the length requirement.
3. **Given** a user enters a value containing fewer than 14 digits, more than 14 digits, or non-digit characters, **When** the value is validated, **Then** the system rejects it consistently wherever SIRET or businessRegistrationId is checked.

---

### User Story 3 - Simplify bill popups (Priority: P3)

As a vendor or client reviewing a bill popup, I want the item table to omit the category column so that the popup matches generated bill documents and focuses on bill-relevant information.

**Why this priority**: The bill popup should preview the same simplified billing information users see in exported documents, reducing visual clutter and mismatches between screen and document views.

**Independent Test**: Can be tested by opening a vendor bill popup and a client bill popup and confirming the visible table no longer includes a category column while still showing all bill-critical values.

**Acceptance Scenarios**:

1. **Given** a vendor opens a bill popup, **When** the line item table is displayed, **Then** the table does not show a category column.
2. **Given** a client opens a bill popup, **When** the line item table is displayed, **Then** the table does not show a category column.
3. **Given** a bill popup contains multiple lines, **When** the category column is removed, **Then** the remaining columns remain understandable and sufficient to review the bill.

---

### Edge Cases

- A bill has no bill mentions configured; the bottom bill-mentions area should not create confusing blank content or unexpected spacing.
- Bill mentions contain multiple lines or long text that must remain readable at the bottom of generated documents.
- A bill has enough line items that the bottom bill-mentions area may move to a later page or section.
- Vendor and client document variants include different party perspectives but must apply the same bill-mentions and category-column rules.
- Existing accounts or imported records contain 13-digit businessRegistrationId values that were previously accepted.
- A registration value includes spaces, punctuation, or formatting characters around the 14 digits.
- Removing the category column leaves similar or repeated item names that still need enough context from the remaining fields.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST place bill mentions at the bottom of every generated readable PDF bill document for both vendor and client bill variants.
- **FR-002**: The system MUST place bill mentions at the bottom of the readable invoice portion of every generated Factur-X bill for both vendor and client bill variants.
- **FR-003**: The system MUST preserve the content of bill mentions exactly enough for users to recognize the saved or bill-specific text, including line breaks where supported by the document layout.
- **FR-004**: The system MUST avoid showing a bill-mentions section in generated documents when no bill mentions are available, unless an intentionally empty labeled section is required by the established document design.
- **FR-005**: The system MUST remove the category column from readable PDF bill line-item tables for both vendor and client bill variants.
- **FR-006**: The system MUST remove the category column from the readable invoice portion of Factur-X bill line-item tables for both vendor and client bill variants.
- **FR-007**: The system MUST keep the remaining bill document columns sufficient for users to identify each billed item, quantities, prices, taxes, totals, refunds, penalties, and other bill-relevant financial details.
- **FR-008**: The system MUST require SIRET or businessRegistrationId values to be exactly 14 digits wherever the application validates those values.
- **FR-009**: The system MUST reject 13-digit SIRET or businessRegistrationId values wherever those values are entered, edited, imported, or checked before bill generation.
- **FR-010**: The system MUST reject SIRET or businessRegistrationId values that contain non-digit characters after normal text entry trimming.
- **FR-011**: The system MUST provide a clear validation outcome when a SIRET or businessRegistrationId value does not satisfy the 14-digit requirement.
- **FR-012**: The system MUST remove the category column from bill popup line-item tables for both vendor and client bill popups.
- **FR-013**: The system MUST keep bill popups and generated documents aligned on whether a category column is visible.
- **FR-014**: The system MUST preserve category data for non-billing uses even though billing documents and bill popups no longer display the category column.
- **FR-015**: The system MUST apply these changes consistently to existing bills, newly generated bills, and regenerated bill views using the same available bill data.

### Key Entities *(include if feature involves data)*

- **Bill Document**: A readable vendor or client bill artifact generated as PDF or as the readable portion of a Factur-X bill, including parties, line items, totals, bill mentions, and other invoice information.
- **Bill Mentions**: Legal, commercial, or contextual invoice text associated with a bill or party and displayed in a dedicated bottom area of generated readable bill documents.
- **Business Registration Identifier**: A SIRET or businessRegistrationId value representing a French business registration number that must satisfy a strict 14-digit validation rule.
- **Bill Popup**: The vendor-facing or client-facing bill details table shown inside the application before or alongside document export.
- **Category**: Existing item classification data that may remain useful elsewhere in the application but is no longer displayed in bill documents or bill popups.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of generated vendor and client PDF sample bills with bill mentions show those mentions at the bottom of the readable document.
- **SC-002**: 100% of generated vendor and client Factur-X sample bills with bill mentions show those mentions at the bottom of the readable invoice portion.
- **SC-003**: 0 generated vendor or client PDF or Factur-X readable bill samples display a category column after the feature is complete.
- **SC-004**: 100% of SIRET or businessRegistrationId validation checks reject 13-digit values and accept valid 14-digit numeric values.
- **SC-005**: 100% of vendor and client bill popup samples omit the category column while still allowing users to review the bill's financial details.
- **SC-006**: In acceptance review, users can locate bill mentions at the bottom of generated documents within 5 seconds for representative bills that include mentions.

## Assumptions

- The request applies to all current vendor and client bill document variants that the application can generate as PDF or Factur-X.
- "Factur-X bill" includes a human-readable invoice presentation; this feature concerns that readable presentation, while structured invoice data must remain consistent with the visible bill.
- SIRET and businessRegistrationId refer to the same business registration concept for validation purposes in this application.
- The 14-digit rule is a strict numeric rule after trimming leading and trailing whitespace, not a 14-character free-text rule.
- Existing category information remains stored and available for catalog, stock, search, or reporting features outside bill documents and bill popups.
- Existing authorization rules continue to determine which users may view bill popups and generate bill documents.
