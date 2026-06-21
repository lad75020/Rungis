# Quickstart: Admin User Management

## Validate admin page access and role boundaries

```bash
npm run test:functional -- e2e/role-access.functional.spec.js
```

## Validate general authentication entry points used by admin routing

```bash
npm run test:functional -- e2e/auth.functional.spec.js
```

## Validate backend user-management behavior

```bash
npm --workspace backend test -- --test-name-pattern='admin user'
```

This focused suite must prove:

1. Admin-created users are persisted with `isActive: false`.
2. Non-admin requests are rejected by the route guard.
3. Duplicate username or email payloads fail safely.
4. Malformed payloads, dangerous keys, and submitted unique ID fields are rejected.
5. Create/update/load responses omit `password`, `passwordHash`, and passkey data.
6. Updates can enable/disable an existing user, and optional password replacement hashes only non-empty passwords.

## Validate build and backend regression suite

```bash
npm run build
npm --workspace backend test
```

## Manual smoke test

1. Log in as an administrator.
2. Open `/admin`.
3. Confirm the admin user management section shows a create-user form and a search/select/update form instead of pending-user approval actions.
4. Create a vendor/client/admin user with valid required fields and a password.
5. Confirm the creation success message states the user is disabled by default and the password field is cleared.
6. Search for the user by organization prefix, select the row, and confirm the update form is prefilled without any password value.
7. Enable and then disable the user through the update form.
8. Try duplicate username/email values and confirm field-level errors are displayed without leaking passwords or hashes.
9. Try the same page as vendor and client and confirm redirect/rejection.
10. Save valid and invalid overdue-days/style-profile values.
11. Trigger daily bill generation with a valid date and confirm completion feedback.
