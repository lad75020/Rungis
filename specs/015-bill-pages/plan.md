# Implementation Plan: Dedicated Bill Pages

**Branch**: `015-bill-pages` | **Date**: 2026-06-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-bill-pages/spec.md`

**Note**: This file is filled by the `/speckit-plan` workflow and stops after Phase 2 planning artifacts.

## Summary

Move role-specific vendor/client bill management out of the shared dashboard into two dedicated bill pages: `/vendor-bills` for vendors and `/client-bills` for clients. The implementation will remove the existing embedded bill sections from `frontend/src/app/pages/dashboard-page.component.html`, keep dashboard navigation entry points, add role-guarded server page routes and thin Angular page wrappers, reuse the existing bill detail modals, and introduce dedicated bill-list state/actions that expose scrollable 10-row lists, filters, VAT-inclusive totals, status icons, and row-level status checkboxes.

The plan deliberately reuses the existing `Bill` document fields: `vendorSettled` is the vendor-side paid status, and `clientSettled` is the client-side received/reception status. No new persistent collection is required; list view models derive payment lateness from existing overdue-day rules and order delivery context.

## Technical Context

**Language/Version**: Node.js with ES modules; Angular 22 TypeScript with strict template/type checking; local verification expects Node.js satisfying the Angular 22 engine range documented in `.sdd/docs/developer-guide.md`.

**Primary Dependencies**: Fastify page/routes stack, Mongoose/MongoDB `Bill`, `ValidatedOrder`, and `User` models, existing WebSocket request/response actions, Angular standalone components, signals, and existing translation catalog.

**Storage**: Existing MongoDB documents only. `Bill.vendorSettled` represents paid status for vendors; `Bill.clientSettled` represents received/reception status for clients; `Bill.totalPriceIncludingVat` provides VAT-inclusive amount; `ValidatedOrder.deliveryDate`/validated order grouping supports overdue calculation where needed. No schema migration is planned.

**Testing**: Backend Node test runner under `backend/test/**/*.test.js`; Angular/Vitest tests under `frontend/src/app/*.spec.ts`; production build through `npm run build`; focused functional verification can reuse existing role page and bill modal flows.

**Target Platform**: Authenticated browser web application served by Fastify with Angular assets generated into `backend/src/public/angular`.

**Project Type**: Full-stack web application with server-rendered page shells, WebSocket-backed state actions, and Angular role pages.

**Performance Goals**: Dedicated bill pages display 10 rows without page navigation and keep normal list/filter/status update interactions visibly responsive within 2 seconds under typical Rungis bill counts.

**Constraints**: Backend role guards remain authoritative; frontend role checks are only UX. Bill list and mutation actions must reject cross-role/cross-organization access. Monetary displays must use VAT-inclusive totals where specified. Checkbox clicks must not also open the row modal. Generated Angular output must remain under `backend/src/public/angular`. Dashboard bill sections must be removed without removing Rungis invoice or client message/dashboard navigation features.

**Scale/Scope**: Two dedicated role pages, two role-specific list view models, three filters per role, two row-level status updates, existing modal reuse, translations, and focused backend/frontend tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution at `.specify/memory/constitution.md` is still the generated template and is unratified/template-only. Because it does not define project-specific governance, this plan applies explicit default gates appropriate to the Rungis web application:

- **Platform UX gate**: Dedicated bill workflows must be reachable from dashboards, show empty/no-results states, keep 10 visible rows in a scrollable area, and preserve existing bill detail modal behavior. **Pass**.
- **Security and role-boundary gate**: Client/vendor bill list and mutation actions must enforce server-side role and organization ownership checks. **Pass**.
- **Financial data integrity gate**: Historical bills must use existing persisted bill/order values and shared rounding/VAT fields rather than recalculating from current merchandise. **Pass**.
- **Testability gate**: Plan identifies backend contract tests, frontend page/state tests, and build verification. **Pass**.
- **Scope control gate**: No new billing collection, no new payment processor integration, and no dashboard redesign beyond removing embedded bill sections and adding navigation. **Pass**.

No gate violations require complexity justification.

## Project Structure

### Documentation (this feature)

```text
specs/015-bill-pages/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-pages.openapi.yaml
│   └── bill-pages-websocket.yaml
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/
│   │   └── bill.model.js
│   ├── routes/
│   │   ├── index.js
│   │   └── modules/
│   │       ├── pages.js
│   │       └── websocket.js
│   ├── views/
│   │   ├── client-bills.ejs
│   │   └── vendor-bills.ejs
│   └── i18n/
│       └── translations.json
└── test/
    └── billing or websocket-focused tests

frontend/
└── src/app/
    ├── app.ts
    ├── app.html
    ├── app.types.ts
    ├── app.constants.ts
    ├── app.spec.ts
    └── pages/
        ├── dashboard-page.component.html
        ├── client-bills-page.component.ts
        ├── client-bills-page.component.html
        ├── vendor-bills-page.component.ts
        └── vendor-bills-page.component.html
```

**Structure Decision**: Use the existing Rungis architecture: Fastify owns role-guarded page shells and WebSocket action registration, while Angular page wrappers activate App-owned state. Bill list state remains in `frontend/src/app/app.ts` and `app.types.ts` until a broader decomposition is planned.

## Design Review — Information Architecture

### Bill-page hierarchy

The dedicated vendor and client pages share one calm, data-dense workspace hierarchy. The role changes the counterparty and settlement wording only.

```text
Page title + one-sentence role orientation + Back to dashboard
└── Filter bar: date from, date to, counterparty, status
    └── Result context: visible count + Clear filters
        └── Scrollable bill list (10 visible rows)
            └── Bill row: counterparty | date | VAT-inclusive amount | status
                ├── Details button: opens the existing bill-detail modal
                └── Settlement checkbox: changes only the role-authorized status
```

**Interaction decision (D2)**: Each row uses a dedicated, visibly labelled **Details** button. The row itself is not clickable or keyboard-button-like. The settlement checkbox remains a separate labelled control and must never open the modal. This removes nested interactive controls and gives keyboard and touch users two unambiguous actions.

## Design Review — Interaction State Coverage

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Initial bill list | Keep the page title and filter labels visible; show 10 neutral row skeletons with no actionable controls. | Show a warm role-specific message that no bills exist yet and retain Back to dashboard. | Preserve any previously loaded rows; show an inline alert above the list with **Retry**. | Replace skeletons with rows and announce the loaded count. | If some bill metadata cannot load, retain available rows and state which data could not be refreshed. |
| Filtered list | Keep current rows visible with a compact “Updating results” indicator; do not blank the panel. | Say “No bills match these filters,” identify that filters are active, and offer **Clear filters**. | Keep the prior result set and selected filter values; show **Retry** without silently resetting filters. | Update the visible count and move focus only when the user explicitly invokes filtering. | Show available matching rows and an inline warning if one filter option source is unavailable. |
| Settlement checkbox | Disable only that checkbox, show its saving status, and leave Details available. | N/A. | Restore the prior checked state, keep the row in place, and show an inline row-level retry message. | Replace the saving status with a brief, non-blocking confirmation and announce the new settlement state. | If the server confirms an update but fresh list reload fails, retain the confirmed row state and show a refresh warning. |
| Details modal | Keep the selected row visible; show a modal body skeleton and retain a working Close control. | Explain unavailable historic detail and offer Close. | Keep the list context behind the modal; show a readable error plus **Retry** and **Close**. | Show persisted bill values and role-allowed actions. | Show complete persisted totals first, then identify unavailable optional detail such as a comment or export. |

**State decision (D3)**: All user-visible states are part of the bill-page acceptance criteria. State copy must distinguish no bills from no filter matches, preserve user filters after errors, and never imply that a settlement update succeeded until the server confirms it.

## Design Review — User Journey and Emotional Arc

| Step | User does | User should feel | Plan support |
|---|---|---|---|
| 1 | Lands on Vendor Bills or Client Bills | Oriented in under five seconds | Role-specific title, one-sentence purpose, and a persistent Back to dashboard action identify the workspace. |
| 2 | Narrows a large bill set | In control, not lost | Clearly labelled filters retain values, result count explains scope, and Clear filters is always available. |
| 3 | Scans a bill | Confident that money and status are understandable | One row exposes counterparty, date, VAT-inclusive amount, status, and separate Details and settlement controls. |
| 4 | Opens bill details | Reassured before acting | The modal uses persisted historical values, role-authorized actions, and a working Close control in every state. |
| 5 | Changes paid or received status | Certain what changed and able to recover | Apply the change immediately only after server confirmation; show a row-level success message with **Undo** for a short, documented window. |
| 6 | Revisits the workflow | Trusts the tool for ongoing reconciliation | Filters, count, role language, and recent settlement state remain stable across refresh and recovery. |

**Journey decision (D4)**: Settlement updates use immediate server-confirmed feedback with a short, accessible **Undo** action. Undo restores only the specific persisted status, retains active filters and scroll context, and degrades to a clear row-level error with Retry if the compensating update fails. No confirmation dialog appears for every routine change.

## Design Review — Local Bill-page Visual Spec

No repository `DESIGN.md` exists. Reuse the established vocabulary in `frontend/src/styles-primary.css` rather than inventing a new brand layer: Aptos/Avenir Next body typography, `--space-1` through `--space-7`, `--app-*` surfaces and semantic colors, and `--app-focus-ring`.

- **Workspace:** One primary list surface, not a dashboard-card mosaic. The page title uses the strongest text treatment; the role subtitle and count are secondary; filters and actions are utility controls.
- **Data rows:** Use a stable grid with counterparty, date, VAT-inclusive amount, semantic status text, Details, and settlement action. Amounts align at the end; long counterparties truncate with a tooltip/accessible full name.
- **Status:** Pair every semantic color with visible text. Use `--app-success` for confirmed, `--app-warning` for pending/late attention, and `--app-danger` only for failed or overdue error states. Replace decorative emoji with text plus an accessible semantic icon where needed.
- **Surfaces and borders:** Use `--app-surface`, `--app-border`, and `--app-border-strong` to group functional areas. Avoid new gradients, ornamental icons, repeated rounded cards, or decorative shadows inside the bill workspace.
- **Controls:** Keep labels above inputs, use 44px minimum touch targets for Details, checkbox labels, Retry, Undo, and Clear filters. Use `--app-focus-ring` for visible keyboard focus.
- **Density:** Desktop rows target 60px minimum height and show ten rows in a bounded scroll panel. Reduce only secondary spacing on smaller screens, never body text below 16px.

**Visual-system decision (D5)**: This local bill-page spec is the implementation reference until a product-wide `DESIGN.md` exists. Both role pages must share it; role-specific differences are content and authorized status actions, not divergent styling.

## Phase 0: Research

Research output is captured in [research.md](research.md). All planning decisions are resolved with no open clarification markers.

## Phase 1: Design and Contracts

Design output is captured in:

- [data-model.md](data-model.md)
- [contracts/http-pages.openapi.yaml](contracts/http-pages.openapi.yaml)
- [contracts/bill-pages-websocket.yaml](contracts/bill-pages-websocket.yaml)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

After Phase 1 design, the default gates still pass:

- **Platform UX gate**: Page routes, navigation entry points, 10-row scroll list, filters, status icons, and modal interactions are represented in contracts and quickstart checks. **Pass**.
- **Security and role-boundary gate**: Contracts require role-scoped page guards and WebSocket actions that validate connected user role/ownership before reads or mutations. **Pass**.
- **Financial data integrity gate**: Data model maps paid/received state to existing bill fields and requires VAT-inclusive totals from persisted bill/order values. **Pass**.
- **Testability gate**: Quickstart enumerates backend tests, frontend tests, build, and focused manual role-flow verification. **Pass**.
- **Scope control gate**: No new persistent model or payment integration added to the design. **Pass**.

## Complexity Tracking

No constitution gate violations were identified, so no complexity exceptions are recorded.
