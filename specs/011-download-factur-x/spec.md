# Feature Specification: Download Factur-X

**Feature Branch**: `011-download-factur-x`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Add a « Download Factur-X » button next to « Display PDF » in the bill details view. « Download Factur-X » launches the download of a Factur-X formatted version of the bill."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Download Factur-X from bill details (Priority: P1)

As a vendor or client viewing a bill's details, I want a dedicated "Download Factur-X" action next to the existing "Display PDF" action so I can download a legally structured invoice file for accounting or e-invoicing workflows without losing the existing PDF display option.

**Why this priority**: This is the core requested user value: users must be able to obtain a Factur-X formatted version directly from the bill details view.

**Independent Test**: Can be fully tested by opening a bill details view, selecting "Download Factur-X", and confirming that a Factur-X formatted bill file is downloaded for the same bill and role.

**Acceptance Scenarios**:

1. **Given** an authorized vendor is viewing a vendor bill details view, **When** the vendor selects "Download Factur-X", **Then** the system downloads a Factur-X formatted version of that vendor bill.
2. **Given** an authorized client is viewing a client bill details view, **When** the client selects "Download Factur-X", **Then** the system downloads a Factur-X formatted version of that client bill.
3. **Given** a bill details view already offers "Display PDF", **When** the bill details actions are shown, **Then** "Download Factur-X" appears next to "Display PDF" without replacing or changing the existing display action.

---

### User Story 2 - Preserve bill-specific and role-specific content (Priority: P2)

As a vendor or client downloading a Factur-X bill, I want the downloaded file to match the bill details I am authorized to see so that my accounting records correspond to the same transaction, totals, parties, refunds, and penalties shown in the application.

**Why this priority**: A Factur-X download is useful only if it represents the same bill and respects existing vendor/client perspectives and authorization boundaries.

**Independent Test**: Can be tested by comparing the downloaded Factur-X bill against the visible bill details for a vendor bill and a client bill, including totals, parties, line items, refund lines, penalty lines, and settlement-related context where present.

**Acceptance Scenarios**:

1. **Given** a bill includes refund or penalty adjustments, **When** the Factur-X version is downloaded, **Then** the downloaded bill reflects those adjustments consistently with the bill details view.
2. **Given** a vendor and a client can view role-specific versions of a bill, **When** each downloads Factur-X from their bill details view, **Then** each receives the version appropriate to their authorized perspective.

---

### User Story 3 - Handle unavailable downloads clearly (Priority: P3)

As a vendor or client, I want clear feedback if a Factur-X download cannot be produced so that I know whether the issue is access, missing bill data, or temporary generation failure.

**Why this priority**: E-invoice generation can require complete legal invoice data; users need understandable outcomes when a download is not available.

**Independent Test**: Can be tested by attempting to download Factur-X for missing, unauthorized, or incomplete bill cases and verifying that no misleading or empty file is downloaded.

**Acceptance Scenarios**:

1. **Given** a user is not authorized to access a bill, **When** the user attempts to download Factur-X for that bill, **Then** the download is denied and no bill data is exposed.
2. **Given** required invoice data is missing for a bill, **When** the user selects "Download Factur-X", **Then** the system shows a clear failure message and does not download an invalid file.
3. **Given** the Factur-X file cannot be generated due to a temporary problem, **When** the user selects "Download Factur-X", **Then** the system keeps the bill details view usable and communicates that the download failed.

---

### Edge Cases

- The selected bill no longer exists or the bill key is invalid when the user clicks "Download Factur-X".
- The user is signed in but no longer authorized for the bill being viewed.
- The bill has zero, negative, refund, or penalty adjustment lines that affect invoice totals.
- Required legal or tax fields for a Factur-X compliant bill are missing or incomplete.
- The Factur-X file generation takes longer than expected or fails after the user clicks the button.
- The existing "Display PDF" action is still used after the new download action is added.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show a "Download Factur-X" action next to the existing "Display PDF" action in the bill details view.
- **FR-002**: The system MUST keep the existing "Display PDF" behavior available and unchanged when the new Factur-X download action is added.
- **FR-003**: Users MUST be able to download a Factur-X formatted version of the bill from the bill details view for bills they are authorized to access.
- **FR-004**: The downloaded Factur-X bill MUST represent the same bill currently shown in the details view, including the relevant parties, dates, line items, totals, refunds, penalties, and role-specific information.
- **FR-005**: The downloaded bill MUST be a Factur-X compliant invoice file containing both a human-readable bill representation and structured invoice data suitable for accounting/e-invoicing processing.
- **FR-006**: The system MUST prevent unauthorized users from downloading Factur-X versions of bills they cannot access.
- **FR-007**: The system MUST avoid downloading an invalid or empty Factur-X file when required bill, party, legal, or tax information is missing.
- **FR-008**: The system MUST provide clear user feedback when the Factur-X download is unavailable, denied, or fails.
- **FR-009**: The system MUST provide a downloaded file name that identifies the bill and indicates that the file is a Factur-X bill while remaining suitable for normal accounting storage.
- **FR-010**: The system MUST support Factur-X downloads for both vendor-side and client-side bill details when those bill details can already be viewed by the current user.

### Key Entities *(include if feature involves data)*

- **Bill**: A bill visible in the bill details view, including its unique identifier, parties, period or date, line items, totals, refunds, penalties, comments or settlement context where relevant, and authorization perspective.
- **Factur-X Bill**: The downloadable version of a bill that combines a readable invoice document with structured invoice data for accounting/e-invoicing use.
- **Bill Details View**: The screen or modal where users review bill information and access actions such as "Display PDF" and "Download Factur-X".
- **Authorized User Perspective**: The vendor-side or client-side view of a bill that determines which bill data the current user can see and download.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of bill details views that currently offer "Display PDF" also offer "Download Factur-X" next to it after the feature is available.
- **SC-002**: Authorized users can download a Factur-X formatted bill in one action from the bill details view for at least one valid vendor bill and one valid client bill.
- **SC-003**: 100% of generated Factur-X downloads for supported bills pass validation as usable Factur-X invoice files before being considered successful.
- **SC-004**: Unauthorized users receive no downloadable bill file and no exposed bill data in 100% of denied download attempts.
- **SC-005**: Under normal operation, the user receives the downloaded file or a clear failure message within 5 seconds of selecting "Download Factur-X".
- **SC-006**: In user acceptance testing, at least 90% of accounting-oriented users can identify and complete the Factur-X download without instructions beyond the button label.

## Assumptions

- The new action applies to both vendor-side and client-side bill details views because both sides can currently view bills and export bill documents.
- "Factur-X formatted version" means a PDF-based Factur-X hybrid invoice file that remains human-readable while including structured invoice data.
- Existing bill authorization rules continue to govern whether a user can access and download a bill.
- The existing "Display PDF" action remains a separate visual display/export option and is not replaced by the Factur-X download.
- If legally required invoice data is missing, producing a clear failure is preferable to generating a non-compliant Factur-X file.
