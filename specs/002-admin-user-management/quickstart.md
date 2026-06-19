# Quickstart: Admin User Management

## Validate admin page access and role boundaries

```bash
npm run test:functional -- e2e/role-access.functional.spec.js
```

## Validate general authentication entry points used by admin routing

```bash
npm run test:functional -- e2e/auth.functional.spec.js
```

## Validate build and backend regression suite

```bash
npm run build
npm --workspace backend test
```

## Manual smoke test

1. Log in as an administrator.
2. Open `/admin`.
3. Confirm pending-user, overdue-days, style-profile, manual billing, and association panels render.
4. Try the same page as vendor and client and confirm redirect/rejection.
5. Save valid and invalid overdue-days/style-profile values.
6. Trigger daily bill generation with a valid date and confirm completion feedback.
