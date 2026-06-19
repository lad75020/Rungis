# Feature Specification: Admin User Management

**Feature Branch**: `feature/time-machine-admin-user-management`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Admin User Management. Description: Admins approve pending accounts, remove inactive users, manage role permissions, and configure core administrative settings. Relevant files: backend/src/routes/modules/management.js, backend/src/models/user.model.js, backend/src/lib/app-settings-store.js, frontend/src/app/pages/admin-page.component.ts, frontend/src/app/pages/admin-page.component.html, frontend/src/app/app.ts, frontend/src/app/app.types.ts, e2e/role-access.functional.spec.js. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review and activate pending users (Priority: P1)

As an administrator, I want to review pending vendor and client signup requests and activate legitimate accounts so approved businesses can use the portal.

**Why this priority**: Vendor and client workflows are blocked until an administrator activates accounts.

**Independent Test**: Log in as an administrator, load pending users, activate a pending user, and verify that non-admin users cannot access the same controls.

**Acceptance Scenarios**:

1. **Given** pending vendor or client accounts exist, **When** an administrator opens the admin page, **Then** the system lists pending accounts with enough identity information to decide.
2. **Given** a pending account exists, **When** an administrator activates it, **Then** the account becomes active and is removed from the pending list.
3. **Given** a non-admin user attempts to access pending-user actions, **When** the request is made, **Then** the system rejects the request.

---

### User Story 2 - Remove invalid pending users (Priority: P2)

As an administrator, I want to delete inappropriate pending signup requests so the approval queue stays accurate.

**Why this priority**: Invalid or duplicate requests should not remain available for accidental activation.

**Independent Test**: Delete a pending user from the admin interface and verify only inactive pending users can be removed through this workflow.

**Acceptance Scenarios**:

1. **Given** a pending account exists, **When** an administrator deletes it, **Then** the account is removed from the pending list.
2. **Given** an active account exists, **When** an administrator uses the pending-delete workflow, **Then** the system refuses to delete it through that path.

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
- Pending-user deletion must not remove active users.
- Overdue-day settings must be an integer between 1 and 3650.
- App style profile must be one of the supported profile values.
- Manual daily bill generation must reject invalid dates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST restrict admin management pages and endpoints to authenticated administrators.
- **FR-002**: The system MUST list inactive vendor and client accounts waiting for activation.
- **FR-003**: The system MUST allow administrators to activate pending vendor and client accounts.
- **FR-004**: The system MUST allow administrators to delete inactive pending vendor and client accounts.
- **FR-005**: The system MUST prevent the pending-user delete workflow from deleting active accounts.
- **FR-006**: The system MUST expose and update the overdue-bill-days setting with integer bounds from 1 to 3650.
- **FR-007**: The system MUST expose and update the global application style profile using only supported profile names.
- **FR-008**: The system MUST allow administrators to trigger daily bill generation for a valid ISO calendar day.
- **FR-009**: The admin UI MUST show loading, disabled, success, and error states for management actions.

### Key Entities *(include if feature involves data)*

- **Pending User**: An inactive vendor or client account awaiting administrator action.
- **Admin Setting**: A named operational value such as overdue-bill threshold or app style profile.
- **Billing Run Request**: A chosen calendar day for manual bill generation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can load the pending-user queue and complete an activation decision in under 30 seconds during normal operation.
- **SC-002**: 100% of non-admin attempts to access admin management endpoints are rejected or redirected.
- **SC-003**: Invalid setting values are rejected before changing stored settings.
- **SC-004**: Successful setting updates are visible on the next admin page load.

## Assumptions

- Public signup and password authentication are handled by Account Authentication.
- Vendor-client association management is documented as a separate Time Machine feature even though it appears on the same admin page.
- Analytics reporting is documented as a separate Time Machine feature.
- Manual daily bill generation reuses the existing billing implementation; this feature only covers the admin trigger.
