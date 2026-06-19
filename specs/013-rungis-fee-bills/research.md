# Research: Rungis Fee Bills

## Decision: Persist Rungis fee and VAT settings in the existing SQLite app settings store

**Rationale**: The project already has `backend/src/lib/app-settings-store.js`, a SQLite-backed key/value table used by admin settings such as bill overdue days and app style profile. Reusing that helper satisfies the explicit SQLite requirement, keeps settings operationally consistent with existing admin settings, and avoids introducing a second configuration mechanism.

**Alternatives considered**:
- Add settings to MongoDB: rejected because the feature explicitly calls for SQLite persistence for the Rungis fee and existing admin settings have already moved to SQLite.
- Environment variables: rejected because admins must edit rates from the admin page and values must persist at runtime.

## Decision: Store monthly fee invoices in a dedicated MongoDB `rungisbills` collection

**Rationale**: Rungis bills are marketplace service-fee invoices issued by the admin organization to one vendor or client for one month and role. Existing `bills` documents represent daily vendor-client operational bills. A dedicated `RungisBill` model prevents schema ambiguity, allows a unique per user/role/month index, and supports admin paid search without impacting daily bill settlement.

**Alternatives considered**:
- Extend existing `Bill`: rejected because the relationship shape, date granularity, invoice issuer, paid flag, and search workflow differ.
- Store generated invoices only as files: rejected because admin search, paid status, regeneration idempotency, and user dashboard access require queryable bill records.

## Decision: Calculate previous calendar month using UTC month boundaries over `ValidatedOrder.validatedAt`

**Rationale**: Existing daily bill generation and reporting code groups validated orders by UTC dates. Using the previous UTC calendar month keeps monthly calculations consistent with existing `validatedAt` filters and avoids timezone-dependent duplicate or missing edge cases around midnight.

**Alternatives considered**:
- Browser/local timezone boundaries: rejected because admin and server timezone differences would make generation non-deterministic.
- Delivery date boundaries: rejected because the feature says orders during the previous calendar month, and existing order activation statistics use validation time.

## Decision: Generate role-specific monthly totals from validated order net amounts

**Rationale**: The requested gross amount before tax corresponds to existing VAT-exclusive order fields: `ValidatedOrder.items[].lineTotal` and `ValidatedOrder.grandTotal`. Vendor bills sum only the lines whose `vendorId` is the billed vendor. Client bills sum each client order's VAT-exclusive `grandTotal` for the month. This keeps vendor and client perspectives independent and uses already-validated order snapshots.

**Alternatives considered**:
- Sum daily `Bill.totalPrice`: rejected because daily bills may include refunds/penalties and are grouped by vendor-client-day, while the requirement is monthly order gross amount before tax.
- Sum VAT-inclusive totals: rejected because the requirement explicitly asks for gross amount before tax and the Rungis fee is applied before VAT.

## Decision: Snapshot rates, user identity, and admin identity onto each Rungis bill

**Rationale**: A generated invoice must remain reproducible after rates or organization profile fields change. Storing the Rungis fee rate, VAT rate, payable totals, user unique id, role, and party identity snapshots preserves auditability and supports PDF/Factur-X regeneration from the persisted bill.

**Alternatives considered**:
- Always render invoices from live user/admin profiles: rejected because later profile edits would change historical invoice content.
- Store only the minimum fields named in the prompt: rejected because admin search and legal document exports need stable organization names, addresses, logos, phone numbers, and registration IDs.

## Decision: Make generation idempotent per user, role, and applicable month/year

**Rationale**: Admins may click "Send Rungis bills" more than once. A unique scope of `(applicableYear, applicableMonth, role, userUniqueId)` prevents duplicate unpaid bills. If an unpaid bill already exists, generation may refresh calculated values from current eligible order data and current settings; if a paid bill exists, generation must skip it and report that it was preserved.

**Alternatives considered**:
- Always insert new documents: rejected because duplicate unpaid invoices would confuse users and admin search.
- Always overwrite all documents: rejected because paid bills and historical rates must not be reset by a later run.

## Decision: Hide paid bills from unpaid admin search while retaining them in storage

**Rationale**: The admin workflow is a working list of unpaid bills. Marking a bill paid sets `paid: true`, records paid metadata, and removes it from default search results, while the record remains available for audit or future read-only history.

**Alternatives considered**:
- Delete paid bills: rejected because invoices and paid status must be auditable.
- Keep paid bills in the same default result set: rejected because the feature requires paid bills to disappear from search results.

## Decision: Use one normalized Rungis invoice object for modal, PDF, and Factur-X

**Rationale**: The modal, PDF, and Factur-X download must show the same parties, month, gross amount before tax, fee, VAT rate, payable before tax, and payable including VAT. A shared normalized invoice object prevents drift and aligns with the existing Factur-X guardrail that readable PDF and XML are generated from the same fiscal data.

**Alternatives considered**:
- Build PDF and Factur-X directly in route handlers: rejected because it duplicates calculations and increases the risk of inconsistent invoice totals.
- Reuse daily bill normalizer unchanged: rejected because Rungis fee invoices are single service-fee line invoices issued by the admin organization, not product-line vendor-client bills.

## Decision: Represent the Factur-X Rungis bill as a service-fee invoice from admin to billed user

**Rationale**: The admin organization is the invoice issuer/seller and the vendor or client is the buyer. The invoice can be represented as one service line for the Rungis fee for the applicable month, with taxable basis equal to payable amount before tax, VAT rate equal to the admin VAT rate, and amount due equal to payable including VAT. The existing `factur-x` package/service remains the mandatory generation path and must fail closed when required legal/tax fields are missing.

**Alternatives considered**:
- Use the user as seller: rejected because the user is paying a marketplace fee to the admin organization.
- Download a plain XML file: rejected because Factur-X is a hybrid PDF/A-3 invoice with embedded `factur-x.xml`.

## Decision: Add REST endpoints for this feature instead of websocket actions

**Rationale**: Admin settings, bill generation, search, paid state, and document downloads are request/response workflows with clear authorization and error semantics. Existing daily PDF/Factur-X bill downloads are REST endpoints, so Rungis invoice exports should follow the same pattern.

**Alternatives considered**:
- WebSocket actions: rejected because file downloads and admin search are simpler and more cache/authorization explicit over HTTP.
- Frontend-only generation: rejected because bill records, paid state, authorization, and document exports must be server-controlled.
