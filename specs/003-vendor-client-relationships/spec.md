# Feature Specification: Vendor Client Relationships

**Feature Branch**: `feature/time-machine-vendor-client-relationships`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Vendor Client Relationships. Description: Admins and clients maintain vendor-client associations that control catalog visibility and business workflows. Relevant files: backend/src/routes/modules/management.js, backend/src/models/user.model.js, frontend/src/app/pages/admin-page.component.ts, frontend/src/app/pages/admin-page.component.html, frontend/src/app/app.ts, frontend/src/app/app.types.ts. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage associations as admin (Priority: P1)

As an administrator, I want to assign vendors to clients and clients to vendors so business relationships control portal access.

**Why this priority**: Relationship assignment is the foundation for catalog visibility and client ordering.

**Independent Test**: Open the admin association panel, assign a vendor to a client, and verify both sides show the relationship.

**Acceptance Scenarios**:

1. **Given active vendor and client accounts exist**, **When** an admin loads associations, **Then** both lists include current relationship ids.
2. **Given an admin assigns a vendor to a client**, **When** the operation completes, **Then** the client references the vendor and the vendor references the client.
3. **Given a non-admin calls an association endpoint**, **When** the request is made, **Then** the system rejects it.

---

### User Story 2 - Remove obsolete associations (Priority: P2)

As an administrator, I want to remove outdated vendor-client relationships so clients no longer see unrelated catalogs.

**Why this priority**: Removing relationships prevents stale business access from lingering.

**Independent Test**: Remove an association from either direction and confirm both user records are updated.

**Acceptance Scenarios**:

1. **Given a vendor-client relationship exists**, **When** an admin removes it, **Then** it disappears from both accounts.
2. **Given malformed account ids are supplied**, **When** removal is attempted, **Then** the system returns a validation error.

---

### User Story 3 - Let clients discover vendors (Priority: P3)

As a client, I want to discover active vendors and request an assignment so I can start ordering from them.

**Why this priority**: Client self-service reduces admin work for straightforward vendor discovery.

**Independent Test**: Log in as a client, view active vendors, assign one vendor, and confirm catalog eligibility changes.

**Acceptance Scenarios**:

1. **Given active vendors exist**, **When** a client opens Find Vendors, **Then** assignable vendors are listed.
2. **Given a client assigns an active vendor**, **When** the action succeeds, **Then** the relationship is stored symmetrically.

---

### Edge Cases

- Inactive users must not appear as assignable association targets.
- Duplicate assignments must be idempotent rather than creating duplicate ids.
- Removing a missing relationship must leave both accounts consistent.
- Invalid or cross-role identifiers must be rejected before writes occur.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST restrict association management endpoints to authenticated administrators, except client self-assignment from vendor discovery.
- **FR-002**: The system MUST list active clients and active vendors with their current relationship identifiers.
- **FR-003**: The system MUST assign relationships symmetrically on client vendor ids and vendor client ids.
- **FR-004**: The system MUST remove relationships symmetrically from both accounts.
- **FR-005**: The system MUST let clients list active vendors available for discovery.
- **FR-006**: The system MUST let clients assign an active vendor to their own account.
- **FR-007**: The system MUST reject invalid identifiers, inactive accounts, and role mismatches.

### Key Entities *(include if feature involves data)*

- **Vendor**: An active user with role vendor and a clientIds relationship list.
- **Client**: An active user with role client and a vendorIds relationship list.
- **Vendor Client Association**: A bidirectional relationship that controls catalog visibility and workflow eligibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can complete an association add or remove action in under 30 seconds during normal operation.
- **SC-002**: 100% of stored associations are symmetric after add or remove operations.
- **SC-003**: Non-admin users cannot access admin association operations.
- **SC-004**: Clients see newly assigned vendors in dependent workflows on the next refresh or realtime update.

## Assumptions

- Account creation and activation are covered by earlier Time Machine features.
- Associations are many-to-many and are stored directly on user records.
- Catalog visibility depends on the client vendorIds relationship set.
