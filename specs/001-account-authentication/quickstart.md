# Quickstart: Account Authentication

## Prerequisites

- Node.js/npm compatible with the project lockfile.
- MongoDB reachable via `MONGO_URL` or the development default.
- Redis reachable via `REDIS_URL` or the development default.
- Backend secrets set for non-development usage: `SESSION_SECRET`, `JWT_SECRET`.
- WebAuthn production deployments should set `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, and optionally `WEBAUTHN_REQUIRE_USER_VERIFICATION`.

## Install

```bash
npm install
```

## Run the application locally

```bash
npm run dev
```

The backend listens on the configured `HOST`/`PORT` (`127.0.0.1:3199` by default). The Angular app is built/watched through the frontend workspace and served by the backend public assets flow.

## Validate account signup and password login

```bash
npm run test:functional -- e2e/auth.functional.spec.js
```

Expected coverage:

1. A vendor or client can submit signup details and land in a pending activation state.
2. Activated users can log in and reach the role-appropriate page.
3. Invalid, inactive, or rate-limited login attempts fail with user-correctable feedback.

## Validate role boundary behavior related to authentication

```bash
npm run test:functional -- e2e/role-access.functional.spec.js
```

Expected coverage:

1. Protected pages reject users without the correct role.
2. Session routing respects admin, vendor, and client roles.

## Validate backend checks

```bash
npm --workspace backend test
```

This suite should continue to pass after any account-authentication change. If new backend tests are added for login cooldowns, passkey challenge failures, or profile validation, run the same command.

## Manual passkey smoke test

1. Start the app with a WebAuthn-compatible browser origin.
2. Log in as an activated user.
3. Open account management.
4. Enroll a passkey with a recognizable name.
5. Confirm the key appears in the access-key list.
6. Log out.
7. Start passkey authentication and confirm the user reaches the expected role destination.
8. Delete the passkey and confirm it no longer appears or authenticates.

## Regression guardrails

- Password login must remain available when passkey support is unavailable.
- Public signup must never create active vendor/client accounts.
- A user must not list, delete, or authenticate with another user's passkey.
- Duplicate username/email and invalid 13-digit business identifiers must remain rejected.
