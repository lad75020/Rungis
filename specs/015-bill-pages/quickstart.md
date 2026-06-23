# Quickstart: Dedicated Bill Pages

## Prerequisites

1. Work from the Rungis repository root:

```bash
cd /Volumes/WDBlack4TB/Code/rungis
```

2. Ensure dependencies are installed:

```bash
npm install
```

3. Ensure MongoDB and Redis are reachable through the local backend environment. Do not copy real values from `backend/.env` into logs or documentation.

## Implementation Checklist

1. Add server page routes in `backend/src/routes/modules/pages.js`:
   - `GET /client-bills` guarded by `requireClientPage`.
   - `GET /vendor-bills` guarded by `requireVendorPage`.

2. Add EJS page shells in `backend/src/views/` for `client-bills.ejs` and `vendor-bills.ejs`, following the existing Angular shell pattern.

3. Extend Angular page types/constants:
   - Add `client-bills` and `vendor-bills` to `PageName` and `SUPPORTED_PAGES`.
   - Add client/vendor bill row and filter types to `app.types.ts`.

4. Add thin page wrappers under `frontend/src/app/pages/` that activate the new pages and delegate state to `App`.

5. Remove embedded vendor/client bill sections from `frontend/src/app/pages/dashboard-page.component.html` and replace them with dashboard entry-point buttons:
   - Vendor dashboard links to `/vendor-bills`.
   - Client dashboard links to `/client-bills`.
   - Keep non-target dashboard sections such as client reminders, client messages, and Rungis invoices unless tasks explicitly say otherwise.

6. Add dedicated bill page UI:
   - 10 visible bill rows in a scrollable list area.
   - Client filters: date range, vendor dropdown, payment status dropdown.
   - Vendor filters: date range, client dropdown, reception status dropdown.
   - Client row: vendor organization, bill date, VAT-inclusive amount, payment status icon, received checkbox.
   - Vendor row: client organization, bill date, VAT-inclusive amount, reception status icon, paid checkbox.
   - Stop checkbox click propagation so status changes do not open the modal.

7. Add WebSocket actions from `contracts/bill-pages-websocket.yaml` or adapt the final task names while preserving the documented payload semantics.

8. Reuse existing modal open flows:
   - Client row click calls the existing client bill detail modal flow.
   - Vendor row click calls the existing vendor bill detail modal flow.

9. Add or update translations in `backend/src/i18n/translations.json` for new page labels, filters, icons, empty states, and status update messages.

## Verification Commands

Run focused checks while iterating, then run the broader checks before completion:

```bash
npm --workspace backend test
npm --workspace frontend test -- --watch=false
npm run build
```

If backend and frontend checks pass and local MongoDB/Redis are reachable, run role-flow functional checks or the existing functional suite as appropriate:

```bash
npm run test:functional
```

Performance smoke is optional for this UI-sized change unless tasks modify shared WebSocket performance behavior:

```bash
npm run perf:test
```

## Manual Role Flow Checks

### Client

1. Sign in as a client with bills from more than one vendor.
2. Open the dashboard and confirm the embedded bills section is gone.
3. Use the dashboard entry point to open `/client-bills`.
4. Confirm 10 rows are visible when at least 10 bills exist and the list scrolls for more.
5. Filter by date range, vendor, and payment status.
6. Confirm paid, unpaid, and late icons match the underlying status.
7. Toggle the received checkbox and verify the row updates without opening the modal.
8. Click a row outside the checkbox and confirm the existing client bill modal opens.

### Vendor

1. Sign in as a vendor with bills for more than one client.
2. Open the dashboard and confirm the embedded bills section is gone.
3. Use the dashboard entry point to open `/vendor-bills`.
4. Confirm 10 rows are visible when at least 10 bills exist and the list scrolls for more.
5. Filter by date range, client, and reception status.
6. Confirm grey/green reception icons match client received state.
7. Toggle the paid checkbox and verify the row updates without opening the modal.
8. Click a row outside the checkbox and confirm the existing vendor bill modal opens.

## Acceptance Mapping

- FR-001 and FR-002: dashboard bill sections removed.
- FR-003 and FR-004: dashboard links open dedicated bill pages.
- FR-005 through FR-017: dedicated list, filters, row fields, icons, checkboxes, and modal behavior.
- FR-018 and FR-019: filters can reset and status changes produce visible success/failure feedback.
- FR-020: backend role and ownership checks enforce bill access boundaries.

## Implementation Verification Notes

Automated verification run on 2026-06-23 from the repository root:

```bash
npm --workspace backend test
npm --workspace frontend test -- --watch=false
npm run build
```

Results:

- Backend: 53 tests passed, including dedicated bill page route guard regression coverage.
- Frontend: 24 tests passed, including dashboard cleanup, client bill page rendering, and vendor bill page rendering coverage.
- Build: production Angular build completed successfully and emitted assets to `backend/src/public/angular`.

Manual browser role-flow checks still require a local session with MongoDB/Redis data containing at least 10 bills for each role.
