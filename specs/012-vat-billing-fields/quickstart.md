# Quickstart: VAT Billing Fields

## Prerequisites

- Work from the repository root: `/Volumes/WDBlack4TB/Code/rungis`.
- Use the current feature branch: `012-vat-billing-fields`.
- Install workspace dependencies if needed: `npm install`.
- Have MongoDB/Redis test or development services available for integration/manual checks.

## Implementation Verification Commands

```bash
npm --workspace backend test
npm --workspace frontend test -- --watch=false
npm --workspace frontend run build
```

If focused backend tests are added under `backend/test`, run them directly during development:

```bash
npm --workspace backend test -- test/account-vat-fields.test.js test/merchandise-vat.test.js test/order-vat-pricing.test.js test/factur-x/vat-billing-fields.test.js
```

## Backend Acceptance Checks

1. **Vendor account fields**
   - Update a vendor account with `vatId` exactly 13 characters and multi-line `billMentions`.
   - Confirm `GET /api/session` returns both values for the vendor.
   - Confirm invalid VAT ID lengths return a clear `400` error and do not update the account.

2. **Merchandise VAT**
   - Create merchandise with net price `10.00` and VAT `20`.
   - Confirm stock list response includes `vatRate: 20`, `vatAmount: 2.00`, and `priceIncludingVat: 12.00`.
   - Confirm create/update rejects missing, negative, non-numeric, or excessive VAT rates.
   - Confirm legacy merchandise without VAT is marked incomplete and cannot silently become billable with fabricated VAT.

3. **Client catalog and cart**
   - Load client catalog for assigned vendors and confirm each item displays/returns net price and price including VAT.
   - Add merchandise to cart and verify the cart item includes `unitPrice`, `vatRate`, `unitVatAmount`, `unitPriceIncludingVat`, `lineTotal`, `lineVatAmount`, and `lineTotalIncludingVat`.
   - Update quantity and verify net, VAT, and gross totals reconcile.

4. **Order validation**
   - Validate a cart with one 20% VAT item and confirm the persisted validated order stores VAT snapshots.
   - Validate a cart with mixed VAT rates and confirm grouped totals remain correct.
   - Attempt validation with missing VAT data and confirm it fails clearly.

5. **Bill details and documents**
   - Open vendor and client bill details and confirm net total, VAT total, and gross total are shown.
   - Generate vendor and client PDFs and confirm the visible document includes seller VAT ID, bill mentions, line VAT/gross values, and totals.
   - Download vendor and client Factur-X documents and confirm seller VAT ID, invoice note, line VAT, VAT breakdowns, and gross totals match the readable document.

## Manual UI Checklist

- Vendor account settings shows:
  - VAT ID text input.
  - Bill mentions textarea with four visible lines.
  - Validation feedback for invalid VAT ID.
- Vendor stocks screen shows:
  - VAT percentage input in create/edit form.
  - Existing net price column.
  - Price including VAT column.
  - Incomplete VAT warning for legacy items if any.
- Client order screen shows:
  - Catalog item net and gross prices.
  - Cart line net and gross totals.
  - Cart net total, VAT total, and gross total.
- Vendor/client dashboards show:
  - Bill list gross amount where price appears.
  - Bill detail VAT rate/amount/gross line values.
  - Net total, VAT total, and gross total.
- Generated PDF and Factur-X documents show the same fiscal amounts as the UI.

## Factur-X Validation Checklist

- Validate generated XML is well formed.
- Assert `factur-x.xml` is embedded with MIME `text/xml`.
- Assert XMP `fx:DocumentFileName`, `fx:Version`, and `fx:ConformanceLevel` remain consistent.
- Assert line VAT rates and document VAT breakdowns match visible PDF values.
- Run official XSD/Schematron and veraPDF validation when the validation artifacts/tools are available.

## Regression Risks to Watch

- Existing net-only `totalPrice` values should not be renamed or reinterpreted as gross values.
- Vendor VAT edits must not change already validated order line snapshots.
- Updating a merchandise VAT rate should refresh future catalog/cart data but not historical bills.
- Frontend gross previews must match backend-derived values after rounding.
- Refund and penalty lines must not create unreconciled totals in PDF or Factur-X outputs.
