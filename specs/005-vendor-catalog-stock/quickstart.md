# Quickstart: Vendor Catalog and Stock

## Scope

This is a retrospective Spec Kit Time Machine feature. Verify the implementation by inspecting the queued source files and running the build/test commands below.

## Source Files

- `backend/src/models/merchandise.model.js`
- `backend/src/routes/modules/websocket.js`
- `backend/src/routes/modules/auth.js`
- `backend/src/lib/angular-assets.js`
- `frontend/src/app/pages/stocks-page.component.ts`
- `frontend/src/app/pages/stocks-page.component.html`
- `frontend/src/app/app.ts`
- `frontend/src/app/app.types.ts`

## Verification Commands

```bash
npm run build
npm --workspace frontend test -- --watch=false
```

## Verified Evidence

- `npm run build` passed Angular production build (verified 2026-06-19T02:15Z).
- `npm --workspace frontend test -- --watch=false` passed 10/10 frontend tests (verified 2026-06-19T02:16Z).

## Manual Checks

- Confirm server-side guards reject unauthorized roles for this feature's endpoints or websocket actions.
- Confirm UI states expose loading, success, empty, and error feedback where the feature is interactive.
- Confirm generated artifacts contain no unresolved placeholders before marking the feature done.
