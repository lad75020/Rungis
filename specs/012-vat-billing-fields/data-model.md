# Data Model: VAT Billing Fields

## Vendor Billing Profile

Extends the existing vendor `User` record.

### Fields

- `vatId`: string, optional until vendor fills it, exactly 13 characters after trimming when present.
- `billMentions`: string, optional vendor-defined invoice text, preserved with line breaks, displayed in a four-visible-line textarea, maximum length chosen during implementation to prevent oversized documents.
- Existing party fields used by bills: `organisation`, `physicalAddress`, `zipcode`, `city`, `phoneNumber`, `email`, `businessRegistrationId`, `logoFilename`.

### Validation Rules

- Only authenticated users can update their own account profile.
- Only vendors can persist `vatId` and `billMentions`; clients/admins ignore or reject these vendor-only fields.
- `vatId` is valid only when trimmed length is exactly 13 characters.
- `billMentions` may be empty; stored text must be safe for display and XML/PDF serialization.

### Relationships

- Used by bill PDF generation as seller VAT identity and visible bill mention text.
- Used by Factur-X normalized invoice data as seller VAT/tax identifier and invoice note text.

## Merchandise VAT Profile

Extends the existing vendor-owned `Merchandise` record.

### Fields

- `price`: number, required, VAT-exclusive base unit price, existing field.
- `vatRate`: number or null for legacy rows, required for new and edited merchandise, percentage such as `20` for 20%.
- `priceIncludingVat`: derived amount, not independently edited; `price + vatAmount` rounded as currency.
- `vatAmount`: derived unit VAT amount; `price * vatRate / 100` rounded as currency.

### Validation Rules

- `vatRate` must be numeric, finite, non-negative, and within an implementation-defined reasonable maximum for VAT rates.
- New merchandise cannot be created without `vatRate`.
- Editing legacy merchandise must require `vatRate` before save.
- Existing legacy merchandise with missing `vatRate` remains visible but is marked incomplete for gross-price and billing operations.

### Relationships

- Vendor stock list returns `vatRate`, `vatAmount`, and `priceIncludingVat` in addition to existing net price.
- Client catalog returns `vatRate`, `vatAmount`, and `priceIncludingVat` for each available merchandise item.
- Cart and validated order lines snapshot `vatRate` and derived amounts from merchandise.

## Cart Item VAT Snapshot

Extends the Redis cart item structure while the cart is in progress.

### Fields

- Existing: `merchandiseId`, `name`, `reference`, `category`, `vendorId`, `vendorName`, `unitPrice`, `quantity`, `lineTotal`.
- `vatRate`: number captured from merchandise when added or refreshed.
- `unitVatAmount`: derived VAT amount for one unit.
- `unitPriceIncludingVat`: derived gross unit price.
- `lineVatAmount`: derived VAT amount for quantity.
- `lineTotalIncludingVat`: derived gross line total for quantity.

### Validation Rules

- Cart add/update must reject or fail clearly if the selected merchandise lacks `vatRate`.
- Existing cart items preserve their effective `unitPrice` and `vatRate` unless the item is removed and re-added or the implementation explicitly refreshes incomplete tax snapshots with user-visible feedback.
- Cart totals must equal the sum of line net, VAT, and gross values after currency rounding.

### Relationships

- Source for client cart display.
- Source for validated order item snapshots when the client validates the cart.

## Validated Order Item VAT Snapshot

Extends the persisted `ValidatedOrder.items[]` line schema.

### Fields

- Existing: `merchandiseId`, `name`, `reference`, `category`, `vendorId`, `vendorName`, `unitPrice`, `quantity`, `lineTotal`.
- `vatRate`: number required for new validated order lines.
- `vatCategory`: string for invoice mapping, typically `S` when `vatRate > 0` and outside-scope/exempt category only when explicitly valid.
- `vatExemptionReason`: string required for non-standard/non-taxable categories.
- `unitVatAmount`: currency amount for one unit.
- `unitPriceIncludingVat`: gross unit amount.
- `lineVatAmount`: line VAT amount.
- `lineTotalIncludingVat`: line gross total.

### Validation Rules

- Validated order creation fails when any cart item lacks a valid VAT snapshot.
- Line totals must reconcile: `lineTotalIncludingVat = lineTotal + lineVatAmount` after rounding.
- Historical lines remain immutable for billing purposes even if merchandise VAT changes later.

### Relationships

- Vendor/client dashboard bill summaries and details aggregate these fields.
- PDF and Factur-X generation consume these snapshots through `getVendorBillDetails` and `getClientBillDetails`.

## Bill VAT Totals

Extends bill details and, where persisted, the `Bill` record.

### Fields

- Existing: `totalPrice` remains VAT-exclusive total.
- `totalVatAmount`: total VAT amount across lines and adjustments.
- `totalPriceIncludingVat`: gross bill total.
- `vatBreakdowns`: grouped totals by VAT category/rate with taxable amount, tax amount, and gross amount.
- `items[]`: each line includes net unit/line values, VAT rate/category, VAT amount, and gross unit/line values.

### Validation Rules

- Totals must reconcile with item-level sums.
- Bills with multiple VAT rates must expose one breakdown per category/rate.
- Legacy or adjustment lines without VAT metadata must block Factur-X generation and show a clear missing-data reason.

### Relationships

- PDF bill renderer prints net, VAT rate, VAT amount, gross line total, net total, VAT total, and gross total.
- Factur-X normalized invoice data maps these values to line VAT, VAT breakdowns, BT-109/BT-110/BT-112/BT-115 equivalents.

## Bill Document Party Data

Input object passed to PDF and Factur-X generators.

### Fields

- Existing seller/buyer fields: organization, address, postcode, city, phone/contact, legal registration ID.
- Seller-only `vatId` from Vendor Billing Profile.
- Seller-only `billMentions` from Vendor Billing Profile.

### Validation Rules

- Factur-X generation fails when seller VAT ID is required but missing/invalid.
- Bill mentions are serialized as readable PDF text and structured invoice note text with XML escaping.
- Every structured field emitted in XML must be present in the human-readable PDF layer.

## State Transitions

1. **Legacy merchandise created before VAT feature**: `vatRate = null` or absent → visible as incomplete → vendor edits and saves VAT → item becomes orderable/billable with gross price.
2. **New merchandise**: stock form submitted with net price and `vatRate` → backend validates → stored merchandise returns derived gross fields → stock and catalog broadcasts include VAT data.
3. **Cart item**: merchandise added to cart → net price and VAT snapshot captured → cart displays net, VAT, and gross amounts.
4. **Validated order**: cart validated → persisted order item snapshots VAT data and gross totals → stock decremented → dashboard/bill views use persisted snapshots.
5. **Bill document**: bill details aggregate persisted snapshots and vendor billing profile → PDF/Factur-X render matching net/VAT/gross values or fail with missing-data details.
