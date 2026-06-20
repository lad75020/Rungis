# Contract: Bill Document Cleanup

This feature changes existing presentation and validation behavior. It does not add new HTTP endpoints. The contract below defines the observable behavior that implementations and tests must satisfy.

## Scope

Applies to daily vendor/client bills:

- Vendor PDF bill from existing vendor bill PDF action.
- Client PDF bill from existing client bill PDF action.
- Vendor Factur-X bill readable invoice layer from existing vendor Factur-X download action.
- Client Factur-X bill readable invoice layer from existing client Factur-X download action.
- Vendor bill detail popup table.
- Client bill detail popup table.
- SIRET/businessRegistrationId validation in account/profile/admin/script/bill-generation surfaces.

Does not apply to:

- Category filters and category display in catalog/order/stock/statistics screens outside bill popups.
- Rungis marketplace service-fee invoice modal/documents unless shared helpers are modified and tests confirm no regression.
- VAT ID validation.

## Document Presentation Contract

### Given a vendor or client bill has bill mentions

When the readable PDF bill is generated:

- The bill mentions text appears after the core line-item, VAT, and total information in a bottom notes area.
- The seller/buyer identity blocks do not contain the bill mentions as their primary placement.
- Multi-line note text remains readable.
- The document does not display a `Category` column or equivalent category-only label in the line item table.

When the readable Factur-X bill is generated:

- The readable PDF layer follows the same bottom notes placement.
- The readable PDF layer does not display a `Category` column or equivalent category-only label in the line item area.
- The structured XML may continue to include valid invoice notes for bill mentions.
- The structured XML remains consistent with the readable invoice and passes the existing validation gates.

### Given a vendor or client bill has no bill mentions

When any readable document is generated:

- No confusing blank bill-mentions content is displayed.
- Totals and footer/Factur-X metadata remain readable.

## Bill Popup Contract

### Vendor bill popup

The visible line item table includes:

- Item name/reference.
- Unit price.
- VAT rate.
- Unit price including VAT.
- Quantity.
- Line total.
- Line total including VAT.

The visible line item table excludes:

- Category header.
- Category cell values.

Existing settlement status, vendor settlement checkbox, optional client comment, total summary, Display PDF action, Download Factur-X action, and Close action remain available.

### Client bill popup

The visible line item table includes:

- Item name/reference.
- Vendor name.
- Unit price.
- VAT rate.
- Unit price including VAT.
- Quantity.
- Line total.
- Line total including VAT.

The visible line item table excludes:

- Category header.
- Category cell values.

Existing settlement status, client settlement checkbox, comment editor, total summary, Display PDF action, Download Factur-X action, and Close action remain available.

## SIRET/businessRegistrationId Validation Contract

### Accepted values

- A final SIRET/businessRegistrationId value containing exactly 14 digits after normal leading/trailing whitespace trimming.

### Rejected values

- 13-digit values.
- Values shorter than 14 digits.
- Values longer than 14 digits.
- Values with alphabetic characters.
- Values with embedded spaces, punctuation, or formatting characters.
- Missing values where the existing workflow requires businessRegistrationId.

### Error behavior

- Interactive form validation provides a clear message that the SIRET/businessRegistrationId must be 14 digits.
- Backend validation rejects invalid values before persistence or document generation.
- Factur-X generation fails closed with a structured error when seller or buyer SIRET/businessRegistrationId is invalid.

### Helper exception

A helper may accept a 13-digit prefix only when the helper's explicit purpose is to compute and return a final 14-digit SIRET with a check digit. Such helpers do not count as final SIRET validation surfaces.

## Regression Contract

- Category data remains present in source bill item objects where existing non-billing workflows need it.
- Category removal is display-only for the scoped billing surfaces.
- Bill UUID generation continues to use five-digit `users.uniqueId` values and must not switch to SIRET/businessRegistrationId.
- Existing authorization behavior for bill detail access and document downloads remains unchanged.
