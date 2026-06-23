# Data Model: Dedicated Bill Pages

## Overview

This feature does not introduce a new persistent collection. It projects existing bill, user, and validated-order data into role-specific list rows and updates existing bill status fields.

## Existing Persistent Entities

### Bill

**Source**: `backend/src/models/bill.model.js`

**Purpose**: Represents one vendor-client bill for a bill date.

**Relevant fields**:

- `date`: bill date used for date-range filtering and row display.
- `vendorId`: vendor organization owner for vendor-scoped reads and mutations.
- `clientId`: client organization owner for client-scoped reads and mutations.
- `uuid`: persisted business bill identifier used by exports/details.
- `vendorSettled`: vendor-side paid status. Displayed as the vendor bill page paid checkbox and as client payment status.
- `clientSettled`: client-side received/reception status. Displayed as the client bill page received checkbox and as vendor reception status.
- `totalPriceIncludingVat`: primary row amount for this feature.
- `totalPrice`: legacy/net amount used only as defensive fallback if gross amount is unavailable.
- `totalQuantity`, `lineCount`, `currency`, `orderedAt`: existing summary fields for details and list support.
- `refundLines`, `penaltyLines`: existing adjustments included in bill totals and detail modal.

**Validation rules**:

- `vendorId`, `clientId`, and `date` must identify a single accessible bill.
- Role-specific reads must constrain either `vendorId` or `clientId` to the connected user.
- Role-specific mutations must update only the field owned by the connected role.
- VAT-inclusive display must prefer `totalPriceIncludingVat`.

**State transitions**:

- `vendorSettled: false -> true`: vendor marks bill paid.
- `vendorSettled: true -> false`: vendor marks bill unpaid.
- `clientSettled: false -> true`: client marks related order received.
- `clientSettled: true -> false`: client marks related order not received.

### User Organization

**Source**: `backend/src/models/user.model.js`

**Purpose**: Provides organization names and enforces vendor/client ownership.

**Relevant fields**:

- `_id`: referenced by `Bill.vendorId` and `Bill.clientId`.
- `role`: must be `vendor` or `client` for page access and counterparty dropdowns.
- `organisation`: preferred display label in list rows and filters.
- `username`: fallback display label when organization is blank.
- `vendorIds` / `clientIds`: existing association fields that can constrain dropdowns where needed.

**Validation rules**:

- Vendor dropdown on client page lists only vendors present in the connected client's accessible bills.
- Client dropdown on vendor page lists only clients present in the connected vendor's accessible bills.
- Empty organization names fall back to username or id.

### ValidatedOrder

**Source**: `backend/src/models/validated-order.model.js`

**Purpose**: Supplies historical order/delivery context for bill details and late-payment derivation.

**Relevant fields**:

- `clientId`: client associated with the order.
- `validatedAt`: day that maps to bill date in existing billing flows.
- `deliveryDate`: used by existing overdue rules when determining lateness.
- `items.vendorId`: vendor side of the bill/order grouping.
- Frozen VAT-inclusive line values: used by existing bill generation/detail helpers.

**Validation rules**:

- Do not recalculate historical totals from current merchandise data.
- Overdue calculations must use existing persisted order/bill context and the configured overdue-day setting.

## New View Models

### ClientBillListRow

**Purpose**: Row displayed on `/client-bills` for the connected client.

**Fields**:

- `key`: existing client bill key format, vendor id plus bill day, suitable for existing client bill detail modal.
- `vendorId`: counterparty id for vendor filter.
- `vendorOrganisationName`: visible vendor organization label.
- `billDate`: ISO `YYYY-MM-DD` bill date.
- `amountIncludingVat`: number displayed as bill amount with VAT.
- `currency`: display currency, normally `EUR`.
- `paymentStatus`: `paid`, `unpaid`, or `late`.
- `isPaid`: derived from `vendorSettled`.
- `isLate`: derived from existing overdue rule and only true when unpaid.
- `received`: derived from `clientSettled` and controlled by the received checkbox.

**Filter fields**:

- `fromDate`: inclusive lower bill-date bound.
- `toDate`: inclusive upper bill-date bound.
- `vendorId`: optional vendor id.
- `paymentStatus`: `all`, `paid`, `unpaid`, or `late`.

### VendorBillListRow

**Purpose**: Row displayed on `/vendor-bills` for the connected vendor.

**Fields**:

- `key`: existing vendor bill key format, client id plus bill day, suitable for existing vendor bill detail modal.
- `clientId`: counterparty id for client filter.
- `clientOrganisationName`: visible client organization label.
- `billDate`: ISO `YYYY-MM-DD` bill date.
- `amountIncludingVat`: number displayed as bill amount with VAT.
- `currency`: display currency, normally `EUR`.
- `receptionStatus`: `received` or `not-received`.
- `received`: derived from `clientSettled` and displayed as grey/green check mark status.
- `paid`: derived from `vendorSettled` and controlled by the paid checkbox.

**Filter fields**:

- `fromDate`: inclusive lower bill-date bound.
- `toDate`: inclusive upper bill-date bound.
- `clientId`: optional client id.
- `receptionStatus`: `all`, `received`, or `not-received`.

## Derived Status Rules

### Client payment status

- `paid`: `vendorSettled === true`; display green check mark.
- `late`: `vendorSettled === false` and existing overdue rule says the bill is late; display red alert icon.
- `unpaid`: `vendorSettled === false` and bill is not late; display orange circle icon.

### Vendor reception status

- `received`: `clientSettled === true`; display green check mark.
- `not-received`: `clientSettled === false`; display grey check mark.

## No Data Migration

The current model already contains the two status booleans and VAT-inclusive totals. Implementation may add list-mapper helpers, but it should not require a schema migration unless existing data lacks `totalPriceIncludingVat`; in that case the mapper should use safe fallback display while preserving historical data.
