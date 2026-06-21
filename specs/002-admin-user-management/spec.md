# Feature Specification: Admin User Management

**Feature Branch**: `feature/time-machine-admin-user-management`

**Created**: 2026-06-19

**Status**: Refined

**Refined**: 2026-06-21 — Replaced the pending user approval section with full form-based administrator user create and update functionality; administrator-created users are disabled by default.

**Input**: User description: "Feature: Admin User Management. Description: Admins approve pending accounts, remove inactive users, manage role permissions, and configure core administrative settings. Relevant files: backend/src/routes/modules/management.js, backend/src/models/user.model.js, backend/src/lib/app-settings-store.js, frontend/src/app/pages/admin-page.component.ts, frontend/src/app/pages/admin-page.component.html, frontend/src/app/app.ts, frontend/src/app/app.types.ts, e2e/role-access.functional.spec.js. Focus on this feature only; do not modify other features."

**Refinement Input**: User description: "Replace the admin page pending user approval section by a full form-based user create and update functionality. Created users are always disabled by default."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create users with an admin form (Priority: P1)

As an administrator, I want to create vendor, client, and administrator user accounts through a complete admin form so user onboarding can be handled from the admin page instead of a pending approval queue.

**Why this priority**: The admin page must support direct account creation with all required user identity, contact, business, role, and credential fields before broader account maintenance is useful.

**Independent Test**: Log in as an administrator, open the admin user form, create a user with valid required fields, and verify the saved user exists, is disabled by default, and cannot be created by a non-admin request.

**Acceptance Scenarios**:

1. **Given** an administrator completes all required user form fields, **When** they submit the create action, **Then** the system creates the user and returns the created record for display in the admin user list.
2. **Given** an administrator submits the create form, **When** the request includes an active/enabled value, **Then** the system ignores or rejects that value and persists the new user as disabled.
3. **Given** a non-admin user attempts to create a user, **When** the request is made, **Then** the system rejects the request.
4. **Given** duplicate username, duplicate email, invalid SIRET, invalid VAT ID, unsupported unique identifier input, or missing required fields, **When** the administrator submits the form, **Then** the system rejects the request with field-level validation feedback and does not create a partial user.
5. ~~**Removed**: Pending vendor or client signup accounts are listed for activation decisions.~~ This pending approval queue is replaced by direct form-based administrator user creation.
6. ~~**Removed**: Administrators activate pending accounts through a dedicated pending-user action.~~ Created accounts remain disabled by default and any later enablement is handled through the user update form.

---

### User Story 2 - Update users with an admin form (Priority: P2)

As an administrator, I want to find and edit existing user accounts through the same admin page so I can correct profile data, change roles, and enable or disable accounts without using the old pending-user workflow.

**Why this priority**: Account maintenance requires safe updates to user identity, role, contact, business, and activation state after creation.

**Independent Test**: Search for an existing user, load it into the admin form, update editable fields including active/disabled status, save, and verify persisted changes while non-admin users remain blocked.

**Acceptance Scenarios**:

1. **Given** an existing user is selected from the admin user list or search results, **When** an administrator opens it for editing, **Then** the form is prefilled with the current editable user fields.
2. **Given** an administrator changes valid editable fields, **When** they save the form, **Then** the user record is updated and the admin list reflects the new values.
3. **Given** an administrator enables or disables an existing user through the update form, **When** they save the form, **Then** the user's activation state changes only through the update endpoint and is auditable as an admin action.
4. **Given** an administrator submits invalid updates or duplicate username/email values, **When** the request is made, **Then** the system rejects the change without modifying the existing user.
5. **Given** a malformed or unknown account identifier is submitted, **When** the update request runs, **Then** the system returns a safe validation or not-found error.
6. ~~**Removed**: Administrators delete inappropriate pending signup requests through the pending-user queue.~~ The pending-delete workflow is out of scope after the queue is replaced by form-based user administration.
7. ~~**Removed**: Active users are protected only by the pending-delete workflow.~~ Active-user safety must instead be enforced by the user update permissions and validation rules.

---

### User Story 3 - Configure core admin settings (Priority: P3)

As an administrator, I want to update operational settings such as overdue-bill threshold, style profile, and manual daily billing run date so the portal behavior can be adjusted without code changes.

**Why this priority**: Operational settings affect billing follow-up, presentation, and recovery workflows.

**Independent Test**: Update each supported admin setting with valid and invalid values and verify the system persists accepted values and rejects invalid input.

**Acceptance Scenarios**:

1. **Given** an administrator enters a valid overdue-days value, **When** they save it, **Then** the setting is updated for subsequent overdue-bill workflows.
2. **Given** an administrator selects a supported app style profile, **When** they save it, **Then** the selected profile is returned in page bootstrap configuration.
3. **Given** an administrator triggers daily bill generation for a valid day, **When** the operation completes, **Then** the result reports how many bills were updated.

