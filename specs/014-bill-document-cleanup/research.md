# Research: Bill Document Cleanup

## Decision: Treat bill mentions as a bottom document notes section

**Rationale**: The feature explicitly asks for bill mentions at the bottom of generated documents for both vendors and clients. In the current Factur-X readable renderer, seller bill mentions are included in `invoice.includedNotes` but displayed near the seller block. The implementation should preserve those notes in the normalized invoice data and XML `IncludedNote`, while moving their readable placement after line items, VAT breakdown, and totals so users can find legal/commercial notes in a consistent bottom section.

**Alternatives considered**:
- Keep mentions near seller identity: rejected because it contradicts the requested bottom placement and makes long notes compete with party details.
- Remove notes from Factur-X XML when moving the visible text: rejected because Factur-X structured data must remain consistent with the readable invoice and notes are still invoice information.

## Decision: Remove category only from bill presentation surfaces, not from source data

**Rationale**: The spec requires removing the category column from PDF/Factur-X documents and vendor/client bill popups, while preserving category data for non-billing uses. Existing order, stock, search, and statistics flows still rely on category. The implementation should remove table headers/cells and visible category labels from bill document renderers and modal templates, but should not delete `item.category` from validated order snapshots, catalog records, websocket payloads, or analytics aggregations.

**Alternatives considered**:
- Delete category from bill item payloads: rejected because it risks breaking non-billing workflows and is broader than a display cleanup.
- Keep category in the popup but hide it only in exports: rejected because the feature requires popup and document alignment.

## Decision: Use item name/reference/description as the remaining bill-line identity

**Rationale**: Removing category must not make line items ambiguous. Existing bill lines already carry item `name`, optional `reference`, quantity, VAT rate, unit price, VAT-inclusive price, and totals. The popup and readable documents should retain name plus reference/comment where available. Factur-X XML may still include product descriptions from non-category fields; visible output should not use category as a fallback label that effectively preserves the removed column under another name.

**Alternatives considered**:
- Add a new replacement column: rejected because the request is to simplify billing tables by removing category, not to add another classification column.
- Merge category text into the item name: rejected because users would still see category information in billing surfaces.

## Decision: Enforce SIRET/businessRegistrationId as exactly 14 digits after trimming

**Rationale**: French SIRET values are 14 digits. The feature explicitly asks to change 13-digit checks in the application and requires SIRET or `businessRegistrationId` to be 14 digits long. Existing Factur-X party normalization already checks `^\d{14}$`, and account forms currently use `Validators.pattern(/^\d{14}$/)` for `businessRegistrationId`. The implementation should audit all backend, frontend, fixture, seed, migration, and bill-generation preflight checks so final SIRET/businessRegistrationId values consistently reject 13-digit and non-digit values.

**Alternatives considered**:
- Accept formatted SIRET strings with spaces: rejected because the spec's 14-digit rule is strict numeric after normal entry trimming.
- Store SIRET as a JavaScript number everywhere: accepted only for existing schema compatibility if tests prove 14-digit values remain exact and leading zeros are not needed; otherwise future work should consider string storage. This feature does not require a storage migration.

## Decision: Preserve 13-digit SIRET prefix helpers when they generate a final 14-digit SIRET

**Rationale**: `backend/scripts/populate-users-from-insee.js` contains a `completeLuhn(prefix)` helper that intentionally accepts a 13-digit prefix and appends the Luhn check digit to create a 14-digit SIRET. That is not a final SIRET/businessRegistrationId validation surface. Implementation should preserve or clearly document this helper behavior while ensuring any final stored or displayed businessRegistrationId is 14 digits.

**Alternatives considered**:
- Change the helper to accept 14 digits: rejected because the helper's purpose is to calculate the missing check digit from a 13-digit prefix.
- Delete the helper: rejected because tests already verify correct 14-digit SIRET generation from INSEE-style prefix data.

## Decision: Keep VAT ID validation separate from SIRET validation

**Rationale**: Earlier VAT billing work introduced a vendor VAT ID rule that is currently 13 characters. The current feature concerns SIRET/businessRegistrationId 14-digit validation, not VAT ID. Search results show some 13-character checks correspond to `vatId`, not `businessRegistrationId`. Implementation should avoid changing VAT ID behavior unless tests reveal it is mislabeled as SIRET validation.

**Alternatives considered**:
- Change every `13` validation to `14`: rejected because that would alter VAT ID behavior and break a distinct feature requirement.
- Ignore all `13` occurrences: rejected because legacy final SIRET/businessRegistrationId checks might still exist in scripts, fixtures, or validation messages.

## Decision: Use regression tests at the renderer/template level rather than adding new endpoints

**Rationale**: This feature modifies existing outputs and validation behavior. New endpoints or schemas would add unnecessary complexity. Backend tests should assert normalized document data, generated readable PDF text or renderer output where feasible, Factur-X notes/SIRET validation, and route options for both roles. Frontend tests should assert vendor/client modal table column definitions no longer include category while remaining financial columns stay visible.

**Alternatives considered**:
- Add a new bill-preview API: rejected because current popup data already exists over websocket and the export routes already exist.
- Manual-only validation: rejected because layout and validation changes are regression-prone and should be captured in automated tests.
