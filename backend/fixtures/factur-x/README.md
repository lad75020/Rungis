# Factur-X fixtures

Fixture coverage for the bill download feature:

- `simple`: a vendor/client bill with complete parties, one positive merchandise line, and outside-scope VAT defaults used by the current Rungis data model.
- `refund`: a bill with a negative refund line and a positive penalty line so role-specific totals and signs stay stable.
- `missingLegal`: an otherwise valid bill with incomplete party legal data that must fail closed with `missing_invoice_data`.

The current application model stores SIRET, postal address, city, zipcode, organisation, and phone. It does not yet store VAT IDs or payment terms, so the mapper explicitly uses the outside-scope VAT category (`O`, 0%) until those fields exist.
