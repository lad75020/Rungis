# Feature Specification: Account Authentication

**Feature Branch**: `feature/time-machine-account-authentication`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Account Authentication. Description: Users can sign up, log in, manage their account profile, and use passkeys for secure access. Relevant files: backend/src/routes/modules/auth.js, backend/src/models/user.model.js, backend/src/routes/modules/pages.js, frontend/src/app/webauthn-client.ts, frontend/src/app/app.ts, frontend/src/app/app.html, frontend/src/app/app.types.ts, e2e/auth.functional.spec.js. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign up for approval (Priority: P1)

As a vendor or client, I want to create an account request with my business identity and contact details so that an administrator can activate my organization for the marketplace.

**Why this priority**: Approved business identities are required before any role-specific ordering, stock, billing, or relationship workflow can be used.

**Independent Test**: A user can submit the subscription form as a vendor or client with valid details and receives confirmation that the account is pending activation.

**Acceptance Scenarios**:

1. **Given** a visitor provides all required vendor or client identity fields, **When** they submit the subscription request, **Then** the system creates an inactive account and confirms that admin approval is required.
2. **Given** a visitor provides a duplicate username or email, **When** they submit the subscription request, **Then** the system rejects the request without creating another account.
3. **Given** a visitor provides an invalid business registration identifier, **When** they submit the subscription request, **Then** the system explains the validation failure and preserves the user's ability to correct the form.

---

### User Story 2 - Authenticate into the correct role experience (Priority: P2)

As an activated user, I want to log in with my username and password so that I can reach the page appropriate for my role.

**Why this priority**: Authenticated sessions gate all protected portal workflows and prevent inactive or invalid users from entering the application.

**Independent Test**: An activated admin, vendor, or client can log in and is redirected to the role-appropriate area, while inactive and invalid users are rejected.

**Acceptance Scenarios**:

1. **Given** an activated user enters valid credentials, **When** they log in, **Then** the system starts a session and routes them to their role-specific destination.
2. **Given** an inactive user enters otherwise valid credentials, **When** they log in, **Then** the system refuses access and explains that activation is pending.
3. **Given** repeated failed login attempts occur for the same username and origin, **When** the threshold is reached, **Then** the system temporarily blocks further attempts and communicates the cooldown.

---

### User Story 3 - Manage account profile and access keys (Priority: P3)

As an authenticated user, I want to update my profile and manage passkeys so that my business information stays current and I can use stronger authentication on supported devices.

**Why this priority**: Accurate profile data appears throughout business workflows, and passkeys improve security without replacing the existing password path.

**Independent Test**: A logged-in user can update required profile fields, enroll a passkey, list registered access keys, delete an access key, and authenticate with a valid passkey.

**Acceptance Scenarios**:

1. **Given** an authenticated user edits required account fields, **When** they save valid values, **Then** the system updates the account and refreshes the current session view.
2. **Given** an authenticated user enrolls a supported passkey, **When** registration verification succeeds, **Then** the new access key appears in the user's key list.
3. **Given** a registered passkey exists, **When** the user removes it, **Then** the key is no longer accepted for authentication.

---

### Edge Cases

- Duplicate usernames or emails must be rejected during signup and profile updates.
- Only `vendor` and `client` roles can be requested through public signup; `admin` accounts are not self-service.
- Business registration identifiers must be exactly 14 digits.
- Required profile fields must not be blank after trimming.
- Unsupported or malformed uploaded logos must be rejected without changing the account.
- Browsers without passkey support must continue to support password login and profile management.
- Expired, missing, reused, or mismatched passkey challenges must fail safely.
- Failed login cooldowns must not disclose whether a username exists beyond normal credential feedback.
- A user must not be able to delete or list another user's passkeys.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow public signup requests only for vendor and client roles.
- **FR-002**: The system MUST require username, first name, last name, organization, city, zipcode, email, physical address, phone number, business registration identifier, and password for signup.
- **FR-003**: The system MUST store newly signed-up vendor and client accounts as inactive until administrative activation occurs.
- **FR-004**: The system MUST reject duplicate usernames and duplicate email addresses for signup and profile updates.
- **FR-005**: The system MUST validate business registration identifiers as 14-digit numbers before accepting signup or profile changes.
- **FR-006**: The system MUST authenticate activated users with username and password and create a session containing the user's role and profile summary.
- **FR-007**: The system MUST deny normal login for inactive accounts and explain that administrator activation is pending.
- **FR-008**: The system MUST apply a temporary cooldown after repeated failed login attempts.
- **FR-009**: The system MUST allow authenticated users to update their own profile fields and optional business description.
- **FR-010**: The system MUST allow authenticated users to upload a supported profile logo without accepting unsupported image content.
- **FR-011**: The system MUST allow authenticated users on supported devices to register named passkeys for their own account.
- **FR-012**: The system MUST allow authenticated users to list and delete only their own passkeys.
- **FR-013**: The system MUST allow a registered passkey to authenticate the owning active user when verification succeeds.
- **FR-014**: The system MUST reject passkey registration or authentication when the challenge is missing, expired, or does not verify for the expected user and origin.
- **FR-015**: The system MUST allow authenticated users to end their session through logout.

### Key Entities *(include if feature involves data)*

- **User Account**: Represents an admin, vendor, or client identity with role, username, organization, contact fields, business registration identifier, activation state, and optional business description/logo.
- **Credential Secret**: Represents password-derived authentication material used to verify username/password login without exposing the original password.
- **Passkey**: Represents a registered device credential with display name, credential identifier, public key, usage counter, transport hints, device type, backup state, creation time, and last-used time.
- **Session**: Represents the active authenticated browser state containing a safe user summary and role for routing and authorization.
- **Signup Request**: Represents the initial inactive vendor/client account created from a successful public subscription form.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of valid signup submissions create a pending account and show confirmation without manual support.
- **SC-002**: Activated users can complete username/password login and reach the correct role destination in under 10 seconds in normal operating conditions.
- **SC-003**: 100% of inactive accounts are blocked from protected role workflows until activated.
- **SC-004**: 100% of duplicate username/email submissions are rejected with a user-correctable message.
- **SC-005**: Users on passkey-capable devices can enroll, list, delete, and use passkeys without losing password-login access.
- **SC-006**: Repeated invalid login attempts produce a cooldown response before unlimited guessing can continue.

## Assumptions

- Account approval itself is owned by the Admin User Management feature; this feature creates and authenticates account identities.
- Password login remains the baseline authentication path even when passkeys are available.
- Passkeys are optional per account and may coexist with password authentication.
- The user's browser and authenticator determine passkey support; unsupported browsers should not block other account workflows.
- Logo upload support is limited to common web image formats already accepted by the portal.
- Administrative account creation is out of scope for public signup.
