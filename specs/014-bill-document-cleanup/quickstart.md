# Quickstart: Bill Document Cleanup

## Preconditions

- Work from repository root: `/Volumes/WDBlack4TB/Code/rungis`.
- Current feature pointer should be `specs/014-bill-document-cleanup`.
- Do not delete category data from catalog/order/statistics flows; remove it only from daily bill documents and bill popups.
- Keep VAT ID validation separate from SIRET/businessRegistrationId validation.

## Implementation Checklist

1. Update backend daily bill PDF rendering.
   - Move bill mentions to a bottom notes area after item/VAT/total content.
   - Remove visible category column/field from vendor and client PDF bill output.
   - Preserve item name/reference, quantities, VAT, net/gross prices, totals, refunds, penalties, and party details.

2. Update readable Factur-X rendering.
   - Keep `includedNotes`/XML note generation for bill mentions.
   - Move visible bill mentions to the bottom of the readable PDF layer.
   - Stop rendering category as a visible line field or fallback description.
   - Keep existing Factur-X XML, XMP, embedded `factur-x.xml`, and validation gates intact.

3. Update dashboard bill popups.
   - Remove category header and cell from vendor bill modal table.
   - Remove category header and cell from client bill modal table.
   - Keep client-side vendor column and all financial columns.

4. Audit SIRET/businessRegistrationId validation.
   - Final stored/validated SIRET/businessRegistrationId values must match `^\d{14}$` after leading/trailing trim.
   - Reject 13-digit values and non-digit formatted values.
   - Preserve any 13-digit prefix helper only when it returns a final 14-digit SIRET.
   - Do not change VAT ID's distinct 13-character validation unless a separate requirement covers it.

5. Update tests and fixtures.
   - Add backend tests for 13-digit rejection and 14-digit acceptance.
   - Add backend tests showing bill mentions are present in bottom notes and category is not visible in readable document output.
   - Add frontend tests or template assertions for vendor/client bill modal category removal.
   - Update fixtures/seeds/migrations to valid 14-digit SIRET values where final identifiers are stored.

## Verification Commands

Run from `/Volumes/WDBlack4TB/Code/rungis`:

```bash
npm --workspace backend test
npm --workspace frontend test -- --watch=false
npm run build
```

If Factur-X rendering internals are touched, also run targeted backend tests while developing:

```bash
npm --workspace backend test -- test/factur-x/*.test.js test/bills/*.test.js
```

If script validation helpers are touched, include:

```bash
npm --workspace backend test -- test/scripts/*.test.js
```

## Manual Acceptance Checks

1. Vendor daily bill popup:
   - Open a vendor bill from the dashboard.
   - Confirm there is no category column.
   - Confirm item, VAT, quantity, net/gross price, and totals remain visible.
   - Open PDF and download Factur-X for the same bill.

2. Client daily bill popup:
   - Open a client bill from the dashboard.
   - Confirm there is no category column.
   - Confirm vendor, item, VAT, quantity, net/gross price, and totals remain visible.
   - Open PDF and download Factur-X for the same bill.

3. Generated readable documents:
   - For vendor PDF, client PDF, vendor Factur-X readable layer, and client Factur-X readable layer, verify bill mentions appear at the bottom when present.
   - Verify category is not visible as a table column or standalone line field.
   - Verify documents without bill mentions do not show awkward blank notes.

4. SIRET/businessRegistrationId validation:
   - Try a 13-digit value and confirm it is rejected.
   - Try a valid 14-digit numeric value and confirm it is accepted.
   - Try values with embedded spaces, punctuation, or letters and confirm they are rejected.

## Expected Result

The feature is complete when vendor/client bill popups and generated PDF/Factur-X readable documents all omit category columns, bill mentions appear at the bottom of generated documents, final SIRET/businessRegistrationId validation is strictly 14 digits, existing authorization and document download behavior remain unchanged, and all verification commands pass.
