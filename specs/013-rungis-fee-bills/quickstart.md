# Quickstart: Rungis Fee Bills

## Prerequisites

- Use the repository root: `/Volumes/WDBlack4TB/Code/rungis`.
- Ensure backend environment variables point to the intended MongoDB, Redis, session, and SQLite app settings locations.
- Ensure at least one active admin, one active vendor, and one active client have organization identity fields required for invoices: organization, logo if desired, city, zipcode, physical address, phone number, businessRegistrationId, and uniqueId.
- Ensure previous-calendar-month validated orders exist for at least one vendor and one client.

## Implementation Verification Commands

Run from repository root:

```bash
git diff --check
npm --workspace backend test
npm --workspace frontend test -- --watch=false
npm --workspace frontend run build
```

For focused backend development before the full suite exists:

```bash
node --test backend/test/rungis-bills/*.test.js
node --test backend/test/factur-x/*.test.js
```

Do not use `npm --workspace frontend test -- --run`; the Angular CLI in this repo rejects that Vitest-style flag.

## Manual Acceptance Flow

1. Sign in as an admin.
2. Open the admin page.
3. Enter a valid Rungis fee percentage and VAT percentage; save and refresh the page.
4. Confirm the saved percentages remain visible.
5. Click "Send Rungis bills".
6. Confirm the success message reports generated, updated, and skipped paid bills for the previous calendar month.
7. Search unpaid Rungis bills with the year/month picker for the applicable month.
8. Filter by a full and partial user organization name; confirm only unpaid matching bills appear.
9. Mark one bill paid; confirm it disappears after refresh and remains paid in storage.
10. Sign in as the billed vendor or client.
11. Open the dashboard and click the € icon.
12. Confirm the modal shows:
    - applicable month/year;
    - admin organization name, logo, city, zipcode, address, phone number, and SIRET at top left;
    - user organization name, logo, city, zipcode, address, phone number, and SIRET at top right;
    - monthly gross order amount before tax;
    - payable amount before tax;
    - admin VAT rate and VAT amount;
    - payable amount including VAT.
13. Select "View PDF" and confirm the PDF contains the same party and amount data.
14. Select "Download Factur-X" and confirm a PDF attachment downloads rather than a plain XML file.
15. Repeat with a user that has no unpaid Rungis bill and confirm a clear empty-state message.

## Factur-X Checks

- The Rungis invoice is a service-fee invoice issued by the admin organization to the billed user.
- The readable PDF and embedded XML must use the same normalized invoice data.
- The embedded file name remains `factur-x.xml` and MIME `text/xml`.
- XMP fields must include `DocumentType=INVOICE`, `DocumentFileName=factur-x.xml`, `Version=1.0`, and the selected conformance level.
- Generation fails with a clear JSON error if required legal/tax fields are missing.

## Expected API Smoke Checks

```bash
# Admin settings round trip
curl -i -X GET /api/admin/settings/rungis-billing
curl -i -X PUT /api/admin/settings/rungis-billing   -H 'Content-Type: application/json'   -d '{"rungisFeeRate":2.5,"vatRate":20}'

# Generate previous-month bills
curl -i -X POST /api/admin/rungis-bills/send

# Search unpaid bills
curl -i '/api/admin/rungis-bills?month=2026-05&organization=market'

# Mark paid
curl -i -X PATCH /api/admin/rungis-bills/{billId}/paid

# User invoice and exports
curl -i /api/rungis-bills/current
curl -i /api/rungis-bills/{billId}/pdf
curl -i /api/rungis-bills/{billId}/factur-x
```

Use authenticated browser/dev-session requests for real validation because these endpoints are session-protected.

## Implementation Notes

- Automated verification completed with focused Rungis backend tests, existing Factur-X regression tests, the full backend test suite, Angular tests, a production Angular build, and `git diff --check`.
- Manual admin/vendor/client acceptance still requires a live authenticated environment with previous-month validated orders and complete invoice identity data.
- Factur-X validation is structural regression coverage around the existing embedded `factur-x.xml` and XMP checks; it is not a replacement for an external legal/compliance validator.
