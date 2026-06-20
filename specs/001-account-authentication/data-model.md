# Data Model: Account Authentication

## User Account

Represents a person and organization identity that can authenticate into the portal.

### Fields

- `id`: stable account identifier.
- `role`: one of `admin`, `vendor`, or `client`; public signup can only request `vendor` or `client`.
- `username`: required unique login name, normalized for lookup.
- `organisation`: required business or organization name.
- `firstName`, `lastName`: required personal contact names.
- `city`, `zipcode`, `physicalAddress`: required location and mailing details.
- `email`: required unique email address, normalized for lookup.
- `phoneNumber`: required contact phone number.
- `businessRegistrationId`: required 14-digit business identifier.
- `businessDescription`: optional business profile text.
- `logoFilename`: optional uploaded account logo reference.
- `passwordHash`: credential verifier for password login; raw passwords are never stored.
- `isActive`: activation flag; false for new vendor/client signup requests.
- `passkeys`: owned passkey records.
- `createdAt`, `updatedAt`: audit timestamps.

### Validation Rules

- `username` and `email` must be unique.
- Public signup role must be `vendor` or `client`.
- Required identity/contact fields must be present after trimming.
- `businessRegistrationId` must be an integer with exactly 14 digits.
- `businessDescription` is optional and bounded to a profile-size text field.

### State Transitions

1. Visitor submits valid signup details → inactive User Account is created.
2. Admin activation feature marks the account active → account can complete normal login.
3. Authenticated user updates profile → account fields and session summary refresh.
4. Logout destroys the current session without deleting the account.

## Credential Secret

Represents the password-derived secret used for username/password login.

### Fields

- `passwordHash`: salted hash of the submitted password.

### Validation Rules

- Password must be supplied during signup.
- Login compares the submitted password with the stored hash without exposing either hash internals or account existence details beyond normal invalid-credentials responses.

## Passkey

Represents a WebAuthn credential registered by an authenticated user.

### Fields

- `name`: user-facing label, defaulting to a device summary when not supplied.
- `id`: credential identifier.
- `publicKey`: public key material encoded for storage.
- `counter`: authenticator signature counter.
- `transports`: optional authenticator transport hints.
- `deviceType`: `singleDevice` or `multiDevice`.
- `backedUp`: whether the authenticator reports backup state.
- `createdAt`: registration time.
- `lastUsedAt`: most recent successful authentication time.

### Validation Rules

- Passkeys are owned by exactly one User Account.
- Registration requires an active authenticated session and a matching server-issued registration challenge.
- Authentication requires a matching server-issued authentication challenge, expected origin, expected relying party id, and a credential owned by an active user.
- Users can list and delete only their own passkeys.

## Session

Represents the current authenticated browser state.

### Fields

- `user.id`, `username`, `role`: identity and routing summary.
- Profile summary fields needed by page bootstrap and account display.
- Cookie metadata: http-only session cookie, one-day max age, secure in production.

### State Transitions

1. Successful password or passkey authentication creates a session.
2. Account profile update refreshes the session user summary.
3. Logout destroys the session.
4. Expired session requires re-authentication.

## Signup Request

Represents a successful public signup before admin activation.

### Fields

Same required identity/contact fields as User Account plus the requested role and password input.

### State Transitions

1. Submitted with valid unique data → converted into inactive User Account.
2. Submitted with invalid data → rejected and no account is created.
