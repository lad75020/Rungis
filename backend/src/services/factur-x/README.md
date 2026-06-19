# Rungis Factur-X service

The service normalizes existing vendor/client bill details into one `InvoiceFacturXData` object, renders a readable PDF layer, embeds `factur-x.xml`, writes Factur-X XMP metadata, and validates the generated attachment/metadata before a route sends bytes to the browser.

## Modules

- `invoice-data.js` — party, line, VAT, totals, rounding, and missing-data checks.
- `generator.js` — explicit `factur-x` package presence check, XML generation, readable PDF rendering, PDF attachment/XMP writing, and route sender.
- `validation.js` — embedded XML extraction and local structural checks for filename, MIME marker, AF relationship, and XMP fields.

## Package caveat

The required npm package `factur-x@0.0.2` is installed and checked at generation time, but its published package points `main` to TypeScript source under `node_modules`, which Node refuses to execute directly (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). Until the package ships runnable JavaScript exports for writing, Rungis uses its transitive PDF primitives (`pdf-lib`) plus local validation while keeping the explicit dependency check in place.

## Compliance caveat

Automated tests validate the embedded `factur-x.xml`, `text/xml` marker, document-level AF relationship, and required Factur-X XMP fields. Full PDF/A-3, official XSD, and Schematron validation still require adding the official validation artifacts/tools (for example veraPDF and the Factur-X 1.09 XSD/Schematron bundle) to CI.
