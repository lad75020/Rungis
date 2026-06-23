# Research: Dedicated Bill Pages

## Decision: Use dedicated role page routes while retaining dashboard navigation only

**Rationale**: The spec explicitly removes embedded bills sections from the client and vendor dashboards but requires each new page to be accessible from its dashboard. Existing Rungis pages such as `/vendor-monthly-summary`, `/vendor-overdue-bills`, `/vendor-refunds`, `/find-vendors`, and `/order` already use Fastify page routes plus Angular page activation. Matching that pattern keeps role guards server-side and avoids overloading the dashboard template.

**Alternatives considered**:

- Keep bill sections on the dashboard behind collapsed panels: rejected because it conflicts with FR-001 and FR-002.
- Implement only Angular client-side routes under `/dashboard`: rejected because existing role page security is enforced by Fastify page routes and page shells.

## Decision: Reuse existing bill settlement fields for the new labels

**Rationale**: `Bill.vendorSettled` already records the vendor-side payment/settlement status, and `Bill.clientSettled` already records the client-side received/settlement status. The feature's wording changes the visible labels to paid and received, but the stored booleans already represent the two independent role acknowledgements. Reusing them avoids a migration and preserves existing modal/PDF/Factur-X behavior.

**Alternatives considered**:

- Add `paid` and `received` fields to `Bill`: rejected because they would duplicate existing status fields and risk divergence.
- Create a separate status collection: rejected because status belongs to the bill and is already persisted there.

## Decision: Build dedicated list actions instead of overloading dashboard tab actions

**Rationale**: Existing dashboard actions are optimized for date/day tabs and a client-range mode. The new pages need a unified all-bills list with date-range, counterparty, and status filters for each role, plus line-level status icons and checkboxes. Dedicated actions keep the new contracts clear while preserving existing dashboard/modal actions until implementation migrates/reuses them intentionally.

**Alternatives considered**:

- Reuse `dashboard:vendor-bills:list`, `dashboard:vendor-bills:list-by-client-range`, `dashboard:client-bills:list`, and `dashboard:client-bills:unpaid-by-vendor` directly: rejected because they do not cover all filter combinations or the exact displayed status fields.
- Replace existing dashboard actions in-place: rejected because existing modals and related pages currently depend on those action names.

## Decision: Keep existing bill detail modals and detail actions

**Rationale**: The spec requires clicking a bill line to open the existing client or vendor bill modal. `openVendorOrderDetails` and `openClientCartDetails` already call role-specific detail actions and display VAT line details, settlement status, PDF, and Factur-X controls. The new pages should route row clicks into these existing modal flows and only stop propagation for the paid/received checkbox controls.

**Alternatives considered**:

- Create new modal components: rejected because it duplicates detailed bill behavior and raises consistency risk.
- Navigate to a separate bill detail page: rejected because the spec asks for the existing modal.

## Decision: Derive late payment from existing overdue rules

**Rationale**: Existing code computes overdue state from bill/vendor/client/day context and the admin-configured bill overdue-days setting. The client page needs payment status icons: paid, unpaid-not-late, unpaid-late. A bill is late when it is not vendor-paid and the existing due/overdue rule marks it past due. This keeps status consistent with vendor overdue/reminder behavior.

**Alternatives considered**:

- Add a manually editable late flag: rejected because lateness is time-derived and would become stale.
- Use bill creation date only: rejected because existing overdue behavior can depend on order delivery context and configured overdue days.

## Decision: Use VAT-inclusive amount for all new row amounts

**Rationale**: The specification says each row shows bill amount with VAT. The bill model already stores `totalPriceIncludingVat`; validated order items also keep VAT-inclusive totals. New list view models must expose `totalPriceIncludingVat` as the primary row amount and avoid falling back to net totals except as a defensive legacy-data fallback.

**Alternatives considered**:

- Display net `totalPrice`: rejected because it conflicts with FR-008 and FR-013.
- Recalculate VAT from current merchandise: rejected because historical bills must preserve frozen order/bill values.

## Decision: Store filters in frontend page state and send them as one list query payload

**Rationale**: Date range, counterparty, and status filters are page state concerns. Sending all active filters to one role-specific list action keeps pagination/scroll behavior deterministic and makes empty/no-results states easy to test.

**Alternatives considered**:

- Filter entirely on the client after fetching all bills: rejected because role-scoped server filtering is safer and scales better.
- Use separate action per filter control: rejected because it increases race conditions and makes combinations harder to validate.
