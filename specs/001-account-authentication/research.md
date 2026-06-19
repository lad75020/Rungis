# Research: Account Authentication

## Decision: Use cookie-backed sessions as the primary browser authentication state

**Rationale**: The existing portal is a server-rendered/browser application where pages and Angular bootstrap data depend on the current session. Redis-backed sessions keep logout, page authorization, and current-user lookup aligned across backend page routes, REST endpoints, and websocket token issuance.

**Alternatives considered**:

- Stateless browser JWTs: rejected because revocation/logout and server-rendered page decisions are simpler and safer with server-side session state.
- Per-request basic credentials: rejected because it would weaken UX and make passkey integration awkward.

## Decision: Keep password login as the baseline and treat passkeys as optional access keys

**Rationale**: The feature must work on browsers and authenticators with uneven passkey support. Optional passkeys improve security while preserving password login for existing users and unsupported devices.

**Alternatives considered**:

- Passkey-only login: rejected because it would lock out unsupported browsers and conflict with existing password login behavior.
- Password-only login: rejected because the product already includes passkey enrollment and authentication flows.

## Decision: Enforce admin activation as a prerequisite, not as part of this feature's implementation scope

**Rationale**: Account authentication creates inactive vendor/client accounts and blocks inactive login. Admin approval and vendor/client relationship management are separate Time Machine features with their own user stories and files.

**Alternatives considered**:

- Include activation in this feature: rejected because it would couple public signup and administrative management and duplicate the Admin User Management feature scope.

## Decision: Model OpenAPI-style contracts for REST/session endpoints only

**Rationale**: Authentication and account management are exposed through HTTP endpoints with stable request/response shapes. Websocket behavior is not part of this feature except token issuance for downstream realtime features.

**Alternatives considered**:

- No contracts: rejected because planning and task generation need traceable external interfaces.
- Include every route from auth.js: rejected because vendor merchandise image upload belongs to the catalog/stock feature, not account authentication.

## Decision: Validate account identity at both form and backend boundaries

**Rationale**: Required fields, duplicate usernames/emails, and 13-digit business registration identifiers are critical business rules. Backend validation is authoritative; frontend validation improves user correction speed.

**Alternatives considered**:

- Frontend-only validation: rejected because it is bypassable.
- Backend-only validation: acceptable for correctness but worse for user experience; the existing app already supports interactive form feedback.
