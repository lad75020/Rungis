# Research: Download Factur-X

## Decision: Add separate `/factur-x` download endpoints instead of changing existing `/pdf` endpoints

**Rationale**: The feature requires a new "Download Factur-X" action next to the existing "Display PDF" action. Keeping `/api/bills/vendor/:key/pdf` and `/api/bills/client/:key/pdf` unchanged preserves current inline PDF display behavior. New endpoints make the user intent and response disposition explicit while reusing existing bill key parsing and role guards.

**Alternatives considered**:

- Replace `/pdf` output with Factur-X: rejected because the spec explicitly keeps "Display PDF" next to the new action and users may still need inline visual display.
- Add a query flag to `/pdf`: rejected because it makes authorization, caching, and frontend intent less obvious than a dedicated download route.

## Decision: Default to Factur-X EN 16931 and fail closed when required data is missing

**Rationale**: Factur-X production invoices should target EN 16931 when the Rungis model can provide required legal/tax fields. Missing seller/buyer country, VAT status, legal IDs, VAT category/rate, payment/due-date, or unit-code semantics should block the download with a clear user-facing failure rather than producing a non-compliant file.

**Alternatives considered**:

- Generate MINIMUM or BASIC WL: rejected because those profiles are not appropriate as legal production bill replacements for this feature.
- Silently default missing VAT/legal values: rejected because the implementation must not fabricate legal invoice data.

## Decision: Use the mandatory npm `factur-x` package and add validation wrappers around it

**Rationale**: The project-specific Factur-X guidance requires the npm package `factur-x` for reading and writing Factur-X formatted bills. `npm view factur-x` reports version `0.0.2` with the description "Reading and writing hydrid invoice documents (EN 16931, ZUGFeRD, Factur-X) with Typescript." The implementation must still validate generated output against required XML, embedded attachment, XMP, and PDF/A expectations because package version support may not prove full Factur-X 1.09 compliance by itself.

**Alternatives considered**:

- Hand-roll PDF/A-3 embedded-file dictionaries and XMP: rejected by project guidance and too risky for compliance.
- Use another ZUGFeRD/Factur-X library: rejected unless the user explicitly changes the dependency requirement.

## Decision: Normalize bill data once before rendering XML and readable PDF

**Rationale**: A single `InvoiceFacturXData` object keeps the visible invoice, XML, totals, and validation aligned. Existing vendor/client bill routes already gather bill details, parties, persisted bill UUID, refund lines, penalty lines, totals, and currency. The new service should convert these into explicit party, line, VAT, and total entities, then use that object for both readable PDF content and structured XML.

**Alternatives considered**:

- Generate XML directly from route-local variables: rejected because vendor and client routes would drift and repeated logic would increase compliance risk.
- Generate PDF first and infer XML from it: rejected because structured invoice data requires semantic fields not reliably represented in the current visual PDF.

## Decision: Treat existing refund lines as negative invoice lines unless a future feature creates standalone credit notes

**Rationale**: Current Rungis bills include refund lines and penalty lines inside the same daily bill details. The Factur-X notes for this project define existing refund lines as negative adjustment lines inside an invoice unless the business process explicitly creates standalone credit notes.

**Alternatives considered**:

- Create standalone credit notes for all refunds: rejected as out of scope for a button that downloads the currently viewed bill.
- Omit refund/penalty lines from XML: rejected because the downloaded bill must match visible bill details and totals.

## Decision: Use fetch/blob download for Factur-X UI feedback while leaving PDF display as `window.open`

**Rationale**: The spec requires clear feedback when Factur-X download is unavailable, denied, or fails. A normal `window.open` download cannot reliably surface response-body errors to the Angular app. Fetching the new endpoint, checking response status and content type, then saving the returned blob lets the UI show existing alert feedback for missing/unauthorized/validation-failed cases. The existing PDF display path can remain unchanged.

**Alternatives considered**:

- Use `window.open` for Factur-X too: rejected because failed downloads would open plain error pages or silent browser behavior instead of in-app feedback.
- Route through websocket: rejected because large binary downloads and browser save behavior fit REST better than websocket messages.

## Decision: Verify with mapper, generator, route, frontend, and manual compliance checks

**Rationale**: Factur-X correctness depends on data mapping, monetary rounding, XML escaping, embedded metadata, route authorization, and UI behavior. Tests should include simple invoice, refund/negative line, missing legal field, role-denied route, and frontend click behavior. Manual/fixture validation should confirm `factur-x.xml`, `text/xml`, Factur-X XMP fields, `EN 16931`, readable PDF content, and PDF/A-3 expectations.

**Alternatives considered**:

- Only test frontend button presence: rejected because the primary risk is invalid invoice output.
- Only visually open the downloaded PDF: rejected because Factur-X success requires structured data and metadata validation.
