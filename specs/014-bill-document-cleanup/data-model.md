# Data Model: Bill Document Cleanup

This feature does not introduce new persistent collections or tables. It tightens validation and display rules for existing billing entities.

## Bill Document

**Represents**: A generated readable bill for a vendor or client, delivered either as a plain PDF or as the readable invoice portion of a Factur-X PDF.

**Existing source fields**:
- `billIdentifier`: Stable bill identifier used in the document.
- `orderedAt` / `deliveryDate` / `day`: Bill dates.
- `vendor`: Seller-side party identity, including organization, address, phone, SIRET/businessRegistrationId, VAT ID, and bill mentions.
- `client`: Buyer-side party identity, including organization, address, SIRET/businessRegistrationId, and contact fields where available.
- `items[]`: Line item snapshots with name, reference, quantity, VAT rate, net/gross unit prices, net/gross line totals, and existing category data.
- `totalPrice` / `totalPriceIncludingVat` / `currency`: Bill totals.
- `includedNotes`: Normalized Factur-X invoice notes derived from bill mentions.

**Validation rules**:
- Seller and buyer SIRET/businessRegistrationId values must satisfy the Business Registration Identifier rules before compliant Factur-X generation succeeds.
- If bill mentions are present, the readable document must render them in the bottom notes area.
- If bill mentions are absent, the document must avoid confusing blank note content.
- Category must not be rendered as a visible column or standalone billing field in PDF or readable Factur-X output.
- Remaining item identity and financial fields must stay sufficient for bill review.

**Relationships**:
- Uses Business Registration Identifier for both seller and buyer legal identity.
- Uses Bill Mentions for the bottom notes area.
- Uses Category only as retained source data for non-billing features, not as visible bill presentation.

## Bill Mentions

**Represents**: Legal, payment, or commercial invoice text associated with the seller/vendor and included in bill documents.

**Fields**:
- `content`: Trimmed text, potentially multi-line.
- `sourceParty`: The party/profile from which the mentions are read for the bill.
- `documentPlacement`: Bottom notes section in readable PDF and readable Factur-X output.
- `structuredInvoiceUse`: Included as invoice note content in Factur-X structured data where the existing normalizer includes it.

**Validation rules**:
- Empty content is allowed.
- Multi-line content must remain readable and must not overlap totals or footer text.
- Content should preserve meaningful line breaks where the renderer supports them.
- Long content may flow to a later page/section, but it must remain after the financial content in reading order.

## Business Registration Identifier

**Represents**: A French SIRET/businessRegistrationId used for party legal identity.

**Fields**:
- `value`: Final stored or validated SIRET/businessRegistrationId value.
- `label`: User-facing label, usually `SIRET`.
- `ownerRole`: Vendor, client, or admin/user profile depending on the validation surface.

**Validation rules**:
- Required where existing account/billing flows already require businessRegistrationId.
- Must be exactly 14 digits after trimming leading and trailing whitespace.
- Must reject 13-digit values.
- Must reject non-digit characters, embedded spaces, punctuation, and formatted variants.
- Final bill generation must fail closed when seller or buyer legal registration identifiers are missing or invalid.
- Helper functions that accept a 13-digit prefix are allowed only when they output a final validated 14-digit SIRET.

**State transitions**:
- `draft input` → `trimmed input` → `accepted 14-digit value` or `rejected validation error`.
- `13-digit prefix` → `14-digit generated SIRET` only inside explicit check-digit generation helpers.

## Bill Popup

**Represents**: Existing vendor/client dashboard modal used to review a daily bill before opening PDF or downloading Factur-X.

**Existing source fields**:
- Vendor modal: client, day, settlement status, optional client comment, `items[]`, totals, PDF/Factur-X actions.
- Client modal: vendor, day, settlement status, comment editor, `items[]`, totals, PDF/Factur-X actions.
- Item fields: name/reference, category, vendor name for client view, unit price, VAT rate, unit price including VAT, quantity, line total, line total including VAT.

**Validation/display rules**:
- Vendor bill popup table must not render a category header or category cell.
- Client bill popup table must not render a category header or category cell.
- Client popup may keep the vendor column because it identifies the seller in client-side multi-vendor views.
- Financial columns for net price, VAT rate, gross price, quantity, and totals must remain visible.
- Removing category must not change settlement checkboxes, comments, PDF action, or Factur-X action behavior.

## Category

**Represents**: Existing catalog/order item classification.

**Rules for this feature**:
- Category remains stored on merchandise, order, validated order, and bill item snapshots.
- Category remains available to catalog, ordering, search, statistics, and non-billing reporting flows.
- Category must not be displayed in daily bill documents or daily vendor/client bill popups.
- Category must not be used as a visible fallback description in readable bill documents when the feature requires category removal.
