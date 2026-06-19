# Quickstart: Download Factur-X

## Scope

Implement a "Download Factur-X" action next to the existing "Display PDF" action in both vendor and client bill details views. The new action downloads a validated Factur-X hybrid PDF while preserving current inline PDF display behavior.

## Source Files to Change

- `backend/package.json`
- `backend/src/routes/modules/bills.js`
- `backend/src/routes/index.js`
- `backend/src/services/factur-x/invoice-data.js`
- `backend/src/services/factur-x/generator.js`
- `backend/src/services/factur-x/validation.js`
- `backend/src/i18n/translations.json`
- `frontend/src/app/app.ts`
- `frontend/src/app/app.spec.ts`
- `frontend/src/app/pages/dashboard-page.component.html`
- `backend/test/factur-x/invoice-data.test.js`
- `backend/test/factur-x/generator.test.js`
- `backend/test/factur-x/routes.test.js`

## Expected User Flow

1. Sign in as a vendor and open a bill details modal that currently contains `Display PDF`.
2. Confirm `Download Factur-X` appears next to `Display PDF`.
3. Click `Display PDF` and confirm existing inline PDF behavior is unchanged.
4. Click `Download Factur-X` and confirm a `.pdf` file is downloaded as an attachment.
5. Repeat as a client from a client bill details modal.
6. Attempt unauthorized and missing-data scenarios and confirm no invalid file is downloaded.

## Verification Commands

```bash
# Install dependencies after adding factur-x
npm install

# Backend Factur-X unit/contract tests
npm --workspace backend test

# Frontend unit tests
npm --workspace frontend test -- --watch=false

# Production frontend build
npm run build

# Optional functional checks when the app is running
npm run test:functional
```

## Factur-X Validation Checks

For generated vendor and client fixture downloads, verify:

- Response uses `Content-Type: application/pdf`.
- Response uses `Content-Disposition: attachment` with a Factur-X-aware `.pdf` filename.
- Embedded structured invoice file is named `factur-x.xml`.
- Embedded XML MIME type is `text/xml`.
- XMP includes `fx:DocumentType=INVOICE`.
- XMP includes `fx:DocumentFileName=factur-x.xml`.
- XMP includes `fx:Version=1.0`.
- XMP conformance level matches the selected Factur-X profile, expected `EN 16931` for supported bills.
- XML profile, XMP profile, and validation artifacts agree.
- Readable PDF layer includes the same fiscal fields represented in XML.
- Missing legal/tax data returns an error response rather than a partial download.

## Manual Checks

- Confirm vendor and client buttons are visually adjacent to the existing PDF buttons.
- Confirm the button label is localized in English and French.
- Confirm a second click while a download is in progress is disabled or ignored safely.
- Confirm route guards reject cross-role and cross-party download attempts.
- Confirm refund and penalty bill lines appear in both readable PDF and structured invoice data.
- Confirm generated files do not expose internal validation traces to unauthorized users.

## Implementation Evidence (2026-06-19)

```text
npm --workspace backend test
Result: PASS — 11 tests passed
Coverage focus: mapper, refund/penalty signs, missing legal data, generator metadata/attachment checks, vendor/client route contracts, invalid key and validation-failure JSON errors.

npm --workspace frontend test -- --watch=false
Result: PASS — 13 tests passed
Coverage focus: existing PDF action unchanged, vendor/client Factur-X fetch+blob downloads, repeated-click guard, and user-visible error feedback.

npm run build
Result: PASS — Angular production bundle generated in backend/src/public/angular.

Manual fixture validation script
Result: PASS
vendor:simple: bytes=6716 xml=5191 embedded=true xmp=true validation=true
client:refund: bytes=6976 xml=7845 embedded=true xmp=true validation=true
```

Notes:

- `factur-x@0.0.2` is installed and checked explicitly, but its npm package exposes TypeScript source as `main`; direct runtime import fails under Node with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. The implementation documents this caveat and uses `pdf-lib` for attachment/XMP work until the package publishes runnable write APIs.
- Full external PDF/A-3, official XSD, and Schematron validation are not automated yet; local validation currently checks embedded filename, MIME marker, AF relationship, XMP fields, XML/profile consistency, and no partial-file response on validation errors.