---

### Edge Cases

- Non-admin users must be redirected or rejected from all admin-only pages and endpoints.
- Admin actions must reject invalid or malformed account identifiers.
- Created users must always be disabled by default, regardless of any submitted create-form activation value.
- User create actions must generate a MongoDB-unique 5-digit unique ID server-side; create and update payloads must reject any submitted unique ID field as protected input.
- Password input is required for user creation and must be stored only as a hash; password update is optional and must not expose existing password data.
- Update actions must not allow unsafe object keys or protected internal fields to be overwritten.
- ~~Pending-user deletion must not remove active users.~~ Removed because pending-user deletion is no longer part of the admin page workflow.
- Overdue-day settings must be an integer between 1 and 3650.
- App style profile must be one of the supported profile values.
- Manual daily bill generation must reject invalid dates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST restrict admin management pages and endpoints to authenticated administrators.
- **FR-002**: ~~The system MUST list inactive vendor and client accounts waiting for activation.~~ Removed: pending approval queue is replaced by form-based user creation and update.
- **FR-003**: ~~The system MUST allow administrators to activate pending vendor and client accounts.~~ Removed: account activation state is maintained through the user update form.
- **FR-004**: ~~The system MUST allow administrators to delete inactive pending vendor and client accounts.~~ Removed: pending-user deletion is no longer part of this feature.
- **FR-005**: ~~The system MUST prevent the pending-user delete workflow from deleting active accounts.~~ Removed: pending-delete no longer exists; update validation protects active users.
- **FR-006**: The system MUST expose and update the overdue-bill-days setting with integer bounds from 1 to 3650.
- **FR-007**: The system MUST expose and update the global application style profile using only supported profile names.
- **FR-008**: The system MUST allow administrators to trigger daily bill generation for a valid ISO calendar day.
- **FR-009**: The admin UI MUST show loading, disabled, success, and error states for management actions.
- **FR-010**: The system MUST provide an admin-only endpoint and UI form for creating users with required role, username, identity, contact, business, and password fields, without exposing a unique identifier input.
- **FR-011**: The system MUST persist every administrator-created user as disabled by default and MUST NOT allow the create request to enable the user.
- **FR-012**: The system MUST provide an admin-only endpoint and UI form for loading and updating existing user records, without exposing a unique identifier input.
- **FR-013**: The user update form MUST support editable profile fields, role changes, and active/disabled status changes for existing users.
- **FR-014**: The system MUST validate user create and update payloads at the backend boundary, reject submitted unique ID fields as protected input, generate a MongoDB-unique 5-digit user unique ID during creation, and reject duplicate or malformed username, email, SIRET, VAT ID, role, and required field values.
- **FR-015**: The system MUST hash created or updated passwords and MUST never return password hashes or password values in admin API responses.
- **FR-016**: The admin UI MUST provide form-level and field-level feedback for create/update validation errors and preserve safe entered values after a failed save.

### Key Entities *(include if feature involves data)*

- **Admin Managed User**: A vendor, client, or administrator account editable from the admin page, including role, username, system-generated unique ID, identity, organization, contact, business, and activation status fields.
- **Admin User Form**: The create/update form state for validating required user fields, optional password update, loading/saving/error states, and excluding the application-managed unique ID from editable inputs.
- **Pending User**: ~~An inactive vendor or client account awaiting administrator action.~~ Removed from the admin page workflow; inactive accounts are now managed through the Admin Managed User form.
- **Admin Setting**: A named operational value such as overdue-bill threshold or app style profile.
- **Billing Run Request**: A chosen calendar day for manual bill generation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can create a valid user from the admin page in under 60 seconds during normal operation, and the created account is disabled on first persistence.
- **SC-002**: 100% of non-admin attempts to access admin management endpoints are rejected or redirected.
- **SC-003**: Invalid setting values are rejected before changing stored settings.
- **SC-004**: Successful setting updates are visible on the next admin page load.
- **SC-005**: Administrators can locate, edit, and save an existing user in under 60 seconds during normal operation.
- **SC-006**: 100% of successful user create/update API responses omit password hashes and raw password values.

## Assumptions

- Public signup and password authentication are handled by Account Authentication.
- Vendor-client association management is documented as a separate Time Machine feature even though it appears on the same admin page.
- Analytics reporting is documented as a separate Time Machine feature.
- Manual daily bill generation reuses the existing billing implementation; this feature only covers the admin trigger.
- Administrator-created users start disabled so administrators can verify data before enabling the account through the update form.
