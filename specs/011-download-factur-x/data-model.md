# Data Model: Download Factur-X

## Bill

Represents the existing bill selected in a vendor or client bill details view.

**Fields**:

- `key`: role-specific bill key used by existing bill details and PDF routes.
- `day`: bill day in ISO date format.
- `billIdentifier`: persisted legal/stable bill UUID returned by existing bill persistence logic.
- `orderedAt`: earliest order timestamp or persisted bill timestamp.
- `deliveryDate`: delivery date shown in the bill.
- `items`: visible bill lines, including merchandise lines, refund lines, and penalty lines.
- `totalPrice`: role-visible total for the bill.
- `currency`: expected to be `EUR`.
- `settlement`: existing vendor/client settlement indicators where present.
- `clientComment`: existing bill comment context where present.

**Validation Rules**:

- Bill key must parse for the requested role.
- Bill must exist and contain at least one line after refunds/penalties are included.
- Current user must be authorized for the role-specific bill perspective.

## AuthorizedUserPerspective

Captures whether the current request is vendor-side or client-side.

**Fields**:

- `role`: `vendor` or `client`.
- `userId`: authenticated current user id.
- `counterpartyId`: client id for vendor downloads or vendor id for client downloads.
- `sourceRoute`: `vendor` or `client` route namespace.

**Validation Rules**:

- Vendor downloads require the existing vendor API guard.
- Client downloads require the existing client API guard.
- The bill key must resolve to a bill containing the current user in the matching role.

## InvoiceFacturXData

Normalized invoice object used to render both the readable PDF layer and the embedded structured XML.

**Fields**:

- `profile`: `EN_16931` for supported production downloads.
- `invoiceId`: stable bill identifier for BT-1.
- `issueDate`: invoice issue date in `YYYYMMDD` format.
- `typeCode`: `380` for invoice; future standalone credit notes may use `381`.
- `currency`: `EUR`.
- `seller`: `Party` representing the vendor.
- `buyer`: `Party` representing the client.
- `deliveryDate`: optional delivery date in `YYYYMMDD` format.
- `paymentDueDate`: optional due date when available or configured.
- `lines`: array of `InvoiceLine` values, including refund and penalty adjustments.
- `vatBreakdowns`: array of `VatBreakdown` values matching all line VAT categories/rates.
- `totals`: `InvoiceTotals` with line net, allowances/charges, VAT, grand total, rounding, and amount due.
- `sourceBillKey`: original Rungis bill key for traceability and filename generation.

**Validation Rules**:

- Required Factur-X legal/tax fields must be present before generating output.
- Currency must be EUR for current Rungis bills.
- All monetary totals must be decimal-safe and reconcile to line and VAT breakdown totals.
- Every XML value must also be represented in the readable PDF layer.

## Party

Structured seller or buyer data for Factur-X.

**Fields**:

- `name`: organization or registered name.
- `addressLine1`: street/physical address.
- `postcode`: postal code.
- `city`: city.
- `countryCode`: expected `FR` unless explicit party data says otherwise.
- `legalRegistrationId`: SIRET/SIREN or equivalent legal registration id.
- `legalRegistrationScheme`: scheme id for the legal registration.
- `vatId`: VAT identifier when applicable.
- `email`: electronic address if required by selected profile/platform.
- `phone`: contact number for readable PDF where available.

**Validation Rules**:

- Name, address, postcode, city, country, and legal registration must be complete for supported downloads.
- VAT status must be explicit: VAT id/rate where applicable, or a valid exemption/outside-scope reason.
- Placeholder values such as `-` must not pass Factur-X validation.

## InvoiceLine

Structured invoice line derived from merchandise, refund, or penalty bill lines.

**Fields**:

- `lineId`: stable line number or generated sequence.
- `kind`: `merchandise`, `refund`, or `penalty`.
- `name`: item or adjustment label.
- `description`: optional reference/category details.
- `sellerItemId`: merchandise/reference id where available.
- `quantity`: signed quantity; refunds may be negative invoice lines.
- `unitCode`: coded unit such as `KGM` or `C62`.
- `unitPrice`: decimal-safe net unit price.
- `lineNetAmount`: decimal-safe net line total.
- `vatCategory`: Factur-X VAT category code.
- `vatRate`: VAT percentage where applicable.
- `exemptionReason`: required for exempt/outside-scope categories.

**Validation Rules**:

- Each line must have a name, quantity, unit code, unit price, VAT category, and reconciled line net amount.
- Refund and penalty lines must preserve visible bill sign conventions and total impact.
- Amounts use `.` as decimal separator and at most two fractional digits for monetary totals.

## VatBreakdown

Document-level VAT summary grouped by category and rate.

**Fields**:

- `category`: VAT category code.
- `rate`: VAT rate when applicable.
- `taxableBasis`: total net amount for the category/rate.
- `taxAmount`: VAT amount for the category/rate.
- `exemptionReason`: required for categories without standard VAT.

**Validation Rules**:

- Every line VAT category/rate must have exactly one matching breakdown.
- Standard VAT lines require a rate and tax amount.
- Exempt/outside-scope lines require an accepted reason/code and compatible tax amount.

## InvoiceTotals

Totals used by both XML and readable PDF.

**Fields**:

- `lineNetTotal`: sum of line net amounts.
- `allowanceTotal`: document-level allowances, if any.
- `chargeTotal`: document-level charges, if any.
- `taxExclusiveTotal`: total before VAT.
- `vatTotal`: total VAT.
- `taxInclusiveTotal`: grand total with VAT.
- `prepaidAmount`: amount already paid, if any.
- `roundingAmount`: rounding adjustment, if any.
- `amountDue`: payable amount.

**Validation Rules**:

- Totals must reconcile with line and VAT breakdowns.
- Rounding must be explicit and repeatable, including negative half-cent cases.

## FacturXDownloadResult

Represents the generated response object before it is sent to the browser.

**Fields**:

- `filename`: accounting-friendly `.pdf` filename identifying role, date, counterparty, and Factur-X format.
- `contentType`: `application/pdf`.
- `contentDisposition`: attachment disposition.
- `buffer`: generated Factur-X PDF bytes.
- `validation`: `FacturXValidationResult`.

**Validation Rules**:

- Validation must pass before the response is sent as a successful download.
- Failure returns a safe error response and no partial file.

## FacturXValidationResult

Captures compliance checks for a generated bill.

**Fields**:

- `xmlWellFormed`: structured XML is parseable.
- `profile`: expected `EN 16931`.
- `embeddedFileName`: expected `factur-x.xml`.
- `embeddedMimeType`: expected `text/xml`.
- `xmpDocumentType`: expected `INVOICE`.
- `xmpDocumentFileName`: expected `factur-x.xml`.
- `xmpVersion`: expected `1.0`.
- `pdfAConformance`: PDF/A-3 validation status when validator is available.
- `errors`: actionable errors for logs and user-safe messages.

**Validation Rules**:

- Any failed required check prevents a successful download.
- User-facing messages must not expose sensitive internal data.

## BillDetailsDownloadAction

Frontend action state for the new button.

**Fields**:

- `labelKey`: localized label, for example `common.downloadFacturX`.
- `role`: vendor or client.
- `billKey`: selected bill key.
- `isDownloading`: per-role in-progress indicator.
- `errorMessage`: localized failure alert when fetch or validation fails.

**Validation Rules**:

- Button appears next to `Display PDF` only when a bill details view is open.
- Button is disabled or guarded while a download is already in progress.
- Existing `Display PDF` action remains unchanged.
