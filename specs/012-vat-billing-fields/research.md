# Research: VAT Billing Fields

## Decision: Keep net price as the persisted base and derive VAT-inclusive price everywhere

**Rationale**: The feature states that all current screen and database prices exclude VAT. Preserving `price`, `unitPrice`, `lineTotal`, `grandTotal`, and `totalPrice` as VAT-exclusive avoids breaking historical assumptions while adding explicit gross fields (`priceIncludingVat`, `lineTotalIncludingVat`, `grandTotalIncludingVat`, `totalVatAmount`) for display and documents.

**Alternatives considered**:
- Replace stored prices with gross prices: rejected because it would reinterpret existing data and break current totals.
- Store both net and gross as independent editable values: rejected because independent values can drift; gross should be derived from net + VAT percentage.

## Decision: Store VAT percentage on Merchandise and require it for new merchandise

**Rationale**: The request says each merchandise has its own VAT value. `Merchandise` is the vendor-owned source for catalog items, and the stock form already creates/updates price, stock, category, and image data through websocket actions. A required numeric `vatRate` field on create/update keeps product tax data close to product price data.

**Alternatives considered**:
- Vendor-wide VAT default: rejected because the feature explicitly requires per-merchandise VAT.
- Global tax-rate catalog: rejected as out of scope; vendors enter a numeric percentage directly.

## Decision: Legacy merchandise without VAT remains editable but blocks affected order validation and invoice generation until resolved

**Rationale**: Existing merchandise currently has no VAT field. Automatically assigning 0% or a standard French rate would fabricate tax semantics. The safer migration path is nullable/absent VAT for legacy rows, visible warnings on stock/catalog views, required VAT when vendors edit items, and fail-closed behavior when clients try to validate carts or generate documents for lines missing VAT.

**Alternatives considered**:
- Backfill all existing merchandise to 0%: rejected because it can silently understate VAT.
- Backfill all existing merchandise to 20%: rejected because merchandise categories may use different VAT rates.

## Decision: Snapshot VAT data into carts and validated order lines

**Rationale**: Bills are generated from validated orders and persisted bill records. If a vendor edits a merchandise VAT rate after a client has validated an order, historical bill totals must remain stable. Cart items should carry the rate visible when added; validated order items must persist the final rate, VAT amount, unit gross price, line net total, line VAT amount, and line gross total.

**Alternatives considered**:
- Re-read merchandise VAT during bill generation: rejected because historical documents would change when product VAT changes later.
- Persist only VAT rate and calculate all other values later: acceptable for some fields, but persisted derived line VAT/gross values make bill snapshots auditable and reduce recalculation drift.

## Decision: Use one money/VAT helper for rounding and totals

**Rationale**: Screen, PDF, and Factur-X totals must agree. Rungis already has `roundToTwoDecimals`, but Factur-X notes require currency rounding that is explicit and robust around edge cases. Introduce a shared helper that computes VAT amount and gross price from net cents/decimal-safe math and use it from stock/cart/order/bill/document paths.

**Alternatives considered**:
- Let frontend and backend independently calculate gross values: rejected because rounding differences could appear between UI and generated documents.
- Use unrounded intermediate gross values in UI: rejected because users and documents need currency amounts at 2 decimals.

## Decision: Map VAT rates into Factur-X line VAT and document VAT breakdowns

**Rationale**: Factur-X requires line VAT category/rate and document-level VAT breakdowns. For positive VAT rates, use standard VAT category `S` with the stored merchandise rate. For zero-rated/outside-scope lines, require an explicit reason in normalized invoice data or use the already documented outside-scope behavior only where the business flow has no VAT amount. Structured XML and readable PDF must display matching net, VAT rate, VAT amount, and gross totals.

**Alternatives considered**:
- Keep the existing default outside-scope `O` category for all lines: rejected because the feature introduces explicit VAT percentages.
- Emit VAT only in the PDF layer: rejected because Factur-X XML would then be inconsistent and non-compliant.

## Decision: Use vendor VAT ID and bill mentions from the vendor account at generation time

**Rationale**: Vendor account settings are the requested owner of billing identity data. Current bill routes select vendor party fields directly before PDF and Factur-X generation; adding `vatId` and `billMentions` to the selected vendor party data lets both readable PDF and Factur-X normalized invoice data use the same values.

**Alternatives considered**:
- Copy VAT ID and bill mentions to every merchandise or bill at creation: rejected because these fields describe the vendor billing profile, not an item.
- Require VAT ID at account signup: out of scope; the requested screen is account settings.

## Decision: Expose VAT-inclusive values in every existing price-bearing screen rather than creating separate pages

**Rationale**: The request says all screens should add a price including VAT field. The existing price-bearing surfaces are stock, order catalog/cart, dashboard bill summaries/details, statistics/monthly/overdue bill views, and account-driven bill document actions. Adding columns/labels next to current net values preserves existing workflows.

**Alternatives considered**:
- Show gross prices only on documents: rejected by the explicit all-screens requirement.
- Replace net prices on screens with gross prices: rejected because existing prices must remain VAT-exclusive.

## Decision: Extend existing PDF and Factur-X routes, not add new document routes

**Rationale**: Existing `/pdf` and `/factur-x` bill endpoints already centralize bill document generation and role guards. Extending their inputs and renderers keeps the document behavior consistent with current bill download/display flows.

**Alternatives considered**:
- Add separate gross-price document endpoints: rejected as unnecessary surface area and confusing for users.

## Decision: Test with mixed VAT, missing VAT, refund/adjustment, and rounding fixtures

**Rationale**: The highest-risk cases are mixed rates on one bill, legacy rows without VAT, negative/refund adjustments, late penalties, and rounding mismatches between UI, PDF, and Factur-X XML. Fixtures should assert visible and structured totals agree.

**Alternatives considered**:
- Only test single 20% VAT line: rejected because it would not cover the stated multi-line/multi-rate and document consistency requirements.
