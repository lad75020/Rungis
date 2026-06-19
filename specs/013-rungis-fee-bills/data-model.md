# Data Model: Rungis Fee Bills

## RungisBillingSettings

Admin-controlled settings persisted in SQLite app settings.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| `rungisFeeRate` | number | yes | Percentage, `0 <= value <= 100`, max 2 decimal places after normalization. |
| `vatRate` | number | yes | Percentage, `0 <= value <= 100`, max 2 decimal places after normalization. |
| `updatedAt` | datetime | system | SQLite row timestamp; exposed only if useful for UI feedback. |

### Storage Keys

- `rungisFeeRate`
- `rungisVatRate`

### Validation Rules

- Missing, non-numeric, negative, or above-maximum values are rejected.
- Saving one setting must not silently clear the other setting.
- Bill generation is blocked until both settings are valid.

## EligibleOrderTotal

Derived monthly aggregate; not stored separately unless tests need fixtures.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| `applicableYear` | integer | yes | Four-digit year of previous calendar month. |
| `applicableMonth` | integer | yes | 1-12 month number. |
| `periodStart` | date | yes | Inclusive UTC month start. |
| `periodEnd` | date | yes | Exclusive UTC next-month start. |
| `role` | enum | yes | `vendor` for received-order totals; `client` for placed-order totals. |
| `userId` | ObjectId | yes | User document used for authorization/lookups. |
| `userUniqueId` | string | yes | Existing five-digit user unique id persisted on Rungis bill. |
| `grossAmountBeforeTax` | money | yes | Vendor: sum `ValidatedOrder.items[].lineTotal` for matching vendor; Client: sum `ValidatedOrder.grandTotal` for matching client. |
| `currency` | string | yes | `EUR`. |

### Validation Rules

- Only positive gross amounts produce a bill.
- Vendor and client aggregates are separate even if the same user could appear in both roles.
- Aggregation uses validated orders whose `validatedAt` is inside `[periodStart, periodEnd)`.

## RungisBill

MongoDB document in collection `rungisbills`.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| `_id` | ObjectId | system | Stable internal bill id for route parameters. |
| `applicableYear` | integer | yes | Four-digit billing year. |
| `applicableMonth` | integer | yes | 1-12 billing month. |
| `periodStart` | date | yes | Inclusive UTC start of the month. |
| `periodEnd` | date | yes | Exclusive UTC end of the month. |
| `role` | enum | yes | `vendor` or `client`. |
| `userId` | ObjectId | yes | Referenced billed user. |
| `userUniqueId` | string | yes | Existing five-digit `users.uniqueId`; required for invoice identifier semantics. |
| `userOrganisationName` | string | yes | Snapshot used by admin search and invoice display. |
| `grossAmountBeforeTax` | money | yes | Monthly eligible order total before tax. |
| `rungisFeeRate` | number | yes | Snapshot of fee percentage used for this bill. |
| `payableAmountBeforeTax` | money | yes | `grossAmountBeforeTax * rungisFeeRate / 100`, rounded to cents. |
| `vatRate` | number | yes | Snapshot of admin VAT percentage used for this bill. |
| `vatAmount` | money | yes | `payableAmountBeforeTax * vatRate / 100`, rounded to cents. |
| `payableAmountIncludingVat` | money | yes | `payableAmountBeforeTax + vatAmount`, rounded to cents. |
| `currency` | string | yes | `EUR`. |
| `paid` | boolean | yes | Defaults to `false`; admin mark-paid sets `true`. |
| `paidAt` | datetime | no | Set when paid changes to true. |
| `paidByAdminId` | ObjectId | no | Admin user who marked paid. |
| `generatedAt` | datetime | yes | Creation/regeneration timestamp for unpaid bills. |
| `adminPartySnapshot` | PartySnapshot | yes | Admin organization identity used on invoice. |
| `userPartySnapshot` | PartySnapshot | yes | Billed user organization identity used on invoice. |
| `createdAt` / `updatedAt` | datetime | system | Mongoose timestamps. |

### Indexes

- Unique: `{ applicableYear: 1, applicableMonth: 1, role: 1, userUniqueId: 1 }`
- Search: `{ paid: 1, applicableYear: 1, applicableMonth: 1, userOrganisationName: 1 }`
- User access: `{ userId: 1, role: 1, paid: 1, applicableYear: -1, applicableMonth: -1 }`

### Validation Rules

- `userUniqueId` must be a five-digit string.
- Amount fields must be finite numbers rounded to two decimals.
- `paid` defaults to false on insertion.
- Regeneration may update unpaid bills but must not set `paid` from true back to false.
- Paid bills are omitted from admin unpaid search but remain stored.

### State Transitions

```text
missing -> unpaid
  Trigger: admin clicks Send Rungis bills and eligible monthly total is positive.

unpaid -> unpaid
  Trigger: admin reruns generation for same month before payment; amounts/rates/snapshots refresh.

unpaid -> paid
  Trigger: admin marks the bill paid; paidAt and paidByAdminId are set.

paid -> paid
  Trigger: repeated mark-paid or regeneration; bill remains paid and is not reset.
```

## PartySnapshot

Identity information embedded in each Rungis bill for stable invoice regeneration.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| `organisation` | string | yes | Organization name. |
| `logoFilename` | string | no | Stored filename used to resolve logo for modal/PDF. |
| `city` | string | yes | Invoice city. |
| `zipcode` | string | yes | Invoice zipcode. |
| `physicalAddress` | string | yes | Invoice street/physical address. |
| `phoneNumber` | string | yes | Required by feature for both admin and user invoice headers. |
| `businessRegistrationId` | string | yes | SIRET/business registration id rendered exactly as invoice text. |
| `email` | string | no | Useful for Factur-X contact data if available. |
| `vatId` | string | no | Required for Factur-X seller tax identity when applicable; admin-side value may need fallback/validation before download. |

## RungisInvoiceView

Normalized response for dashboard modal and source data for PDF/Factur-X.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Rungis bill id. |
| `applicableMonth` | integer | yes | 1-12. |
| `applicableYear` | integer | yes | Four-digit year. |
| `role` | enum | yes | `vendor` or `client`. |
| `adminParty` | PartySnapshot | yes | Top-left party. |
| `userParty` | PartySnapshot | yes | Top-right party. |
| `grossAmountBeforeTax` | money | yes | Euro net order amount. |
| `rungisFeeRate` | number | yes | Fee percentage. |
| `payableAmountBeforeTax` | money | yes | Net fee amount. |
| `vatRate` | number | yes | Admin VAT rate. |
| `vatAmount` | money | yes | VAT amount. |
| `payableAmountIncludingVat` | money | yes | Total due including VAT. |
| `currency` | string | yes | `EUR`. |
| `paid` | boolean | yes | Whether the bill is paid. |
| `pdfUrl` | string | yes | User-scoped PDF endpoint. |
| `facturXUrl` | string | yes | User-scoped Factur-X endpoint. |

## AdminRungisBillSearch

Request/response state for unpaid bill search.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `organization` | string | no | Case-insensitive partial organization query. |
| `month` | string | yes | `YYYY-MM` from year/month picker. |
| `rows[]` | RungisBill summary | yes | Only unpaid matching bills. |

### Search Behavior

- Empty organization query returns all unpaid bills for the selected month.
- Paid bills are excluded from default results.
- Rows include bill id, role, user organization, user unique id, gross amount before tax, payable before tax, VAT rate, payable including VAT, and generated timestamp.
