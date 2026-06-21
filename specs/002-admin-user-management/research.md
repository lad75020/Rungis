# Research: Admin User Management

## Decision: Replace pending approvals with admin-owned user create/update forms

**Rationale**: Administrators need to create and maintain business users directly from the admin page instead of reviewing a pending-user queue. This makes user lifecycle management explicit, supports corrections after creation, and avoids conflating public signup approval with administrator-created accounts.

**Alternatives considered**: Keeping the pending approval queue was rejected by the refined requirement. Auto-activation of administrator-created users was rejected because created users must always start disabled until an administrator explicitly enables them through the update form.

## Decision: Created users are always disabled by default

**Rationale**: New admin-created accounts should not be usable until their details have been reviewed and the administrator intentionally enables the account. The backend must ignore any create payload activation flag and persist `isActive: false`.

**Alternatives considered**: Letting the create form include an enabled/disabled toggle was rejected because it violates the disabled-by-default invariant.

## Decision: Use one safe admin-managed user response shape

**Rationale**: Create, load, search, and update responses should return the same `AdminManagedUser` shape so Angular forms can prefill data consistently while never exposing `password`, `passwordHash`, passkeys, association arrays, or internal Mongo fields.

**Alternatives considered**: Returning raw user documents was rejected because it can leak sensitive or unrelated account state.

## Decision: Treat admin user form payloads as allowlisted input

**Rationale**: Create/update endpoints accept many profile fields, so the backend must reject dangerous keys (`$`, `.`, `__proto__`, `constructor`, `prototype`) and protected fields (`passwordHash`, `passkeys`, ids, timestamps, association arrays, and `uniqueId`) before applying updates. Duplicate checks cover user-editable unique values (`username` and `email`); `uniqueId` is generated server-side and protected by MongoDB's unique index.

**Alternatives considered**: Reusing raw `User` model assignment was rejected because it risks mass assignment and privilege escalation.

## Decision: Keep overdue-days, style profile, manual billing, associations, and analytics concerns independent

**Rationale**: The admin page contains multiple panels, but the create/update user feature should not regress existing operational controls. Existing setting and billing tests remain regression coverage.

**Alternatives considered**: Combining this feature with broader admin analytics or association redesign was rejected as too broad for the refined scope.
