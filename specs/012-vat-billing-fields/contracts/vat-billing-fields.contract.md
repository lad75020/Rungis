# Contract: VAT Billing Fields

This contract documents the changed data exchanged by existing Rungis REST and websocket surfaces. Existing authentication, authorization, and envelope behavior remain unchanged unless stated.

## REST: `GET /api/session`

### Response User Additions

For authenticated vendors, the `user` object includes:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `vatId` | string | no | Empty string until configured; exactly 13 characters when present. |
| `billMentions` | string | no | Vendor invoice note text; may include line breaks. |

Clients/admins may receive empty strings or omitted vendor-only values.

## REST: `PUT /api/account`

### Vendor Request Additions

When the current user is a vendor, the JSON request accepts:

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `vatId` | string | no | If non-empty after trimming, must be exactly 13 characters. |
| `billMentions` | string | no | Trimmed/sanitized text, multiline allowed, implementation maximum length enforced. |

### Success Response Additions

`user` includes the same `vatId` and `billMentions` values returned by `GET /api/session`.

### Error Responses

- `400` when `vatId` length is not exactly 13 characters after trimming.
- Existing account validation errors continue for required identity fields and SIRET.

## WebSocket: `stocks:create`

### Request Additions

```json
{
  "action": "stocks:create",
  "payload": {
    "name": "Tomatoes",
    "reference": "TOM-001",
    "price": 10,
    "vatRate": 20,
    "stock": 50,
    "minimumStockThreshold": 5,
    "category": "Vegetables",
    "imageFilename": "optional.png"
  }
}
```

### Success Payload Additions

`item` includes:

| Field | Type | Notes |
| --- | --- | --- |
| `vatRate` | number | Stored merchandise VAT percentage. |
| `vatAmount` | number | Unit VAT amount derived from `price`. |
| `priceIncludingVat` | number | Unit gross price derived from `price + vatAmount`. |

### Errors

- Request fails when `vatRate` is missing, non-numeric, negative, or above the accepted maximum.

## WebSocket: `stocks:update`

### Request Additions

Same as `stocks:create`, plus existing `id`.

### Behavior

- Editing legacy merchandise requires a valid `vatRate` before save.
- Changes to `price` or `vatRate` broadcast updated catalog price data to assigned client order pages.

## WebSocket: `stocks:list`

### Success Payload Additions

Each returned item includes `vatRate`, `vatAmount`, and `priceIncludingVat`. Legacy items without VAT return `vatRate: null` and gross fields as `null` or an explicit incomplete state so the UI can display a vendor action prompt.

## WebSocket: `order:catalog`

### Success Payload Additions

Each catalog item includes:

| Field | Type | Notes |
| --- | --- | --- |
| `vatRate` | number or null | Per-merchandise VAT rate. |
| `vatAmount` | number or null | Unit VAT amount when rate is available. |
| `priceIncludingVat` | number or null | Unit gross price when rate is available. |
| `isVatComplete` | boolean | `false` for legacy/incomplete merchandise. |

Catalog displays both net and gross prices; incomplete items cannot be added to a billable cart unless VAT is completed.

## WebSocket: `order:cart:add` and `order:cart:update`

### Cart Item Additions

Returned `cart.items[]` includes:

| Field | Type | Notes |
| --- | --- | --- |
| `vatRate` | number | VAT rate snapshot captured for the cart item. |
| `unitVatAmount` | number | Unit VAT amount. |
| `unitPriceIncludingVat` | number | Unit gross price. |
| `lineVatAmount` | number | VAT amount for quantity. |
| `lineTotalIncludingVat` | number | Gross line total for quantity. |

Returned `cart` includes:

| Field | Type | Notes |
| --- | --- | --- |
| `totalVatAmount` | number | Sum of cart line VAT amounts. |
| `grandTotalIncludingVat` | number | Net grand total plus VAT. |

### Errors

- Add/update fails when merchandise lacks a valid VAT rate.

## WebSocket: `order:cart:validate`

### Behavior Additions

- Persist `vatRate`, VAT category, unit/line VAT, and gross totals into `ValidatedOrder.items[]`.
- Persist/order response totals include net total, VAT total, and gross total.
- Validation fails if any line lacks valid VAT data.

## WebSocket: Dashboard Bill/List/Details Payloads

Existing vendor/client dashboard actions that return bill summaries or details add:

| Field | Location | Type | Notes |
| --- | --- | --- | --- |
| `totalVatAmount` | bill summary/detail | number | Total VAT for the bill. |
| `totalPriceIncludingVat` | bill summary/detail | number | Gross bill total. |
| `vatBreakdowns` | bill detail | array | Grouped by VAT category/rate. |
| `vatRate` | detail item | number | Line VAT rate. |
| `lineVatAmount` | detail item | number | Line VAT amount. |
| `lineTotalIncludingVat` | detail item | number | Gross line total. |
| `unitPriceIncludingVat` | detail item | number | Gross unit price where applicable. |

Existing `totalPrice`, `unitPrice`, and `lineTotal` remain VAT-exclusive.

## PDF Bill Output

Existing `/api/bills/vendor/:key/pdf` and `/api/bills/client/:key/pdf` remain inline PDF endpoints and add visible fields:

- Seller VAT ID.
- Vendor bill mentions.
- Line VAT rate.
- Line VAT amount.
- Gross unit or line price where layout allows.
- Net total, VAT total, and gross total.

## Factur-X Bill Output

Existing `/api/bills/vendor/:key/factur-x` and `/api/bills/client/:key/factur-x` remain attachment endpoints and add structured fields:

- Seller VAT ID from vendor profile.
- Invoice notes from bill mentions.
- Line VAT category/rate and VAT amounts from validated order snapshots.
- Document VAT breakdowns and gross totals consistent with the readable PDF.

Errors remain JSON with a clear message and detail list when required vendor or VAT data is missing.
