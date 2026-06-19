# Research: Admin User Management

## Decision: Keep admin activation separate from public signup

**Rationale**: Public signup creates inactive accounts, while administrators decide whether a business can enter the portal. Separation keeps approval auditable and prevents self-service activation.

**Alternatives considered**: Auto-activation was rejected because the portal is business-to-business and requires approval.

## Decision: Restrict pending deletion to inactive accounts

**Rationale**: The delete action is queue cleanup, not general account lifecycle management. Active-user removal would need separate safeguards and product decisions.

**Alternatives considered**: Deleting any user from the admin page was rejected as too destructive for this feature.

## Decision: Treat overdue-days and style profile as bounded settings

**Rationale**: Settings are operational controls and must reject values outside expected business ranges to avoid billing or presentation regressions.

**Alternatives considered**: Free-form setting writes were rejected because invalid settings would propagate into downstream features.

## Decision: Keep association and analytics concerns out of this feature

**Rationale**: The admin page contains multiple panels, but Time Machine can produce cleaner specifications if association management and analytics reporting remain independent queued features.
